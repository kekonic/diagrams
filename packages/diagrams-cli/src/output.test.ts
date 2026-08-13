import { describe, expect, it } from "vite-plus/test";
import type { Diagnostic } from "@kekonic/diagrams";
import { createOutputContext, machineEnvelope, printDiagnostic, shouldUseColor } from "./output.ts";

describe("CLI output contracts", () => {
  it("honors explicit color, NO_COLOR, FORCE_COLOR, and TTY detection", () => {
    expect(shouldUseColor("always", false, { NO_COLOR: "" })).toBe(true);
    expect(shouldUseColor("never", true, { FORCE_COLOR: "1" })).toBe(false);
    expect(shouldUseColor("auto", true, { NO_COLOR: "" })).toBe(false);
    expect(shouldUseColor("auto", false, { FORCE_COLOR: "1" })).toBe(true);
    expect(shouldUseColor("auto", true, {})).toBe(true);
  });

  it("renders source frames and hints without ANSI for redirected output", () => {
    let text = "";
    const stream = { isTTY: false, write: (chunk: string) => ((text += chunk), true) };
    const context = createOutputContext(
      { color: "auto", quiet: false, verbose: false, debug: false },
      stream,
      {},
    );
    const diagnostic: Diagnostic = {
      severity: "error",
      code: "FM005",
      message: "Expected target",
      hint: "Add a node id after ->.",
      range: {
        start: { line: 2, column: 5, offset: 15 },
        end: { line: 2, column: 7, offset: 17 },
      },
    };
    printDiagnostic(context, diagnostic, "diagram {\n  a ->\n}\n", "example.kdiagram");
    expect(text).toContain("example.kdiagram:2:5 error[FM005] Expected target");
    expect(text).toContain("2 |   a ->");
    expect(text).toContain("^^");
    expect(text).toContain("hint: Add a node id after ->.");
    expect(text).not.toContain("\u001b[");
  });

  it("uses a versioned machine envelope", () => {
    expect(machineEnvelope("check", { files: [] })).toEqual({
      version: 1,
      command: "check",
      payload: { files: [] },
    });
  });
});
