import { describe, expect, it } from "vite-plus/test";
import {
  formatTableColumnLine,
  inferFkRelationship,
  parseTableColumnSpec,
  parseTableColumns,
} from "./table.ts";

describe("parseTableColumnSpec", () => {
  it("parses name, keys, and type", () => {
    expect(parseTableColumnSpec("id PK uuid")).toEqual({
      name: "id",
      type: "uuid",
      keys: ["pk"],
    });
  });

  it("parses UK and NN flags", () => {
    expect(parseTableColumnSpec("email : text UK NN")).toEqual({
      name: "email",
      type: "text",
      keys: ["uk"],
      notNull: true,
    });
  });

  it("parses NOT NULL as two tokens", () => {
    expect(parseTableColumnSpec("email text NOT NULL")).toEqual({
      name: "email",
      type: "text",
      keys: [],
      notNull: true,
    });
  });

  it("parses FK without ref", () => {
    expect(parseTableColumnSpec("customer_id uuid FK")).toEqual({
      name: "customer_id",
      type: "uuid",
      keys: ["fk"],
    });
  });

  it("parses FK ref and note", () => {
    expect(parseTableColumnSpec("customer_id FK uuid -> customers.id // buyer")).toEqual({
      name: "customer_id",
      type: "uuid",
      keys: ["fk"],
      references: { table: "customers", column: "id" },
      note: "buyer",
    });
  });

  it("parses parameterized types without dropping commas", () => {
    expect(parseTableColumnSpec("email: varchar(320) UK NN")).toEqual({
      name: "email",
      type: "varchar(320)",
      keys: ["uk"],
      notNull: true,
    });
    expect(parseTableColumnSpec("amount: numeric(10,2) NN")).toEqual({
      name: "amount",
      type: "numeric(10,2)",
      keys: [],
      notNull: true,
    });
  });

  it("parses composite FK refs", () => {
    expect(
      parseTableColumnSpec("order_id: uuid PK FK NN -> order_items.(order_id, line_no)"),
    ).toEqual({
      name: "order_id",
      type: "uuid",
      keys: ["pk", "fk"],
      notNull: true,
      references: {
        table: "order_items",
        column: "order_id",
        columns: ["order_id", "line_no"],
      },
    });
  });
});

describe("parseTableColumns", () => {
  it("parses an array of specs", () => {
    const cols = parseTableColumns(["id PK uuid", "name text NN"]);
    expect(cols).toHaveLength(2);
    expect(cols[1]?.notNull).toBe(true);
  });

  it("returns empty for non-arrays", () => {
    expect(parseTableColumns("id PK")).toEqual([]);
  });
});

describe("formatTableColumnLine", () => {
  it("round-trips structured column lines", () => {
    const col = parseTableColumnSpec("customer_id: uuid FK NN -> customers.id // buyer");
    expect(col).toBeTruthy();
    expect(formatTableColumnLine(col!)).toBe("customer_id: uuid FK NN -> customers.id // buyer");
  });

  it("formats composite FK refs", () => {
    const col = parseTableColumnSpec("order_id: uuid PK FK NN -> order_items.(order_id, line_no)");
    expect(formatTableColumnLine(col!)).toBe(
      "order_id: uuid PK FK NN -> order_items.(order_id, line_no)",
    );
  });
});

describe("inferFkRelationship", () => {
  it("treats a nullable FK as optional parent, many children", () => {
    expect(inferFkRelationship([{ name: "customer_id", type: "uuid", keys: ["fk"] }])).toEqual({
      cardinality: { from: "zeroOrOne", to: "zeroOrMany" },
      identifying: false,
    });
  });

  it("treats UK+FK as 1:1", () => {
    expect(
      inferFkRelationship([{ name: "order_id", type: "uuid", keys: ["fk", "uk"], notNull: true }]),
    ).toEqual({
      cardinality: { from: "one", to: "one" },
      identifying: false,
    });
  });

  it("treats a sole PK FK as identifying 1:1", () => {
    expect(
      inferFkRelationship(
        [{ name: "customer_id", type: "uuid", keys: ["pk", "fk"], notNull: true }],
        [{ name: "customer_id", type: "uuid", keys: ["pk", "fk"], notNull: true }],
      ),
    ).toEqual({
      cardinality: { from: "one", to: "one" },
      identifying: true,
    });
  });

  it("keeps identifying 1:N when the FK is only part of a composite PK", () => {
    expect(
      inferFkRelationship(
        [{ name: "order_id", type: "uuid", keys: ["pk", "fk"], notNull: true }],
        [
          { name: "order_id", type: "uuid", keys: ["pk", "fk"], notNull: true },
          { name: "line_no", type: "int", keys: ["pk"], notNull: true },
        ],
      ),
    ).toEqual({
      cardinality: { from: "one", to: "zeroOrMany" },
      identifying: true,
    });
  });
});
