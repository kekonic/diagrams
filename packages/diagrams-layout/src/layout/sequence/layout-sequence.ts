import type {
  GraphModel,
  LayoutOptions,
  Point,
  Rect,
  SequenceActivation,
  SequenceFragment,
  SequenceIR,
  SequenceMessage,
  SequenceNote,
} from "@kekonic/diagrams-core";
import {
  SEQUENCE_PAYLOAD_MAX_LINES,
  rectsOverlap,
  sequenceFragmentDisplayName,
} from "@kekonic/diagrams-core";
import type { MeasuredNode } from "../../measure/measure.ts";
import { DEFAULT_FONT_FAMILY, defaultMeasurer } from "../../measure/text-measurer.ts";
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
  /** Vertical line from below the header to the footer or destruction mark. */
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
  /** Operator tab in the top-left corner of the frame. */
  tab: Rect;
  operatorLabel: string;
  /** Guard painted beside the operator tab. Baseline y. */
  guard?: { text: string; x: number; y: number };
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
  lines: string[];
};

export type SequenceDividerLayout = {
  id: string;
  y: number;
  x0: number;
  x1: number;
  label?: string;
  /** Chip that interrupts the rule. */
  labelBounds?: Rect;
};

export type SequenceMessageLayout = {
  messageId: string;
  kind: NonNullable<SequenceIR["messages"][number]["kind"]>;
  points: Point[];
  label?: string;
  /** Text anchor (baseline). */
  labelCenter?: Point;
  /** Chip behind the label, including the autonumber badge. */
  labelBounds?: Rect;
  /** Excerpt lines, already capped. Indent from the source is preserved. */
  payloadLines?: string[];
  /** Card under the arrow. Opaque so lifelines do not show through the excerpt. */
  payloadBounds?: Rect;
  number?: number;
  /** Filled circle for a found (start) or lost (end) message. */
  endpoint?: Point;
  endpointAt?: "start" | "end";
};

/** Repeated participant head for sequences long enough to lose the header. */
export type SequenceParticipantFooter = {
  participantId: string;
  bounds: Rect;
};

export type SequenceLayoutArtifacts = {
  lifelines: SequenceLifelineLayout[];
  activations: SequenceActivationLayout[];
  fragments: SequenceFragmentLayout[];
  notes: SequenceNoteLayout[];
  dividers: SequenceDividerLayout[];
  messages: SequenceMessageLayout[];
  footers: SequenceParticipantFooter[];
};

const HEADER_GAP = 26;
const MIN_PARTICIPANT_GAP = 40;
const SLOT_H = 50;
const LABEL_CLEARANCE = 16;
const CHIP_H = 20;
const CHIP_PAD_X = 8;
const BADGE_W = 16;
const BADGE_GAP = 4;
const FRAGMENT_PAD_X = 18;
const FRAGMENT_PAD_Y = 6;
const FRAGMENT_HEADER = 22;
const FRAGMENT_EDGE_GAP = 4;
const ACTIVATION_W = 12;
const ACTIVATION_NEST = 8;
const SELF_LOOP_W = 40;
const SELF_LOOP_H = 20;
const MARGIN = 28;
const NOTE_LINE = 15;
const NOTE_BAND_GAP = 10;
const DIVIDER_BAND = 34;
const FOOTER_GAP = 26;
const LEFT_NOTE_W = 176;
const RIGHT_NOTE_W = 176;

const LABEL_STYLE = { fontSize: 11, fontFamily: DEFAULT_FONT_FAMILY, fontWeight: "700" };
const NOTE_STYLE = { fontSize: 11, fontFamily: DEFAULT_FONT_FAMILY, fontWeight: "500" };
const TAB_STYLE = { fontSize: 10, fontFamily: DEFAULT_FONT_FAMILY, fontWeight: "700" };
const GUARD_STYLE = { fontSize: 11, fontFamily: DEFAULT_FONT_FAMILY, fontWeight: "700" };
const DIVIDER_STYLE = { fontSize: 11, fontFamily: DEFAULT_FONT_FAMILY, fontWeight: "600" };
/** Matches `.flow-sequence-fragment-tab-label` letter-spacing (0.06em at 10px). */
const TAB_TRACKING = 0.6;
/** Matches `.flow-sequence-fragment-guard` letter-spacing (0.01em at 11px). */
const GUARD_TRACKING = 0.11;
const HEADER_END_PAD = 14;
const GUARD_GAP = 10;
const PAYLOAD_STYLE = { fontSize: 10, fontFamily: DEFAULT_FONT_FAMILY, fontWeight: "500" };
const PAYLOAD_LINE = 14;
const PAYLOAD_PAD_X = 10;
const PAYLOAD_PAD_Y = 8;
const PAYLOAD_ACCENT = 3;
const PAYLOAD_DROP = 10;
const PAYLOAD_TAIL = 8;
/** Card budget. Lines wider than the inner text width hard-break; indent is kept. */
const PAYLOAD_MAX_CARD = 232;
const PAYLOAD_MAX_INNER = PAYLOAD_MAX_CARD - PAYLOAD_PAD_X * 2 - PAYLOAD_ACCENT;

function densityScale(density: LayoutOptions["density"]): number {
  if (density === "compact") return 0.88;
  if (density === "spacious") return 1.18;
  return 1;
}

type Column = { id: string; x: number; width: number; height: number };

function chipSize(label: string, numbered: boolean): { width: number; height: number } {
  const textW = defaultMeasurer.measureText(label, LABEL_STYLE).width;
  const extra = numbered ? BADGE_W + BADGE_GAP : 0;
  return { width: Math.ceil(textW + extra + CHIP_PAD_X * 2), height: CHIP_H };
}

function placeChip(
  midX: number,
  lineY: number,
  label: string,
  numbered: boolean,
): { bounds: Rect; center: Point } {
  const size = chipSize(label, numbered);
  const textW = defaultMeasurer.measureText(label, LABEL_STYLE).width;
  const baseline = lineY - LABEL_CLEARANCE;
  const bounds: Rect = {
    x: midX - size.width / 2,
    y: baseline - 14,
    width: size.width,
    height: size.height,
  };
  const textLeft = bounds.x + CHIP_PAD_X + (numbered ? BADGE_W + BADGE_GAP : 0);
  return { bounds, center: { x: textLeft + textW / 2, y: baseline } };
}

function wrapNote(text: string, width: number): { lines: string[]; width: number; height: number } {
  const inner = Math.max(48, width - 20);
  const wrapped = defaultMeasurer.wrapText(text, { maxWidth: inner, style: NOTE_STYLE });
  const lines = wrapped.lines.length ? wrapped.lines : [text];
  return {
    lines,
    width: Math.max(width, Math.ceil(wrapped.width + 20)),
    height: lines.length * NOTE_LINE + 18,
  };
}

function measuredTabWidth(label: string): number {
  const textW = defaultMeasurer.measureText(label, TAB_STYLE).width + label.length * TAB_TRACKING;
  return Math.ceil(textW + 16 + 9);
}

function measuredGuardWidth(text: string): number {
  const label = `[${text}]`;
  const textW =
    defaultMeasurer.measureText(label, GUARD_STYLE).width + label.length * GUARD_TRACKING;
  return Math.ceil(textW);
}

function measurePayload(text: string): number {
  return defaultMeasurer.measureText(text, PAYLOAD_STYLE).width;
}

/** Break one authored line. Spaces are preferred; otherwise the line is cut by width. */
function hardBreakPayloadLine(line: string): string[] {
  if (measurePayload(line) <= PAYLOAD_MAX_INNER) return [line];
  const out: string[] = [];
  let rest = line;
  while (rest.length > 0) {
    if (measurePayload(rest) <= PAYLOAD_MAX_INNER) {
      out.push(rest);
      break;
    }
    let cut = 1;
    for (let i = 1; i <= rest.length; i++) {
      if (measurePayload(rest.slice(0, i)) > PAYLOAD_MAX_INNER) {
        cut = Math.max(1, i - 1);
        break;
      }
      cut = i;
    }
    const space = rest.lastIndexOf(" ", cut);
    if (space > 0) {
      out.push(rest.slice(0, space));
      rest = rest.slice(space + 1);
    } else {
      out.push(rest.slice(0, cut));
      rest = rest.slice(cut);
    }
  }
  return out.length > 0 ? out : [line];
}

function layoutPayloadCard(
  text: string,
): { lines: string[]; width: number; height: number } | undefined {
  const normalized = text.replace(/\r\n/g, "\n").trim();
  if (!normalized) return undefined;
  const broken = normalized.split("\n").flatMap((line) => hardBreakPayloadLine(line));
  const lines =
    broken.length > SEQUENCE_PAYLOAD_MAX_LINES
      ? [...broken.slice(0, SEQUENCE_PAYLOAD_MAX_LINES - 1), "…"]
      : broken;
  const textW = Math.max(0, ...lines.map((line) => measurePayload(line)));
  return {
    lines,
    width: Math.ceil(textW + PAYLOAD_PAD_X * 2 + PAYLOAD_ACCENT),
    height: PAYLOAD_PAD_Y * 2 + lines.length * PAYLOAD_LINE,
  };
}

/** Slide a fragment label to the right of any execution bar it would cross. */
function clearOfActivations(
  x: number,
  width: number,
  baseline: number,
  activations: SequenceActivationLayout[],
): number {
  const top = baseline - 12;
  const bottom = baseline + 3;
  const bars = activations
    .filter((act) => act.bounds.y < bottom && act.bounds.y + act.bounds.height > top)
    .map((act) => act.bounds)
    .sort((a, b) => a.x - b.x);
  let cursor = x;
  for (let pass = 0; pass < bars.length; pass++) {
    let moved = false;
    for (const bar of bars) {
      if (cursor + width <= bar.x - 4 || cursor >= bar.x + bar.width + 4) continue;
      cursor = bar.x + bar.width + 6;
      moved = true;
    }
    if (!moved) break;
  }
  return cursor;
}

function noteWidth(note: SequenceNote, centers: Map<string, number>): number {
  if (note.placement === "over") {
    const xs = note.participantIds
      .map((id) => centers.get(id))
      .filter((x): x is number => x != null);
    if (xs.length >= 2) return Math.max(160, Math.max(...xs) - Math.min(...xs) + 36);
    return 200;
  }
  return note.placement === "left" ? LEFT_NOTE_W : RIGHT_NOTE_W;
}

/**
 * Cumulative Y baselines. Notes, dividers, self-messages, creates, and fragment
 * edges reserve extra vertical band so labels and frames stay off neighboring arrows.
 */
function buildOrderBaselines(
  seq: SequenceIR,
  contentTop: number,
  slotH: number,
  noteHeights: Map<number, number>,
  createHeights: Map<number, number>,
  payloadBottomPad: Map<number, number>,
): {
  yAt: (order: number) => number;
  bandTop: (order: number) => number;
  bandBottom: (order: number) => number;
  bottomY: number;
} {
  const orders = [
    ...seq.messages.map((m) => m.order),
    ...seq.notes.map((n) => n.order),
    ...seq.dividers.map((d) => d.order),
    ...seq.activations.map((a) => a.endOrder),
    ...seq.activations.map((a) => a.startOrder),
  ];
  const walk = (fragments: SequenceFragment[]) => {
    for (const frag of fragments) {
      orders.push(frag.startOrder, frag.endOrder);
      for (const op of frag.operands) walk(op.children);
    }
  };
  walk(seq.fragments);
  const maxOrder = Math.max(0, ...orders);

  const noteAt = new Set(seq.notes.map((n) => n.order));
  const dividerAt = new Set(seq.dividers.map((d) => d.order));
  const selfAt = new Set(
    seq.messages
      .filter((m) => m.from && m.to && m.from === m.to && m.kind !== "destroy")
      .map((m) => m.order),
  );

  const fragStart = new Set<number>();
  const fragEnd = new Set<number>();
  const operandSepBefore = new Set<number>();
  const markFrags = (fragments: SequenceFragment[]) => {
    for (const frag of fragments) {
      fragStart.add(frag.startOrder);
      fragEnd.add(frag.endOrder);
      for (let i = 1; i < frag.operands.length; i++) {
        operandSepBefore.add(frag.operands[i]!.startOrder);
      }
      for (const op of frag.operands) markFrags(op.children);
    }
  };
  markFrags(seq.fragments);

  const yBaselines = new Map<number, number>();
  const tops = new Map<number, number>();
  const bottoms = new Map<number, number>();
  let cursor = contentTop;

  for (let order = 0; order <= maxOrder; order++) {
    let topPad = 0;
    let band = slotH;
    let bottomPad = 0;

    if (fragStart.has(order)) topPad += FRAGMENT_HEADER + FRAGMENT_PAD_Y + FRAGMENT_EDGE_GAP;
    if (operandSepBefore.has(order)) topPad += 12;

    if (noteAt.has(order)) band = Math.max(band, (noteHeights.get(order) ?? 48) + NOTE_BAND_GAP);
    if (dividerAt.has(order)) band = Math.max(band, DIVIDER_BAND);
    if (selfAt.has(order)) band = Math.max(band, slotH + 12);
    const createH = createHeights.get(order);
    if (createH) band = Math.max(band, createH + 16);
    if (fragEnd.has(order)) bottomPad += FRAGMENT_PAD_Y + FRAGMENT_EDGE_GAP;
    bottomPad += payloadBottomPad.get(order) ?? 0;

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
    bottomY: cursor,
  };
}

function activationDepths(activations: SequenceActivation[]): Map<string, number> {
  const byParticipant = new Map<string, SequenceActivation[]>();
  for (const act of activations) {
    const list = byParticipant.get(act.participantId) ?? [];
    list.push(act);
    byParticipant.set(act.participantId, list);
  }
  const depth = new Map<string, number>();
  for (const list of byParticipant.values()) {
    const sorted = [...list].sort(
      (a, b) => a.startOrder - b.startOrder || b.endOrder - a.endOrder || a.id.localeCompare(b.id),
    );
    const stack: SequenceActivation[] = [];
    for (const act of sorted) {
      while (stack.length && stack[stack.length - 1]!.endOrder < act.startOrder) stack.pop();
      depth.set(act.id, stack.length);
      stack.push(act);
    }
  }
  return depth;
}

function placeColumns(
  seq: SequenceIR,
  measuredById: Map<string, MeasuredNode>,
  minGap: number,
  numbered: boolean,
): Column[] {
  const ids = seq.participantOrder;
  const widths = ids.map((id) => measuredById.get(id)?.width ?? 120);
  const heights = ids.map((id) => measuredById.get(id)?.height ?? 44);
  const index = new Map(ids.map((id, i) => [id, i]));
  const extras = Array.from({ length: Math.max(0, ids.length - 1) }, () => 0);

  const spanBetween = (lo: number, hi: number) => {
    let d = 0;
    for (let i = lo; i < hi; i++) {
      d += widths[i]! / 2 + widths[i + 1]! / 2 + minGap + extras[i]!;
    }
    return d;
  };

  const ensureSpan = (a: number, b: number, need: number) => {
    const lo = Math.min(a, b);
    const hi = Math.max(a, b);
    if (hi === lo) return;
    const have = spanBetween(lo, hi);
    if (have >= need) return;
    const add = (need - have) / (hi - lo);
    for (let i = lo; i < hi; i++) extras[i] = (extras[i] ?? 0) + add;
  };

  for (const msg of seq.messages) {
    if (!msg.label || !msg.from || !msg.to || msg.from === msg.to) continue;
    if (msg.kind === "destroy" || msg.kind === "create") continue;
    const ia = index.get(msg.from);
    const ib = index.get(msg.to);
    if (ia == null || ib == null) continue;
    ensureSpan(ia, ib, chipSize(msg.label, numbered).width + 32);
  }

  for (const msg of seq.messages) {
    if (!msg.from || msg.from !== msg.to || msg.kind === "destroy") continue;
    const i = index.get(msg.from);
    if (i == null || i >= ids.length - 1) continue;
    const labelW = msg.label ? chipSize(msg.label, numbered).width : 0;
    const rightExtent = SELF_LOOP_W / 2 + 10 + labelW / 2;
    const room = widths[i]! / 2 + minGap + extras[i]!;
    if (room < rightExtent) extras[i] = extras[i]! + (rightExtent - room);
  }

  const hasLeftNote = seq.notes.some((note) => note.placement === "left");
  let x = MARGIN + (hasLeftNote ? LEFT_NOTE_W + 36 : FRAGMENT_PAD_X);
  const columns: Column[] = [];
  for (let i = 0; i < ids.length; i++) {
    const width = widths[i]!;
    const height = heights[i]!;
    columns.push({ id: ids[i]!, x, width, height });
    if (i < ids.length - 1) x += width + minGap + extras[i]!;
  }
  return columns;
}

function participantsTouching(seq: SequenceIR, start: number, end: number): string[] {
  const ids = new Set<string>();
  const consider = (id: string | null | undefined) => {
    if (id && seq.participantOrder.includes(id)) ids.add(id);
  };
  for (const msg of seq.messages) {
    if (msg.order < start || msg.order > end) continue;
    consider(msg.from);
    consider(msg.to);
  }
  for (const note of seq.notes) {
    if (note.order < start || note.order > end) continue;
    for (const id of note.participantIds) consider(id);
  }
  if (ids.size === 0) return [...seq.participantOrder];
  const indexes = [...ids].map((id) => seq.participantOrder.indexOf(id));
  const lo = Math.min(...indexes);
  const hi = Math.max(...indexes);
  return seq.participantOrder.slice(lo, hi + 1);
}

/**
 * Time-axis sequence layout: participants on X, messages ordered on Y.
 * Message tips meet activation edges, fragments hug the participants, notes, and
 * labels they cover, and created participants drop onto the message that introduces them.
 */
export function layoutSequence(
  graph: GraphModel,
  measured: MeasuredNode[],
  options: LayoutOptions = {},
): SequenceLayoutRouteResult {
  const t0 = performance.now();
  const seq = graph.sequence;
  if (!seq || seq.participantOrder.length === 0) {
    return emptySequenceResult(t0);
  }

  const scale = densityScale(options.density);
  const slotH = SLOT_H * scale;
  const minGap = MIN_PARTICIPANT_GAP * scale;
  const measuredById = new Map(measured.map((m) => [m.nodeId, m]));
  const columns = placeColumns(seq, measuredById, minGap, seq.autonumber);
  const centers = new Map(columns.map((col) => [col.id, col.x + col.width / 2]));
  const columnById = new Map(columns.map((col) => [col.id, col]));

  const nodes: LaidOutNode[] = columns.map((col, i) => ({
    nodeId: col.id,
    bounds: { x: col.x, y: MARGIN, width: col.width, height: col.height },
    rank: 0,
    order: i,
  }));
  const nodeById = new Map(nodes.map((node) => [node.nodeId, node]));

  const createByTarget = new Map<string, SequenceMessage>();
  const destroyByTarget = new Map<string, SequenceMessage>();
  for (const msg of seq.messages) {
    if (msg.kind === "create" && msg.to && !createByTarget.has(msg.to))
      createByTarget.set(msg.to, msg);
    if (msg.kind === "destroy" && msg.from) destroyByTarget.set(msg.from, msg);
  }

  const noteHeights = new Map<number, number>();
  const wrappedNotes = new Map<string, { lines: string[]; width: number; height: number }>();
  for (const note of seq.notes) {
    const wrapped = wrapNote(note.text, noteWidth(note, centers));
    wrappedNotes.set(note.id, wrapped);
    noteHeights.set(note.order, Math.max(noteHeights.get(note.order) ?? 0, wrapped.height));
  }

  const createHeights = new Map<number, number>();
  for (const msg of createByTarget.values()) {
    const col = columnById.get(msg.to!);
    if (col) createHeights.set(msg.order, col.height);
  }

  const payloadCards = new Map<string, { lines: string[]; width: number; height: number }>();
  const payloadBottomPad = new Map<number, number>();
  for (const msg of seq.messages) {
    if (!msg.payload || msg.kind === "destroy" || msg.kind === "create") continue;
    const card = layoutPayloadCard(msg.payload);
    if (!card) continue;
    payloadCards.set(msg.id, card);
    const self = Boolean(msg.from && msg.to && msg.from === msg.to);
    const drop = (self ? SELF_LOOP_H * 0.7 : 0) + PAYLOAD_DROP;
    payloadBottomPad.set(msg.order, drop + card.height + PAYLOAD_TAIL);
  }

  const headerH = Math.max(44, ...columns.map((col) => col.height));
  const contentTop = MARGIN + headerH + HEADER_GAP * scale;
  const { yAt, bandTop, bandBottom, bottomY } = buildOrderBaselines(
    seq,
    contentTop,
    slotH,
    noteHeights,
    createHeights,
    payloadBottomPad,
  );

  for (const [id, msg] of createByTarget) {
    const node = nodeById.get(id);
    if (!node) continue;
    const y = yAt(msg.order);
    node.bounds = { ...node.bounds, y: y - node.bounds.height / 2 };
  }

  const depths = activationDepths(seq.activations);
  const lifeEnd = bottomY + 16;
  const lifelines: SequenceLifelineLayout[] = [];
  for (const col of columns) {
    const node = nodeById.get(col.id)!;
    const destroyed = destroyByTarget.get(col.id);
    const y1 = destroyed ? yAt(destroyed.order) - 10 : lifeEnd;
    lifelines.push({
      participantId: col.id,
      x: centers.get(col.id)!,
      y0: node.bounds.y + node.bounds.height,
      y1: Math.max(node.bounds.y + node.bounds.height + 8, y1),
    });
  }
  const lifelineById = new Map(lifelines.map((life) => [life.participantId, life]));

  const activationLayouts: SequenceActivationLayout[] = seq.activations.map((act) => {
    const cx = centers.get(act.participantId) ?? MARGIN;
    const depth = depths.get(act.id) ?? 0;
    const life = lifelineById.get(act.participantId);
    const y0 = yAt(act.startOrder) - 7;
    const y1 = yAt(act.endOrder) + 7;
    const top = Math.max(Math.min(y0, y1), life?.y0 ?? y0);
    const bot = Math.min(Math.max(y0, y1, top + 10), life?.y1 ?? y1);
    return {
      id: act.id,
      participantId: act.participantId,
      startOrder: act.startOrder,
      endOrder: act.endOrder,
      bounds: {
        x: cx - ACTIVATION_W / 2 + depth * ACTIVATION_NEST,
        y: top,
        width: ACTIVATION_W,
        height: Math.max(10, bot - top),
      },
    };
  });

  const covering = (id: string, order: number, mode: "leave" | "arrive") => {
    const list = activationLayouts.filter(
      (act) => act.participantId === id && act.startOrder <= order && act.endOrder >= order,
    );
    if (mode === "leave") {
      const prior = list.filter((act) => act.startOrder < order);
      if (prior.length)
        return prior.reduce((a, b) => ((depths.get(a.id) ?? 0) >= (depths.get(b.id) ?? 0) ? a : b));
    }
    if (!list.length) return undefined;
    return list.reduce((a, b) => ((depths.get(a.id) ?? 0) >= (depths.get(b.id) ?? 0) ? a : b));
  };

  const sideX = (id: string, order: number, facing: "left" | "right", mode: "leave" | "arrive") => {
    const act = covering(id, order, mode);
    const cx = centers.get(id)!;
    if (!act) return cx;
    return facing === "right" ? act.bounds.x + act.bounds.width : act.bounds.x;
  };

  const messages: SequenceMessageLayout[] = [];
  const edgePaths: LayoutEdgePath[] = [];
  let msgNumber = 0;

  for (const msg of seq.messages) {
    if (seq.autonumber && msg.kind !== "destroy") msgNumber += 1;
    const y = yAt(msg.order);
    const number = seq.autonumber && msg.kind !== "destroy" ? msgNumber : undefined;
    let points: Point[];
    let endpoint: Point | undefined;
    let endpointAt: SequenceMessageLayout["endpointAt"];
    let labelAnchorY = y;

    if (msg.kind === "destroy") {
      const cx = centers.get(msg.from!) ?? MARGIN;
      points = [
        { x: cx - 7, y: y - 7 },
        { x: cx + 7, y: y + 7 },
        { x: cx + 7, y: y - 7 },
        { x: cx - 7, y: y + 7 },
      ];
    } else if (msg.kind === "create" && msg.to && nodeById.has(msg.to)) {
      const box = nodeById.get(msg.to)!.bounds;
      const midY = box.y + box.height / 2;
      const fromCx = msg.from ? centers.get(msg.from) : undefined;
      const goingRight = fromCx == null || box.x + box.width / 2 >= fromCx;
      const fromX =
        msg.from && centers.has(msg.from)
          ? sideX(msg.from, msg.order, goingRight ? "right" : "left", "leave")
          : box.x - 42;
      const toX = goingRight ? box.x : box.x + box.width;
      points = [
        { x: fromX, y: midY },
        { x: toX, y: midY },
      ];
      if (!msg.from) {
        endpoint = points[0];
        endpointAt = "start";
      }
      labelAnchorY = midY;
    } else if (msg.from && msg.to && msg.from === msg.to && centers.has(msg.from)) {
      const leave = sideX(msg.from, msg.order, "right", "leave");
      const arriveAct = covering(msg.from, msg.order, "arrive");
      const arrive = arriveAct ? arriveAct.bounds.x + arriveAct.bounds.width : leave;
      const loopRight = Math.max(leave, arrive) + SELF_LOOP_W;
      const y0 = y - SELF_LOOP_H * 0.45;
      const y1 = y + SELF_LOOP_H * 0.7;
      points = [
        { x: leave, y: y0 },
        { x: loopRight, y: y0 },
        { x: loopRight, y: y1 },
        { x: arrive, y: y1 },
      ];
      labelAnchorY = y0;
    } else if (msg.kind === "found" || (!msg.from && msg.to && centers.has(msg.to))) {
      const toX = sideX(msg.to!, msg.order, "left", "arrive");
      const labelW = msg.label ? chipSize(msg.label, seq.autonumber).width : 0;
      const stub = Math.max(64, labelW + 30);
      const dot = { x: toX - stub, y };
      points = [dot, { x: toX, y }];
      endpoint = dot;
      endpointAt = "start";
    } else if (msg.kind === "lost" || (msg.from && !msg.to && centers.has(msg.from))) {
      const fromX = sideX(msg.from!, msg.order, "right", "leave");
      const labelW = msg.label ? chipSize(msg.label, seq.autonumber).width : 0;
      const stub = Math.max(64, labelW + 30);
      const dot = { x: fromX + stub, y };
      points = [{ x: fromX, y }, dot];
      endpoint = dot;
      endpointAt = "end";
    } else {
      const fromId = msg.from && centers.has(msg.from) ? msg.from : null;
      const toId = msg.to && centers.has(msg.to) ? msg.to : null;
      const fromCx = fromId ? centers.get(fromId)! : MARGIN;
      const toCx = toId ? centers.get(toId)! : fromCx + 48;
      const goingRight = toCx >= fromCx;
      const fromX = fromId
        ? sideX(fromId, msg.order, goingRight ? "right" : "left", "leave")
        : toCx - 42;
      const toX = toId
        ? sideX(toId, msg.order, goingRight ? "left" : "right", "arrive")
        : fromCx + 42;
      points = [
        { x: fromX, y },
        { x: toX, y },
      ];
      if (goingRight && toX - fromX < 16) {
        points = [
          { x: fromCx, y },
          { x: toCx, y },
        ];
      } else if (!goingRight && fromX - toX < 16) {
        points = [
          { x: fromCx, y },
          { x: toCx, y },
        ];
      }
    }

    const showLabel = Boolean(msg.label) && msg.kind !== "destroy" && msg.kind !== "create";
    let labelCenter: Point | undefined;
    let labelBounds: Rect | undefined;
    const a = points[0]!;
    const b = points[Math.min(1, points.length - 1)]!;
    const midX = points.length === 4 ? (points[0]!.x + points[1]!.x) / 2 : (a.x + b.x) / 2;
    if (showLabel && msg.label) {
      const chip = placeChip(midX, labelAnchorY, msg.label, number != null);
      labelCenter = chip.center;
      labelBounds = chip.bounds;
    }

    const card = payloadCards.get(msg.id);
    let payloadLines: string[] | undefined;
    let payloadBounds: Rect | undefined;
    if (card) {
      const anchor = points.length >= 4 ? Math.max(...points.map((point) => point.y)) : a.y;
      payloadLines = card.lines;
      payloadBounds = {
        x: Math.max(8, midX - card.width / 2),
        y: anchor + PAYLOAD_DROP,
        width: card.width,
        height: card.height,
      };
    }

    messages.push({
      messageId: msg.id,
      kind: msg.kind,
      points,
      label: showLabel ? msg.label : msg.kind === "create" ? undefined : msg.label,
      labelCenter,
      labelBounds,
      payloadLines,
      payloadBounds,
      number,
      endpoint,
      endpointAt,
    });

    if (msg.from && msg.to && msg.from !== msg.to && msg.kind !== "destroy") {
      edgePaths.push({ edgeId: msg.id, points });
    }
  }

  // Self-call bars hug the loop they belong to.
  for (const act of activationLayouts) {
    if (act.startOrder !== act.endOrder) continue;
    const msg = messages.find((item) => {
      const ir = seq.messages.find((raw) => raw.id === item.messageId);
      return (
        ir?.order === act.startOrder && ir.from === act.participantId && ir.to === act.participantId
      );
    });
    if (!msg || msg.points.length < 4) continue;
    const ys = msg.points.map((p) => p.y);
    const top = Math.min(...ys) - 3;
    const bot = Math.max(...ys) + 3;
    act.bounds = { ...act.bounds, y: top, height: Math.max(10, bot - top) };
  }

  const notes: SequenceNoteLayout[] = seq.notes.map((note) => {
    const wrapped = wrappedNotes.get(note.id) ?? wrapNote(note.text, 176);
    const y = yAt(note.order);
    const ids = note.participantIds.filter((id) => centers.has(id));
    let x0: number;
    if (note.placement === "over" && ids.length) {
      const xs = ids.map((id) => centers.get(id)!);
      const span = Math.max(...xs) - Math.min(...xs);
      const width = Math.max(wrapped.width, span + 36);
      x0 = (Math.min(...xs) + Math.max(...xs)) / 2 - width / 2;
      return {
        id: note.id,
        text: note.text,
        lines: wrapped.lines,
        bounds: { x: x0, y: y - wrapped.height / 2, width, height: wrapped.height },
      };
    }
    const anchor = centers.get(ids[0] ?? "") ?? MARGIN + 80;
    if (note.placement === "left") x0 = anchor - 28 - wrapped.width;
    else x0 = anchor + 28;
    return {
      id: note.id,
      text: note.text,
      lines: wrapped.lines,
      bounds: { x: x0, y: y - wrapped.height / 2, width: wrapped.width, height: wrapped.height },
    };
  });
  const noteOrder = new Map(seq.notes.map((note) => [note.id, note.order]));
  const messageOrder = new Map(seq.messages.map((msg) => [msg.id, msg.order]));

  const layoutFrag = (frag: SequenceFragment, depth: number): SequenceFragmentLayout[] => {
    const children = frag.operands.flatMap((op) =>
      op.children.flatMap((child) => layoutFrag(child, depth + 1)),
    );
    const touched = participantsTouching(seq, frag.startOrder, frag.endOrder);
    const boxes = touched.map((id) => nodeById.get(id)?.bounds).filter((b): b is Rect => b != null);
    const span = boxes.length ? boxes : columns.map((col) => nodeById.get(col.id)!.bounds);
    const baseMin = Math.min(...span.map((b) => b.x)) - FRAGMENT_PAD_X;
    const baseMax = Math.max(...span.map((b) => b.x + b.width)) + FRAGMENT_PAD_X;

    const operatorLabel = sequenceFragmentDisplayName(frag.operator);
    const tabW = measuredTabWidth(operatorLabel);
    let needW = tabW + HEADER_END_PAD;
    if (frag.label) needW = tabW + GUARD_GAP + measuredGuardWidth(frag.label) + HEADER_END_PAD;
    for (const op of frag.operands.slice(1)) {
      if (!op.label) continue;
      needW = Math.max(needW, 12 + measuredGuardWidth(op.label) + HEADER_END_PAD);
    }

    const inset = depth * 12;
    let minX = baseMin + inset;
    let maxX = baseMax - inset;
    if (maxX - minX < needW) {
      minX = baseMin;
      maxX = Math.max(baseMax, minX + needW);
    }
    const grow = (left: number, right: number) => {
      minX = Math.min(minX, left);
      maxX = Math.max(maxX, right);
    };
    for (const note of notes) {
      const order = noteOrder.get(note.id);
      if (order == null || order < frag.startOrder || order > frag.endOrder) continue;
      grow(note.bounds.x - 10, note.bounds.x + note.bounds.width + 10);
    }
    for (const msg of messages) {
      const order = messageOrder.get(msg.messageId);
      if (order == null || order < frag.startOrder || order > frag.endOrder) continue;
      for (const point of msg.points) grow(point.x - 8, point.x + 8);
      if (msg.endpoint) grow(msg.endpoint.x - 10, msg.endpoint.x + 10);
      if (msg.labelBounds) {
        grow(msg.labelBounds.x - 6, msg.labelBounds.x + msg.labelBounds.width + 6);
      }
      if (msg.payloadBounds) {
        grow(msg.payloadBounds.x - 8, msg.payloadBounds.x + msg.payloadBounds.width + 8);
      }
    }
    for (const child of children) {
      grow(child.bounds.x - 6, child.bounds.x + child.bounds.width + 6);
    }
    if (maxX - minX < needW) maxX = minX + needW;

    const y0 = bandTop(frag.startOrder) + 2;
    const y1 = bandBottom(frag.endOrder) - 2;
    const guardBaseline = y0 + 14;
    let guardX = minX + tabW + GUARD_GAP;
    if (frag.label) {
      const guardW = measuredGuardWidth(frag.label);
      guardX = clearOfActivations(guardX, guardW, guardBaseline, activationLayouts);
      maxX = Math.max(maxX, guardX + guardW + HEADER_END_PAD);
    }

    const separators: number[] = [];
    const operandLabels: Array<{ text: string; x: number; y: number }> = [];
    for (let i = 1; i < frag.operands.length; i++) {
      const op = frag.operands[i]!;
      if (!op.label) continue;
      const y = bandTop(op.startOrder) + 16;
      const width = measuredGuardWidth(op.label);
      const x = clearOfActivations(minX + 12, width, y, activationLayouts);
      operandLabels.push({ text: op.label, x, y });
      maxX = Math.max(maxX, x + width + HEADER_END_PAD);
    }

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
        bounds: { x: minX, y: opTop, width: maxX - minX, height: Math.max(8, opBottom - opTop) },
      });
      if (i > 0) separators.push(opTop);
    }

    const self: SequenceFragmentLayout = {
      id: frag.id,
      operator: frag.operator,
      label: frag.label,
      styleRefs: frag.styleRefs,
      unresolvedVars: frag.unresolvedVars,
      bounds: { x: minX, y: y0, width: Math.max(24, maxX - minX), height: Math.max(28, y1 - y0) },
      startOrder: frag.startOrder,
      endOrder: frag.endOrder,
      separators,
      operandLabels,
      tab: { x: minX, y: y0, width: tabW, height: 20 },
      operatorLabel,
      guard: frag.label ? { text: frag.label, x: guardX, y: guardBaseline } : undefined,
      operandBands,
    };
    return [self, ...children];
  };
  const fragments = seq.fragments.flatMap((frag) => layoutFrag(frag, 0));

  for (const msg of messages) {
    if (!msg.labelBounds || !msg.labelCenter) continue;
    let chip = msg.labelBounds;
    let center = msg.labelCenter;
    for (const frag of fragments) {
      if (!rectsOverlap(chip, frag.tab, 2)) continue;
      const shift = frag.tab.x + frag.tab.width + 8 - chip.x;
      if (shift > 0) {
        chip = { ...chip, x: chip.x + shift };
        center = { ...center, x: center.x + shift };
      }
    }
    msg.labelBounds = chip;
    msg.labelCenter = center;
  }
  for (const msg of messages) {
    if (!msg.labelBounds) continue;
    const order = messageOrder.get(msg.messageId);
    if (order == null) continue;
    const right = msg.labelBounds.x + msg.labelBounds.width + 8;
    for (const frag of fragments) {
      if (order < frag.startOrder || order > frag.endOrder) continue;
      const edge = frag.bounds.x + frag.bounds.width;
      if (right <= edge) continue;
      const width = right - frag.bounds.x;
      frag.bounds = { ...frag.bounds, width };
      for (const band of frag.operandBands) band.bounds = { ...band.bounds, width };
    }
  }
  for (const msg of messages) {
    if (!msg.payloadBounds) continue;
    const order = messageOrder.get(msg.messageId);
    if (order == null) continue;
    const bottom = msg.payloadBounds.y + msg.payloadBounds.height + 8;
    const right = msg.payloadBounds.x + msg.payloadBounds.width + 8;
    for (const frag of fragments) {
      if (order < frag.startOrder || order > frag.endOrder) continue;
      const edgeX = frag.bounds.x + frag.bounds.width;
      const edgeY = frag.bounds.y + frag.bounds.height;
      let width = frag.bounds.width;
      let height = frag.bounds.height;
      if (right > edgeX) width = right - frag.bounds.x;
      if (bottom > edgeY) height = bottom - frag.bounds.y;
      if (width === frag.bounds.width && height === frag.bounds.height) continue;
      const grewHeight = height !== frag.bounds.height;
      frag.bounds = { ...frag.bounds, width, height };
      for (const band of frag.operandBands) {
        band.bounds = { ...band.bounds, width };
      }
      const last = frag.operandBands[frag.operandBands.length - 1];
      if (grewHeight && last) {
        last.bounds = {
          ...last.bounds,
          height: frag.bounds.y + frag.bounds.height - last.bounds.y,
        };
      }
    }
  }

  const firstX = Math.min(...columns.map((col) => col.x));
  const lastX = Math.max(...columns.map((col) => col.x + col.width));
  const dividers: SequenceDividerLayout[] = seq.dividers.map((div) => {
    const y = yAt(div.order);
    const label = div.label;
    let labelBounds: Rect | undefined;
    if (label) {
      const textW = defaultMeasurer.measureText(label, DIVIDER_STYLE).width;
      const width = Math.ceil(textW + 18);
      labelBounds = { x: (firstX + lastX) / 2 - width / 2, y: y - 10, width, height: 20 };
    }
    return { id: div.id, y, x0: firstX - 8, x1: lastX + 8, label, labelBounds };
  });

  const showFooters = seq.messages.length >= 6 || lifeEnd - contentTop >= 460;
  const footers: SequenceParticipantFooter[] = [];
  if (showFooters) {
    for (const col of columns) {
      if (destroyByTarget.has(col.id)) continue;
      const header = nodeById.get(col.id)!;
      const bounds: Rect = {
        x: header.bounds.x,
        y: lifeEnd + FOOTER_GAP,
        width: header.bounds.width,
        height: header.bounds.height,
      };
      footers.push({ participantId: col.id, bounds });
      const life = lifelineById.get(col.id);
      if (life) life.y1 = bounds.y;
    }
  }

  const sequence: SequenceLayoutArtifacts = {
    lifelines,
    activations: activationLayouts,
    fragments,
    notes,
    dividers,
    messages,
    footers,
  };

  let maxX = lastX;
  let maxY = lifeEnd;
  const consider = (x: number, y: number) => {
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
  };
  const considerRect = (r: Rect) => {
    consider(r.x + r.width, r.y + r.height);
    maxX = Math.max(maxX, r.x);
  };
  for (const node of nodes) considerRect(node.bounds);
  for (const frag of fragments) {
    considerRect(frag.bounds);
    considerRect(frag.tab);
  }
  for (const note of notes) considerRect(note.bounds);
  for (const footer of footers) considerRect(footer.bounds);
  for (const msg of messages) {
    for (const p of msg.points) consider(p.x, p.y);
    if (msg.labelBounds) considerRect(msg.labelBounds);
    if (msg.payloadBounds) considerRect(msg.payloadBounds);
    if (msg.endpoint) consider(msg.endpoint.x, msg.endpoint.y);
  }
  for (const div of dividers) {
    consider(div.x0, div.y);
    consider(div.x1, div.y);
    if (div.labelBounds) considerRect(div.labelBounds);
  }

  const layout: LayoutResult = {
    nodes,
    groups: [],
    edgePaths,
    edgeLabels: [],
    direction: "TD",
    algorithmVersion: SEQUENCE_LAYOUT_ALGORITHM,
    layoutMs: performance.now() - t0,
    width: maxX + MARGIN,
    height: maxY + MARGIN,
    sequence,
  };

  return { layout, edges: edgePaths, routerAlgorithm: SEQUENCE_ROUTER_ALGORITHM };
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
