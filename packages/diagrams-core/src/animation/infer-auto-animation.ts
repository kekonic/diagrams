import type { GraphEdge, GraphModel, GraphNode } from "../types/graph.ts";
import { classifyBranch } from "../types/branch.ts";
import type { AnimationCue, AnimationDefinition, AnimationTarget } from "./types.ts";

const DEFAULT_FLOW_MS = 500;
const DEFAULT_PULSE_MS = 650;
/** Dwell pulse for ordinary nodes between hops. */
const DEFAULT_NODE_PULSE_MS = 450;
const DEFAULT_WAIT_MS = 600;
const DEFAULT_CHAPTER_MS = 350;
/** Soft cap so dense exclusive-branch DAGs stay watchable. */
const MAX_AUTO_CHAPTERS = 12;

export type AutoWalkStep =
  | { kind: "chapter" }
  | { kind: "enter"; nodeId: string }
  | { kind: "enter-many"; nodeIds: string[] }
  | { kind: "edge"; from: string; to: string }
  | { kind: "parallel-edges"; edges: Array<{ from: string; to: string }> };

type OutEdge = { to: string; edge: GraphEdge };
type Hop = { from: string; to: string };

/**
 * Infer Automatic animation.
 *
 * - **Exclusive** fan-out (choice nodes / yes·no branches) → one chapter per alternative.
 * - **Parallel** fan-out (everything else) → `parallel` flow cues in a single story.
 */
export function inferAutoAnimation(graph: GraphModel): AnimationDefinition | null {
  if (graph.diagramKind === "sequence" && graph.sequence) {
    return inferSequenceAutoAnimation(graph);
  }

  const steps = planAutoWalk(graph);
  if (steps.length === 0) return null;

  const cues: AnimationCue[] = [];
  const nodeById = new Map(graph.nodes.map((n) => [n.id, n]));
  let chapterIndex = -1;

  const pulseFor = (nodeId: string): AnimationCue => {
    const node = nodeById.get(nodeId);
    return {
      op: "pulse",
      targets: [{ type: "node", id: nodeId }],
      durationMs: node?.kind === "choice" ? DEFAULT_PULSE_MS : DEFAULT_NODE_PULSE_MS,
    };
  };

  for (const step of steps) {
    if (step.kind === "chapter") {
      chapterIndex += 1;
      cues.push({ op: "dim", targets: [{ type: "all" }] });
      if (chapterIndex > 0) {
        cues.push({ op: "wait", durationMs: DEFAULT_CHAPTER_MS });
      }
      continue;
    }

    if (step.kind === "enter") {
      cues.push({ op: "activate", targets: [{ type: "node", id: step.nodeId }] });
      cues.push(pulseFor(step.nodeId));
      continue;
    }

    if (step.kind === "enter-many") {
      const targets: AnimationTarget[] = step.nodeIds.map((id) => ({ type: "node", id }));
      cues.push({ op: "activate", targets });
      // wavefront only emits enter-many for 2+ nodes; pulse them together.
      cues.push({
        op: "parallel",
        cues: step.nodeIds.map((id) => pulseFor(id)),
      });
      continue;
    }

    if (step.kind === "edge") {
      cues.push({
        op: "flow",
        path: [step.from, step.to],
        durationMs: DEFAULT_FLOW_MS,
      });
      continue;
    }

    if (step.edges.length === 1) {
      const e = step.edges[0]!;
      cues.push({
        op: "flow",
        path: [e.from, e.to],
        durationMs: DEFAULT_FLOW_MS,
      });
    } else {
      cues.push({
        op: "parallel",
        cues: step.edges.map((e) => ({
          op: "flow" as const,
          path: [e.from, e.to],
          durationMs: DEFAULT_FLOW_MS,
        })),
      });
    }
  }

  cues.push({ op: "wait", durationMs: DEFAULT_WAIT_MS });

  return {
    id: "auto",
    name: "Automatic",
    loop: false,
    cues,
    source: "auto",
  };
}

/**
 * Chaptered walk: exclusive alternatives restart as chapters; concurrent
 * fan-out becomes parallel edge steps within a chapter.
 */
export function planAutoWalk(graph: GraphModel): AutoWalkStep[] {
  const chapters = enumerateChapterEdgeSets(graph);
  if (chapters.length === 0) return [];

  const steps: AutoWalkStep[] = [];
  for (const chapter of chapters) {
    steps.push({ kind: "chapter" });
    steps.push(...wavefrontSteps(chapter.startId, chapter.edges));
  }
  return steps;
}

/**
 * Exclusive alternatives as node sequences (parallel siblings linearized in
 * wavefront order). Prefer {@link planAutoWalk} for playback structure.
 */
export function enumerateAutoPaths(graph: GraphModel): string[][] {
  return enumerateChapterEdgeSets(graph).map((ch) => linearizeChapter(ch.startId, ch.edges));
}

/** First-visit node order across Automatic chapters. */
export function traceDeclarationPath(graph: GraphModel): string[] {
  const seen = new Set<string>();
  const path: string[] = [];
  for (const step of planAutoWalk(graph)) {
    if (step.kind === "enter") {
      if (seen.has(step.nodeId)) continue;
      seen.add(step.nodeId);
      path.push(step.nodeId);
    } else if (step.kind === "enter-many") {
      for (const id of step.nodeIds) {
        if (seen.has(id)) continue;
        seen.add(id);
        path.push(id);
      }
    }
  }
  return path;
}

type ChapterEdges = { startId: string; edges: Hop[] };

function enumerateChapterEdgeSets(graph: GraphModel): ChapterEdges[] {
  if (graph.nodes.length === 0) return [];

  const nodeIds = new Set(graph.nodes.map((n) => n.id));
  const nodeById = new Map(graph.nodes.map((n) => [n.id, n]));
  const outs = buildOuts(graph, nodeIds);
  const indegree = buildIndegree(graph, nodeIds);

  const sources = graph.nodes.filter((n) => (indegree.get(n.id) ?? 0) === 0);
  const startIds = sources.length > 0 ? sources.map((n) => n.id) : [graph.nodes[0]!.id];
  const primary = startIds[0]!;

  const chapters: ChapterEdges[] = [];
  const pushChapter = (startId: string, edges: Hop[]) => {
    if (chapters.length >= MAX_AUTO_CHAPTERS) return;
    const key = `${startId}|${edges.map((e) => `${e.from}>${e.to}`).join(";")}`;
    if (
      chapters.some(
        (c) => `${c.startId}|${c.edges.map((e) => `${e.from}>${e.to}`).join(";")}` === key,
      )
    ) {
      return;
    }
    chapters.push({ startId, edges: dedupeEdges(edges) });
  };

  for (const edgeSet of edgeSetsFrom(primary, new Set(), nodeById, outs)) {
    pushChapter(primary, edgeSet);
    if (chapters.length >= MAX_AUTO_CHAPTERS) break;
  }

  const covered = new Set<string>();
  for (const ch of chapters) {
    covered.add(ch.startId);
    for (const e of ch.edges) {
      covered.add(e.from);
      covered.add(e.to);
    }
  }

  for (const sourceId of startIds.slice(1)) {
    if (chapters.length >= MAX_AUTO_CHAPTERS) break;
    const side: Hop[] = [];
    const seen = new Set<string>();
    let nodeId: string | undefined = sourceId;
    while (nodeId && !seen.has(nodeId)) {
      seen.add(nodeId);
      if (seen.size > 1 && covered.has(nodeId)) break;
      const nexts: OutEdge[] = outs.get(nodeId) ?? [];
      if (nexts.length === 0) break;
      const out: OutEdge = nexts[0]!;
      side.push({ from: nodeId, to: out.to });
      nodeId = out.to;
    }
    pushChapter(sourceId, side);
  }

  for (const node of graph.nodes) {
    if (covered.has(node.id)) continue;
    if (
      chapters.some(
        (ch) =>
          ch.startId === node.id || ch.edges.some((e) => e.from === node.id || e.to === node.id),
      )
    ) {
      continue;
    }
    if (chapters.length >= MAX_AUTO_CHAPTERS) break;
    const sets = edgeSetsFrom(node.id, new Set(), nodeById, outs);
    if (sets.length === 0) pushChapter(node.id, []);
    else for (const edgeSet of sets) pushChapter(node.id, edgeSet);
  }

  return chapters;
}

/**
 * Edge-set alternatives from `nodeId`.
 * Exclusive fan-out → multiple sets; parallel fan-out → one set (cartesian if
 * parallel arms themselves contain exclusive forks).
 */
function edgeSetsFrom(
  nodeId: string,
  trail: Set<string>,
  nodeById: Map<string, GraphNode>,
  outs: Map<string, OutEdge[]>,
): Hop[][] {
  if (trail.has(nodeId)) return [[]];
  const nextTrail = new Set(trail);
  nextTrail.add(nodeId);
  const nexts = outs.get(nodeId) ?? [];
  if (nexts.length === 0) return [[]];

  if (isExclusiveFanOut(nodeById.get(nodeId), nexts)) {
    const result: Hop[][] = [];
    for (const out of nexts) {
      const hop = { from: nodeId, to: out.to };
      for (const suffix of edgeSetsFrom(out.to, nextTrail, nodeById, outs)) {
        result.push([hop, ...suffix]);
      }
    }
    return result.length > 0 ? result : [[]];
  }

  // Parallel / single: each successor contributes alternatives; take the product.
  const branchAlts: Hop[][][] = nexts.map((out) => {
    const hop = { from: nodeId, to: out.to };
    const suffixes = edgeSetsFrom(out.to, nextTrail, nodeById, outs);
    return suffixes.map((suffix) => [hop, ...suffix]);
  });
  return cartesianConcat(branchAlts);
}

function cartesianConcat(branches: Hop[][][]): Hop[][] {
  if (branches.length === 0) return [[]];
  let acc: Hop[][] = [[]];
  for (const alts of branches) {
    const next: Hop[][] = [];
    for (const prefix of acc) {
      for (const alt of alts) {
        next.push([...prefix, ...alt]);
      }
    }
    acc = next;
    if (acc.length >= MAX_AUTO_CHAPTERS) break;
  }
  return acc;
}

function wavefrontSteps(startId: string, edges: Hop[]): AutoWalkStep[] {
  const steps: AutoWalkStep[] = [];
  const remaining = new Set(edges.map((e) => keyOf(e)));
  const edgeByKey = new Map(edges.map((e) => [keyOf(e), e]));
  const reached = new Set<string>([startId]);
  steps.push({ kind: "enter", nodeId: startId });

  let guard = edges.length + 2;
  while (remaining.size > 0 && guard-- > 0) {
    const ready: Hop[] = [];
    for (const key of remaining) {
      const e = edgeByKey.get(key)!;
      if (reached.has(e.from)) ready.push(e);
    }
    if (ready.length === 0) break;

    if (ready.length === 1) {
      const e = ready[0]!;
      steps.push({ kind: "edge", from: e.from, to: e.to });
    } else {
      steps.push({ kind: "parallel-edges", edges: ready });
    }

    const newly: string[] = [];
    for (const e of ready) {
      remaining.delete(keyOf(e));
      if (!reached.has(e.to)) {
        reached.add(e.to);
        newly.push(e.to);
      }
    }
    const uniqueNew = [...new Set(newly)];
    if (uniqueNew.length === 1) {
      steps.push({ kind: "enter", nodeId: uniqueNew[0]! });
    } else if (uniqueNew.length > 1) {
      steps.push({ kind: "enter-many", nodeIds: uniqueNew });
    }
  }

  return steps;
}

function linearizeChapter(startId: string, edges: Hop[]): string[] {
  const ids: string[] = [];
  const seen = new Set<string>();
  for (const step of wavefrontSteps(startId, edges)) {
    if (step.kind === "enter") {
      if (!seen.has(step.nodeId)) {
        seen.add(step.nodeId);
        ids.push(step.nodeId);
      }
    } else if (step.kind === "enter-many") {
      for (const id of step.nodeIds) {
        if (seen.has(id)) continue;
        seen.add(id);
        ids.push(id);
      }
    }
  }
  return ids;
}

/** Choice diamonds / yes·no forks are mutually exclusive stories. */
export function isExclusiveFanOut(node: GraphNode | undefined, outs: OutEdge[]): boolean {
  if (outs.length < 2) return false;
  if (node?.kind === "choice") return true;
  const branches = new Set(outs.map((o) => o.edge.branch ?? classifyBranch(o.edge.label)));
  return branches.has("yes") && branches.has("no");
}

function buildOuts(graph: GraphModel, nodeIds: Set<string>): Map<string, OutEdge[]> {
  const outs = new Map<string, OutEdge[]>();
  for (const edge of graph.edges) {
    if (!nodeIds.has(edge.from) || !nodeIds.has(edge.to)) continue;
    const list = outs.get(edge.from);
    if (list) list.push({ to: edge.to, edge });
    else outs.set(edge.from, [{ to: edge.to, edge }]);
  }
  return outs;
}

function buildIndegree(graph: GraphModel, nodeIds: Set<string>): Map<string, number> {
  const indegree = new Map<string, number>();
  for (const id of nodeIds) indegree.set(id, 0);
  for (const edge of graph.edges) {
    if (!nodeIds.has(edge.to)) continue;
    indegree.set(edge.to, (indegree.get(edge.to) ?? 0) + 1);
  }
  return indegree;
}

function dedupeEdges(edges: Hop[]): Hop[] {
  const seen = new Set<string>();
  const out: Hop[] = [];
  for (const e of edges) {
    const k = keyOf(e);
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(e);
  }
  return out;
}

function keyOf(e: Hop): string {
  return `${e.from}\0${e.to}`;
}

/** Participants with an open activation bar covering this message order. */
function liveParticipantsAt(
  activations: Array<{ participantId: string; startOrder: number; endOrder: number }>,
  order: number,
): string[] {
  const ids = new Set<string>();
  for (const a of activations) {
    if (a.startOrder <= order && order <= a.endOrder) ids.add(a.participantId);
  }
  return [...ids];
}

/**
 * Walk sequence messages in order.
 * Emphasis follows SequenceIR activation spans: when a participant deactivates,
 * we dim and re-activate only the still-live set (plus the hop endpoints).
 */
function inferSequenceAutoAnimation(graph: GraphModel): AnimationDefinition | null {
  const seq = graph.sequence;
  if (!seq || seq.messages.length === 0) return null;

  const cues: AnimationCue[] = [];
  let prevEmphasisKey = "";

  for (const msg of seq.messages) {
    if (!msg.from || !msg.to || msg.kind === "destroy") continue;

    const live = liveParticipantsAt(seq.activations, msg.order);
    const emphasis = new Set(live);
    emphasis.add(msg.from);
    emphasis.add(msg.to);
    const emphasisKey = [...emphasis].sort().join("\0");

    // Reset sticky highlights when the activation set changes (activate/deactivate).
    if (emphasisKey !== prevEmphasisKey) {
      cues.push({ op: "dim", targets: [{ type: "all" }] });
      cues.push({
        op: "activate",
        targets: [...emphasis].map((id) => ({ type: "node" as const, id })),
      });
      prevEmphasisKey = emphasisKey;
    }

    cues.push({
      op: "flow",
      path: [msg.from, msg.to],
      durationMs: DEFAULT_FLOW_MS,
      edgeId: msg.id,
      edgeIds: [msg.id],
    });
    cues.push({
      op: "pulse",
      targets: [{ type: "node", id: msg.to }],
      durationMs: DEFAULT_NODE_PULSE_MS,
    });
  }

  cues.push({ op: "wait", durationMs: DEFAULT_WAIT_MS });
  return {
    id: "auto",
    name: "Automatic",
    loop: false,
    cues,
    source: "auto",
  };
}
