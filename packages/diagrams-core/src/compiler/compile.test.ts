import { describe, expect, it } from "vite-plus/test";
import { parse } from "../parser/parser.ts";
import { compile } from "./compile.ts";

describe("compile", () => {
  it("compiles and validates state-machine semantics", () => {
    const result = compile(
      parse(`state "Order" {
        entry: initial "Start"
        pending: state "Pending"
        done: final "Done"
        entry -> pending
        pending -> done "complete"
      }`),
    );
    expect(result.graph.diagramKind).toBe("state");
    expect(result.layoutHints.direction).toBe("TD");
    expect(result.diagnostics).toHaveLength(0);

    const invalid = compile(
      parse(`state "Invalid" {
        entry: initial "Start"
        done: final "Done"
        done -> entry
      }`),
    );
    expect(invalid.diagnostics.some((diagnostic) => diagnostic.code === "FM152")).toBe(true);
    expect(invalid.diagnostics.some((diagnostic) => diagnostic.code === "FM154")).toBe(true);
  });

  it("reports FM100 when the document has no diagram", () => {
    const result = compile({ type: "Document", body: [], diagnostics: [] });
    expect(result.diagnostics.some((d) => d.code === "FM100" && d.severity === "error")).toBe(true);
    expect(result.graph.nodes).toHaveLength(0);
  });

  it("compiles untitled diagrams with no graph title", () => {
    const src = `diagram {
      a: service "A"
      b: service "B"
      a -> b
    }`;
    const result = compile(parse(src));
    expect(result.diagnostics.filter((d) => d.severity === "error")).toHaveLength(0);
    expect(result.graph.title).toBeUndefined();
    expect(result.graph.id).toBe("diagram");
    expect(result.graph.nodes).toHaveLength(2);
  });

  it("reports FM101 for duplicate node ids", () => {
    const src = `diagram "Dup" {
      a: service "One"
      a: service "Two"
    }`;
    const result = compile(parse(src));
    expect(result.diagnostics.some((d) => d.code === "FM101")).toBe(true);
    expect(result.graph.nodes).toHaveLength(1);
  });

  it("reports FM103 and FM104 for edges referencing missing nodes", () => {
    const src = `diagram "Bad" {
      a: service "A"
      missing -> a
      a -> also-missing
    }`;
    const result = compile(parse(src));
    expect(result.diagnostics.some((d) => d.code === "FM103")).toBe(true);
    expect(result.diagnostics.some((d) => d.code === "FM104")).toBe(true);
  });

  it("reports FM105 when a style ref targets an unknown node", () => {
    const src = `diagram "Style" {
      style highlight { --accent: red }
      missing is highlight
    }`;
    const result = compile(parse(src));
    expect(result.diagnostics.some((d) => d.code === "FM105")).toBe(true);
  });

  it("extracts layout, routing, and render hints from diagram blocks", () => {
    const src = `diagram "Hints" {
      direction TD
      density compact
      layout {
        groupLayout: compound
        nodePlacement: straight
        considerModelOrder: true
        groupGap: 80
        edgeNodeSpacing: 40
        edgeEdgeSpacing: 20
        edgeLabelSpacing: 12
        spacingScale: 1.2
      }
      edges {
        route rounded
        crossings gaps
        cornerRadius 12
      }
      render {
        theme light
      }
      a: service "A"
    }`;
    const result = compile(parse(src));
    expect(result.layoutHints.direction).toBe("TD");
    expect(result.layoutHints.density).toBe("compact");
    expect(result.layoutHints.groupLayout).toBe("compound");
    expect(result.layoutHints.nodePlacement).toBe("straight");
    expect(result.layoutHints.considerModelOrder).toBe(true);
    expect(result.layoutHints.groupGap).toBe(80);
    expect(result.layoutHints.edgeNodeSpacing).toBe(40);
    expect(result.layoutHints.edgeEdgeSpacing).toBe(20);
    expect(result.layoutHints.edgeLabelSpacing).toBe(12);
    expect(result.layoutHints.spacingScale).toBe(1.2);
    expect(result.routingHints.route).toBe("rounded");
    expect(result.routingHints.crossings).toBe("gaps");
    expect(result.routingHints.cornerRadius).toBe(12);
    expect(result.renderHints.theme).toBe("light");
  });

  it("errors FM112 for removed density aliases", () => {
    const result = compile(
      parse(`diagram {
      density roomy
      a: service "A"
    }`),
    );
    expect(result.diagnostics.some((d) => d.code === "FM112")).toBe(true);
    expect(result.layoutHints.density).toBeUndefined();
  });

  it("rejects obscure nodePlacement nicknames", () => {
    const src = `diagram "AliasPlace" {
      layout { nodePlacement: BRANDES_KOEPF }
      a: service "A"
    }`;
    expect(compile(parse(src)).layoutHints.nodePlacement).toBeUndefined();
  });

  it("compiles edge branch from label or explicit property", () => {
    const src = `diagram "Branches" {
      a: choice "A"
      b: service "B"
      c: service "C"
      d: service "D"
      a -> b "Yes"
      a -> c "No"
      a -> d "maybe" { branch: yes }
    }`;
    const { graph } = compile(parse(src));
    const byTo = Object.fromEntries(graph.edges.map((e) => [e.to, e]));
    expect(byTo.b?.branch).toBe("yes");
    expect(byTo.c?.branch).toBe("no");
    expect(byTo.d?.branch).toBe("yes");
  });

  it("marks quoted labels as authored and bare ids as derived", () => {
    const src = `diagram "Labels" {
      checkout: service "Checkout"
      bare: service
      group plane "Data plane" {
        bus: queue
      }
      checkout => bus "OrderPlaced"
    }`;
    const { graph } = compile(parse(src));
    const byId = Object.fromEntries(graph.nodes.map((n) => [n.id, n]));
    expect(byId.checkout?.labelAuthored).toBe(true);
    expect(byId.checkout?.label).toBe("Checkout");
    expect(byId.bare?.labelAuthored).toBe(false);
    expect(byId.bare?.label).toBe("bare");
    expect(graph.groups[0]?.labelAuthored).toBe(true);
    expect(graph.groups[0]?.label).toBe("Data plane");
    expect(graph.edges[0]?.labelAuthored).toBe(true);
    expect(graph.edges[0]?.label).toBe("OrderPlaced");
  });

  it("extracts presentation hints and warns on removed chrome props", () => {
    const src = `diagram "Chrome" {
      presentation {
        title: auto
        legend: true
        groupAccent: true
        preset: document
        grid: dots
      }
      render {
        theme: dark
      }
      a: service "A"
    }`;
    const result = compile(parse(src));
    expect(result.renderHints.presentation?.title).toBe("auto");
    expect(result.renderHints.presentation?.groupAccent).toBe(true);
    expect(result.renderHints.theme).toBe("dark");
    const removed = result.diagnostics.filter((d) => d.code === "FM210");
    expect(removed.length).toBeGreaterThanOrEqual(3);
  });

  it("maps edge operators to semantic kinds", () => {
    const src = `diagram "Kinds" {
      a: service "A"
      b: service "B"
      c: service "C"
      d: service "D"
      e: service "E"
      f: service "F"
      a -> b
      a => c
      a ..> d
      a -x b
      a ~> e
      a -- f
    }`;
    const { graph } = compile(parse(src));
    const byKind = Object.fromEntries(graph.edges.map((edge) => [edge.kind, edge.id]));
    expect(byKind.sync).toBeDefined();
    expect(byKind.async).toBeDefined();
    expect(byKind.dependency).toBeDefined();
    expect(byKind.failure).toBeDefined();
    expect(byKind.eventual).toBeDefined();
    expect(byKind.association).toBeDefined();
  });

  it("compiles reverse and bidirectional edge operators", () => {
    const src = `diagram "Dirs" {
      a: service "A"
      b: service "B"
      c: service "C"
      d: service "D"
      e: service "E"
      a <- b "from b"
      c <= d
      a <.. e
      a x- b
      a <-> c
    }`;
    const { graph, diagnostics } = compile(parse(src));
    expect(diagnostics.filter((d) => d.severity === "error")).toHaveLength(0);
    const fromB = graph.edges.find((e) => e.label === "from b");
    expect(fromB?.from).toBe("b");
    expect(fromB?.to).toBe("a");
    expect(fromB?.kind).toBe("sync");
    expect(fromB?.arrows).toBe("end");
    const event = graph.edges.find((e) => e.from === "d" && e.to === "c");
    expect(event?.kind).toBe("async");
    const dep = graph.edges.find((e) => e.from === "e" && e.to === "a");
    expect(dep?.kind).toBe("dependency");
    const fail = graph.edges.find((e) => e.from === "b" && e.to === "a" && e.kind === "failure");
    expect(fail).toBeDefined();
    const both = graph.edges.find((e) => e.from === "a" && e.to === "c");
    expect(both?.arrows).toBe("both");
  });

  it("compiles chromeless groups and group icons", () => {
    const src = `diagram "Groups" {
      group plane {
        chrome: false
        arrange: row
        group aws "AWS" {
          icon: logos:aws
          iconPaint: brand
          a: service "A"
        }
        group hidden {
          chrome: none
          b: service "B"
        }
      }
    }`;
    const { graph, diagnostics } = compile(parse(src));
    expect(diagnostics.filter((d) => d.severity === "error")).toHaveLength(0);
    const plane = graph.groups.find((g) => g.id === "plane");
    const aws = graph.groups.find((g) => g.id === "aws");
    const hidden = graph.groups.find((g) => g.id === "hidden");
    expect(plane?.chrome).toBe(false);
    expect(aws?.icon).toBe("logos:aws");
    expect(aws?.iconPaint).toBe("brand");
    expect(aws?.chrome).toBeUndefined();
    expect(hidden?.chrome).toBe(false);
  });

  it("compiles edge icon properties beside labels", () => {
    const src = `diagram "Icons" {
      a: service "A"
      b: service "B"
      c: service "C"
      a => b "OrderPlaced" { icon: mail; iconColor: #38bdf8 }
      a -> c { icon: send; iconPaint: theme }
    }`;
    const { graph } = compile(parse(src));
    const labeled = graph.edges.find((e) => e.to === "b");
    const iconOnly = graph.edges.find((e) => e.to === "c");
    expect(labeled?.icon).toBe("mail");
    expect(labeled?.iconColor).toBe("#38bdf8");
    expect(iconOnly?.icon).toBe("send");
    expect(iconOnly?.iconPaint).toBe("theme");
    expect(iconOnly?.label).toBeUndefined();
  });

  it("compiles edge labelPosition (and labelAt alias)", () => {
    const src = `diagram "Labels" {
      a: service "A"
      b: service "B"
      c: service "C"
      d: service "D"
      a -> b "near source" { labelPosition: start }
      b -> c "near target" { labelAt: end }
      c -> d "centered" { labelPosition: mid }
    }`;
    const { graph } = compile(parse(src));
    expect(graph.edges.find((e) => e.from === "a")?.labelPosition).toBe("start");
    expect(graph.edges.find((e) => e.from === "b")?.labelPosition).toBe("end");
    expect(graph.edges.find((e) => e.from === "c")?.labelPosition).toBe("middle");
  });

  it("compiles ERD table columns and relationship cardinality", () => {
    const src = `diagram "Schema" {
      customers: table "customers" {
        columns: [
          "id PK uuid",
          "email text UK NN"
        ]
      }
      orders: table "orders" {
        columns: [
          "id PK uuid",
          "customer_id FK uuid"
        ]
      }
      payments: table "payments" {
        columns: ["id PK uuid", "order_id FK uuid"]
      }
      customers -> orders "1:N"
      orders -> payments { cardinality: "1:0..N" }
    }`;
    const { graph, diagnostics } = compile(parse(src));
    expect(diagnostics.filter((d) => d.severity === "error")).toHaveLength(0);

    const customers = graph.nodes.find((n) => n.id === "customers");
    expect(customers?.shape).toBe("table");
    expect(customers?.columns).toHaveLength(2);
    expect(customers?.columns?.[0]).toEqual({
      name: "id",
      type: "uuid",
      keys: ["pk"],
    });
    expect(customers?.columns?.[1]?.keys).toEqual(["uk"]);
    expect(customers?.columns?.[1]?.notNull).toBe(true);

    const rel = graph.edges.find((e) => e.from === "customers" && e.to === "orders");
    expect(rel?.cardinality).toEqual({ from: "one", to: "oneOrMany" });
    expect(rel?.branch).toBeUndefined();

    const pay = graph.edges.find((e) => e.from === "orders" && e.to === "payments");
    expect(pay?.cardinality).toEqual({ from: "one", to: "zeroOrMany" });
  });

  it("compiles node.column endpoints and FK refs into anchored edges", () => {
    const src = `diagram "FK" {
      customers: table "customers" {
        columns: ["id PK uuid"]
      }
      orders: table "orders" {
        columns: [
          "id PK uuid",
          "customer_id FK uuid -> customers.id"
        ]
      }
      customers.id -> orders.customer_id
    }`;
    const { graph, diagnostics } = compile(parse(src));
    expect(diagnostics.filter((d) => d.severity === "error")).toHaveLength(0);
    const edge = graph.edges.find((e) => e.from === "customers" && e.to === "orders");
    expect(edge?.fromColumn).toBe("id");
    expect(edge?.toColumn).toBe("customer_id");
    // Nullable FK → optional parent participation (0..1 : 0..N).
    expect(edge?.cardinality).toEqual({ from: "zeroOrOne", to: "zeroOrMany" });
    expect(edge?.identifying).toBe(false);
    const fkCol = graph.nodes.find((n) => n.id === "orders")?.columns?.[1];
    expect(fkCol?.references).toEqual({ table: "customers", column: "id" });
  });

  it("auto-creates relationships from FK column refs alone", () => {
    const src = `diagram "AutoFK" {
      parent: table "parent" {
        columns: ["id PK uuid"]
      }
      child: table "child" {
        columns: [
          "id PK uuid",
          "parent_id FK uuid -> parent.id"
        ]
      }
    }`;
    const { graph } = compile(parse(src));
    const edge = graph.edges.find((e) => e.from === "parent" && e.to === "child");
    expect(edge).toBeTruthy();
    expect(edge?.fromColumn).toBe("id");
    expect(edge?.toColumn).toBe("parent_id");
    expect(edge?.cardinality).toEqual({ from: "zeroOrOne", to: "zeroOrMany" });
    expect(edge?.identifying).toBe(false);
  });

  it("compiles structured columns blocks with FK refs and notes", () => {
    const src = `diagram "BlockFK" {
      parent: table "parent" {
        columns {
          id: uuid PK
        }
      }
      child: table "child" {
        columns {
          id: uuid PK
          parent_id: uuid FK NN -> parent.id
          status: text NN // open|closed
        }
      }
    }`;
    const { graph, diagnostics } = compile(parse(src));
    expect(diagnostics.filter((d) => d.severity === "error")).toHaveLength(0);
    const child = graph.nodes.find((n) => n.id === "child");
    expect(child?.columns?.[1]).toMatchObject({
      name: "parent_id",
      type: "uuid",
      keys: ["fk"],
      notNull: true,
      references: { table: "parent", column: "id" },
    });
    expect(child?.columns?.[2]?.note).toBe("open|closed");
    const edge = graph.edges.find((e) => e.from === "parent" && e.to === "child");
    expect(edge?.fromColumn).toBe("id");
    expect(edge?.toColumn).toBe("parent_id");
    // NOT NULL FK → mandatory parent participation.
    expect(edge?.cardinality).toEqual({ from: "one", to: "zeroOrMany" });
  });

  it("uses mandatory parent cardinality when FK is NOT NULL", () => {
    const src = `diagram "NN" {
      parent: table "parent" {
        columns: ["id PK uuid"]
      }
      child: table "child" {
        columns: [
          "id PK uuid",
          "parent_id FK uuid NN -> parent.id"
        ]
      }
    }`;
    const { graph } = compile(parse(src));
    const edge = graph.edges.find((e) => e.from === "parent" && e.to === "child");
    expect(edge?.cardinality).toEqual({ from: "one", to: "zeroOrMany" });
  });

  it("creates separate edges for multiple FKs to the same table", () => {
    const src = `diagram "MultiFK" {
      users: table "users" {
        columns: ["id PK uuid"]
      }
      orders: table "orders" {
        columns: [
          "id PK uuid",
          "buyer_id FK uuid NN -> users.id",
          "seller_id FK uuid NN -> users.id"
        ]
      }
    }`;
    const { graph } = compile(parse(src));
    const edges = graph.edges.filter((e) => e.from === "users" && e.to === "orders");
    expect(edges).toHaveLength(2);
    expect(edges.map((e) => e.toColumn).sort((a, b) => (a ?? "").localeCompare(b ?? ""))).toEqual([
      "buyer_id",
      "seller_id",
    ]);
  });

  it("honors identifying: true as a solid relationship", () => {
    const src = `diagram "Ident" {
      a: table "a" { columns: ["id PK uuid"] }
      b: table "b" { columns: ["id PK uuid", "a_id FK uuid"] }
      a.id -> b.a_id { identifying: true }
    }`;
    const { graph } = compile(parse(src));
    const edge = graph.edges.find((e) => e.from === "a" && e.to === "b");
    expect(edge?.identifying).toBe(true);
  });

  it("reports FM107/FM108 for bad FK targets", () => {
    const src = `diagram "BadFK" {
      child: table "child" {
        columns: [
          "id PK uuid",
          "missing_id FK uuid -> nope.id",
          "bad_col FK uuid -> child.missing"
        ]
      }
    }`;
    const { diagnostics } = compile(parse(src));
    expect(diagnostics.some((d) => d.code === "FM107")).toBe(true);
    expect(diagnostics.some((d) => d.code === "FM108")).toBe(true);
  });

  it("keeps cylinder shape for table nodes without columns", () => {
    const src = `diagram "Arch" {
      outbox: table "Outbox"
    }`;
    const { graph } = compile(parse(src));
    expect(graph.nodes[0]?.shape).toBe("cylinder");
    expect(graph.nodes[0]?.columns).toBeUndefined();
  });

  it("leaves icons unset unless the author provides icon:", () => {
    const src = `diagram "IconsOff" {
      a: service "Checkout"
      b: database "Orders"
      c: choice "OK?"
    }`;
    const { graph } = compile(parse(src));
    expect(graph.nodes.map((n) => n.icon)).toEqual([undefined, undefined, undefined]);
  });

  it("applies authored icon names and treats icon: none as unset", () => {
    const src = `diagram "IconsOn" {
      a: service "Checkout" { icon: shopping-cart }
      b: database "Orders" { icon: lucide:database }
      c: service "Silent" { icon: none }
      d: person "Ada" { icon: person }
    }`;
    const { graph } = compile(parse(src));
    expect(graph.nodes.find((n) => n.id === "a")?.icon).toBe("shopping-cart");
    expect(graph.nodes.find((n) => n.id === "b")?.icon).toBe("lucide:database");
    expect(graph.nodes.find((n) => n.id === "c")?.icon).toBeUndefined();
    expect(graph.nodes.find((n) => n.id === "d")?.icon).toBe("person");
  });

  it("compiles iconPaint theme|brand onto nodes", () => {
    const src = `diagram "IconPaint" {
      a: service "AWS" { icon: logos:aws, iconPaint: theme }
      b: service "Postgres" { icon: logos:postgresql, iconPaint: brand }
      c: service "API" { icon: waypoints }
    }`;
    const { graph } = compile(parse(src));
    expect(graph.nodes.find((n) => n.id === "a")?.iconPaint).toBe("theme");
    expect(graph.nodes.find((n) => n.id === "b")?.iconPaint).toBe("brand");
    expect(graph.nodes.find((n) => n.id === "c")?.iconPaint).toBeUndefined();
  });

  it("applies kind catalog icon when icon is omitted (except person silhouettes)", () => {
    const src = `diagram "Defaults" {
      a: person "Operator"
      b: person "Silent" { icon: none }
      c: service "API"
      d: person "WithIcon" { icon: user }
      e: actor "Clerk"
    }`;
    const { graph } = compile(parse(src));
    expect(graph.nodes.find((n) => n.id === "a")?.icon).toBeUndefined();
    expect(graph.nodes.find((n) => n.id === "a")?.shape).toBe("person");
    expect(graph.nodes.find((n) => n.id === "b")?.icon).toBeUndefined();
    expect(graph.nodes.find((n) => n.id === "c")?.icon).toBeUndefined();
    expect(graph.nodes.find((n) => n.id === "d")?.icon).toBe("user");
    expect(graph.nodes.find((n) => n.id === "e")?.shape).toBe("rounded");
    expect(graph.nodes.find((n) => n.id === "e")?.icon).toBe("user");
  });

  it("compiles iconColor onto nodes as --icon-color", () => {
    const src = `diagram "IconColor" {
      a: service "Checkout" { icon: shopping-cart, iconColor: #f97316 }
      b: service "API" { icon: waypoints }
    }`;
    const { graph } = compile(parse(src));
    const a = graph.nodes.find((n) => n.id === "a");
    expect(a?.iconColor).toBe("#f97316");
    expect(a?.unresolvedVars?.["--icon-color"]).toBe("#f97316");
    expect(graph.nodes.find((n) => n.id === "b")?.iconColor).toBeUndefined();
  });

  it("compiles authored subtitle text and subtitle: true as kind eyebrow", () => {
    const src = `diagram "Subs" {
      a: service "Checkout" { subtitle: "Payments" }
      b: service "Inventory" { subtitle: true }
      c: service "Billing"
    }`;
    const { graph } = compile(parse(src));
    expect(graph.nodes.find((n) => n.id === "a")?.subtitle).toBe("Payments");
    expect(graph.nodes.find((n) => n.id === "a")?.showSubtitle).toBe(false);
    expect(graph.nodes.find((n) => n.id === "b")?.showSubtitle).toBe(true);
    expect(graph.nodes.find((n) => n.id === "b")?.subtitle).toBeUndefined();
    expect(graph.nodes.find((n) => n.id === "c")?.subtitle).toBeUndefined();
    expect(graph.nodes.find((n) => n.id === "c")?.showSubtitle).toBe(false);
  });

  it("compiles technology and description onto nodes", () => {
    const src = `diagram "C4" {
      api: container "API Application" {
        subtitle: true
        technology: "Java and Spring Boot"
        description: "Provides Internet banking via JSON/HTTPS"
      }
    }`;
    const { graph, diagnostics } = compile(parse(src));
    expect(diagnostics.filter((d) => d.severity === "error")).toHaveLength(0);
    const api = graph.nodes.find((n) => n.id === "api");
    expect(api?.shape).toBe("rounded");
    expect(api?.showSubtitle).toBe(true);
    expect(api?.technology).toBe("Java and Spring Boot");
    expect(api?.description).toBe("Provides Internet banking via JSON/HTTPS");
  });

  it("sizes C4 kinds with a readable hierarchy", () => {
    const src = `diagram "Sizes" {
      s: system "Sys"
      c: container "Box"
      p: component "Part"
      e: external "Ext"
    }`;
    const { graph } = compile(parse(src));
    const system = graph.nodes.find((n) => n.id === "s");
    const container = graph.nodes.find((n) => n.id === "c");
    const component = graph.nodes.find((n) => n.id === "p");
    expect(system?.minWidth).toBeGreaterThan(container?.minWidth ?? 0);
    expect(container?.minWidth).toBeGreaterThan(component?.minWidth ?? 0);
    expect(graph.nodes.find((n) => n.id === "e")?.shape).toBe("rectangle");
  });

  it("compiles region arrange hints on groups and layout block", () => {
    const src = `diagram "Regions" {
      layout {
        arrange: stack
        align: stretch
        gap: 72
      }
      group checkout {
        arrange: grid
        columns: [edge, core, data]
        rows: 2
        gap: 56
        align: stretch
        zone edge {
          column: edge
          api: gateway "API"
        }
        zone core {
          column: core
          rowSpan: 2
          svc: service "Core"
        }
        zone data {
          column: data
          db: database "DB"
        }
      }
    }`;
    const result = compile(parse(src));
    expect(result.layoutHints.arrange).toBe("stack");
    expect(result.layoutHints.align).toBe("stretch");
    expect(result.layoutHints.gap).toBe(72);
    const checkout = result.graph.groups.find((g) => g.id === "checkout");
    expect(checkout?.arrange).toBe("grid");
    expect(checkout?.columns).toEqual(["edge", "core", "data"]);
    expect(checkout?.rows).toBe(2);
    expect(checkout?.gap).toBe(56);
    const edge = result.graph.groups.find((g) => g.id === "edge");
    expect(edge?.column).toBe("edge");
    const core = result.graph.groups.find((g) => g.id === "core");
    expect(core?.column).toBe("core");
    expect(core?.rowSpan).toBe(2);
  });

  it("treats arrange: pack on a leaf zone as cellArrange", () => {
    const src = `diagram {
      zone pack {
        arrange: pack
        a: service "A"
        b: service "B"
      }
    }`;
    const { graph } = compile(parse(src));
    const zone = graph.groups.find((g) => g.id === "pack");
    expect(zone?.arrange).toBeUndefined();
    expect(zone?.cellArrange).toBe("pack");
  });

  it("records interleaved group members in declaration order", () => {
    const src = `diagram {
      group flow {
        arrange: stack
        a: service "A"
        zone mid {
          b: service "B"
        }
        c: choice "C"
      }
    }`;
    const { graph } = compile(parse(src));
    const flow = graph.groups.find((g) => g.id === "flow");
    expect(flow?.members).toEqual([
      { kind: "node", id: "a" },
      { kind: "group", id: "mid" },
      { kind: "node", id: "c" },
    ]);
  });

  it("compiles group shape, surround arrange, and node side", () => {
    const src = `diagram {
      group service {
        shape: hexagon
        arrange: surround
        group core {
          app: component "App"
        }
        api: component "API" { side: west }
        store: component "Store" { side: east }
      }
    }`;
    const { graph, diagnostics } = compile(parse(src));
    expect(diagnostics.filter((d) => d.severity === "error")).toHaveLength(0);
    const service = graph.groups.find((g) => g.id === "service");
    expect(service?.shape).toBe("hexagon");
    expect(service?.arrange).toBe("surround");
    expect(graph.nodes.find((n) => n.id === "api")?.side).toBe("west");
    expect(graph.nodes.find((n) => n.id === "store")?.side).toBe("east");
  });

  it("maps group shape round to circle and rejects unsupported group shapes", () => {
    const ok = compile(
      parse(`diagram {
        group g { shape: round; a: service "A" }
      }`),
    );
    expect(ok.graph.groups.find((g) => g.id === "g")?.shape).toBe("circle");

    const bad = compile(
      parse(`diagram {
        group g { shape: cylinder; a: service "A" }
      }`),
    );
    expect(bad.diagnostics.some((d) => d.code === "FM113")).toBe(true);
    expect(bad.graph.groups.find((g) => g.id === "g")?.shape).toBe("rectangle");
  });

  it("errors FM114 when surround lacks exactly one hub group", () => {
    const none = compile(
      parse(`diagram {
        group g {
          arrange: surround
          a: service "A"
        }
      }`),
    );
    expect(none.diagnostics.some((d) => d.code === "FM114")).toBe(true);

    const many = compile(
      parse(`diagram {
        group g {
          arrange: surround
          group a { x: service "X" }
          group b { y: service "Y" }
        }
      }`),
    );
    expect(many.diagnostics.some((d) => d.code === "FM114")).toBe(true);
  });

  it("allows nested surround layers and warns on bad side", () => {
    const nested = compile(
      parse(`diagram {
        group outer {
          shape: hexagon
          arrange: surround
          group inner {
            shape: circle
            arrange: surround
            group core { a: service "A" }
            port: interface "Port" { side: east }
          }
          adapter: component "Adapter" { side: west }
        }
      }`),
    );
    expect(nested.diagnostics.filter((d) => d.severity === "error")).toHaveLength(0);
    expect(nested.graph.groups.find((g) => g.id === "outer")?.arrange).toBe("surround");
    expect(nested.graph.groups.find((g) => g.id === "inner")?.shape).toBe("circle");

    const badSide = compile(
      parse(`diagram {
        group g {
          arrange: surround
          group hub { a: service "A" }
          b: service "B" { side: diagonal }
        }
      }`),
    );
    expect(badSide.diagnostics.some((d) => d.code === "FM115")).toBe(true);
    expect(badSide.graph.nodes.find((n) => n.id === "b")?.side).toBeUndefined();
  });
});
