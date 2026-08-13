import type { Diagnostic } from "../types/geometry.ts";
import type { AnimationDefinition, AnimationCue, AnimationTarget } from "../animation/types.ts";
import { animationIdFromName } from "../animation/index.ts";
import type { AnimationBlockAst, AnimationCueAst, AnimationTargetAst } from "../parser/ast.ts";
import type { GraphNode } from "../types/graph.ts";

const DEFAULT_PULSE_MS = 400;
const DEFAULT_FLOW_MS = 600;

export function compileAnimationBlocks(
  blocks: AnimationBlockAst[],
  nodes: Map<string, GraphNode>,
  diagnostics: Diagnostic[],
): AnimationDefinition[] {
  const usedIds = new Set<string>();
  const animations: AnimationDefinition[] = [];

  for (const block of blocks) {
    let id = animationIdFromName(block.name);
    if (usedIds.has(id)) {
      let n = 2;
      while (usedIds.has(`${id}-${n}`)) n++;
      id = `${id}-${n}`;
    }
    usedIds.add(id);

    let loop = false;
    const cues: AnimationCue[] = [];

    for (const cueAst of block.cues) {
      if (cueAst.type === "loop") {
        loop = true;
        continue;
      }
      const cue = compileCue(cueAst, nodes, diagnostics);
      if (cue) cues.push(cue);
    }

    // Empty body (optional `loop`) opts into inferred Automatic with this name.
    const source = cues.length === 0 ? "auto" : "authored";

    animations.push({
      id,
      name: block.name,
      loop,
      cues,
      source,
    });
  }

  return animations;
}

function compileCue(
  cue: AnimationCueAst,
  nodes: Map<string, GraphNode>,
  diagnostics: Diagnostic[],
): AnimationCue | null {
  switch (cue.type) {
    case "dim":
    case "activate":
      return {
        op: cue.type,
        targets: resolveTargets(cue.targets, nodes, diagnostics, cue.range),
      };
    case "pulse":
      return {
        op: "pulse",
        targets: resolveTargets(cue.targets, nodes, diagnostics, cue.range),
        durationMs: cue.durationMs ?? DEFAULT_PULSE_MS,
      };
    case "flow": {
      for (const id of cue.path) {
        if (!nodes.has(id)) {
          diagnostics.push({
            severity: "error",
            code: "FM128",
            message: `Unknown node "${id}" in animation flow path`,
            range: cue.range,
          });
        }
      }
      return {
        op: "flow",
        path: cue.path,
        durationMs: cue.durationMs ?? DEFAULT_FLOW_MS,
      };
    }
    case "wait":
      return { op: "wait", durationMs: cue.durationMs };
    case "parallel": {
      const children: AnimationCue[] = [];
      for (const child of cue.cues) {
        if (child.type === "loop") {
          diagnostics.push({
            severity: "warning",
            code: "FM129",
            message: "`loop` inside parallel is ignored — place it on the animation block",
            range: child.range,
          });
          continue;
        }
        if (child.type === "parallel") {
          diagnostics.push({
            severity: "error",
            code: "FM130",
            message: "Nested parallel groups are not supported",
            range: child.range,
          });
          continue;
        }
        const compiled = compileCue(child, nodes, diagnostics);
        if (compiled) children.push(compiled);
      }
      return { op: "parallel", cues: children };
    }
    case "loop":
      return null;
  }
}

function resolveTargets(
  targets: AnimationTargetAst[],
  nodes: Map<string, GraphNode>,
  diagnostics: Diagnostic[],
  range: import("../types/geometry.ts").SourceRange,
): AnimationTarget[] {
  const out: AnimationTarget[] = [];
  for (const t of targets) {
    if (t.type === "all") {
      out.push({ type: "all" });
      continue;
    }
    if (t.type === "node") {
      if (!nodes.has(t.id)) {
        diagnostics.push({
          severity: "error",
          code: "FM128",
          message: `Unknown node "${t.id}" in animation`,
          range,
        });
      }
      out.push({ type: "node", id: t.id });
      continue;
    }
    if (!nodes.has(t.from) || !nodes.has(t.to)) {
      diagnostics.push({
        severity: "error",
        code: "FM128",
        message: `Unknown edge endpoints "${t.from} -> ${t.to}" in animation`,
        range,
      });
    }
    out.push({ type: "edge", from: t.from, to: t.to });
  }
  return out;
}
