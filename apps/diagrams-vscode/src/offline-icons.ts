import {
  listDefaultCollections,
  registerCollectionLoader,
  setIconifyApiBaseUrl,
} from "@kekonic/diagrams";

let iconCollectionsReady: Promise<void> | undefined;

/**
 * Resolve the contributed browser script URL so Iconify JSON can be fetched from
 * `dist/node_modules/@iconify-json/*` beside that script (no CDN).
 */
export function contributedScriptUrl(scriptNameIncludes: string): string {
  const script = document.querySelector<HTMLScriptElement>(`script[src*="${scriptNameIncludes}"]`);
  if (!script?.src) {
    throw new Error(`Kekonic Diagrams script URL unavailable (${scriptNameIncludes})`);
  }
  return script.src;
}

export function ensureOfflineIconCollections(scriptNameIncludes: string): Promise<void> {
  iconCollectionsReady ??= (async () => {
    const scriptUrl = contributedScriptUrl(scriptNameIncludes);
    // Point the unused browser CDN fallback at the extension origin; collections load from
    // shipped JSON via registerCollectionLoader instead.
    setIconifyApiBaseUrl(new URL(".", scriptUrl).toString());
    await Promise.all(
      listDefaultCollections().map(async (prefix) => {
        registerCollectionLoader(prefix, async () => {
          const url = new URL(`./node_modules/@iconify-json/${prefix}/icons.json`, scriptUrl);
          const response = await fetch(url);
          if (!response.ok) {
            throw new Error(`Failed to load icon collection "${prefix}" (${response.status})`);
          }
          return response.json();
        });
      }),
    );
  })();
  return iconCollectionsReady;
}
