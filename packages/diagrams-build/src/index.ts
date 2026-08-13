import { KDiagram, type Diagnostic, type RenderOptions } from "@kekonic/diagrams";

export type KDiagramBuildOptions = {
  renderOptions?: RenderOptions;
};

export type KDiagramBuildResult = {
  svg?: string;
  diagnostics: Diagnostic[];
};

export type KDiagramModuleKind = "svg" | "source" | "react" | "element";

/** Render portable static output through KDiagram's public facade. */
export async function renderKDiagramForBuild(
  source: string,
  options: KDiagramBuildOptions = {},
): Promise<KDiagramBuildResult> {
  return KDiagram.renderToSvg(source, {
    snapshotTheme: true,
    ...options.renderOptions,
  });
}

/** Map a KDiagram-local diagnostic onto its containing host document. */
export function offsetKDiagramDiagnostic<T extends Diagnostic>(
  diagnostic: T,
  contentStartLine: number,
): T & { hostLine: number; hostEndLine: number } {
  const sourceStart = diagnostic.range?.start.line ?? 1;
  const sourceEnd = diagnostic.range?.end.line ?? sourceStart;
  return {
    ...diagnostic,
    hostLine: contentStartLine + sourceStart - 1,
    hostEndLine: contentStartLine + sourceEnd - 1,
  };
}

/** Generate the JavaScript boundary for a non-asset `.kdiagram` import. */
export function createKDiagramModule(
  kind: KDiagramModuleKind,
  source: string,
  svg?: string,
): string {
  if (kind === "source") return `export default ${JSON.stringify(source)};\n`;
  if (kind === "svg") {
    if (svg === undefined) throw new Error("SVG output is required for a ?svg module");
    return `export default ${JSON.stringify(svg)};\n`;
  }
  if (kind === "react") {
    return [
      'import { createElement } from "react";',
      'import { KDiagramLive } from "@kekonic/diagrams-ui";',
      `export const source = ${JSON.stringify(source)};`,
      "export default function KDiagramImportedDiagram(props = {}) {",
      "  return createElement(KDiagramLive, { ...props, source });",
      "}",
      "",
    ].join("\n");
  }
  return [
    'import { KDiagramElement } from "@kekonic/diagrams-element";',
    `export const source = ${JSON.stringify(source)};`,
    "export default class KDiagramImportedDiagram extends KDiagramElement {",
    "  constructor() {",
    "    super();",
    "    this.source = source;",
    "  }",
    "}",
    "",
  ].join("\n");
}

export function createKDiagramDataUrl(svg: string): string {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

export function formatKDiagramBuildError(diagnostics: Diagnostic[]): string {
  return (
    diagnostics.map((diagnostic) => diagnostic.message).join("; ") || "Unable to render diagram"
  );
}

export function escapeKDiagramHtml(value: string): string {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

export function escapeKDiagramAttribute(value: string): string {
  return escapeKDiagramHtml(value).replaceAll('"', "&quot;");
}
