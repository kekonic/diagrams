import { describe, expect, it } from "vite-plus/test";
import {
  cardinalityLabel,
  fkCardinality,
  isPureCardinalityLabel,
  parseCardinality,
} from "./cardinality.ts";

describe("parseCardinality", () => {
  it("parses from:to forms", () => {
    expect(parseCardinality("1:N")).toEqual({ from: "one", to: "oneOrMany" });
    expect(parseCardinality("0..1:0..N")).toEqual({ from: "zeroOrOne", to: "zeroOrMany" });
    expect(parseCardinality("1:0..1")).toEqual({ from: "one", to: "zeroOrOne" });
  });

  it("parses a single side as target multiplicity", () => {
    expect(parseCardinality("N")).toEqual({ from: "one", to: "oneOrMany" });
  });

  it("parses Mermaid-style connectors", () => {
    expect(parseCardinality("||--o{")).toEqual({ from: "one", to: "zeroOrMany" });
    expect(parseCardinality("}o--||")).toEqual({ from: "zeroOrMany", to: "one" });
  });

  it("formats labels", () => {
    expect(cardinalityLabel({ from: "one", to: "zeroOrMany" })).toBe("1:0..N");
  });
});

describe("isPureCardinalityLabel", () => {
  it("treats empty and pure card expressions as pure", () => {
    expect(isPureCardinalityLabel(undefined)).toBe(true);
    expect(isPureCardinalityLabel("1:N")).toBe(true);
    expect(isPureCardinalityLabel("||--o{")).toBe(true);
    expect(isPureCardinalityLabel("0..1:0..N")).toBe(true);
  });

  it("rejects semantic relationship labels", () => {
    expect(isPureCardinalityLabel("places")).toBe(false);
    expect(isPureCardinalityLabel("customer_id → id")).toBe(false);
  });
});

describe("fkCardinality", () => {
  it("maps unique FKs to 1:1", () => {
    expect(fkCardinality(true, true)).toEqual({ from: "one", to: "one" });
    expect(fkCardinality(false, true)).toEqual({ from: "zeroOrOne", to: "zeroOrOne" });
  });
});
