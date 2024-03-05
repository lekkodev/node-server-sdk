import ts, { CompilerHost, CompilerOptions, Program, SyntaxKind, TransformationContext, SourceFile, Node } from 'typescript';
import { PluginConfig, ProgramTransformerExtras } from "ts-patch";
import { } from 'ts-expose-internals';
//import transformer from './transformer';


/* ****************************************************************************************************************** */
// region: Helpers
/* ****************************************************************************************************************** */

/**
 * Patches existing Compiler Host (or creates new one) to allow feeding updated file content from cache
 */
function getPatchedHost(
    maybeHost: CompilerHost | undefined,
    tsInstance: typeof ts,
    compilerOptions: CompilerOptions
): CompilerHost & { fileCache: Map<string, SourceFile> } {
    const fileCache = new Map();
    const compilerHost = maybeHost ?? tsInstance.createCompilerHost(compilerOptions, true);
    const originalGetSourceFile = compilerHost.getSourceFile;

    return Object.assign(compilerHost, {
        getSourceFile(fileName: string, languageVersion: ts.ScriptTarget) {
            fileName = tsInstance.normalizePath(fileName);
            if (fileCache.has(fileName)) return fileCache.get(fileName);

            const sourceFile = originalGetSourceFile.apply(void 0, Array.from(arguments) as any);
            fileCache.set(fileName, sourceFile);

            return sourceFile;
        },
        fileCache
    });
}

// endregion


/* ****************************************************************************************************************** */
// region: Program Transformer
/* ****************************************************************************************************************** */

export default function transformProgram(
    program: Program,
    host: CompilerHost | undefined,
    config: PluginConfig,
    { ts: tsInstance }: ProgramTransformerExtras,
): Program {
    const compilerOptions = program.getCompilerOptions();
    const compilerHost = getPatchedHost(host, tsInstance, compilerOptions);
    const rootFileNames = program.getRootFileNames().map(tsInstance.normalizePath);

    /* Transform AST */
    //const transformedSource = tsInstance.transform(
    ///* sourceFiles */ program.getSourceFiles().filter(sourceFile => rootFileNames.includes(sourceFile.fileName)),
    ///* transformers */[transformer(program, config, {}).bind(tsInstance)],
    //    compilerOptions
    //).transformed;

    /* Render modified files and create new SourceFiles for them to use in host's cache */
    /*
    const { printFile } = tsInstance.createPrinter();
    for (const sourceFile of transformedSource) {
        const { fileName, languageVersion } = sourceFile;
        const updatedSourceFile = tsInstance.createSourceFile(fileName, printFile(sourceFile), languageVersion);
        compilerHost.fileCache.set(fileName, updatedSourceFile);
    }
    */

    /* Re-create Program instance */
    // TODO - get all the protos
    return tsInstance.createProgram(rootFileNames.concat([ './src/lekko/gen/default/config/v1beta1/default_pb.js']),
        compilerOptions,
        compilerHost);
}

// endregion


