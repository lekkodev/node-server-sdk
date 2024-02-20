import {
    DistributionService,
} from '@buf/lekkodev_cli.connectrpc_es/lekko/backend/v1beta1/distribution_service_connect';
import { FlagEvaluationEvent } from '@buf/lekkodev_cli.bufbuild_es/lekko/backend/v1beta1/distribution_service_pb';
import { RepositoryKey } from '@buf/lekkodev_sdk.bufbuild_es/lekko/client/v1beta1/configuration_service_pb';
import { PromiseClient, Transport, createPromiseClient } from '@connectrpc/connect';
import { Any, BoolValue, DoubleValue, Int64Value, StringValue, Timestamp, Value } from '@bufbuild/protobuf';
import { backOff } from 'exponential-backoff';
import { ClientContext } from '../context/context';
import { Client, DevClient } from '../types/client';
import { EventsBatcher, toContextKeysProto } from './events';
import { SDKServer } from './server';
import { Store, StoredEvalResult } from './store';
import { ListContentsResponse } from '@buf/lekkodev_sdk.bufbuild_es/lekko/server/v1beta1/sdk_pb';

const eventsBatchSize = 100;

// An in-memory store that fetches configs from lekko's backend.
export class Backend implements Client, DevClient {
    distClient: PromiseClient<typeof DistributionService>;
    store: Store;
    repoKey: RepositoryKey;
    sessionKey?: string;
    closed: boolean;
    updateIntervalMs?: number;
    timeout?: NodeJS.Timeout;
    eventsBatcher: EventsBatcher;
    server: SDKServer;
    version: string;

    constructor(
        transport: Transport,
        repositoryOwner: string,
        repositoryName: string,
        version: string,
        updateIntervalMs?: number,
        port?: number,
    ) {
        this.distClient = createPromiseClient(DistributionService, transport);
        this.store = new Store(repositoryOwner, repositoryName);
        this.repoKey = new RepositoryKey({
            ownerName: repositoryOwner,
            repoName: repositoryName
        });
        this.updateIntervalMs = updateIntervalMs;
        this.closed = false;
        this.version = version;
        this.eventsBatcher = new EventsBatcher(this.distClient, eventsBatchSize);
        this.server = new SDKServer(this, port);
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

    async initialize() {
        const registerResponse = await backOff(() => this.distClient.registerClient({
            repoKey: this.repoKey,
            sidecarVersion: this.version,
        }));
        this.sessionKey = registerResponse.sessionKey;
        await this.updateStore();
        if (this.updateIntervalMs) {
            await this.loop();
        }
        await this.eventsBatcher.init(this.sessionKey);
    }
    
    /**
     * Not implemented
     */
    async reinitialize(): Promise<void> {
        return;
    }

    /**
     * Not implemented
     *  */
    async createConfig(): Promise<void> {
        return;
    }

    async loop() {
        this.timeout = setTimeout(() => {
            if (this.closed) {
                return;
            }
            this.shouldUpdateStore()
                .then((should) => {
                    if (should) {
                        this.updateStore()
                            // TODO: log properly across the board
                            .finally(() => this.loop());
                    } else {
                        this.loop();
                    }
                }).catch(() => this.loop());
                
        }, this.updateIntervalMs);
    }

    async updateStore() {
        const contentsResponse = await backOff(() => this.distClient.getRepositoryContents({
            repoKey: this.repoKey,
            sessionKey: this.sessionKey
        }));
        this.store.load(contentsResponse);
    }

    async shouldUpdateStore() {
        const versionResponse = await this.distClient.getRepositoryVersion({
            repoKey: this.repoKey,
            sessionKey: this.sessionKey
        });
        const currentSha = this.store.getCommitSHA();
        return currentSha != versionResponse.commitSha;
    }

    async close() {
        this.closed = true;
        this.server.close();
        if (this.timeout) {
            this.timeout.unref();
        }
        if (this.eventsBatcher) {
            await this.eventsBatcher.close();
        }
        await backOff(() => this.distClient.deregisterClient({
            sessionKey: this.sessionKey
        }));
    }
}

