import { describe, expect, it } from "vite-plus/test";
import { strictHex } from "./color.ts";
import {
  buildComponentSnippet,
  buildEmbedSnippet,
  buildIframeSnippet,
  deliveryPreview,
  exportFilename,
  filePresetPatch,
  fileSettingsDetail,
  finishExportSvg,
  lookParams,
  matchingFilePreset,
  matchingPreset,
  pngPixelSize,
  pngScaleFits,
  withPreviewTokens,
  seedsForPalette,
  type FileDelivery,
} from "./delivery.ts";
import { defaultSeeds, deriveThemeTokens, seedsForPreset } from "./deriveTheme.ts";
import { readStudioLaunch } from "./share.ts";

const SOURCE = `diagram "Café" {
  browser: client "Web"
}`;

const BASE_FILE: FileDelivery = {
  format: "svg",
  palette: "studio",
  mode: "dark",
  background: "transparent",
  portable: true,
  embedFonts: false,
  scale: 2,
};

const SVG = `<?xml version="1.0" encoding="UTF-8"?>
<svg class="k-diagram" width="120" height="40" viewBox="0 0 120 40" xmlns="http://www.w3.org/2000/svg">
<style>.k-diagram { font-family: Inter }</style>
<desc id="flow-desc">Diagram with 1 nodes and 0 edges</desc>
</svg>`;

describe("file presets", () => {
  it("recognizes each starting point and leaves the palette alone", () => {
    expect(matchingFilePreset(BASE_FILE)).toBe("screen");
    const slide = filePresetPatch("slide", BASE_FILE);
    expect(matchingFilePreset(slide)).toBe("slide");
    expect(slide.palette).toBe("studio");
    expect(slide.scale).toBe(2);
    const document = filePresetPatch("document", { ...BASE_FILE, mode: "dark" });
    expect(document.mode).toBe("light");
    expect(matchingFilePreset(document)).toBe("document");
    expect(matchingFilePreset(filePresetPatch("inline", BASE_FILE))).toBe("inline");
  });

  it("drops the starting point when a detail changes", () => {
    expect(
      matchingFilePreset({ ...filePresetPatch("slide", BASE_FILE), scale: 3 }),
    ).toBeUndefined();
    expect(fileSettingsDetail({ ...filePresetPatch("slide", BASE_FILE), scale: 3 })).toContain(
      "PNG at 3×",
    );
    expect(fileSettingsDetail(BASE_FILE)).toContain("transparent ground");
  });

  it("keeps scale out of the preview and snapshots a locked still", () => {
    const scaled = { ...BASE_FILE, scale: 3 as const };
    expect(deliveryPreview(scaled, "file", "explorer", "lock").scale).toBe(1);
    expect(deliveryPreview(scaled, "file", "explorer", "lock").portable).toBe(true);
    const live = { ...BASE_FILE, portable: false, embedFonts: true };
    expect(deliveryPreview(live, "embed", "still", "follow")).toMatchObject({
      format: "svg",
      portable: false,
      embedFonts: false,
    });
    expect(deliveryPreview(live, "embed", "still", "lock")).toMatchObject({
      portable: true,
      embedFonts: true,
    });
  });
});

describe("export svg finishing", () => {
  it("paints a canvas or white ground once", () => {
    const canvas = finishExportSvg(SVG, { background: "canvas" });
    expect(canvas).toContain('class="kdiagram-export-background"');
    expect(canvas).toContain('fill="var(--kd-bg)"');
    expect(finishExportSvg(canvas, { background: "canvas" })).toBe(canvas);

    const white = finishExportSvg(SVG, { background: "white" });
    expect(white).toContain('fill="#ffffff"');
    expect(finishExportSvg(SVG, { background: "transparent" })).toBe(SVG);
  });

  it("inlines a font face into the existing style element", () => {
    const finished = finishExportSvg(SVG, {
      background: "transparent",
      fontFaceCss: `@font-face{font-family:"Inter";src:url(data:font/woff;base64,QQ==) format("woff");}`,
    });
    expect(finished).toContain("/*kdiagram-export-font*/");
    expect(finished.indexOf("kdiagram-export-font")).toBeLessThan(
      finished.indexOf("font-family: Inter"),
    );
    expect(finishExportSvg(finished, { background: "transparent", fontFaceCss: "again" })).toBe(
      finished,
    );
  });

  it("paints preview tokens without changing a live download", () => {
    const tokens = deriveThemeTokens(defaultSeeds("dark"));
    const painted = withPreviewTokens(SVG, tokens);
    expect(painted).toContain("/*kdiagram-preview-theme*/");
    expect(painted).toContain(`--kd-bg:${tokens["--kd-bg"]}`);
    expect(painted.indexOf("kdiagram-preview-theme")).toBeLessThan(painted.indexOf("font-family"));
    expect(withPreviewTokens(painted, tokens)).toBe(painted);
    expect(withPreviewTokens(SVG, { "--kd-bg": "url(https://evil.test/x)" })).toBe(SVG);
    expect(withPreviewTokens(SVG, { "--kd-bg": "red; } </style>" })).toBe(SVG);
    expect(withPreviewTokens(SVG, { "kd-bg": "#111111" })).toBe(SVG);
  });

  it("rejects font CSS that could break out of the style element", () => {
    expect(() =>
      finishExportSvg(SVG, { background: "transparent", fontFaceCss: "</style>" }),
    ).toThrow(/not safe/);
  });
});

describe("png size", () => {
  it("scales the svg viewport and refuses an edge past the canvas limit", () => {
    expect(pngPixelSize(SVG, 2)).toEqual({ width: 240, height: 80 });
    const huge = SVG.replace('width="120"', 'width="9000"');
    expect(pngScaleFits(huge, 1)).toBe(false);
    expect(pngScaleFits(SVG, 3)).toBe(true);
  });

  it("builds a portable filename from the document name", () => {
    expect(exportFilename("Café diagram.kdiagram", "png")).toBe("Café diagram.png");
    expect(exportFilename("a/b:c.kdiagram", "svg")).toBe("a-b-c.svg");
    expect(exportFilename("   ", "svg")).toBe("diagram.svg");
  });
});

describe("stylistic embeds", () => {
  const studio = "https://example.test/studio/";
  const ocean = seedsForPreset("ocean", "light");

  it("round-trips a locked explorer embed without putting source in the query", () => {
    const html = buildIframeSnippet(SOURCE, studio, {
      style: "explorer",
      color: "lock",
      seeds: ocean,
      background: "canvas",
    });
    expect(html).toContain('height="640"');
    expect(html).toContain('referrerpolicy="no-referrer"');
    expect(html).not.toContain("Café");
    const fragment = html.match(/#([^"]+)/)?.[1]?.replaceAll("&amp;", "&");
    expect(fragment).toBeDefined();
    const launch = readStudioLaunch(`#${fragment}`);
    expect(launch.embed).toBe(true);
    expect(launch.source).toBe(SOURCE);
    expect(launch.look).toMatchObject({
      style: "explorer",
      mode: "light",
      background: "canvas",
      preset: "ocean",
    });
    expect(strictHex(launch.look?.seeds?.accent)).toBe(strictHex(ocean.accent));
  });

  it("keeps ambient embeds on the host theme", () => {
    const params = lookParams({
      style: "ambient",
      color: "lock",
      seeds: ocean,
      background: "transparent",
    });
    expect(params).toMatchObject({ style: "ambient", theme: "auto", bg: "transparent" });
    expect(params.palette).toBeUndefined();
    expect(params.accent).toBeUndefined();
  });

  it("encodes a custom palette as hex and ignores unsafe colors", () => {
    const custom = { mode: "dark" as const, accent: "#ff4d6d", neutral: "#111122" };
    expect(lookParams({ color: "lock", seeds: custom })).toMatchObject({
      theme: "dark",
      accent: "#ff4d6d",
      neutral: "#111122",
    });
    expect(
      lookParams({ color: "lock", seeds: { ...custom, accent: "red" } }).accent,
    ).toBeUndefined();
  });

  it("builds a web component that registers the palette and neutralizes script closers", () => {
    const html = buildComponentSnippet({
      source: 'diagram "</script>" {}',
      documentName: "Order/Fulfillment.kdiagram",
      color: "lock",
      style: "component",
      tokens: { "--kd-accent": "#ff4d6d", "--kd-bg": "#101018" },
    });
    expect(html).toContain('id="kdiagram-order-fulfillment"');
    expect(html).toContain('theme="kekonic-export"');
    expect(html).toContain('import { registerTheme } from "@kekonic/diagrams"');
    expect(html).toContain("\\u003c/script>");
    expect(html).not.toContain('diagram "</script>"');
  });

  it("offers a markdown fence and a studio link", () => {
    const fence = buildEmbedSnippet({
      style: "markdown",
      color: "lock",
      source: "diagram { }\n```\n",
      studioUrl: studio,
      documentName: "diagram.kdiagram",
      background: "transparent",
    });
    expect(fence.text.startsWith("````kdiagram")).toBe(true);
    expect(fence.hint).toContain("host theme");

    const link = buildEmbedSnippet({
      style: "link",
      color: "lock",
      source: SOURCE,
      studioUrl: studio,
      documentName: "diagram.kdiagram",
      seeds: defaultSeeds("dark"),
      background: "transparent",
    });
    const launch = readStudioLaunch(new URL(link.text).hash);
    expect(launch.embed).toBe(false);
    expect(launch.source).toBe(SOURCE);
    expect(launch.look?.preset).toBe("default");
  });

  it("maps the studio palette onto the requested mode", () => {
    const light = seedsForPalette("studio", "light", defaultSeeds("dark"));
    expect(light.mode).toBe("light");
    expect(light.accent).toBe(defaultSeeds("light").accent);
    expect(matchingPreset(seedsForPreset("paper", "dark"))).toBe("paper");
    expect(matchingPreset(seedsForPreset("ink", "light"))).toBe("ink");
  });
});
