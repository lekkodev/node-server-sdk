#!/usr/bin/env node
/* eslint-disable */
import assert = require("assert");
import * as ts from "typescript";
import { TypeChecker } from "typescript";
import fs = require("node:fs");
import snakeCase = require("lodash.snakecase");
import camelCase = require("lodash.camelcase");

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
    if (expr.kind != ts.SyntaxKind.Identifier) {
      throw new Error("context key should be an identifier");
    }
    return expr.getText();
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
              `need to be able to handle: ${
                ts.SyntaxKind[binaryExpr.operatorToken.kind]
              }`
            );
        }
      case ts.SyntaxKind.ParenthesizedExpression:
        const expr = expression as ts.ParenthesizedExpression;
        return expressionToThing(expr.expression);
      // TODO other literal types
      default:
        throw new Error(
          `need to be able to handle: ${ts.SyntaxKind[expression.kind]}`
        );
    }
  }

  function ifStatementToRule(ifStatement: ts.IfStatement, returnType: string) {
    const block = ifStatement.thenStatement as ts.Block;
    if (block.statements.length != 1) {
      throw new Error(
        `Must only contain return statement: ${block.getFullText()}`
      );
    }
    if (ifStatement.elseStatement != undefined) {
      throw new Error(
        `Else does not yet exist, sorry: ${ifStatement.getFullText()}`
      );
    }
    return {
      rule: expressionToThing(ifStatement.expression),
      value: returnStatementToValue(
        block.statements[0] as ts.ReturnStatement,
        returnType
      ),
    };
  }

  function returnStatementToValue(
    returnNode: ts.ReturnStatement,
    returnType: string
  ) {
    const expression = returnNode.expression;
    assert(expression);
    return expressionToProtoValue(expression, returnType);
  }

  function expressionToJsonValue(expression: ts.Expression) {
    let o = {};
    eval("o = " + expression.getFullText());
    return o;
  }

  function expressionToProtoValue(
    expression: ts.Expression,
    protoType?: string
  ) {
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
          value: eval(expression.getText()),
        };
      case ts.SyntaxKind.NumericLiteral:
        return {
          "@type": "type.googleapis.com/google.protobuf.DoubleValue",
          value: new Number(expression.getText()),
        };
      case ts.SyntaxKind.FirstLiteralToken:
        // uh... wtf mate
        // TODO: what is the case for this?
        return {
          "@type": "type.googleapis.com/google.protobuf.StringValue",
          value: (expression as ts.StringLiteral).text,
        };
      case ts.SyntaxKind.ObjectLiteralExpression:
        const fullText = (
          expression as ts.ObjectLiteralExpression
        ).getFullText();
        let obj = {};
        eval("obj = " + fullText);
        return {
          ...obj,
          "@type": `type.googleapis.com/default.config.v1beta1.${protoType}`,
        };
      default:
        throw new Error(
          `need to be able to handle: ${ts.SyntaxKind[expression.kind]}`
        );
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
    throw new Error(`Unsupported type: ${returnType}!`);
  }

  function processNode(node: ts.Node) {
    switch (node.kind) {
      case ts.SyntaxKind.FunctionDeclaration:
        const functionDeclarationStatement = node as ts.FunctionDeclaration;
        // const config: Config = {
        //     rules: [],
        //     name: "",
        //     type: "",
        //     default: undefined
        // };

        // const f = new Feature();
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

        if (functionDeclarationStatement.name === undefined) {
          throw new Error("Unparsable function name");
        }
        const getterName =
          functionDeclarationStatement.name.escapedText.toString();
        if (!/^\s*get[A-Z][A-Za-z]*$/.test(getterName)) {
          // no idea why that leading space is there..
          throw new Error(`Unparsable function name: "${getterName}"`);
        }
        const sig = checker.getSignatureFromDeclaration(
          functionDeclarationStatement
        );
        assert(sig);

        config.key = snakeCase(getterName.substring(3));

        // TODO check parameters
        const returnType = sig.getReturnType();

        // todo support nested interfaces
        config.type = getLekkoType(returnType);
        // TODO: set default
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
            ts.TypeFormatFlags.None
          );
        }
        assert(functionDeclarationStatement.body);
        for (const statement of functionDeclarationStatement.body.statements) {
          switch (statement.kind) {
            case ts.SyntaxKind.IfStatement:
              const { rule, value } = ifStatementToRule(
                statement as ts.IfStatement,
                valueType
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
                valueType
              );
              break;
            default:
              throw new Error(
                `Unable to handle: ${ts.SyntaxKind[statement.kind]}`
              );
          }
        }
        const configJson = JSON.stringify(config, null, 2);
        fs.writeFileSync(
          repoPath + `/default/gen/json/${config.key}.json`,
          configJson
        );
        // console.log(configJson);

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
          }`
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
  }
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
        registry
      );
      return `${protoType} ${propertyName} = ${idx + 1};`;
    } else {
      throw new Error(
        `Unsupported member type: ${
          ts.SyntaxKind[member.kind]
        } - ${member.getFullText()}`
      );
    }
  });
  registry[name] = fields;
}

function symbolToFields(
  node: ts.Symbol,
  typeChecker: ts.TypeChecker,
  name: string
) {
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
      registry
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
  }
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
      `Error: Programmer didn't think through how to handle all unions.  Replace with ChatGPT.`
    );
    //return name + "_" + propertyName.charAt(0).toUpperCase() + propertyName.slice(1);
  }
  if (type.flags & ts.TypeFlags.Object) {
    const camelCasePropertyName = camelCase(propertyName);
    const childName =
      name +
      camelCasePropertyName.charAt(0).toUpperCase() +
      camelCasePropertyName.slice(1);
    const symbol = type.getSymbol();
    assert(symbol);
    if (symbol.escapedName === "Array") {
      const typeArgs = (type as ts.TypeReference).typeArguments;
      assert(typeArgs);
      let innerType = typeArgs[0];
      return (
        "repeated " +
        getProtoTypeFromTypeScriptType(
          typeChecker,
          innerType,
          propertyName,
          name,
          registry
        )
      );
    } else if (symbol.escapedName === "Date") {
      return "int32"; // TODO dates are stupid
    } else {
      const symbol = type.getSymbol();
      assert(symbol);
      registry[childName] ||= [];
      registry[childName].push(
        ...symbolToFields(symbol, typeChecker, childName)
      );
    }
    return childName;
  }
  throw new Error(
    `Unsupported TypeScript type: ${type.flags} - ${typeChecker.typeToString(
      type
    )}`
  );
}

const repoPath =
  "/Users/sergey/Library/Application Support/Lekko/Config Repositories/default";
const filename = "./src/default.ts"; //process.argv.slice(2);
const program = ts.createProgram([filename], {
  target: ts.ScriptTarget.ES2022,
});
const typeChecker = program.getTypeChecker();
const sourceFile = program.getSourceFile(filename);
assert(sourceFile);
const interfaceNodes = sourceFile.statements.filter((node) =>
  ts.isInterfaceDeclaration(node)
);

const registry: { [key: string]: string[] } = {};
interfaceNodes.forEach((interfaceNode) => {
  convertInterfaceToProto(
    interfaceNode as ts.InterfaceDeclaration,
    typeChecker,
    registry
  );
});

let protofile = "";

const keys = Object.keys(registry);
keys.sort((a, b) => b.length - a.length);
protofile += `syntax = "proto3";\n\n`;
protofile += `package default.config.v1beta1;\n\n`;
for (const key of keys) {
  protofile += `message ${key} {\n  ${registry[key].join("\n  ")}\n}\n\n`;
}
fs.writeFileSync(
  repoPath + "/proto/default/config/v1beta1/default.proto",
  protofile
);
console.log(protofile);

for (const fileName of [filename]) {
  //   console.log(fileName);
  const sourceFile = program.getSourceFile(fileName);
  assert(sourceFile);
  convertSourceFile(sourceFile, typeChecker);
}

