import { describe, expect, it } from "vite-plus/test";
import {
  parseSource,
  compileSource,
  measureFromGraph,
  layoutMeasuredGraph,
  layoutFromGraph,
  routeLaidOutGraph,
  finalizeRoutedGraph,
  routeFromLayout,
  renderPipeline,
} from "./render.ts";

const SIMPLE = `diagram "Simple" {
  direction LR
  a: service "API"
  b: database "Postgres"
  a -> b "query"
}`;

describe("pipeline stage functions", () => {
  it("parseSource returns AST without errors for valid input", async () => {
    const result = parseSource(SIMPLE);
    expect(result.ast.body).toHaveLength(1);
    expect(result.diagnostics.filter((d) => d.severity === "error")).toHaveLength(0);
  });

  it("compileSource produces a graph and layout hints", async () => {
    const result = compileSource(SIMPLE);
    expect(result.graph.nodes).toHaveLength(2);
    expect(result.graph.edges).toHaveLength(1);
    expect(result.layoutHints.direction).toBe("LR");
  });

  it("measureFromGraph attaches topology analysis", async () => {
    const { graph } = compileSource(SIMPLE);
    const measured = measureFromGraph(graph);
    expect(measured.measured).toHaveLength(2);
    expect(measured.topology.direction).toBe("LR");
    expect(measured.topology.outgoing.get("a")).toBe(1);
    expect(measured.topology.incoming.get("b")).toBe(1);
  });

  it("layoutMeasuredGraph preserves measured graph fields", async () => {
    const { graph } = compileSource(SIMPLE);
    const measured = measureFromGraph(graph);
    const laidOut = await layoutMeasuredGraph(measured);
    expect(laidOut.layout.nodes).toHaveLength(2);
    expect(laidOut.layout.algorithmVersion).toBe("elk-layered-v1");
    expect(laidOut.measured).toEqual(measured.measured);
    expect(laidOut.topology).toEqual(measured.topology);
  });

  it("routeLaidOutGraph produces routed edges via ELK", async () => {
    const { graph, layoutHints } = compileSource(SIMPLE);
    const measured = measureFromGraph(graph, layoutHints.direction);
    const laidOut = await layoutMeasuredGraph(measured, layoutHints);
    const routed = routeLaidOutGraph(laidOut);
    expect(routed.routing.edges).toHaveLength(1);
    expect(routed.routing.edges[0]!.points.length).toBeGreaterThanOrEqual(2);
    expect(routed.routing.algorithmVersion).toBe("elk-orthogonal-v1");
  });

  it("finalizeRoutedGraph produces labels and treated edges", async () => {
    const { graph, layoutHints, routingHints } = compileSource(SIMPLE);
    const layout = await layoutFromGraph(graph, layoutHints);
    const routed = routeFromLayout(graph, layout, routingHints);
    const finalized = finalizeRoutedGraph({
      graph,
      measured: [],
      topology: measureFromGraph(graph).topology,
      layout,
      routing: routed.routing,
      diagnostics: [],
    });

    expect(finalized.labels).toHaveLength(1);
    expect(finalized.treatedEdges).toHaveLength(1);
  });

  it("renderPipeline short-circuits on compile errors", async () => {
    const result = await renderPipeline(`diagram "Bad" { a -> b }`);
    expect(result.ok).toBe(false);
    expect(result.stats.measureMs).toBe(0);
    expect(result.stats.layoutMs).toBe(0);
    expect(result.stats.routeMs).toBe(0);
    expect(result.stats.renderMs).toBe(0);
  });

  it("renderPipeline records phase timings and counts", async () => {
    const result = await renderPipeline(SIMPLE);
    expect(result.ok).toBe(true);
    expect(result.stats.nodeCount).toBe(2);
    expect(result.stats.edgeCount).toBe(1);
    expect(result.stats.layoutAlgorithm).toBe("elk-layered-v1");
    expect(result.stats.routerAlgorithm).toBe("elk-orthogonal-v1");
    expect(result.stats.totalMs).toBeGreaterThan(0);
  });
});
