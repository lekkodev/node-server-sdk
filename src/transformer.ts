/* eslint-disable */
import * as ts from 'typescript';
import { factory } from 'typescript';
import { TransformerExtras } from "ts-patch";
import assert from 'assert';
import * as fs from "fs";



export default function (
    program?: ts.Program,
    pluginConfig?: any,
    transformerExtras?: TransformerExtras,
) {
    const repo_root = '/Users/jonathan/src/teflon/config/';

    return (context: ts.TransformationContext) => {
        let namespace: string | undefined;

        function injectMagic(node: ts.Node): ts.Node | ts.Node[] {
            if (ts.isFunctionDeclaration(node)) {
                const sig = program?.getTypeChecker().getSignatureFromDeclaration(node);
                assert(sig);
                assert(node.name);
                assert(node.body);
                assert(namespace);
                const functionName = node.name.getFullText().trim();
                const configName = functionName.replace(/[A-Z]/g, letter => `-${letter.toLowerCase()}`).replace(/get-/, '');
                let getter: string | undefined = undefined;
                // @ts-ignore
                const type = program?.getTypeChecker().getPromisedTypeOfPromise(sig.getReturnType());
                // @ts-ignore
                const storedConfig = JSON.parse(fs.readFileSync(repo_root + namespace + "/gen/json/" + configName + ".json"));
                if (type.flags & ts.TypeFlags.String) {
                    getter = "getString";
                }
                else if (type.flags & ts.TypeFlags.Number) {
                    // TODO used storedConfig to handle float vs int
                    getter = "getFloat";
                }
                else if (type.flags & ts.TypeFlags.Boolean) {
                    getter = "getBool";
                }
                else if (type.flags & ts.TypeFlags.Object) {
                    if (storedConfig.type === 'FEATURE_TYPE_JSON') {
                        getter = "getJSON"
                    } else if (storedConfig.type === 'FEATURE_TYPE_PROTO') {
                        getter = "getProto"
                    } else {
                        throw new Error("Error");
                    }
                }
                if (getter === undefined) {
                    throw new Error(`Unsupported TypeScript type: ${type.flags} - ${program?.getTypeChecker().typeToString(type)}`);
                }
                if (getter === "getProto") {
                    const protoTypeParts = storedConfig.tree.default["@type"].split(".");
                    const protoType = protoTypeParts[protoTypeParts.length - 1];
                    return [factory.createImportDeclaration(
                        undefined,
                        factory.createImportClause(
                            false,
                            undefined,
                            ts.factory.createNamespaceImport(ts.factory.createIdentifier("lekko_pb"))
                        ),
                        factory.createStringLiteral(`./gen/${namespace}/config/v1beta1/${namespace}_pb.js`),
                        undefined
                    ),
                    ts.factory.updateFunctionDeclaration(
                        node,
                        node.modifiers,
                        node.asteriskToken,
                        node.name,
                        node.typeParameters,
                        node.parameters,
                        node.type,
                        factory.createBlock(
                            [factory.createTryStatement(
                                factory.createBlock([
                                    factory.createVariableStatement(
                                        factory.createModifiersFromModifierFlags(
                                            ts.ModifierFlags.Const,
                                        ),
                                        factory.createVariableDeclarationList(
                                            [
                                                factory.createVariableDeclaration(
                                                    "config",
                                                    undefined,
                                                    undefined,
                                                    factory.createNewExpression(
                                                        factory.createPropertyAccessExpression(
                                                            factory.createIdentifier("lekko_pb"),
                                                            factory.createIdentifier(
                                                                protoType,
                                                            ),
                                                        ),
                                                        undefined,
                                                        [],
                                                    ),
                                                ),
                                            ],
                                            ts.NodeFlags.Const,
                                        ),
                                    ),
                                    factory.createExpressionStatement(factory.createCallExpression(
                                        factory.createPropertyAccessExpression(
                                            factory.createIdentifier("config"),
                                            factory.createIdentifier("fromBinary")
                                        ),
                                        undefined,
                                        [factory.createPropertyAccessExpression(
                                            factory.createCallExpression(
                                                factory.createPropertyAccessExpression(
                                                    factory.createParenthesizedExpression(factory.createAwaitExpression(factory.createCallExpression(
                                                        factory.createPropertyAccessExpression(
                                                            factory.createIdentifier("lekko"),
                                                            factory.createIdentifier("getClient")
                                                        ),
                                                        undefined,
                                                        []
                                                    ))),
                                                    factory.createIdentifier("getProto")
                                                ),
                                                undefined,
                                                [
                                                    factory.createStringLiteral(namespace),
                                                    factory.createStringLiteral(configName),
                                                    factory.createCallExpression(
                                                        factory.createPropertyAccessExpression(
                                                            factory.createPropertyAccessExpression(
                                                                factory.createIdentifier("lekko"),
                                                                factory.createIdentifier("ClientContext")
                                                            ),
                                                            factory.createIdentifier("fromJSON")
                                                        ),
                                                        undefined,
                                                        [factory.createIdentifier("args")]
                                                    )
                                                ]
                                            ),
                                            factory.createIdentifier("value")
                                        )]
                                    )),
                                    factory.createReturnStatement(factory.createIdentifier("config"))
                                ], true
                                ),
                                factory.createCatchClause(
                                    undefined,
                                    node.body
                                ),
                                undefined
                            )],
                            true
                        )

                    )
                    ];

                }
                return ts.factory.updateFunctionDeclaration(
                    node,
                    node.modifiers,
                    node.asteriskToken,
                    node.name,
                    node.typeParameters,
                    node.parameters,
                    node.type,
                    factory.createBlock(
                        [factory.createTryStatement(
                            factory.createBlock(
                                [
                                    factory.createExpressionStatement(factory.createAwaitExpression(factory.createCallExpression( // TODO -- this should be top level.. but ts module build shit is horrible
                                        factory.createPropertyAccessExpression(
                                            factory.createIdentifier("lekko"),
                                            factory.createIdentifier("setupClient")
                                        ),
                                        undefined,
                                        []
                                    ))),
                                    factory.createReturnStatement(factory.createAwaitExpression(factory.createCallExpression(
                                        factory.createPropertyAccessExpression(
                                            factory.createParenthesizedExpression(factory.createAwaitExpression(factory.createCallExpression(
                                                factory.createPropertyAccessExpression(
                                                    factory.createIdentifier("lekko"),
                                                    factory.createIdentifier("getClient")
                                                ),
                                                undefined,
                                                []
                                            ))),
                                            factory.createIdentifier(getter)
                                        ),
                                        undefined,
                                        [
                                            factory.createStringLiteral(namespace),
                                            factory.createStringLiteral(configName),
                                            factory.createCallExpression(
                                                factory.createPropertyAccessExpression(
                                                    factory.createPropertyAccessExpression(
                                                        factory.createIdentifier("lekko"),
                                                        factory.createIdentifier("ClientContext")
                                                    ),
                                                    factory.createIdentifier("fromJSON")
                                                ),
                                                undefined,
                                                [factory.createIdentifier("args")]
                                            )
                                        ]
                                    )))],
                                true
                            ),
                            factory.createCatchClause(
                                undefined,
                                node.body
                            ),
                            undefined
                        )],
                        true
                    )

                )
            }
            return node;
        }

        const visitor: ts.Visitor = (node: ts.Node) => {
            if (ts.isSourceFile(node)) {
                const match = node.fileName.match(/lekko\/([a-z\-]+)\.ts$/);
                if (match) {
                    namespace = match[1];
                    const importDeclaration = ts.factory.createImportDeclaration(
                        undefined,
                        ts.factory.createImportClause(
                            false,
                            undefined,
                            ts.factory.createNamespaceImport(ts.factory.createIdentifier("lekko"))
                        ),
                        ts.factory.createStringLiteral("@lekko/node-server-sdk"),
                        undefined
                    );
                    return ts.factory.updateSourceFile(node, [
                        importDeclaration,
                        // @ts-ignore
                        ...ts.visitNodes(node.statements, injectMagic)
                    ]);
                }
            }
            return node;
        };

        return (file: ts.SourceFile) => ts.visitNode(file, visitor);
    };
}
