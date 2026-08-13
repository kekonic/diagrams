import type {
  GraphModel,
  LayoutOptions,
  Point,
  Rect,
  SequenceFragment,
  SequenceIR,
} from "@kekonic/diagrams-core";
import { sequenceFragmentDisplayName } from "@kekonic/diagrams-core";
import type { MeasuredNode } from "../../measure/measure.ts";
import type { LaidOutNode, LayoutEdgePath, LayoutResult } from "../types.ts";

export type SequenceLayoutRouteResult = {
  layout: LayoutResult;
  edges: LayoutEdgePath[];
  routerAlgorithm: string;
};

export const SEQUENCE_LAYOUT_ALGORITHM = "sequence-v1";
export const SEQUENCE_ROUTER_ALGORITHM = "sequence-direct-v1";

export type SequenceLifelineLayout = {
  participantId: string;
  /** Vertical line from below header to diagram bottom. */
  x: number;
  y0: number;
  y1: number;
};

export type SequenceActivationLayout = {
  id: string;
  participantId: string;
  startOrder: number;
  endOrder: number;
  bounds: Rect;
};

export type SequenceFragmentLayout = {
  id: string;
  operator: SequenceFragment["operator"];
  label?: string;
  styleRefs: string[];
  unresolvedVars: Record<string, string>;
  bounds: Rect;
  startOrder: number;
  endOrder: number;
  /** Horizontal separators between operands (alternate/else, parallel/and). */
  separators: number[];
  operandLabels: Array<{ text: string; x: number; y: number }>;
  /** Per-operand tint bands (success vs danger, etc.). */
  operandBands: Array<{
    startOrder: number;
    endOrder: number;
    styleRefs: string[];
    bounds: Rect;
  }>;
};

export type SequenceNoteLayout = {
  id: string;
  bounds: Rect;
  text: string;
};

export type SequenceDividerLayout = {
  id: string;
  y: number;
  x0: number;
  x1: number;
  label?: string;
};

export type SequenceMessageLayout = {
  messageId: string;
  kind: NonNullable<SequenceIR["messages"][number]["kind"]>;
  points: Point[];
  label?: string;
  labelCenter?: Point;
  number?: number;
};

export type SequenceLayoutArtifacts = {
  lifelines: SequenceLifelineLayout[];
  activations: SequenceActivationLayout[];
  fragments: SequenceFragmentLayout[];
  notes: SequenceNoteLayout[];
  dividers: SequenceDividerLayout[];
  messages: SequenceMessageLayout[];
};

const HEADER_GAP = 32;
const PARTICIPANT_GAP = 48;
/** Vertical pitch per message/note/divider order — room for label above the path. */
const SLOT_H = 52;
const LABEL_GAP = 14;
const FRAGMENT_PAD_X = 14;
const FRAGMENT_PAD_Y = 14;
const FRAGMENT_HEADER = 22;
/** Extra gap inserted before a fragment starts / after it ends. */
const FRAGMENT_EDGE_GAP = 10;
const ACTIVATION_W = 10;
const SELF_LOOP_W = 44;
const SELF_LOOP_EXTRA = 22;
const MARGIN = 24;
const NOTE_PAD = 10;
const NOTE_LINE = 15;
const NOTE_BAND_GAP = 12;
const DIVIDER_BAND = 36;

function densityScale(density: LayoutOptions["density"]): number {
  if (density === "compact") return 0.88;
  if (density === "spacious") return 1.22;
  return 1;
}

/**
 * Build cumulative Y baselines for each order index.
 * Notes, dividers, self-messages, and fragment edges reserve extra vertical band
 * so labels/boxes don't collide with neighboring message paths.
 */
function buildOrderBaselines(
  seq: SequenceIR,
  contentTop: number,
  slotH: number,
): {
  yAt: (order: number) => number;
  bandTop: (order: number) => number;
  bandBottom: (order: number) => number;
  bottomY: number;
} {
  const maxOrder = Math.max(
    0,
    ...seq.messages.map((m) => m.order),
    ...seq.notes.map((n) => n.order),
    ...seq.dividers.map((d) => d.order),
    ...seq.activations.map((a) => a.endOrder),
  );

  const noteAt = new Map(seq.notes.map((n) => [n.order, n]));
  const dividerAt = new Map(seq.dividers.map((d) => [d.order, d]));
  const selfAt = new Set(
    seq.messages.filter((m) => m.from && m.to && m.from === m.to).map((m) => m.order),
  );

  const fragStart = new Set<number>();
  const fragEnd = new Set<number>();
  const operandSepBefore = new Set<number>();

  const walkFrags = (fragments: SequenceFragment[]) => {
    for (const frag of fragments) {
      fragStart.add(frag.startOrder);
      fragEnd.add(frag.endOrder);
      for (let i = 1; i < frag.operands.length; i++) {
        operandSepBefore.add(frag.operands[i]!.startOrder);
      }
      for (const op of frag.operands) walkFrags(op.children);
    }
  };
  walkFrags(seq.fragments);

  const yBaselines = new Map<number, number>();
  const tops = new Map<number, number>();
  const bottoms = new Map<number, number>();
  let cursor = contentTop;

  for (let order = 0; order <= maxOrder; order++) {
    let topPad = 0;
    let band = slotH;
    let bottomPad = 0;

    if (fragStart.has(order)) {
      topPad += FRAGMENT_HEADER + FRAGMENT_PAD_Y + FRAGMENT_EDGE_GAP;
    }
    if (operandSepBefore.has(order)) {
      topPad += 18;
    }

    const note = noteAt.get(order);
    if (note) {
      band = Math.max(band, measureNoteHeight(note.text) + NOTE_BAND_GAP);
    }
    if (dividerAt.has(order)) {
      band = Math.max(band, DIVIDER_BAND);
    }
    if (selfAt.has(order)) {
      band = Math.max(band, slotH + SELF_LOOP_EXTRA);
    }
    if (fragEnd.has(order)) {
      bottomPad += FRAGMENT_PAD_Y + FRAGMENT_EDGE_GAP;
    }

    const top = cursor;
    const center = cursor + topPad + band / 2;
    const bottom = cursor + topPad + band + bottomPad;
    tops.set(order, top);
    yBaselines.set(order, center);
    bottoms.set(order, bottom);
    cursor = bottom;
  }

  const fallback = (order: number) => contentTop + order * slotH;
  return {
    yAt: (order: number) => yBaselines.get(order) ?? fallback(order) + slotH / 2,
    bandTop: (order: number) => tops.get(order) ?? fallback(order),
    bandBottom: (order: number) => bottoms.get(order) ?? fallback(order) + slotH,
    bottomY: cursor + MARGIN,
  };
}

function measureNoteHeight(text: string): number {
  const lines = Math.max(1, Math.ceil(text.length / 32));
  return lines * NOTE_LINE + NOTE_PAD * 2;
}

/**
 * Time-axis sequence layout: participants on X, messages ordered on Y.
 */
export function layoutSequence(
  graph: GraphModel,
  measured: MeasuredNode[],
  options: LayoutOptions = {},
): SequenceLayoutRouteResult {
  const t0 = performance.now();
  const seq = graph.sequence;
  if (!seq) {
    return emptySequenceResult(t0);
  }

  const scale = densityScale(options.density);
  const slotH = SLOT_H * scale;
  const participantGap = PARTICIPANT_GAP * scale;
  const measuredById = new Map(measured.map((m) => [m.nodeId, m]));

  // Participant headers along X.
  const nodes: LaidOutNode[] = [];
  const centers = new Map<string, number>();
  let x = MARGIN;
  let headerH = 40;

  for (const [i, id] of seq.participantOrder.entries()) {
    const m = measuredById.get(id);
    const w = m?.width ?? 120;
    const h = m?.height ?? 40;
    headerH = Math.max(headerH, h);
    const bounds: Rect = { x, y: MARGIN, width: w, height: h };
    nodes.push({ nodeId: id, bounds, rank: 0, order: i });
    centers.set(id, x + w / 2);
    x += w + participantGap;
  }

  const contentTop = MARGIN + headerH + HEADER_GAP * scale;
  const { yAt, bandTop, bandBottom, bottomY } = buildOrderBaselines(seq, contentTop, slotH);

  const messages: SequenceMessageLayout[] = [];
  const edgePaths: LayoutEdgePath[] = [];
  const edgeLabels: LayoutResult["edgeLabels"] = [];
  let msgNumber = 0;

  for (const msg of seq.messages) {
    // Create counts as a real hop; destroy is just the X glyph (no number).
    if (seq.autonumber && msg.kind !== "destroy") msgNumber += 1;
    const y = yAt(msg.order);
    const fromX =
      msg.from && centers.has(msg.from)
        ? centers.get(msg.from)!
        : msg.kind === "found"
          ? (centers.get(msg.to!) ?? MARGIN) - 40
          : MARGIN;
    const toX =
      msg.to && centers.has(msg.to)
        ? centers.get(msg.to)!
        : msg.kind === "lost"
          ? (centers.get(msg.from!) ?? MARGIN) + 40
          : fromX;

    let points: Point[];
    if (msg.kind === "destroy") {
      const cx = centers.get(msg.from!) ?? fromX;
      points = [
        { x: cx - 8, y: y - 8 },
        { x: cx + 8, y: y + 8 },
        { x: cx + 8, y: y - 8 },
        { x: cx - 8, y: y + 8 },
      ];
    } else if (msg.from && msg.to && msg.from === msg.to) {
      const cx = centers.get(msg.from)!;
      const loopDepth = Math.max(18, SELF_LOOP_EXTRA * scale);
      points = [
        { x: cx, y: y - loopDepth * 0.15 },
        { x: cx + SELF_LOOP_W, y: y - loopDepth * 0.15 },
        { x: cx + SELF_LOOP_W, y: y + loopDepth * 0.85 },
        { x: cx, y: y + loopDepth * 0.85 },
      ];
    } else {
      points = [
        { x: fromX, y },
        { x: toX, y },
      ];
    }

    const labelCenter =
      points.length >= 2
        ? {
            x: (points[0]!.x + points[points.length - 1]!.x) / 2,
            y: Math.min(points[0]!.y, points[points.length - 1]!.y) - LABEL_GAP,
          }
        : undefined;

    messages.push({
      messageId: msg.id,
      kind: msg.kind,
      points,
      label: msg.label,
      labelCenter,
      number: seq.autonumber && msg.kind !== "destroy" ? msgNumber : undefined,
    });

    if (msg.from && msg.to && msg.from !== "*" && msg.to !== "*") {
      edgePaths.push({ edgeId: msg.id, points });
      // Message labels are painted by the sequence overlay (not flowchart edgeLabels).
    }
  }

  const lifelines: SequenceLifelineLayout[] = [];
  for (const id of seq.participantOrder) {
    const cx = centers.get(id)!;
    const node = nodes.find((n) => n.nodeId === id)!;
    lifelines.push({
      participantId: id,
      x: cx,
      y0: node.bounds.y + node.bounds.height,
      y1: bottomY,
    });
  }

  const activations: SequenceActivationLayout[] = seq.activations.map((a) => {
    const cx = centers.get(a.participantId) ?? MARGIN;
    const y0 = yAt(a.startOrder) - 6;
    const y1 = yAt(a.endOrder) + 6;
    return {
      id: a.id,
      participantId: a.participantId,
      startOrder: a.startOrder,
      endOrder: a.endOrder,
      bounds: {
        x: cx - ACTIVATION_W / 2,
        y: Math.min(y0, y1),
        width: ACTIVATION_W,
        height: Math.max(8, Math.abs(y1 - y0)),
      },
    };
  });

  const fragments: SequenceFragmentLayout[] = [];
  const layoutFrag = (frag: SequenceFragment, depth: number): void => {
    const xs = seq.participantOrder.map((id) => centers.get(id)!);
    const minX = Math.min(...xs) - FRAGMENT_PAD_X - depth * 6;
    const maxX = Math.max(...xs) + FRAGMENT_PAD_X + depth * 6;
    // Stay inside reserved bands — don't bleed into the prior note/message.
    const y0 = bandTop(frag.startOrder) + 2;
    const y1 = bandBottom(frag.endOrder) - 2;
    const separators: number[] = [];
    const operandLabels: Array<{ text: string; x: number; y: number }> = [];
    const operandBands: SequenceFragmentLayout["operandBands"] = [];

    for (let i = 0; i < frag.operands.length; i++) {
      const op = frag.operands[i]!;
      const opTop = i === 0 ? y0 : bandTop(op.startOrder);
      const opBottom =
        i === frag.operands.length - 1 ? y1 : bandTop(frag.operands[i + 1]!.startOrder);
      operandBands.push({
        startOrder: op.startOrder,
        endOrder: op.endOrder,
        styleRefs: op.styleRefs,
        bounds: {
          x: minX,
          y: opTop,
          width: maxX - minX,
          height: Math.max(8, opBottom - opTop),
        },
      });
      if (i > 0) {
        separators.push(opTop);
        if (op.label) {
          operandLabels.push({ text: op.label, x: minX + 8, y: opTop + 4 });
        }
      }
    }
    if (frag.label) {
      operandLabels.unshift({
        text: `${sequenceFragmentDisplayName(frag.operator)} [${frag.label}]`,
        x: minX + 8,
        y: y0 + 6,
      });
    } else {
      operandLabels.unshift({
        text: sequenceFragmentDisplayName(frag.operator),
        x: minX + 8,
        y: y0 + 6,
      });
    }

    fragments.push({
      id: frag.id,
      operator: frag.operator,
      label: frag.label,
      styleRefs: frag.styleRefs,
      unresolvedVars: frag.unresolvedVars,
      bounds: { x: minX, y: y0, width: maxX - minX, height: Math.max(24, y1 - y0) },
      startOrder: frag.startOrder,
      endOrder: frag.endOrder,
      separators,
      operandLabels,
      operandBands,
    });

    for (const op of frag.operands) {
      for (const child of op.children) layoutFrag(child, depth + 1);
    }
  };
  for (const frag of seq.fragments) layoutFrag(frag, 0);

  const notes: SequenceNoteLayout[] = seq.notes.map((n) => {
    const y = yAt(n.order);
    const h = measureNoteHeight(n.text);
    const ids = n.participantIds.filter((id) => centers.has(id));
    let x0: number;
    let x1: number;
    if (n.placement === "over" && ids.length) {
      const xs = ids.map((id) => centers.get(id)!);
      x0 = Math.min(...xs) - 24;
      x1 = Math.max(...xs) + 24;
    } else if (n.placement === "left" && ids[0]) {
      const cx = centers.get(ids[0])!;
      x0 = cx - 150;
      x1 = cx - 24;
    } else if (ids[0]) {
      const cx = centers.get(ids[0])!;
      x0 = cx + 24;
      x1 = cx + 150;
    } else {
      x0 = MARGIN;
      x1 = MARGIN + 120;
    }
    const w = Math.max(80, x1 - x0);
    return {
      id: n.id,
      text: n.text,
      bounds: { x: x0, y: y - h / 2, width: w, height: h },
    };
  });

  const firstX = Math.min(...centers.values(), MARGIN);
  const lastX = Math.max(...centers.values(), MARGIN);
  const dividers: SequenceDividerLayout[] = seq.dividers.map((d) => ({
    id: d.id,
    // Line at baseline; label sits clearly above so it doesn't collide with prior message.
    y: yAt(d.order) + 4,
    x0: firstX - 20,
    x1: lastX + 20,
    label: d.label,
  }));

  const sequence: SequenceLayoutArtifacts = {
    lifelines,
    activations,
    fragments,
    notes,
    dividers,
    messages,
  };

  let maxX = x;
  let maxY = bottomY;
  for (const f of fragments) {
    maxX = Math.max(maxX, f.bounds.x + f.bounds.width);
    maxY = Math.max(maxY, f.bounds.y + f.bounds.height);
  }
  for (const n of notes) {
    maxX = Math.max(maxX, n.bounds.x + n.bounds.width);
    maxY = Math.max(maxY, n.bounds.y + n.bounds.height);
  }
  for (const path of edgePaths) {
    for (const p of path.points) {
      maxX = Math.max(maxX, p.x);
      maxY = Math.max(maxY, p.y);
    }
  }

  const layout: LayoutResult = {
    nodes,
    groups: [],
    edgePaths,
    edgeLabels,
    direction: "TD",
    algorithmVersion: SEQUENCE_LAYOUT_ALGORITHM,
    layoutMs: performance.now() - t0,
    width: maxX + MARGIN,
    height: maxY + MARGIN,
    sequence,
  };

  return {
    layout,
    edges: edgePaths,
    routerAlgorithm: SEQUENCE_ROUTER_ALGORITHM,
  };
}

function emptySequenceResult(t0: number): SequenceLayoutRouteResult {
  return {
    layout: {
      nodes: [],
      groups: [],
      edgePaths: [],
      edgeLabels: [],
      direction: "TD",
      algorithmVersion: SEQUENCE_LAYOUT_ALGORITHM,
      layoutMs: performance.now() - t0,
      width: 0,
      height: 0,
    },
    edges: [],
    routerAlgorithm: SEQUENCE_ROUTER_ALGORITHM,
  };
}

export function isSequenceGraph(graph: GraphModel): boolean {
  return graph.diagramKind === "sequence" || graph.sequence != null;
}
