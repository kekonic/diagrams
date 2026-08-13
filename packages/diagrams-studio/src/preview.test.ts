import { describe, expect, it } from "vite-plus/test";
import type { RenderResult } from "@kekonic/diagrams";
import { createStudioPreviewCoordinator } from "./preview.ts";

function rendered(label: string): RenderResult {
  return {
    ok: true,
    svg: `<svg><text>${label}</text></svg>`,
    diagnostics: [],
    stats: {
      parseMs: 0,
      compileMs: 0,
      measureMs: 0,
      layoutMs: 0,
      routeMs: 0,
      renderMs: 0,
      totalMs: 0,
      nodeCount: 0,
      edgeCount: 0,
      layoutAlgorithm: "test",
      routerAlgorithm: "test",
    },
  };
}

describe("studio preview coordinator", () => {
  it("drops a stale async result after a newer revision completes", async () => {
    const releases: Array<(result: RenderResult) => void> = [];
    const coordinator = createStudioPreviewCoordinator(
      () => new Promise<RenderResult>((resolve) => releases.push(resolve)),
    );
    const first = coordinator.render("doc", 1, "first", { theme: "dark" });
    const second = coordinator.render("doc", 2, "second", { theme: "dark" });
    releases[1]!(rendered("second"));
    releases[0]!(rendered("first"));

    await expect(second).resolves.toMatchObject({
      revision: 2,
      svg: expect.stringContaining("second"),
    });
    await expect(first).resolves.toBeUndefined();
  });

  it("deduplicates the same pipeline diagnostic", async () => {
    const duplicate = {
      code: "FM005",
      severity: "error" as const,
      message: "Expected target",
      range: {
        start: { line: 1, column: 1, offset: 0 },
        end: { line: 1, column: 2, offset: 1 },
      },
    };
    const coordinator = createStudioPreviewCoordinator(async () => ({
      ...rendered("invalid"),
      ok: false,
      diagnostics: [duplicate, duplicate],
    }));
    await expect(coordinator.render("doc", 1, "", { theme: "dark" })).resolves.toMatchObject({
      diagnostics: [duplicate],
    });
  });
});
