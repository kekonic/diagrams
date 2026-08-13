import { describe, expect, it } from "vite-plus/test";
import { classifyBranch } from "@kekonic/diagrams-core";
import { branchSemantics } from "./edge-semantics.ts";

describe("branchSemantics", () => {
  it("maps simple yes/no labels", () => {
    expect(branchSemantics("yes")).toBe("yes");
    expect(branchSemantics("no")).toBe("no");
    expect(classifyBranch("OK")).toBe("yes");
  });

  it("does not infer branch from outcome wording", () => {
    expect(branchSemantics("yes, high risk")).toBe("yes");
    expect(branchSemantics("Over limit")).toBe("neutral");
    expect(branchSemantics("Damaged")).toBe("neutral");
    expect(branchSemantics("Approved")).toBe("neutral");
  });

  it("prefers explicit compiled branch over label", () => {
    expect(branchSemantics("No", "yes")).toBe("yes");
  });
});
