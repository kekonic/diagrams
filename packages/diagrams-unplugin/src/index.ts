import { readFile } from "node:fs/promises";
import { dirname, isAbsolute, resolve } from "node:path";
import {
  createKDiagramDataUrl,
  createKDiagramModule,
  formatKDiagramBuildError,
  renderKDiagramForBuild,
  type KDiagramBuildOptions,
} from "@kekonic/diagrams-build";
import { createUnplugin, type UnpluginFactory } from "unplugin";

const RESOLVED_PREFIX = "\0kdiagram:";
const QUERY_KINDS = ["svg", "url", "source", "react", "element"] as const;

export type KDiagramImportKind = (typeof QUERY_KINDS)[number];

export type KDiagramUnpluginOptions = KDiagramBuildOptions;

export type KDiagramRequest = {
  filename: string;
  kind?: KDiagramImportKind;
};

export function parseKDiagramRequest(id: string, importer?: string): KDiagramRequest | undefined {
  const unresolved = id.startsWith(RESOLVED_PREFIX) ? id.slice(RESOLVED_PREFIX.length) : id;
  const queryIndex = unresolved.indexOf("?");
  const pathname = queryIndex === -1 ? unresolved : unresolved.slice(0, queryIndex);
  if (!pathname.endsWith(".kdiagram")) return undefined;

  const filename = isAbsolute(pathname)
    ? pathname
    : resolve(importer ? dirname(importer) : process.cwd(), pathname);
  if (queryIndex === -1) return { filename };

  const query = unresolved.slice(queryIndex + 1);
  const kind = QUERY_KINDS.find((candidate) => candidate === query);
  return { filename, kind };
}

export const kdiagramUnpluginFactory: UnpluginFactory<KDiagramUnpluginOptions | undefined> = (
  options = {},
) => ({
  name: "kdiagram",
  enforce: "pre",
  resolveId(id, importer) {
    const request = parseKDiagramRequest(id, importer);
    if (!request) return;
    const suffix = request.kind ? `?${request.kind}` : "";
    return `${RESOLVED_PREFIX}${request.filename}${suffix}`;
  },
  async load(id) {
    if (!id.startsWith(RESOLVED_PREFIX)) return;
    const request = parseKDiagramRequest(id);
    if (!request) return;
    if (!request.kind) {
      return this.error(
        `KDiagram imports require one of ${QUERY_KINDS.map((kind) => `?${kind}`).join(", ")}: ${request.filename}`,
      );
    }

    this.addWatchFile(request.filename);
    const source = await readFile(request.filename, "utf8");
    if (request.kind === "source" || request.kind === "react" || request.kind === "element") {
      return createKDiagramModule(request.kind, source);
    }

    const result = await renderKDiagramForBuild(source, options);
    if (!result.svg) return this.error(formatKDiagramBuildError(result.diagnostics));
    for (const diagnostic of result.diagnostics) {
      this.warn(`${request.filename}: ${diagnostic.code}: ${diagnostic.message}`);
    }
    if (request.kind === "svg") return createKDiagramModule("svg", source, result.svg);

    return `export default ${JSON.stringify(createKDiagramDataUrl(result.svg))};\n`;
  },
});

const kdiagramUnplugin = /* #__PURE__ */ createUnplugin(kdiagramUnpluginFactory);

export default kdiagramUnplugin;
export { kdiagramUnplugin };
