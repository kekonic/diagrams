import type { ZoomOnWheelMode } from "@kekonic/diagrams-core";

export const DEFAULT_ZOOM_ON_WHEEL: ZoomOnWheelMode = "modifier";
export const ZOOM_HINT_VISIBLE_MS = 1_600;

export type WheelZoomModifiers = {
  ctrlKey: boolean;
  metaKey: boolean;
};

export function resolveZoomOnWheel(mode: ZoomOnWheelMode | undefined): ZoomOnWheelMode {
  return mode === "always" ? "always" : DEFAULT_ZOOM_ON_WHEEL;
}

/**
 * True when the live host should consume the wheel event as zoom.
 * Unmodified wheel is left to the page unless the host opted into `"always"`.
 * Ctrl/Cmd + wheel and Chrome/Safari trackpad pinch (`ctrlKey`) still zoom.
 */
export function shouldCaptureWheelZoom(
  event: WheelZoomModifiers,
  mode: ZoomOnWheelMode | undefined,
): boolean {
  if (resolveZoomOnWheel(mode) === "always") return true;
  return event.ctrlKey || event.metaKey;
}

export function wheelZoomHintText(platform = defaultPlatform()): string {
  return isApplePlatform(platform) ? "Use ⌘ + scroll to zoom" : "Use Ctrl + scroll to zoom";
}

function defaultPlatform(): string {
  if (typeof navigator === "undefined") return "";
  return navigator.platform || navigator.userAgent;
}

function isApplePlatform(platform: string): boolean {
  return /Mac|iPhone|iPad|iPod/i.test(platform);
}
