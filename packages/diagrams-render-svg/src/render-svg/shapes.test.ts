import { describe, expect, it } from "vite-plus/test";
import {
  cardCornerRadius,
  cylinderPaths,
  cylinderRadii,
  diamondPoints,
  hexagonInset,
  hexagonPoints,
  queuePaths,
  queueRadii,
  renderNodeShell,
  type ShellPaint,
} from "./shapes.ts";

const paint: ShellPaint = {
  fill: "var(--node-fill)",
  stroke: "var(--node-stroke)",
  dashAttr: "",
  filterAttr: "",
};

describe("node shell shapes", () => {
  it("keeps pill capsules even when roundedCorners is off", () => {
    expect(cardCornerRadius("pill", 40, false)).toBe(20);
    expect(cardCornerRadius("rounded", 40, false)).toBe(0);
    expect(cardCornerRadius("rectangle", 40, true)).toBe(6);
  });

  it("places diamond tips on bounding-box mid-sides", () => {
    expect(diamondPoints({ x: 10, y: 20, width: 100, height: 80 })).toBe(
      "60,20 110,60 60,100 10,60",
    );
  });

  it("uses height-led hexagon insets so wide nodes keep real chamfers", () => {
    const wide = hexagonInset(200, 56);
    const tall = hexagonInset(120, 100);
    expect(wide).toBeCloseTo(23.52, 1);
    expect(tall).toBeCloseTo(26.4, 1);
    const pts = hexagonPoints({ x: 0, y: 0, width: 120, height: 60 });
    expect(pts.split(" ")).toHaveLength(6);
    expect(pts).toContain("0,30");
    expect(pts).toContain("120,30");
  });

  it("draws cylinder as a closed silhouette plus rim arc", () => {
    const { rx, ry } = cylinderRadii(100, 80);
    expect(rx).toBe(50);
    expect(ry).toBeGreaterThan(7);
    expect(ry).toBeLessThanOrEqual(13);
    const { body, rim } = cylinderPaths({ x: 0, y: 0, width: 100, height: 80 });
    expect(body.startsWith("M 0 ")).toBe(true);
    expect(body).toContain("z");
    expect(rim).toContain("a ");
    expect(rim).not.toContain("z");
  });

  it("draws queue as a horizontal pipe with a left-end rim", () => {
    const { rx, ry } = queueRadii(120, 64);
    expect(ry).toBe(32);
    expect(rx).toBeGreaterThan(7);
    const { body, rim } = queuePaths({ x: 0, y: 0, width: 120, height: 64 });
    expect(body).toContain("z");
    expect(rim).toContain("a ");
    expect(rim).not.toContain("z");
    const svg = renderNodeShell("queue", { x: 0, y: 0, width: 120, height: 64 }, paint, false);
    expect(svg).toContain("path");
    expect(svg).toContain("flow-node-shell-rim");
    expect(svg).not.toContain("polygon");
  });

  it("draws stream as a stacked-log card with partition rules", () => {
    const svg = renderNodeShell("stream", { x: 0, y: 0, width: 140, height: 72 }, paint, false);
    expect(svg).toContain("flow-node-shell-partition");
    expect(svg.match(/flow-node-shell-partition/g)?.length).toBe(2);
    // Left-rail ticks only — short segments, not full-width rules through the label.
    const partitionPaths = [
      ...svg.matchAll(/d="(M [^"]+)" class="flow-node-shell-partition"/g),
    ].map((m) => m[1]!);
    expect(partitionPaths.length).toBe(2);
    for (const d of partitionPaths) {
      const nums = d.match(/-?[\d.]+/g)?.map(Number) ?? [];
      // M x1 y1 L x2 y2
      expect(nums[2]! - nums[0]!).toBeLessThan(30);
    }
  });

  it("applies external dash on card shells", () => {
    const dashed: ShellPaint = { ...paint, dashAttr: ' stroke-dasharray="5 3.5"' };
    const svg = renderNodeShell("rectangle", { x: 0, y: 0, width: 100, height: 48 }, dashed, false);
    expect(svg).toContain('stroke-dasharray="5 3.5"');
    expect(svg).toContain('rx="0"');
  });
});
