import type { IconifyIcon, IconifyJSON } from "@iconify/types";
import { getIconData } from "@iconify/utils";
import { DEFAULT_COLLECTION_LOADERS } from "./collections.ts";

/**
 * Load a bounded, flattened subset of a built-in Iconify collection.
 *
 * This is intended for trusted local hosts that serve requested icons from their installed
 * packages. Default collection loading is Node-only; browser clients should request the subset
 * from their same-origin host.
 */
export async function loadIconSubset(
  prefix: string,
  names: Iterable<string>,
): Promise<IconifyJSON | null> {
  const normalizedPrefix = prefix.toLowerCase();
  const loader = DEFAULT_COLLECTION_LOADERS[normalizedPrefix];
  if (!loader) return null;

  const collection = await loader();
  const icons: Record<string, IconifyIcon> = {};
  for (const name of new Set(names)) {
    const icon = getIconData(collection, name);
    if (icon) icons[name] = icon;
  }

  return {
    prefix: normalizedPrefix,
    width: collection.width,
    height: collection.height,
    icons,
  };
}
