#!/usr/bin/env ts-node
import transformerFactory from './transformer';
import assert from "assert";
import { program } from "commander";
import ts from "typescript";

program
    .requiredOption("-f, --filename <string>", "ts file to convert to Lekko");
program.parse();
const options = program.opts();

const filename = String(options.filename);

const tsProgram = ts.createProgram([filename], {
    target: ts.ScriptTarget.ES2022,
});

const sourceFile = tsProgram.getSourceFile(filename);
assert(sourceFile);
const printer = ts.createPrinter({ newLine: ts.NewLineKind.LineFeed });

//@ts-ignore
const transformer = transformerFactory(tsProgram, {"noStatic": true})({});

console.log(
    printer.printNode(
      ts.EmitHint.Unspecified,
      transformer(sourceFile)!,
      ts.createSourceFile("", "", ts.ScriptTarget.Latest)
    )
  );
  