import { GetRepositoryContentsResponse } from '@buf/lekkodev_cli.bufbuild_es/lekko/backend/v1beta1/distribution_service_pb';
import { Feature } from '@buf/lekkodev_cli.bufbuild_es/lekko/feature/v1beta1/feature_pb';
import { Config, ListContentsResponse, Namespace } from "@buf/lekkodev_sdk.bufbuild_es/lekko/server/v1beta1/sdk_pb";
import { createHash } from 'node:crypto';
import { ClientContext } from '../context/context';
import { EvaluationResult, evaluate } from '../evaluation/eval';


type configData = {
    configSHA: string;
    config: Feature;
}

type configMap = Map<string, Map<string, configData>>

export type StoredEvalResult = {
    config: Feature,
    configSHA: string,
    commitSHA: string,
    evalResult: EvaluationResult
}

export class Store {
    configs: configMap;
    commitSHA: string;
    contentHash: string;
    ownerName: string;
    repoName: string;
    
    constructor(ownerName: string, repoName: string) {
        this.configs = new Map();
        this.commitSHA = '';
        this.contentHash = '';
        this.ownerName = ownerName;
        this.repoName = repoName;
    }

    get(namespace: string, configKey: string) {
        const nsMap = this.configs.get(namespace);
        if (!nsMap) {
            throw new Error('namespace not found');
        }
        const result = nsMap.get(configKey);
        if (!result) {
            throw new Error('config not found');
        }
        return result;
    }

    evaluateType(namespace: string, configKey: string, context: ClientContext) : StoredEvalResult {
        const cfg = this.get(namespace, configKey);
        return {
            ...cfg,
            commitSHA: this.getCommitSHA(),
            evalResult: evaluate(cfg.config, namespace, context)
        };
    }

    getCommitSHA() {
        return this.commitSHA;
    }

    load(contents: GetRepositoryContentsResponse | undefined) {
        if (!contents) {
            return false;
        }
        contents = sortContents(contents);
        const contentHash = hashContents(contents);
        if (!this.shouldUpdate(contents, contentHash)) {
            return false;
        }
        const newConfigs: configMap = new Map();
        contents.namespaces.forEach((ns) => {
            const nsMap: Map<string, configData> = new Map();
            ns.features.forEach((cfg) => {
                if (cfg.feature) {
                    nsMap.set(cfg.name, {
                        configSHA: cfg.sha,
                        config: cfg.feature,
                    });
                }
            });
            newConfigs.set(ns.name, nsMap);
        });
        this.configs = newConfigs;
        this.commitSHA = contents.commitSha;
        this.contentHash = contentHash;
        return true;
    }

    shouldUpdate(contents: GetRepositoryContentsResponse, contentHash: string) {
        return contents.commitSha != this.commitSHA || contentHash != this.contentHash;
    }

    listContents() : ListContentsResponse {
        const resp = new ListContentsResponse({
            repoKey: {
                ownerName: this.ownerName,
                repoName: this.repoName,
            },
            commitSha: this.commitSHA,
            contentHash: this.contentHash,
        });
        this.configs.forEach((cfgMap, ns) => {
            const retNS = new Namespace({ name: ns });
            cfgMap.forEach((cfg, cfgName) => {
                retNS.configs.push(new Config({
                    name: cfgName,
                    sha: cfg.configSHA,
                }));
            });
            resp.namespaces.push(retNS);
        });
        return resp;
    }
}

function sortContents(contents: GetRepositoryContentsResponse): GetRepositoryContentsResponse{
    contents.namespaces.forEach((ns) => {
        ns.features.sort((a, b) => {
            return a.name.localeCompare(b.name);
        });
    });
    contents.namespaces.sort((a, b) => {
        return a.name.localeCompare(b.name);
    });
    return contents;
}

export function hashContents(contents: GetRepositoryContentsResponse): string {
    return createHash('sha256')
        .update(contents.toBinary())
        .digest().toString('hex');
}

