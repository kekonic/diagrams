import { describe, expect, it } from "vite-plus/test";
import { compile } from "../compiler/index.ts";
import { parse } from "../parser/index.ts";
import { formatSource } from "./print.ts";

describe("formatSource", () => {
  it("preserves the state diagram surface", () => {
    const formatted = formatSource(
      `state "Lifecycle" { entry: initial "Start" active: state "Active" done: final "Done" entry -> active active -> done "finish" }`,
    );
    expect(formatted).toContain('state "Lifecycle" {');
    expect(formatted).toContain('active: state "Active"');
  });

  it("keeps sequence parallel and alternate operands joined", () => {
    const formatted = formatSource(`sequence "S" {
  a: service "A"
  b: service "B"
  c: service "C"
  parallel "Left" is info {
    a -> b
  } and "Right" is info {
    a -> c
  }
  alternate "ok" is success {
    b -> c
  } else "fail" is danger {
    a -x c
  }
}`);
    expect(formatted).toContain('} and "Right" is info {');
    expect(formatted).toContain('} else "fail" is danger {');
    expect(formatSource(formatted)).toBe(formatted);
  });

  it("normalizes indentation and spacing", () => {
    const messy = `diagram "T" {
  a: service "A"
b: service "B"
  a -> b
}`;
    const formatted = formatSource(messy);
    expect(formatted).toContain('diagram "T" {');
    expect(formatted).toContain('  a: service "A"');
    expect(formatted).toContain('  b: service "B"');
    expect(formatted).toContain("  a -> b");
    expect(formatted.endsWith("\n")).toBe(true);
  });

  it("returns trimmed source on parse errors", () => {
    const bad = "not valid kdiagram {{{";
    expect(formatSource(bad)).toBe(bad + "\n");
  });

  it("preserves untitled diagrams without inventing a title", () => {
    const src = `diagram {
  a: service "A"
  b: service "B"
  a -> b
}
`;
    const formatted = formatSource(src);
    expect(formatted).toContain("diagram {");
    expect(formatted).not.toContain('diagram "');
    expect(formatted).toContain('  a: service "A"');
  });

  it("keeps direction and density shorthand valid after formatting", () => {
    const formatted = formatSource(`diagram "Settings" {
  direction LR
  density compact
  api: service "API"
}`);
    const compiled = compile(parse(formatted));

    expect(formatted).toContain("direction LR");
    expect(formatted).toContain("density compact");
    expect(compiled.layoutHints.direction).toBe("LR");
    expect(compiled.layoutHints.density).toBe("compact");
  });

  it("quotes free-text property values so formatting preserves their meaning", () => {
    const formatted = formatSource(`diagram "Presentation" {
  presentation {
    title: "Architecture icons"
    titleSubtitle: "Lucide names, prefixes, and brand logos"
  }
  api: service "API" { icon: "logos:aws" }
}`);
    const compiled = compile(parse(formatted));

    expect(formatted).toContain('title: "Architecture icons"');
    expect(formatted).toContain('titleSubtitle: "Lucide names, prefixes, and brand logos"');
    expect(formatted).toContain('icon: "logos:aws"');
    expect(compiled.renderHints.presentation?.title).toMatchObject({
      text: "Architecture icons",
      subtitle: "Lucide names, prefixes, and brand logos",
    });
  });

  it("pretty-prints ERD columns as a structured block", () => {
    const src = `diagram "ERD" {
  customers: table "customers" {
    columns: ["id PK uuid", "email text UK NN"]
  }
  orders: table "orders" {
    columns: ["id PK uuid", "customer_id FK uuid -> customers.id"]
  }
  customers.id -> orders.customer_id "1:N"
}
`;
    const formatted = formatSource(src);
    expect(formatted).toContain("columns {");
    expect(formatted).toContain("id: uuid PK");
    expect(formatted).toContain("email: text UK NN");
    expect(formatted).toContain("customer_id: uuid FK -> customers.id");
    expect(formatted).toContain('customers.id -> orders.customer_id "1:N"');
  });

  it("pretty-prints styles, StyleRef, edge is, and kdiagram header", () => {
    const src = `kdiagram 1
diagram "S" {
  style hot for edge { stroke: red }
  a: service "A"
  b: service "B"
  a, b is hot
  a -> b "go" is hot
  group plane {
    c: service "C"
  }
}
`;
    const formatted = formatSource(src);
    expect(formatted.startsWith("kdiagram 1\n")).toBe(true);
    expect(formatted).toContain("style hot for edge {");
    expect(formatted).toContain("a, b is hot");
    expect(formatted).toContain('a -> b "go" is hot');
    expect(formatted).toContain("group plane {");
    expect(formatted).not.toContain('group plane ""');
  });

  it("keeps an edge style after its property block", () => {
    const formatted = formatSource(`diagram "Styled edge" {
  a: service "A"
  b: service "B"
  a -> b "primary" { priority: high } is info
}
`);

    expect(formatted).toContain('a -> b "primary" { priority: high } is info');
    expect(compile(parse(formatted)).diagnostics).toEqual([]);
  });

  it("preserves one intentional blank line and collapses larger runs", () => {
    const formatted = formatSource(`diagram "Spacing" {
  a: service "A"

  b: service "B"



  c: service "C"
  a -> b
}
`);

    expect(formatted).toBe(`diagram "Spacing" {
  a: service "A"

  b: service "B"

  c: service "C"
  a -> b
}
`);
  });

  it("keeps one-property blocks inline and expands richer property blocks", () => {
    const formatted = formatSource(`diagram "Blocks" {
  layout {
    density: compact
  }
  render {}
  one: service "One" {
    icon: "logos:aws"
  }
  two: service "Two" { icon: server color: blue }
}
`);

    expect(formatted).toContain("  layout { density: compact }");
    expect(formatted).toContain("  render {}");
    expect(formatted).toContain('  one: service "One" { icon: "logos:aws" }');
    expect(formatted).toContain(`  two: service "Two" {
    icon: server
    color: blue
  }`);
  });

  it("keeps structural and table-column blocks multiline", () => {
    const formatted = formatSource(`diagram "Structure" {
  group api "API" {
    service: service "Service"
  }
  users: table "users" { columns: ["id PK uuid"] }
}
`);

    expect(formatted).toContain(`  group api "API" {
    service: service "Service"
  }`);
    expect(formatted).toContain(`  users: table "users" {
    columns {
      id: uuid PK
    }
  }`);
  });

  it("hoists diagram-wide policy without changing its precedence", () => {
    const formatted = formatSource(`diagram "Header" {
  api: service "API"
  presentation { title: auto }
  render { theme: light }
  edges { route: metro }
  density compact
  layout { direction: LR }
  direction TD
  api -> api
}
`);

    expect(formatted).toBe(`diagram "Header" {
  presentation { title: auto }
  render { theme: light }
  edges { route: metro }
  density compact
  layout { direction: LR }
  direction TD

  api: service "API"
  api -> api
}
`);
  });

  it("round-trips kdiagram 2 model views and collapse description", () => {
    const source = `kdiagram 2

model "Shop" {
  customer: person "Customer"
  boundary shop "Shop" {
    web: container "Web"
  }
  stripe: external "Stripe"
  customer -> web
  web -> stripe

  view context {
    intent { question: "Who uses the shop?" }
    include customer, shop, stripe
    collapse shop as platform: system "Shop platform" {
      description: "Handles checkout."
    }
    layout { direction: TD }
  }
}
`;
    const formatted = formatSource(source);
    expect(formatted).toContain('model "Shop" {');
    expect(formatted).toContain("view context {");
    expect(formatted).toContain('intent { question: "Who uses the shop?" }');
    expect(formatted).toContain(
      'collapse shop as platform: system "Shop platform" { description: "Handles checkout." }',
    );
    expect(formatSource(formatted)).toBe(formatted);
    const compiled = compile(parse(formatted), { view: "context" });
    expect(compiled.graph.nodes.map((node) => node.id).sort()).toEqual([
      "customer",
      "platform",
      "stripe",
    ]);
  });
});
