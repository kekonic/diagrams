import type { Diagnostic, RenderOptions } from "@kekonic/diagrams";
import {
  formatKDiagramBuildError,
  offsetKDiagramDiagnostic,
  renderKDiagramForBuild,
} from "@kekonic/diagrams-build";
import { fromHtml } from "hast-util-from-html";
import type { ElementContent } from "hast";
import type { Code, Root } from "mdast";
import type { Plugin } from "unified";
import { visit } from "unist-util-visit";

export type KDiagramRemarkDiagnostic = Diagnostic & {
  markdownLine: number;
  markdownEndLine: number;
};

export type KDiagramRemarkOptions = {
  className?: string;
  renderOptions?: RenderOptions;
  onDiagnostic?: (diagnostic: KDiagramRemarkDiagnostic) => void;
};

type EmbeddedHastData = {
  hName: string;
  hProperties: { className: string[] };
  hChildren: ElementContent[];
};

const remarkKDiagram: Plugin<[KDiagramRemarkOptions?], Root> = function remarkKDiagram(
  options = {},
) {
  return async (tree, file) => {
    const fences: Code[] = [];
    visit(tree, "code", (node) => {
      if (node.lang?.toLowerCase() === "kdiagram") fences.push(node);
    });

    await Promise.all(
      fences.map(async (node) => {
        const result = await renderKDiagramForBuild(node.value, {
          renderOptions: options.renderOptions,
        });
        const diagnostics = result.diagnostics.map((diagnostic) => mapDiagnostic(node, diagnostic));
        for (const diagnostic of diagnostics) {
          options.onDiagnostic?.(diagnostic);
          file.message(diagnostic.message, {
            start: { line: diagnostic.markdownLine, column: diagnostic.range?.start.column ?? 1 },
            end: { line: diagnostic.markdownEndLine, column: diagnostic.range?.end.column ?? 1 },
          }).ruleId = diagnostic.code;
        }

        if (result.svg) {
          const svgTree = fromHtml(result.svg, { fragment: true });
          node.data = {
            ...node.data,
            hName: "figure",
            hProperties: { className: [options.className ?? "k-diagram"] },
            hChildren: svgTree.children as ElementContent[],
          } as EmbeddedHastData;
          return;
        }

        const message = formatKDiagramBuildError(diagnostics);
        node.lang = undefined;
        node.meta = undefined;
        node.value = message;
        node.data = {
          ...node.data,
          hName: "pre",
          hProperties: { className: ["kdiagram-error"] },
          hChildren: [
            {
              type: "element",
              tagName: "code",
              properties: {},
              children: [{ type: "text", value: message }],
            },
          ],
        } as EmbeddedHastData;
      }),
    );
  };
};

export default remarkKDiagram;
export { remarkKDiagram };

function mapDiagnostic(node: Code, diagnostic: Diagnostic): KDiagramRemarkDiagnostic {
  const contentStart = (node.position?.start.line ?? 1) + 1;
  const mapped = offsetKDiagramDiagnostic(diagnostic, contentStart);
  return {
    ...diagnostic,
    markdownLine: mapped.hostLine,
    markdownEndLine: mapped.hostEndLine,
  };
}
