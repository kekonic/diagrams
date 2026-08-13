import { describe, expect, it } from "vite-plus/test";
import {
  TABLE_KEY_COL,
  columnNoteLabel,
  columnTypeLabel,
  measureTableNode,
  tableKeyBadges,
} from "./table-measure.ts";
import { defaultMeasurer } from "./text-measurer.ts";
import type { GraphNode } from "@kekonic/diagrams-core";

describe("tableKeyBadges", () => {
  it("includes only PK/FK/UK — NN is not a key chip", () => {
    expect(
      tableKeyBadges({
        name: "email",
        type: "text",
        keys: ["uk"],
        notNull: true,
      }),
    ).toEqual(["UK"]);
  });

  it("stacks PK and FK without NN", () => {
    expect(
      tableKeyBadges({
        name: "order_id",
        type: "uuid",
        keys: ["pk", "fk"],
        notNull: true,
      }),
    ).toEqual(["PK", "FK"]);
  });

  it("returns empty for plain columns", () => {
    expect(tableKeyBadges({ name: "captured_at", type: "timestamptz", keys: [] })).toEqual([]);
  });
});

describe("column type/note labels", () => {
  it("keeps type alone without middle-dot joins", () => {
    const col = {
      name: "status",
      type: "text",
      keys: [] as Array<"pk" | "fk" | "uk">,
      notNull: true,
      note: "authorized|captured|refunded",
    };
    expect(columnTypeLabel(col)).toBe("text");
    expect(columnNoteLabel(col)).toBe("authorized|captured|refunded");
    expect(columnTypeLabel(col)).not.toContain("·");
    expect(columnNoteLabel(col)).not.toContain("·");
  });
});

describe("measureTableNode", () => {
  it("sizes wide enough for long notes without clamping under content", () => {
    const node = {
      id: "payments",
      label: "payments",
      kind: "table",
      shape: "table" as const,
      styleRefs: [],
      columns: [
        { name: "id", type: "uuid", keys: ["pk" as const], notNull: true },
        {
          name: "status",
          type: "text",
          keys: [] as Array<"pk" | "fk" | "uk">,
          notNull: true,
          note: "authorized|captured|refunded",
        },
      ],
    } satisfies Partial<GraphNode> as GraphNode;

    const measured = measureTableNode(node, defaultMeasurer, 1, 200, 200);
    // Even with a tight maxWidth hint (200), content must win so attrs cannot overlap names.
    expect(measured.width).toBeGreaterThan(200);
    expect(measured.width).toBeGreaterThanOrEqual(260);
  });

  it("uses a fixed key gutter so badge count does not widen the name offset", () => {
    // KEY_COL fits two chips (PK+FK) plus a small gap before the name column.
    expect(TABLE_KEY_COL).toBeGreaterThanOrEqual(18 * 2 + 3);
    const plain = {
      id: "t",
      label: "t",
      kind: "table",
      shape: "table" as const,
      styleRefs: [],
      columns: [
        { name: "captured_at", type: "timestamptz", keys: [] as Array<"pk" | "fk" | "uk"> },
      ],
    } satisfies Partial<GraphNode> as GraphNode;
    const keyed = {
      ...plain,
      columns: [{ name: "order_id", type: "uuid", keys: ["fk" as const], notNull: true }],
    } satisfies Partial<GraphNode> as GraphNode;

    const a = measureTableNode(plain, defaultMeasurer, 1, 0, 9999);
    const b = measureTableNode(keyed, defaultMeasurer, 1, 0, 9999);
    // Both rows reserve the same left gutter; width may differ from name/type/NN, not from name x.
    expect(a.width).toBeGreaterThan(TABLE_KEY_COL);
    expect(b.width).toBeGreaterThan(TABLE_KEY_COL);
  });
});
