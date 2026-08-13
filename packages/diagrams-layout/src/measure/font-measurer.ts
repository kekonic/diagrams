import * as opentypeNs from "opentype.js";
import type { Font } from "opentype.js";
import type {
  TextMeasurer,
  TextMetrics,
  TextStyle,
  WrapOptions,
  WrappedText,
} from "./text-measurer.ts";
import { LINE_HEIGHT } from "./text-measurer.ts";

type OpentypeApi = { parse: (buffer: Buffer | ArrayBuffer) => Font };
type OpentypeModule = { parse?: OpentypeApi["parse"]; [key: string]: unknown };
const opentypeModule = opentypeNs as unknown as OpentypeModule;
const defaultExportKey: string = "default";
const opentype =
  typeof opentypeModule.parse === "function"
    ? (opentypeModule as OpentypeApi)
    : (opentypeModule[defaultExportKey] as OpentypeApi);

let cachedFont: Font | null | undefined;

function loadDefaultFont(): opentype.Font | null {
  if (typeof document !== "undefined") return null;
  if (cachedFont !== undefined) return cachedFont;
  try {
    // Keep Node builtins out of browser bundles. Static `node:*` imports are
    // externalized by Vite and can throw as soon as the client module loads,
    // even though browsers take the canvas-measurement path instead.
    const runtimeProcess = (
      globalThis as typeof globalThis & {
        process?: { getBuiltinModule?: (id: string) => unknown };
      }
    ).process;
    const moduleBuiltin = runtimeProcess?.getBuiltinModule?.("module") as
      | typeof import("node:module")
      | undefined;
    const fsBuiltin = runtimeProcess?.getBuiltinModule?.("fs") as
      | typeof import("node:fs")
      | undefined;
    if (!moduleBuiltin || !fsBuiltin) return null;

    const { createRequire } = moduleBuiltin;
    const { readFileSync } = fsBuiltin;
    const nodeRequire = createRequire(import.meta.url);
    const fontPath = nodeRequire.resolve("@fontsource/inter/files/inter-latin-500-normal.woff");
    const buffer = readFileSync(fontPath);
    cachedFont = opentype.parse(buffer);
    return cachedFont;
  } catch {
    cachedFont = null;
    return null;
  }
}

export function createFontFileMeasurer(): TextMeasurer | null {
  const font = loadDefaultFont();
  if (!font) return null;

  return {
    measureText(text: string, style: TextStyle): TextMetrics {
      const scale = style.fontSize / font.unitsPerEm;
      let width = 0;
      for (const ch of text) {
        const glyph = font.charToGlyph(ch);
        width += (glyph.advanceWidth ?? 0) * scale;
      }
      const ascent = (font.ascender ?? font.unitsPerEm * 0.8) * scale;
      const descent = Math.abs(font.descender ?? font.unitsPerEm * 0.2) * scale;
      return { width, height: ascent + descent, ascent, descent };
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
