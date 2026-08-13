import type { GraphEdge, GraphModel, StyleDefinition } from "@kekonic/diagrams-core";
import {
  branchEdgeClass,
  branchLabelClass,
  branchSemantics,
  branchStrokeColor,
  resolveEdgeStyles,
  resolveFragmentStyles,
  stylesToInlineCss,
} from "@kekonic/diagrams-theme";
import { escapeXml } from "./utils.ts";
import type { SequenceLayoutArtifacts } from "@kekonic/diagrams-layout";

function pathD(points: Array<{ x: number; y: number }>): string {
  if (points.length === 0) return "";
  let d = `M ${points[0]!.x} ${points[0]!.y}`;
  for (let i = 1; i < points.length; i++) {
    d += ` L ${points[i]!.x} ${points[i]!.y}`;
  }
  return d;
}

/**
 * Sequence keeps flowchart arrow markers (`#flow-arrow`) for sync/async/failure.
 * Destroy is the only special glyph (X on the lifeline).
 */

/**
 * Paint sequence diagram layers under/around participant headers.
 * Call before participant node shells for lifelines/fragments; messages after headers.
 */
export function renderSequenceUnderlay(
  seq: SequenceLayoutArtifacts,
  options?: { roundedCorners?: boolean; styles?: StyleDefinition[] },
): string {
  let body = `<g class="flow-sequence-underlay">`;
  const fragRx = options?.roundedCorners === false ? 0 : 12;
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

    // Outer dashed frame (group chrome). Operand bands carry semantic fills when present.
    const boxFill = hasOperandStyles ? ` fill="transparent"` : "";
    body += `<rect class="flow-sequence-fragment-box" x="${b.x}" y="${b.y}" width="${b.width}" height="${b.height}" rx="${fragRx}" stroke-width="1.6" stroke-dasharray="7 5"${boxFill}/>`;

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
      // Slight inset so the dashed outer stroke stays visible.
      const inset = 1.5;
      const ry = i === 0 || i === frag.operandBands.length - 1 ? Math.max(0, fragRx - 2) : 0;
      body += `<rect class="${opClass}" data-start-order="${band.startOrder}" data-end-order="${band.endOrder}" x="${bb.x + inset}" y="${bb.y + inset}" width="${Math.max(0, bb.width - inset * 2)}" height="${Math.max(0, bb.height - inset * 2)}" rx="${ry}"${opStyle}/>`;
    }

    for (const y of frag.separators) {
      body += `<line class="flow-sequence-fragment-sep" x1="${b.x}" y1="${y}" x2="${b.x + b.width}" y2="${y}" stroke="var(--kd-sequence-fragment-stroke, var(--kd-group-stroke))" stroke-width="1" stroke-dasharray="4 3"/>`;
    }
    for (const lab of frag.operandLabels) {
      body += `<text class="flow-sequence-fragment-label" x="${lab.x}" y="${lab.y + 11}">${escapeXml(lab.text)}</text>`;
    }
    body += `</g>`;
  }

  for (const life of seq.lifelines) {
    body += `<line class="flow-sequence-lifeline" data-participant-id="${escapeXml(life.participantId)}" x1="${life.x}" y1="${life.y0}" x2="${life.x}" y2="${life.y1}" stroke="var(--kd-sequence-lifeline, var(--kd-edge))" stroke-width="1.2" stroke-dasharray="4 4"/>`;
  }

  for (const act of seq.activations) {
    const b = act.bounds;
    body += `<rect class="flow-sequence-activation" data-activation-id="${escapeXml(act.id)}" data-participant-id="${escapeXml(act.participantId)}" data-start-order="${act.startOrder}" data-end-order="${act.endOrder}" x="${b.x}" y="${b.y}" width="${b.width}" height="${b.height}" fill="var(--kd-sequence-activation-fill, var(--kd-node-fill))" stroke="var(--kd-sequence-activation-stroke, var(--kd-edge))" stroke-width="1"/>`;
  }

  for (const div of seq.dividers) {
    body += `<g class="flow-sequence-divider">`;
    body += `<line x1="${div.x0}" y1="${div.y}" x2="${div.x1}" y2="${div.y}" stroke="var(--kd-muted, var(--kd-edge))" stroke-width="1" stroke-dasharray="2 4"/>`;
    if (div.label) {
      const mid = (div.x0 + div.x1) / 2;
      // Keep label clearly above the rule (layout reserves a divider band).
      body += `<text class="flow-sequence-divider-label" x="${mid}" y="${div.y - 10}" text-anchor="middle">${escapeXml(div.label)}</text>`;
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
  if (!edge) {
    if (messageKind === "return" || messageKind === "async") return ` stroke-dasharray="6 4"`;
    return "";
  }
  const edgeStyles = resolveEdgeStyles(edge, styles);
  if (edgeStyles.strokeDash && edgeStyles.strokeDash !== "none") {
    return ` stroke-dasharray="${escapeXml(edgeStyles.strokeDash)}"`;
  }
  if (edge.identifying === false) return ` stroke-dasharray="5 4"`;
  if (edge.kind === "dependency") return ` stroke-dasharray="2 4"`;
  if (edge.kind === "async" || edge.kind === "eventual") return ` stroke-dasharray="6 4"`;
  const branch = branchSemantics(edge.label, edge.branch);
  if (branch !== "neutral" && edge.kind === "sync") return ` stroke-dasharray="7 5"`;
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
  if (!edge) {
    const color =
      messageKind === "failure" || messageKind === "destroy"
        ? "var(--kd-danger)"
        : messageKind === "async"
          ? "var(--kd-async-stroke)"
          : "var(--kd-edge)";
    return { color, width: 2, styleAttr: "", branchClass: "", labelClass: "", styleClasses: "" };
  }
  const edgeStyles = resolveEdgeStyles(edge, styles);
  const branch = branchSemantics(edge.label, edge.branch);
  const styledStroke = edgeStyles.cssVars["--edge-stroke"];
  let color =
    styledStroke ??
    (edge.kind === "failure"
      ? "var(--kd-danger)"
      : edge.kind === "async" || edge.kind === "eventual"
        ? "var(--kd-async-stroke)"
        : "var(--kd-edge)");
  color = branchStrokeColor(branch, color);
  const width = edgeStyles.strokeWidth ?? (edge.kind === "failure" ? 2.2 : 2);
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

export function renderSequenceOverlay(graph: GraphModel, seq: SequenceLayoutArtifacts): string {
  let body = `<g class="flow-sequence-overlay">`;
  const irMsg = new Map((graph.sequence?.messages ?? []).map((m) => [m.id, m]));

  for (const msg of seq.messages) {
    const kind = msg.kind;
    const edge = graph.edges.find((e) => e.id === msg.messageId);
    const meta = irMsg.get(msg.messageId);
    const from = edge?.from ?? meta?.from ?? undefined;
    const to = edge?.to ?? meta?.to ?? undefined;
    const paint = sequenceStroke(edge, kind, graph.styles);
    const edgeKindClass = edge ? ` flow-edge-${edge.kind}` : "";
    const order = edge?.sequenceOrder ?? meta?.order;
    const cls =
      `flow-sequence-message flow-sequence-message-${escapeXml(kind)} flow-edge${edgeKindClass} ${paint.branchClass} ${paint.styleClasses}`.trim();
    const edgeIdAttr = edge ? ` data-edge-id="${escapeXml(edge.id)}"` : "";
    const fromAttr = from ? ` data-edge-from="${escapeXml(from)}"` : "";
    const toAttr = to ? ` data-edge-to="${escapeXml(to)}"` : "";
    const orderAttr = order != null ? ` data-sequence-order="${order}"` : "";
    body += `<g class="${cls}" data-message-id="${escapeXml(msg.messageId)}"${edgeIdAttr}${fromAttr}${toAttr}${orderAttr}${paint.styleAttr}>`;

    if (kind === "destroy" && msg.points.length >= 4) {
      body += `<path class="flow-edge-path flow-sequence-message-path" d="${pathD([msg.points[0]!, msg.points[1]!])}" stroke="${paint.color}" stroke-width="${paint.width}" fill="none"/>`;
      body += `<path class="flow-sequence-message-path" d="${pathD([msg.points[2]!, msg.points[3]!])}" stroke="${paint.color}" stroke-width="${paint.width}" fill="none"/>`;
    } else {
      const dash = sequenceEdgeDash(edge, kind, graph.styles);
      // Same filled arrow as flowchart edges (`#flow-arrow` from svg.ts defs).
      const marker = kind === "destroy" ? "" : ` marker-end="url(#flow-arrow)"`;
      body += `<path class="flow-edge-path flow-sequence-message-path" d="${pathD(msg.points)}" fill="none" stroke="${paint.color}" stroke-width="${paint.width}"${dash}${marker}/>`;
    }

    if (msg.label && msg.labelCenter) {
      const text = msg.number != null ? `${msg.number}. ${msg.label}` : msg.label;
      const labelCls =
        `flow-sequence-message-label flow-edge-label-text ${paint.labelClass}`.trim();
      body += `<text class="${labelCls}" x="${msg.labelCenter.x}" y="${msg.labelCenter.y}" text-anchor="middle">${escapeXml(text)}</text>`;
    }
    body += `</g>`;
  }

  for (const note of seq.notes) {
    const b = note.bounds;
    body += `<g class="flow-sequence-note" data-note-id="${escapeXml(note.id)}">`;
    body += `<rect x="${b.x}" y="${b.y}" width="${b.width}" height="${b.height}" rx="2" fill="var(--kd-sequence-note-fill, var(--kd-node-fill))" stroke="var(--kd-sequence-note-stroke, var(--kd-edge))" stroke-width="1"/>`;
    body += `<text class="flow-sequence-note-text" x="${b.x + 8}" y="${b.y + 16}">${escapeXml(note.text)}</text>`;
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
