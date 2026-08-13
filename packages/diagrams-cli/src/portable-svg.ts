import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import type { ResolvedRenderSettings } from "./project-config.ts";

const require = createRequire(import.meta.url);

export function finalizePortableSvg(svg: string, settings: ResolvedRenderSettings): string {
  let output = svg;
  if (settings.embedFonts) output = embedInter(output);
  if (settings.background === "theme") {
    const background = `<rect class="kdiagram-export-background" width="100%" height="100%" fill="var(--kd-bg)"/>`;
    output = output.replace(/(<desc\b[^>]*>[^<]*<\/desc>)/, `$1\n${background}`);
  }
  return output;
}

function embedInter(svg: string): string {
  const fontPath = require.resolve("@fontsource/inter/files/inter-latin-500-normal.woff");
  const font = readFileSync(fontPath).toString("base64");
  const css = `@font-face{font-family:"Inter";src:url(data:font/woff;base64,${font}) format("woff");font-style:normal;font-weight:100 900;font-display:block;}`;
  const styleIndex = svg.indexOf("<style>");
  if (styleIndex >= 0) return svg.slice(0, styleIndex + 7) + css + svg.slice(styleIndex + 7);
  return svg.replace(/(<svg\b[^>]*>)/, `$1\n<style>${css}</style>`);
}
