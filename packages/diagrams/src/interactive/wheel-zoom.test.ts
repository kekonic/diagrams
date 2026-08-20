import { describe, expect, it } from "vite-plus/test";
import { resolveZoomOnWheel, shouldCaptureWheelZoom, wheelZoomHintText } from "./wheel-zoom.ts";

describe("shouldCaptureWheelZoom", () => {
  it("lets unmodified wheel pass through by default so the page can scroll", () => {
    expect(shouldCaptureWheelZoom({ ctrlKey: false, metaKey: false }, undefined)).toBe(false);
    expect(shouldCaptureWheelZoom({ ctrlKey: false, metaKey: false }, "modifier")).toBe(false);
  });

  it("zooms when Ctrl or ⌘ is held under the default modifier policy", () => {
    expect(shouldCaptureWheelZoom({ ctrlKey: true, metaKey: false }, "modifier")).toBe(true);
    expect(shouldCaptureWheelZoom({ ctrlKey: false, metaKey: true }, "modifier")).toBe(true);
  });

  it("treats trackpad pinch (ctrlKey without a physical Ctrl key) as zoom", () => {
    expect(shouldCaptureWheelZoom({ ctrlKey: true, metaKey: false }, undefined)).toBe(true);
  });

  it("zooms on every wheel event when the host opts into always", () => {
    expect(shouldCaptureWheelZoom({ ctrlKey: false, metaKey: false }, "always")).toBe(true);
  });
});

describe("resolveZoomOnWheel", () => {
  it("defaults unknown or omitted values to modifier", () => {
    expect(resolveZoomOnWheel(undefined)).toBe("modifier");
    expect(resolveZoomOnWheel("always")).toBe("always");
    expect(resolveZoomOnWheel("modifier")).toBe("modifier");
  });
});

describe("wheelZoomHintText", () => {
  it("names the platform modifier in the overlay copy", () => {
    expect(wheelZoomHintText("MacIntel")).toBe("Use ⌘ + scroll to zoom");
    expect(wheelZoomHintText("iPhone")).toBe("Use ⌘ + scroll to zoom");
    expect(wheelZoomHintText("Win32")).toBe("Use Ctrl + scroll to zoom");
    expect(wheelZoomHintText("Linux x86_64")).toBe("Use Ctrl + scroll to zoom");
  });
});
