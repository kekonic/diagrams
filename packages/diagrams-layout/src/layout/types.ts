import type { BoxPadding, Direction, Point, Rect } from "@kekonic/diagrams-core";

export type LaidOutNode = {
  nodeId: string;
  bounds: Rect;
  rank: number;
  order: number;
};

export type LaidOutGroup = {
  groupId: string;
  bounds: Rect;
  labelBox: Rect;
  padding: BoxPadding;
  /** Left title strip when this group is a laid-out swimlane band. */
  headerBox?: Rect;
};

/** Orthogonal polyline produced by ELK for one edge. */
export type LayoutEdgePath = {
  edgeId: string;
  points: Point[];
};

/** Edge label position from ELK (absolute). */
export type LayoutEdgeLabel = {
  edgeId: string;
  text: string;
  bounds: Rect;
  anchor: Point;
};

/**
 * ELK owns node placement and edge geometry together.
 * `edgePaths` / `edgeLabels` come from the same layout call as `nodes`/`groups`.
 * Sequence diagrams attach optional `sequence` artifacts (lifelines, activations, …).
 */
export type LayoutResult = {
  nodes: LaidOutNode[];
  groups: LaidOutGroup[];
  edgePaths: LayoutEdgePath[];
  edgeLabels: LayoutEdgeLabel[];
  direction: Direction;
  algorithmVersion: string;
  layoutMs: number;
  width: number;
  height: number;
  /** Present when layout ran the sequence time-axis engine. */
  sequence?: import("./sequence/layout-sequence.ts").SequenceLayoutArtifacts;
};
