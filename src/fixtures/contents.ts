import { Feature as DistFeature, GetRepositoryContentsResponse, Namespace } from "../gen/lekko/backend/v1beta1/distribution_service_pb";
import { Feature } from "../gen/lekko/feature/v1beta1/feature_pb";
import { Any, Int32Value, Value } from "@bufbuild/protobuf";
import { simpleConfig } from "./eval";

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

export function protoAny() {
    const protoVal = new Int32Value({
        value: 42,
    });
    return Any.pack(protoVal);
}

export type jsonConfigType = {
    a: number;
}

export function testContents() {
    const json: jsonConfigType = {
        a: 1
    };
    const jsonVal = Value.fromJsonString(JSON.stringify(json));
    const pAny = protoAny();
    return contents(
        'sha', 
        namespace(
            'ns-1',
            simpleConfig('bool', true),
            simpleConfig('int', BigInt(12)),
            simpleConfig('float', 12.28),
            simpleConfig('string', 'hello'),
            simpleConfig('json', Any.pack(jsonVal)),
            simpleConfig('proto', pAny),
        ),
    );
}

