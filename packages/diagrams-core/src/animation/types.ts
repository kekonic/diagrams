/** Compiled animation targeting graph nodes/edges by id. */

export type AnimationTarget =
  | { type: "all" }
  | { type: "node"; id: string }
  | { type: "edge"; from: string; to: string };

export type AnimationCue =
  | { op: "dim"; targets: AnimationTarget[] }
  | { op: "activate"; targets: AnimationTarget[] }
  | { op: "pulse"; targets: AnimationTarget[]; durationMs: number }
  | {
      op: "flow";
      path: string[];
      durationMs: number;
      /** Prefer this edge when from→to is ambiguous (sequence, single hop). */
      edgeId?: string;
      /**
       * Per-hop edge ids aligned with `path` (`path.length - 1` entries).
       * When present, index `i` is the edge for hop `path[i] → path[i+1]`.
       */
      edgeIds?: string[];
    }
  | { op: "wait"; durationMs: number }
  /** Sibling cues that share one clock — duration is max(child durations). */
  | { op: "parallel"; cues: AnimationCue[] };

export type AnimationDefinition = {
  /** Stable slug (from authored name, or `"auto"` for inferred). */
  id: string;
  /** Display name for the picker. */
  name: string;
  loop: boolean;
  cues: AnimationCue[];
  /**
   * `authored` — explicit cues.
   * `auto` — empty opt-in block; player fills cues via `inferAutoAnimation`.
   */
  source: "auto" | "authored";
};
