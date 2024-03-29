import { Constraint, Feature, FeatureType, Any as LekkoAny, Tree } from '../gen/lekko/feature/v1beta1/feature_pb';
import { Rule } from '../gen/lekko/rules/v1beta3/rules_pb';
import { Any, BoolValue, DoubleValue, Int64Value, StringValue, Value } from '@bufbuild/protobuf';

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

export function simpleConfig(key: string, value: bigint | number | string | boolean | Any) {
    const anyVal = any(value);
    return new Feature({
        key,
        description: configDescription,
        type: lekkoType(value),
        tree: new Tree({
            default: anyVal,
            defaultNew: new LekkoAny({
                typeUrl: anyVal.typeUrl,
                value: anyVal.value
            }),
        })
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

export function any(value: bigint | number | string | boolean | Any): Any {
    switch (typeof value) {
        case 'bigint': {
            const v = new Int64Value({value: value});
            return Any.pack(v);
        }
        case 'number': {
            const v = new DoubleValue({value: value});
            return Any.pack(v);
        }
        case 'string': {
            const v = new StringValue({value: value});
            return Any.pack(v);
        }
        case 'boolean': {
            const v = new BoolValue({value: value});
            return Any.pack(v);
        }
        default:
            return value;
    }
}

export function lekkoType(value: bigint | number | string | boolean | Any): FeatureType {
    switch (typeof value) {
        case 'bigint': return FeatureType.INT;
        case 'number': return FeatureType.FLOAT;
        case 'string': return FeatureType.STRING;
        case 'boolean': return FeatureType.BOOL;
    }
    if (value.is(Value)) {
        return FeatureType.JSON;
    }
    return FeatureType.PROTO;
}
