import { describe, expect, it } from "vite-plus/test";
import { KDiagram } from "./index.ts";

const ERD = `diagram "ERD smoke" {
  direction LR
  customers: table "customers" {
    columns: [
      "id PK uuid",
      "email text UK"
    ]
  }
  orders: table "orders" {
    columns: [
      "id PK uuid",
      "customer_id FK uuid -> customers.id"
    ]
  }
}
`;

const ANCHORED = `diagram "Anchored" {
  direction LR
  a: table "a" {
    columns: ["id PK uuid"]
  }
  b: table "b" {
    columns: ["id PK uuid", "a_id FK uuid"]
  }
  a.id -> b.a_id "1:N"
}
`;

describe("ERD table diagramming", () => {
  it("renders dense table cards with FK-inferred column anchors", async () => {
    const result = await KDiagram.renderToSvg(ERD, { theme: "dark" });
    expect(result.ok).toBe(true);
    expect(result.svg).toBeTruthy();
    const svg = result.svg!;
    expect(svg).toContain("flow-table-shell");
    expect(svg).toContain("flow-table-border");
    expect(svg).toContain('stroke-width="1.5"');
    expect(svg).toContain("flow-table-col-name");
    expect(svg).toContain(">customers<");
    expect(svg).toContain(">customer_id<");
    expect(svg).toContain("flow-table-badge-pk");
    expect(svg).toContain("flow-table-badge-fk");
    expect(svg).toContain('id="flow-card-oneOrMany"');
    expect(svg).toContain("marker-start=");
    expect(svg).toContain("marker-end=");
    // Schema relationships use crow's-foot markers, not "fk → pk" text pills.
    expect(svg).not.toContain('class="flow-edge-label');
    // Non-identifying FK relationships are dashed
    expect(svg).toContain('stroke-dasharray="5 4"');
  });

  it("renders type and notes as separate attrs without middle-dot joins", async () => {
    const result = await KDiagram.renderToSvg(
      `diagram "Attrs" {
        payments: table "payments" {
          columns: [
            "id PK uuid NN",
            "status text NN // authorized|captured|refunded"
          ]
        }
      }`,
      { theme: "dark" },
    );
    expect(result.ok).toBe(true);
    const svg = result.svg!;
    expect(svg).not.toContain(" · ");
    // NN is a quiet type-side marker — not a leading key-gutter chip.
    expect(svg).toContain('class="flow-table-col-nn"');
    expect(svg).not.toContain("flow-table-badge-nn");
    expect(svg).toContain('class="flow-table-col-type"');
    expect(svg).toContain(">uuid<");
    expect(svg).toContain(">text<");
    expect(svg).toContain('class="flow-table-col-note"');
    expect(svg).toContain(">authorized|captured|refunded<");
    // Type/note cluster is clipped so it cannot paint over the field name.
    expect(svg).toMatch(/clipPath id="kd-table-attrs-payments-\d+"/);
    // All field names share the same x (fixed key gutter).
    const nameXs = [...svg.matchAll(/class="flow-table-col-name[^"]*"[^>]*\sx="([^"]+)"/g)].map(
      (m) => m[1],
    );
    expect(nameXs.length).toBe(2);
    expect(nameXs[0]).toBe(nameXs[1]);
  });

  it("anchors explicit node.column edges", async () => {
    const result = await KDiagram.renderToSvg(ANCHORED, { theme: "dark" });
    expect(result.ok).toBe(true);
    const edge = result.graph?.edges.find((e) => e.from === "a" && e.to === "b");
    expect(edge?.fromColumn).toBe("id");
    expect(edge?.toColumn).toBe("a_id");
    expect(edge?.cardinality).toEqual({ from: "one", to: "oneOrMany" });
    expect(result.svg).toContain("marker-end=");
  });

  it("keeps architecture table icons without columns as cylinders", async () => {
    const result = await KDiagram.renderToSvg(
      `diagram "Arch" {
        outbox: table "Outbox"
        bus: broker "Bus"
        outbox => bus
      }`,
      { theme: "dark" },
    );
    expect(result.ok).toBe(true);
    expect(result.svg).toContain("flow-node-shell-rim");
    expect(result.svg).toMatch(/<path d="M [\d.]+ [\d.]+ a /);
    // Cylinder path — no ERD card geometry (theme CSS may still name table classes).
    expect(result.svg).not.toMatch(/<rect class="flow-table-shell"/);
    expect(result.svg).not.toMatch(/class="flow-table-border"/);
  });

  it("uses unique table clip paths per node id", async () => {
    const result = await KDiagram.renderToSvg(ERD, { theme: "dark" });
    expect(result.ok).toBe(true);
    expect(result.svg).toContain('id="kd-table-clip-customers"');
    expect(result.svg).toContain('id="kd-table-clip-orders"');
  });

  it("renders identifying relationships without dash array", async () => {
    const result = await KDiagram.renderToSvg(
      `diagram "Ident" {
        a: table "a" { columns: ["id PK uuid"] }
        b: table "b" { columns: ["id PK uuid", "a_id FK uuid"] }
        a.id -> b.a_id { identifying: true, cardinality: "1:N" }
      }`,
      { theme: "dark" },
    );
    expect(result.ok).toBe(true);
    expect(result.graph?.edges[0]?.identifying).toBe(true);
    // No non-identifying dash on the relationship path group.
    expect(result.svg).not.toContain('stroke-dasharray="5 4"');
  });

  it("renders table notes and parameterized types", async () => {
    const result = await KDiagram.renderToSvg(
      `diagram "Notes" {
        customers: table "customers" {
          note: "Account holder"
          columns {
            id: uuid PK
            email: varchar(320) UK NN
          }
        }
      }`,
      { theme: "dark" },
    );
    expect(result.ok).toBe(true);
    expect(result.svg).toContain("flow-table-note");
    expect(result.svg).toContain(">Account holder<");
    expect(result.svg).toContain(">varchar(320)<");
  });

  it("keeps distinct endpoints for two FKs to the same parent key", async () => {
    const result = await KDiagram.renderToSvg(
      `diagram "Roles" {
        direction LR
        users: table "users" { columns { id: uuid PK } }
        orders: table "orders" {
          columns {
            id: uuid PK
            buyer_id: uuid FK NN -> users.id
            seller_id: uuid FK NN -> users.id
          }
        }
      }`,
      { theme: "dark" },
    );
    expect(result.ok).toBe(true);
    expect(result.graph?.edges).toHaveLength(2);
    const paths = [...result.svg!.matchAll(/class="flow-edge-path"[^>]*\sd="([^"]+)"/g)].map(
      (m) => m[1]!,
    );
    expect(paths.length).toBeGreaterThanOrEqual(2);
    const starts = paths.map((d) => {
      const nums = [...d.matchAll(/[-+]?\d*\.?\d+/g)].map(Number);
      return { x: nums[0]!, y: nums[1]! };
    });
    const startYs = starts.map((p) => p.y).sort((a, b) => a - b);
    expect(startYs[startYs.length - 1]! - startYs[0]!).toBeGreaterThan(2);
  });

  it("routes FK edges around stacked tables in TD without label/table overlap", async () => {
    const result = await KDiagram.renderToSvg(
      `diagram "Stacked ERD" {
        direction TD
        density compact
        a: table "a" { columns: ["id PK uuid"] }
        b: table "b" { columns: ["id PK uuid", "a_id FK uuid -> a.id"] }
        c: table "c" { columns: ["id PK uuid", "b_id FK uuid -> b.id"] }
      }`,
      { theme: "dark", layout: { direction: "TD" } },
    );
    expect(result.ok).toBe(true);
    expect(result.svg).toBeTruthy();

    // Assert on painted SVG (layout/routing are typed unknown on RenderResult).
    const tables = [
      ...result.svg!.matchAll(
        /flow-table-shell[^>]*\sx="([^"]+)"\sy="([^"]+)"\swidth="([^"]+)"\sheight="([^"]+)"/g,
      ),
    ].map((m) => ({
      x: Number(m[1]),
      y: Number(m[2]),
      width: Number(m[3]),
      height: Number(m[4]),
    }));
    expect(tables.length).toBe(3);

    const paths = [...result.svg!.matchAll(/class="flow-edge-path"[^>]*\sd="([^"]+)"/g)].map(
      (m) => m[1]!,
    );
    expect(paths.length).toBeGreaterThan(0);
    expect(result.svg).not.toContain('class="flow-edge-label');

    const eps = 0.75;
    for (const d of paths) {
      const nums = [...d.matchAll(/[-+]?\d*\.?\d+/g)].map(Number);
      const points: Array<{ x: number; y: number }> = [];
      for (let i = 0; i + 1 < nums.length; i += 2) {
        points.push({ x: nums[i]!, y: nums[i + 1]! });
      }
      for (let i = 0; i < points.length - 1; i++) {
        const a = points[i]!;
        const b = points[i + 1]!;
        for (const rect of tables) {
          const left = rect.x;
          const right = rect.x + rect.width;
          const top = rect.y;
          const bottom = rect.y + rect.height;
          if (Math.abs(a.y - b.y) < eps) {
            const y = a.y;
            if (y > top + eps && y < bottom - eps) {
              const x0 = Math.min(a.x, b.x);
              const x1 = Math.max(a.x, b.x);
              expect(x0 < right - eps && x1 > left + eps).toBe(false);
            }
          } else if (Math.abs(a.x - b.x) < eps) {
            const x = a.x;
            if (x > left + eps && x < right - eps) {
              const y0 = Math.min(a.y, b.y);
              const y1 = Math.max(a.y, b.y);
              expect(y0 < bottom - eps && y1 > top + eps).toBe(false);
            }
          }
        }
      }
    }
  });
});
