import { describe, expect, it } from "vite-plus/test";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, mkdtempSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { tmpdir } from "node:os";

const CLI = resolve(dirname(fileURLToPath(import.meta.url)), "../dist/cli.mjs");

const FIXTURE = `diagram "Checkout" {
  direction LR
  api: gateway "API"
  db: database "Postgres"
  api -> db "query"
}
`;

function runCli(
  args: string[],
  input?: string,
  options: { cwd?: string; env?: NodeJS.ProcessEnv } = {},
): { stdout: string; stderr: string; status: number | null } {
  const result = spawnSync(process.execPath, [CLI, ...args], {
    encoding: "utf-8",
    input,
    cwd: options.cwd,
    env: { ...process.env, ...options.env },
  });
  return {
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
    status: result.status,
  };
}

describe("kdiagram CLI", () => {
  const dir = mkdtempSync(join(tmpdir(), "kdiagram-cli-"));
  const fixture = join(dir, "diagram.kdiagram");
  writeFileSync(fixture, FIXTURE);

  it("check exits 0 on valid diagram", () => {
    const { status, stderr } = runCli(["check", fixture]);
    expect(status).toBe(0);
    expect(stderr).toContain("0 error(s)");
  });

  it("prints each check diagnostic once", () => {
    const invalid = join(dir, "invalid.kdiagram");
    writeFileSync(invalid, `diagram {\n  a: service "A"\n  a ->\n}\n`, "utf-8");
    const { status, stderr } = runCli(["check", invalid]);
    expect(status).toBe(1);
    expect(stderr.match(/FM005/g)).toHaveLength(1);
    expect(stderr).toContain("1 error(s)");
  });

  it("supports stdin and machine-readable check diagnostics", () => {
    const result = runCli(["check", "-", "--json"], FIXTURE);
    expect(result.status).toBe(0);
    expect(JSON.parse(result.stdout)).toEqual({
      version: 1,
      command: "check",
      payload: {
        files: [{ path: "<stdin>", diagnostics: [] }],
        summary: { files: 1, errors: 0, warnings: 0 },
      },
    });
  });

  it("reports deterministic capabilities and rendered quality evidence", () => {
    const capabilities = runCli(["capabilities"]);
    expect(capabilities.status).toBe(0);
    expect(JSON.parse(capabilities.stdout)).toMatchObject({
      version: 1,
      command: "capabilities",
      payload: {
        version: 1,
        language: { diagramFamilies: ["flow", "state", "sequence"] },
        layout: { directions: ["LR", "RL", "TD", "BT"] },
        qualityChecks: [
          "extreme-aspect-ratio",
          "canvas-spanning-edges",
          "excessive-edge-crossings",
          "reverse-layout-flow",
          "edge-label-pressure",
        ],
      },
    });

    const analysis = runCli(["analyze", fixture, "--pretty"]);
    expect(analysis.status).toBe(0);
    expect(JSON.parse(analysis.stdout)).toMatchObject({
      version: 1,
      command: "analyze",
      payload: {
        files: [
          {
            path: fixture,
            artifact: {
              width: expect.any(Number),
              height: expect.any(Number),
              aspectRatio: expect.any(Number),
              targetAspectRatio: 1.778,
              targetAspectRatioDifference: expect.any(Number),
              nodes: 2,
              edges: 1,
            },
          },
        ],
        summary: { files: 1, errors: 0 },
      },
    });
  });

  it("reads source from unnamed piped stdin and honors --stdin-filename", () => {
    const unnamed = runCli(["check"], FIXTURE);
    expect(unnamed.status).toBe(0);
    expect(unnamed.stderr).toContain("1 file(s): 0 error(s)");

    const named = runCli(["check", "--json", "--stdin-filename", "docs/piped.kdiagram"], FIXTURE);
    expect(named.status).toBe(0);
    expect(JSON.parse(named.stdout)).toMatchObject({
      version: 1,
      command: "check",
      payload: { files: [{ path: "docs/piped.kdiagram", diagnostics: [] }] },
    });
  });

  it("rejects unknown flags and reports the installed version", () => {
    const unknown = runCli(["check", fixture, "--wat"]);
    expect(unknown.status).toBe(2);
    expect(unknown.stderr).toContain("Unknown option: --wat");

    const removedRenderer = runCli(["render", fixture, "--renderer", "svg"]);
    expect(removedRenderer.status).toBe(2);
    expect(removedRenderer.stderr).toContain("Unknown option: --renderer");

    const version = runCli(["--version"]);
    expect(version.status).toBe(0);
    expect(version.stdout.trim()).toMatch(/^\d+\.\d+\.\d+/);
  });

  it("render writes SVG", () => {
    const out = join(dir, "out.svg");
    const { status, stderr } = runCli(["render", fixture, "-o", out, "--theme", "light"]);
    expect(status).toBe(0);
    expect(stderr).toContain("Wrote");
    const svg = readFileSync(out, "utf-8");
    expect(svg).toContain("<svg");
    expect(svg).toContain("Checkout");
    expect(svg).toContain("--kd-bg:");

    const live = runCli(["render", fixture, "--live-theme"]);
    expect(live.status).toBe(0);
    expect(live.stdout).not.toContain("--kd-bg:");
    expect(live.stderr).toContain("FMCLI101");
  });

  it("ast and graph emit JSON", () => {
    const ast = runCli(["ast", fixture, "--pretty"]);
    expect(ast.status).toBe(0);
    expect(JSON.parse(ast.stdout)).toMatchObject({
      version: 1,
      command: "ast",
      payload: { data: { type: "Document" } },
    });

    const graph = runCli(["graph", fixture, "--pretty"]);
    expect(graph.status).toBe(0);
    expect(JSON.parse(graph.stdout)).toMatchObject({
      version: 1,
      command: "graph",
      payload: { data: { nodes: expect.any(Array) }, targets: expect.any(Array) },
    });
  });

  it("graph lists model views and --view selects a lens", () => {
    const modelPath = resolve(
      dirname(fileURLToPath(import.meta.url)),
      "../../../examples/storefront-model.kdiagram",
    );
    const graph = runCli(["graph", modelPath, "--view", "containers", "--pretty"]);
    expect(graph.status).toBe(0);
    const envelope = JSON.parse(graph.stdout);
    expect(envelope.payload.targets).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: "model-view", viewName: "context" }),
        expect.objectContaining({ kind: "model-view", viewName: "containers" }),
      ]),
    );
    expect(envelope.payload.data.view).toMatchObject({ name: "containers" });
    expect(envelope.payload.data.nodes.map((node: { id: string }) => node.id)).not.toContain(
      "ordersDb",
    );
  });

  it("format writes normalized source", () => {
    const fmtDir = mkdtempSync(join(tmpdir(), "kdiagram-cli-fmt-"));
    const input = join(fmtDir, "in.kdiagram");
    writeFileSync(input, `diagram "T" {\na: service "A"\n}`, "utf-8");
    const out = join(fmtDir, "out.kdiagram");
    const { status } = runCli(["format", input, "-o", out]);
    expect(status).toBe(0);
    const formatted = readFileSync(out, "utf-8");
    expect(formatted).toContain('  a: service "A"');
  });

  it("discovers directories and path lists for batch checks", () => {
    const batchDir = mkdtempSync(join(tmpdir(), "kdiagram-cli-batch-"));
    mkdirSync(join(batchDir, "nested"), { recursive: true });
    writeFileSync(join(batchDir, "b.kdiagram"), FIXTURE);
    writeFileSync(join(batchDir, "nested", "a.kdiagram"), FIXTURE);
    writeFileSync(join(batchDir, "ignored.kdiagram"), FIXTURE);
    writeFileSync(join(batchDir, ".kdiagramignore"), "ignored.kdiagram\n");

    const discovered = runCli([
      "check",
      "--ignore-file",
      join(batchDir, ".kdiagramignore"),
      batchDir,
    ]);
    expect(discovered.status).toBe(0);
    expect(discovered.stderr).toContain("2 file(s): 0 error(s)");

    const listed = runCli(
      ["check", "--files-from", "-"],
      `${join(batchDir, "nested", "a.kdiagram")}\n${join(batchDir, "b.kdiagram")}\n`,
    );
    expect(listed.status).toBe(0);
    expect(listed.stderr).toContain("2 file(s): 0 error(s)");
  });

  it("checks and writes formatting across directories", () => {
    const formatDir = mkdtempSync(join(tmpdir(), "kdiagram-cli-format-batch-"));
    writeFileSync(join(formatDir, "a.kdiagram"), `diagram "T" {\na: service "A"\n}`, "utf-8");
    writeFileSync(join(formatDir, "b.kdiagram"), `diagram "T" {\nb: service "B"\n}`, "utf-8");

    const before = runCli(["format", "--check", formatDir]);
    expect(before.status).toBe(1);
    expect(before.stderr.match(/not formatted/g)).toHaveLength(2);

    const write = runCli(["format", formatDir, "--write"]);
    expect(write.status).toBe(0);
    expect(runCli(["format", formatDir, "--check"]).status).toBe(0);
  });

  it("requires structured batch render output and preserves directories", () => {
    const renderDir = mkdtempSync(join(tmpdir(), "kdiagram-cli-render-batch-"));
    mkdirSync(join(renderDir, "nested"), { recursive: true });
    writeFileSync(join(renderDir, "a.kdiagram"), FIXTURE);
    writeFileSync(join(renderDir, "nested", "b.kdiagram"), FIXTURE);

    const ambiguous = runCli(["render", renderDir]);
    expect(ambiguous.status).toBe(2);
    expect(ambiguous.stderr).toContain("SVG documents are never concatenated");

    const outDir = mkdtempSync(join(tmpdir(), "kdiagram-cli-render-output-"));
    const rendered = runCli(["render", "--out-dir", outDir, renderDir]);
    expect(rendered.status).toBe(0);
    expect(existsSync(join(outDir, renderDir.replace(/^\//, ""), "a.svg"))).toBe(false);
    expect(existsSync(join(outDir, "a.svg"))).toBe(true);
    expect(existsSync(join(outDir, "nested", "b.svg"))).toBe(true);
  });

  it("prints rich diagnostics with hints and respects color and quiet contracts", () => {
    const invalid = join(dir, "rich-invalid.kdiagram");
    writeFileSync(invalid, `diagram {\n  a: service "A"\n  a ->\n}\n`, "utf-8");
    const plain = runCli(["check", invalid], undefined, { env: { NO_COLOR: "1" } });
    expect(plain.status).toBe(1);
    expect(plain.stderr).toContain("3 |   a ->");
    expect(plain.stderr).toContain("hint:");
    expect(plain.stderr).not.toContain("\u001b[");

    const colored = runCli(["check", invalid, "--color", "always", "--quiet"]);
    expect(colored.stderr).toContain("\u001b[");
    expect(colored.stderr).not.toContain("1 file(s):");
  });

  it("supports config profiles, explicit backgrounds, and embedded fonts", () => {
    const configDir = mkdtempSync(join(tmpdir(), "kdiagram-cli-config-"));
    const source = join(configDir, "diagram.kdiagram");
    const output = join(configDir, "diagram.svg");
    writeFileSync(source, FIXTURE);
    writeFileSync(
      join(configDir, "kekonic-diagrams.config.json"),
      JSON.stringify({
        version: 1,
        defaultProfile: "paper",
        profiles: {
          paper: { theme: "light", background: "theme", embedFonts: true, printSafe: true },
        },
      }),
    );
    const result = runCli(["render", source, "-o", output, "--verbose"], undefined, {
      cwd: configDir,
    });
    expect(result.status).toBe(0);
    expect(result.stderr).toContain("Using export profile paper");
    const svg = readFileSync(output, "utf8");
    expect(svg).toContain("kdiagram-export-background");
    expect(svg).toContain("data:font/woff;base64,");
  });

  it("provides doctor, completions, and distinct operational failures", () => {
    const doctor = runCli(["doctor", "--json"]);
    expect(doctor.status).toBe(0);
    expect(JSON.parse(doctor.stdout)).toMatchObject({ version: 1, command: "doctor" });

    const completions = runCli(["completions", "zsh"]);
    expect(completions.status).toBe(0);
    expect(completions.stdout).toContain("#compdef kdiagram");

    const missing = runCli(["check", "--files-from", join(dir, "missing.txt")]);
    expect(missing.status).toBe(3);
    expect(missing.stderr).toContain("Operational error: File not found");
    expect(missing.stderr).not.toContain("at ");
  });

  it("exits quietly when a downstream pipe closes", () => {
    const large = join(dir, "large.kdiagram");
    const nodes = Array.from(
      { length: 2500 },
      (_, index) => `  n${index}: service "Node ${index}"`,
    );
    writeFileSync(large, `diagram {\n${nodes.join("\n")}\n}\n`);
    const result = spawnSync(
      "/bin/bash",
      [
        "-c",
        'set -o pipefail; "$1" "$2" graph "$3" | head -c 1 >/dev/null',
        "kdiagram-test",
        process.execPath,
        CLI,
        large,
      ],
      { encoding: "utf8" },
    );
    expect(result.status).toBe(0);
    expect(result.stderr).toBe("");
  });
});
