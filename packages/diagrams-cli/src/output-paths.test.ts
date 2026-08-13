import { describe, expect, it } from "vite-plus/test";
import { parseCommand } from "./command-model.ts";
import { renderOutputPaths } from "./output-paths.ts";
import type { ResolvedInput } from "./input-resolver.ts";

const inputs: ResolvedInput[] = [
  {
    kind: "file",
    absolutePath: "/project/docs/a.kdiagram",
    displayPath: "/project/docs/a.kdiagram",
    relativePath: "docs/a.kdiagram",
  },
  {
    kind: "file",
    absolutePath: "/project/examples/nested/a.kdiagram",
    displayPath: "/project/examples/nested/a.kdiagram",
    relativePath: "examples/nested/a.kdiagram",
  },
];

describe("render output paths", () => {
  it("preserves input directories under --out-dir", () => {
    const command = parseCommand(["render", ".", "--out-dir", "public"]);
    expect(renderOutputPaths(command, inputs, "/project")).toEqual([
      "/project/public/docs/a.svg",
      "/project/public/examples/nested/a.svg",
    ]);
  });

  it("supports explicit output templates", () => {
    const command = parseCommand([
      "render",
      ".",
      "--out-dir",
      "public",
      "--output-template",
      "{dir}/{name}.diagram.{ext}",
    ]);
    expect(renderOutputPaths(command, inputs, "/project")).toEqual([
      "/project/public/docs/a.diagram.svg",
      "/project/public/examples/nested/a.diagram.svg",
    ]);
  });

  it("rejects ambiguous multi-document stdout and collisions", () => {
    expect(() => renderOutputPaths(parseCommand(["render", "."]), inputs, "/project")).toThrow(
      "Multiple render inputs require",
    );
    expect(() =>
      renderOutputPaths(
        parseCommand(["render", ".", "--output-template", "{name}.svg"]),
        inputs,
        "/project",
      ),
    ).toThrow("same output");
  });
});
