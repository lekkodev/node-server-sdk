import { Atom, ComparisonOperator, Rule } from "@buf/lekkodev_cli.bufbuild_es/lekko/rules/v1beta3/rules_pb";
import { ListValue, Value } from '@bufbuild/protobuf';

export function atom(key: string, op: string, val: number | string | boolean | string[]) {
    return new Atom({
        contextKey: key,
        comparisonOperator: comparisonOperator(op),
        comparisonValue: value(val)
    });
}

function comparisonOperator(op: string) : ComparisonOperator {
    switch (op) {
    case '==': return ComparisonOperator.EQUALS;
    case '!=': return ComparisonOperator.NOT_EQUALS;
    case '<': return ComparisonOperator.LESS_THAN;
    case '>': return ComparisonOperator.GREATER_THAN;
    case '<=': return ComparisonOperator.LESS_THAN_OR_EQUALS;
    case '>=': return ComparisonOperator.GREATER_THAN_OR_EQUALS;
    case 'in': return ComparisonOperator.CONTAINED_WITHIN;
    case 'sw': return ComparisonOperator.STARTS_WITH;
    case 'ew': return ComparisonOperator.ENDS_WITH;
    case 'co': return ComparisonOperator.CONTAINS;
    case 'pr': return ComparisonOperator.PRESENT;
    }
    return ComparisonOperator.UNSPECIFIED;
}

function value(v: number | string | boolean | string[]): Value {
    if (typeof(v) == 'number') {
        return new Value({
            kind: {
                case: 'numberValue',
                value: v
            }
        });
    }
    if (typeof(v) == 'string') {
        return new Value({
            kind: {
                case: 'stringValue',
                value: v
            }
        });
    }
    if (typeof(v) == 'boolean') {
        return new Value({
            kind: {
                case: 'boolValue',
                value: v
            }
        });
    }
    if (Array.isArray(v)) {
        return new Value({
            kind: {
                case: 'listValue',
                value: new ListValue({
                    values: v.map((elem) => value(elem))
                })
            }
        });
    }
    throw new Error('unsupported type for value');
}

export function rules(...atoms: Atom[]) : Rule[] {
    return atoms.map((a) => rule(a));
}

export function rule(a: Atom) : Rule {
    return new Rule({
        rule: {
            case: 'atom',
            value: a
        }
    });
}



