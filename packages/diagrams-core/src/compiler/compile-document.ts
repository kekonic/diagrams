import type { Diagnostic } from "../types/geometry.ts";
import type { CompileResult, GraphModel, GraphNode } from "../types/graph.ts";
import type { ViewIntent } from "../types/view-intent.ts";
import type {
  DiagramAst,
  KDiagramAst,
  ModelAst,
  StatementAst,
  ViewStatementAst,
} from "../parser/ast.ts";
import { compileAnimationBlocks } from "./compile-animations.ts";
import { compile as compileDiagram, collectAnimationBlocks, extractHints } from "./compile.ts";
import { compileSequence } from "./compile-sequence.ts";
import {
  type CompileTarget,
  attachCompileMetadata,
  findModelView,
  normalizeCompileTarget,
} from "./compile-target.ts";
import {
  extractIntentFromStatements,
  projectSemanticGraph,
  type SemanticGraph,
} from "./project-view.ts";
import { lintViewIntent } from "./lint-intent.ts";

export type { CompileTarget, CompileTargetDescriptor } from "./compile-target.ts";
export { listCompileTargets } from "./compile-target.ts";

function graphToSemantic(graph: GraphModel): SemanticGraph {
  return {
    id: graph.id,
    title: graph.title,
    diagramKind: graph.diagramKind === "state" ? "state" : "flow",
    nodes: graph.nodes,
    edges: graph.edges,
    groups: graph.groups,
    styles: graph.styles,
    diagnostics: graph.diagnostics,
  };
}

function hintStatementsFromView(statements: ViewStatementAst[]): StatementAst[] {
  return statements.filter(
    (stmt): stmt is ViewStatementAst & StatementAst =>
      stmt.type !== "Include" &&
      stmt.type !== "Exclude" &&
      stmt.type !== "Collapse" &&
      stmt.type !== "IntentBlock",
  ) as StatementAst[];
}

function finalizeProjectedGraph(
  semantic: SemanticGraph,
  hintStatements: StatementAst[],
  pseudoDiagram: DiagramAst,
  intent?: ViewIntent,
  modelTitle?: string,
): CompileResult {
  const diagnostics = [...semantic.diagnostics];
  const nodes = new Map<string, GraphNode>(semantic.nodes.map((node) => [node.id, node]));
  const graph: GraphModel = {
    id: semantic.id,
    title: semantic.title,
    diagramKind: semantic.diagramKind,
    nodes: semantic.nodes,
    edges: semantic.edges,
    groups: semantic.groups,
    styles: semantic.styles,
    animations: compileAnimationBlocks(collectAnimationBlocks(hintStatements), nodes, diagnostics),
    diagnostics,
    intent: semantic.intent ?? intent,
    view: semantic.view
      ? { ...semantic.view, modelTitle: semantic.view.modelTitle ?? modelTitle }
      : undefined,
  };

  const hints = extractHints(pseudoDiagram);
  diagnostics.push(...hints.diagnostics);
  diagnostics.push(...lintViewIntent(graph, graph.intent, pseudoDiagram.range));
  graph.diagnostics = diagnostics;
  const { diagnostics: _hintDiags, ...hintFields } = hints;
  if (semantic.diagramKind === "state") {
    hintFields.layoutHints = {
      ...hintFields.layoutHints,
      direction: hintFields.layoutHints.direction ?? "TD",
    };
  }
  return attachCompileMetadata({ graph, ...hintFields, diagnostics }, graph.intent);
}

function compileModel(
  model: ModelAst,
  viewName: string | undefined,
  docDiagnostics: Diagnostic[],
): CompileResult {
  const diagnostics: Diagnostic[] = [...docDiagnostics];
  const modelId = model.name?.toLowerCase().replace(/\s+/g, "-") ?? "model";
  const baseDiagram: DiagramAst = {
    type: "Diagram",
    diagramKind: "flow",
    name: model.name,
    statements: model.statements as StatementAst[],
    range: model.range,
  };
  const baseAst: KDiagramAst = { type: "Document", version: 2, body: [baseDiagram], diagnostics };
  const base = compileDiagram(baseAst, 0);
  const semantic = graphToSemantic(base.graph);

  if (model.views.length === 0) {
    return base;
  }

  const selected =
    (viewName ? findModelView(model, viewName) : undefined) ??
    (viewName ? undefined : model.views[0]);

  if (!selected) {
    const available = model.views.map((view) => view.name).join(", ");
    diagnostics.push({
      severity: "error",
      code: "FM228",
      message: viewName
        ? `View "${viewName}" was not found in model "${model.name ?? modelId}"`
        : "Model has views but no view was selected",
      range: model.range,
      hint: available
        ? `Available views: ${available}`
        : "Add a `view` block or omit views for a full render.",
    });
    return {
      graph: {
        id: "empty",
        nodes: [],
        edges: [],
        groups: [],
        styles: [],
        animations: [],
        diagnostics,
      },
      layoutHints: {},
      routingHints: {},
      renderHints: {},
      diagnostics,
    };
  }

  const intent = extractIntentFromStatements(selected.statements);
  const projected = projectSemanticGraph(semantic, selected.statements, {
    viewName: selected.name,
    modelId,
    modelTitle: model.name,
    intent,
    range: selected.range,
  });
  const hints = hintStatementsFromView(selected.statements);
  const pseudoDiagram: DiagramAst = {
    type: "Diagram",
    diagramKind: "flow",
    name: selected.name,
    statements: hints,
    range: selected.range,
  };
  return finalizeProjectedGraph(projected, hints, pseudoDiagram, intent, model.name);
}

function emptyCompileResult(diagnostics: Diagnostic[]): CompileResult {
  return {
    graph: {
      id: "empty",
      nodes: [],
      edges: [],
      groups: [],
      styles: [],
      animations: [],
      diagnostics,
    },
    layoutHints: {},
    routingHints: {},
    renderHints: {},
    diagnostics,
  };
}

/** Compile a document, optionally targeting a named model view (`kdiagram 2`). */
export function compileDocument(ast: KDiagramAst, target: CompileTarget = 0): CompileResult {
  const { diagramIndex, view } = normalizeCompileTarget(target);
  const top = ast.body[diagramIndex];

  if (top?.type === "Model") {
    return compileModel(top, view, ast.diagnostics);
  }

  if (view) {
    const diagnostics: Diagnostic[] = [
      ...ast.diagnostics,
      {
        severity: "error",
        code: "FM227",
        message: `--view requires a model block at index ${diagramIndex}`,
        range: top?.range ?? {
          start: { line: 1, column: 1, offset: 0 },
          end: { line: 1, column: 1, offset: 0 },
        },
        hint: "Use --view with `kdiagram 2` model files or omit --view for standalone diagrams.",
      },
    ];
    return {
      graph: {
        id: "empty",
        nodes: [],
        edges: [],
        groups: [],
        styles: [],
        animations: [],
        diagnostics,
      },
      layoutHints: {},
      routingHints: {},
      renderHints: {},
      diagnostics,
    };
  }

  if (top?.type === "Sequence") {
    return compileSequence(ast, diagramIndex);
  }

  if (top?.type === "Diagram") {
    const intent = extractIntentFromStatements(top.statements);
    const filteredStatements = top.statements.filter((stmt) => stmt.type !== "IntentBlock");
    if (filteredStatements.length === top.statements.length) {
      return compileDiagram(ast, diagramIndex);
    }
    const filteredBody = ast.body.map((node, index) =>
      index === diagramIndex && node.type === "Diagram"
        ? { ...node, statements: filteredStatements }
        : node,
    );
    const result = compileDiagram({ ...ast, body: filteredBody }, diagramIndex);
    if (!intent) return result;
    const graph = { ...result.graph, intent };
    const intentDiagnostics = lintViewIntent(graph, intent, top.range);
    const diagnostics = [...result.diagnostics, ...intentDiagnostics];
    return attachCompileMetadata({ ...result, graph, intent, diagnostics }, intent);
  }

  return compileDiagram(ast, diagramIndex);
}

/** @deprecated alias — prefer `compileDocument`. Accepts index or `{ view }` target. */
export function compile(ast: KDiagramAst, target: CompileTarget = 0): CompileResult {
  return compileDocument(ast, target);
}
