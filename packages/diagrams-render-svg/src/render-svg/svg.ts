import type {
  GraphModel,
  GraphNode,
  Rect,
  RenderOptions,
  RoutingOptions,
} from "@kekonic/diagrams-core";
import {
  displayLabelCase,
  formatLabelText,
  kindHasCapability,
  resolvePresentation,
} from "@kekonic/diagrams-core";
import { renderIconById, resolveIconPaint, type IconPaintMode } from "@kekonic/diagrams-icons";
import type { LayoutResult } from "@kekonic/diagrams-layout";
import type { MeasuredNode } from "@kekonic/diagrams-layout";
import { cardIconColumnWidth, GROUP_ICON_GAP, GROUP_ICON_SIZE } from "@kekonic/diagrams-layout";
import type {
  TreatedEdge,
  RenderedEdgeSegment,
  EdgeLabelPlacement,
} from "@kekonic/diagrams-routing";
import { EDGE_LABEL_ICON, EDGE_LABEL_ICON_GAP, EDGE_LABEL_PAD_X } from "@kekonic/diagrams-routing";

import { escapeXml, kindClassName } from "./utils.ts";
import { themeToCss } from "@kekonic/diagrams-theme";
import { kindSubtitle } from "@kekonic/diagrams-theme";
import {
  branchEdgeClass,
  branchLabelClass,
  branchSemantics,
  branchStrokeColor,
} from "@kekonic/diagrams-theme";
import { resolveEdgeStyles, resolveNodeStyles, stylesToInlineCss } from "@kekonic/diagrams-theme";
import { edgeStrokePath } from "./edge-paths.ts";
import {
  clampEdgeLabels,
  computeCanvasLayout,
  groupAccentColor,
  hasPresentationChrome,
  renderTitleBlock,
} from "../presentation/index.ts";
import { isErdTableNode, renderTableBackground, renderTableForeground } from "./table.ts";
import { isSequenceLayout, renderSequenceOverlay, renderSequenceUnderlay } from "./sequence.ts";
import { isPureCardinalityLabel } from "@kekonic/diagrams-core";
import { cardinalityMarkerDefs, cardinalityMarkerIds } from "./cardinality-markers.ts";
import { cylinderRadii, renderNodeShell, type ShellPaint } from "./shapes.ts";
import {
  hexagonPointsString,
  normalizeShapeId,
  resolveShapeGeometry,
} from "@kekonic/diagrams-geometry";

export type SvgRenderInput = {
  graph: GraphModel;
  layout: LayoutResult;
  measured: MeasuredNode[];
  treatedEdges: TreatedEdge[];
  labels: EdgeLabelPlacement[];
  options: RenderOptions;
  routingOptions?: Pick<RoutingOptions, "route" | "cornerRadius" | "arrowheads">;
  /** SVG fragment inserted under diagram content (after title chrome). */
  underlay?: string;
};

const CARD_SHAPES = new Set(["rounded", "rectangle", "pill"]);
const CARD_PAD = 18;
const ICON_ONLY_GLYPH = 28;
const ICON_TEXT_GAP = 12;
const TITLE_LINE_HEIGHT = 18;
const SUBTITLE_HEIGHT = 15;
const TECHNOLOGY_LINE_HEIGHT = 14;
const DESCRIPTION_LINE_HEIGHT = 14;
const SECTION_GAP = 4;
const RICH_CONTENT_PAD = 26;

/** Nearest point on a rect edge to `p` (for label leader stems). */
function closestPointOnRect(p: { x: number; y: number }, r: Rect): { x: number; y: number } {
  const x = Math.min(Math.max(p.x, r.x), r.x + r.width);
  const y = Math.min(Math.max(p.y, r.y), r.y + r.height);
  if (p.x >= r.x && p.x <= r.x + r.width && p.y >= r.y && p.y <= r.y + r.height) {
    const left = p.x - r.x;
    const right = r.x + r.width - p.x;
    const top = p.y - r.y;
    const bottom = r.y + r.height - p.y;
    const m = Math.min(left, right, top, bottom);
    if (m === left) return { x: r.x, y: p.y };
    if (m === right) return { x: r.x + r.width, y: p.y };
    if (m === top) return { x: p.x, y: r.y };
    return { x: p.x, y: r.y + r.height };
  }
  return { x, y };
}

/** Leftmost x of nodes/groups in layout space (typically LAYOUT_MARGIN). */
function layoutContentLeft(layout: LayoutResult): number {
  let minX = Infinity;
  for (const n of layout.nodes) minX = Math.min(minX, n.bounds.x);
  for (const g of layout.groups) minX = Math.min(minX, g.bounds.x);
  return Number.isFinite(minX) ? minX : 0;
}

/** Group chrome silhouette — rectangle default; hex/circle/ellipse via geometry. */
function renderGroupChromeBox(
  shapeKind: string,
  bounds: { x: number; y: number; width: number; height: number },
  rectRx: number,
  roundedCorners: boolean,
): string {
  const kind = normalizeShapeId(shapeKind);
  const common =
    'class="flow-group-box" fill="var(--kd-group-fill)" stroke="var(--kd-group-stroke)" stroke-width="1.6" stroke-dasharray="7 5"';
  if (kind === "hexagon") {
    return `<polygon points="${hexagonPointsString(bounds)}" ${common} stroke-linejoin="round"/>`;
  }
  if (kind === "circle" || kind === "ellipse") {
    const geometry = resolveShapeGeometry(kind);
    const path = geometry.getPath(bounds, { strokeWidth: 1.6, cornerRadius: 0 });
    return `<path d="${path.d}" ${common}/>`;
  }
  if (kind === "rounded") {
    const rx = roundedCorners ? Math.max(rectRx, 12) : rectRx;
    return `<rect x="${bounds.x}" y="${bounds.y}" width="${bounds.width}" height="${bounds.height}" rx="${rx}" ${common}/>`;
  }
  return `<rect x="${bounds.x}" y="${bounds.y}" width="${bounds.width}" height="${bounds.height}" rx="${rectRx}" ${common}/>`;
}

export function renderSvg(input: SvgRenderInput): string {
  const {
    graph,
    layout,
    measured,
    treatedEdges,
    labels: inputLabels,
    options,
    routingOptions,
    underlay = "",
  } = input;

  // Authored diagram title only — do not invent presentation chrome from graph.id.
  const presentation = resolvePresentation(options.presentation, graph.title);
  const contentBounds = { x: 0, y: 0, width: layout.width, height: layout.height };
  // Keep relationship labels off node cards (ERD tables especially).
  const nodeKeepOuts = layout.nodes.map((n) => n.bounds);
  const labels = clampEdgeLabels(
    inputLabels,
    contentBounds,
    presentation.clampLabels,
    nodeKeepOuts,
  );

  const canvas = computeCanvasLayout(layout.width, layout.height, presentation);
  const w = canvas.width;
  const h = canvas.height;
  const { contentOffsetX: dx, contentOffsetY: dy } = canvas;

  const theme = options.theme ?? "dark";
  const snapshot = options.snapshotTheme ?? false;
  // Accessible name via aria-label — SVG <title> also becomes a native hover
  // tooltip on the whole canvas, which is miserable in interactive embeds.
  const title = escapeXml(graph.title ?? "Diagram");
  const desc = escapeXml(
    `Diagram with ${graph.nodes.length} nodes and ${graph.edges.length} edges`,
  );

  const measureMap = new Map(measured.map((m) => [m.nodeId, m]));
  const nodeMap = new Map(layout.nodes.map((n) => [n.nodeId, n]));
  let body = "";

  if (snapshot) {
    body += `<style>${themeToCss(theme, true)}</style>`;
  }

  const useShadow = options.shadows === true;
  const useRoundedCorners = options.roundedCorners === true;

  body += `<defs>`;
  if (useShadow) {
    body += `
    <filter id="flow-node-shadow" x="-28%" y="-28%" width="156%" height="156%">
      <feDropShadow dx="0" dy="8" stdDeviation="12" flood-color="var(--kd-node-shadow)" flood-opacity="0.95"/>
    </filter>
    <filter id="flow-node-glow" x="-35%" y="-35%" width="170%" height="170%">
      <feDropShadow dx="0" dy="0" stdDeviation="6" flood-color="var(--kd-node-glow)" flood-opacity="0.65"/>
    </filter>`;
  }
  body += `
    <marker id="flow-arrow" markerWidth="10" markerHeight="10" refX="1.5" refY="5" orient="auto" markerUnits="userSpaceOnUse">
      <path d="M1.5,1.5 L9,5 L1.5,8.5 Z" fill="context-stroke"/>
    </marker>
    <marker id="flow-arrow-start" markerWidth="10" markerHeight="10" refX="1.5" refY="5" orient="auto-start-reverse" markerUnits="userSpaceOnUse">
      <path d="M1.5,1.5 L9,5 L1.5,8.5 Z" fill="context-stroke"/>
    </marker>
    ${cardinalityMarkerDefs()}
  </defs>`;

  // Start-aligned title tracks the diagram content's left edge (layout margin /
  // root group), not canvas padding alone — otherwise title hangs left of groups.
  const titleStartX = dx + layoutContentLeft(layout);
  body += renderTitleBlock(presentation, titleStartX, presentation.padding.top);

  body += `<g class="flow-diagram-content" transform="translate(${dx}, ${dy})">`;
  if (underlay) body += underlay;

  const sequenceMode = isSequenceLayout(layout);
  if (sequenceMode) {
    // Sequence chrome (lifelines, labels) sits on the canvas — paint diagram ground
    // so light/dark tokens stay readable even when the host background differs.
    body += `<rect class="flow-sequence-canvas" x="0" y="0" width="${layout.width}" height="${layout.height}" fill="var(--kd-bg)" pointer-events="none"/>`;
    body += renderSequenceUnderlay(layout.sequence, {
      roundedCorners: useRoundedCorners,
      styles: graph.styles,
    });
  }

  layout.groups.forEach((group, groupIndex) => {
    const g = graph.groups.find((x) => x.id === group.groupId);
    const showChrome = g?.chrome !== false;
    const accent =
      presentation.groupAccent && showChrome ? groupAccentColor(groupIndex) : undefined;
    const styleParts: string[] = [];
    if (accent) {
      styleParts.push(
        `--group-accent: ${accent}`,
        `--kd-group-fill: ${accent}1f`,
        `--kd-group-stroke: ${accent}99`,
      );
    }
    if (g?.iconColor) styleParts.push(`--icon-color: ${g.iconColor}`);
    const accentStyle = styleParts.length ? ` style="${escapeXml(styleParts.join("; "))}"` : "";
    const groupLabel = g
      ? formatLabelText(g.label, displayLabelCase(g.labelAuthored, presentation.labelCase))
      : "";
    const groupIcon = showChrome && g?.icon && g.icon !== "none" ? g.icon : null;

    const chromeClass = showChrome ? "flow-group" : "flow-group flow-group-chromeless";
    body += `<g class="${chromeClass}" data-group-id="${escapeXml(group.groupId)}"${accentStyle}>`;

    if (showChrome) {
      const groupRx = useRoundedCorners ? 12 : 0;
      const { x: gx, y: gy, width: gw, height: gh } = group.bounds;
      const shapeId = g?.shape ? normalizeShapeId(String(g.shape)) : "rectangle";
      body += renderGroupChromeBox(
        shapeId,
        { x: gx, y: gy, width: gw, height: gh },
        groupRx,
        useRoundedCorners,
      );
      if (g) {
        let textX = group.labelBox.x;
        if (groupIcon) {
          const iconCy = group.labelBox.y + group.labelBox.height / 2;
          const iconCx = group.labelBox.x + GROUP_ICON_SIZE / 2;
          body += renderGroupIcon(groupIcon, iconCx, iconCy, g.iconPaint, Boolean(g.iconColor));
          textX = group.labelBox.x + GROUP_ICON_SIZE + GROUP_ICON_GAP;
        }
        body += `<text class="flow-group-label" x="${textX}" y="${group.labelBox.y + 16}">${escapeXml(groupLabel)}</text>`;
      }
    }
    body += `</g>`;
  });

  for (const node of graph.nodes) {
    const ln = nodeMap.get(node.id);
    const m = measureMap.get(node.id);
    if (!ln || !m) continue;
    const resolved = resolveNodeStyles(node, graph.styles);
    const cls =
      `flow-node flow-node-body ${kindClassName(node.kind)} ${resolved.classes.join(" ")}`.trim();
    const styleAttr =
      resolved.cssVars && Object.keys(resolved.cssVars).length
        ? ` style="${escapeXml(stylesToInlineCss(resolved.cssVars))}"`
        : "";
    body += `<g class="${cls}" aria-hidden="true" data-node-id="${escapeXml(node.id)}"${styleAttr}>`;
    if (isErdTableNode(node)) {
      const scale = node.scale && node.scale > 0 ? node.scale : 1;
      body += renderTableBackground(ln.bounds, node.id, scale, useRoundedCorners);
    } else {
      body += renderNodeBackground(
        node,
        ln.bounds,
        resolved.strokeDash,
        useShadow,
        useRoundedCorners,
      );
    }
    body += `</g>`;
  }

  for (const te of treatedEdges) {
    // Sequence messages are painted by renderSequenceOverlay (lifeline-aware).
    if (sequenceMode) break;
    const edge = graph.edges.find((e) => e.id === te.edgeId);
    const edgeStyles = edge ? resolveEdgeStyles(edge, graph.styles) : null;
    const branch = branchSemantics(edge?.label, edge?.branch);
    const branchClass = branchEdgeClass(branch);
    const edgeClass = edge
      ? `flow-edge flow-edge-${edge.kind} ${branchClass} ${edgeStyles?.classes.join(" ") ?? ""}`.trim()
      : "flow-edge";
    const strokeW = edgeStyles?.strokeWidth ?? (edge?.kind === "failure" ? 2.2 : 2);
    const styledStroke = edgeStyles?.cssVars["--edge-stroke"];
    let strokeColor =
      styledStroke ??
      (edge?.kind === "failure"
        ? "var(--kd-danger)"
        : edge?.kind === "async" || edge?.kind === "eventual"
          ? "var(--kd-async-stroke)"
          : "var(--kd-edge)");
    strokeColor = branchStrokeColor(branch, strokeColor);
    const dash =
      edgeStyles?.strokeDash && edgeStyles.strokeDash !== "none"
        ? ` stroke-dasharray="${escapeXml(edgeStyles.strokeDash)}"`
        : edge?.identifying === false
          ? ` stroke-dasharray="5 4"`
          : edge?.kind === "dependency"
            ? ` stroke-dasharray="2 4"`
            : edge?.kind === "async" || edge?.kind === "eventual"
              ? ` stroke-dasharray="6 4"`
              : branch !== "neutral" && edge?.kind === "sync"
                ? ` stroke-dasharray="7 5"`
                : "";
    const edgeStyle = edgeStyles
      ? ` style="${escapeXml(stylesToInlineCss(edgeStyles.cssVars))}"`
      : "";
    const showArrowheads = routingOptions?.arrowheads !== false;
    const cardinality = edge?.cardinality;
    const cardMarkers = cardinality ? cardinalityMarkerIds(cardinality) : undefined;
    const arrows = edge?.arrows ?? "end";
    const useFlowArrows =
      showArrowheads &&
      !cardMarkers &&
      edge != null &&
      (edge.kind === "sync" ||
        edge.kind === "async" ||
        edge.kind === "eventual" ||
        edge.kind === "dependency" ||
        edge.kind === "failure") &&
      arrows !== "none";
    body += `<g class="${edgeClass}" data-edge-id="${escapeXml(te.edgeId)}" data-edge-from="${escapeXml(edge?.from ?? "")}" data-edge-to="${escapeXml(edge?.to ?? "")}"${edgeStyle}>`;
    body += renderTreatedEdgePaths(
      te.segments,
      routingOptions,
      strokeW,
      strokeColor,
      dash,
      useFlowArrows
        ? {
            start: arrows === "start" || arrows === "both",
            end: arrows === "end" || arrows === "both",
          }
        : undefined,
      cardMarkers,
    );
    body += `</g>`;
  }

  for (const node of graph.nodes) {
    const ln = nodeMap.get(node.id);
    const m = measureMap.get(node.id);
    if (!ln || !m) continue;
    const resolved = resolveNodeStyles(node, graph.styles);
    const cls =
      `flow-node flow-node-foreground ${kindClassName(node.kind)} ${resolved.classes.join(" ")}`.trim();
    const styleAttr =
      resolved.cssVars && Object.keys(resolved.cssVars).length
        ? ` style="${escapeXml(stylesToInlineCss(resolved.cssVars))}"`
        : "";
    body += `<g class="${cls}" role="group" aria-label="${escapeXml(node.label)}, ${escapeXml(kindSubtitle(node.kind))} node" data-node-id="${escapeXml(node.id)}"${styleAttr}>`;
    if (isErdTableNode(node)) {
      body += renderTableForeground(node, ln.bounds, useRoundedCorners);
    } else {
      body += renderNodeForeground(
        node,
        ln.bounds,
        m.labelLines,
        m.contentBox,
        resolved.badge,
        options.debug?.showKindLabels === true,
        node.note,
        presentation.showKindSubtitles,
        Boolean(node.iconColor || resolved.cssVars["--icon-color"]),
        m.technologyLines,
        m.descriptionLines,
      );
    }
    body += `</g>`;
  }

  if (sequenceMode) {
    body += renderSequenceOverlay(graph, layout.sequence);
  }

  for (const label of labels) {
    if (sequenceMode) break;
    const edge = graph.edges.find((e) => e.id === label.edgeId);
    // Hide labels that only restate crow's-foot cardinality (keep column mapping labels).
    if (
      edge?.cardinality &&
      isPureCardinalityLabel(edge.label) &&
      isPureCardinalityLabel(label.text) &&
      !edge.fromColumn &&
      !edge.toColumn
    ) {
      continue;
    }
    const branch = branchSemantics(edge?.label ?? label.text, edge?.branch);
    const labelClass = `flow-edge-label ${branchLabelClass(branch)}`.trim();
    const rx = useRoundedCorners ? label.bounds.height / 2 : 0;
    const textCy = label.bounds.y + label.bounds.height / 2;
    const hasIcon = Boolean(edge?.icon && edge.icon !== "none");
    // ERD column mappings and quoted edge labels must keep authored spelling.
    const erdColumnLabel = Boolean(edge?.fromColumn || edge?.toColumn) || /→/.test(label.text);
    const labelText =
      label.text.length > 0
        ? formatLabelText(
            label.text,
            erdColumnLabel
              ? "as-authored"
              : displayLabelCase(edge?.labelAuthored ?? true, presentation.labelCase),
          )
        : "";
    const iconStyle =
      hasIcon && edge?.iconColor ? ` style="--icon-color: ${escapeXml(edge.iconColor)}"` : "";
    body += `<g class="${labelClass}" data-edge-id="${escapeXml(label.edgeId)}"${iconStyle}>`;
    // Short leader when the pill sits off the stroke — keeps the label visually tied.
    const attach = closestPointOnRect(label.anchor, label.bounds);
    const leaderGap = Math.hypot(attach.x - label.anchor.x, attach.y - label.anchor.y);
    if (leaderGap > 3.5) {
      body += `<line class="flow-edge-label-leader" x1="${label.anchor.x}" y1="${label.anchor.y}" x2="${attach.x}" y2="${attach.y}"/>`;
    }
    body += `<rect class="flow-edge-label-bg" x="${label.bounds.x}" y="${label.bounds.y}" width="${label.bounds.width}" height="${label.bounds.height}" rx="${rx}"/>`;
    if (hasIcon && edge?.icon) {
      const iconCx =
        labelText.length > 0
          ? label.bounds.x + EDGE_LABEL_PAD_X + EDGE_LABEL_ICON / 2
          : label.bounds.x + label.bounds.width / 2;
      body += renderEdgeLabelIcon(
        edge.icon,
        iconCx,
        textCy,
        edge.iconPaint,
        Boolean(edge.iconColor),
      );
    }
    if (labelText.length > 0) {
      const textX = hasIcon
        ? label.bounds.x +
          EDGE_LABEL_PAD_X +
          EDGE_LABEL_ICON +
          EDGE_LABEL_ICON_GAP +
          (label.bounds.width - EDGE_LABEL_PAD_X * 2 - EDGE_LABEL_ICON - EDGE_LABEL_ICON_GAP) / 2
        : label.bounds.x + label.bounds.width / 2;
      body += `<text class="flow-edge-label-text" x="${textX}" y="${textCy}" dominant-baseline="middle" text-anchor="middle">${escapeXml(labelText)}</text>`;
    }
    body += `</g>`;
  }

  if (presentation.showEndpoints || options.debug?.showPorts) {
    const debugPorts = options.debug?.showPorts === true;
    for (const path of layout.edgePaths) {
      const edge = graph.edges.find((e) => e.id === path.edgeId);
      const edgeStyles = edge ? resolveEdgeStyles(edge, graph.styles) : null;
      const branch = branchSemantics(edge?.label, edge?.branch);
      const styledStroke = edgeStyles?.cssVars["--edge-stroke"];
      let strokeColor =
        styledStroke ??
        (edge?.kind === "failure"
          ? "var(--kd-danger)"
          : edge?.kind === "async" || edge?.kind === "eventual"
            ? "var(--kd-async-stroke)"
            : "var(--kd-edge)");
      strokeColor = branchStrokeColor(branch, strokeColor);
      const start = path.points[0];
      const end = path.points[path.points.length - 1];
      if (start) {
        const cls = debugPorts ? "flow-debug-port flow-debug-port-source" : "flow-edge-endpoint";
        const fill = debugPorts ? undefined : ` fill="${strokeColor}"`;
        body += `<circle class="${cls}" cx="${start.x}" cy="${start.y}" r="3.25" data-edge-id="${escapeXml(path.edgeId)}"${fill ?? ""}/>`;
      }
      if (end) {
        const cls = debugPorts ? "flow-debug-port flow-debug-port-target" : "flow-edge-endpoint";
        const fill = debugPorts ? undefined : ` fill="${strokeColor}"`;
        body += `<circle class="${cls}" cx="${end.x}" cy="${end.y}" r="3.25" data-edge-id="${escapeXml(path.edgeId)}"${fill ?? ""}/>`;
      }
    }
  }

  if (options.debug?.showBounds) {
    for (const ln of layout.nodes) {
      body += `<rect x="${ln.bounds.x}" y="${ln.bounds.y}" width="${ln.bounds.width}" height="${ln.bounds.height}" fill="none" stroke="var(--kd-accent)" stroke-width="1" stroke-dasharray="4 3" class="flow-debug-bounds" data-node-id="${escapeXml(ln.nodeId)}"/>`;
    }
    for (const group of layout.groups) {
      body += `<rect x="${group.bounds.x}" y="${group.bounds.y}" width="${group.bounds.width}" height="${group.bounds.height}" fill="none" stroke="var(--kd-danger)" stroke-width="1" stroke-dasharray="6 4" class="flow-debug-group-bounds" data-group-id="${escapeXml(group.groupId)}"/>`;
    }
  }

  body += `</g>`;

  const chromeAttr = hasPresentationChrome(presentation) ? ` data-chrome="opt-in"` : "";
  const themeClass = ` class="k-diagram kdiagram-theme-${escapeXml(theme)}"`;
  const themeAttr = ` data-theme="${escapeXml(theme)}"`;
  const styleBlock = snapshot ? "" : `<style>${themeToCss(theme)}</style>`;

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg${themeClass}${themeAttr}${chromeAttr} xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" role="img" aria-label="${title}" aria-describedby="flow-desc">
${styleBlock}
<desc id="flow-desc">${desc}</desc>
${body}
</svg>`;
}

function renderTreatedEdgePaths(
  segments: RenderedEdgeSegment[],
  routingOptions: SvgRenderInput["routingOptions"],
  strokeW: number,
  strokeColor: string,
  dash: string,
  flowArrows?: { start?: boolean; end?: boolean },
  cardinalityMarkers?: { markerStart: string; markerEnd: string },
): string {
  let body = "";
  let lineRun: Array<{ seg: RenderedEdgeSegment; idx: number }> = [];

  // Prefer markers on the first/last *substantial* line run so gap stubs near
  // nodes don't get orphaned crow's-feet floating off the table face.
  const substantial = (seg: RenderedEdgeSegment): boolean => {
    if (seg.type !== "line") return false;
    return Math.hypot(seg.to.x - seg.from.x, seg.to.y - seg.from.y) >= 12;
  };
  let startMarkerIdx = -1;
  let endMarkerIdx = -1;
  for (let i = 0; i < segments.length; i++) {
    if (segments[i]!.type === "line" && startMarkerIdx < 0) startMarkerIdx = i;
    if (substantial(segments[i]!)) {
      startMarkerIdx = i;
      break;
    }
  }
  for (let i = segments.length - 1; i >= 0; i--) {
    if (segments[i]!.type === "line" && endMarkerIdx < 0) endMarkerIdx = i;
    if (substantial(segments[i]!)) {
      endMarkerIdx = i;
      break;
    }
  }

  const flushRun = () => {
    if (!lineRun.length) return;
    const containsTerminalLine = lineRun.some((entry) => entry.idx === endMarkerIdx);
    const containsStartLine = lineRun.some((entry) => entry.idx === startMarkerIdx);
    let markerAttr = "";
    if (cardinalityMarkers) {
      if (containsStartLine)
        markerAttr += ` marker-start="url(#${cardinalityMarkers.markerStart})"`;
      if (containsTerminalLine) markerAttr += ` marker-end="url(#${cardinalityMarkers.markerEnd})"`;
    } else if (flowArrows) {
      if (flowArrows.start && containsStartLine)
        markerAttr += ` marker-start="url(#flow-arrow-start)"`;
      if (flowArrows.end && containsTerminalLine) markerAttr += ` marker-end="url(#flow-arrow)"`;
    }
    const pathD = edgeStrokePath(
      lineRun.map((entry) => entry.seg),
      {
        route: routingOptions?.route ?? "metro",
        cornerRadius: routingOptions?.cornerRadius,
      },
    );
    if (pathD) {
      body += `<path class="flow-edge-path" d="${pathD}" fill="none" stroke="${strokeColor}" stroke-width="${strokeW}" stroke-linecap="round" stroke-linejoin="round"${dash}${markerAttr}/>`;
    }
    lineRun = [];
  };

  segments.forEach((seg, idx) => {
    if (seg.type === "line") {
      lineRun.push({ seg, idx });
      return;
    }
    flushRun();
    if (seg.type === "jump") {
      const mx = (seg.from.x + seg.to.x) / 2;
      const my = (seg.from.y + seg.to.y) / 2;
      body += `<path d="M ${seg.from.x} ${seg.from.y} Q ${mx} ${my - seg.radius} ${seg.to.x} ${seg.to.y}" fill="none" stroke="${strokeColor}" stroke-width="${strokeW}" stroke-linecap="round" class="flow-edge-jump"${dash}/>`;
    }
  });
  flushRun();
  return body;
}

function isCardNode(node: GraphNode): boolean {
  const shape = normalizeShapeId(node.shape ?? "rounded");
  return CARD_SHAPES.has(shape);
}

function renderNodeBackground(
  node: GraphNode,
  bounds: { x: number; y: number; width: number; height: number },
  strokeDash?: string,
  useShadow = false,
  roundedCorners = false,
): string {
  const shapeKind = normalizeShapeId(node.shape ?? "rounded");
  const fill = "var(--node-fill, var(--kd-node-fill))";
  // External dashes stay crisp (butt); avoid glow spam — shadows only when opted in.
  const dashAttr =
    strokeDash && strokeDash !== "none" ? ` stroke-dasharray="${escapeXml(strokeDash)}"` : "";
  const filterAttr = useShadow ? ' filter="url(#flow-node-shadow)"' : "";
  const paint: ShellPaint = {
    fill,
    stroke: "var(--node-stroke, var(--kd-node-stroke))",
    dashAttr,
    filterAttr,
  };
  if (node.kind === "initial" || node.kind === "junction") {
    const cx = bounds.x + bounds.width / 2;
    const cy = bounds.y + bounds.height / 2;
    const radius = Math.max(5, Math.min(bounds.width, bounds.height) / 2 - 2);
    return `<circle class="flow-state-${node.kind}" cx="${cx}" cy="${cy}" r="${radius}" fill="${paint.stroke}" stroke="${paint.stroke}" stroke-width="2"${filterAttr}/>`;
  }
  if (node.kind === "final") {
    const cx = bounds.x + bounds.width / 2;
    const cy = bounds.y + bounds.height / 2;
    const outer = Math.max(7, Math.min(bounds.width, bounds.height) / 2 - 2);
    const inner = Math.max(4, outer - 5);
    return `<g class="flow-state-final">${renderNodeShell("circle", bounds, paint, roundedCorners)}<circle cx="${cx}" cy="${cy}" r="${inner}" fill="${paint.stroke}" stroke="none"/></g>`;
  }
  return renderNodeShell(shapeKind, bounds, paint, roundedCorners);
}

function renderNodeForeground(
  node: GraphNode,
  bounds: { x: number; y: number; width: number; height: number },
  lines: string[],
  contentBox: Rect,
  badge?: string,
  showDebugKind = false,
  note?: string,
  showKindSubtitles = false,
  hasIconColor = false,
  technologyLines?: string[],
  descriptionLines?: string[],
): string {
  const { x, y, width, height } = bounds;
  const cx = x + width / 2;
  const shapeKind = normalizeShapeId(node.shape ?? "rounded");
  const geometry = resolveShapeGeometry(shapeKind);
  const externalLabel = geometry.contentPolicy?.preferExternalLabel === true;
  const icon = resolveNodeIcon(node);
  // Person head is the silhouette; authored icons still render inside the torso.
  const showIcon = Boolean(icon);
  const card = isCardNode(node);
  const iconOnly = isIconOnlyNode(node);
  const scale = node.scale && node.scale > 0 ? node.scale : 1;
  const titleSize = 15 * scale;
  const titleLineH = TITLE_LINE_HEIGHT * scale;
  const subtitleSize = 10.5 * scale;
  const techSize = 11 * scale;
  const descSize = 11 * scale;
  const authoredSubtitle = node.subtitle?.trim() ? node.subtitle.trim() : undefined;
  const showSubtitle =
    !iconOnly && (Boolean(authoredSubtitle) || showKindSubtitles || node.showSubtitle === true);
  const showTitle = !(iconOnly && !node.labelAuthored);
  const titleLines = showTitle ? lines : [];
  const techLines = !iconOnly && technologyLines?.length ? technologyLines : [];
  const descLines = !iconOnly && descriptionLines?.length ? descriptionLines : [];
  const richCopy = techLines.length > 0 || descLines.length > 0;
  const sectionGap = SECTION_GAP * scale;

  let text = "";
  const subtitle = authoredSubtitle ?? kindSubtitle(node.kind);

  // Vertical optical center — cylinders sit under the lid; person centers in the torso.
  // Rich C4 copy top-aligns so description isn't flush to the bottom rim.
  let opticalCy = y + height / 2;
  if (shapeKind === "cylinder") {
    const { ry } = cylinderRadii(width, height);
    opticalCy = y + ry + (height - ry) / 2;
  } else if (shapeKind === "diamond") {
    opticalCy = y + height * 0.5;
  } else if (shapeKind === "person") {
    opticalCy = y + contentBox.y + contentBox.height / 2;
  }

  if (iconOnly && showIcon && icon) {
    const glyph = ICON_ONLY_GLYPH * scale;
    const captionH = titleLines.length > 0 ? titleLines.length * titleLineH : 0;
    const iconCy = titleLines.length > 0 ? y + (height - captionH) / 2 : opticalCy;
    text += renderNodeIcon(icon, cx, iconCy, glyph / 20, node.iconPaint, hasIconColor);
  } else if (showIcon && icon && card) {
    const iconCol = cardIconColumnWidth(icon, scale);
    const iconCx = x + CARD_PAD + iconCol / 2;
    const iconCy = opticalCy;
    text += renderNodeIcon(icon, iconCx, iconCy, scale, node.iconPaint, hasIconColor);
  } else if (showIcon && icon && shapeKind === "diamond" && lines.length > 1) {
    text += renderNodeIcon(icon, cx, y + height * 0.32, 0.7 * scale, node.iconPaint, hasIconColor);
  }

  const showDiamondSubtitle = shapeKind === "diamond" && showSubtitle;
  const effectiveSubtitle = shapeKind === "diamond" ? showDiamondSubtitle : showSubtitle;

  const textBlockH =
    titleLines.length * titleLineH +
    (effectiveSubtitle ? SUBTITLE_HEIGHT * scale : 0) +
    (effectiveSubtitle && richCopy ? sectionGap : 0) +
    techLines.length * TECHNOLOGY_LINE_HEIGHT * scale +
    (techLines.length && descLines.length ? sectionGap : 0) +
    descLines.length * DESCRIPTION_LINE_HEIGHT * scale +
    (showDebugKind ? 12 : 0);
  // Cards with an icon keep a left text column; icon-only captions stay centered.
  const iconCol = showIcon && icon && card && !iconOnly ? cardIconColumnWidth(icon, scale) : 0;
  let textX = card && showIcon && !iconOnly ? x + CARD_PAD + iconCol + ICON_TEXT_GAP : cx;
  let anchor: "start" | "middle" = card && showIcon && !iconOnly ? "start" : "middle";
  let startY = iconOnly
    ? y + height - 10 * scale - (titleLines.length - 1) * titleLineH
    : opticalCy - textBlockH / 2 + titleLineH - 4 * scale;

  // Non-card shapes (hexagon, cylinder, cloud, person, …): center icon+label in content region.
  const stackNonCard =
    showIcon && icon && !card && !iconOnly && shapeKind !== "diamond" && !externalLabel;
  if (stackNonCard && icon) {
    const iconScale = shapeKind === "person" ? 0.9 * scale : 1.05 * scale;
    const iconH = 20 * iconScale;
    const stackGap = 6 * scale;
    const stackH = iconH + stackGap + textBlockH;
    // Honor asymmetric content insets (e.g. stream left rail).
    const contentCx = x + contentBox.x + contentBox.width / 2;
    textX = contentCx;

    let regionTop = y + contentBox.y;
    let regionH = contentBox.height;
    if (shapeKind === "cylinder") {
      const { ry } = cylinderRadii(width, height);
      // Keep the stack in the drum body, clear of the lid ellipse.
      regionTop = y + ry * 2 + 4 * scale;
      regionH = Math.max(iconH + textBlockH, y + height - 8 * scale - regionTop);
    }

    const stackTop = regionTop + Math.max(0, (regionH - stackH) / 2);
    text += renderNodeIcon(
      icon,
      contentCx,
      stackTop + iconH / 2,
      iconScale,
      node.iconPaint,
      hasIconColor,
    );
    startY = stackTop + iconH + stackGap + titleLineH - 4 * scale;
  }

  // Circle-style nodes with external captions under the glyph.
  if (externalLabel && !iconOnly) {
    textX = x + contentBox.x + contentBox.width / 2;
    anchor = "middle";
    const bandCy = y + contentBox.y + contentBox.height / 2;
    startY = bandCy - textBlockH / 2 + titleLineH * 0.7;
  }

  // Person torso: center title/subtitle in the body when no nested icon stack.
  if (shapeKind === "person" && !stackNonCard && !iconOnly) {
    textX = x + contentBox.x + contentBox.width / 2;
    anchor = "middle";
    if (richCopy) {
      startY = y + contentBox.y + RICH_CONTENT_PAD * scale + titleLineH - 4 * scale;
    } else {
      const bandCy = y + contentBox.y + contentBox.height / 2;
      startY = bandCy - textBlockH / 2 + titleLineH * 0.7;
    }
  } else if (richCopy && !iconOnly && !stackNonCard && !externalLabel) {
    // C4 cards: top-align so multi-line copy keeps even padding to the rim.
    textX = card && showIcon ? textX : x + contentBox.x + contentBox.width / 2;
    if (!(card && showIcon)) anchor = "middle";
    startY = y + contentBox.y + RICH_CONTENT_PAD * scale + titleLineH - 4 * scale;
  }

  titleLines.forEach((line, i) => {
    const size = iconOnly ? 11 * scale : externalLabel ? 13 * scale : titleSize;
    text += `<text class="flow-node-title" x="${textX}" y="${startY + i * titleLineH}" text-anchor="${anchor}" font-size="${size}">${escapeXml(line)}</text>`;
  });

  let cursorY = startY + titleLines.length * titleLineH;

  if (effectiveSubtitle) {
    cursorY += 2 * scale;
    text += `<text class="flow-node-subtitle" x="${textX}" y="${cursorY}" text-anchor="${anchor}" font-size="${subtitleSize}">${escapeXml(subtitle)}</text>`;
    cursorY += SUBTITLE_HEIGHT * scale - 2 * scale;
    if (richCopy) cursorY += sectionGap;
  }

  for (const line of techLines) {
    cursorY += TECHNOLOGY_LINE_HEIGHT * scale;
    text += `<text class="flow-node-technology" x="${textX}" y="${cursorY}" text-anchor="${anchor}" font-size="${techSize}">${escapeXml(line)}</text>`;
  }

  if (techLines.length && descLines.length) cursorY += sectionGap;

  for (const line of descLines) {
    cursorY += DESCRIPTION_LINE_HEIGHT * scale;
    text += `<text class="flow-node-description" x="${textX}" y="${cursorY}" text-anchor="${anchor}" font-size="${descSize}">${escapeXml(line)}</text>`;
  }

  if (showDebugKind) {
    cursorY += 12;
    text += `<text x="${textX}" y="${cursorY}" text-anchor="${anchor}" fill="var(--kd-danger)" font-size="${8 * scale}" font-weight="600" letter-spacing="0.06em">${escapeXml(node.kind.toUpperCase())}</text>`;
  }

  if (badge) {
    // Follow the node's semantic stroke (success→green, danger→red), not a fixed danger color.
    text += `<text class="flow-node-badge" x="${x + width - 8}" y="${y + 14}" text-anchor="end" fill="var(--node-stroke, var(--kd-text))" font-size="10" font-weight="700">${escapeXml(badge)}</text>`;
  }

  if (note) {
    const noteY = y + height - 10 * scale;
    text += `<text class="flow-node-note-text" x="${cx}" y="${noteY}" text-anchor="middle" fill="var(--kd-muted)" font-size="${9 * scale}" font-style="italic">${escapeXml(note)}</text>`;
  }

  return text;
}

function isIconOnlyNode(node: GraphNode): boolean {
  return kindHasCapability(node.kind, "icon-only");
}

function resolveNodeIcon(node: GraphNode): string | null {
  if (!node.icon || node.icon === "none") return null;
  return node.icon;
}

function renderGroupIcon(
  icon: string,
  cx: number,
  cy: number,
  paintOverride?: IconPaintMode,
  hasIconColor = false,
): string {
  const paint = resolveIconPaint(icon, paintOverride, { hasIconColor });
  return renderIconById(icon, cx, cy, {
    height: GROUP_ICON_SIZE,
    paint,
    color: paint === "theme" ? "var(--icon-color, var(--kd-muted))" : undefined,
    className: "flow-group-label-icon",
  });
}

function renderEdgeLabelIcon(
  icon: string,
  cx: number,
  cy: number,
  paintOverride?: IconPaintMode,
  hasIconColor = false,
): string {
  const paint = resolveIconPaint(icon, paintOverride, { hasIconColor });
  return renderIconById(icon, cx, cy, {
    height: EDGE_LABEL_ICON,
    paint,
    color: paint === "theme" ? "var(--icon-color, var(--kd-edge-label-text))" : undefined,
    className: "flow-edge-label-icon",
  });
}

function renderNodeIcon(
  icon: string,
  cx: number,
  cy: number,
  scale = 1,
  paintOverride?: IconPaintMode,
  hasIconColor = false,
): string {
  const height = 20 * scale;
  const paint = resolveIconPaint(icon, paintOverride, { hasIconColor });
  return renderIconById(icon, cx, cy, {
    height,
    paint,
    // Prefer CSS var so style-block `--icon-color` also wins via inheritance.
    color:
      paint === "theme"
        ? "var(--icon-color, var(--node-stroke, var(--kd-node-stroke)))"
        : undefined,
    className: "flow-node-icon-mark",
  });
}
