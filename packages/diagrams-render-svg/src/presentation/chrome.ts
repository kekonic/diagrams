import type { ResolvedPresentation } from "@kekonic/diagrams-core";
import { escapeXml } from "../render-svg/utils.ts";

export type CanvasLayout = {
  width: number;
  height: number;
  contentOffsetX: number;
  contentOffsetY: number;
  titleAreaHeight: number;
};

export function computeCanvasLayout(
  contentWidth: number,
  contentHeight: number,
  presentation: ResolvedPresentation,
): CanvasLayout {
  const titleAreaHeight = presentation.title
    ? 36 + (presentation.title.subtitle ? 20 : 0) + presentation.contentPadding.top
    : presentation.contentPadding.top;

  const contentOffsetX = presentation.padding.left + presentation.contentPadding.left;
  const contentOffsetY =
    presentation.padding.top + titleAreaHeight + presentation.contentPadding.top;

  const width =
    presentation.padding.left +
    presentation.contentPadding.left +
    contentWidth +
    presentation.contentPadding.right +
    presentation.padding.right;

  const height =
    presentation.padding.top +
    titleAreaHeight +
    presentation.contentPadding.top +
    contentHeight +
    presentation.contentPadding.bottom +
    presentation.padding.bottom;

  return { width, height, contentOffsetX, contentOffsetY, titleAreaHeight };
}

/** True when opt-in title chrome is active. */
export function hasPresentationChrome(presentation: ResolvedPresentation): boolean {
  return presentation.title !== false;
}

export function renderTitleBlock(
  presentation: ResolvedPresentation,
  paddingLeft: number,
  paddingTop: number,
): string {
  if (!presentation.title) return "";

  const { text, subtitle, align } = presentation.title;
  const x = align === "center" ? "50%" : String(paddingLeft);
  const anchor = align === "center" ? "middle" : "start";
  const titleY = paddingTop + 28;

  let out = `<g class="flow-canvas-title" role="group">`;
  out += `<text class="flow-canvas-title-text" x="${x}" y="${titleY}" text-anchor="${anchor}">${escapeXml(text)}</text>`;
  if (subtitle) {
    out += `<text class="flow-canvas-subtitle-text" x="${x}" y="${titleY + 22}" text-anchor="${anchor}">${escapeXml(subtitle)}</text>`;
  }
  out += `</g>`;
  return out;
}
