import { renderKDiagramSvg } from "@kekonic/diagrams-ui";
import { GALLERY_EXAMPLES } from "./gallery-catalog.ts";
import { sourceByExport } from "./gallery-sources.ts";

export type GalleryPayload = {
  sources: Record<string, string>;
  thumbs: Record<string, string>;
};

function namespaceSvgIds(svg: string, ns: string): string {
  const ids = [...svg.matchAll(/\sid="([^"]+)"/g)].map((match) => match[1]);
  const unique = [...new Set(ids)].sort((a, b) => b.length - a.length);
  let out = svg;
  for (const id of unique) {
    const scoped = `${ns}__${id}`;
    out = out.replaceAll(`id="${id}"`, `id="${scoped}"`);
    out = out.replaceAll(`url(#${id})`, `url(#${scoped})`);
    out = out.replaceAll(`url("#${id}")`, `url("#${scoped}")`);
    out = out.replaceAll(`url('#${id}')`, `url('#${scoped}')`);
    out = out.replaceAll(`href="#${id}"`, `href="#${scoped}"`);
    out = out.replaceAll(`xlink:href="#${id}"`, `xlink:href="#${scoped}"`);
  }
  return out;
}

let payloadPromise: Promise<GalleryPayload> | undefined;

/** Build-once live-theme thumbs + sources for the gallery app. */
export function loadGalleryPayload(): Promise<GalleryPayload> {
  payloadPromise ??= (async () => {
    const sources: Record<string, string> = {};
    const thumbs: Record<string, string> = {};
    for (const example of GALLERY_EXAMPLES) {
      const source = sourceByExport(example.sourceExport);
      sources[example.id] = source;
      const { svg } = await renderKDiagramSvg(source, {
        snapshotTheme: false,
        theme: "auto",
      });
      thumbs[example.id] = namespaceSvgIds(svg, `g-${example.id}`);
    }
    return { sources, thumbs };
  })();
  return payloadPromise;
}
