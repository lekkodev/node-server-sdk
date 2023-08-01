import { Atom, CallExpression, CallExpression_Bucket, ComparisonOperator, Rule } from '@buf/lekkodev_cli.bufbuild_es/lekko/rules/v1beta3/rules_pb';
import { ClientContext } from '../../context/context';
import evaluateRule from '../rule';
import { atom } from '../rule_fixtures';

type testCase = {
    ctxValue: string | number
    namespace: string
    configName: string
    expected: boolean
}

const ns1 = 'ns_1';
const ns2 = 'ns_2';
const config1 = 'feature_1';
const config2 = 'feature_2';

function testBucket(tc: testCase) {
    const ctxKey = 'key';
    const clientCtx = new ClientContext();
    if (typeof(tc.ctxValue) == 'string') {
        clientCtx.setString(ctxKey, tc.ctxValue);
    } else {
        clientCtx.setDouble(ctxKey, tc.ctxValue);
    }
    const rule = new Rule({
        rule: {
            case: 'callExpression',
            value: new CallExpression({
                function: {
                    case: 'bucket',
                    value: new CallExpression_Bucket({
                        contextKey: ctxKey,
                        threshold: 50000,
                    })
                }
            }),
        }
    });

    const result = evaluateRule(rule, clientCtx, tc.namespace, tc.configName);
    expect(result).toBe(tc.expected);
}

function testBucketCases(values: {[key: number | string]: boolean}, namespace: string, configName: string) {
    for (const k in values) {
        testBucket({
            ctxValue: k,
            namespace: namespace,
            configName: configName,
            expected: values[k]
        });
    }
}

test('bucket ints', () => {
    // TODO: port all matching tests from go-sdk.
    testBucketCases({
        1:   true,
    }, ns1, config1);
    testBucketCases({
        1:   true,
    }, ns2, config2);
});

describe('bool const', () => {
    for (const b of [true, false]) {
        test(`${b}`, () => {
            const rule = new Rule({
                rule: {
                    case: 'boolConst',
                    value: b,
                }
            });
            expect(evaluateRule(rule, new ClientContext(), ns1, config1)).toBe(b);
        });
    }
});

test('present', () => {
    const rule = new Rule({
        rule: {
            case: 'atom',
            value: new Atom({
                contextKey: 'age',
                comparisonOperator: ComparisonOperator.PRESENT
            }),
        }
    });
    expect(evaluateRule(rule, new ClientContext(), ns1, config1)).toBe(false);
    expect(evaluateRule(rule, new ClientContext().setInt('age', 10), ns1, config1)).toBe(true);
    expect(evaluateRule(rule, new ClientContext().setString('age', 'not a number'), ns1, config1)).toBe(true);
});

type atomTest = {
    atom: Atom
    context: ClientContext
    expected?: boolean
    hasError?: boolean
}

function testRule(rule: Rule, context: ClientContext, ns: string, cfg: string, expected?: boolean, hasError?: boolean) {
    test(`rule: ${rule.toJsonString()}, ctx: ${context}`, () => {
        if (hasError) {
            expect(() => {
                evaluateRule(rule, context, ns, cfg);
            }).toThrow();
        } else {
            expect(evaluateRule(rule, context, ns, cfg)).toBe(expected);
        }
    });
}

function testAtom(at: atomTest) {
    const rule = new Rule({
        rule: {
            case: 'atom',
            value: at.atom,
        }
    });
    testRule(rule, at.context, ns1, config1, at.expected, at.hasError);
    // test not
    const notRule = new Rule({
        rule: {
            case: 'not',
            value: rule
        }
    });
    testRule(notRule, at.context, ns1, config1, !at.expected, at.hasError);
}

describe('test equality', () => {
    const atomTests: atomTest[] = [
        {
            atom: atom('age', '==', 12),
            context: new ClientContext().setInt('age', 12),
            expected: true,
        },
        {
            atom: atom('age', '==', 12),
            context: new ClientContext().setInt('age', 35),
            expected: false,
        },
        {
            atom: atom('age', '==', 12),
            context: new ClientContext().setDouble('age', 12.001),
            expected: false,
        },
        {
            atom: atom('age', '==', 12.001),
            context: new ClientContext().setDouble('age', 12.001),
            expected: true,
        },
        {
            atom: atom('age', '==', 12),
            context: new ClientContext().setString('age', 'not a number'),
            hasError: true
        },
        {
            atom: atom('age', '!=', 12),
            context: new ClientContext().setInt('age', 25),
            expected: true
        },
        {
            atom: atom('age', '!=', 12),
            context: new ClientContext().setInt('age', 12),
            expected: false
        },
        {
            atom: atom('age', '==', 12),
            context: new ClientContext(), // not present
            expected: false
        },
        {
            atom: atom('city', '==', 'Rome'),
            context: new ClientContext().setString('city', 'Rome'),
            expected: true
        },
        {
            atom: atom('city', '==', 'Rome'),
            context: new ClientContext().setString('city', 'rome'),
            expected: false
        },
        {
            atom: atom('city', '==', 'Rome'),
            context: new ClientContext().setString('city', 'Paris'),
            expected: false
        },
        {
            atom: atom('city', '==', 'Rome'),
            context: new ClientContext().setInt('city', 99),
            hasError: true
        },
    ];
    for (const at of atomTests) {
        testAtom(at);
    }
});

describe('test numerical operators', () => {
    const atomTests: atomTest[] = [
        {
            atom: atom('age', '<', 12),
            context: new ClientContext().setInt('age', 12),
            expected: false,
        },
        {
            atom: atom('age', '<', 12),
            context: new ClientContext().setInt('age', 11),
            expected: true,
        },
        {
            atom: atom('age', '<=', 12),
            context: new ClientContext().setInt('age', 12),
            expected: true,
        },
        {
            atom: atom('age', '>=', 12),
            context: new ClientContext().setInt('age', 12),
            expected: true,
        },
        {
            atom: atom('age', '>', 12),
            context: new ClientContext().setInt('age', 12),
            expected: false,
        },
        {
            atom: atom('age', '>', 12),
            context: new ClientContext().setInt('age', 13),
            expected: true,
        },
        {
            atom: atom('age', '>', 12),
            context: new ClientContext().setString('age', 'not a number'),
            hasError: true,
        },
    ];
    for (const at of atomTests) {
        testAtom(at);
    }
});

describe('test contained within', () => {
    const atomTests: atomTest[] = [
        {
            atom: atom('city', 'in', ['Rome', 'Paris']),
            context: new ClientContext().setString('city', 'London'),
            expected: false,
        },
        {
            atom: atom('city', 'in', ['Rome', 'Paris']),
            context: new ClientContext().setString('city', 'Rome'),
            expected: true,
        },
        {
            atom: atom('city', 'in', ['Rome', 'Paris']),
            context: new ClientContext(), // not present
            expected: false,
        },
        {
            atom: atom('city', 'in', ['Rome', 'Paris']),
            context: new ClientContext().setString('city', 'rome'),
            expected: false,
        },
    ];
    for (const at of atomTests) {
        testAtom(at);
    }
});

describe('test string comparison operators', () => {
    const atomTests: atomTest[] = [
        {
            atom: atom('city', 'sw', 'Ro'),
            context: new ClientContext().setString('city', 'Rome'),
            expected: true,
        },
        {
            atom: atom('city', 'sw', 'Ro'),
            context: new ClientContext().setString('city', 'London'),
            expected: false,
        },
        {
            atom: atom('city', 'sw', 'Ro'),
            context: new ClientContext().setString('city', 'rome'),
            expected: false,
        },
        {
            atom: atom('city', 'sw', 'Ro'),
            context: new ClientContext(), // not present
            expected: false,
        },
        {
            atom: atom('city', 'ew', 'me'),
            context: new ClientContext().setString('city', 'Rome'),
            expected: true,
        },
        {
            atom: atom('city', 'ew', 'me'),
            context: new ClientContext().setString('city', 'London'),
            expected: false,
        },
        {
            atom: atom('city', 'co', ''),
            context: new ClientContext().setString('city', 'Rome'),
            expected: true,
        },
        {
            atom: atom('city', 'co', 'foo'),
            context: new ClientContext().setString('city', 'Rome'),
            expected: false,
        },
    ];
    for (const at of atomTests) {
        testAtom(at);
    }
});
