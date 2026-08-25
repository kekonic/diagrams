/**
 * Arrow tips must sit on the outer node stroke, not inside the fill.
 * Regression: dashed `..>` (dependency) used to skip marker-length trim.
 */
import { describe, expect, it } from "vite-plus/test";
import {
  DEFAULT_STROKE_WIDTH,
  normalizeShapeId,
  resolveShapeGeometry,
  strokeOutset,
} from "@kekonic/diagrams-geometry";
import {
  ARROW_MARKER_TIP_OVERHANG,
  type RenderedEdgeSegment,
  type TreatedEdge,
} from "@kekonic/diagrams-routing";
import type { GraphModel, Point } from "@kekonic/diagrams-core";
import type { LayoutResult } from "@kekonic/diagrams-layout";
import { compileSource, layoutFromGraph, routeFromLayout } from "./pipeline/render.ts";

const LR = `diagram "Arrow attach" {
  direction LR
  edges { route: orthogonal }
  left: service "Left"
  port: interface "OrderRepositoryPort" {
    subtitle: "Outbound Port"
  }
  right: component "Right"
  hex: hexagon "Gateway"
  left ..> port
  right ..> port
  left -> port "solid"
  left => hex
}
`;

const TD = `diagram "Vertical attach" {
  direction TD
  edges { route: orthogonal }
  north: service "North"
  south: database "South"
  hub: service "Hub"
  north ..> hub
  south -> hub
}
`;

const BOTH = `diagram "Bidirectional" {
  direction LR
  edges { route: orthogonal }
  a: service "A"
  b: service "B"
  a <-> b
}
`;

function lastStroke(edge: TreatedEdge): RenderedEdgeSegment | undefined {
  for (let i = edge.segments.length - 1; i >= 0; i--) {
    const seg = edge.segments[i]!;
    if (seg.type === "line" || seg.type === "cubic") return seg;
  }
  return undefined;
}

function firstStroke(edge: TreatedEdge): RenderedEdgeSegment | undefined {
  return edge.segments.find((seg) => seg.type === "line" || seg.type === "cubic");
}

function unitToward(from: Point, to: Point): Point {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const len = Math.hypot(dx, dy) || 1;
  return { x: dx / len, y: dy / len };
}

function markerTip(seg: RenderedEdgeSegment, side: "start" | "end"): Point {
  if (seg.type === "gap" || seg.type === "jump") {
    return side === "start" ? seg.from : seg.to;
  }
  if (side === "end") {
    const back = seg.type === "cubic" ? seg.c2 : seg.from;
    const facing = unitToward(back, seg.to);
    return {
      x: seg.to.x + facing.x * ARROW_MARKER_TIP_OVERHANG,
      y: seg.to.y + facing.y * ARROW_MARKER_TIP_OVERHANG,
    };
  }
  const ahead = seg.type === "cubic" ? seg.c1 : seg.to;
  const reverse = unitToward(ahead, seg.from);
  return {
    x: seg.from.x + reverse.x * ARROW_MARKER_TIP_OVERHANG,
    y: seg.from.y + reverse.y * ARROW_MARKER_TIP_OVERHANG,
  };
}

/**
 * Positive = tip is inside the fill (closer to center than the silhouette).
 * Outer stroke is `strokeOutset` outside the fill; a hairline inside is float noise.
 */
function fillPenetration(
  shapeId: string | undefined,
  bounds: { x: number; y: number; width: number; height: number },
  tip: Point,
): number {
  const geometry = resolveShapeGeometry(normalizeShapeId(shapeId));
  const cx = bounds.x + bounds.width / 2;
  const cy = bounds.y + bounds.height / 2;
  const hit = geometry.intersectRay(bounds, { x: cx, y: cy }, { x: tip.x - cx, y: tip.y - cy });
  if (!hit) return 0;
  return Math.hypot(hit.x - cx, hit.y - cy) - Math.hypot(tip.x - cx, tip.y - cy);
}

const MAX_INTERIOR_OVERLAP = strokeOutset(DEFAULT_STROKE_WIDTH) * 0.35;

function assertTipsClearFill(
  graph: GraphModel,
  layout: LayoutResult,
  treated: TreatedEdge[],
  label: string,
) {
  const nodeMap = new Map(layout.nodes.map((n) => [n.nodeId, n]));
  const graphNodes = new Map(graph.nodes.map((n) => [n.id, n]));

  for (const edge of graph.edges) {
    if (edge.kind === "association") continue;
    const treatedEdge = treated.find((t) => t.edgeId === edge.id);
    expect(treatedEdge, `${label} missing treated ${edge.id}`).toBeDefined();
    const arrows = edge.arrows ?? "end";
    const toLaid = nodeMap.get(edge.to);
    const fromLaid = nodeMap.get(edge.from);
    const toNode = graphNodes.get(edge.to);
    const fromNode = graphNodes.get(edge.from);

    if ((arrows === "end" || arrows === "both") && toLaid && toNode) {
      const seg = lastStroke(treatedEdge!);
      expect(seg, `${label} ${edge.id} last stroke`).toBeDefined();
      const tip = markerTip(seg!, "end");
      const inside = fillPenetration(toNode.shape, toLaid.bounds, tip);
      expect(
        inside,
        `${label} ${edge.id} end tip inside ${toNode.id} by ${inside.toFixed(2)}px @ ${tip.x.toFixed(1)},${tip.y.toFixed(1)}`,
      ).toBeLessThanOrEqual(MAX_INTERIOR_OVERLAP);
    }

    if ((arrows === "start" || arrows === "both") && fromLaid && fromNode) {
      const seg = firstStroke(treatedEdge!);
      expect(seg, `${label} ${edge.id} first stroke`).toBeDefined();
      const tip = markerTip(seg!, "start");
      const inside = fillPenetration(fromNode.shape, fromLaid.bounds, tip);
      expect(
        inside,
        `${label} ${edge.id} start tip inside ${fromNode.id} by ${inside.toFixed(2)}px @ ${tip.x.toFixed(1)},${tip.y.toFixed(1)}`,
      ).toBeLessThanOrEqual(MAX_INTERIOR_OVERLAP);
    }
  }
}

async function routedDiagram(source: string) {
  const compiled = compileSource(source);
  const layout = await layoutFromGraph(compiled.graph, compiled.layoutHints);
  const routed = routeFromLayout(compiled.graph, layout, compiled.routingHints);
  return { graph: compiled.graph, layout, treated: routed.treatedEdges };
}

describe("arrowhead attach", () => {
  it("keeps dashed and solid tips on the outer stroke for LR fan-in and hexagon", async () => {
    const { graph, layout, treated } = await routedDiagram(LR);
    assertTipsClearFill(graph, layout, treated, "lr");
  });

  it("keeps tips outside the fill on top and bottom approaches", async () => {
    const { graph, layout, treated } = await routedDiagram(TD);
    assertTipsClearFill(graph, layout, treated, "td");
  });

  it("trims both ends of bidirectional arrows", async () => {
    const { graph, layout, treated } = await routedDiagram(BOTH);
    assertTipsClearFill(graph, layout, treated, "both");
  });
});
