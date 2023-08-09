import {
    DistributionService,
} from '@buf/lekkodev_cli.bufbuild_connect-es/lekko/backend/v1beta1/distribution_service_connect';
import { Feature as DistFeature, FlagEvaluationEvent, GetRepositoryContentsResponse, Namespace, RegisterClientResponse } from '@buf/lekkodev_cli.bufbuild_es/lekko/backend/v1beta1/distribution_service_pb';
import { Feature } from '@buf/lekkodev_cli.bufbuild_es/lekko/feature/v1beta1/feature_pb';
import { RepositoryKey } from '@buf/lekkodev_sdk.bufbuild_es/lekko/client/v1beta1/configuration_service_pb';
import { PromiseClient, Transport, createPromiseClient } from '@bufbuild/connect';
import { Any, BoolValue, DoubleValue, Int64Value, StringValue, Timestamp, Value } from '@bufbuild/protobuf';
import { backOff } from 'exponential-backoff';
import * as fs from 'fs';
import git from 'isomorphic-git';
import { load } from 'js-yaml';
import watch, { Watcher } from 'node-watch';
import { IFS, IUnionFs, ufs } from 'unionfs';
import { ClientContext } from '../context/context';
import { Client } from '../types/client';
import { EventsBatcher, toContextKeysProto } from './events';
import { Store, StoredEvalResult } from './store';
import path = require('node:path');

const eventsBatchSize = 100;
const defaultRootConfigMetadataFilename = 'lekko.root.yaml';

// An in-memory store that fetches configs from a path on the filesystem.
export class Git implements Client {
    distClient?: PromiseClient<typeof DistributionService>;
    store: Store;
    repoKey: RepositoryKey;
    sessionKey?: string;
    eventsBatcher?: EventsBatcher;
    watcher?: Watcher;
    path: string;
    loader: configLoader;
    shouldWatch: boolean;

    constructor(
        repositoryOwner: string,
        repositoryName: string,
        path: string,
        shouldWatch: boolean,
        transport?: Transport,
        useFS?: IFS,
    ) {
        if (transport) {
            this.distClient = createPromiseClient(DistributionService, transport);
            this.eventsBatcher = new EventsBatcher(this.distClient, eventsBatchSize);
        }
        this.store = new Store();
        this.repoKey = new RepositoryKey({
            ownerName: repositoryOwner,
            repoName: repositoryName
        });
        this.path = path;
        this.loader = new configLoader(path, useFS);
        this.shouldWatch = shouldWatch;
    }

    async initialize() {
        if (this.distClient) {
            const registerResponse = await backOff(() => {
                if (this.distClient) {
                    return this.distClient.registerClient({
                        repoKey: this.repoKey,
                    });
                }
                return (async () => new RegisterClientResponse())();
            });
            this.sessionKey = registerResponse.sessionKey;
            if (this.eventsBatcher) {
                await this.eventsBatcher.init(this.sessionKey);
            }
        }
        await this.load();
        if (this.shouldWatch) {
            this.watcher = watch(this.path, { recursive: true }, async () => {
                await this.load();
            });
        }
    }

    async getBoolFeature(namespace: string, key: string, ctx: ClientContext): Promise<boolean> {
        const wrapper = new BoolValue();
        await this.evaluateAndUnpack(namespace, key, ctx, wrapper);
        return wrapper.value;
    }
    async getIntFeature(namespace: string, key: string, ctx: ClientContext): Promise<bigint> {
        const wrapper = new Int64Value();
        await this.evaluateAndUnpack(namespace, key, ctx, wrapper);
        return wrapper.value;
    }
    async getFloatFeature(namespace: string, key: string, ctx: ClientContext): Promise<number> {
        const wrapper = new DoubleValue();
        await this.evaluateAndUnpack(namespace, key, ctx, wrapper);
        return wrapper.value;
    }
    async getStringFeature(namespace: string, key: string, ctx: ClientContext): Promise<string> {
        const wrapper = new StringValue();
        await this.evaluateAndUnpack(namespace, key, ctx, wrapper);
        return wrapper.value;
    }
    async getJSONFeature(namespace: string, key: string, ctx: ClientContext): Promise<object> {
        const wrapper = new Value();
        await this.evaluateAndUnpack(namespace, key, ctx, wrapper);
        return JSON.parse(wrapper.toJsonString());
    }
    async getProtoFeature(namespace: string, key: string, ctx: ClientContext): Promise<Any> {
        const result = this.store.evaluateType(namespace, key, ctx);
        this.track(namespace, key, ctx, result);
        return result.evalResult.value;
    }

    track(namespace: string, key: string, ctx: ClientContext, result: StoredEvalResult) {
        if (!this.eventsBatcher) {
            return;
        }
        this.eventsBatcher.track(new FlagEvaluationEvent({
            repoKey: this.repoKey,
            commitSha: result.commitSHA,
            featureSha: result.configSHA,
            namespaceName: namespace,
            featureName: key,
            contextKeys: toContextKeysProto(ctx),
            resultPath: result.evalResult.path,
            clientEventTime: Timestamp.now(),
        }));
    }    

    async evaluateAndUnpack(
        namespace: string, 
        configKey: string, 
        ctx: ClientContext, 
        wrapper: BoolValue | StringValue | Int64Value | DoubleValue | Value,
    ) {
        const result = this.store.evaluateType(namespace, configKey, ctx);
        if (!result.evalResult.value.unpackTo(wrapper)) {
            throw new Error('type mismatch');
        }
        this.track(namespace, configKey, ctx, result);
    }

    async load() {
        const contents = await this.loader.getContents();
        const loaded = this.store.load(contents);
        return loaded;
    }

    async close() {
        if (this.eventsBatcher) {
            await this.eventsBatcher.close();
        }
        await backOff(async () => {
            if (this.distClient) {
                await this.distClient.deregisterClient({
                    sessionKey: this.sessionKey
                });
            }
        });
        if (this.watcher) {
            this.watcher.close();
        }
    }
}

// Class to help with loading configs from the filesystem.
class configLoader {
    fs: IUnionFs;
    path: string;

    constructor(
        path: string,
        useFS?: IFS
    ) {
        this.path = path;
        const filesystem = ufs.use(fs);
        if (useFS) {
            filesystem.use(useFS);
        }
        this.fs = filesystem;
    }

    async getContents() {
        const ret = new GetRepositoryContentsResponse({
            commitSha: await this.getCommitSha(),
            namespaces: await this.getNamespaces()
        });
        return ret;
    }

    async getCommitSha() {
        return await git.resolveRef({fs: this.fs, dir: this.path, ref: 'HEAD'});
        // const lg = await git.log({fs: this.fs, dir: this.path});
        // if (lg.length == 0) {
        //     throw new Error('config repo has no git history');
        // }
        // return lg[0].oid;
    }

    async getNamespaces() : Promise<Namespace[]> {
        return new Promise((resolve) => {
            const mdFilePath = path.join(this.path, defaultRootConfigMetadataFilename);
            this.fs.readFile(mdFilePath, {encoding: 'utf-8'}, async (err, mdContents) => {
                const yaml = load(mdContents) as RootConfigMetadata;
                const nsNames = yaml.namespaces;
                resolve(Promise.all(nsNames.map(async (nsName) => {
                    return new Namespace({
                        name: nsName,
                        features: await this.getConfigs(nsName),
                    });
                })));
            });
        });
    }

    async getConfigs(nsName: string) : Promise<DistFeature[]> {
        return new Promise((resolve, reject) => {
            const protoDirPath = path.join(this.path, nsName, 'gen', 'proto');
            this.fs.stat(protoDirPath, (err, stats) => {
                if (!stats.isDirectory()) {
                    reject(`path ${protoDirPath} is not a directory`);
                }
                this.fs.readdir(protoDirPath, (err, dirContents) => {
                    resolve(Promise.all(dirContents
                        .filter((file) => file.endsWith('.proto.bin'))
                        .map(async (file) => {
                            return await this.getConfig(protoDirPath, file);
                        })
                    ));
                });
            });
        });
    }

    async getConfig(protoDirPath: string, file: string) : Promise<DistFeature> {
        const filepath = path.join(protoDirPath, file);
        return new Promise((resolve) => {
            this.fs.readFile(filepath, async (err, fileContents) => {
                resolve(new DistFeature({
                    name: file.replace('.proto.bin', ''),
                    sha: (await git.hashBlob({
                        object: fileContents
                    })).oid,
                    feature: Feature.fromBinary(fileContents)
                }));
            });
        });
    }
}

export type RootConfigMetadata = {
    version: string,
    namespaces: string[]
}

