import { describe, expect, it } from "vite-plus/test";
import {
  buildIframeEmbed,
  buildStudioSourceUrl,
  buildWebComponentEmbed,
  readStudioLaunch,
} from "./share.ts";

const SOURCE = `diagram "Café" {
  browser: client "Web"
}`;

describe("Studio sharing", () => {
  it("round-trips UTF-8 source through an editable fragment URL", () => {
    const url = new URL(buildStudioSourceUrl(SOURCE, "https://example.test/studio/?old=1"));
    expect(url.search).toBe("");
    expect(readStudioLaunch(url.hash)).toEqual({ source: SOURCE, embed: false });
  });

  it("builds a diagram-only iframe without exposing raw source", () => {
    const html = buildIframeEmbed(SOURCE, "https://example.test/studio/");
    expect(html).toContain("#embed=1&amp;source=");
    expect(html).not.toContain("Café");
    const fragment = html.match(/#([^"]+)/)?.[1]?.replaceAll("&amp;", "&");
    expect(readStudioLaunch(`#${fragment}`)).toEqual({ source: SOURCE, embed: true });
  });

  it("produces installed-package web component code and neutralizes closing scripts", () => {
    const html = buildWebComponentEmbed('diagram "</script>" {}');
    expect(html).toContain('import "@kekonic/diagrams-element"');
    expect(html).toContain("\\u003c/script>");
    expect(html).not.toContain('diagram "</script>"');
  });

  it("rejects invalid shared source without breaking Studio launch", () => {
    expect(readStudioLaunch("#embed=1&source=not-valid-💥")).toEqual({
      source: undefined,
      embed: true,
    });
  });
});
