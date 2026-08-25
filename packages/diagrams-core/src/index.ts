// Public API for @kekonic/diagrams-core — parse, compile, graph model, format.
export type * from "./types/index.ts";
export {
  inferAutoAnimation,
  planAutoWalk,
  enumerateAutoPaths,
  traceDeclarationPath,
  animationIdFromName,
  bindSequenceFlowEdgeIds,
  flowHopEdgeId,
} from "./animation/index.ts";
export type { FlowEdgeRefs } from "./animation/index.ts";
export type { AutoWalkStep } from "./animation/index.ts";
export type { AnimationTarget, AnimationCue, AnimationDefinition } from "./animation/index.ts";
export { classifyBranch, normalizeBranch } from "./types/branch.ts";
export {
  parseCardinality,
  isPureCardinalityLabel,
  cardinalityLabel,
  fkCardinality,
} from "./types/cardinality.ts";
export {
  parseTableColumnSpec,
  parseTableColumns,
  findColumnIndex,
  formatTableColumnLine,
  parseColumnRef,
  referencedColumns,
  inferFkRelationship,
  formatColumnRef,
  fkColumnsForParent,
} from "./types/table.ts";
export {
  SEQUENCE_FRAGMENT_ALIASES,
  normalizeSequenceFragmentOperator,
  sequenceFragmentDisplayName,
} from "./types/sequence.ts";
export type {
  DiagramKind,
  SequenceFragmentOperator,
  SequenceMessageKind,
  SequenceNotePlacement,
  SequenceMessage,
  SequenceActivation,
  SequenceFragmentOperand,
  SequenceFragment,
  SequenceNote,
  SequenceDivider,
  SequenceIR,
} from "./types/sequence.ts";
export { parse } from "./parser/index.ts";
export type * from "./parser/ast.ts";
export { EDGE_OPS, edgeOpsPattern, STATEMENT_KEYWORDS } from "./parser/lexer.ts";
export type { EdgeOperator } from "./parser/edge-ops.ts";
export {
  compile,
  compileDocument,
  listCompileTargets,
  projectSemanticGraph,
  extractIntentFromStatements,
  intentFromBlock,
  lintViewIntent,
  getKindDefaults,
  isBuiltinKind,
  BUILTIN_KIND_LIST,
} from "./compiler/index.ts";
export type { CompileTarget, CompileTargetDescriptor, SemanticGraph } from "./compiler/index.ts";
export {
  kindHasCapability,
  kindSubtitle,
  listKindsByCategory,
  listGeometryKinds,
  isGeometryKind,
  BUILTIN_KIND_CATALOG,
} from "./compiler/index.ts";
export type { NodeKindDefaults, NodeKindCategory, NodeCapability } from "./compiler/index.ts";
export {
  BUILTIN_SHAPE_IDS,
  GROUP_CHROME_SHAPE_IDS,
  normalizeShapeId,
  normalizeGroupChromeShapeId,
  isKnownShapeId,
  isGroupChromeShapeId,
  listBuiltinShapeIds,
  listGroupChromeShapeIds,
} from "./types/shapes.ts";
export type { ShapeId, BuiltinShapeId, GroupChromeShapeId } from "./types/shapes.ts";
export { formatSource, formatAst } from "./format/print.ts";
export { mergeOptions } from "./types/graph.ts";
export {
  resolvePresentation,
  formatLabelText,
  displayLabelCase,
  mergePresentationOptions,
  presentationFromProperties,
} from "./types/presentation.ts";
export type {
  PresentationOptions,
  ResolvedPresentation,
  LabelCasePolicy,
  RemovedPresentationProp,
} from "./types/presentation.ts";
export { REMOVED_PRESENTATION_PROPS } from "./types/presentation.ts";
export {
  expandRect,
  manhattan,
  rectsOverlap,
  rectCenter,
  rectRight,
  rectBottom,
} from "./types/geometry.ts";
