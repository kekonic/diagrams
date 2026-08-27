import { describe, expect, it } from "vite-plus/test";
import { compile, parse } from "@kekonic/diagrams-core";
import { measureGraph } from "../../measure/measure.ts";
import { layoutAndRouteWithElk } from "./layout-with-elk.ts";

describe("region arrange layout", () => {
  it("includes ungrouped nodes in diagram-level tracks", async () => {
    const src = `diagram {
      direction LR
      layout { arrange: row }
      client: application "Client"
      group service {
        arrange: row
        port: interface "Inbound Port"
        handler: process "Handler"
      }
      adapter: component "Repository Adapter"
      store: database "Store"
      client -> port
      port -> handler
      handler -> adapter
      adapter -> store
    }`;
    const { graph, layoutHints } = compile(parse(src));
    const measured = measureGraph(graph);
    const { layout } = await layoutAndRouteWithElk(graph, measured.nodes, layoutHints);
    const client = layout.nodes.find((node) => node.nodeId === "client")!.bounds;
    const port = layout.nodes.find((node) => node.nodeId === "port")!.bounds;
    const handler = layout.nodes.find((node) => node.nodeId === "handler")!.bounds;
    const adapter = layout.nodes.find((node) => node.nodeId === "adapter")!.bounds;
    const store = layout.nodes.find((node) => node.nodeId === "store")!.bounds;

    expect(client.x).toBeLessThan(port.x);
    expect(port.x).toBeLessThan(handler.x);
    expect(handler.x).toBeLessThan(adapter.x);
    expect(adapter.x).toBeLessThan(store.x);
    expect(layout.edgePaths).toHaveLength(4);
  });

  it("stacks zones with shared width under align stretch", async () => {
    const src = `diagram {
      direction TD
      group system {
        arrange: stack
        gap: 72
        align: stretch
        zone web {
          a: service "Web"
        }
        zone api {
          b: gateway "API"
          c: service "Checkout"
        }
        zone data {
          d: database "DB"
        }
      }
      a -> b
      b -> d
    }`;
    const { graph, layoutHints } = compile(parse(src));
    const measured = measureGraph(graph);
    const { layout } = await layoutAndRouteWithElk(graph, measured.nodes, {
      ...layoutHints,
      direction: "TD",
    });

    const web = layout.groups.find((g) => g.groupId === "web");
    const api = layout.groups.find((g) => g.groupId === "api");
    const data = layout.groups.find((g) => g.groupId === "data");
    expect(web && api && data).toBeTruthy();
    expect(web!.bounds.width).toBe(api!.bounds.width);
    expect(api!.bounds.width).toBe(data!.bounds.width);
    expect(web!.bounds.x).toBe(api!.bounds.x);
    expect(api!.bounds.y).toBeGreaterThan(web!.bounds.y);
    expect(data!.bounds.y).toBeGreaterThan(api!.bounds.y);
    expect(layout.edgePaths.length).toBeGreaterThan(0);
  });

  it("places grid columns with core rowSpan", async () => {
    const src = `diagram {
      group platform {
        arrange: grid
        columns: [edge, core, data]
        rows: 2
        gap: 56
        zone edge {
          column: edge
          e: gateway "Edge"
        }
        zone core {
          column: core
          rowSpan: 2
          c: service "Core"
        }
        zone data {
          column: data
          d: database "DB"
        }
        zone ops {
          column: edge
          row: 2
          o: service "Ops"
        }
      }
      e -> c
      c -> d
    }`;
    const { graph, layoutHints } = compile(parse(src));
    const measured = measureGraph(graph);
    const { layout } = await layoutAndRouteWithElk(graph, measured.nodes, layoutHints);
    const edge = layout.groups.find((g) => g.groupId === "edge")!;
    const core = layout.groups.find((g) => g.groupId === "core")!;
    const data = layout.groups.find((g) => g.groupId === "data")!;
    const ops = layout.groups.find((g) => g.groupId === "ops")!;
    expect(edge.bounds.x).toBeLessThan(core.bounds.x);
    expect(core.bounds.x).toBeLessThan(data.bounds.x);
    expect(core.bounds.height).toBeGreaterThan(edge.bounds.height);
    expect(ops.bounds.y).toBeGreaterThan(edge.bounds.y);
    expect(ops.bounds.x).toBe(edge.bounds.x);
  });

  it("routes pack-wrapped siblings with a short vertical stub", async () => {
    // Parent arrange is required to enter the fixed-position arranged pipeline;
    // leaf pack wrap then places catalog under gateway (CELL_GAP=16).
    const src = `diagram {
      direction TD
      group system {
        arrange: stack
        group api {
          arrange: pack
          // Wide labels so gateway+checkout exceed pack maxRowW (~560) and catalog wraps.
          gateway: gateway "API Gateway Edge Service"
          checkout: service "Checkout Domain Service"
          catalog: service "Catalog"
        }
      }
      gateway -> checkout
      gateway -> catalog
    }`;
    const { graph, layoutHints } = compile(parse(src));
    const measured = measureGraph(graph);
    const { layout } = await layoutAndRouteWithElk(graph, measured.nodes, {
      ...layoutHints,
      direction: "TD",
    });

    const gw = layout.nodes.find((n) => n.nodeId === "gateway")!.bounds;
    const catalog = layout.nodes.find((n) => n.nodeId === "catalog")!.bounds;
    expect(catalog.y).toBeGreaterThan(gw.y + gw.height);
    expect(Math.abs(catalog.x - gw.x)).toBeLessThan(40);

    const modelEdge = graph.edges.find((e) => e.from === "gateway" && e.to === "catalog");
    expect(modelEdge).toBeTruthy();
    const edge = layout.edgePaths.find((e) => e.edgeId === modelEdge!.id);
    expect(edge).toBeTruthy();
    const pts = edge!.points;
    const start = pts[0]!;
    const end = pts[pts.length - 1]!;
    expect(Math.abs(start.y - (gw.y + gw.height))).toBeLessThan(2);
    expect(Math.abs(end.y - catalog.y)).toBeLessThan(2);
    let len = 0;
    for (let i = 1; i < pts.length; i++) {
      const a = pts[i - 1]!;
      const b = pts[i]!;
      len += Math.abs(b.x - a.x) + Math.abs(b.y - a.y);
    }
    expect(len).toBeLessThan(120);
  });

  it("top-aligns pack rows and keeps column x shared across wraps", async () => {
    const src = `diagram {
      direction TD
      group system {
        arrange: stack
        group people {
          arrange: pack
          tall: person "Operator"
          a: service "AlphaService"
          b: service "Beta"
          c: service "CharlieNode"
          d: service "Delta"
          e: service "EchoService"
          f: service "Foxtrot"
        }
      }
    }`;
    const { graph, layoutHints } = compile(parse(src));
    const measured = measureGraph(graph);
    const { layout } = await layoutAndRouteWithElk(graph, measured.nodes, {
      ...layoutHints,
      direction: "TD",
      density: "normal",
    });
    const byId = Object.fromEntries(layout.nodes.map((n) => [n.nodeId, n.bounds]));
    const person = byId.tall!;
    // No packed sibling should intersect the person box.
    for (const id of ["a", "b", "c", "d", "e", "f"]) {
      const b = byId[id];
      if (!b) continue;
      const overlapX = !(b.x + b.width <= person.x + 0.5 || b.x >= person.x + person.width - 0.5);
      const overlapY = !(b.y + b.height <= person.y + 0.5 || b.y >= person.y + person.height - 0.5);
      expect(overlapX && overlapY, `${id} overlaps person`).toBe(false);
    }
    // Top-align: siblings that share the person's row match its top edge.
    const sameRow = ["a", "b", "c", "d", "e", "f"].filter((id) => {
      const b = byId[id];
      return b && Math.abs(b.y - person.y) < 1;
    });
    expect(sameRow.length).toBeGreaterThan(0);

    // Column alignment: first items of each wrapped row share an x.
    const sorted = Object.entries(byId).sort((a, b) => a[1].y - b[1].y || a[1].x - b[1].x);
    const rowStarts = new Map<number, number>();
    for (const [, b] of sorted) {
      const key = Math.round(b.y);
      if (!rowStarts.has(key)) rowStarts.set(key, b.x);
    }
    const startXs = [...rowStarts.values()];
    expect(Math.max(...startXs) - Math.min(...startXs)).toBeLessThan(1);
  });

  it("translates nested arranged children when the parent stack moves", async () => {
    const src = `diagram {
      direction TD
      group root {
        arrange: stack
        gap: 56
        group top {
          arrange: pack
          a: service "Top"
        }
        group nested {
          arrange: grid
          columns: 2
          group left {
            arrange: pack
            b: service "Left"
            c: service "Right"
          }
          group right {
            arrange: pack
            d: service "Other"
            e: service "Peer"
          }
        }
      }
      b -> c
    }`;
    const { graph, layoutHints } = compile(parse(src));
    const measured = measureGraph(graph);
    const { layout } = await layoutAndRouteWithElk(graph, measured.nodes, {
      ...layoutHints,
      direction: "TD",
    });
    const top = layout.nodes.find((n) => n.nodeId === "a")!.bounds;
    const left = layout.nodes.find((n) => n.nodeId === "b")!.bounds;
    // Nested grid sits below the top band, not on top of it.
    expect(left.y).toBeGreaterThan(top.y + top.height);
    const edge = layout.edgePaths[0]!;
    let len = 0;
    for (let i = 1; i < edge.points.length; i++) {
      const p0 = edge.points[i - 1]!;
      const p1 = edge.points[i]!;
      len += Math.abs(p1.x - p0.x) + Math.abs(p1.y - p0.y);
    }
    expect(len).toBeLessThan(80);
  });

  it("keeps direct nodes inside an arranged parent in declaration order", async () => {
    const src = `diagram {
      direction TD
      group flow {
        arrange: stack
        gap: 40
        align: stretch
        a: service "Validate"
        zone mid {
          arrange: pack
          gap: 48
          b: service "Left"
          c: service "Right"
        }
        d: choice "Ok?"
        zone end {
          e: success "Done"
        }
      }
      a -> b
      a -> c
      b -> d
      c -> d
      d -> e
    }`;
    const { graph, layoutHints } = compile(parse(src));
    const measured = measureGraph(graph);
    const { layout } = await layoutAndRouteWithElk(graph, measured.nodes, {
      ...layoutHints,
      direction: "TD",
    });

    const parent = layout.groups.find((g) => g.groupId === "flow")!;
    const a = layout.nodes.find((n) => n.nodeId === "a")!.bounds;
    const d = layout.nodes.find((n) => n.nodeId === "d")!.bounds;
    const mid = layout.groups.find((g) => g.groupId === "mid")!.bounds;
    const end = layout.groups.find((g) => g.groupId === "end")!.bounds;

    const inside = (b: { x: number; y: number; width: number; height: number }) =>
      b.x >= parent.bounds.x - 0.5 &&
      b.y >= parent.bounds.y - 0.5 &&
      b.x + b.width <= parent.bounds.x + parent.bounds.width + 0.5 &&
      b.y + b.height <= parent.bounds.y + parent.bounds.height + 0.5;

    expect(inside(a)).toBe(true);
    expect(inside(d)).toBe(true);
    expect(inside(mid)).toBe(true);
    expect(a.y).toBeLessThan(mid.y);
    expect(mid.y + mid.height).toBeLessThan(d.y + 1);
    expect(d.y).toBeLessThan(end.y);
  });

  it("honors leaf pack gap between sibling nodes", async () => {
    const src = `diagram {
      group band {
        arrange: stack
        zone pack {
          arrange: pack
          gap: 64
          a: service "A"
          b: service "B"
        }
      }
    }`;
    const { graph, layoutHints } = compile(parse(src));
    const measured = measureGraph(graph);
    const { layout } = await layoutAndRouteWithElk(graph, measured.nodes, layoutHints);
    const a = layout.nodes.find((n) => n.nodeId === "a")!.bounds;
    const b = layout.nodes.find((n) => n.nodeId === "b")!.bounds;
    const gap = b.x - (a.x + a.width);
    expect(gap).toBeGreaterThanOrEqual(60);
  });

  it("keeps cross-column edges short instead of looping the platform perimeter", async () => {
    const src = `diagram {
      direction LR
      group platform {
        chrome: false
        arrange: row
        group left {
          arrange: stack
          a: service "Worker"
          b: service "Queue"
        }
        group mid {
          arrange: stack
          c: process "Validate"
          group band {
            arrange: pack
            d: process "Reserve"
            e: process "Pay"
          }
        }
        group right {
          arrange: stack
          f: external "Inventory"
          g: external "Payments"
        }
      }
      a -> c "run"
      d -> f "hold"
      e -> g "authorize"
    }`;
    const { graph, layoutHints } = compile(parse(src));
    const measured = measureGraph(graph);
    const { layout } = await layoutAndRouteWithElk(graph, measured.nodes, layoutHints);
    const pathLen = (id: string) => {
      const edge = graph.edges.find((e) => `${e.from}->${e.to}` === id || e.id === id);
      const key = edge?.id;
      const path = layout.edgePaths.find((p) => p.edgeId === key);
      expect(path).toBeTruthy();
      let len = 0;
      for (let i = 1; i < path!.points.length; i++) {
        const p0 = path!.points[i - 1]!;
        const p1 = path!.points[i]!;
        len += Math.abs(p1.x - p0.x) + Math.abs(p1.y - p0.y);
      }
      return len;
    };
    const run = graph.edges.find((e) => e.from === "a" && e.to === "c")!;
    const hold = graph.edges.find((e) => e.from === "d" && e.to === "f")!;
    const auth = graph.edges.find((e) => e.from === "e" && e.to === "g")!;
    // Direct column hops should stay near the facing gap — not a full perimeter tour.
    expect(pathLen(run.id)).toBeLessThan(500);
    expect(pathLen(hold.id)).toBeLessThan(500);
    expect(pathLen(auth.id)).toBeLessThan(500);
  });

  it("stacks decorative residual groups and centers them against the arranged core", async () => {
    const src = `diagram {
      direction LR
      customer: person "Customer"
      group platform {
        arrange: grid
        columns: 2
        zone core {
          column: 1
          api: service "API"
        }
        zone data {
          column: 2
          db: database "DB"
        }
      }
      group externals {
        chrome: false
        arrange: stack
        align: stretch
        stripe: external "Stripe"
        warehouse: external "Warehouse"
        email: external "Email"
      }
      customer -> api
      api -> stripe
      api -> warehouse
      api -> email
    }`;
    const { graph, layoutHints } = compile(parse(src));
    const measured = measureGraph(graph);
    const { layout } = await layoutAndRouteWithElk(graph, measured.nodes, layoutHints);
    const coreNodes = ["api", "db"].map((id) => layout.nodes.find((n) => n.nodeId === id)!.bounds);
    const coreBox = {
      x: Math.min(...coreNodes.map((b) => b.x)),
      y: Math.min(...coreNodes.map((b) => b.y)),
      width:
        Math.max(...coreNodes.map((b) => b.x + b.width)) - Math.min(...coreNodes.map((b) => b.x)),
      height:
        Math.max(...coreNodes.map((b) => b.y + b.height)) - Math.min(...coreNodes.map((b) => b.y)),
    };
    const externals = ["stripe", "warehouse", "email"].map(
      (id) => layout.nodes.find((n) => n.nodeId === id)!.bounds,
    );
    expect(externals[0]!.x).toBe(externals[1]!.x);
    expect(externals[1]!.x).toBe(externals[2]!.x);
    expect(externals[0]!.y + externals[0]!.height).toBeLessThan(externals[1]!.y + 1);
    expect(externals[1]!.y + externals[1]!.height).toBeLessThan(externals[2]!.y + 1);
    const extBox = {
      y: externals[0]!.y,
      height: externals[2]!.y + externals[2]!.height - externals[0]!.y,
    };
    const coreMid = coreBox.y + coreBox.height / 2;
    const extMid = extBox.y + extBox.height / 2;
    expect(Math.abs(coreMid - extMid)).toBeLessThan(24);
    expect(externals[0]!.x).toBeGreaterThan(coreBox.x + coreBox.width);
  });

  it("keeps architecture-icons catalog zones from overlapping", async () => {
    const { readFileSync } = await import("node:fs");
    const { dirname, join } = await import("node:path");
    const { fileURLToPath } = await import("node:url");
    const source = readFileSync(
      join(
        dirname(fileURLToPath(import.meta.url)),
        "../../../../../examples/architecture-icons.kdiagram",
      ),
      "utf8",
    );
    const { graph, layoutHints } = compile(parse(source));
    const measured = measureGraph(graph);
    const { layout } = await layoutAndRouteWithElk(graph, measured.nodes, layoutHints);
    const byId = Object.fromEntries(layout.nodes.map((n) => [n.nodeId, n.bounds]));
    const people = layout.groups.find((g) => g.groupId === "people")!.bounds;
    const brands = layout.groups.find((g) => g.groupId === "brands")!.bounds;
    expect(brands.y).toBeGreaterThan(people.y + people.height * 0.5);
    const overlap = (a: typeof people, b: typeof people) =>
      a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
    expect(overlap(byId.ada!, byId.aws!), "Ada overlaps AWS").toBe(false);
    expect(overlap(byId.clerk!, byId.pg!), "Clerk overlaps Postgres").toBe(false);
  });
});
