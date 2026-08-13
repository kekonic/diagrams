import type { IconifyJSON, IconifyIcon } from "@iconify/types";
import { getIconData, iconToSVG, replaceIDs } from "@iconify/utils";
import { resolveBuiltinIcon } from "./builtins.ts";
import { DEFAULT_COLLECTION_LOADERS, type CollectionLoader } from "./collections.ts";
import { normalizeIconId, parseIconId } from "./parse-icon-id.ts";
import type { ResolvedIcon } from "./types.ts";

const collectionCache = new Map<string, IconifyJSON>();
const collectionLoaders = new Map<string, CollectionLoader>(
  Object.entries(DEFAULT_COLLECTION_LOADERS),
);
const collectionPromises = new Map<string, Promise<IconifyJSON | null>>();
const iconCache = new Map<string, ResolvedIcon | null>();
const customIcons = new Map<string, ResolvedIcon>();
const customCollectionLoaders = new Set<string>();
let iconifyApiBaseUrl = "https://api.iconify.design";

function viewBoxFromIcon(data: IconifyIcon): { viewBox: string; width: number; height: number } {
  const left = data.left ?? 0;
  const top = data.top ?? 0;
  const width = data.width ?? 16;
  const height = data.height ?? 16;
  return {
    viewBox: `${left} ${top} ${width} ${height}`,
    width,
    height,
  };
}

function fromIconify(id: string, data: IconifyIcon): ResolvedIcon {
  const built = iconToSVG(data, { height: "unset", width: "unset" });
  const meta = viewBoxFromIcon(data);
  // Keep original fills; theme adaptation happens at render when paint is `theme`.
  const body = replaceIDs(built.body);
  return {
    id,
    body,
    viewBox: built.attributes.viewBox ?? meta.viewBox,
    width: meta.width,
    height: meta.height,
    paint: "fill",
  };
}

/** Register a one-off icon (custom architecture SVG body + viewBox). */
export function registerIcon(id: string, icon: Omit<ResolvedIcon, "id">): void {
  const normalized = normalizeIconId(id);
  const resolved: ResolvedIcon = { id: normalized, ...icon };
  customIcons.set(normalized, resolved);
  iconCache.set(normalized, resolved);
}

/** Register or replace a whole Iconify JSON collection (eager). */
export function registerCollection(prefix: string, data: IconifyJSON): void {
  const key = prefix.toLowerCase();
  collectionCache.set(key, data);
  collectionLoaders.set(key, async () => data);
  // Invalidate cached misses for this prefix.
  for (const [id, value] of iconCache) {
    if (id.startsWith(`${key}:`) && value === null) iconCache.delete(id);
  }
}

/** Hook a lazy loader for a custom / extra Iconify prefix. */
export function registerCollectionLoader(prefix: string, loader: CollectionLoader): void {
  const key = prefix.toLowerCase();
  collectionLoaders.set(key, loader);
  customCollectionLoaders.add(key);
}

/** Override the Iconify API origin used for per-icon browser loading. */
export function setIconifyApiBaseUrl(url: string): void {
  iconifyApiBaseUrl = url.replace(/\/$/, "");
}

async function loadCollection(prefix: string): Promise<IconifyJSON | null> {
  const key = prefix.toLowerCase();
  const cached = collectionCache.get(key);
  if (cached) return cached;
  let pending = collectionPromises.get(key);
  if (!pending) {
    const loader = collectionLoaders.get(key);
    if (!loader) {
      collectionPromises.set(key, Promise.resolve(null));
      return null;
    }
    pending = loader()
      .then((data) => {
        collectionCache.set(key, data);
        return data;
      })
      .catch((err) => {
        // Allow retry after fixing deps / Vite resolution.
        collectionPromises.delete(key);
        console.warn(`[kdiagram-icons] failed to load collection "${key}"`, err);
        return null;
      });
    collectionPromises.set(key, pending);
  }
  return pending;
}

function resolveFromLoaded(prefix: string, name: string, id: string): ResolvedIcon | null {
  if (prefix === "builtin") return resolveBuiltinIcon(name);
  const custom = customIcons.get(id);
  if (custom) return custom;
  const set = collectionCache.get(prefix);
  if (!set) return null;
  const data = getIconData(set, name);
  if (!data) return null;
  return fromIconify(id, data);
}

function mergeCollection(existing: IconifyJSON | undefined, incoming: IconifyJSON): IconifyJSON {
  if (!existing) return incoming;
  return {
    ...existing,
    ...incoming,
    icons: { ...existing.icons, ...incoming.icons },
    aliases: { ...existing.aliases, ...incoming.aliases },
  };
}

async function loadRemoteIcons(prefix: string, names: string[]): Promise<void> {
  if (typeof fetch !== "function" || names.length === 0) return;
  const params = new URLSearchParams({ icons: names.join(",") });
  const response = await fetch(`${iconifyApiBaseUrl}/${encodeURIComponent(prefix)}.json?${params}`);
  if (!response.ok) {
    throw new Error(`Iconify API returned ${response.status} for collection "${prefix}"`);
  }
  const data = (await response.json()) as IconifyJSON;
  collectionCache.set(prefix, mergeCollection(collectionCache.get(prefix), data));
}

/**
 * Synchronous lookup — works for builtins, customs, and anything already preloaded.
 * Returns null if the collection has not been loaded yet or the icon is missing.
 */
export function resolveIcon(raw: string): ResolvedIcon | null {
  const parsed = parseIconId(raw);
  if (!parsed) return null;
  if (iconCache.has(parsed.id)) return iconCache.get(parsed.id) ?? null;
  const resolved = resolveFromLoaded(parsed.prefix, parsed.name, parsed.id);
  if (resolved || collectionCache.has(parsed.prefix) || parsed.prefix === "builtin") {
    iconCache.set(parsed.id, resolved);
  }
  return resolved;
}

/** Ensure collections for the given icon ids are loaded, then cache each icon. */
export async function preloadIcons(rawIds: Iterable<string>): Promise<void> {
  const parsed = [...rawIds]
    .map((raw) => parseIconId(raw))
    .filter((p): p is NonNullable<typeof p> => p != null);

  const grouped = new Map<string, string[]>();
  for (const icon of parsed) {
    if (icon.prefix === "builtin" || iconCache.has(icon.id)) continue;
    const names = grouped.get(icon.prefix) ?? [];
    if (!names.includes(icon.name)) names.push(icon.name);
    grouped.set(icon.prefix, names);
  }

  const inBrowser = typeof window !== "undefined";
  await Promise.all(
    [...grouped].map(async ([prefix, names]) => {
      const loaded = collectionCache.get(prefix);
      const missingNames = loaded ? names.filter((name) => !getIconData(loaded, name)) : names;
      if (missingNames.length === 0) return;
      if (!inBrowser || customCollectionLoaders.has(prefix)) {
        await loadCollection(prefix);
        return;
      }
      await loadRemoteIcons(prefix, missingNames);
    }),
  ).catch((err) => {
    console.warn("[kdiagram-icons] failed to preload requested icons", err);
  });

  for (const p of parsed) {
    if (iconCache.has(p.id)) continue;
    iconCache.set(p.id, resolveFromLoaded(p.prefix, p.name, p.id));
  }
}

/** Warm one or more collections without resolving specific icons. */
export async function preloadCollections(prefixes: string[]): Promise<void> {
  const inBrowser = typeof window !== "undefined";
  await Promise.all(
    prefixes.map((p) => {
      const prefix = p.toLowerCase();
      if (inBrowser && !customCollectionLoaders.has(prefix)) {
        console.warn(
          `[kdiagram-icons] preloadCollections("${prefix}") requires registerCollectionLoader in the browser; individual icons load on demand`,
        );
        return Promise.resolve(null);
      }
      return loadCollection(prefix);
    }),
  );
}

/** Collect unique icon ids from a graph-like node list. */
export function collectIconIds(nodes: Iterable<{ icon?: string | null | undefined }>): string[] {
  const ids = new Set<string>();
  for (const node of nodes) {
    if (!node.icon || node.icon === "none") continue;
    const normalized = normalizeIconId(node.icon);
    if (normalized !== "none") ids.add(normalized);
  }
  return [...ids];
}

/** Test helper — clear caches between cases. */
export function resetIconCaches(): void {
  iconCache.clear();
  collectionCache.clear();
  collectionPromises.clear();
  customCollectionLoaders.clear();
  iconifyApiBaseUrl = "https://api.iconify.design";
  collectionLoaders.clear();
  for (const [prefix, loader] of Object.entries(DEFAULT_COLLECTION_LOADERS)) {
    collectionLoaders.set(prefix, loader);
  }
}
