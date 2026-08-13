/**
 * Final quality pass: render representative diagrams and assert silhouette attach.
 * Writes SVGs under /opt/cursor/artifacts/geometry-quality when writable (visual review).
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vite-plus/test";
import { KDiagram } from "./index.ts";
import {
  attachPointOnPerimeter,
  normalizeShapeId,
  resolveShapeGeometry,
} from "@kekonic/diagrams-geometry";
import type { GraphModel, Point } from "@kekonic/diagrams-core";
import type { LayoutResult } from "@kekonic/diagrams-layout";

function resolveArtifactDir(): string {
  const preferred = "/opt/cursor/artifacts/geometry-quality";
  try {
    mkdirSync(preferred, { recursive: true });
    return preferred;
  } catch {
    const fallback = join(tmpdir(), "kdiagram-geometry-quality");
    mkdirSync(fallback, { recursive: true });
    return fallback;
  }
}

const OUT = resolveArtifactDir();

const CASES: Array<{ id: string; source: string }> = [
  {
    id: "geometry-kinds",
    source: `diagram "Geometry kinds" {
  direction LR
  r: rectangle "Rect"
  round: rounded "Rounded"
  p: pill "Pill"
  d: diamond "Diamond"
  h: hexagon "Hexagon"
  c: cylinder "Cylinder"
  cl: cloud "Cloud"
  para: parallelogram "IO"
  ell: ellipse "Ellipse"
  per: person "Actor"
  r -> round -> p
  d -> h -> c
  cl -> para -> ell
  per -> d
}`,
  },
  {
    id: "fan-in-out-hub",
    source: `diagram "Hub" {
  direction LR
  a: service "A"
  b: service "B"
  c: service "C"
  hub: service "Hub"
  d: service "D"
  e: service "E"
  a -> hub
  b -> hub
  c -> hub
  hub -> d
  hub -> e
}`,
  },
  {
    id: "choice-diamond",
    source: `diagram "Choice" {
  direction TD
  q: choice "In stock?"
  y: success "Ship"
  n: warning "Backorder"
  q -> y "yes"
  q -> n "no"
}`,
  },
  {
    id: "nonrect-fanout",
    source: `diagram "Nonrect fan" {
  direction LR
  gate: hexagon "Gateway"
  cloudN: cloud "AWS"
  db: cylinder "Orders"
  io: parallelogram "Scan"
  gate -> cloudN
  gate -> db
  gate -> io
}`,
  },
  {
    id: "mutual",
    source: `diagram "Mutual" {
  direction LR
  a: service "A"
  b: service "B"
  a -> b
  b -> a
}`,
  },
];

function nearSilhouette(
  shapeId: string | undefined,
  bounds: { x: number; y: number; width: number; height: number },
  point: Point,
  slack = 2.5,
): boolean {
  const geometry = resolveShapeGeometry(normalizeShapeId(shapeId));
  const cx = bounds.x + bounds.width / 2;
  const cy = bounds.y + bounds.height / 2;
  const hit = geometry.intersectRay(bounds, { x: cx, y: cy }, { x: point.x - cx, y: point.y - cy });
  if (!hit) return false;
  return Math.hypot(hit.x - point.x, hit.y - point.y) <= slack;
}

function assertLayoutAttach(caseId: string, graph: GraphModel, layout: LayoutResult) {
  const nodeMap = new Map(layout.nodes.map((n) => [n.nodeId, n]));
  const graphNodes = new Map(graph.nodes.map((n) => [n.id, n]));

  for (const path of layout.edgePaths) {
    const edge = graph.edges.find((e) => e.id === path.edgeId);
    if (!edge || path.points.length < 2) continue;
    if (edge.fromColumn || edge.toColumn) continue;

    const fromLaid = nodeMap.get(edge.from)!;
    const toLaid = nodeMap.get(edge.to)!;
    const fromNode = graphNodes.get(edge.from)!;
    const toNode = graphNodes.get(edge.to)!;
    const start = path.points[0]!;
    const end = path.points[path.points.length - 1]!;

    expect(
      nearSilhouette(fromNode.shape, fromLaid.bounds, start),
      `${caseId} ${edge.id} start off silhouette (${fromNode.shape ?? fromNode.kind}) @ ${start.x},${start.y}`,
    ).toBe(true);
    expect(
      nearSilhouette(toNode.shape, toLaid.bounds, end),
      `${caseId} ${edge.id} end off silhouette (${toNode.shape ?? toNode.kind}) @ ${end.x},${end.y}`,
    ).toBe(true);

    const p1 = path.points[1]!;
    const prev = path.points[path.points.length - 2]!;
    const start2 = attachPointOnPerimeter({
      shapeId: fromNode.shape,
      bounds: fromLaid.bounds,
      origin: p1,
      direction: { x: start.x - p1.x, y: start.y - p1.y },
    });
    const end2 = attachPointOnPerimeter({
      shapeId: toNode.shape,
      bounds: toLaid.bounds,
      origin: prev,
      direction: { x: end.x - prev.x, y: end.y - prev.y },
    });
    expect(Math.hypot(start2.x - start.x, start2.y - start.y)).toBeLessThan(1.5);
    expect(Math.hypot(end2.x - end.x, end2.y - end.y)).toBeLessThan(1.5);
  }
}

describe("geometry quality renders", () => {
  it("renders cases with silhouette-accurate edge attach", async () => {
    for (const c of CASES) {
      const rendered = await KDiagram.renderToSvg(c.source, {
        theme: "light",
        snapshotTheme: true,
        roundedCorners: true,
      });
      const svg = rendered.svg;
      expect(svg).toBeDefined();
      expect(svg!.length).toBeGreaterThan(200);
      expect(svg).toContain("<svg");
      expect(rendered.diagnostics.filter((d) => d.severity === "error")).toHaveLength(0);
      writeFileSync(join(OUT, `${c.id}.svg`), svg!, "utf8");

      const compiled = KDiagram.compile(c.source);
      const layout = await KDiagram.layout(compiled.graph, {
        direction: compiled.layoutHints.direction ?? "LR",
      });
      assertLayoutAttach(c.id, compiled.graph, layout);

      if (c.id === "fan-in-out-hub") {
        const hub = layout.nodes.find((n) => n.nodeId === "hub")!;
        const inbound = compiled.graph.edges
          .filter((e) => e.to === "hub")
          .map((e) => layout.edgePaths.find((p) => p.edgeId === e.id)!);
        const ys = inbound.map((p) => p.points[p.points.length - 1]!.y).sort((a, b) => a - b);
        expect(ys[ys.length - 1]! - ys[0]!).toBeGreaterThan(8);
        for (const y of ys) {
          expect(y).toBeGreaterThanOrEqual(hub.bounds.y - 2);
          expect(y).toBeLessThanOrEqual(hub.bounds.y + hub.bounds.height + 2);
        }
      }

      if (c.id === "choice-diamond") {
        const q = layout.nodes.find((n) => n.nodeId === "q")!;
        const outs = compiled.graph.edges
          .filter((e) => e.from === "q")
          .map((e) => layout.edgePaths.find((p) => p.edgeId === e.id)!);
        const xs = outs.map((p) => p.points[0]!.x).sort((a, b) => a - b);
        // South fan-out must leave SW/SE faces — not collapse onto the tip.
        expect(xs[xs.length - 1]! - xs[0]!).toBeGreaterThan(12);
        const tipX = q.bounds.x + q.bounds.width / 2;
        for (const x of xs) {
          expect(Math.abs(x - tipX)).toBeGreaterThan(4);
        }
      }

      if (c.id === "nonrect-fanout") {
        const gate = layout.nodes.find((n) => n.nodeId === "gate")!;
        const outs = compiled.graph.edges
          .filter((e) => e.from === "gate")
          .map((e) => layout.edgePaths.find((p) => p.edgeId === e.id)!);
        const ys = outs.map((p) => p.points[0]!.y).sort((a, b) => a - b);
        expect(ys[ys.length - 1]! - ys[0]!).toBeGreaterThan(8);
        for (const y of ys) {
          expect(y).toBeGreaterThanOrEqual(gate.bounds.y - 2);
          expect(y).toBeLessThanOrEqual(gate.bounds.y + gate.bounds.height + 2);
        }
      }
    }
  }, 30_000);
});
