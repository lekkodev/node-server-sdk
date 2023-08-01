import { Feature as DistFeature, GetRepositoryContentsResponse, Namespace } from "@buf/lekkodev_cli.bufbuild_es/lekko/backend/v1beta1/distribution_service_pb";
import { Feature } from "@buf/lekkodev_cli.bufbuild_es/lekko/feature/v1beta1/feature_pb";

export function namespace(name: string, ...configs: Feature[]):  Namespace {
    return new Namespace({
        name: name,
        features: configs.map((c) => new DistFeature({
            name: c.key,
            sha: c.key,
            feature: c
        })),
    });
}

export function contents(commitSha: string, ...namespaces: Namespace[]): GetRepositoryContentsResponse {
    return new GetRepositoryContentsResponse({
        commitSha,
        namespaces
    });
}



