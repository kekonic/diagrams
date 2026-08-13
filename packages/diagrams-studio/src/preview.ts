import type { Diagnostic, InteractiveRenderOptions, RenderResult } from "@kekonic/diagrams";
import type { StudioRender } from "./protocol.ts";

export type StudioRenderer = (
  source: string,
  options: InteractiveRenderOptions,
) => Promise<RenderResult>;

export type StudioPreviewCoordinator = {
  render(
    documentId: string,
    revision: number,
    source: string,
    options: InteractiveRenderOptions,
  ): Promise<StudioRender | undefined>;
  invalidate(documentId: string): void;
};

/**
 * Drops stale async renders so every host observes monotonically newer document results.
 * Rendering stays injected, keeping this coordinator browser-safe and renderer-neutral.
 */
export function createStudioPreviewCoordinator(renderer: StudioRenderer): StudioPreviewCoordinator {
  const generations = new Map<string, number>();
  return {
    async render(documentId, revision, source, options) {
      const generation = (generations.get(documentId) ?? 0) + 1;
      generations.set(documentId, generation);
      const result = await renderer(source, options);
      if (generations.get(documentId) !== generation) return undefined;
      return {
        documentId,
        revision,
        ok: result.ok,
        svg: result.svg,
        diagnostics: uniqueDiagnostics(result.diagnostics),
        graph: result.graph,
        stats: result.stats,
      };
    },
    invalidate(documentId) {
      generations.set(documentId, (generations.get(documentId) ?? 0) + 1);
    },
  };
}

function uniqueDiagnostics(diagnostics: readonly Diagnostic[]): Diagnostic[] {
  const seen = new Set<string>();
  return diagnostics.filter((diagnostic) => {
    const { start, end } = diagnostic.range;
    const key = `${diagnostic.code}:${diagnostic.severity}:${start.offset}:${end.offset}:${diagnostic.message}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
