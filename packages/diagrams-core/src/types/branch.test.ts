import { describe, expect, it } from "vite-plus/test";
import { classifyBranch, normalizeBranch } from "./branch.ts";

describe("classifyBranch", () => {
  it("classifies clear yes/no tokens", () => {
    expect(classifyBranch("Yes")).toBe("yes");
    expect(classifyBranch("OK")).toBe("yes");
    expect(classifyBranch("no")).toBe("no");
    expect(classifyBranch("false")).toBe("no");
    expect(classifyBranch(undefined)).toBe("neutral");
  });

  it("does not infer branch from outcome wording", () => {
    expect(classifyBranch("Damaged")).toBe("neutral");
    expect(classifyBranch("Rejected")).toBe("neutral");
    expect(classifyBranch("high risk")).toBe("neutral");
    expect(classifyBranch("safe")).toBe("neutral");
  });
});

describe("normalizeBranch", () => {
  it("accepts yes/no/neutral", () => {
    expect(normalizeBranch("yes")).toBe("yes");
    expect(normalizeBranch("maybe")).toBeUndefined();
  });
});
