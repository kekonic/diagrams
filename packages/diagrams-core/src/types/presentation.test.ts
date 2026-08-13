import { describe, expect, it } from "vite-plus/test";
import {
  displayLabelCase,
  formatLabelText,
  mergePresentationOptions,
  resolvePresentation,
} from "./presentation.ts";

describe("resolvePresentation", () => {
  it("defaults to chromeless embeddable output", () => {
    const resolved = resolvePresentation(undefined, "My diagram");
    expect(resolved.title).toBe(false);
    expect(resolved.padding.top).toBe(0);
    expect(resolved.clampLabels).toBe(true);
    expect(resolved.labelCase).toBe("as-authored");
    expect(resolved.groupAccent).toBe(false);
    expect(resolved.showKindSubtitles).toBe(false);
  });

  it("opts into title from the graph name with title: auto", () => {
    const resolved = resolvePresentation({ title: "auto" }, "Checkout");
    expect(resolved.title).toEqual({ text: "Checkout", align: "start" });
  });

  it("keeps kind subtitles off unless explicitly enabled", () => {
    expect(resolvePresentation({}).showKindSubtitles).toBe(false);
    expect(resolvePresentation({ showKindSubtitles: true }).showKindSubtitles).toBe(true);
  });

  it("opts into edge endpoints when requested", () => {
    expect(resolvePresentation({}).showEndpoints).toBe(false);
    expect(resolvePresentation({ showEndpoints: true }).showEndpoints).toBe(true);
  });

  it("enables group accents when requested", () => {
    const resolved = resolvePresentation({
      groupAccent: true,
      padding: 24,
    });
    expect(resolved.groupAccent).toBe(true);
    expect(resolved.padding.top).toBe(24);
  });

  it("supports an explicit title object with subtitle", () => {
    const resolved = resolvePresentation({
      title: { text: "Checkout", subtitle: "Clients to Stripe", align: "center" },
    });
    expect(resolved.title).toEqual({
      text: "Checkout",
      subtitle: "Clients to Stripe",
      align: "center",
    });
  });
});

describe("formatLabelText", () => {
  it("preserves labels as authored", () => {
    expect(formatLabelText("authorize payment", "as-authored")).toBe("authorize payment");
    expect(formatLabelText("STOCK CHECK", "as-authored")).toBe("STOCK CHECK");
  });
});

describe("displayLabelCase", () => {
  it("always returns as-authored", () => {
    expect(displayLabelCase(true, "as-authored")).toBe("as-authored");
    expect(displayLabelCase(false, "as-authored")).toBe("as-authored");
  });
});

describe("mergePresentationOptions", () => {
  it("merges later layers over earlier", () => {
    const merged = mergePresentationOptions({ title: "auto" }, { groupAccent: true });
    expect(merged?.title).toBe("auto");
    expect(merged?.groupAccent).toBe(true);
  });
});
