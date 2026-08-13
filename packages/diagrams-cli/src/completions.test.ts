import { describe, expect, it } from "vite-plus/test";
import { shellCompletions } from "./completions.ts";

describe("shell completions", () => {
  it("generates Bash, Zsh, and Fish definitions", () => {
    expect(shellCompletions("bash")).toContain("complete -F _kdiagrams kdiagrams");
    expect(shellCompletions("zsh")).toContain("#compdef kdiagrams");
    expect(shellCompletions("fish")).toContain("complete -c kdiagrams");
  });
});
