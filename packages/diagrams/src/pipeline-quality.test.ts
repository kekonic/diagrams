import { describe, expect, it } from "vite-plus/test";
import { compileSource, renderPipeline } from "./pipeline/render.ts";
import { applyCrossingTreatment } from "@kekonic/diagrams-routing";
import type { RoutedEdge } from "@kekonic/diagrams-routing";
import type { Point } from "@kekonic/diagrams-core";
import { edgeStrokePath } from "@kekonic/diagrams-render-svg";
import { renderSvg } from "@kekonic/diagrams-render-svg";
import { segmentHitsAabb } from "@kekonic/diagrams-routing";

function segmentIntersection(a1: Point, a2: Point, b1: Point, b2: Point): Point | null {
  const d = (a2.x - a1.x) * (b2.y - b1.y) - (a2.y - a1.y) * (b2.x - b1.x);
  if (Math.abs(d) < 1e-6) return null;
  const t = ((b1.x - a1.x) * (b2.y - b1.y) - (b1.y - a1.y) * (b2.x - b1.x)) / d;
  const u = ((b1.x - a1.x) * (a2.y - a1.y) - (b1.y - a1.y) * (a2.x - a1.x)) / d;
  if (t > 0.05 && t < 0.95 && u > 0.05 && u < 0.95) {
    return { x: a1.x + t * (a2.x - a1.x), y: a1.y + t * (a2.y - a1.y) };
  }
  return null;
}

function routedEdgesCross(edges: RoutedEdge[]): boolean {
  const segments = edges.flatMap((e) => e.segments);
  for (let i = 0; i < segments.length; i++) {
    for (let j = i + 1; j < segments.length; j++) {
      const a = segments[i]!;
      const b = segments[j]!;
      if (segmentIntersection(a.from, a.to, b.from, b.to)) return true;
    }
  }
  return false;
}

describe("pipeline quality — route modes", () => {
  it("renders first-class state initial and final notation", async () => {
    const result = await renderPipeline(`state "Lifecycle" {
      entry: initial "Start"
      active: state "Active"
      done: final "Done"
      entry -> active
      active -> done "finish"
    }`);
    expect(result.ok).toBe(true);
    expect(result.graph?.diagramKind).toBe("state");
    expect(result.svg).toContain('class="flow-state-initial"');
    expect(result.svg).toContain('class="flow-state-final"');
  });

  it("warns when a composed canvas is extremely panoramic", async () => {
    const result = await renderPipeline(`diagram "Panorama" {
      direction LR
      layout { arrange: row }
      a: process "A"
      b: process "B"
      c: process "C"
      d: process "D"
      e: process "E"
      f: process "F"
      g: process "G"
      a -> b
      b -> c
      c -> d
      d -> e
      e -> f
      f -> g
    }`);
    expect(result.ok).toBe(true);
    expect(
      result.diagnostics.some((diagnostic) => diagnostic.code === "extreme-aspect-ratio"),
    ).toBe(true);
  });

  const base = `diagram "Routes" {
    direction LR
    a: service "A"
    b: service "B"
    a -> b
  }`;

  it("renders bezier edges with cubic curve commands", async () => {
    const result = await renderPipeline(base, { edges: { route: "bezier" } });
    expect(result.ok).toBe(true);
    expect(result.svg).toMatch(/\bC\s+[\d.-]+/);
    const edge = result.routing?.edges[0];
    expect(edge?.cubics?.length).toBeGreaterThanOrEqual(1);
    expect(edge?.points[0]).toEqual(edge?.cubics?.[0]?.from);
  });

  it("straightens a clear A→B corridor onto the port anchors", async () => {
    const result = await renderPipeline(base, { edges: { route: "straight" } });
    expect(result.ok).toBe(true);
    const edge = result.routing?.edges[0];
    expect(edge?.points.length).toBe(2);
    expect(result.svg).toMatch(/\bL\s+[\d.-]+/);
    expect(result.svg).not.toMatch(/\bQ\s+[\d.-]+/);
  });

  it("keeps a straight dogleg instead of punching a node between endpoints", async () => {
    const result = await renderPipeline(
      `diagram "Blocked" {
        direction LR
        a: service "A"
        mid: service "Mid"
        c: service "C"
        a -> mid
        mid -> c
        a -> c
      }`,
      { edges: { route: "straight" } },
    );
    expect(result.ok).toBe(true);
    const graph = result.graph!;
    const ac = graph.edges.find((e) => e.from === "a" && e.to === "c")!;
    const routed = result.routing!.edges.find((e) => e.edgeId === ac.id)!;
    const mid = result.layout!.nodes.find((n) => n.nodeId === "mid")!.bounds;
    for (const seg of routed.segments) {
      expect(segmentHitsAabb(seg.from, seg.to, mid)).toBe(false);
    }
  });

  it("keeps metro as organic cubics with port ease", async () => {
    const result = await renderPipeline(base, { edges: { route: "metro" } });
    expect(result.ok).toBe(true);
    const edge = result.routing?.edges[0];
    expect(edge?.cubics?.length).toBeGreaterThanOrEqual(1);
    expect(result.svg).toMatch(/\bC\s+[\d.-]+/);
  });

  it("produces identical straight and bezier geometry for the same source", async () => {
    const src = `diagram "Det" {
      direction LR
      a: service "A"
      b: service "B"
      c: service "C"
      a -> b
      b -> c
      a -> c "skip"
    }`;
    const a = await renderPipeline(src, { edges: { route: "bezier" } });
    const b = await renderPipeline(src, { edges: { route: "bezier" } });
    expect(a.svg).toBe(b.svg);
    const s1 = await renderPipeline(src, { edges: { route: "straight" } });
    const s2 = await renderPipeline(src, { edges: { route: "straight" } });
    expect(s1.svg).toBe(s2.svg);
  });

  it("renders rounded edges with cubic corner commands", async () => {
    const treated = [
      {
        edgeId: "e1",
        segments: [
          { type: "line" as const, from: { x: 0, y: 0 }, to: { x: 100, y: 0 } },
          { type: "line" as const, from: { x: 100, y: 0 }, to: { x: 100, y: 80 } },
        ],
      },
    ];
    const svg = renderSvg({
      graph: {
        id: "t",
        nodes: [],
        edges: [{ id: "e1", from: "a", to: "b", kind: "sync", styleRefs: [] }],
        groups: [],
        styles: [],
        diagnostics: [],
      },
      layout: {
        nodes: [],
        groups: [],
        edgePaths: [],
        edgeLabels: [],
        direction: "LR",
        algorithmVersion: "elk-layered-v1",
        layoutMs: 0,
        width: 200,
        height: 120,
      },
      measured: [],
      treatedEdges: treated,
      labels: [],
      options: { theme: "dark" },
      routingOptions: { route: "rounded", cornerRadius: 10 },
    });
    expect(svg).toMatch(/\bC\s+[\d.-]+/);
  });

  it("renders metro edges with organic cubics", async () => {
    const path = edgeStrokePath(
      [
        { type: "line", from: { x: 0, y: 0 }, to: { x: 80, y: 0 } },
        { type: "line", from: { x: 80, y: 0 }, to: { x: 80, y: 60 } },
      ],
      { route: "metro" },
    );
    expect(path).toMatch(/\bC\s+[\d.-]+/);
  });

  it("compiles cornerRadius, parallel, and arrowheads from edges policy", () => {
    const compiled = compileSource(`diagram "T" {
      edges { cornerRadius: 12 parallel: separate arrowheads: false }
      a: service "A" b: service "B" a -> b
    }`);
    expect(compiled.routingHints.cornerRadius).toBe(12);
    expect(compiled.routingHints.parallel).toBe("separate");
    expect(compiled.routingHints.arrowheads).toBe(false);
  });

  it("omits arrowheads when arrowheads policy is false", async () => {
    const result = await renderPipeline(base, { edges: { arrowheads: false } });
    expect(result.svg).not.toMatch(/<polygon[^>]*points=/);
  });
});

describe("pipeline quality — compiled node/edge props", () => {
  it("compiles note onto GraphNode and renders it", async () => {
    const src = `diagram "T" { a: service "A" { note: "Handles checkout" } }`;
    const result = await renderPipeline(src);
    expect(result.graph?.nodes[0]?.note).toBe("Handles checkout");
    expect(result.svg).toContain("Handles checkout");
  });

  it("compiles priority onto GraphEdge", async () => {
    const src = `diagram "T" { a: service "A" b: service "B" a -> b { priority: high } }`;
    const compiled = compileSource(src);
    expect(compiled.graph.edges[0]?.priority).toBe("high");
  });

  it("compiles render shadows hint", async () => {
    const compiled = compileSource(`diagram "T" {
      render { shadows: false }
      a: service "A"
    }`);
    expect(compiled.renderHints.shadows).toBe(false);
  });

  it("compiles group padding hint", async () => {
    const compiled = compileSource(`diagram "T" {
      group app "App" {
        padding: 56
        a: service "A"
      }
    }`);
    expect(compiled.graph.groups[0]?.paddingHint).toBe("56");
  });
});

describe("pipeline quality — crossing lab", () => {
  const source = `diagram "Crossing" {
  direction LR
  edges {
    route: straight
    crossings: smart
    parallel: shared
  }
  a: service "A"
  b: service "B"
  c: service "C"
  d: service "D"
  a -> c
  b -> d
}
`;

  it("compiles crossing-lab straight/smart/shared edge policy", async () => {
    const compiled = compileSource(source);
    expect(compiled.routingHints.route).toBe("straight");
    expect(compiled.routingHints.crossings).toBe("smart");
    expect(compiled.routingHints.parallel).toBe("shared");
  });

  it("renders crossing-lab fixture without errors", async () => {
    const result = await renderPipeline(source);
    expect(result.ok).toBe(true);
    expect(result.routing?.edges).toHaveLength(2);
  });

  it("renders jump arcs in smart mode when routed segments cross", async () => {
    const crossing: RoutedEdge[] = [
      {
        edgeId: "e1",
        points: [
          { x: 48, y: 48 },
          { x: 240, y: 238 },
        ],
        segments: [{ from: { x: 48, y: 48 }, to: { x: 240, y: 238 } }],
      },
      {
        edgeId: "e2",
        points: [
          { x: 48, y: 238 },
          { x: 240, y: 48 },
        ],
        segments: [{ from: { x: 48, y: 238 }, to: { x: 240, y: 48 } }],
      },
    ];
    expect(routedEdgesCross(crossing)).toBe(true);
    const treated = applyCrossingTreatment(crossing, "smart");
    const svg = renderSvg({
      graph: {
        id: "cross",
        nodes: [],
        edges: [
          { id: "e1", from: "a", to: "d", kind: "sync", styleRefs: [] },
          { id: "e2", from: "b", to: "c", kind: "sync", styleRefs: [] },
        ],
        groups: [],
        styles: [],
        diagnostics: [],
      },
      layout: {
        nodes: [],
        groups: [],
        edgePaths: [],
        edgeLabels: [],
        direction: "LR",
        algorithmVersion: "elk-layered-v1",
        layoutMs: 0,
        width: 300,
        height: 300,
      },
      measured: [],
      treatedEdges: treated,
      labels: [],
      options: { theme: "dark" },
      routingOptions: { route: "straight" },
    });
    expect(svg).toMatch(/class="flow-edge-jump"/);
    expect(svg).toMatch(/\bQ\s+[\d.-]+/);
  });

  it("renders gap breaks (multiple path elements, no jump) in gaps mode", () => {
    const crossing: RoutedEdge[] = [
      {
        edgeId: "e1",
        points: [
          { x: 0, y: 50 },
          { x: 100, y: 50 },
        ],
        segments: [{ from: { x: 0, y: 50 }, to: { x: 100, y: 50 } }],
      },
      {
        edgeId: "e2",
        points: [
          { x: 50, y: 0 },
          { x: 50, y: 100 },
        ],
        segments: [{ from: { x: 50, y: 0 }, to: { x: 50, y: 100 } }],
      },
    ];
    const treated = applyCrossingTreatment(crossing, "gaps");
    const svg = renderSvg({
      graph: {
        id: "cross",
        nodes: [],
        edges: [
          { id: "e1", from: "a", to: "b", kind: "sync", styleRefs: [] },
          { id: "e2", from: "c", to: "d", kind: "sync", styleRefs: [] },
        ],
        groups: [],
        styles: [],
        diagnostics: [],
      },
      layout: {
        nodes: [],
        groups: [],
        edgePaths: [],
        edgeLabels: [],
        direction: "LR",
        algorithmVersion: "elk-layered-v1",
        layoutMs: 0,
        width: 200,
        height: 200,
      },
      measured: [],
      treatedEdges: treated,
      labels: [],
      options: { theme: "dark" },
    });
    const edgeGroups = svg.match(/<g class="flow-edge[\s\S]*?<\/g>/g) ?? [];
    const splitEdge = edgeGroups.find((g) => (g.match(/<path /g) ?? []).length > 1);
    expect(splitEdge).toBeTruthy();
    expect(splitEdge).not.toContain('class="flow-edge-jump"');
  });
});

describe("pipeline quality — shape and edge styling", () => {
  it("renders person silhouette for user kind by default", async () => {
    const result = await renderPipeline(`diagram "T" { u: user "Patron" }`);
    expect(result.svg).toContain("flow-node-user");
    expect(result.svg).toContain("flow-shape-person");
    expect(result.svg).not.toContain('id="flow-node-shadow"');
  });

  it("opts into rounded corners and shadows via render hints", async () => {
    const result = await renderPipeline(`diagram "T" {
      render { roundedCorners: true shadows: true }
      s: service "Checkout"
    }`);
    expect(result.svg).toMatch(/rx="12"/);
    expect(result.svg).toContain('id="flow-node-shadow"');
  });

  it("compiles roundedCorners render hint", () => {
    const compiled = compileSource(`diagram "T" {
      render { roundedCorners: true }
      a: service "A"
    }`);
    expect(compiled.renderHints.roundedCorners).toBe(true);
  });

  it("renders dashed external nodes", async () => {
    const result = await renderPipeline(`diagram "T" { x: external "Stripe" }`);
    expect(result.svg).toContain('stroke-dasharray="5 3.5"');
  });

  it("styles failure edges with danger color", async () => {
    const result = await renderPipeline(`diagram "T" { a: service "A" b: service "B" a -x b }`);
    expect(result.svg).toContain("flow-edge-failure");
    expect(result.svg).toContain('stroke="var(--kd-danger)"');
  });
});

describe("pipeline quality — API honesty", () => {
  it("returns routing in RenderResult", async () => {
    const result = await renderPipeline(`diagram "T" { a: service "A" b: service "B" a -> b }`);
    expect(result.routing?.edges).toHaveLength(1);
    expect(result.routing?.algorithmVersion).toBe("elk-orthogonal-v1");
  });
});

describe("pipeline quality — simple labeled edge routing", () => {
  it("keeps a two-node LR edge straight while still rendering the label", async () => {
    const source = `diagram "Hello KDiagram" {
  direction LR
  api: gateway "API"
  db: database "Postgres"
  api -> db "query"
}`;
    const result = await renderPipeline(source);
    expect(result.ok).toBe(true);
    const path = result.layout?.edgePaths[0];
    expect(path?.points).toHaveLength(2);
    expect(Math.abs((path?.points[0]?.y ?? 0) - (path?.points[1]?.y ?? 0))).toBeLessThan(1);
    // Treated geometry should stay a single segment (no rectangular label bump).
    expect(result.routing?.edges[0]?.points).toHaveLength(2);
    // Quoted edge labels render as authored ("query" stays "query").
    expect(result.svg).toMatch(/>query</);
  });

  it("preserves quoted camelCase edge labels verbatim in SVG", async () => {
    const source = `diagram "Events" {
  direction LR
  checkout: service "Checkout"
  bus: queue "Bus"
  checkout => bus "OrderPlaced"
  bus -> checkout "Order placed"
}`;
    const result = await renderPipeline(source);
    expect(result.ok).toBe(true);
    expect(result.svg).toContain(">OrderPlaced<");
    expect(result.svg).toContain(">Order placed<");
    expect(result.svg).not.toContain(">Orderplaced<");
  });

  it("renders edge label icons beside the text", async () => {
    const source = `diagram "Msg" {
  direction LR
  a: service "A"
  b: service "B"
  a => b "OrderPlaced" { icon: mail }
}`;
    const result = await renderPipeline(source);
    expect(result.ok).toBe(true);
    expect(result.svg).toContain("flow-edge-label-icon");
    expect(result.svg).toContain(">OrderPlaced<");
  });

  it("matches arrowheads to the edge stroke via context-stroke", async () => {
    const source = `diagram "Evt" {
  direction LR
  a: service "A"
  b: queue "B"
  a => b "ping"
}`;
    const result = await renderPipeline(source);
    expect(result.ok).toBe(true);
    expect(result.svg).toContain('id="flow-arrow"');
    expect(result.svg).toContain('fill="context-stroke"');
    expect(result.svg).toContain('marker-end="url(#flow-arrow)"');
    expect(result.svg).toContain("var(--kd-async-stroke)");
  });

  it("renders bidirectional arrows for <->", async () => {
    const source = `diagram "Both" {
  direction LR
  a: service "A"
  b: service "B"
  a <-> b
}`;
    const result = await renderPipeline(source);
    expect(result.ok).toBe(true);
    expect(result.svg).toContain('marker-start="url(#flow-arrow-start)"');
    expect(result.svg).toContain('marker-end="url(#flow-arrow)"');
  });

  it("paints edge endpoints when presentation.showEndpoints is on", async () => {
    const source = `diagram "Ends" {
  presentation { showEndpoints: true }
  direction LR
  a: service "A"
  b: service "B"
  a -> b
}`;
    const result = await renderPipeline(source);
    expect(result.ok).toBe(true);
    expect(result.svg).toMatch(/<circle class="flow-edge-endpoint"/);
    expect(result.svg).not.toMatch(/<circle class="flow-debug-port/);
  });

  it("skips group chrome when chrome: false and paints group icons", async () => {
    const source = `diagram "GroupChrome" {
  direction LR
  group plane {
    chrome: false
    arrange: row
    group aws "AWS" {
      icon: cloud
      a: service "A"
    }
    group bare {
      chrome: false
      b: service "B"
    }
  }
  a -> b
}`;
    const result = await renderPipeline(source);
    expect(result.ok).toBe(true);
    expect(result.svg).toContain('data-group-id="aws"');
    expect(result.svg).toContain("flow-group-label-icon");
    expect(result.svg).toContain('data-group-id="plane"');
    expect(result.svg).toContain("flow-group-chromeless");
    expect(result.svg).toMatch(/data-group-id="aws"[\s\S]*?flow-group-box/);
  });

  it("stages top-level nodes and groups together with diagram arrange", async () => {
    const source = `diagram "Staged" {
  direction LR
  layout { arrange: row }
  client: application "Client"
  group service {
    arrange: row
    port: interface "Port"
    handler: process "Handler"
  }
  adapter: component "Adapter"
  client -> port
  port -> handler
  handler -> adapter
}`;
    const result = await renderPipeline(source);
    expect(result.ok).toBe(true);
    const bounds = new Map(result.layout!.nodes.map((node) => [node.nodeId, node.bounds]));
    expect(bounds.get("client")!.x).toBeLessThan(bounds.get("port")!.x);
    expect(bounds.get("port")!.x).toBeLessThan(bounds.get("handler")!.x);
    expect(bounds.get("handler")!.x).toBeLessThan(bounds.get("adapter")!.x);
  });

  it("renders C4 technology and description on containers", async () => {
    const source = `diagram "C4" {
  direction LR
  api: container "API Application" {
    subtitle: true
    technology: "Spring Boot"
    description: "JSON API for banking"
  }
}`;
    const result = await renderPipeline(source);
    expect(result.ok).toBe(true);
    expect(result.svg).toContain("flow-node-container");
    expect(result.svg).toContain("flow-node-technology");
    expect(result.svg).toContain("Spring Boot");
    expect(result.svg).toContain("flow-node-description");
    expect(result.svg).toContain("JSON API for banking");
    expect(result.svg).toContain(">Container<");
  });

  it("renders C4 element types with distinct treatments", async () => {
    const source = `diagram "C4 types" {
  presentation { showKindSubtitles: true }
  customer: person "Customer" {
    description: "A shopper placing an order"
  }
  shop: system "Storefront" {
    description: "The system of interest"
  }
  ordersDb: container "Orders database" {
    technology: "PostgreSQL"
    description: "Stores orders"
    shape: cylinder
  }
  billing: external "Card network" {
    description: "Outside the enterprise"
  }
  pricing: component "Pricing" {
    description: "Quotes cart totals"
  }
}`;
    const result = await renderPipeline(source);
    expect(result.ok).toBe(true);
    expect(result.graph?.nodes.find((n) => n.id === "customer")?.icon).toBeUndefined();
    expect(result.graph?.nodes.find((n) => n.id === "ordersDb")?.kind).toBe("container");
    expect(result.graph?.nodes.find((n) => n.id === "ordersDb")?.shape).toBe("cylinder");
    expect(result.svg).toContain("flow-shape-person");
    expect(result.svg).toContain(">Person<");
    expect(result.svg).toContain(">Software System<");
    expect(result.svg).toContain(">External System<");
    expect(result.svg).toContain(">Component<");
    expect(result.svg).toContain("flow-node-system");
    expect(result.svg).toContain("flow-node-external");
    expect(result.svg).toContain("flow-node-container");
    expect(result.svg).toContain("flow-shape-cylinder");
  });
});

describe("edge path builder", () => {
  const elbow: RoutedEdge["segments"] = [
    { from: { x: 0, y: 0 }, to: { x: 100, y: 0 } },
    { from: { x: 100, y: 0 }, to: { x: 100, y: 80 } },
  ].map((s) => s);

  it("builds rounded corners for rounded mode", async () => {
    const path = edgeStrokePath(
      elbow.map((s) => ({ type: "line" as const, ...s })),
      { route: "rounded", cornerRadius: 8 },
    );
    expect(path).toContain("C");
  });

  it("builds cubic curves for bezier mode", async () => {
    const path = edgeStrokePath(
      elbow.map((s) => ({ type: "line" as const, ...s })),
      { route: "bezier" },
    );
    expect(path).toContain("C");
  });

  it("serializes cubic segments as C commands", () => {
    const path = edgeStrokePath(
      [
        {
          type: "cubic",
          from: { x: 0, y: 0 },
          c1: { x: 40, y: 0 },
          c2: { x: 80, y: 40 },
          to: { x: 80, y: 80 },
        },
      ],
      { route: "bezier" },
    );
    expect(path).toMatch(/^M 0 0 C 40 0 80 40 80 80$/);
  });
});

describe("crossing treatment on real routed geometry", () => {
  it("inserts jump segments when routed edges cross", async () => {
    const crossing: RoutedEdge[] = [
      {
        edgeId: "e1",
        points: [
          { x: 0, y: 50 },
          { x: 100, y: 50 },
        ],
        segments: [{ from: { x: 0, y: 50 }, to: { x: 100, y: 50 } }],
      },
      {
        edgeId: "e2",
        points: [
          { x: 50, y: 0 },
          { x: 50, y: 100 },
        ],
        segments: [{ from: { x: 50, y: 0 }, to: { x: 50, y: 100 } }],
      },
    ];
    const treated = applyCrossingTreatment(crossing, "jumps");
    expect(treated.flatMap((e) => e.segments).some((s) => s.type === "jump")).toBe(true);
  });
});
