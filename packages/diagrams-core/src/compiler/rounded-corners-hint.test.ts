import { describe, expect, it } from "vite-plus/test";
import { parse } from "../parser/parser.ts";
import { tokenize } from "../parser/lexer.ts";
import { compile } from "./compile.ts";

describe("roundedCorners render hint", () => {
  it("tokenizes roundedCorners as a single identifier", () => {
    const tokens = tokenize(`roundedCorners: true`);
    expect(tokens.map((t) => `${t.type}:${t.value}`)).toEqual([
      "identifier:roundedCorners",
      "colon::",
      "identifier:true",
      "eof:",
    ]);
  });

  it("compiles roundedCorners from render block", () => {
    const ast = parse(`diagram "T" {
      render { roundedCorners: true shadows: true }
      a: service "A"
    }`);
    expect(ast.diagnostics).toEqual([]);
    const result = compile(ast);
    expect(result.renderHints.roundedCorners).toBe(true);
    expect(result.renderHints.shadows).toBe(true);
  });
});
