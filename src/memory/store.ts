import { GetRepositoryContentsResponse } from '@buf/lekkodev_cli.bufbuild_es/lekko/backend/v1beta1/distribution_service_pb';
import { Feature } from '@buf/lekkodev_cli.bufbuild_es/lekko/feature/v1beta1/feature_pb';
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

type storedConfigs = {
    configs: configMap;
    commitSHA: string
}

export class Store {
    storedConfigs: storedConfigs;
    
    constructor() {
        const configs = new Map();
        const commitSHA = '';
        this.storedConfigs = {
            configs,
            commitSHA
        };
    }

    get(namespace: string, configKey: string) {
        const nsMap = this.storedConfigs.configs.get(namespace);
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
        return this.storedConfigs.commitSHA;
    }

    async load(contents: GetRepositoryContentsResponse | undefined) {
        if (!contents) {
            return;
        }
        if (!this.shouldUpdate(contents)) {
            return;
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
        await this.update(newConfigs, contents.commitSha);
    }

    async update(configs: configMap, commitSHA: string) {
        if (commitSHA == this.storedConfigs.commitSHA) {
            return;
        }
        const newStoredConfigs = {
            configs,
            commitSHA
        };
        this.storedConfigs = newStoredConfigs;
    }

    shouldUpdate(contents: GetRepositoryContentsResponse) {
        return contents.commitSha != this.storedConfigs.commitSHA;
    }
}

