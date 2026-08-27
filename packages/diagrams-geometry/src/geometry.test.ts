import { describe, expect, it } from "vite-plus/test";
import {
  buildNodeBoundsModel,
  cloudGeometry,
  cylinderGeometry,
  cylinderPaths,
  cylinderRadii,
  diamondGeometry,
  diamondPointsString,
  ellipseGeometry,
  geometrySizeForContent,
  getNodeTypeDefinition,
  hexagonInset,
  hexagonPointsString,
  listRegisteredNodeTypeIds,
  listRegisteredShapeIds,
  parallelogramGeometry,
  personGeometry,
  personPaths,
  pillGeometry,
  queuePaths,
  queueRadii,
  resolveNodeTypeGeometry,
  resolveShapeGeometry,
  registerShape,
  unregisterShape,
} from "./index.ts";

describe("shape registry", () => {
  it("resolves built-in geometries and falls back to rounded", () => {
    expect(resolveShapeGeometry("diamond").id).toBe("diamond");
    expect(resolveShapeGeometry("nope").id).toBe("rounded");
    expect(listRegisteredShapeIds()).toContain("cylinder");
    expect(listRegisteredShapeIds()).toContain("cloud");
  });

  it("allows custom shape registration", () => {
    const base = resolveShapeGeometry("rectangle");
    registerShape({
      id: "custom-box",
      geometry: { ...base, id: "custom-box" },
      defaultSize: { width: 100, height: 50 },
      minSize: { width: 40, height: 20 },
      defaultPadding: { top: 8, right: 8, bottom: 8, left: 8 },
      supportedPortStrategies: ["bbox-mid"],
      contentPolicy: { align: "center" },
    });
    expect(resolveShapeGeometry("custom-box").id).toBe("custom-box");
    unregisterShape("custom-box");
    expect(resolveShapeGeometry("custom-box").id).toBe("rounded");
  });
});

describe("foundational shape math", () => {
  it("places diamond tips on bounding-box mid-sides", () => {
    expect(diamondPointsString({ x: 10, y: 20, width: 100, height: 80 })).toBe(
      "60,20 110,60 60,100 10,60",
    );
  });

  it("uses height-led hexagon insets", () => {
    expect(hexagonInset(200, 56)).toBeCloseTo(23.52, 1);
    const pts = hexagonPointsString({ x: 0, y: 0, width: 120, height: 60 });
    expect(pts.split(" ")).toHaveLength(6);
    expect(pts).toContain("0,30");
  });

  it("builds cylinder silhouette + rim", () => {
    const { rx, ry } = cylinderRadii(100, 80);
    expect(rx).toBe(50);
    expect(ry).toBeGreaterThan(7);
    const { body, rim } = cylinderPaths({ x: 0, y: 0, width: 100, height: 80 });
    expect(body).toContain("z");
    expect(rim).not.toContain("z");
  });

  it("builds queue as a horizontal pipe + rim", () => {
    const { rx, ry } = queueRadii(120, 64);
    expect(ry).toBe(32);
    expect(rx).toBeGreaterThan(7);
    const { body, rim } = queuePaths({ x: 0, y: 0, width: 120, height: 64 });
    expect(body).toContain("z");
    expect(rim).not.toContain("z");
    expect(resolveShapeGeometry("queue").id).toBe("queue");
    expect(resolveShapeGeometry("stream").id).toBe("stream");
  });

  it("keeps diamond content smaller than geometry", () => {
    const bounds = { x: 0, y: 0, width: 100, height: 100 };
    const content = diamondGeometry.getContentBounds(bounds);
    expect(content.width).toBeLessThan(bounds.width * 0.6);
    expect(content.height).toBeLessThan(bounds.height * 0.6);
  });

  it("intersects rays on diamond perimeter, not only bbox corners", () => {
    const bounds = { x: 0, y: 0, width: 100, height: 100 };
    const hit = diamondGeometry.intersectRay(bounds, { x: 50, y: 50 }, { x: 0, y: -1 });
    expect(hit).not.toBeNull();
    expect(hit!.y).toBeCloseTo(0, 5);
    expect(hit!.x).toBeCloseTo(50, 5);
  });

  it("intersects cylinder rays on the stadium wall, not a bounding ellipse", () => {
    const bounds = { x: 0, y: 0, width: 80, height: 160 };
    const hit = cylinderGeometry.intersectRay(bounds, { x: 120, y: 80 }, { x: -1, y: 0 });
    expect(hit).not.toBeNull();
    expect(hit!.x).toBeCloseTo(80, 1);
    expect(hit!.y).toBeCloseTo(80, 1);
  });

  it("places diamond fan-out ports on the silhouette, not the AABB face", () => {
    const bounds = { x: 0, y: 0, width: 100, height: 100 };
    const a = diamondGeometry.getPortPosition(
      { kind: "side", side: "east", index: 0, count: 2 },
      bounds,
    );
    const b = diamondGeometry.getPortPosition(
      { kind: "side", side: "east", index: 1, count: 2 },
      bounds,
    );
    // Projected onto diamond edges (inside the AABB, not parked on x=100 except the tip).
    expect(a.x).toBeLessThan(99.5);
    expect(b.x).toBeLessThan(99.5);
    expect(a.x).toBeGreaterThan(50);
    expect(b.x).toBeGreaterThan(50);
    expect(a.y).not.toBeCloseTo(b.y, 0);
  });

  it("projects ellipse / cloud / parallelogram / pill fans onto the silhouette", () => {
    const bounds = { x: 0, y: 0, width: 120, height: 80 };
    for (const geometry of [ellipseGeometry, cloudGeometry, parallelogramGeometry, pillGeometry]) {
      const a = geometry.getPortPosition(
        { kind: "side", side: "east", index: 0, count: 3 },
        bounds,
      );
      const b = geometry.getPortPosition(
        { kind: "side", side: "east", index: 2, count: 3 },
        bounds,
      );
      expect(a.x, geometry.id).toBeLessThan(bounds.x + bounds.width + 0.5);
      expect(b.x, geometry.id).toBeLessThan(bounds.x + bounds.width + 0.5);
      // Distinct pins — not collapsed to mid-side.
      expect(Math.abs(a.y - b.y), geometry.id).toBeGreaterThan(4);
      // Outside the open interior still counts as on-outline; center ray must hit near the port.
      const cx = bounds.x + bounds.width / 2;
      const cy = bounds.y + bounds.height / 2;
      const hit = geometry.intersectRay(bounds, { x: cx, y: cy }, { x: a.x - cx, y: a.y - cy });
      expect(hit, geometry.id).not.toBeNull();
      expect(Math.hypot(hit!.x - a.x, hit!.y - a.y), geometry.id).toBeLessThan(2);
    }
  });

  it("keeps person snap and FIXED_POS on the same silhouette", () => {
    const bounds = { x: 0, y: 0, width: 72, height: 110 };
    const shoulder = personGeometry.getPortPosition({ kind: "side", side: "east" }, bounds);
    const fromOutside = { x: 120, y: shoulder.y };
    const hit = personGeometry.intersectRay(bounds, fromOutside, { x: -1, y: 0 });
    expect(hit).not.toBeNull();
    expect(hit!.x).toBeCloseTo(shoulder.x, 0);
    expect(hit!.y).toBeCloseTo(shoulder.y, 0);
  });

  it("places person content inside the torso body", () => {
    const bounds = { x: 0, y: 0, width: 140, height: 160 };
    const content = personGeometry.getContentBounds(bounds);
    expect(content.y).toBeGreaterThan(bounds.height * 0.2);
    expect(content.y).toBeLessThan(bounds.height * 0.55);
    expect(content.width).toBeGreaterThan(80);
    // Content sits in the torso, above the feet.
    const south = personGeometry.getPortPosition({ kind: "side", side: "south" }, bounds);
    expect(content.y + content.height).toBeLessThanOrEqual(south.y + 1);
  });

  it("tucks the person head into the torso instead of leaving a neck gap", () => {
    const bounds = { x: 0, y: 0, width: 140, height: 160 };
    const content = personGeometry.getContentBounds(bounds);
    const north = personGeometry.getPortPosition({ kind: "side", side: "north" }, bounds);
    const bodyHalfW = Math.max(18, bounds.width / 2 - 2);
    const headR = Math.max(10, Math.min(22, bodyHalfW * 0.38));
    const headBottom = north.y + headR * 2;
    const bodyTop = content.y - 10; // BODY_PAD_Y
    expect(bodyTop).toBeLessThan(headBottom);
    expect(headBottom - bodyTop).toBeGreaterThanOrEqual(4);
    expect(personPaths(bounds).head.length).toBeGreaterThan(0);
  });

  it("widens person torso with the node bounds", () => {
    const narrow = personGeometry.getContentBounds({ x: 0, y: 0, width: 90, height: 140 });
    const wide = personGeometry.getContentBounds({ x: 0, y: 0, width: 180, height: 140 });
    expect(wide.width).toBeGreaterThan(narrow.width + 40);
  });

  it("pill content insets away from capsule ends", () => {
    const bounds = { x: 0, y: 0, width: 120, height: 40 };
    const content = pillGeometry.getContentBounds(bounds, { cornerRadius: 20 });
    expect(content.x).toBeGreaterThan(0);
    expect(content.width).toBeLessThan(bounds.width);
  });

  it("cloud exposes a central content region", () => {
    const bounds = { x: 0, y: 0, width: 160, height: 100 };
    const content = cloudGeometry.getContentBounds(bounds);
    expect(content.width).toBeGreaterThan(40);
    expect(content.height).toBeGreaterThan(20);
    expect(cloudGeometry.containsPoint(bounds, { x: 80, y: 50 })).toBe(true);
  });

  it("cloud path uses a flat bottom and cubic lobe curves", () => {
    const bounds = { x: 0, y: 0, width: 160, height: 100 };
    const path = cloudGeometry.getPath(bounds);
    expect(path.d).toMatch(/\bL\b/); // flat bottom
    expect(path.d).toMatch(/\bC\b/); // lobe curves
    expect(path.polygon!.length).toBeGreaterThanOrEqual(40);
    // Material path includes a horizontal base near the bottom of the box.
    const baseY = Math.max(...path.polygon!.map((p) => p.y));
    expect(baseY).toBeGreaterThan(bounds.y + bounds.height * 0.85);
    const onBase = path.polygon!.filter((p) => Math.abs(p.y - baseY) < 1);
    expect(onBase.length).toBeGreaterThanOrEqual(2);
  });

  it("cloud letterboxes into tall bounds instead of stretching", () => {
    const bounds = { x: 0, y: 0, width: 140, height: 140 };
    const path = cloudGeometry.getPath(bounds);
    const xs = path.polygon!.map((p) => p.x);
    const ys = path.polygon!.map((p) => p.y);
    const silhouetteW = Math.max(...xs) - Math.min(...xs);
    const silhouetteH = Math.max(...ys) - Math.min(...ys);
    expect(silhouetteW / silhouetteH).toBeGreaterThan(1.4);
    expect(silhouetteW / silhouetteH).toBeLessThan(1.6);
    // Tall box leaves empty margin above/below the fitted cloud.
    expect(Math.min(...ys)).toBeGreaterThan(bounds.y + 5);
  });
});

describe("node bounds model", () => {
  it("builds geometry/content/visual/interaction/footprint regions", () => {
    const bounds = { x: 10, y: 20, width: 100, height: 60 };
    const model = buildNodeBoundsModel(
      cylinderGeometry,
      bounds,
      { strokeWidth: 2 },
      {
        density: "standard",
      },
    );
    expect(model.geometry).toEqual(bounds);
    expect(model.content.y).toBeGreaterThan(bounds.y);
    expect(model.visual.width).toBeGreaterThanOrEqual(bounds.width);
    expect(model.footprint.width).toBeGreaterThan(model.visual.width);
    expect(model.clearSpace.top).toBeGreaterThan(0);
  });

  it("sizes geometry from content using shape insets", () => {
    const sized = geometrySizeForContent(diamondGeometry, { width: 60, height: 40 });
    expect(sized.width).toBeGreaterThan(60);
    expect(sized.height).toBeGreaterThan(40);
    const box = diamondGeometry.getContentBounds({
      x: 0,
      y: 0,
      width: sized.width,
      height: sized.height,
    });
    expect(box.width).toBeGreaterThanOrEqual(60 - 1);
    expect(box.height).toBeGreaterThanOrEqual(40 - 1);
  });
});

describe("DSL node type catalog", () => {
  it("resolves node types from the DSL kind catalog", () => {
    expect(getNodeTypeDefinition("cloud")?.shapeId).toBe("cloud");
    expect(getNodeTypeDefinition("decision")?.shapeId).toBe("diamond");
    expect(resolveNodeTypeGeometry("database").id).toBe("cylinder");
    expect(listRegisteredNodeTypeIds().length).toBeGreaterThan(50);
  });
});
