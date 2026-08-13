import { describe, expect, it } from "vite-plus/test";
import { BUILTIN_KIND_LIST, EDGE_OPS } from "@kekonic/diagrams-core";
import { KDIAGRAM_EDGE_OPS, kdiagramLanguage } from "./kdiagram.ts";

describe("kdiagramLanguage", () => {
  it("exposes a TextMate grammar for Shiki", () => {
    expect(kdiagramLanguage.name).toBe("kdiagram");
    expect(kdiagramLanguage.scopeName).toBe("source.kdiagram");
    expect(kdiagramLanguage.patterns.length).toBeGreaterThan(0);
  });

  it("highlights every builtin kind from the catalog", () => {
    const kindMatch = kdiagramLanguage.repository.kinds.match;
    expect(BUILTIN_KIND_LIST.length).toBeGreaterThan(50);
    for (const kind of BUILTIN_KIND_LIST) {
      expect(kindMatch).toContain(kind);
    }
  });

  it("highlights structured column blocks", () => {
    expect(kdiagramLanguage.repository["columns-block"]).toBeTruthy();
    expect(kdiagramLanguage.repository["sql-types"]).toBeTruthy();
    expect(kdiagramLanguage.repository["column-flags"]).toBeTruthy();
    const patterns = kdiagramLanguage.patterns.map((p) => ("include" in p ? p.include : undefined));
    expect(patterns).toContain("#columns-block");
  });

  it("allows diagram headers without a title string", () => {
    expect(kdiagramLanguage.repository["diagram-header"]).toBeTruthy();
    const patterns = kdiagramLanguage.patterns.map((p) => ("include" in p ? p.include : undefined));
    expect(patterns).toContain("#diagram-header");
    // Keyword list must not require a string after `diagram` (handled by diagram-header).
    const keywordAlts = kdiagramLanguage.repository.keywords.match
      .replaceAll(/\\b|[()]/g, "")
      .split("|");
    expect(keywordAlts).not.toContain("diagram");
    expect(keywordAlts).toContain("kdiagram");
    expect(kdiagramLanguage.repository["diagram-header"].begin).toContain("state");
  });

  it("highlights sequence blocks and scoped keywords", () => {
    expect(kdiagramLanguage.repository["sequence-block"]).toBeTruthy();
    expect(kdiagramLanguage.repository["sequence-keywords"]).toBeTruthy();
    const patterns = kdiagramLanguage.patterns.map((p) => ("include" in p ? p.include : undefined));
    expect(patterns).toContain("#sequence-block");
    expect(kdiagramLanguage.repository.keywords.match).not.toContain("sequence");
    expect(kdiagramLanguage.repository.keywords.match).not.toContain("alt");
    expect(kdiagramLanguage.repository["sequence-keywords"].match).toContain("alt");
    expect(kdiagramLanguage.repository["sequence-keywords"].match).toContain("alternate");
    expect(kdiagramLanguage.repository["sequence-keywords"].match).toContain("parallel");
    expect(kdiagramLanguage.repository["sequence-keywords"].match).toContain("section");
    expect(kdiagramLanguage.repository["sequence-keywords"].match).toContain("activate");
    expect(kdiagramLanguage.repository.operators.match).toContain("-->");
  });

  it("highlights animation blocks and cues", () => {
    expect(kdiagramLanguage.repository["animation-block"]).toBeTruthy();
    expect(kdiagramLanguage.repository["animation-cues"]).toBeTruthy();
    const patterns = kdiagramLanguage.patterns.map((p) => ("include" in p ? p.include : undefined));
    expect(patterns).toContain("#animation-block");
    expect(patterns).not.toContain("#animation-header");
    // Cue words are scoped to animation blocks — not global soft keywords.
    expect(kdiagramLanguage.repository.keywords.match).not.toContain("animation");
    expect(kdiagramLanguage.repository.keywords.match).not.toContain("activate");
    expect(kdiagramLanguage.repository.keywords.match).not.toContain("parallel");
    expect(kdiagramLanguage.repository["animation-cues"].match).toContain("activate");
    expect(kdiagramLanguage.repository["animation-cues"].match).toContain("flow");
    expect(kdiagramLanguage.repository.numbers.match).toContain("ms");
    expect(kdiagramLanguage.repository.punctuation.match).toContain("*");
  });

  it("scopes kinds and atoms so node ids stay plain", () => {
    // `worker` as an edge endpoint must not match; `id: worker` must.
    expect(kdiagramLanguage.repository.kinds.match).toContain("(?<=:)");
    expect(kdiagramLanguage.repository.kinds.match).toContain("worker");
    expect(kdiagramLanguage.repository.atoms.match).toContain("(?<=:)");
    // arrange: flow / cellArrange: flow (also an animation cue inside blocks)
    expect(kdiagramLanguage.repository.atoms.match).toContain("flow");
    expect(kdiagramLanguage.repository["direction-atoms"]).toBeTruthy();
  });

  it("operator set matches lexer EDGE_OPS and excludes ->>", () => {
    expect(KDIAGRAM_EDGE_OPS).toEqual([...EDGE_OPS]);
    expect(kdiagramLanguage.repository.operators.match).not.toContain("->>");
    expect(kdiagramLanguage.repository.operators.match).toContain("~>");
    expect(kdiagramLanguage.repository.keywords.match).toContain("kdiagram");
    expect(kdiagramLanguage.repository.keywords.match).toContain("density");
    const patternOrder = kdiagramLanguage.patterns.map((p) =>
      "include" in p ? p.include : undefined,
    );
    expect(patternOrder.indexOf("#properties")).toBeLessThan(patternOrder.indexOf("#keywords"));
  });
});
