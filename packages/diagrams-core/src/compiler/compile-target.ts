import type { CompileResult } from "../types/graph.ts";
import type { KDiagramAst, ModelAst, ViewAst } from "../parser/ast.ts";

export type CompileTarget =
  | number
  | {
      diagramIndex?: number;
      view?: string;
    };

export type CompileTargetDescriptor = {
  kind: "diagram" | "sequence" | "model-view";
  index: number;
  title?: string;
  viewName?: string;
  modelName?: string;
};

export function listCompileTargets(ast: KDiagramAst): CompileTargetDescriptor[] {
  const targets: CompileTargetDescriptor[] = [];
  ast.body.forEach((node, index) => {
    if (node.type === "Diagram") {
      targets.push({
        kind: node.diagramKind === "state" ? "diagram" : "diagram",
        index,
        title: node.name,
      });
    } else if (node.type === "Sequence") {
      targets.push({ kind: "sequence", index, title: node.name });
    } else if (node.type === "Model") {
      for (const view of node.views) {
        targets.push({
          kind: "model-view",
          index,
          modelName: node.name,
          viewName: view.name,
          title: view.name,
        });
      }
    }
  });
  return targets;
}

export function findModelView(model: ModelAst, viewName: string): ViewAst | undefined {
  return model.views.find((view) => view.name === viewName);
}

export function normalizeCompileTarget(target?: CompileTarget): {
  diagramIndex: number;
  view?: string;
} {
  if (typeof target === "number") return { diagramIndex: target };
  return {
    diagramIndex: target?.diagramIndex ?? 0,
    view: target?.view,
  };
}

export function attachCompileMetadata(
  result: CompileResult,
  intent?: CompileResult["intent"],
): CompileResult {
  if (!intent) return result;
  return {
    ...result,
    intent,
    graph: { ...result.graph, intent },
  };
}
