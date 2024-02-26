import {
    DistributionService,
} from '../gen/lekko/backend/v1beta1/distribution_service_connect';
import { Feature as DistFeature, FlagEvaluationEvent, GetRepositoryContentsResponse, Namespace, RegisterClientResponse } from '../gen/lekko/backend/v1beta1/distribution_service_pb';
import { Feature } from '../gen/lekko/feature/v1beta1/feature_pb';
import { RepositoryKey } from '../gen/lekko/client/v1beta1/configuration_service_pb';
import { PromiseClient, Transport, createPromiseClient } from '@connectrpc/connect';
import { Any, BoolValue, DoubleValue, Int64Value, StringValue, Timestamp, Value } from '@bufbuild/protobuf';
import { backOff } from 'exponential-backoff';
import * as fs from 'fs';
import git from 'isomorphic-git';
import { load } from 'js-yaml';
import watch, { Watcher } from 'node-watch';
import { IFS, IUnionFs, ufs } from 'unionfs';
import { ClientContext } from '../context/context';
import { Client, DevClient } from '../types/client';
import { EventsBatcher, toContextKeysProto } from './events';
import { SDKServer } from './server';
import { Store, StoredEvalResult } from './store';
import * as path from 'path';
import * as os from 'os';
import { ListContentsResponse } from '../gen/lekko/server/v1beta1/sdk_pb';
import { spawn } from 'child_process';

const eventsBatchSize = 100;
const defaultRootConfigMetadataFilename = 'lekko.root.yaml';

// An in-memory store that fetches configs from a path on the filesystem.
export class Git implements Client, DevClient {
    distClient?: PromiseClient<typeof DistributionService>;
    store: Store;
    repoKey: RepositoryKey;
    sessionKey?: string;
    eventsBatcher?: EventsBatcher;
    watcher?: Watcher;
    path: string;
    loader: configLoader;
    shouldWatch: boolean;
    useFS?: IFS;
    server: SDKServer;
    version: string;

    constructor(
        repositoryOwner: string,
        repositoryName: string,
        path: string,
        shouldWatch: boolean,
        version: string,
        transport?: Transport,
        useFS?: IFS,
        port?: number,
        createMissing = true,
    ) {
        if (transport) {
            this.distClient = createPromiseClient(DistributionService, transport);
            this.eventsBatcher = new EventsBatcher(this.distClient, eventsBatchSize);
        }
        this.store = new Store(repositoryOwner, repositoryName);
        this.repoKey = new RepositoryKey({
            ownerName: repositoryOwner,
            repoName: repositoryName
        });
        this.path = this.resolveHomedir(path);
        this.version = version;
        this.useFS = useFS;
        this.loader = new configLoader(this.path, useFS);
        this.shouldWatch = shouldWatch;
        this.server = new SDKServer(this, port, createMissing);
    }

    async initialize() {
        if (this.distClient) {
            const registerResponse = await backOff(() => {
                if (this.distClient) {
                    return this.distClient.registerClient({
                        repoKey: this.repoKey,
                        sidecarVersion: this.version,
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

    async reinitialize({ path, force }: { path?: string, force?: boolean }): Promise<void> {
        if (path) {
            path = this.resolveHomedir(path);
            if (path !== this.path || force) {
                this.path = path;
                this.loader = new configLoader(this.path, this.useFS);
                await this.load();
                if (this.shouldWatch && this.watcher) {
                    this.watcher.close();
                    this.watcher = watch(this.path, { recursive: true }, async () => {
                        await this.load();
                    });
                }
            }
        }
    }

    getBool(namespace: string, key: string, ctx?: ClientContext): boolean {
        const wrapper = new BoolValue();
        this.evaluateAndUnpack(namespace, key, wrapper, ctx);
        return wrapper.value;
    }
    getInt(namespace: string, key: string, ctx?: ClientContext): bigint {
        const wrapper = new Int64Value();
        this.evaluateAndUnpack(namespace, key, wrapper, ctx);
        return wrapper.value;
    }
    getFloat(namespace: string, key: string, ctx?: ClientContext): number {
        const wrapper = new DoubleValue();
        this.evaluateAndUnpack(namespace, key, wrapper, ctx);
        return wrapper.value;
    }
    getString(namespace: string, key: string, ctx?: ClientContext): string {
        const wrapper = new StringValue();
        this.evaluateAndUnpack(namespace, key, wrapper, ctx);
        return wrapper.value;
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    getJSON(namespace: string, key: string, ctx?: ClientContext): any {
        const wrapper = new Value();
        this.evaluateAndUnpack(namespace, key, wrapper, ctx);
        return JSON.parse(wrapper.toJsonString());
    }
    getProto(namespace: string, key: string, ctx?: ClientContext): Any {
        const result = this.store.evaluateType(namespace, key, ctx);
        this.track(namespace, key, result, ctx);
        return result.evalResult.value;
    }

    listContents(): ListContentsResponse {
        return this.store.listContents();
    }

    async createConfig(type: 'string' | 'bool' | 'int' | 'float' | 'json', namespace: string, key: string): Promise<void> {
        // Invoke Lekko CLI to add namespace (okay if it fails due to already existing)
        await new Promise<void>((resolve, reject) => {
            const cmd = spawn("lekko", ["ns", "add", "-n", namespace], { cwd: this.path });
            cmd.on("error", (e) => {
                reject(e);
            });
            cmd.on("exit", () => {
                resolve();
            });
        });
        // Invoke Lekko CLI to create new config
        await new Promise<void>((resolve, reject) => {
            const cmd = spawn("lekko", ["config", "add", "-t", type, "-n", namespace, "-c", key], { cwd: this.path });
            cmd.on("error", (e) => {
                reject(e);
            });
            cmd.on("exit", (code) => {
                if (code !== 0) {
                    reject(new Error("Failed to create config"));
                }
                resolve();
            });
        });
        // Reinitialize to make sure new contents are loaded
        // TODO: Make this cheaper
        await this.reinitialize({ path: this.path, force: true });
    }

    track(namespace: string, key: string, result: StoredEvalResult, ctx?: ClientContext) {
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

    evaluateAndUnpack(
        namespace: string, 
        configKey: string, 
        wrapper: BoolValue | StringValue | Int64Value | DoubleValue | Value,
        ctx?: ClientContext,
    ) {
        const result = this.store.evaluateType(namespace, configKey, ctx);
        if (!result.evalResult.value.unpackTo(wrapper)) {
            throw new Error('type mismatch');
        }
        this.track(namespace, configKey, result, ctx);
    }

    async load() {
        const contents = await this.loader.getContents();
        const loaded = this.store.load(contents);
        return loaded;
    }

    async close() {
        this.server.close();
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

    // Resolve homedir in path to absolute (conventionally ~ on many platforms)
    resolveHomedir(path: string): string {
        return path.replace(/^~(?=$|\/|\\)/, os.homedir());
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
        try {
            return await git.resolveRef({fs: this.fs, dir: this.path, ref: 'HEAD'});
        } catch (e) {
            throw new Error(`Invalid path to git repository: ${this.path}`);
        }
    }

    async getNamespaces() : Promise<Namespace[]> {
        return new Promise((resolve) => {
            const mdFilePath = path.join(this.path, defaultRootConfigMetadataFilename);
            this.fs.readFile(mdFilePath, {encoding: 'utf-8'}, async (err, mdContents) => {
                const yaml = load(mdContents) as RootConfigMetadata;
                const nsNames = yaml.namespaces;
                return resolve(Promise.all(nsNames.map(async (nsName) => {
                    return new Namespace({
                        name: nsName,
                        features: await this.getConfigs(nsName),
                    });
                })));
            });
        });
    }

    async getConfigs(nsName: string) : Promise<DistFeature[]> {
        return new Promise((resolve) => {
            const protoDirPath = path.join(this.path, nsName, 'gen', 'proto');
            this.fs.stat(protoDirPath, (err, stats) => {
                if (!stats || !stats.isDirectory()) {
                    return resolve([]);
                }
                this.fs.readdir(protoDirPath, (err, dirContents) => {
                    return resolve(Promise.all(dirContents
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
                return resolve(new DistFeature({
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

