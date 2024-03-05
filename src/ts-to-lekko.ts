#!/usr/bin/env node
/* eslint-disable no-case-declarations */
import assert = require("assert");
import ts from "typescript";
import { TypeChecker } from "typescript";
import fs = require("node:fs");
import path = require("node:path");
import snakeCase = require("lodash.snakecase");
import camelCase = require("lodash.camelcase");
import kebabCase = require("lodash.kebabcase");
import { spawnSync } from "child_process";
import { program } from "commander";

/*
    TODOs
    * Hook the proto stuff into buf's stuff
    * Make proto rulelang stuff work for real (import and correctly format the message)
    * Correctly parse the binaryExpressions to validate property and convert to the correct operators
    * rewrite the code to be /less/ vomit inducing
    * wrapper meta-programming code to use it as a static fallback
    * command line args

    Stretch:
    * Static Contexts (might make things easier tbh)
    * constants at the top of the file
    * enums, maybe detect sex: 'male' | 'female'
    * Code gen from the repo (should be easy just not needed now)
    * config description as jsdoc
    * some sort of watcher thing (maybe hook into yarn?)
    * Bucketing

*/

function convertSourceFile(sourceFile: ts.SourceFile, checker: TypeChecker) {
    function exprToContextKey(expr: ts.Expression): string {
        switch (expr.kind) {
            case ts.SyntaxKind.Identifier:
                return expr.getText();
            case ts.SyntaxKind.PropertyAccessExpression:
                return (expr as ts.PropertyAccessExpression).name.getText();
            default:
                throw new Error(`need to be able to handle: ${ts.SyntaxKind[expr.kind]}`);
        }
    }

    type AtomRule = {
        atom: {
            contextKey: string;
            comparisonValue: any;
            comparisonOperator: "COMPARISON_OPERATOR_EQUALS";
        };
    };
    type LogicalExpression = {
        logicalExpression: {
            rules: Rule[];
            logicalOperator: "LOGICAL_OPERATOR_AND";
        };
    };

    type Rule = AtomRule | LogicalExpression;

    function expressionToThing(expression: ts.Expression): Rule {
        switch (expression.kind) {
            case ts.SyntaxKind.BinaryExpression:
                const binaryExpr = expression as ts.BinaryExpression;
                switch (binaryExpr.operatorToken.kind) {
                    case ts.SyntaxKind.EqualsEqualsEqualsToken:
                        return {
                            atom: {
                                contextKey: exprToContextKey(binaryExpr.left),
                                comparisonValue: expressionToJsonValue(binaryExpr.right),
                                comparisonOperator: "COMPARISON_OPERATOR_EQUALS",
                            },
                        };
                    case ts.SyntaxKind.AmpersandAmpersandToken:
                        return {
                            logicalExpression: {
                                rules: [
                                    expressionToThing(binaryExpr.left),
                                    expressionToThing(binaryExpr.right),
                                ],
                                logicalOperator: "LOGICAL_OPERATOR_AND",
                            },
                        };
                    default:
                        throw new Error(
                            `need to be able to handle: ${ts.SyntaxKind[binaryExpr.operatorToken.kind]}`,
                        );
                }
            case ts.SyntaxKind.ParenthesizedExpression:
                const expr = expression as ts.ParenthesizedExpression;
                return expressionToThing(expr.expression);
            // TODO other literal types
            default:
                throw new Error(`need to be able to handle: ${ts.SyntaxKind[expression.kind]}`);
        }
    }

    function ifStatementToRule(ifStatement: ts.IfStatement, returnType: string) {
        const block = ifStatement.thenStatement as ts.Block;
        if (block.statements.length != 1) {
            throw new Error(`Must only contain return statement: ${block.getFullText()}`);
        }
        if (ifStatement.elseStatement != undefined) {
            throw new Error(`Else does not yet exist, sorry: ${ifStatement.getFullText()}`);
        }
        return {
            rule: expressionToThing(ifStatement.expression),
            value: returnStatementToValue(block.statements[0] as ts.ReturnStatement, returnType),
        };
    }

    function returnStatementToValue(returnNode: ts.ReturnStatement, returnType: string) {
        const expression = returnNode.expression;
        assert(expression);
        return expressionToProtoValue(expression, returnType);
    }

    function expressionToJsonValue(expression: ts.Expression) {
        return Function(`return ${expression.getFullText()}`)();
    }

    function expressionToProtoValue(expression: ts.Expression, protoType?: string) {
        switch (expression.kind) {
            case ts.SyntaxKind.FalseKeyword:
                return {
                    "@type": "type.googleapis.com/google.protobuf.BoolValue",
                    value: false,
                };
            case ts.SyntaxKind.TrueKeyword:
                return {
                    "@type": "type.googleapis.com/google.protobuf.BoolValue",
                    value: true,
                };
            case ts.SyntaxKind.StringLiteral:
                return {
                    "@type": "type.googleapis.com/google.protobuf.StringValue",
                    value: expressionToJsonValue(expression),
                };
            case ts.SyntaxKind.NumericLiteral:
                return {
                    "@type": "type.googleapis.com/google.protobuf.DoubleValue",
                    value: new Number(expression.getText()),
                };
            case ts.SyntaxKind.ObjectLiteralExpression:
                return {
                    ...expressionToJsonValue(expression),
                    "@type": `type.googleapis.com/${namespace}.config.v1beta1.${protoType}`,
                };
            default:
                throw new Error(`need to be able to handle: ${ts.SyntaxKind[expression.kind]}`);
        }
    }

    function getLekkoType(returnType: ts.Type) {
        if (returnType.flags & ts.TypeFlags.Boolean) {
            return "FEATURE_TYPE_BOOL";
        }
        if (returnType.flags & ts.TypeFlags.Number) {
            return "FEATURE_TYPE_FLOAT";
        }
        if (returnType.flags & ts.TypeFlags.String) {
            return "FEATURE_TYPE_STRING";
        }
        if (returnType.flags & ts.TypeFlags.Object) {
            return "FEATURE_TYPE_PROTO";
        }
        throw new Error(
            `Unsupported TypeScript type: ${returnType.flags} - ${tsProgram?.getTypeChecker().typeToString(returnType)}`,
        );
    }

    function processNode(node: ts.Node) {
        switch (node.kind) {
            case ts.SyntaxKind.FunctionDeclaration:
                const functionDeclaration = node as ts.FunctionDeclaration;
                assert(functionDeclaration);

                type Tree = {
                    default?: any;
                    constraints: {
                        value: any;
                        ruleAstNew: Rule;
                    }[];
                };
                const config: {
                    key?: string;
                    type?:
                        | "FEATURE_TYPE_BOOL"
                        | "FEATURE_TYPE_INT"
                        | "FEATURE_TYPE_FLOAT"
                        | "FEATURE_TYPE_STRING"
                        | "FEATURE_TYPE_JSON"
                        | "FEATURE_TYPE_PROTO";
                    tree?: Tree;
                } = {};

                if (functionDeclaration.name === undefined) {
                    throw new Error("Unparsable function name");
                }
                const getterName = functionDeclaration.name.escapedText.toString();
                if (!/^\s*get[A-Z][A-Za-z]*$/.test(getterName)) {
                    // no idea why that leading space is there..
                    throw new Error(`Unparsable function name: "${getterName}"`);
                }
                const sig = checker.getSignatureFromDeclaration(functionDeclaration);
                assert(sig);

                config.key = kebabCase(getterName.substring(3));

                // TODO: this doesn't work for some reason
                // @ ts-expect-error
                // const returnType: ts.Type = checker.getPromisedTypeOfPromise(
                //   sig.getReturnType(),
                // );
                // console.log(returnType);
                // console.log(functionDeclaration.type);
                // console.log(sig);
                const promiseType = typeChecker.getReturnTypeOfSignature(sig);
                const returnType = promiseType.aliasTypeArguments?.find(() => true);
                assert(returnType);

                // todo support nested interfaces
                config.type = getLekkoType(returnType);
                const tree: Tree = {
                    constraints: [],
                };
                config.tree = tree;
                // TODO check if intrinsic
                let valueType: string;
                if ((returnType as any).intrinsicName) {
                    valueType = (returnType as any).intrinsicName;
                } else {
                    /*
          const symbol = returnType.getSymbol();
          assert(symbol);
          const declarations = symbol.getDeclarations();
          assert(declarations);
          const interfaceDeclaration = declarations.find(ts.isInterfaceDeclaration);
          */
                    valueType = checker.typeToString(
                        returnType,
                        undefined,
                        ts.TypeFormatFlags.None,
                    );
                }
                assert(functionDeclaration.body);
                for (const statement of functionDeclaration.body.statements) {
                    switch (statement.kind) {
                        case ts.SyntaxKind.IfStatement:
                            const { rule, value } = ifStatementToRule(
                                statement as ts.IfStatement,
                                valueType,
                            );
                            config.tree.constraints.push({
                                value: value,
                                ruleAstNew: rule,
                            });
                            break;
                        case ts.SyntaxKind.ReturnStatement:
                            // TODO check that it's only 3
                            // TODO refactor for all return types
                            tree.default = returnStatementToValue(
                                statement as ts.ReturnStatement,
                                valueType,
                            );
                            break;
                        default:
                            throw new Error(`Unable to handle: ${ts.SyntaxKind[statement.kind]}`);
                    }
                }

                assert(config.key);

                const configJson = JSON.stringify(config, null, 2);
                const jsonDir = path.join(repoPath, namespace, "gen", "json");
                fs.mkdirSync(jsonDir, { recursive: true });
                fs.writeFileSync(path.join(jsonDir, `${config.key}.json`), configJson);
                const spawnReturns = spawnSync(
                    "lekko",
                    ["exp", "gen", "starlark", "-n", namespace, "-c", config.key],
                    {
                        encoding: "utf-8",
                        cwd: repoPath,
                    },
                );
                if (spawnReturns.error !== undefined || spawnReturns.status !== 0) {
                    throw new Error(`Failed to generate starlark for ${config.key}`);
                }

                break;
            case ts.SyntaxKind.EndOfFileToken:
                break;
            case ts.SyntaxKind.InterfaceDeclaration:
                break;
            case ts.SyntaxKind.EmptyStatement:
                break;
            default:
                throw new Error(
                    `We are unable to parse this yet.  Please contact us if you feel like we should be able to handle ${
                        ts.SyntaxKind[node.kind]
                    }`,
                );
        }
    }

    ts.forEachChild(sourceFile, processNode);
}

function convertInterfaceToProto(
    node: ts.InterfaceDeclaration,
    typeChecker: TypeChecker,
    registry: {
        [key: string]: string[];
    },
) {
    const name = node.name.getText();
    const fields = node.members.map((member, idx) => {
        if (ts.isPropertySignature(member)) {
            const propertyName = snakeCase(member.name.getText());
            assert(member.type);
            const propertyType = typeChecker.getTypeAtLocation(member.type);
            const protoType = getProtoTypeFromTypeScriptType(
                typeChecker,
                propertyType,
                propertyName,
                name,
                registry,
            );
            return `${protoType} ${propertyName} = ${idx + 1};`;
        } else {
            throw new Error(
                `Unsupported member type: ${ts.SyntaxKind[member.kind]} - ${member.getFullText()}`,
            );
        }
    });
    registry[name] = fields;
}

function symbolToFields(node: ts.Symbol, typeChecker: ts.TypeChecker, name: string) {
    if (node.members == undefined) {
        throw new Error(`Error: Programmer is incompetent.  Replace with ChatGPT.`);
    }
    return Array.from(node.members).map(([propertyName, symbol], idx) => {
        const propertyType = typeChecker.getTypeOfSymbol(symbol);
        const fieldName = snakeCase(propertyName.toString());
        const protoType = getProtoTypeFromTypeScriptType(
            typeChecker,
            propertyType,
            fieldName,
            name,
            registry,
        );
        return `${protoType} ${fieldName} = ${idx + 1};`;
    });
}

function getProtoTypeFromTypeScriptType(
    typeChecker: TypeChecker,
    type: ts.Type,
    propertyName: string,
    name: string,
    registry: {
        [key: string]: string[];
    },
): string {
    if (type.flags & ts.TypeFlags.String) {
        return "string";
    }
    if (type.flags & ts.TypeFlags.Number) {
        return "double";
    }
    if (type.flags & ts.TypeFlags.Boolean) {
        return "bool";
    }
    if (type.flags & ts.TypeFlags.Union) {
        // If all the types are ObjectLiteral - do we want to use that type, or make an enum?  Do we want to do oneOf for the others?
        throw new Error(
            `Error: Programmer didn't think through how to handle all unions.  Replace with ChatGPT.`,
        );
        //return name + "_" + propertyName.charAt(0).toUpperCase() + propertyName.slice(1);
    }
    if (type.flags & ts.TypeFlags.Object) {
        const camelCasePropertyName = camelCase(propertyName);
        const childName =
            name + camelCasePropertyName.charAt(0).toUpperCase() + camelCasePropertyName.slice(1);
        const symbol = type.getSymbol();
        assert(symbol);
        if (symbol.escapedName === "Array") {
            const typeArgs = (type as ts.TypeReference).typeArguments;
            assert(typeArgs);
            let innerType = typeArgs[0];
            return (
                "repeated " +
                getProtoTypeFromTypeScriptType(typeChecker, innerType, propertyName, name, registry)
            );
        } else if (symbol.escapedName === "Date") {
            return "int32"; // TODO dates are stupid
        } else {
            const symbol = type.getSymbol();
            assert(symbol);
            registry[childName] ||= [];
            registry[childName].push(...symbolToFields(symbol, typeChecker, childName));
        }
        return childName;
    }
    throw new Error(
        `Unsupported TypeScript type: ${type.flags} - ${typeChecker.typeToString(type)}`,
    );
}

program
    .option(
        "-r, --repo-path <string>",
        "path to the config repo",
        path.join(os.homedir(), "Library/Application Support/Lekko/Config Repositories/default/"),
    )
    .option("-f, --filename <string>", "ts file to convert to Lekko");
program.parse();
const options = program.opts();

const repoPath = String(options.repoPath);
const filename = String(options.filename);
const namespace = path.basename(filename, path.extname(filename));
const parentDir = path.dirname(filename);

const tsProgram = ts.createProgram([filename], {
    target: ts.ScriptTarget.ES2022,
});
const typeChecker = tsProgram.getTypeChecker();
const sourceFile = tsProgram.getSourceFile(filename);
assert(sourceFile);
const interfaceNodes = sourceFile.statements.filter((node) => ts.isInterfaceDeclaration(node));

const registry: { [key: string]: string[] } = {};
interfaceNodes.forEach((interfaceNode) => {
    convertInterfaceToProto(interfaceNode as ts.InterfaceDeclaration, typeChecker, registry);
});

let protofile = "";

const keys = Object.keys(registry);
keys.sort((a, b) => b.length - a.length);
protofile += `syntax = "proto3";\n\n`;
protofile += `package ${namespace}.config.v1beta1;\n\n`;
for (const key of keys) {
    protofile += `message ${key} {\n  ${registry[key].join("\n  ")}\n}\n\n`;
}
const protoDir = path.join(repoPath, "proto", namespace, "config", "v1beta1");
const protoPath = path.join(protoDir, `${namespace}.proto`);
fs.mkdirSync(protoDir, { recursive: true });
fs.writeFileSync(protoPath, protofile);

const bufGenTemplate = JSON.stringify({
    version: "v1",
    managed: { enabled: true },
    plugins: [
        {
            plugin: "buf.build/bufbuild/es:v1.7.2",
            out: "gen",
            opt: ["js_import_style=legacy_commonjs"],
        },
    ],
});
const spawnReturns = spawnSync(
    "buf",
    [
        "generate",
        "--template",
        bufGenTemplate,
        repoPath,
        "--path",
        protoPath,
        "--output",
        parentDir,
    ],
    {
        encoding: "utf-8",
    },
);
if (spawnReturns.error !== undefined || spawnReturns.status !== 0) {
    throw new Error(`Failed to generate proto bindings: ${spawnReturns.output}`);
}

for (const fileName of [filename]) {
    const sourceFile = tsProgram.getSourceFile(fileName);
    assert(sourceFile);
    convertSourceFile(sourceFile, typeChecker);
}
