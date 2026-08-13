/**
 * One-time Monaco + Shiki wiring so Studio shares the KDiagram TextMate grammar
 * with docs (and a future VS Code extension).
 *
 * Monaco itself and its worker are bundled locally so CLI-launched Studio stays
 * functional under its offline content-security policy.
 */

import { loader, type Monaco } from "@monaco-editor/react";
import { shikiToMonaco } from "@shikijs/monaco";
import { createHighlighterCore } from "shiki/core";
import { createOnigurumaEngine } from "shiki/engine/oniguruma";
import { kdiagramLanguage } from "@kekonic/diagrams-ui/shiki";

export const KDIAGRAM_LANGUAGE_ID = "kdiagram";
export const MONACO_THEME_DARK = "github-dark";
export const MONACO_THEME_LIGHT = "github-light";

let preparePromise: Promise<Monaco> | null = null;

export function prepareMonaco(): Promise<Monaco> {
  if (!preparePromise) {
    preparePromise = (async () => {
      await import("./monaco-features.ts");
      const localMonaco = await import("monaco-editor/editor/editor.api");
      loader.config({ monaco: localMonaco });
      const monaco = await loader.init();

      const highlighter = await createHighlighterCore({
        themes: [
          import("@shikijs/themes/github-dark").then((m) => m.default),
          import("@shikijs/themes/github-light").then((m) => m.default),
        ],
        langs: [kdiagramLanguage as never],
        engine: createOnigurumaEngine(import("shiki/wasm")),
      });

      monaco.languages.register({
        id: KDIAGRAM_LANGUAGE_ID,
        aliases: ["fm", "KDiagram"],
        extensions: [".kdiagram", ".fm"],
      });
      monaco.languages.setLanguageConfiguration(KDIAGRAM_LANGUAGE_ID, {
        comments: { lineComment: "//", blockComment: ["/*", "*/"] },
        brackets: [
          ["{", "}"],
          ["[", "]"],
          ["(", ")"],
        ],
        autoClosingPairs: [
          { open: "{", close: "}" },
          { open: "[", close: "]" },
          { open: "(", close: ")" },
          { open: '"', close: '"' },
        ],
        surroundingPairs: [
          { open: "{", close: "}" },
          { open: "[", close: "]" },
          { open: "(", close: ")" },
          { open: '"', close: '"' },
        ],
      });

      shikiToMonaco(highlighter, monaco);
      return monaco;
    })();
  }
  return preparePromise;
}
