import type { Diagnostic, RenderOptions } from "@kekonic/diagrams";
import {
  escapeKDiagramAttribute,
  escapeKDiagramHtml,
  formatKDiagramBuildError,
  offsetKDiagramDiagnostic,
  renderKDiagramForBuild,
} from "@kekonic/diagrams-build";
import type MarkdownIt from "markdown-it";
import type Token from "markdown-it/lib/token.mjs";

const RENDERED = Symbol("kdiagram-rendered-fences");
const REGISTERED_OPTIONS = new WeakMap<MarkdownIt, KDiagramMarkdownItOptions>();

export type KDiagramFenceDiagnostic = Diagnostic & {
  markdownLine: number;
  markdownEndLine: number;
};

export type KDiagramMarkdownEnvironment = {
  [RENDERED]?: Map<number, string>;
  kdiagramDiagnostics?: KDiagramFenceDiagnostic[];
};

export type KDiagramMarkdownItOptions = {
  className?: string;
  renderOptions?: RenderOptions;
  onDiagnostic?: (diagnostic: KDiagramFenceDiagnostic) => void;
};

/**
 * Register the synchronous fence rule used by Markdown-it. Call
 * {@link renderKDiagramMarkdown} to perform KDiagram's asynchronous layout pass before rendering.
 */
export function kdiagramMarkdownIt(md: MarkdownIt, options: KDiagramMarkdownItOptions = {}): void {
  REGISTERED_OPTIONS.set(md, options);
  const fallback = md.renderer.rules.fence;
  md.renderer.rules.fence = (tokens, index, renderOptions, env, self) => {
    if (fenceLanguage(tokens[index]) !== "kdiagram") {
      return fallback
        ? fallback(tokens, index, renderOptions, env, self)
        : self.renderToken(tokens, index, renderOptions);
    }
    const rendered = (env as KDiagramMarkdownEnvironment)[RENDERED]?.get(index);
    if (rendered) return rendered;
    return `<pre class="kdiagram-error"><code>KDiagram fence was not prepared. Use renderKDiagramMarkdown().</code></pre>`;
  };
}

export async function renderKDiagramMarkdown(
  md: MarkdownIt,
  markdown: string,
  env: KDiagramMarkdownEnvironment = {},
  options: KDiagramMarkdownItOptions = {},
): Promise<string> {
  const registered = REGISTERED_OPTIONS.get(md);
  const effectiveOptions: KDiagramMarkdownItOptions = {
    ...registered,
    ...options,
    renderOptions: { ...registered?.renderOptions, ...options.renderOptions },
  };
  const tokens = md.parse(markdown, env);
  const rendered = new Map<number, string>();
  const diagnostics: KDiagramFenceDiagnostic[] = [];

  await Promise.all(
    tokens.map(async (token, index) => {
      if (fenceLanguage(token) !== "kdiagram") return;
      const result = await renderKDiagramForBuild(token.content, {
        renderOptions: effectiveOptions.renderOptions,
      });
      const mapped = result.diagnostics.map((diagnostic) => mapDiagnostic(token, diagnostic));
      diagnostics.push(...mapped);
      for (const diagnostic of mapped) effectiveOptions.onDiagnostic?.(diagnostic);
      if (result.svg) {
        rendered.set(
          index,
          `<figure class="${escapeKDiagramAttribute(effectiveOptions.className ?? "k-diagram")}">${result.svg}</figure>`,
        );
      } else {
        const message = formatKDiagramBuildError(mapped);
        rendered.set(
          index,
          `<pre class="kdiagram-error"><code>${escapeKDiagramHtml(message)}</code></pre>`,
        );
      }
    }),
  );

  diagnostics.sort(
    (a, b) => a.markdownLine - b.markdownLine || a.markdownEndLine - b.markdownEndLine,
  );
  env[RENDERED] = rendered;
  env.kdiagramDiagnostics = diagnostics;
  return md.renderer.render(tokens, md.options, env);
}

function fenceLanguage(token: Token | undefined): string | undefined {
  if (!token || token.type !== "fence") return undefined;
  return token.info.trim().split(/\s+/, 1)[0]?.toLowerCase();
}

export function isKDiagramFence(info: string): boolean {
  return info.trim().split(/\s+/, 1)[0]?.toLowerCase() === "kdiagram";
}

export function encodeKDiagramFenceSource(source: string): string {
  return encodeURIComponent(source);
}

function mapDiagnostic(token: Token, diagnostic: Diagnostic): KDiagramFenceDiagnostic {
  const contentStart = (token.map?.[0] ?? 0) + 2;
  const mapped = offsetKDiagramDiagnostic(diagnostic, contentStart);
  return {
    ...diagnostic,
    markdownLine: mapped.hostLine,
    markdownEndLine: mapped.hostEndLine,
  };
}
