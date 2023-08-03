import { Constraint, Feature, FeatureType, Any as LekkoAny, Tree } from '@buf/lekkodev_cli.bufbuild_es/lekko/feature/v1beta1/feature_pb';
import { Rule } from '@buf/lekkodev_cli.bufbuild_es/lekko/rules/v1beta3/rules_pb';
import { Any, Int64Value } from '@bufbuild/protobuf';

export const configKey = 'key';
export const configDescription = 'config description';
export const defaultValue = 1;
export const constraintValue = 2;

export function config(tree: Tree): Feature {
    return new Feature({
        key: configKey,
        description: configDescription,
        type: FeatureType.INT,
        tree
    });
}

export function tree(...constraints: Constraint[]): Tree {
    const defaultAny = anyInt(defaultValue); // default always 1
    return new Tree({
        default: defaultAny,
        defaultNew: new LekkoAny({
            typeUrl: defaultAny.typeUrl,
            value: defaultAny.value
        }),
        constraints
    });
}

export function constriant(rule: Rule, ...constraints: Constraint[]): Constraint {
    const valueAny = anyInt(constraintValue); // constraint always 2
    return new Constraint({
        ruleAstNew: rule,
        value: valueAny,
        valueNew: new LekkoAny({
            typeUrl: valueAny.typeUrl,
            value: valueAny.value
        }),
        constraints
    });
}

export function anyInt(i: number): Any {
    const iv = new Int64Value({value: BigInt(i)});
    return Any.pack(iv);
}
