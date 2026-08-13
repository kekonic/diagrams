export type {
  ParsedIconId,
  ResolvedIcon,
  IconRenderOptions,
  IconPaintMode,
  IconDisplaySize,
} from "./types.ts";
export {
  BUILTIN_ICON_NAMES,
  BUILTIN_ICON_ALIASES,
  normalizeIconId,
  parseIconId,
  listBuiltinIconIds,
  type BuiltinIconName,
} from "./parse-icon-id.ts";
export { BUILTIN_ICONS, resolveBuiltinIcon } from "./builtins.ts";
export { DEFAULT_COLLECTION_LOADERS, listDefaultCollections } from "./collections.ts";
export type { CollectionLoader } from "./collections.ts";
export { loadIconSubset } from "./subset.ts";
export { adaptIconBodyColors, isThemeableInk } from "./adapt-colors.ts";
export { defaultIconPaint, resolveIconPaint } from "./paint.ts";
export { iconDisplaySize } from "./size.ts";
export {
  registerIcon,
  registerCollection,
  registerCollectionLoader,
  setIconifyApiBaseUrl,
  resolveIcon,
  preloadIcons,
  preloadCollections,
  collectIconIds,
  resetIconCaches,
} from "./resolve.ts";
export { renderIconSvg, renderIconById } from "./render.ts";
