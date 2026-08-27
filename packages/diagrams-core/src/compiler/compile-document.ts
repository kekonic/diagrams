import type { Diagnostic } from "../types/geometry.ts";
import type { CompileResult, GraphModel, GraphNode } from "../types/graph.ts";
import type {
  DiagramAst,
  EdgeAst,
  KDiagramAst,
  ModelAst,
  StatementAst,
  ViewAst,
  ViewStatementAst,
} from "../parser/ast.ts";
import { compileAnimationBlocks } from "./compile-animations.ts";
import {
  compile as compileDiagram,
  collectAnimationBlocks,
  extractHints,
  applySwimlaneLayoutDefaults,
} from "./compile.ts";
import { compileSequence } from "./compile-sequence.ts";
import {
  type CompileTarget,
  attachCompileMetadata,
  findModelView,
  normalizeCompileTarget,
  selectDefaultView,
} from "./compile-target.ts";
import { projectSemanticGraph, type SemanticGraph } from "./project-view.ts";

export type { CompileTarget, CompileTargetDescriptor } from "./compile-target.ts";
export { listCompileTargets, selectDefaultView } from "./compile-target.ts";

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

function isViewScopeStatement(stmt: ViewStatementAst): boolean {
  return stmt.type === "Include" || stmt.type === "Exclude";
}

/** View statements that compile as diagram body (edges, layout, presentation, animation, …). */
function compileStatementsFromView(statements: ViewStatementAst[]): StatementAst[] {
  return statements.filter(
    (stmt): stmt is ViewStatementAst & StatementAst => !isViewScopeStatement(stmt),
  );
}

function finalizeProjectedGraph(
  semantic: SemanticGraph,
  hintStatements: StatementAst[],
  pseudoDiagram: DiagramAst,
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
    view: semantic.view
      ? { ...semantic.view, modelTitle: semantic.view.modelTitle ?? modelTitle }
      : undefined,
  };

  const hints = extractHints(pseudoDiagram);
  diagnostics.push(...hints.diagnostics);
  graph.diagnostics = diagnostics;
  const { diagnostics: _hintDiags, ...hintFields } = hints;
  if (semantic.diagramKind === "state") {
    hintFields.layoutHints = {
      ...hintFields.layoutHints,
      direction: hintFields.layoutHints.direction ?? "TD",
    };
  } else {
    hintFields.layoutHints = applySwimlaneLayoutDefaults(semantic.groups, hintFields.layoutHints);
  }
  return attachCompileMetadata({ graph, ...hintFields, diagnostics });
}

function compileModel(
  model: ModelAst,
  viewName: string | undefined,
  docDiagnostics: Diagnostic[],
): CompileResult {
  const diagnostics: Diagnostic[] = [...docDiagnostics];
  const modelId = model.name?.toLowerCase().replace(/\s+/g, "-") ?? "model";

  if (model.views.length === 0) {
    const baseDiagram: DiagramAst = {
      type: "Diagram",
      diagramKind: "flow",
      name: model.name,
      statements: model.statements as StatementAst[],
      range: model.range,
    };
    const baseAst: KDiagramAst = { type: "Document", version: 2, body: [baseDiagram], diagnostics };
    return compileDiagram(baseAst, 0);
  }

  const selected =
    (viewName ? findModelView(model, viewName) : undefined) ??
    (viewName ? undefined : selectDefaultView(model));

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
    return emptyCompileResult(diagnostics);
  }

  const viewBody = compileStatementsFromView(selected.statements);
  const combined: DiagramAst = {
    type: "Diagram",
    diagramKind: "flow",
    name: model.name,
    statements: [...(model.statements as StatementAst[]), ...viewBody],
    range: model.range,
  };
  const combinedAst: KDiagramAst = {
    type: "Document",
    version: 2,
    body: [combined],
    diagnostics: [],
  };
  const base = compileDiagram(combinedAst, 0);
  const semantic = graphToSemantic(base.graph);
  semantic.diagnostics = [...diagnostics, ...semantic.diagnostics];

  const projected = projectSemanticGraph(semantic, selected.statements, {
    viewName: selected.name,
    modelId,
    modelTitle: model.name,
    range: selected.range,
  });
  const hints = viewBody;
  const pseudoDiagram: DiagramAst = {
    type: "Diagram",
    diagramKind: "flow",
    name: selected.name,
    statements: hints,
    range: selected.range,
  };
  return finalizeProjectedGraph(projected, hints, pseudoDiagram, model.name);
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
    return emptyCompileResult(diagnostics);
  }

  if (top?.type === "Sequence") {
    return compileSequence(ast, diagramIndex);
  }

  return compileDiagram(ast, diagramIndex);
}

/** @deprecated alias — prefer `compileDocument`. Accepts index or `{ view }` target. */
export function compile(ast: KDiagramAst, target: CompileTarget = 0): CompileResult {
  return compileDocument(ast, target);
}

/** Split a one-shot diagram into model statements + a single implicit view (sugar). */
export function desugarDiagram(diagram: DiagramAst): {
  modelStatements: StatementAst[];
  view: ViewAst;
} {
  const modelStatements: StatementAst[] = [];
  const viewStatements: ViewStatementAst[] = [];
  for (const stmt of diagram.statements) {
    if (
      stmt.type === "Node" ||
      stmt.type === "Group" ||
      stmt.type === "Style" ||
      stmt.type === "StyleRef" ||
      stmt.type === "GroupMember"
    ) {
      modelStatements.push(stmt);
    } else if (stmt.type === "Edge") {
      viewStatements.push(stmt as EdgeAst);
    } else {
      viewStatements.push(stmt as ViewStatementAst);
    }
  }
  return {
    modelStatements,
    view: {
      type: "View",
      name: "default",
      statements: viewStatements,
      range: diagram.range,
    },
  };
}
