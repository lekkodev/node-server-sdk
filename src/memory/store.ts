import { GetRepositoryContentsResponse } from '@buf/lekkodev_cli.bufbuild_es/lekko/backend/v1beta1/distribution_service_pb';
import { Feature } from '@buf/lekkodev_cli.bufbuild_es/lekko/feature/v1beta1/feature_pb';


type configData = {
    configSHA: string;
    config: Feature;
}

type configMap = Map<string, Map<string, configData>>

export class Store {
    configs: configMap;
    commitSHA: string;
    
    constructor() {
        this.configs = new Map();
        this.commitSHA = "";
    }

    async getCommitSHA() {
        return this.commitSHA;
    }

    async load(contents: GetRepositoryContentsResponse | undefined) {
        if (!contents) {
            return;
        }
        if (!await this.shouldUpdate(contents)) {
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
        if (commitSHA == this.commitSHA) {
            return;
        }
        this.configs = configs;
        this.commitSHA = commitSHA;
    }

    async shouldUpdate(contents: GetRepositoryContentsResponse) {
        return contents.commitSha != this.commitSHA;
    }
}

