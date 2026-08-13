import { describe, expect, it } from "vite-plus/test";
import { escapeXml } from "./utils.ts";

describe("escapeXml", () => {
  it("escapes XML special characters", () => {
    expect(escapeXml(`Tom & Jerry <3 "quotes" 'apostrophe'`)).toBe(
      "Tom &amp; Jerry &lt;3 &quot;quotes&quot; &apos;apostrophe&apos;",
    );
  });

  it("leaves safe strings unchanged", () => {
    expect(escapeXml("API Gateway")).toBe("API Gateway");
  });
});
