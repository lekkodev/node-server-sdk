import { Atom, CallExpression, CallExpression_Bucket, ComparisonOperator, LogicalExpression, LogicalOperator, Rule } from '@buf/lekkodev_cli.bufbuild_es/lekko/rules/v1beta3/rules_pb';
import { ClientContext } from '../../context/context';
import evaluateRule from '../rule';
import { atom, rules } from '../rule_fixtures';

const ns1 = 'ns_1';
const ns2 = 'ns_2';
const config1 = 'feature_1';
const config2 = 'feature_2';

function testBucket(ctxValue: string | number, isInt: boolean, namespace: string, configName: string, expected?: boolean, hasError?: boolean) {
    const ctxKey = 'key';
    const clientCtx = new ClientContext();
    if (typeof(ctxValue) == 'string') {
        clientCtx.setString(ctxKey, ctxValue);
    } else if (isInt) {
        clientCtx.setInt(ctxKey, ctxValue);
    } else {
        clientCtx.setDouble(ctxKey, ctxValue);
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

    testRule(rule, clientCtx, namespace, configName, expected, hasError);
}

describe.skip('bucket ints', () => {
    // TODO: port all matching tests from go-sdk.
    testBucket(1, true, ns1, config1, false);
    testBucket(2, true, ns1, config1, false);
    testBucket(3, true, ns1, config1, true);
    testBucket(4, true, ns1, config1, false);
    testBucket(5, true, ns1, config1, true);

    testBucket(1, true, ns2, config2, false);
    testBucket(2, true, ns2, config2, true);
    testBucket(3, true, ns2, config2, false);
    testBucket(4, true, ns2, config2, false);
    testBucket(5, true, ns2, config2, true);
});

describe.skip('bucket doubles', () => {
    testBucket(3.1415, false, ns1, config1, false);
    testBucket(2.7182, false, ns1, config1, false);
    testBucket(1.6180, false, ns1, config1, true);
    testBucket(6.6261, false, ns1, config1, true);
    testBucket(6.0221, false, ns1, config1, false);

    testBucket(3.1415, false, ns2, config2, true);
    testBucket(2.7182, false, ns2, config2, false);
    testBucket(1.6180, false, ns2, config2, true);
    testBucket(6.6261, false, ns2, config2, false);
    testBucket(6.0221, false, ns2, config2, false);
});

describe.skip('bucket strings', () => {
    testBucket('hello', false, ns1, config1, false);
    testBucket('world', false, ns1, config1, false);
    testBucket('i', false, ns1, config1, true);
    testBucket('am', false, ns1, config1, true);
    testBucket('a', false, ns1, config1, true);

    testBucket('hello', false, ns2, config2, true);
    testBucket('world', false, ns2, config2, false);
    testBucket('i', false, ns2, config2, true);
    testBucket('am', false, ns2, config2, true);
    testBucket('a', false, ns2, config2, true);
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

function testRule(rule: Rule | undefined, context: ClientContext, ns: string, cfg: string, expected?: boolean, hasError?: boolean) {
    test(`[${ns}/${cfg}] rule: ${rule && rule.toJsonString()}, ctx: ${context}`, () => {
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

describe('empty rule', () => {
    testRule(undefined, new ClientContext, ns1, config1, undefined, true);
});

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

type logicalExpressionTest = {
    rules: Rule[]
    logicalOp: LogicalOperator
    context: ClientContext
    expected?: boolean
    hasError?: boolean
}

function testLogicalExpression(logicalExprTest: logicalExpressionTest) {
    const rule = new Rule({
        rule: {
            case: 'logicalExpression',
            value: new LogicalExpression({
                rules: logicalExprTest.rules,
                logicalOperator: logicalExprTest.logicalOp
            })
        }
    });
    testRule(rule, logicalExprTest.context, ns1, config1, logicalExprTest.expected, logicalExprTest.hasError);
}

describe('test logical expression', () => {
    const logicalExprTests: logicalExpressionTest[] = [
        {
            rules: rules(atom('age', '<', 5), atom('age', '>', 10)),
            logicalOp: LogicalOperator.OR,
            context: new ClientContext().setInt('age', 8),
            expected: false
        },
        {
            rules: rules(atom('age', '<', 5), atom('age', '>', 10)),
            logicalOp: LogicalOperator.OR,
            context: new ClientContext().setInt('age', 12),
            expected: true
        },
        {
            rules: rules(atom('age', '<', 5), atom('city', '==', 'Rome')),
            logicalOp: LogicalOperator.AND,
            context: new ClientContext().setInt('age', 8).setString('city', 'Rome'),
            expected: false
        },
        {
            rules: rules(atom('age', '<', 5), atom('city', '==', 'Rome')),
            logicalOp: LogicalOperator.AND,
            context: new ClientContext().setInt('age', 3).setString('city', 'Rome'),
            expected: true
        },
        {
            rules: rules(atom('age', '<', 5), atom('city', '==', 'Rome')),
            logicalOp: LogicalOperator.UNSPECIFIED,
            context: new ClientContext().setInt('age', 3),
            hasError: true
        },
        {
            rules: rules(atom('age', '<', 5), atom('city', '==', 'Rome')),
            logicalOp: LogicalOperator.AND,
            context: new ClientContext().setInt('age', 3), // not present
            expected: false
        },
        {  // Single atom in the n-ary tree, and operator
            rules: rules(atom('age', '<', 5)),
            logicalOp: LogicalOperator.AND,
            context: new ClientContext().setInt('age', 3),
            expected: true
        },
        {  // Single atom in the n-ary tree, or operator
            rules: rules(atom('age', '<', 5)),
            logicalOp: LogicalOperator.OR,
            context: new ClientContext().setInt('age', 3),
            expected: true
        },
        {  // No atoms in the n-ary tree
            rules: rules(),
            logicalOp: LogicalOperator.AND,
            context: new ClientContext(),
            hasError: true
        },
        {
            rules: rules(atom('age', '<', 5), atom('city', '==', 'Rome'), atom('age', '==', 8)),
            logicalOp: LogicalOperator.AND,
            context: new ClientContext().setInt('age', 8),
            expected: false
        },
        {
            rules: rules(atom('age', '<', 5), atom('city', '==', 'Rome'), atom('age', '==', 8)),
            logicalOp: LogicalOperator.OR,
            context: new ClientContext().setInt('age', 8),
            expected: true
        },
    ];
    for (const test of logicalExprTests) {
        testLogicalExpression(test);
    }
});
