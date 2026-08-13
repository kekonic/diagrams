import type { RenderOptions, RenderResult } from "@kekonic/diagrams";

export type StaticDiagramOptions = RenderOptions & {
  /** Prefer snapshot CSS vars so SVGs look correct outside live theme CSS. */
  snapshotTheme?: boolean;
};

/**
 * Server-safe SVG render for docs/SSR. Uses the shared font measurer in Node.
 */
export async function renderKDiagramSvg(
  source: string,
  options: StaticDiagramOptions = {},
): Promise<{
  svg: string;
  diagnostics: RenderResult["diagnostics"];
}> {
  const { KDiagram } = await import("@kekonic/diagrams");
  const { snapshotTheme = true, theme = "dark", ...rest } = options;
  const result = await KDiagram.renderToSvg(source, {
    ...rest,
    theme,
    snapshotTheme,
    // Chromeless by default — opt into title/legend/etc. via options or the DSL.
    presentation: rest.presentation,
  });
  return { svg: result.svg ?? "", diagnostics: result.diagnostics };
}
