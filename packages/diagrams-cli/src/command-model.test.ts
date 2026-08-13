import { describe, expect, it } from "vite-plus/test";
import { CliUsageError, parseCommand } from "./command-model.ts";

describe("CLI command model", () => {
  it("models agent-facing capability and analysis commands", () => {
    expect(parseCommand(["capabilities", "--pretty"])).toMatchObject({
      name: "capabilities",
      options: { pretty: true },
    });
    expect(parseCommand(["analyze", ".", "--json"])).toMatchObject({
      name: "analyze",
      inputs: ["."],
      options: { json: true },
    });
    expect(() => parseCommand(["capabilities", "--json"])).toThrow(
      "Unknown option for capabilities: --json",
    );
  });

  it("requires the explicit stdio LSP transport", () => {
    expect(parseCommand(["lsp", "--stdio"])).toMatchObject({
      name: "lsp",
      options: { stdio: true },
    });
    expect(() => parseCommand(["lsp"])).toThrow("lsp requires --stdio");
  });

  it("accepts options before and after multiple inputs", () => {
    const command = parseCommand([
      "check",
      "--exclude",
      "drafts/**",
      "docs",
      "--json",
      "examples/**/*.kdiagram",
      "--exclude=generated/**",
    ]);

    expect(command.inputs).toEqual(["docs", "examples/**/*.kdiagram"]);
    expect(command.options.json).toBe(true);
    expect(command.options.excludes).toEqual(["drafts/**", "generated/**"]);
  });

  it("parses batch render destinations and stdin metadata", () => {
    const command = parseCommand([
      "render",
      "--out-dir",
      "public",
      "--output-template={dir}/{name}.{ext}",
      "--stdin-filename",
      "docs/system.kdiagram",
      "-",
    ]);

    expect(command.inputs).toEqual(["-"]);
    expect(command.options.outDir).toBe("public");
    expect(command.options.outputTemplate).toBe("{dir}/{name}.{ext}");
    expect(command.options.stdinFilename).toBe("docs/system.kdiagram");
  });

  it("rejects command-specific and conflicting options", () => {
    expect(() => parseCommand(["check", "--theme", "dark", "a.kdiagram"])).toThrow(
      "Unknown option for check: --theme",
    );
    expect(() => parseCommand(["format", "--write", "--check", "a.kdiagram"])).toThrow(
      "--write and --check cannot be combined",
    );
    expect(() =>
      parseCommand(["render", "--output", "a.svg", "--out-dir", "out", "a.kdiagram"]),
    ).toThrow("--output cannot be combined");
  });

  it("uses structured usage errors", () => {
    try {
      parseCommand(["check", "--wat"]);
      throw new Error("expected parseCommand to throw");
    } catch (error) {
      expect(error).toBeInstanceOf(CliUsageError);
      expect((error as CliUsageError).exitCode).toBe(2);
    }
  });

  it("suggests nearby commands and options", () => {
    expect(() => parseCommand(["chek", "a.kdiagram"])).toThrow("Did you mean check?");
    expect(() => parseCommand(["check", "--josn", "a.kdiagram"])).toThrow("Did you mean --json?");
  });

  it("models the local studio security and launch options", () => {
    expect(
      parseCommand(["studio", ".", "--no-open", "--allow-write", "--port", "4312"]),
    ).toMatchObject({
      name: "studio",
      inputs: ["."],
      options: { noOpen: true, allowWrite: true, port: "4312" },
    });
    expect(() => parseCommand(["studio", ".", "--open", "--no-open"])).toThrow(
      "cannot be combined",
    );
  });
});
