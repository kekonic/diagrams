import type { SourceRange } from "./geometry.ts";

/** Diagram surface — flow/state use ELK; sequence uses the time-axis layout engine. */
export type DiagramKind = "flow" | "state" | "sequence";

export type SequenceMessageKind =
  | "sync"
  | "async"
  | "return"
  | "create"
  | "destroy"
  | "failure"
  | "found"
  | "lost";

/**
 * Combined-fragment operators (canonical long names).
 * Parser also accepts Mermaid-style aliases: alt, opt, par, group.
 */
export type SequenceFragmentOperator =
  | "alternate"
  | "optional"
  | "loop"
  | "parallel"
  | "critical"
  | "break"
  | "section";

/** Map authored keyword (including aliases) → canonical operator. */
export const SEQUENCE_FRAGMENT_ALIASES: Record<string, SequenceFragmentOperator> = {
  alt: "alternate",
  alternate: "alternate",
  opt: "optional",
  optional: "optional",
  loop: "loop",
  par: "parallel",
  parallel: "parallel",
  critical: "critical",
  break: "break",
  group: "section",
  section: "section",
  box: "section",
};

/** Title-case label painted on the fragment frame (newcomer-friendly). */
export function sequenceFragmentDisplayName(operator: SequenceFragmentOperator): string {
  switch (operator) {
    case "alternate":
      return "Alternate";
    case "optional":
      return "Optional";
    case "loop":
      return "Loop";
    case "parallel":
      return "Parallel";
    case "critical":
      return "Critical";
    case "break":
      return "Break";
    case "section":
      return "Section";
  }
}

export function normalizeSequenceFragmentOperator(
  word: string,
): SequenceFragmentOperator | undefined {
  return SEQUENCE_FRAGMENT_ALIASES[word.toLowerCase()];
}

export type SequenceNotePlacement = "over" | "left" | "right";

export type SequenceMessage = {
  id: string;
  order: number;
  from: string | null;
  to: string | null;
  kind: SequenceMessageKind;
  label?: string;
  labelAuthored?: boolean;
  /** Pair return messages back to the call that opened them (when known). */
  replyTo?: string;
  sourceRange?: SourceRange;
};

export type SequenceActivation = {
  id: string;
  participantId: string;
  startOrder: number;
  endOrder: number;
  sourceRange?: SourceRange;
};

export type SequenceFragmentOperand = {
  label?: string;
  styleRefs: string[];
  /** Inclusive message-order span covered by this operand. */
  startOrder: number;
  endOrder: number;
  children: SequenceFragment[];
};

export type SequenceFragment = {
  id: string;
  operator: SequenceFragmentOperator;
  label?: string;
  /** `is danger` / authored fragment styles. */
  styleRefs: string[];
  /** Inline CSS vars from `style … for fragment` resolution inputs (compile-time bag). */
  unresolvedVars: Record<string, string>;
  startOrder: number;
  endOrder: number;
  operands: SequenceFragmentOperand[];
  sourceRange?: SourceRange;
};

export type SequenceNote = {
  id: string;
  order: number;
  placement: SequenceNotePlacement;
  participantIds: string[];
  text: string;
  sourceRange?: SourceRange;
};

export type SequenceDivider = {
  id: string;
  order: number;
  label?: string;
  sourceRange?: SourceRange;
};

/**
 * Sequence-specific IR compiled beside GraphModel.
 * Ordering, activations, and fragments live here — not on unordered GraphEdge alone.
 */
export type SequenceIR = {
  autonumber: boolean;
  messages: SequenceMessage[];
  activations: SequenceActivation[];
  fragments: SequenceFragment[];
  notes: SequenceNote[];
  dividers: SequenceDivider[];
  /** Participant ids in declaration order (X axis). */
  participantOrder: string[];
};
