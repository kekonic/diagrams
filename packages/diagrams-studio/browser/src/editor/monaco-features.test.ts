// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from "vite-plus/test";
import { installKDiagramLanguage } from "../language.ts";

let editor: { dispose(): void } | undefined;
let language: { dispose(): void } | undefined;

afterEach(() => {
  editor?.dispose();
  editor = undefined;
  language?.dispose();
  language = undefined;
  document.body.replaceChildren();
});

describe("Studio Monaco features", () => {
  it("registers standard editing actions with the API-only Monaco entry", async () => {
    // Exercise command registration directly; Shiki and its WASM startup are
    // unrelated to Monaco's editor contributions and are covered elsewhere.
    await import("./monaco-features.ts");
    const monaco = await import("monaco-editor/editor/editor.api");
    const host = document.createElement("div");
    host.style.width = "800px";
    host.style.height = "600px";
    document.body.appendChild(host);
    monaco.languages.register({ id: "kdiagram" });
    const instance = monaco.editor.create(host, { value: "one\ntwo\n", language: "kdiagram" });
    editor = instance;
    language = installKDiagramLanguage(
      monaco as Parameters<typeof installKDiagramLanguage>[0],
      instance.getModel()!,
    );
    const actions = new Set(
      instance.getSupportedActions().map((action: { id: string }) => action.id),
    );

    const expected = [
      "actions.find",
      "editor.action.startFindReplaceAction",
      "editor.action.insertCursorAbove",
      "editor.action.insertCursorBelow",
      "editor.action.moveLinesUpAction",
      "editor.action.moveLinesDownAction",
      "editor.action.copyLinesUpAction",
      "editor.action.copyLinesDownAction",
      "editor.action.commentLine",
      "editor.action.formatDocument",
    ];
    for (const action of expected) expect(actions.has(action), action).toBe(true);
  }, 15_000);
});
