#!/usr/bin/env node
/* eslint-disable */
// @ts-nocheck
import assert = require("assert");
import * as ts from "typescript";
import { TypeChecker } from "typescript";


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

interface Config {
    name: string
    type: string
    default: unknown
    rules: unknown[]
}

function convertSourceFile(sourceFile: ts.SourceFile, checker: TypeChecker) {


    function expressionToThing(expression: Expression) {
        switch (expression.kind) {
            case ts.SyntaxKind.BinaryExpression:
                var operator: string;
                switch(expression.operatorToken.kind) {
                    case ts.SyntaxKind.EqualsEqualsEqualsToken:
                        operator = "==";
                        break;
                    case ts.SyntaxKind.AmpersandAmpersandToken:
                        operator = "and"
                        break;
                    default:
                        throw new Error(`need to be able to handle: ${ts.SyntaxKind[expression.operatorToken.kind]}`);
                }
                // TODO - we should probably enforce that it must be identifier op literal
                return `(${expressionToThing(expression.left)} ${operator} ${expressionToThing(expression.right)})`
            case ts.SyntaxKind.Identifier:
                return expression.getText()
            case ts.SyntaxKind.StringLiteral:
                return expression.getText()
            case ts.SyntaxKind.ParenthesizedExpression:
                return `( ${expressionToThing(expression.expression)} )`;
            // TODO other literal types
            default:
                throw new Error(`need to be able to handle: ${ts.SyntaxKind[expression.kind]}`);
        }
        
    }

    function ifStatementToRule(ifStatement: ts.IfStatement, checker: TypeChecker) {
        const block = ifStatement.thenStatement as ts.Block;
        if (block.statements.length != 1) {
            throw new Error(`Must only contain return statement: ${block.getFullText()}`) ;
        }
        if (ifStatement.elseStatement != undefined) {
            throw new Error(`Else does not yet exist, sorry: ${ifStatement.getFullText()}`);
        }
        return {
            "rule": expressionToThing(ifStatement.expression),
            "value": returnStatementToValue(block.statements[0] as ts.ReturnStatement, checker),
        };
    }

    function returnStatementToValue(returnNode: ts.ReturnStatement, checker: TypeChecker) {
        const valueNode = returnNode.getChildren()[1];
        switch (valueNode.kind) {
            case ts.SyntaxKind.FalseKeyword:
                return false;
            case ts.SyntaxKind.TrueKeyword:
                return true;
            case ts.SyntaxKind.StringLiteral:
                return (valueNode as ts.StringLiteral).text;
            case ts.SyntaxKind.FirstLiteralToken:
                // uh... wtf mate
                return (valueNode as ts.LiteralToken).text;
            case ts.SyntaxKind.ObjectLiteralExpression:
                return (valueNode as ts.ObjectLiteralExpression).getFullText(); // I'm sure there is an easy way to convert that to proto..
            default:
                throw new Error(`need to be able to handle: ${ts.SyntaxKind[valueNode.kind]}`);
        }
    }


    function processNode(node: ts.Node) {
        switch (node.kind) {
            case ts.SyntaxKind.FunctionDeclaration:
                const functionDeclarationStatement = node as ts.FunctionDeclaration;
                const config: Config = {
                    rules: [],
                    name: "",
                    type: "",
                    default: undefined
                };

                if (functionDeclarationStatement.name === undefined) {
                    throw new Error('Unparsable function name');
                }
                if (!(/^\s*get[A-Z][A-Za-z]*$/.test(functionDeclarationStatement.name.getFullText()))) { // no idea why that leading space is there..
                    throw new Error(`Unparsable function name: "${functionDeclarationStatement.name.getFullText()}"`);
                }
                const sig = checker.getSignatureFromDeclaration(functionDeclarationStatement);
                assert(sig);
                config.name = functionDeclarationStatement.name.getFullText().trim();

                // TODO check parameters
                const returnType = sig.getReturnType();

                // TODO check if intrinsic
                if ((returnType as any).intrinsicName) {
                    config.type = (returnType as any).intrinsicName;
                } else {
                    /*
                    const symbol = returnType.getSymbol();
                    assert(symbol);
                    const declarations = symbol.getDeclarations();
                    assert(declarations);
                    const interfaceDeclaration = declarations.find(ts.isInterfaceDeclaration);
                    */
                    config.type = checker.typeToString(returnType, undefined, ts.TypeFormatFlags.None);
                }
                assert(functionDeclarationStatement.body);
                for (const statement of functionDeclarationStatement.body.statements) {
                    switch (statement.kind) {
                        case ts.SyntaxKind.IfStatement:
                            config.rules.push(ifStatementToRule(statement as ts.IfStatement, checker));
                            break;
                        case ts.SyntaxKind.ReturnStatement:
                            // TODO check that it's only 3
                            // TODO refactor for all return types
                            config.default = returnStatementToValue(statement as ts.ReturnStatement, checker);
                            break;
                        default:
                            throw new Error(`Unable to handle: ${ts.SyntaxKind[statement.kind]}`);
                    }
                }
                console.log(JSON.stringify(config));
                break;
            case ts.SyntaxKind.EndOfFileToken:
                break;
            case ts.SyntaxKind.InterfaceDeclaration:
                break;
            case ts.SyntaxKind.EmptyStatement:
                break;
            default:
                throw new Error(`We are unable to parse this yet.  Please contact us if you feel like we should be able to handle ${ts.SyntaxKind[node.kind]}`);
        }
    }

    ts.forEachChild(sourceFile, processNode);
}


function convertInterfaceToProto(node: ts.InterfaceDeclaration, typeChecker: TypeChecker, registry: {}) {
    const name = node.name.getText();
    const fields = node.members.map((member, idx) => {
        if (ts.isPropertySignature(member)) {
            const propertyName = member.name.getText();
            assert(member.type);
            const propertyType = typeChecker.getTypeAtLocation(member.type);
            const protoType = getProtoTypeFromTypeScriptType(typeChecker, propertyType, propertyName, name, registry);
            return `${protoType} ${propertyName} = ${idx + 1};`;
        } else {
            throw new Error(`Unsupported member type: ${ts.SyntaxKind[member.kind]} - ${member.getFullText()}`);
        }
    })
    registry[name] = fields;
}

function symbolToFields(node: ts.Symbol, typeChecker: ts.TypeChecker, name: string) {
    if (node.members == undefined) {
        throw new Error(`Error: Programmer is incompetent.  Replace with ChatGPT.`);
    }
    return Array.from(node.members).map(([propertyName, symbol], idx) => {
        const propertyType = typeChecker.getTypeOfSymbol(symbol);
        const protoType = getProtoTypeFromTypeScriptType(typeChecker, propertyType, propertyName.toString(), name, registry);
        return `${protoType} ${propertyName} = ${idx + 1};`;

    });
}

function getProtoTypeFromTypeScriptType(typeChecker: TypeChecker, type: ts.Type, propertyName: string, name: string, registry: {}): string {
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
        throw new Error(`Error: Programmer didn't think through how to handle all unions.  Replace with ChatGPT.`);
        //return name + "_" + propertyName.charAt(0).toUpperCase() + propertyName.slice(1);
    }
    if (type.flags & ts.TypeFlags.Object) {
        const childName = name + "_" + propertyName.charAt(0).toUpperCase() + propertyName.slice(1);
        const symbol = type.getSymbol();
        if (symbol.escapedName === 'Array') {
            let innerType = (type as ts.TypeReference).typeArguments[0];
            return "repeated " + getProtoTypeFromTypeScriptType(typeChecker, innerType, propertyName, name, registry);
        } else if (symbol.escapedName === 'Date') {
            return "int32"; // TODO dates are stupid
        } else {
            registry[childName] ||= [];
            registry[childName].push(...symbolToFields(type.getSymbol(), typeChecker, childName));
        }
        return childName;
    }
    throw new Error(`Unsupported TypeScript type: ${type.flags} - ${typeChecker.typeToString(type)}`);
}



const filename = './src/default.ts'; //process.argv.slice(2);
const program = ts.createProgram([filename], { target: ts.ScriptTarget.ES2022 });
const typeChecker = program.getTypeChecker();
const sourceFile = program.getSourceFile(filename);
assert(sourceFile);
const interfaceNodes = sourceFile.statements.filter(
    (node) => ts.isInterfaceDeclaration(node)
);

const registry = {};
interfaceNodes.forEach((interfaceNode) => {
    convertInterfaceToProto(interfaceNode as ts.InterfaceDeclaration, typeChecker, registry);
})

let protofile = "";

const keys = Object.keys(registry);
keys.sort((a, b) => b.length - a.length);
protofile += `syntax = "proto3";\n\n`;
for (const key of keys) {
    protofile += `message ${key} {\n  ${registry[key].join("\n  ")}\n}\n\n`;
}
console.log(protofile);



for (const fileName of [filename]) {
    console.log(fileName);
    const sourceFile = program.getSourceFile(fileName);
    assert(sourceFile);
    convertSourceFile(sourceFile, typeChecker);
}

