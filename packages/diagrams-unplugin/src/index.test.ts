import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { build, type Rollup } from "vite";
import { afterEach, describe, expect, it } from "vite-plus/test";
import { parseKDiagramRequest } from "./index.ts";
import kdiagram from "./vite.ts";

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map((directory) => rm(directory, { recursive: true })),
  );
});

describe("KDiagram Unplugin", () => {
  it("recognizes explicit queries and leaves other files alone", () => {
    expect(parseKDiagramRequest("./system.kdiagram?svg", "/project/src/main.ts")).toEqual({
      filename: "/project/src/system.kdiagram",
      kind: "svg",
    });
    expect(parseKDiagramRequest("./system.kdiagram", "/project/src/main.ts")?.kind).toBeUndefined();
    expect(parseKDiagramRequest("./system.svg?url", "/project/src/main.ts")).toBeUndefined();
  });

  it("builds every import query through Vite", async () => {
    const directory = await mkdtemp(join(tmpdir(), "kdiagram-unplugin-"));
    temporaryDirectories.push(directory);
    await writeFile(join(directory, "system.kdiagram"), 'diagram "System" { api: service "API" }');
    await writeFile(
      join(directory, "entry.js"),
      [
        'export { default as svg } from "./system.kdiagram?svg";',
        'export { default as url } from "./system.kdiagram?url";',
        'export { default as source } from "./system.kdiagram?source";',
        'export { default as ReactDiagram } from "./system.kdiagram?react";',
        'export { default as ElementDiagram } from "./system.kdiagram?element";',
      ].join("\n"),
    );

    const result = await build({
      root: directory,
      logLevel: "silent",
      plugins: [kdiagram()],
      build: {
        write: false,
        ssr: join(directory, "entry.js"),
        rollupOptions: {
          external: ["react", "@kekonic/diagrams-ui", "@kekonic/diagrams-element"],
        },
      },
    });
    if (Array.isArray(result) || !("output" in result)) throw new Error("Expected one Vite build");
    const chunk = result.output.find((item): item is Rollup.OutputChunk => item.type === "chunk");
    expect(chunk?.code).toContain('role=\\"img\\"');
    expect(chunk?.code).toContain("data:image/svg+xml;charset=utf-8,");
    expect(chunk?.code).toContain('diagram \\"System\\"');
    expect(chunk?.code).toContain("KDiagramImportedDiagram");
  });
});
