/**
 * Refine ELK orthogonal corridors into real straight / smart-bezier geometry.
 * "Your word is a lamp to my feet and a light to my path." — Psalm 119:105
 */

import type { Point, Rect, RouteMode } from "@kekonic/diagrams-core";

export type CubicBezier = {
  from: Point;
  c1: Point;
  c2: Point;
  to: Point;
};

export type RouteStyleEdge = {
  edgeId: string;
  fromId: string;
  toId: string;
  points: Point[];
};

export type RouteStyleObstacle = {
  id: string;
  bounds: Rect;
};

export type RefinedRoute = {
  edgeId: string;
  points: Point[];
  cubics?: CubicBezier[];
};

const COLINEAR_EPS = 0.75;
const OBSTACLE_PAD = 6;
const PARALLEL_GAP = 8;
const PARALLEL_MERGE = 3.5;
const CUBIC_HIT_SAMPLES = 16;
const CUBIC_PATH_SAMPLES = 12;
const SIDE_TIE = 0.75;

type OrganicProfile = {
  handleMin: number;
  handleMax: number;
  handleFactor: number;
  filletMax: number;
  filletMin: number;
};

/** Cubic control-point scale for a 90° circular arc (4/3 · (√2 − 1)). */
const CUBIC_ARC_KAPPA = 0.5522847498;

const METRO_PROFILE: OrganicProfile = {
  handleMin: 28,
  handleMax: 88,
  handleFactor: 0.55,
  filletMax: 64,
  filletMin: 14,
};

const ROUNDED_PROFILE: OrganicProfile = {
  handleMin: 20,
  handleMax: 60,
  handleFactor: 0.46,
  filletMax: 36,
  filletMin: 12,
};

const BEZIER_PROFILE: OrganicProfile = {
  handleMin: 28,
  handleMax: 104,
  handleFactor: 0.58,
  filletMax: 64,
  filletMin: 16,
};

export type OrganicRouteOptions = {
  mode?: "metro" | "rounded" | "bezier";
  t0?: Point;
  t1?: Point;
  cornerRadius?: number;
};

function dist(a: Point, b: Point): number {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

function dir(from: Point, to: Point): Point {
  const len = dist(from, to);
  if (len < 1e-6) return { x: 1, y: 0 };
  return { x: (to.x - from.x) / len, y: (to.y - from.y) / len };
}

function lerp(a: Point, b: Point, t: number): Point {
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
}

function add(a: Point, v: Point, s: number): Point {
  return { x: a.x + v.x * s, y: a.y + v.y * s };
}

function inflate(box: Rect, pad: number): Rect {
  return {
    x: box.x - pad,
    y: box.y - pad,
    width: box.width + pad * 2,
    height: box.height + pad * 2,
  };
}

export function collapseColinear(points: Point[], eps = COLINEAR_EPS): Point[] {
  if (points.length < 3) return points.map((p) => ({ x: p.x, y: p.y }));
  const out: Point[] = [{ ...points[0]! }];
  for (let i = 1; i < points.length - 1; i++) {
    const a = out[out.length - 1]!;
    const b = points[i]!;
    const c = points[i + 1]!;
    const vertical = Math.abs(a.x - b.x) < eps && Math.abs(b.x - c.x) < eps;
    const horizontal = Math.abs(a.y - b.y) < eps && Math.abs(b.y - c.y) < eps;
    if (vertical || horizontal) continue;
    out.push({ ...b });
  }
  out.push({ ...points[points.length - 1]! });
  return out;
}

/**
 * True when the open segment stabs the open interior of `box`.
 * Grazing a face does not count — attach points sit on silhouettes.
 */
export function segmentHitsAabb(a: Point, b: Point, box: Rect): boolean {
  const pad = 0.6;
  const xmin = box.x + pad;
  const xmax = box.x + box.width - pad;
  const ymin = box.y + pad;
  const ymax = box.y + box.height - pad;
  if (xmax <= xmin || ymax <= ymin) return false;

  const dx = b.x - a.x;
  const dy = b.y - a.y;
  let t0 = 0;
  let t1 = 1;

  const clip = (p: number, q: number): boolean => {
    if (Math.abs(p) < 1e-12) return q >= 0;
    const r = q / p;
    if (p < 0) {
      if (r > t1) return false;
      if (r > t0) t0 = r;
    } else {
      if (r < t0) return false;
      if (r < t1) t1 = r;
    }
    return true;
  };

  if (!clip(-dx, a.x - xmin)) return false;
  if (!clip(dx, xmax - a.x)) return false;
  if (!clip(-dy, a.y - ymin)) return false;
  if (!clip(dy, ymax - a.y)) return false;
  return t1 > t0 && t1 > 0.03 && t0 < 0.97;
}

function polylineHitsObstacles(a: Point, b: Point, obstacles: Rect[]): boolean {
  return obstacles.some((box) => segmentHitsAabb(a, b, box));
}

function obstaclesForEdge(
  edge: RouteStyleEdge,
  all: RouteStyleObstacle[],
  pad = OBSTACLE_PAD,
): Rect[] {
  return all
    .filter((o) => o.id !== edge.fromId && o.id !== edge.toId)
    .map((o) => inflate(o.bounds, pad));
}

/**
 * Keep original waypoints, skipping any that the chord can see around.
 * Clear line of sight → `[start, end]`. Otherwise a minimal dogleg from the
 * existing corridor — never a silent punch through a third-party node.
 */
export function shortcutStraight(points: Point[], obstacles: Rect[]): Point[] {
  const pts = collapseColinear(points);
  if (pts.length <= 2) return pts;
  const out: Point[] = [{ ...pts[0]! }];
  let i = 0;
  while (i < pts.length - 1) {
    let best = i + 1;
    for (let j = pts.length - 1; j > i + 1; j--) {
      if (!polylineHitsObstacles(pts[i]!, pts[j]!, obstacles)) {
        best = j;
        break;
      }
    }
    out.push({ ...pts[best]! });
    i = best;
  }
  return collapseColinear(out);
}

function cubicPoint(c: CubicBezier, t: number): Point {
  const u = 1 - t;
  const tt = t * t;
  const uu = u * u;
  return {
    x: uu * u * c.from.x + 3 * uu * t * c.c1.x + 3 * u * tt * c.c2.x + tt * t * c.to.x,
    y: uu * u * c.from.y + 3 * uu * t * c.c1.y + 3 * u * tt * c.c2.y + tt * t * c.to.y,
  };
}

export function sampleCubic(c: CubicBezier, steps = CUBIC_PATH_SAMPLES): Point[] {
  const pts: Point[] = [{ ...c.from }];
  for (let i = 1; i <= steps; i++) pts.push(cubicPoint(c, i / steps));
  return pts;
}

export function sampleCubics(cubics: CubicBezier[], steps = CUBIC_PATH_SAMPLES): Point[] {
  if (!cubics.length) return [];
  const pts: Point[] = [{ ...cubics[0]!.from }];
  for (const c of cubics) {
    for (let i = 1; i <= steps; i++) pts.push(cubicPoint(c, i / steps));
  }
  return pts;
}

function cubicHitsObstacles(c: CubicBezier, obstacles: Rect[]): boolean {
  let prev = c.from;
  for (let i = 1; i < CUBIC_HIT_SAMPLES; i++) {
    const p = cubicPoint(c, i / CUBIC_HIT_SAMPLES);
    if (polylineHitsObstacles(prev, p, obstacles)) return true;
    prev = p;
  }
  return polylineHitsObstacles(prev, c.to, obstacles);
}

function profileFor(
  mode: "metro" | "rounded" | "bezier" | undefined,
  cornerRadius?: number,
): OrganicProfile {
  const base =
    mode === "bezier" ? BEZIER_PROFILE : mode === "rounded" ? ROUNDED_PROFILE : METRO_PROFILE;
  if (cornerRadius == null || !Number.isFinite(cornerRadius)) return base;
  const r = Math.max(0, cornerRadius);
  return {
    ...base,
    filletMax: r,
    filletMin: Math.min(base.filletMin, r),
    handleMin: Math.max(8, Math.min(base.handleMin, r * 0.75)),
    handleMax: Math.max(base.handleMin, Math.min(base.handleMax, Math.max(r * 1.4, 16))),
  };
}

function spanHandle(from: Point, to: Point, profile: OrganicProfile): number {
  const chord = dist(from, to);
  return Math.max(profile.handleMin, Math.min(profile.handleMax, chord * profile.handleFactor));
}

function tangentCubic(from: Point, to: Point, t0: Point, t1: Point, handle: number): CubicBezier {
  const chord = Math.max(1, dist(from, to));
  // Short port stubs must still ease: allow handles longer than the chord so the
  // curve swings along the port normal instead of collapsing to a 90° nick.
  const alongChord = chord * 0.55;
  const stubBoost = Math.min(handle, Math.max(22, chord * 0.68));
  const cap = chord < 48 ? stubBoost : Math.max(alongChord, Math.min(52, handle * 0.7));
  const h = Math.max(10, Math.min(handle, cap));
  return {
    from: { ...from },
    c1: add(from, t0, h),
    c2: add(to, t1, -h),
    to: { ...to },
  };
}

/**
 * Outward unit normal of the silhouette face `point` sits on.
 * Corner ties prefer `fallback` (usually the corridor stub).
 */
export function silhouetteNormal(point: Point, box: Rect, fallback: Point): Point {
  const left = Math.abs(point.x - box.x);
  const right = Math.abs(point.x - (box.x + box.width));
  const top = Math.abs(point.y - box.y);
  const bottom = Math.abs(point.y - (box.y + box.height));
  const m = Math.min(left, right, top, bottom);
  const ties: Point[] = [];
  if (Math.abs(left - m) < SIDE_TIE) ties.push({ x: -1, y: 0 });
  if (Math.abs(right - m) < SIDE_TIE) ties.push({ x: 1, y: 0 });
  if (Math.abs(top - m) < SIDE_TIE) ties.push({ x: 0, y: -1 });
  if (Math.abs(bottom - m) < SIDE_TIE) ties.push({ x: 0, y: 1 });
  if (ties.length === 1) return ties[0]!;
  const aligned = ties.find((t) => t.x * fallback.x + t.y * fallback.y > 0.5);
  return aligned ?? ties[0] ?? fallback;
}

function filletCubic(
  before: Point,
  elbow: Point,
  after: Point,
  inDir: Point,
  outDir: Point,
): CubicBezier {
  const r = dist(before, elbow);
  const k = CUBIC_ARC_KAPPA;
  return {
    from: { ...before },
    c1: add(before, inDir, r * k),
    c2: add(after, outDir, -r * k),
    to: { ...after },
  };
}

function tryCubic(
  from: Point,
  to: Point,
  t0: Point,
  t1: Point,
  handle: number,
  obstacles: Rect[],
): CubicBezier | undefined {
  const scales = [1, 0.72, 0.48, 0.28];
  for (const s of scales) {
    const cubic = tangentCubic(from, to, t0, t1, handle * s);
    if (!cubicHitsObstacles(cubic, obstacles)) return cubic;
  }
  return undefined;
}

function allocateRadii(inLens: number[], outLens: number[], desired: number): number[] {
  const n = inLens.length;
  const r = inLens.map((inLen, i) => {
    const first = i === 0;
    const last = i === n - 1;
    const inFrac = first ? 0.94 : last ? 0.88 : 0.6;
    const outFrac = last ? 0.94 : first ? 0.88 : 0.6;
    return Math.max(0, Math.min(desired, inLen * inFrac, outLens[i]! * outFrac));
  });
  for (let i = 0; i < n - 1; i++) {
    const budget = outLens[i]! * 0.96;
    const used = r[i]! + r[i + 1]!;
    if (used > budget && used > 1e-6) {
      const s = budget / used;
      r[i]! *= s;
      r[i + 1]! *= s;
    }
  }
  return r;
}

/**
 * Keep the orthogonal channel, but replace every elbow (including the port
 * stubs) with a cubic section. Short first/last stubs merge into the start/end
 * ease so the stroke does not leave the node as a hard 90° nick.
 */
function filletCorridor(
  pts: Point[],
  t0: Point,
  t1: Point,
  profile: OrganicProfile,
  obstacles: Rect[],
): CubicBezier[] {
  const last = pts.length - 1;
  if (pts.length === 2) {
    const cubic =
      tryCubic(pts[0]!, pts[1]!, t0, t1, spanHandle(pts[0]!, pts[1]!, profile), obstacles) ??
      tangentCubic(pts[0]!, pts[1]!, t0, t1, spanHandle(pts[0]!, pts[1]!, profile));
    return [cubic];
  }

  const inLens: number[] = [];
  const outLens: number[] = [];
  for (let i = 1; i < last; i++) {
    inLens.push(dist(pts[i - 1]!, pts[i]!));
    outLens.push(dist(pts[i]!, pts[i + 1]!));
  }
  const radii = allocateRadii(inLens, outLens, profile.filletMax);
  const cubics: CubicBezier[] = [];
  let cursor = pts[0]!;
  let cursorTan = t0;
  const elbowCount = inLens.length;

  const shrinkFillet = (
    a: Point,
    b: Point,
    c: Point,
    inDir: Point,
    outDir: Point,
    desired: number,
  ): { before: Point; after: Point; r: number } => {
    const cap = Math.min(dist(a, b) * 0.9, dist(b, c) * 0.9);
    const floor = Math.min(profile.filletMin, cap);
    let r = Math.min(Math.max(desired, floor), cap);
    for (let k = 0; k < 6; k++) {
      const before = add(b, inDir, -r);
      const after = add(b, outDir, r);
      if (!cubicHitsObstacles(filletCubic(before, b, after, inDir, outDir), obstacles)) {
        return { before, after, r };
      }
      r *= 0.62;
    }
    const fallback = Math.max(floor, Math.min(cap, profile.filletMin));
    return {
      before: add(b, inDir, -fallback),
      after: add(b, outDir, fallback),
      r: fallback,
    };
  };

  for (let k = 0; k < elbowCount; k++) {
    const b = pts[k + 1]!;
    const c = pts[k + 2]!;
    const inDir = dir(pts[k]!, b);
    const outDir = dir(b, c);
    const isFirst = k === 0;
    const isLast = k === elbowCount - 1;
    const { before, after, r } = shrinkFillet(pts[k]!, b, c, inDir, outDir, radii[k]!);

    if (isFirst && isLast) {
      const swoop = tryCubic(
        cursor,
        pts[last]!,
        cursorTan,
        t1,
        spanHandle(cursor, pts[last]!, profile),
        obstacles,
      );
      if (swoop) return [swoop];
      const toBefore =
        dist(cursor, before) > 2
          ? tryCubic(
              cursor,
              before,
              cursorTan,
              inDir,
              spanHandle(cursor, before, profile),
              obstacles,
            )
          : undefined;
      if (toBefore) cubics.push(toBefore);
      cubics.push(filletCubic(toBefore?.to ?? cursor, b, after, inDir, outDir));
      const tail =
        tryCubic(
          after,
          pts[last]!,
          outDir,
          t1,
          spanHandle(after, pts[last]!, profile),
          obstacles,
        ) ?? tangentCubic(after, pts[last]!, outDir, t1, spanHandle(after, pts[last]!, profile));
      cubics.push(tail);
      return cubics;
    }

    if (isFirst) {
      if (elbowCount === 1) {
        const swoop = tryCubic(
          cursor,
          after,
          cursorTan,
          outDir,
          spanHandle(cursor, after, profile),
          obstacles,
        );
        if (swoop) {
          cubics.push(swoop);
          cursor = after;
          cursorTan = outDir;
          continue;
        }
      }
      if (dist(cursor, before) > 2) {
        cubics.push(
          tryCubic(
            cursor,
            before,
            cursorTan,
            inDir,
            spanHandle(cursor, before, profile),
            obstacles,
          ) ?? tangentCubic(cursor, before, cursorTan, inDir, Math.max(10, r)),
        );
      }
      cubics.push(filletCubic(cubics[cubics.length - 1]?.to ?? before, b, after, inDir, outDir));
      cursor = after;
      cursorTan = outDir;
      continue;
    }

    if (isLast) {
      if (elbowCount === 1) {
        const swoop = tryCubic(
          cursor,
          pts[last]!,
          cursorTan,
          t1,
          spanHandle(cursor, pts[last]!, profile),
          obstacles,
        );
        if (swoop) {
          cubics.push(swoop);
          return cubics;
        }
      }
      if (dist(cursor, before) > 2) {
        cubics.push(
          tryCubic(
            cursor,
            before,
            cursorTan,
            inDir,
            spanHandle(cursor, before, profile),
            obstacles,
          ) ?? tangentCubic(cursor, before, cursorTan, inDir, Math.max(10, r)),
        );
      }
      cubics.push(filletCubic(cubics[cubics.length - 1]?.to ?? before, b, after, inDir, outDir));
      cubics.push(
        tryCubic(
          after,
          pts[last]!,
          outDir,
          t1,
          spanHandle(after, pts[last]!, profile),
          obstacles,
        ) ?? tangentCubic(after, pts[last]!, outDir, t1, spanHandle(after, pts[last]!, profile)),
      );
      return cubics;
    }

    if (dist(cursor, before) > 2) {
      cubics.push(
        tryCubic(
          cursor,
          before,
          cursorTan,
          inDir,
          spanHandle(cursor, before, profile),
          obstacles,
        ) ??
          tangentCubic(cursor, before, cursorTan, inDir, Math.max(8, dist(cursor, before) * 0.35)),
      );
    }
    cubics.push(filletCubic(cubics[cubics.length - 1]?.to ?? before, b, after, inDir, outDir));
    cursor = after;
    cursorTan = outDir;
  }

  if (dist(cursor, pts[last]!) > 1) {
    cubics.push(
      tryCubic(
        cursor,
        pts[last]!,
        cursorTan,
        t1,
        spanHandle(cursor, pts[last]!, profile),
        obstacles,
      ) ?? tangentCubic(cursor, pts[last]!, cursorTan, t1, spanHandle(cursor, pts[last]!, profile)),
    );
  }
  return cubics;
}

/**
 * Obstacle-aware cubic spline along an orthogonal channel.
 *
 * Clear line of sight → one cubic with port-normal handles (ease out of the
 * source, ease into the target). Otherwise each corridor elbow becomes its own
 * curved section — not a sharp Manhattan stair.
 */
export function fitOrganicRoute(
  points: Point[],
  obstacles: Rect[],
  options: OrganicRouteOptions = {},
): CubicBezier[] {
  const pts = collapseColinear(points);
  if (pts.length < 2) return [];
  const profile = profileFor(options.mode, options.cornerRadius);
  const t0 = options.t0 ?? dir(pts[0]!, pts[1]!);
  const t1 = options.t1 ?? dir(pts[pts.length - 2]!, pts[pts.length - 1]!);

  if (pts.length === 2) {
    return filletCorridor(pts, t0, t1, profile, obstacles);
  }

  const simple = tryCubic(
    pts[0]!,
    pts[pts.length - 1]!,
    t0,
    t1,
    spanHandle(pts[0]!, pts[pts.length - 1]!, profile),
    obstacles,
  );
  if (simple) return [simple];

  return filletCorridor(pts, t0, t1, profile, obstacles);
}

/** Smart-bezier: organic cubics with the bezier handle profile. */
export function fitSmartBezier(
  points: Point[],
  obstacles: Rect[],
  ports?: { t0?: Point; t1?: Point },
): CubicBezier[] {
  return fitOrganicRoute(points, obstacles, { mode: "bezier", t0: ports?.t0, t1: ports?.t1 });
}

export function cubicsToPath(cubics: CubicBezier[]): string {
  if (!cubics.length) return "";
  const first = cubics[0]!;
  let d = `M ${first.from.x} ${first.from.y}`;
  for (const c of cubics) {
    d += ` C ${c.c1.x} ${c.c1.y} ${c.c2.x} ${c.c2.y} ${c.to.x} ${c.to.y}`;
  }
  return d;
}

function perpendicularOffset(a: Point, b: Point, amount: number): Point {
  const t = dir(a, b);
  return { x: -t.y * amount, y: t.x * amount };
}

function nearlyCoincident(a0: Point, a1: Point, b0: Point, b1: Point): boolean {
  const ab = dist(a0, a1) || 1;
  const midA = lerp(a0, a1, 0.5);
  const midB = lerp(b0, b1, 0.5);
  const t = dir(a0, a1);
  const delta = { x: midB.x - midA.x, y: midB.y - midA.y };
  const perp = Math.abs(-t.y * delta.x + t.x * delta.y);
  const along = (delta.x * t.x + delta.y * t.y) / ab;
  return perp < PARALLEL_MERGE && Math.abs(along) < 0.35 && Math.abs(dist(b0, b1) - ab) / ab < 0.25;
}

/**
 * Separate overlapping 2-point strokes with a shallow mid-path offset so
 * ports stay attached. `separate` (default) offsets; `shared` leaves them.
 */
function offsetParallelStraights(
  refined: RefinedRoute[],
  parallel: "separate" | "shared" | undefined,
): RefinedRoute[] {
  if (parallel === "shared") return refined;
  const pairs = refined.map((e, index) => ({ e, index })).filter(({ e }) => e.points.length === 2);
  const used = new Set<string>();
  for (const { e, index } of pairs) {
    if (used.has(e.edgeId)) continue;
    const a0 = e.points[0]!;
    const a1 = e.points[1]!;
    const group = [{ e, index }];
    for (const other of pairs) {
      if (other.e.edgeId === e.edgeId || used.has(other.e.edgeId)) continue;
      if (nearlyCoincident(a0, a1, other.e.points[0]!, other.e.points[1]!)) {
        group.push(other);
      }
    }
    if (group.length < 2) continue;
    group.sort((x, y) => x.e.edgeId.localeCompare(y.e.edgeId));
    for (const member of group) used.add(member.e.edgeId);
    const n = group.length;
    for (let i = 0; i < n; i++) {
      const member = group[i]!;
      const from = member.e.points[0]!;
      const to = member.e.points[1]!;
      const amount = (i - (n - 1) / 2) * PARALLEL_GAP;
      if (Math.abs(amount) < 0.5) continue;
      const mid = lerp(from, to, 0.5);
      const bump = perpendicularOffset(from, to, amount);
      member.e.points = [from, { x: mid.x + bump.x, y: mid.y + bump.y }, to];
    }
  }
  return refined;
}

function copyPoints(points: Point[]): Point[] {
  return points.map((p) => ({ x: p.x, y: p.y }));
}

function portTangents(
  edge: RouteStyleEdge,
  obstacles: RouteStyleObstacle[],
  pts: Point[],
): { t0: Point; t1: Point } {
  const stub0 = dir(pts[0]!, pts[1]!);
  const stub1 = dir(pts[pts.length - 2]!, pts[pts.length - 1]!);
  const fromBox = obstacles.find((o) => o.id === edge.fromId)?.bounds;
  const toBox = obstacles.find((o) => o.id === edge.toId)?.bounds;
  const t0 = fromBox ? silhouetteNormal(pts[0]!, fromBox, stub0) : stub0;
  const outwardEnd = toBox
    ? silhouetteNormal(pts[pts.length - 1]!, toBox, { x: -stub1.x, y: -stub1.y })
    : { x: -stub1.x, y: -stub1.y };
  const t1 = { x: -outwardEnd.x, y: -outwardEnd.y };
  return { t0, t1 };
}

function hitBoxesFor(edge: RouteStyleEdge, all: RouteStyleObstacle[]): Rect[] {
  return all.map((o) => {
    if (o.id === edge.fromId || o.id === edge.toId) return inflate(o.bounds, 0);
    return inflate(o.bounds, OBSTACLE_PAD);
  });
}

function organicMode(mode: RouteMode | undefined): "metro" | "rounded" | "bezier" | undefined {
  if (mode === "rounded" || mode === "bezier" || mode === "metro") return mode;
  if (mode == null) return "metro";
  return undefined;
}

/**
 * Refine laid-out orthogonal polylines for the requested route mode.
 * `orthogonal` stays a sharp polyline. Metro / rounded / bezier become organic
 * cubics (port ease + curved avoidance). Straight still shortcuts the corridor.
 */
export function refineRouteStyle(
  edges: RouteStyleEdge[],
  obstacles: RouteStyleObstacle[],
  mode: RouteMode | undefined,
  parallel?: "separate" | "shared",
  cornerRadius?: number,
): RefinedRoute[] {
  if (mode === "orthogonal") {
    return edges.map((e) => ({ edgeId: e.edgeId, points: copyPoints(e.points) }));
  }

  if (mode === "straight") {
    const refined = edges.map((edge) => {
      if (edge.fromId === edge.toId || edge.points.length < 2) {
        return { edgeId: edge.edgeId, points: copyPoints(edge.points) };
      }
      return {
        edgeId: edge.edgeId,
        points: shortcutStraight(edge.points, obstaclesForEdge(edge, obstacles)),
      };
    });
    return offsetParallelStraights(refined, parallel);
  }

  const kind = organicMode(mode) ?? "metro";
  return edges.map((edge) => {
    if (edge.points.length < 2 || edge.fromId === edge.toId) {
      return { edgeId: edge.edgeId, points: copyPoints(edge.points) };
    }
    const channel = collapseColinear(edge.points);
    const { t0, t1 } = portTangents(edge, obstacles, channel);
    const cubics = fitOrganicRoute(channel, hitBoxesFor(edge, obstacles), {
      mode: kind,
      t0,
      t1,
      cornerRadius,
    });
    const sampled = sampleCubics(cubics);
    return {
      edgeId: edge.edgeId,
      // Keep the orthogonal channel for crossings/labels; bezier samples follow the curve.
      points: kind === "bezier" && sampled.length >= 2 ? sampled : channel,
      cubics,
    };
  });
}
