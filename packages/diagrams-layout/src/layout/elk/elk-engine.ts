/** Shared elk engine — elkjs today (elk-rs drop-in when published). */
import ELK from "elkjs/lib/elk.bundled.js";

export type ElkPoint = { x: number; y: number };

export type ElkLabel = {
  id?: string;
  text: string;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  layoutOptions?: Record<string, string>;
};

export type ElkEdgeSection = {
  id?: string;
  startPoint: ElkPoint;
  endPoint: ElkPoint;
  bendPoints?: ElkPoint[];
};

export type ElkPort = {
  id: string;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  layoutOptions?: Record<string, string>;
};

export type ElkEdge = {
  id: string;
  sources: string[];
  targets: string[];
  sections?: ElkEdgeSection[];
  labels?: ElkLabel[];
  layoutOptions?: Record<string, string>;
};

export type ElkNode = {
  id: string;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  children?: ElkNode[];
  edges?: ElkEdge[];
  ports?: ElkPort[];
  labels?: ElkLabel[];
  layoutOptions?: Record<string, string>;
};

export type ElkGraph = ElkNode;

type ElkConstructor = new (options?: { defaultLayoutOptions?: Record<string, string> }) => {
  layout: (graph: ElkGraph) => Promise<ElkGraph>;
};

const ElkCtor = ELK as unknown as ElkConstructor;

let shared: InstanceType<ElkConstructor> | null = null;

export function getElk(): InstanceType<ElkConstructor> {
  if (!shared) {
    shared = new ElkCtor({
      defaultLayoutOptions: {
        "elk.algorithm": "layered",
        "elk.edgeRouting": "ORTHOGONAL",
        "elk.hierarchyHandling": "INCLUDE_CHILDREN",
      },
    });
  }
  return shared;
}

export const ELK_LAYOUT_ALGORITHM = "elk-layered-v1";
export const ELK_ROUTER_ALGORITHM = "elk-orthogonal-v1";
