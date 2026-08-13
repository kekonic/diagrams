import type { InteractiveRenderOptions } from "@kekonic/diagrams";
import {
  DEFAULT_STUDIO_PRESENTATION,
  buildStudioRenderOptions,
  type StudioPresentationControls,
} from "@kekonic/diagrams-studio";
import { LIVE_THEME_NAME } from "./deriveTheme.ts";

export type StudioOptions = StudioPresentationControls;

export const DEFAULT_OPTIONS: StudioOptions = DEFAULT_STUDIO_PRESENTATION;

export function buildRenderOptions(options: StudioOptions): InteractiveRenderOptions {
  return buildStudioRenderOptions(options, LIVE_THEME_NAME);
}

/** Portable exports resolve the active Studio palette into the SVG itself. */
export function buildExportOptions(options: StudioOptions): InteractiveRenderOptions {
  return { ...buildRenderOptions(options), snapshotTheme: true };
}
