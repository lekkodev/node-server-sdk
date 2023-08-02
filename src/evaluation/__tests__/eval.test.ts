import { Feature } from '@buf/lekkodev_cli.bufbuild_es/lekko/feature/v1beta1/feature_pb';
import { Int64Value, createRegistry } from '@bufbuild/protobuf';
import { ClientContext } from '../../context/context';
import { config, constriant, tree } from '../../fixtures/eval';
import { atom, rule } from '../../fixtures/rule';
import { evaluate } from '../eval';

test('empty config tree', () => {
    expect(() => {
        evaluate(new Feature({}), 'ns', new ClientContext());
    }).toThrow();
});

type testEvalParams = {
    config: Feature,
    context: ClientContext,
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
        }
    });
}

describe('no overrides traversal', () => {
    testEval({
        config: config(tree()),
        context: new ClientContext(),
        expected: 1,
        expectedPath: []
    });
    testEval({
        config: config(tree()),
        context: new ClientContext().setString('key', 'anything'),
        expected: 1,
        expectedPath: []
    });
});

describe('1 level traversal', () => {
    const cfg = config(tree(constriant(rule(atom('age', '==', 10))), constriant(rule(atom('age', '==', 12)))));
    testEval({
        config: cfg,
        context: new ClientContext(),
        expected: 1,
        expectedPath: []
    });
    testEval({
        config: cfg,
        context: new ClientContext().setInt('age', 5),
        expected: 1,
        expectedPath: []
    });
    testEval({
        config: cfg,
        context: new ClientContext().setInt('age', 10),
        expected: 2,
        expectedPath: [0]
    });
    testEval({
        config: cfg,
        context: new ClientContext().setInt('age', 12),
        expected: 2,
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
        expected: 1,
        expectedPath: []
    });
    testEval({
        config: cfg,
        context: new ClientContext().setInt('age', 10),
        expected: 2,
        expectedPath: [0]
    });
    testEval({
        config: cfg,
        context: new ClientContext().setInt('age', 10).setString('city', 'Rome'),
        expected: 2,
        expectedPath: [0, 0]
    });
    testEval({
        config: cfg,
        context: new ClientContext().setInt('age', 10).setString('city', 'Paris'),
        expected: 2,
        expectedPath: [0, 1]
    });
    testEval({
        config: cfg,
        context: new ClientContext().setInt('age', 12).setString('city', 'Milan'),
        expected: 2,
        expectedPath: [1]
    });
    testEval({
        config: cfg,
        context: new ClientContext().setInt('age', 12),
        expected: 2,
        expectedPath: [1]
    });
    testEval({
        config: cfg,
        context: new ClientContext().setInt('age', 12).setString('city', 'Rome'),
        expected: 2,
        expectedPath: [1, 0]
    });
    testEval({
        config: cfg,
        context: new ClientContext().setInt('age', 12).setString('city', 'Paris'),
        expected: 2,
        expectedPath: [1, 1]
    });
    testEval({
        config: cfg,
        context: new ClientContext().setInt('age', 12).setString('city', 'Milan'),
        expected: 2,
        expectedPath: [1]
    });
});