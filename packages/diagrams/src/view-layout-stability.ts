import type { Diagnostic, GraphModel } from "@kekonic/diagrams-core";
import type { LayoutResult } from "@kekonic/diagrams-layout";

const QUALITY_RANGE = {
  start: { line: 1, column: 1, offset: 0 },
  end: { line: 1, column: 1, offset: 0 },
};

export type ViewLayoutSnapshot = {
  viewName: string;
  graph: GraphModel;
  layout: LayoutResult;
};

export type NodeLayoutDrift = {
  nodeId: string;
  /** Normalized euclidean drift in layout space (0 = identical, 1+ = far). */
  drift: number;
};

export type ViewLayoutComparison = {
  views: string[];
  sharedNodes: string[];
  stabilityScore: number;
  averageDrift: number;
  nodeDrift: NodeLayoutDrift[];
  diagnostics: Diagnostic[];
};

/** Compare normalized node centers across model views that share topology. */
export function compareViewLayouts(snapshots: ViewLayoutSnapshot[]): ViewLayoutComparison {
  const views = snapshots.map((snapshot) => snapshot.viewName);
  const diagnostics: Diagnostic[] = [];

  if (snapshots.length < 2) {
    diagnostics.push({
      severity: "warning",
      code: "FM238",
      message: "Layout comparison requires at least two model views",
      range: QUALITY_RANGE,
      hint: "Add another `view` block or omit --compare-layouts.",
    });
    return {
      views,
      sharedNodes: [],
      stabilityScore: 1,
      averageDrift: 0,
      nodeDrift: [],
      diagnostics,
    };
  }

  const normalizedByView = snapshots.map((snapshot) => ({
    viewName: snapshot.viewName,
    positions: normalizedCenters(snapshot.layout),
  }));

  const sharedNodes = [...normalizedByView[0]!.positions.keys()].filter((nodeId) =>
    normalizedByView.every((view) => view.positions.has(nodeId)),
  );

  if (sharedNodes.length === 0) {
    diagnostics.push({
      severity: "warning",
      code: "FM239",
      message: "No shared nodes across compared views — stability score is not meaningful",
      range: QUALITY_RANGE,
      hint: "Compare views that include overlapping elements (for example context and containers).",
    });
    return {
      views,
      sharedNodes: [],
      stabilityScore: 0,
      averageDrift: 1,
      nodeDrift: [],
      diagnostics,
    };
  }

  const reference = normalizedByView[0]!;
  const nodeDrift: NodeLayoutDrift[] = sharedNodes.map((nodeId) => {
    const anchor = reference.positions.get(nodeId)!;
    let total = 0;
    for (let index = 1; index < normalizedByView.length; index++) {
      const point = normalizedByView[index]!.positions.get(nodeId)!;
      total += distance(anchor, point);
    }
    return { nodeId, drift: Number((total / (normalizedByView.length - 1)).toFixed(3)) };
  });

  const averageDrift =
    nodeDrift.reduce((sum, entry) => sum + entry.drift, 0) / Math.max(1, nodeDrift.length);
  const stabilityScore = Number(Math.max(0, 1 - averageDrift).toFixed(3));

  if (stabilityScore < 0.55) {
    diagnostics.push({
      severity: "warning",
      code: "view-layout-instability",
      message: `Shared nodes drift ${(averageDrift * 100).toFixed(0)}% across views (stability ${stabilityScore})`,
      range: QUALITY_RANGE,
      hint: "Align layout direction, model order, or collapse rules so shared actors stay in similar relative positions.",
    });
  }

  const unstable = nodeDrift.filter((entry) => entry.drift >= 0.35).map((entry) => entry.nodeId);
  if (unstable.length > 0 && stabilityScore < 0.75) {
    diagnostics.push({
      severity: "info",
      code: "view-node-drift",
      message: `Highest drift: ${unstable.slice(0, 4).join(", ")}`,
      range: QUALITY_RANGE,
    });
  }

  return {
    views,
    sharedNodes,
    stabilityScore,
    averageDrift: Number(averageDrift.toFixed(3)),
    nodeDrift: nodeDrift.sort((a, b) => b.drift - a.drift),
    diagnostics,
  };
}

function normalizedCenters(layout: LayoutResult): Map<string, { x: number; y: number }> {
  const positions = new Map<string, { x: number; y: number }>();
  if (layout.nodes.length === 0) return positions;

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const node of layout.nodes) {
    minX = Math.min(minX, node.bounds.x);
    minY = Math.min(minY, node.bounds.y);
    maxX = Math.max(maxX, node.bounds.x + node.bounds.width);
    maxY = Math.max(maxY, node.bounds.y + node.bounds.height);
  }
  const width = Math.max(1, maxX - minX);
  const height = Math.max(1, maxY - minY);

  for (const node of layout.nodes) {
    positions.set(node.nodeId, {
      x: (node.bounds.x + node.bounds.width / 2 - minX) / width,
      y: (node.bounds.y + node.bounds.height / 2 - minY) / height,
    });
  }
  return positions;
}

function distance(a: { x: number; y: number }, b: { x: number; y: number }): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}
