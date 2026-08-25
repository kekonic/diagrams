export { compile, compileDocument } from "./compile-document.ts";
export type { CompileTarget, CompileTargetDescriptor } from "./compile-document.ts";
export { listCompileTargets } from "./compile-target.ts";
export type { SemanticGraph } from "./project-view.ts";
export {
  projectSemanticGraph,
  extractIntentFromStatements,
  intentFromBlock,
} from "./project-view.ts";
export { lintViewIntent } from "./lint-intent.ts";
export {
  getKindDefaults,
  isBuiltinKind,
  isGeometryKind,
  kindHasCapability,
  kindSubtitle,
  listKindsByCategory,
  listGeometryKinds,
  BUILTIN_KIND_LIST,
  BUILTIN_KIND_CATALOG,
  type NodeKindDefaults,
  type NodeKindCategory,
  type NodeCapability,
} from "./kinds.ts";
