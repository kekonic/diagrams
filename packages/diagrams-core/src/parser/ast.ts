import type { SourceRange } from "../types/geometry.ts";
import type { SequenceFragmentOperator } from "../types/sequence.ts";
export type { EdgeOperator } from "./edge-ops.ts";
import type { EdgeOperator } from "./edge-ops.ts";

export type PropertyValue = string | number | boolean | string[];
export type PropertyMap = Record<string, PropertyValue>;

export type KDiagramAst = {
  type: "Document";
  version?: number;
  body: TopLevelNode[];
  diagnostics: import("../types/geometry.ts").Diagnostic[];
};

export type TopLevelNode = DiagramAst | SequenceAst | ModelAst;

export type ModelAst = {
  type: "Model";
  name?: string;
  /** Semantic statements: nodes, edges, groups, styles — no views. */
  statements: ModelStatementAst[];
  views: ViewAst[];
  range: SourceRange;
};

export type ViewAst = {
  type: "View";
  name: string;
  statements: ViewStatementAst[];
  range: SourceRange;
};

/** Semantic-only statements allowed inside `model { … }`. */
export type ModelStatementAst =
  | NodeAst
  | EdgeAst
  | GroupAst
  | StyleAst
  | StyleRefAst
  | GroupMemberAst;

export type ViewStatementAst =
  | IntentBlockAst
  | IncludeAst
  | ExcludeAst
  | CollapseAst
  | DirectiveAst
  | LayoutBlockAst
  | EdgePolicyBlockAst
  | RenderBlockAst
  | PresentationBlockAst
  | AnimationBlockAst;

export type IntentBlockAst = {
  type: "IntentBlock";
  properties: PropertyMap;
  range: SourceRange;
};

export type IncludeAst = {
  type: "Include";
  selectors: string[];
  range: SourceRange;
};

export type ExcludeAst = {
  type: "Exclude";
  selectors: string[];
  range: SourceRange;
};

export type CollapseAst = {
  type: "Collapse";
  groupId: string;
  nodeId: string;
  kind: string;
  label?: string;
  range: SourceRange;
};

export type DiagramAst = {
  type: "Diagram";
  diagramKind: "flow" | "state";
  /** Optional quoted title after `diagram` — used for SVG/a11y and presentation chrome. */
  name?: string;
  statements: StatementAst[];
  range: SourceRange;
};

/** Classical UML sequence diagram — time-axis layout, not ELK layered flow. */
export type SequenceAst = {
  type: "Sequence";
  name?: string;
  statements: SequenceStatementAst[];
  range: SourceRange;
};

export type StatementAst =
  | NodeAst
  | EdgeAst
  | GroupAst
  | StyleAst
  | StyleRefAst
  | GroupMemberAst
  | DirectiveAst
  | LayoutBlockAst
  | EdgePolicyBlockAst
  | RenderBlockAst
  | PresentationBlockAst
  | AnimationBlockAst
  | IntentBlockAst;

export type SequenceStatementAst =
  | NodeAst
  | EdgeAst
  | StyleAst
  | StyleRefAst
  | DirectiveAst
  | LayoutBlockAst
  | EdgePolicyBlockAst
  | RenderBlockAst
  | PresentationBlockAst
  | AnimationBlockAst
  | SequenceActivateAst
  | SequenceDeactivateAst
  | SequenceCreateAst
  | SequenceDestroyAst
  | SequenceNoteAst
  | SequenceDividerAst
  | SequenceAutonumberAst
  | SequenceFragmentAst;

export type SequenceActivateAst = {
  type: "SequenceActivate";
  participantId: string;
  range: SourceRange;
};

export type SequenceDeactivateAst = {
  type: "SequenceDeactivate";
  participantId: string;
  range: SourceRange;
};

export type SequenceCreateAst = {
  type: "SequenceCreate";
  node: NodeAst;
  range: SourceRange;
};

export type SequenceDestroyAst = {
  type: "SequenceDestroy";
  participantId: string;
  range: SourceRange;
};

export type SequenceNoteAst = {
  type: "SequenceNote";
  placement: "over" | "left" | "right";
  participantIds: string[];
  text: string;
  range: SourceRange;
};

export type SequenceDividerAst = {
  type: "SequenceDivider";
  label?: string;
  range: SourceRange;
};

export type SequenceAutonumberAst = {
  type: "SequenceAutonumber";
  range: SourceRange;
};

export type SequenceFragmentAst = {
  type: "SequenceFragment";
  operator: SequenceFragmentOperator;
  label?: string;
  /** Semantic / authored styles (`is danger`, `is timeoutBand`). */
  styleRefs: string[];
  operands: SequenceFragmentOperandAst[];
  range: SourceRange;
};

export type SequenceFragmentOperandAst = {
  /** `else` / `and` label, or primary fragment label. */
  label?: string;
  /** Per-operand styles (`else "timeout" is danger`). */
  styleRefs: string[];
  statements: SequenceStatementAst[];
  range: SourceRange;
};

export type AnimationTargetAst =
  | { type: "all" }
  | { type: "node"; id: string }
  | { type: "edge"; from: string; to: string };

export type AnimationCueAst =
  | { type: "dim"; targets: AnimationTargetAst[]; range: SourceRange }
  | { type: "activate"; targets: AnimationTargetAst[]; range: SourceRange }
  | {
      type: "pulse";
      targets: AnimationTargetAst[];
      durationMs?: number;
      range: SourceRange;
    }
  | {
      type: "flow";
      path: string[];
      durationMs?: number;
      range: SourceRange;
    }
  | { type: "wait"; durationMs: number; range: SourceRange }
  | { type: "loop"; range: SourceRange }
  | { type: "parallel"; cues: AnimationCueAst[]; range: SourceRange };

export type AnimationBlockAst = {
  type: "AnimationBlock";
  name: string;
  cues: AnimationCueAst[];
  range: SourceRange;
};

export type NodeAst = {
  type: "Node";
  id: string;
  kind: string;
  label?: string;
  properties: PropertyMap;
  /** From inline `is styleName` on the declaration (before or after `{ … }`). */
  styleRefs: string[];
  range: SourceRange;
};

export type EdgeAst = {
  type: "Edge";
  from: string;
  to: string;
  /** Optional column on the source table (ERD: `customers.id -> …`). */
  fromColumn?: string;
  /** Optional column on the target table (ERD: `… -> orders.customer_id`). */
  toColumn?: string;
  op: EdgeOperator;
  label?: string;
  properties: PropertyMap;
  styleRefs: string[];
  range: SourceRange;
};

export type GroupAst = {
  type: "Group";
  id?: string;
  label?: string;
  groupKind: "group" | "boundary" | "zone" | "swimlane";
  statements: StatementAst[];
  properties: PropertyMap;
  range: SourceRange;
};

export type StyleAst = {
  type: "Style";
  name: string;
  target: "node" | "edge" | "fragment";
  properties: PropertyMap;
  range: SourceRange;
};

export type StyleRefAst = {
  type: "StyleRef";
  targetIds: string[];
  styleName: string;
  range: SourceRange;
};

export type GroupMemberAst = {
  type: "GroupMember";
  nodeIds: string[];
  range: SourceRange;
};

export type DirectiveAst = {
  type: "Directive";
  name: string;
  /** Scalar or identifier list (e.g. `columns: [edge, core, data]`). */
  value?: string | number | boolean | string[];
  range: SourceRange;
};

export type LayoutBlockAst = {
  type: "LayoutBlock";
  properties: PropertyMap;
  range: SourceRange;
};

export type EdgePolicyBlockAst = {
  type: "EdgePolicyBlock";
  properties: PropertyMap;
  range: SourceRange;
};

export type RenderBlockAst = {
  type: "RenderBlock";
  properties: PropertyMap;
  range: SourceRange;
};

export type PresentationBlockAst = {
  type: "PresentationBlock";
  properties: PropertyMap;
  range: SourceRange;
};
