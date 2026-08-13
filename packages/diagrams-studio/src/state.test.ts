import { describe, expect, it } from "vite-plus/test";
import { INITIAL_STUDIO_STATE, reduceStudioMessage } from "./state.ts";

describe("studio state", () => {
  it("ignores older renders for the active document", () => {
    const ready = reduceStudioMessage(INITIAL_STUDIO_STATE, {
      version: 1,
      type: "ready",
      sessionId: "session",
      documents: [
        { id: "doc", path: "doc.kdiagram", label: "doc.kdiagram", revision: 2, source: "" },
      ],
      activeDocumentId: "doc",
      capabilities: { write: false, export: true },
      presentation: { theme: "dark", options: { theme: "dark" } },
    });
    const current = reduceStudioMessage(ready, {
      version: 1,
      type: "render",
      documentId: "doc",
      revision: 2,
      ok: true,
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
    });
    const stale = reduceStudioMessage(current, {
      ...current.render!,
      version: 1,
      type: "render",
      revision: 1,
    });
    expect(stale).toBe(current);
  });
});
