/**
 * Lazy Shiki highlighter for KDiagram source in docs embeds.
 * Loaded on first highlight request — not on package import.
 */

type Highlighter = Awaited<ReturnType<(typeof import("shiki"))["createHighlighter"]>>;

let highlighterPromise: Promise<Highlighter> | null = null;

async function getHighlighter(): Promise<Highlighter> {
  if (!highlighterPromise) {
    highlighterPromise = (async () => {
      const [{ createHighlighter }, { kdiagramLanguage }] = await Promise.all([
        import("shiki"),
        import("./kdiagram.ts"),
      ]);
      return createHighlighter({
        themes: ["github-dark", "github-light"],
        // TextMate grammar object — compatible at runtime; Shiki's bundled lang union is narrower.
        langs: [kdiagramLanguage as never],
      });
    })();
  }
  return highlighterPromise;
}

/** Dual-theme HTML (CSS vars `--shiki-dark` / `--shiki-light`) for site theme toggles. */
export async function highlightKDiagram(code: string): Promise<string> {
  const highlighter = await getHighlighter();
  return highlighter.codeToHtml(code.length > 0 ? code : " ", {
    lang: "kdiagram",
    themes: {
      dark: "github-dark",
      light: "github-light",
    },
    defaultColor: false,
  });
}
