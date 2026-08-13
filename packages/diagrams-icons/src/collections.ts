import type { IconifyJSON } from "@iconify/types";

export type CollectionLoader = () => Promise<IconifyJSON>;

/**
 * Node can `require()` Iconify JSON directly. Keep this off the browser path —
 * Vite serves JSON as JS modules, so `import(..., { with: { type: "json" } })`
 * fails with a MIME type error in the studio.
 */
async function loadViaNodeRequire(specifier: string): Promise<IconifyJSON | null> {
  if (typeof window !== "undefined") return null;
  try {
    const runtimeProcess = (
      globalThis as typeof globalThis & {
        process?: { getBuiltinModule?: (id: string) => unknown };
      }
    ).process;
    const moduleBuiltin = runtimeProcess?.getBuiltinModule?.("module") as
      | typeof import("node:module")
      | undefined;
    if (!moduleBuiltin) return null;

    const { createRequire } = moduleBuiltin;
    const require = createRequire(import.meta.url);
    return require(specifier) as IconifyJSON;
  } catch {
    return null;
  }
}

/**
 * Load a complete Iconify JSON collection in Node. Browser rendering resolves only
 * the requested icons through the Iconify API in `resolve.ts`; keeping static JSON
 * imports out of this module prevents bundlers from emitting multi-megabyte chunks.
 */
async function loadIconifyJson(specifier: string): Promise<IconifyJSON> {
  const fromNode = await loadViaNodeRequire(specifier);
  if (fromNode) return fromNode;
  throw new Error(
    `Complete Iconify collection "${specifier}" is unavailable in the browser; resolve individual icons or register a collection`,
  );
}

/**
 * Built-in Iconify collections (architecture + general).
 * Each is loaded only on first use of that prefix.
 */
export const DEFAULT_COLLECTION_LOADERS: Record<string, CollectionLoader> = {
  mdi: () => loadIconifyJson("@iconify-json/mdi/icons.json"),
  logos: () => loadIconifyJson("@iconify-json/logos/icons.json"),
  lucide: () => loadIconifyJson("@iconify-json/lucide/icons.json"),
  carbon: () => loadIconifyJson("@iconify-json/carbon/icons.json"),
  "simple-icons": () => loadIconifyJson("@iconify-json/simple-icons/icons.json"),
};

export function listDefaultCollections(): string[] {
  return Object.keys(DEFAULT_COLLECTION_LOADERS);
}
