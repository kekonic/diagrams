import { describe, expect, it } from "vite-plus/test";
import { createFontFileMeasurer } from "./font-measurer.ts";

describe("font measurer", () => {
  it("loads bundled Inter font", () => {
    const m = createFontFileMeasurer();
    expect(m).toBeTruthy();
    const width = m!.measureText("hello", { fontSize: 14, fontFamily: "Inter" }).width;
    expect(width).toBeGreaterThan(20);
  });
});
