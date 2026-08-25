import { dirname, resolve as resolvePath } from "node:path";
import { parse, type KDiagramAst, type ModelAst, type TopLevelNode } from "@kekonic/diagrams-core";

export type ResolveDocumentOptions = {
  /** Directory containing the entry `.kdiagram` file. */
  basePath: string;
  readFile: (absolutePath: string) => string;
};

export type ResolvedDocument = {
  ast: KDiagramAst;
  dependencyPaths: string[];
};

/** Resolve `import` statements and merge shared models into one document AST. */
export function resolveDocument(source: string, options: ResolveDocumentOptions): ResolvedDocument {
  const ast = parse(source);
  const seen = new Set<string>();
  const dependencyPaths: string[] = [];
  const resolved = resolveAst(ast, options.basePath, options.readFile, seen, dependencyPaths);
  return { ast: resolved, dependencyPaths };
}

function resolveAst(
  ast: KDiagramAst,
  basePath: string,
  readFile: (absolutePath: string) => string,
  seen: Set<string>,
  dependencyPaths: string[],
): KDiagramAst {
  const diagnostics = [...ast.diagnostics];
  let merged: TopLevelNode[] = [];

  for (const node of ast.body) {
    if (node.type !== "Import") {
      merged = mergeTopLevel(merged, [node]);
      continue;
    }
    if (ast.version == null || ast.version < 2) {
      diagnostics.push({
        severity: "error",
        code: "FM236",
        message: "`import` requires `kdiagram 2` at the top of the file",
        range: node.range,
      });
      continue;
    }
    const absolutePath = resolveImportPath(basePath, node.path);
    if (seen.has(absolutePath)) {
      diagnostics.push({
        severity: "error",
        code: "FM234",
        message: `Circular import: "${node.path}"`,
        range: node.range,
        hint: "Remove the import cycle or merge shared models into one file.",
      });
      continue;
    }
    seen.add(absolutePath);
    dependencyPaths.push(absolutePath);
    let importedSource: string;
    try {
      importedSource = readFile(absolutePath);
    } catch {
      diagnostics.push({
        severity: "error",
        code: "FM235",
        message: `Could not read import "${node.path}"`,
        range: node.range,
        hint: "Check the path is relative to the importing file.",
      });
      continue;
    }
    const importedAst = parse(importedSource);
    const importedDir = dirnameOf(absolutePath);
    const resolvedImported = resolveAst(importedAst, importedDir, readFile, seen, dependencyPaths);
    diagnostics.push(...resolvedImported.diagnostics);
    merged = mergeTopLevel(merged, resolvedImported.body);
  }

  return { type: "Document", version: ast.version, body: merged, diagnostics };
}

function mergeTopLevel(base: TopLevelNode[], overlay: TopLevelNode[]): TopLevelNode[] {
  const result = [...base];
  for (const node of overlay) {
    if (node.type === "Import") continue;
    if (node.type === "Model") {
      const index = result.findIndex((item) => item.type === "Model" && item.name === node.name);
      if (index >= 0 && result[index]?.type === "Model") {
        result[index] = mergeModels(result[index], node);
        continue;
      }
    }
    result.push(node);
  }
  return result;
}

function mergeModels(base: ModelAst, overlay: ModelAst): ModelAst {
  const views = new Map(base.views.map((view) => [view.name, view]));
  for (const view of overlay.views) views.set(view.name, view);
  return {
    type: "Model",
    name: overlay.name ?? base.name,
    statements: [...base.statements, ...overlay.statements],
    views: [...views.values()],
    range: overlay.range,
  };
}

function resolveImportPath(basePath: string, importPath: string): string {
  const baseDir = resolvePath(basePath);
  const target = importPath.startsWith("/") ? importPath : resolvePath(baseDir, importPath);
  return resolvePath(target);
}

function dirnameOf(filePath: string): string {
  return dirname(resolvePath(filePath));
}
