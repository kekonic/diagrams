import type { GraphEdge, GraphModel, Point, Rect, StyleDefinition } from "@kekonic/diagrams-core";
import {
  branchEdgeClass,
  branchLabelClass,
  branchSemantics,
  branchStrokeColor,
  resolveEdgeStyles,
  resolveFragmentStyles,
  stylesToInlineCss,
} from "@kekonic/diagrams-theme";
import { flowEdgeDasharray } from "./edge-kind-stroke.ts";
import { sketchOpenPath } from "./sketch-stroke.ts";
import { escapeXml } from "./utils.ts";
import type { SequenceLayoutArtifacts } from "@kekonic/diagrams-layout";

function fmt(value: number): string {
  const rounded = Math.round(value * 100) / 100;
  return String(rounded);
}

function pathD(points: Array<{ x: number; y: number }>): string {
  if (points.length === 0) return "";
  let d = `M ${fmt(points[0]!.x)} ${fmt(points[0]!.y)}`;
  for (let i = 1; i < points.length; i++) {
    d += ` L ${fmt(points[i]!.x)} ${fmt(points[i]!.y)}`;
  }
  return d;
}

/** Rounded orthogonal polyline — self-calls read as a loop, not a jagged staple. */
function roundedPolyline(points: Point[], radius: number): string {
  if (points.length < 2) return "";
  if (points.length === 2) return pathD(points);
  let d = `M ${fmt(points[0]!.x)} ${fmt(points[0]!.y)}`;
  for (let i = 1; i < points.length - 1; i++) {
    const prev = points[i - 1]!;
    const curr = points[i]!;
    const next = points[i + 1]!;
    const inLen = Math.hypot(curr.x - prev.x, curr.y - prev.y);
    const outLen = Math.hypot(next.x - curr.x, next.y - curr.y);
    const cut = Math.min(radius, inLen / 2, outLen / 2);
    if (cut < 0.6 || inLen < 0.6 || outLen < 0.6) {
      d += ` L ${fmt(curr.x)} ${fmt(curr.y)}`;
      continue;
    }
    const inX = curr.x - ((curr.x - prev.x) / inLen) * cut;
    const inY = curr.y - ((curr.y - prev.y) / inLen) * cut;
    const outX = curr.x + ((next.x - curr.x) / outLen) * cut;
    const outY = curr.y + ((next.y - curr.y) / outLen) * cut;
    d += ` L ${fmt(inX)} ${fmt(inY)} Q ${fmt(curr.x)} ${fmt(curr.y)} ${fmt(outX)} ${fmt(outY)}`;
  }
  const last = points[points.length - 1]!;
  d += ` L ${fmt(last.x)} ${fmt(last.y)}`;
  return d;
}

function shortenEnd(points: Point[], amount: number): Point[] {
  if (points.length < 2 || amount <= 0) return points;
  const a = points[points.length - 2]!;
  const b = points[points.length - 1]!;
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy);
  if (len <= amount + 0.5) return points;
  const t = (len - amount) / len;
  const next = points.slice(0, -1);
  next.push({ x: a.x + dx * t, y: a.y + dy * t });
  return next;
}

function shortenStart(points: Point[], amount: number): Point[] {
  if (points.length < 2 || amount <= 0) return points;
  const a = points[0]!;
  const b = points[1]!;
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy);
  if (len <= amount + 0.5) return points;
  const t = amount / len;
  const next = points.slice();
  next[0] = { x: a.x + dx * t, y: a.y + dy * t };
  return next;
}

function arrowHead(tip: Point, tail: Point, kind: "filled" | "open"): string {
  const ang = Math.atan2(tip.y - tail.y, tip.x - tail.x);
  const len = kind === "filled" ? 9 : 10;
  const spread = kind === "filled" ? 0.4 : 0.5;
  const p1 = {
    x: tip.x - len * Math.cos(ang - spread),
    y: tip.y - len * Math.sin(ang - spread),
  };
  const p2 = {
    x: tip.x - len * Math.cos(ang + spread),
    y: tip.y - len * Math.sin(ang + spread),
  };
  if (kind === "open") {
    return `M ${fmt(p1.x)} ${fmt(p1.y)} L ${fmt(tip.x)} ${fmt(tip.y)} L ${fmt(p2.x)} ${fmt(p2.y)}`;
  }
  return `M ${fmt(tip.x)} ${fmt(tip.y)} L ${fmt(p1.x)} ${fmt(p1.y)} L ${fmt(p2.x)} ${fmt(p2.y)} Z`;
}

function tabPath(tab: Rect): string {
  const ear = Math.min(9, tab.width / 4);
  const x = tab.x;
  const y = tab.y;
  const w = tab.width;
  const h = tab.height;
  return `M ${fmt(x)} ${fmt(y)} H ${fmt(x + w - ear)} L ${fmt(x + w)} ${fmt(y + h / 2)} L ${fmt(x + w - ear)} ${fmt(y + h)} H ${fmt(x)} Z`;
}

function notePaths(bounds: Rect): { card: string; fold: string } {
  const fold = Math.min(12, bounds.width / 4, bounds.height / 3);
  const x = bounds.x;
  const y = bounds.y;
  const w = bounds.width;
  const h = bounds.height;
  return {
    card: `M ${fmt(x)} ${fmt(y)} H ${fmt(x + w - fold)} L ${fmt(x + w)} ${fmt(y + fold)} V ${fmt(y + h)} H ${fmt(x)} Z`,
    fold: `M ${fmt(x + w - fold)} ${fmt(y)} V ${fmt(y + fold)} H ${fmt(x + w)}`,
  };
}

function messageHead(kind: string): "filled" | "open" | "none" {
  if (kind === "destroy" || kind === "lost") return "none";
  if (kind === "return" || kind === "async" || kind === "eventual") return "open";
  return "filled";
}

/**
 * Paint sequence diagram layers under participant headers.
 * Lifelines, frames, and activations sit behind the message overlay.
 */
export function renderSequenceUnderlay(
  seq: SequenceLayoutArtifacts,
  options?: { roundedCorners?: boolean; styles?: StyleDefinition[]; sketch?: boolean },
): string {
  let body = `<g class="flow-sequence-underlay">`;
  const rounded = options?.roundedCorners !== false;
  const fragRx = rounded ? 8 : 0;
  const styles = options?.styles ?? [];

  for (const frag of seq.fragments) {
    const b = frag.bounds;
    const hasOperandStyles = frag.operandBands.some((op) => op.styleRefs.length > 0);
    const frameResolved = resolveFragmentStyles(
      { styleRefs: hasOperandStyles ? [] : frag.styleRefs, unresolvedVars: frag.unresolvedVars },
      styles,
    );
    const frameClass = frameResolved.classes.join(" ");
    const frameStyle = Object.keys(frameResolved.cssVars).length
      ? ` style="${escapeXml(stylesToInlineCss(frameResolved.cssVars))}"`
      : "";
    const cls =
      `flow-sequence-fragment flow-sequence-fragment-${escapeXml(frag.operator)} ${frameClass}`.trim();
    body += `<g class="${cls}" data-fragment-id="${escapeXml(frag.id)}" data-start-order="${frag.startOrder}" data-end-order="${frag.endOrder}"${frameStyle}>`;

    const boxFill = hasOperandStyles ? ` fill="transparent"` : "";
    body += `<rect class="flow-sequence-fragment-box" x="${fmt(b.x)}" y="${fmt(b.y)}" width="${fmt(b.width)}" height="${fmt(b.height)}" rx="${fragRx}"${boxFill}/>`;

    for (const [i, band] of frag.operandBands.entries()) {
      if (band.styleRefs.length === 0) continue;
      const opResolved = resolveFragmentStyles(
        { styleRefs: band.styleRefs, unresolvedVars: {} },
        styles,
      );
      const opClass = `flow-sequence-fragment-operand ${opResolved.classes.join(" ")}`.trim();
      const opStyle = Object.keys(opResolved.cssVars).length
        ? ` style="${escapeXml(stylesToInlineCss(opResolved.cssVars))}"`
        : "";
      const bb = band.bounds;
      const inset = 1.25;
      const ry =
        rounded && (i === 0 || i === frag.operandBands.length - 1) ? Math.max(0, fragRx - 2) : 0;
      body += `<rect class="${opClass}" data-start-order="${band.startOrder}" data-end-order="${band.endOrder}" x="${fmt(bb.x + inset)}" y="${fmt(bb.y + inset)}" width="${fmt(Math.max(0, bb.width - inset * 2))}" height="${fmt(Math.max(0, bb.height - inset * 2))}" rx="${ry}"${opStyle}/>`;
    }

    body += `<path class="flow-sequence-fragment-tab" d="${tabPath(frag.tab)}"/>`;

    for (const y of frag.separators) {
      body += `<line class="flow-sequence-fragment-sep" x1="${fmt(b.x)}" y1="${fmt(y)}" x2="${fmt(b.x + b.width)}" y2="${fmt(y)}"/>`;
    }
    body += `</g>`;
  }

  for (const life of seq.lifelines) {
    if (options?.sketch) {
      const d = sketchOpenPath(
        `M ${fmt(life.x)} ${fmt(life.y0)} L ${fmt(life.x)} ${fmt(life.y1)}`,
        `lifeline:${life.participantId}`,
      );
      body += `<path class="flow-sequence-lifeline" data-participant-id="${escapeXml(life.participantId)}" d="${d}" fill="none"/>`;
    } else {
      body += `<line class="flow-sequence-lifeline" data-participant-id="${escapeXml(life.participantId)}" x1="${fmt(life.x)}" y1="${fmt(life.y0)}" x2="${fmt(life.x)}" y2="${fmt(life.y1)}"/>`;
    }
  }

  for (const act of seq.activations) {
    const b = act.bounds;
    const rx = rounded ? 2 : 0;
    body += `<rect class="flow-sequence-activation" data-activation-id="${escapeXml(act.id)}" data-participant-id="${escapeXml(act.participantId)}" data-start-order="${act.startOrder}" data-end-order="${act.endOrder}" x="${fmt(b.x)}" y="${fmt(b.y)}" width="${fmt(b.width)}" height="${fmt(b.height)}" rx="${rx}"/>`;
  }

  // Operator names and guards sit above lifelines and execution bars so a bar
  // never strikes through the header.
  body += `<g class="flow-sequence-fragment-labels">`;
  for (const frag of seq.fragments) {
    const tabTextX = frag.tab.x + (frag.tab.width - 9) / 2;
    const tabTextY = frag.tab.y + 14;
    body += `<text class="flow-sequence-fragment-tab-label" x="${fmt(tabTextX)}" y="${fmt(tabTextY)}" text-anchor="middle">${escapeXml(frag.operatorLabel)}</text>`;
    if (frag.guard) {
      body += `<text class="flow-sequence-fragment-guard" x="${fmt(frag.guard.x)}" y="${fmt(frag.guard.y)}">[${escapeXml(frag.guard.text)}]</text>`;
    }
    for (const lab of frag.operandLabels) {
      body += `<text class="flow-sequence-fragment-label" x="${fmt(lab.x)}" y="${fmt(lab.y)}">[${escapeXml(lab.text)}]</text>`;
    }
  }
  body += `</g>`;

  for (const div of seq.dividers) {
    const chip = div.labelBounds;
    body += `<g class="flow-sequence-divider" data-divider-id="${escapeXml(div.id)}">`;
    if (chip && div.label) {
      body += `<line class="flow-sequence-divider-rule" x1="${fmt(div.x0)}" y1="${fmt(div.y)}" x2="${fmt(chip.x - 8)}" y2="${fmt(div.y)}"/>`;
      body += `<line class="flow-sequence-divider-rule" x1="${fmt(chip.x + chip.width + 8)}" y1="${fmt(div.y)}" x2="${fmt(div.x1)}" y2="${fmt(div.y)}"/>`;
      const rx = rounded ? chip.height / 2 : 0;
      body += `<rect class="flow-sequence-divider-chip" x="${fmt(chip.x)}" y="${fmt(chip.y)}" width="${fmt(chip.width)}" height="${fmt(chip.height)}" rx="${rx}"/>`;
      body += `<text class="flow-sequence-divider-label" x="${fmt(chip.x + chip.width / 2)}" y="${fmt(chip.y + 14)}" text-anchor="middle">${escapeXml(div.label)}</text>`;
    } else {
      body += `<line class="flow-sequence-divider-rule" x1="${fmt(div.x0)}" y1="${fmt(div.y)}" x2="${fmt(div.x1)}" y2="${fmt(div.y)}"/>`;
    }
    body += `</g>`;
  }

  body += `</g>`;
  return body;
}

function sequenceEdgeDash(
  edge: GraphEdge | undefined,
  messageKind: string,
  styles: GraphModel["styles"],
): string {
  if (edge) {
    const edgeStyles = resolveEdgeStyles(edge, styles);
    if (edgeStyles.strokeDash && edgeStyles.strokeDash !== "none") {
      return ` stroke-dasharray="${escapeXml(edgeStyles.strokeDash)}"`;
    }
  }
  if (messageKind === "return" || messageKind === "create") return ` stroke-dasharray="5 3.5"`;
  if (messageKind === "eventual") {
    const dotted = flowEdgeDasharray("eventual");
    return dotted ? ` stroke-dasharray="${dotted}"` : "";
  }
  return "";
}

function sequenceStroke(
  edge: GraphEdge | undefined,
  messageKind: string,
  styles: GraphModel["styles"],
): {
  color: string;
  width: number;
  styleAttr: string;
  branchClass: string;
  labelClass: string;
  styleClasses: string;
} {
  const fallback =
    messageKind === "failure" || messageKind === "destroy"
      ? "var(--kd-danger)"
      : messageKind === "async" || messageKind === "eventual"
        ? "var(--kd-async-stroke)"
        : messageKind === "create"
          ? "var(--kd-accent)"
          : messageKind === "return"
            ? "var(--kd-muted)"
            : "var(--kd-edge)";
  if (!edge) {
    return {
      color: fallback,
      width: 1.75,
      styleAttr: "",
      branchClass: "",
      labelClass: "",
      styleClasses: "",
    };
  }
  const edgeStyles = resolveEdgeStyles(edge, styles);
  const branch = branchSemantics(edge.label, edge.branch);
  const styledStroke = edgeStyles.cssVars["--edge-stroke"];
  let color = styledStroke ?? fallback;
  if (!styledStroke && edge.kind === "failure") color = "var(--kd-danger)";
  else if (!styledStroke && (edge.kind === "async" || edge.kind === "eventual"))
    color = "var(--kd-async-stroke)";
  color = branchStrokeColor(branch, color);
  const width = edgeStyles.strokeWidth ?? (messageKind === "failure" ? 2.05 : 1.75);
  const styleAttr = Object.keys(edgeStyles.cssVars).length
    ? ` style="${escapeXml(stylesToInlineCss(edgeStyles.cssVars))}"`
    : "";
  return {
    color,
    width,
    styleAttr,
    branchClass: branchEdgeClass(branch),
    labelClass: branchLabelClass(branch),
    styleClasses: edgeStyles.classes.join(" "),
  };
}

export function renderSequenceOverlay(
  graph: GraphModel,
  seq: SequenceLayoutArtifacts,
  options?: { roundedCorners?: boolean; sketch?: boolean },
): string {
  let body = `<g class="flow-sequence-overlay">`;
  const irMsg = new Map((graph.sequence?.messages ?? []).map((m) => [m.id, m]));
  const rounded = options?.roundedCorners !== false;
  // Callers pass the render flag, which is false unless the diagram opts in.
  const chipRx = options?.roundedCorners === true ? 10 : 0;

  for (const msg of seq.messages) {
    const kind = msg.kind;
    const edge = graph.edges.find((e) => e.id === msg.messageId);
    const meta = irMsg.get(msg.messageId);
    const from = edge?.from ?? meta?.from ?? undefined;
    const to = edge?.to ?? meta?.to ?? undefined;
    const paint = sequenceStroke(edge, kind, graph.styles);
    const edgeKindClass = edge ? ` flow-edge-${edge.kind}` : "";
    const order = edge?.sequenceOrder ?? meta?.order;
    const head = messageHead(kind);
    const cls =
      `flow-sequence-message flow-sequence-message-${escapeXml(kind)} flow-edge${edgeKindClass} ${paint.branchClass} ${paint.styleClasses}`.trim();
    const edgeIdAttr = edge ? ` data-edge-id="${escapeXml(edge.id)}"` : "";
    const fromAttr = from ? ` data-edge-from="${escapeXml(from)}"` : "";
    const toAttr = to ? ` data-edge-to="${escapeXml(to)}"` : "";
    const orderAttr = order != null ? ` data-sequence-order="${order}"` : "";
    body += `<g class="${cls}" data-message-id="${escapeXml(msg.messageId)}" data-sequence-head="${head}"${edgeIdAttr}${fromAttr}${toAttr}${orderAttr}${paint.styleAttr}>`;

    if (kind === "destroy" && msg.points.length >= 4) {
      body += `<path class="flow-edge-path flow-sequence-message-path flow-sequence-destroy" d="${pathD([msg.points[0]!, msg.points[1]!])}" stroke="${paint.color}" stroke-width="2.15" fill="none"/>`;
      body += `<path class="flow-sequence-destroy" d="${pathD([msg.points[2]!, msg.points[3]!])}" stroke="${paint.color}" stroke-width="2.15" fill="none"/>`;
    } else if (msg.points.length >= 2) {
      const dash = sequenceEdgeDash(edge, kind, graph.styles);
      let shaft = msg.points;
      if (msg.endpoint && msg.endpointAt === "start") shaft = shortenStart(shaft, 6);
      // Stop the shaft at the mouth of the head. An open head with the line run
      // through the tip reads as a stub, especially on a dashed reply.
      if (head === "filled") shaft = shortenEnd(shaft, 7.2);
      else if (head === "open") shaft = shortenEnd(shaft, 8.2);
      const self = kind !== "lost" && kind !== "found" && msg.points.length >= 4;
      const routed = self ? roundedPolyline(shaft, 8) : pathD(shaft);
      const d = options?.sketch ? sketchOpenPath(routed, `message:${msg.messageId}`) : routed;
      body += `<path class="flow-edge-path flow-sequence-message-path" d="${d}" fill="none" stroke="${paint.color}" stroke-width="${paint.width}"${dash}/>`;
      if (head !== "none") {
        const tip = msg.points[msg.points.length - 1]!;
        const tail = msg.points[msg.points.length - 2]!;
        const headClass =
          head === "open"
            ? "flow-sequence-message-head flow-sequence-message-head-open"
            : "flow-sequence-message-head flow-sequence-message-head-filled";
        if (head === "open") {
          body += `<path class="${headClass}" d="${arrowHead(tip, tail, "open")}" fill="none" stroke="${paint.color}" stroke-width="1.75" stroke-dasharray="none"/>`;
        } else {
          body += `<path class="${headClass}" d="${arrowHead(tip, tail, "filled")}" fill="${paint.color}" stroke="none"/>`;
        }
      }
      if (msg.endpoint) {
        body += `<circle class="flow-sequence-endpoint" cx="${fmt(msg.endpoint.x)}" cy="${fmt(msg.endpoint.y)}" r="4.25"/>`;
      }
    }

    if (msg.payloadBounds && msg.payloadLines?.length) {
      const card = msg.payloadBounds;
      const tone =
        kind === "async" || kind === "eventual"
          ? kind
          : kind === "return"
            ? "return"
            : kind === "failure" || kind === "destroy"
              ? "failure"
              : "call";
      const cardRx = options?.roundedCorners === true ? 3 : 0;
      const textX = card.x + 3 + 10;
      const textY = card.y + 8 + 10;
      let tspans = "";
      msg.payloadLines.forEach((line, index) => {
        const dy = index === 0 ? 0 : 14;
        tspans += `<tspan x="${fmt(textX)}" dy="${dy}">${escapeXml(line)}</tspan>`;
      });
      body += `<g class="flow-sequence-payload flow-sequence-payload-${tone}">`;
      body += `<rect class="flow-sequence-payload-card" x="${fmt(card.x)}" y="${fmt(card.y)}" width="${fmt(card.width)}" height="${fmt(card.height)}" rx="${cardRx}"/>`;
      body += `<rect class="flow-sequence-payload-accent" x="${fmt(card.x)}" y="${fmt(card.y)}" width="3" height="${fmt(card.height)}"/>`;
      body += `<text class="flow-sequence-payload-text" xml:space="preserve" x="${fmt(textX)}" y="${fmt(textY)}">${tspans}</text>`;
      body += `</g>`;
    }

    if (msg.label && msg.labelCenter && msg.labelBounds) {
      const chip = msg.labelBounds;
      body += `<rect class="flow-sequence-message-label-bg flow-edge-label-bg" x="${fmt(chip.x)}" y="${fmt(chip.y)}" width="${fmt(chip.width)}" height="${fmt(chip.height)}" rx="${chipRx}"/>`;
      if (msg.number != null) {
        const badgeW = msg.number >= 10 ? 18 : 14;
        const badgeH = 14;
        const badgeX = chip.x + 4;
        const badgeY = chip.y + (chip.height - badgeH) / 2;
        const badgeRx = rounded ? badgeH / 2 : 2;
        body += `<rect class="flow-sequence-badge" x="${fmt(badgeX)}" y="${fmt(badgeY)}" width="${badgeW}" height="${badgeH}" rx="${badgeRx}"/>`;
        body += `<text class="flow-sequence-badge-text" x="${fmt(badgeX + badgeW / 2)}" y="${fmt(badgeY + 10.5)}" text-anchor="middle">${msg.number}</text>`;
      }
      const labelCls =
        `flow-sequence-message-label flow-edge-label-text ${paint.labelClass}`.trim();
      body += `<text class="${labelCls}" x="${fmt(msg.labelCenter.x)}" y="${fmt(msg.labelCenter.y)}" text-anchor="middle">${escapeXml(msg.label)}</text>`;
    }
    body += `</g>`;
  }

  for (const note of seq.notes) {
    const b = note.bounds;
    const paths = notePaths(b);
    const lines = note.lines?.length ? note.lines : [note.text];
    body += `<g class="flow-sequence-note" data-note-id="${escapeXml(note.id)}">`;
    body += `<path class="flow-sequence-note-card" d="${paths.card}"/>`;
    body += `<path class="flow-sequence-note-fold" d="${paths.fold}"/>`;
    let tspans = "";
    lines.forEach((line, index) => {
      const dy = index === 0 ? 0 : 15;
      tspans += `<tspan x="${fmt(b.x + 10)}" dy="${dy}">${escapeXml(line)}</tspan>`;
    });
    body += `<text class="flow-sequence-note-text" x="${fmt(b.x + 10)}" y="${fmt(b.y + 16)}">${tspans}</text>`;
    body += `</g>`;
  }

  body += `</g>`;
  return body;
}

export function isSequenceLayout(layout: {
  sequence?: SequenceLayoutArtifacts;
}): layout is { sequence: SequenceLayoutArtifacts } {
  return layout.sequence != null;
}
