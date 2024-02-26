import { Feature } from '../../gen/lekko/feature/v1beta1/feature_pb';
import { Int64Value, createRegistry } from '@bufbuild/protobuf';
import { ClientContext } from '../../context/context';
import { config, constraintValue, constriant, defaultValue, tree } from '../../fixtures/eval';
import { atom, rule } from '../../fixtures/rule';
import { evaluate } from '../eval';

test('empty config tree', () => {
    expect(() => {
        evaluate(new Feature({}), 'ns', new ClientContext());
    }).toThrow();
});

type testEvalParams = {
    config: Feature,
    context: ClientContext | undefined,
    expected?: number // we are only testing int config traversal
    hasError?: boolean
    expectedPath?: number[]
}

function testEval(params: testEvalParams) {
    const reg = createRegistry(Int64Value); 
    test(`cfg: ${params.config.toJsonString({typeRegistry: reg})}, ctx: ${params.context}`, () => {
        if (params.hasError) {
            expect(() => {
                evaluate(params.config, 'ns_1', params.context);
            }).toThrow();
        } else if (params.expected !== undefined) {
            const resultAny = evaluate(params.config, 'ns_1', params.context);
            expect(resultAny.value).toBeDefined();
            const resultWrapper = new Int64Value();
            expect(resultAny.value?.unpackTo(resultWrapper)).toBeTruthy();
            expect(resultWrapper.value).toBe(BigInt(params.expected));
            expect(resultAny.path).toStrictEqual(params.expectedPath);
        } else {
            throw new Error('test case needs to either expect an error or a result');
        }
    });
}

describe('no overrides traversal', () => {
    testEval({
        config: config(tree()),
        context: new ClientContext(),
        expected: defaultValue,
        expectedPath: []
    });
    testEval({
        config: config(tree()),
        context: new ClientContext().setString('key', 'anything'),
        expected: defaultValue,
        expectedPath: []
    });
});

describe('test empty context', () => {
    testEval({
        config: config(tree()),
        context: undefined,
        expected: defaultValue,
        expectedPath: []
    });
});

describe('1 level traversal', () => {
    const cfg = config(tree(constriant(rule(atom('age', '==', 10))), constriant(rule(atom('age', '==', 12)))));
    testEval({
        config: cfg,
        context: new ClientContext(),
        expected: defaultValue,
        expectedPath: []
    });
    testEval({
        config: cfg,
        context: new ClientContext().setInt('age', 5),
        expected: defaultValue,
        expectedPath: []
    });
    testEval({
        config: cfg,
        context: new ClientContext().setInt('age', 10),
        expected: constraintValue,
        expectedPath: [0]
    });
    testEval({
        config: cfg,
        context: new ClientContext().setInt('age', 12),
        expected: constraintValue,
        expectedPath: [1]
    });
});

describe('2 level traversal', () => {
    const cfg = config(tree(
        constriant(
            rule(atom('age', '==', 10)), 
            constriant(rule(atom('city', '==', 'Rome'))), 
            constriant(rule(atom('city', '==', 'Paris'))),
        ), 
        constriant(
            rule(atom('age', '==', 12)),
            constriant(rule(atom('city', '==', 'Rome'))), 
            constriant(rule(atom('city', '==', 'Paris'))),
        ),
    ));
    testEval({
        config: cfg,
        context: new ClientContext(),
        expected: defaultValue,
        expectedPath: []
    });
    testEval({
        config: cfg,
        context: new ClientContext().setInt('age', 10),
        expected: constraintValue,
        expectedPath: [0]
    });
    testEval({
        config: cfg,
        context: new ClientContext().setInt('age', 10).setString('city', 'Rome'),
        expected: constraintValue,
        expectedPath: [0, 0]
    });
    testEval({
        config: cfg,
        context: new ClientContext().setInt('age', 10).setString('city', 'Paris'),
        expected: constraintValue,
        expectedPath: [0, 1]
    });
    testEval({
        config: cfg,
        context: new ClientContext().setInt('age', 12).setString('city', 'Milan'),
        expected: constraintValue,
        expectedPath: [1]
    });
    testEval({
        config: cfg,
        context: new ClientContext().setInt('age', 12),
        expected: constraintValue,
        expectedPath: [1]
    });
    testEval({
        config: cfg,
        context: new ClientContext().setInt('age', 12).setString('city', 'Rome'),
        expected: constraintValue,
        expectedPath: [1, 0]
    });
    testEval({
        config: cfg,
        context: new ClientContext().setInt('age', 12).setString('city', 'Paris'),
        expected: constraintValue,
        expectedPath: [1, 1]
    });
    testEval({
        config: cfg,
        context: new ClientContext().setInt('age', 12).setString('city', 'Milan'),
        expected: constraintValue,
        expectedPath: [1]
    });
});