import type { Rect } from "@kekonic/diagrams-core";
import type { GraphModel } from "@kekonic/diagrams-core";
import { getKindDefaults, kindHasCapability, kindSubtitle } from "@kekonic/diagrams-core";
import {
  geometrySizeForContent,
  normalizeShapeId,
  relativeContentBox,
  resolveShapeGeometry,
} from "@kekonic/diagrams-geometry";
import { iconDisplaySize, resolveIcon } from "@kekonic/diagrams-icons";
import {
  DEFAULT_FONT_FAMILY,
  DEFAULT_FONT_SIZE,
  type TextMeasurer,
  defaultMeasurer,
} from "./text-measurer.ts";
import { measureTableNode } from "./table-measure.ts";

export type MeasuredNode = {
  nodeId: string;
  width: number;
  height: number;
  contentBox: Rect;
  labelLines: string[];
  /** C4 technology tag lines (usually one). */
  technologyLines?: string[];
  /** Wrapped C4 / architecture description body. */
  descriptionLines?: string[];
};

export type MeasureOptions = {
  /** Reserve vertical space for kind subtitles when presentation opts into them. */
  reserveKindSubtitles?: boolean;
};

export type MeasureResult = {
  nodes: MeasuredNode[];
  measureMs: number;
};

const PADDING_X = 22;
const PADDING_Y = 20;
const RICH_PADDING_Y = 26;
const ICON_BLOCK = 28;
const SUBTITLE_HEIGHT = 15;
const TECHNOLOGY_HEIGHT = 14;
const DESCRIPTION_LINE_HEIGHT = 14;
const SECTION_GAP = 4;
const NOTE_HEIGHT = 14;
const MIN_ICON_COL = 32;
const CARD_ICON_HEIGHT = 20;
/** Matches SVG `CARD_PAD + ICON_TEXT_GAP` (18 + 12). */
const CARD_ICON_PAD = 30;
const ICON_ONLY_SIZE = 64;
const ICON_ONLY_CAPTION = 16;
const SHAPE_EXTRA: Record<string, { w: number; h: number }> = {
  diamond: { w: 36, h: 36 },
  cylinder: { w: 10, h: 22 },
  hexagon: { w: 18, h: 10 },
  person: { w: 24, h: 0 },
  queue: { w: 18, h: 18 },
  parallelogram: { w: 24, h: 8 },
  trapezoid: { w: 20, h: 8 },
  triangle: { w: 16, h: 20 },
  document: { w: 8, h: 16 },
  "folded-document": { w: 8, h: 12 },
  cloud: { w: 28, h: 24 },
  circle: { w: 12, h: 12 },
  ellipse: { w: 16, h: 16 },
  boundary: { w: 8, h: 8 },
};

/** Left icon column width for card nodes (matches SVG placement). */
export function cardIconColumnWidth(iconId: string, scale = 1): number {
  const height = CARD_ICON_HEIGHT * scale;
  const resolved = resolveIcon(iconId);
  const { width } = iconDisplaySize(resolved ?? { width: 1, height: 1 }, height);
  return Math.max(MIN_ICON_COL * scale, width);
}

export function measureGraph(
  graph: GraphModel,
  measurer: TextMeasurer = defaultMeasurer,
  options: MeasureOptions = {},
): MeasureResult {
  const start = performance.now();
  const nodes: MeasuredNode[] = [];

  for (const node of graph.nodes) {
    const shape = normalizeShapeId(node.shape ?? "rounded");
    const geometry = resolveShapeGeometry(shape);
    const cardShape = shape === "rounded" || shape === "rectangle" || shape === "pill";
    const hasIcon = Boolean(node.icon && node.icon !== "none");
    const { defaults: kindDefaults } = getKindDefaults(node.kind);
    const iconOnly =
      kindHasCapability(node.kind, "icon-only") || kindDefaults.capabilities.includes("icon-only");
    const scale = node.scale && node.scale > 0 ? node.scale : 1;
    const fontSize = DEFAULT_FONT_SIZE * scale;
    const padX = PADDING_X * scale;
    const hasRichCopy = Boolean(
      (node.technology && node.technology.trim()) || (node.description && node.description.trim()),
    );
    const padY = (hasRichCopy ? RICH_PADDING_Y : PADDING_Y) * scale;
    const minBoxH = 56 * scale;
    const effectiveMinW =
      (node.minWidth ?? kindDefaults.defaultMinWidth) * (node.minWidth ? 1 : scale);
    const effectiveMaxW =
      (node.maxWidth ?? kindDefaults.defaultMaxWidth) * (node.maxWidth ? 1 : scale);

    if (iconOnly) {
      const caption = node.labelAuthored
        ? measurer.wrapText(node.label, {
            maxWidth: effectiveMaxW - padX,
            style: {
              fontSize: fontSize * 0.72,
              fontFamily: DEFAULT_FONT_FAMILY,
              fontWeight: "700",
            },
          })
        : { lines: [] as string[], width: 0, height: 0 };
      const side = Math.max(
        effectiveMinW,
        Math.min(
          effectiveMaxW,
          ICON_ONLY_SIZE * scale + (caption.height > 0 ? ICON_ONLY_CAPTION * scale : 0),
        ),
      );
      const height = Math.max(side, ICON_ONLY_SIZE * scale + caption.height);
      nodes.push({
        nodeId: node.id,
        width: side,
        height,
        contentBox: relativeContentBox(geometry, side, height),
        labelLines: caption.lines,
      });
      continue;
    }

    if (shape === "table" && node.columns && node.columns.length > 0) {
      const table = measureTableNode(node, measurer, scale, effectiveMinW, effectiveMaxW);
      nodes.push({
        nodeId: node.id,
        width: table.width,
        height: table.height,
        contentBox: relativeContentBox(geometry, table.width, table.height),
        labelLines: table.labelLines,
      });
      continue;
    }

    if (shape === "diamond") {
      const innerMaxW = (effectiveMaxW - padX * 2) * 0.58;
      const wrapped = measurer.wrapText(node.label, {
        maxWidth: innerMaxW,
        style: { fontSize, fontFamily: DEFAULT_FONT_FAMILY, fontWeight: "800" },
      });
      const longestLine = Math.max(
        ...wrapped.lines.map(
          (line) =>
            measurer.measureText(line, {
              fontSize,
              fontFamily: DEFAULT_FONT_FAMILY,
              fontWeight: "800",
            }).width,
        ),
        wrapped.width,
      );
      const contentNeed = {
        width: longestLine + padX * 2,
        height: wrapped.height + padY * 2,
      };
      const sized = geometrySizeForContent(geometry, contentNeed, {
        width: Math.max(effectiveMinW, contentNeed.width * 1.7),
        height: Math.max(80 * scale, contentNeed.height * 1.9),
      });
      // maxWidth is a wrap preference — never clip below the measured content.
      const width = Math.max(effectiveMinW, sized.width);
      const height = Math.max(80 * scale, sized.height);
      nodes.push({
        nodeId: node.id,
        width,
        height,
        contentBox: relativeContentBox(geometry, width, height),
        labelLines: wrapped.lines,
      });
      continue;
    }

    const iconCol = cardShape && hasIcon && node.icon ? cardIconColumnWidth(node.icon, scale) : 0;
    const wrapped = measurer.wrapText(node.label, {
      maxWidth: effectiveMaxW - padX * 2 - iconCol,
      style: { fontSize, fontFamily: DEFAULT_FONT_FAMILY, fontWeight: "800" },
    });
    const extra = SHAPE_EXTRA[shape] ?? { w: 0, h: 0 };
    const iconW = cardShape && hasIcon ? iconCol + CARD_ICON_PAD * scale : hasIcon ? 8 * scale : 0;
    const iconH = hasIcon && !cardShape ? ICON_BLOCK * scale : 0;
    const authoredSubtitle = node.subtitle?.trim() ? node.subtitle.trim() : undefined;
    const wantsSubtitle =
      Boolean(authoredSubtitle) || node.showSubtitle === true || options.reserveKindSubtitles;
    // Reserve eyebrow space whenever the node asks for a subtitle (any shape).
    const subtitleH = wantsSubtitle ? SUBTITLE_HEIGHT * scale : 0;
    let subtitleW = 0;
    if (wantsSubtitle) {
      const subtitleSize = fontSize * (10.5 / DEFAULT_FONT_SIZE);
      const subtitleText = (authoredSubtitle ?? kindSubtitle(node.kind)).toUpperCase();
      const measured = measurer.measureText(subtitleText, {
        fontSize: subtitleSize,
        fontFamily: DEFAULT_FONT_FAMILY,
        fontWeight: "600",
      }).width;
      const tracking = Math.max(0, subtitleText.length - 1) * subtitleSize * 0.05;
      subtitleW = measured + tracking;
    }
    const noteH = node.note ? NOTE_HEIGHT * scale : 0;
    let noteW = 0;
    if (node.note) {
      noteW = measurer.measureText(node.note, {
        fontSize: fontSize * (9 / DEFAULT_FONT_SIZE),
        fontFamily: DEFAULT_FONT_FAMILY,
        fontWeight: "400",
      }).width;
    }
    const technology = node.technology?.trim() ? node.technology.trim() : undefined;
    const description = node.description?.trim() ? node.description.trim() : undefined;
    const textMaxW = effectiveMaxW - padX * 2 - iconCol;
    const sectionGap = SECTION_GAP * scale;

    let technologyLines: string[] | undefined;
    let technologyW = 0;
    let technologyH = 0;
    if (technology) {
      const techSize = fontSize * (11 / DEFAULT_FONT_SIZE);
      const techWrap = measurer.wrapText(technology, {
        maxWidth: textMaxW,
        style: { fontSize: techSize, fontFamily: DEFAULT_FONT_FAMILY, fontWeight: "500" },
      });
      technologyLines = techWrap.lines;
      technologyW = techWrap.width;
      technologyH = technologyLines.length * TECHNOLOGY_HEIGHT * scale;
    }

    let descriptionLines: string[] | undefined;
    let descriptionW = 0;
    let descriptionH = 0;
    if (description) {
      const descSize = fontSize * (11 / DEFAULT_FONT_SIZE);
      const descWrap = measurer.wrapText(description, {
        maxWidth: textMaxW,
        style: { fontSize: descSize, fontFamily: DEFAULT_FONT_FAMILY, fontWeight: "500" },
      });
      descriptionLines = descWrap.lines;
      descriptionW = descWrap.width;
      descriptionH = descriptionLines.length * DESCRIPTION_LINE_HEIGHT * scale;
    }

    const afterSubtitleGap = technologyLines || descriptionLines ? sectionGap : 0;
    const afterTechGap = technologyLines && descriptionLines ? sectionGap : 0;

    // Person: head is the glyph — don't reserve stack space for a nested icon unless authored.
    const personIconH =
      shape === "person" && hasIcon ? ICON_BLOCK * scale : shape === "person" ? 0 : iconH;
    const textStackH =
      wrapped.height +
      subtitleH +
      afterSubtitleGap +
      technologyH +
      afterTechGap +
      descriptionH +
      noteH;
    const contentW =
      Math.max(wrapped.width, subtitleW, technologyW, descriptionW, noteW) +
      padX * 2 +
      extra.w * scale +
      iconW;
    const contentH = textStackH + padY * 2 + extra.h * scale + personIconH;
    // maxWidth only guides wrapping — unbreakable words / notes may grow the box.
    let width = Math.max(effectiveMinW, contentW);
    // If minWidth stretches past content, grow height too so the node doesn't look flat-stretched.
    const stretch = contentW > 0 && width > contentW ? Math.min(width / contentW, 1.45) : 1;
    let height = Math.max(minBoxH, contentH * stretch);
    // Hex / queue need enough height so side points read as intentional, not pancakes.
    if (shape === "hexagon" || shape === "queue") {
      height = Math.max(height, width * 0.44);
    }
    // Cylinders keep a short-drum proportion so the lid isn't lost on wide labels.
    if (shape === "cylinder") {
      height = Math.max(height, Math.min(width * 0.55, 96 * scale));
    }
    // Capsule / rounded cards: grow AABB so getContentBounds still fits the text stack.
    if (cardShape) {
      const inner = {
        width: Math.max(wrapped.width, subtitleW, technologyW, descriptionW, noteW) + iconW,
        height: textStackH,
      };
      const sized = geometrySizeForContent(geometry, inner, { width, height });
      width = Math.max(width, sized.width);
      height = Math.max(height, sized.height);
    }
    // Material cloud is 24×16 (~3:2). Short labels + centered icons otherwise
    // yield near-square boxes that squash the lobes when the path fills the AABB.
    if (shape === "cloud") {
      const cloudAspect = 1.5;
      width = Math.max(width, height * cloudAspect);
    }
    // Person: torso = content box (widens with label); head stacks above.
    if (shape === "person") {
      const bodyW = Math.max(effectiveMinW, contentW);
      const bodyH = Math.max(56 * scale, textStackH + padY * 2 + personIconH);
      // Head + neck above the torso (mirrors personHeadStackHeight in geometry).
      const bodyHalfW = Math.max(18, bodyW / 2 - 2);
      const headR = Math.max(10, Math.min(22, bodyHalfW * 0.38));
      const headStack = headR * 2 + Math.max(2, headR * 0.18) + 6;
      width = bodyW;
      height = headStack + bodyH;
    }
    if (shape === "circle") {
      const side = Math.max(width, height);
      width = side;
      height = side;
    }

    nodes.push({
      nodeId: node.id,
      width,
      height,
      contentBox: relativeContentBox(geometry, width, height),
      labelLines: wrapped.lines,
      technologyLines,
      descriptionLines,
    });
  }

  return { nodes, measureMs: performance.now() - start };
}
