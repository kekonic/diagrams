/** Shared font metrics — browser canvas and approximate server fallback. */

import { createFontFileMeasurer } from "./font-measurer.ts";

export type TextStyle = {
  fontSize: number;
  fontFamily: string;
  fontWeight?: string;
};

export type TextMetrics = {
  width: number;
  height: number;
  ascent: number;
  descent: number;
};

export type WrapOptions = {
  maxWidth: number;
  style: TextStyle;
};

export type WrappedText = {
  lines: string[];
  width: number;
  height: number;
};

export type TextMeasurer = {
  measureText(text: string, style: TextStyle): TextMetrics;
  wrapText(text: string, options: WrapOptions): WrappedText;
};

export const DEFAULT_FONT_FAMILY = '"Inter", "Segoe UI", system-ui, sans-serif';
/** Must match `.flow-node-title` / SVG titleSize (15px). */
export const DEFAULT_FONT_SIZE = 15;
export const LINE_HEIGHT = 1.2;
const CHAR_WIDTH_RATIO = 0.55;

let measurerUsesFallback = false;

export function measurerUsedApproximationFallback(): boolean {
  return measurerUsesFallback;
}

function createDefaultMeasurer(): TextMeasurer {
  if (typeof document !== "undefined") {
    return createCanvasMeasurer();
  }
  const fontMeasurer = createFontFileMeasurer();
  if (fontMeasurer) return fontMeasurer;
  measurerUsesFallback = true;
  return createApproximateMeasurer();
}

function createApproximateMeasurer(): TextMeasurer {
  return {
    measureText(text: string, style: TextStyle): TextMetrics {
      const width = text.length * style.fontSize * CHAR_WIDTH_RATIO;
      return {
        width,
        height: style.fontSize * LINE_HEIGHT,
        ascent: style.fontSize * 0.8,
        descent: style.fontSize * 0.2,
      };
    },
    wrapText(text: string, options: WrapOptions): WrappedText {
      const words = text.split(/\s+/);
      const lines: string[] = [];
      let current = "";
      let maxW = 0;
      for (const word of words) {
        const test = current ? `${current} ${word}` : word;
        const w = test.length * options.style.fontSize * CHAR_WIDTH_RATIO;
        if (w > options.maxWidth && current) {
          lines.push(current);
          maxW = Math.max(maxW, current.length * options.style.fontSize * CHAR_WIDTH_RATIO);
          current = word;
        } else {
          current = test;
        }
      }
      if (current) {
        lines.push(current);
        maxW = Math.max(maxW, current.length * options.style.fontSize * CHAR_WIDTH_RATIO);
      }
      const lineH = options.style.fontSize * LINE_HEIGHT;
      return {
        lines: lines.length ? lines : [text],
        width: maxW,
        height: (lines.length || 1) * lineH,
      };
    },
  };
}

export function createCanvasMeasurer(canvas?: HTMLCanvasElement): TextMeasurer {
  const c = canvas ?? (typeof document !== "undefined" ? document.createElement("canvas") : null);
  const ctx = c?.getContext("2d") ?? null;

  return {
    measureText(text: string, style: TextStyle): TextMetrics {
      if (ctx) {
        ctx.font = `${style.fontWeight ?? "500"} ${style.fontSize}px ${style.fontFamily}`;
        const m = ctx.measureText(text);
        const ascent = m.actualBoundingBoxAscent ?? style.fontSize * 0.8;
        const descent = m.actualBoundingBoxDescent ?? style.fontSize * 0.2;
        return { width: m.width, height: ascent + descent, ascent, descent };
      }
      const width = text.length * style.fontSize * CHAR_WIDTH_RATIO;
      return {
        width,
        height: style.fontSize * LINE_HEIGHT,
        ascent: style.fontSize * 0.8,
        descent: style.fontSize * 0.2,
      };
    },

    wrapText(text: string, options: WrapOptions): WrappedText {
      const words = text.split(/\s+/);
      const lines: string[] = [];
      let current = "";
      let maxW = 0;
      for (const word of words) {
        const test = current ? `${current} ${word}` : word;
        const w = this.measureText(test, options.style).width;
        if (w > options.maxWidth && current) {
          lines.push(current);
          maxW = Math.max(maxW, this.measureText(current, options.style).width);
          current = word;
        } else {
          current = test;
        }
      }
      if (current) {
        lines.push(current);
        maxW = Math.max(maxW, this.measureText(current, options.style).width);
      }
      const lineH = options.style.fontSize * LINE_HEIGHT;
      return {
        lines: lines.length ? lines : [text],
        width: maxW,
        height: (lines.length || 1) * lineH,
      };
    },
  };
}

let _defaultMeasurer: TextMeasurer | undefined;

export function resetDefaultMeasurer(): void {
  _defaultMeasurer = undefined;
  measurerUsesFallback = false;
}

function lazyDefaultMeasurer(): TextMeasurer {
  if (!_defaultMeasurer) _defaultMeasurer = createDefaultMeasurer();
  return _defaultMeasurer;
}

export const defaultMeasurer: TextMeasurer = {
  measureText(text, style) {
    return lazyDefaultMeasurer().measureText(text, style);
  },
  wrapText(text, options) {
    return lazyDefaultMeasurer().wrapText(text, options);
  },
};
