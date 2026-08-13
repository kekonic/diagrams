import { describe, expect, it } from "vite-plus/test";
import { formatTableColumnLine, parseTableColumnSpec, parseTableColumns } from "./table.ts";

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

  it("returns null for blank", () => {
    expect(parseTableColumnSpec("   ")).toBeNull();
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
});
