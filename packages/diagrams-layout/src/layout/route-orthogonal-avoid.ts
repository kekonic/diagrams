import type { Point, Rect } from "@kekonic/diagrams-core";

const EPS = 0.5;
/** Keep corridors off node silhouettes so edges do not run along a face. */
const SIDE_STANDOFF = 16;

function inflate(b: Rect, pad: number): Rect {
  return {
    x: b.x - pad,
    y: b.y - pad,
    width: b.width + pad * 2,
    height: b.height + pad * 2,
  };
}

function centerOf(b: Rect): Point {
  return { x: b.x + b.width / 2, y: b.y + b.height / 2 };
}

/** Orthogonal segment vs inflated axis-aligned rect (open interior). */
export function segmentHitsRect(a: Point, b: Point, box: Rect): boolean {
  const minX = Math.min(a.x, b.x);
  const maxX = Math.max(a.x, b.x);
  const minY = Math.min(a.y, b.y);
  const maxY = Math.max(a.y, b.y);
  const L = box.x;
  const R = box.x + box.width;
  const T = box.y;
  const B = box.y + box.height;

  if (Math.abs(a.x - b.x) < EPS) {
    const x = a.x;
    if (x <= L + EPS || x >= R - EPS) return false;
    return maxY > T + EPS && minY < B - EPS;
  }
  if (Math.abs(a.y - b.y) < EPS) {
    const y = a.y;
    if (y <= T + EPS || y >= B - EPS) return false;
    return maxX > L + EPS && minX < R - EPS;
  }
  return false;
}

function rangesOverlap(a0: number, a1: number, b0: number, b1: number): boolean {
  return Math.min(a0, a1) <= Math.max(b0, b1) && Math.max(a0, a1) >= Math.min(b0, b1);
}

/**
 * True when an orthogonal segment runs along a box face (parallel hug).
 * Short stubs into an attach face are allowed; long slides along a side are not.
 */
export function segmentHugsRect(
  a: Point,
  b: Point,
  box: Rect,
  standoff = SIDE_STANDOFF,
  allowShortStub = false,
): boolean {
  const minX = Math.min(a.x, b.x);
  const maxX = Math.max(a.x, b.x);
  const minY = Math.min(a.y, b.y);
  const maxY = Math.max(a.y, b.y);
  const L = box.x;
  const R = box.x + box.width;
  const T = box.y;
  const B = box.y + box.height;
  const len = Math.abs(b.x - a.x) + Math.abs(b.y - a.y);

  if (Math.abs(a.x - b.x) < EPS) {
    const x = a.x;
    const alongLeft = Math.abs(x - L) <= standoff;
    const alongRight = Math.abs(x - R) <= standoff;
    if (!(alongLeft || alongRight)) return false;
    if (!rangesOverlap(minY, maxY, T, B)) return false;
    if (allowShortStub && len <= standoff * 1.5) return false;
    const overlap = Math.min(maxY, B) - Math.max(minY, T);
    return overlap > standoff * 0.5;
  }
  if (Math.abs(a.y - b.y) < EPS) {
    const y = a.y;
    const alongTop = Math.abs(y - T) <= standoff;
    const alongBottom = Math.abs(y - B) <= standoff;
    if (!(alongTop || alongBottom)) return false;
    if (!rangesOverlap(minX, maxX, L, R)) return false;
    if (allowShortStub && len <= standoff * 1.5) return false;
    const overlap = Math.min(maxX, R) - Math.max(minX, L);
    return overlap > standoff * 0.5;
  }
  return false;
}

function pathLength(points: Point[]): number {
  let len = 0;
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1]!;
    const b = points[i]!;
    len += Math.abs(b.x - a.x) + Math.abs(b.y - a.y);
  }
  return len;
}

function dedupe(points: Point[]): Point[] {
  const out: Point[] = [];
  for (const p of points) {
    const prev = out[out.length - 1];
    if (prev && Math.abs(prev.x - p.x) < EPS && Math.abs(prev.y - p.y) < EPS) continue;
    out.push(p);
  }
  return out;
}

/**
 * Collapse colinear bends, but keep the egress/ingress stubs so a later
 * corridor on the same line cannot erase the outward nudge and cut through
 * the source/target box.
 *
 * Final layout polish uses `collapseColinearPoints` in polish-edges.ts (no stub
 * preservation) after endpoints are frozen — different stage, different rule.
 */
function collapseColinear(points: Point[]): Point[] {
  if (points.length < 3) return points;
  const out: Point[] = [points[0]!];
  for (let i = 1; i < points.length - 1; i++) {
    const keepStub = i === 1 || i === points.length - 2;
    if (keepStub) {
      out.push(points[i]!);
      continue;
    }
    const a = out[out.length - 1]!;
    const b = points[i]!;
    const c = points[i + 1]!;
    const vertical = Math.abs(a.x - b.x) < EPS && Math.abs(b.x - c.x) < EPS;
    const horizontal = Math.abs(a.y - b.y) < EPS && Math.abs(b.y - c.y) < EPS;
    if (vertical || horizontal) continue;
    out.push(b);
  }
  out.push(points[points.length - 1]!);
  return dedupe(out);
}

type Side = "N" | "S" | "E" | "W";

function attach(b: Rect, side: Side, t: number): Point {
  const clamped = Math.min(0.85, Math.max(0.15, t));
  switch (side) {
    case "N":
      return { x: b.x + b.width * clamped, y: b.y };
    case "S":
      return { x: b.x + b.width * clamped, y: b.y + b.height };
    case "E":
      return { x: b.x + b.width, y: b.y + b.height * clamped };
    case "W":
      return { x: b.x, y: b.y + b.height * clamped };
  }
}

/** Which face a point sits on (within EPS), if any. */
function sideOfPoint(p: Point, b: Rect): Side | null {
  if (Math.abs(p.y - b.y) < EPS && p.x >= b.x - EPS && p.x <= b.x + b.width + EPS) return "N";
  if (Math.abs(p.y - (b.y + b.height)) < EPS && p.x >= b.x - EPS && p.x <= b.x + b.width + EPS) {
    return "S";
  }
  if (Math.abs(p.x - (b.x + b.width)) < EPS && p.y >= b.y - EPS && p.y <= b.y + b.height + EPS) {
    return "E";
  }
  if (Math.abs(p.x - b.x) < EPS && p.y >= b.y - EPS && p.y <= b.y + b.height + EPS) return "W";
  return null;
}

/**
 * Prefer the geometrically primary faces; heavily punish U-turns that attach on
 * the far side after wrapping under/around the target (common arranged-mode fail).
 */
function facePreferencePenalty(
  from: Rect,
  to: Rect,
  points: Point[],
  preferred: [Side, Side],
): number {
  const start = sideOfPoint(points[0]!, from);
  const end = sideOfPoint(points[points.length - 1]!, to);
  let penalty = 0;
  if (start && start !== preferred[0]) penalty += 2_400;
  if (end && end !== preferred[1]) penalty += 9_000;
  const [fs, ts] = preferred;
  // Downward flow attaching under the target after a bottom rail looks worst.
  if (fs === "S" && ts === "N" && end === "S") penalty += 18_000;
  if (fs === "S" && ts === "N" && (end === "E" || end === "W")) penalty += 12_000;
  if (fs === "N" && ts === "S" && end === "N") penalty += 18_000;
  if (fs === "E" && ts === "W" && end === "E") penalty += 18_000;
  if (fs === "W" && ts === "E" && end === "W") penalty += 18_000;
  return penalty;
}

/** Point outside the attach face — corridors route through here, not on the silhouette. */
function egress(b: Rect, side: Side, t: number, standoff: number): Point {
  const p = attach(b, side, t);
  switch (side) {
    case "E":
      return { x: p.x + standoff, y: p.y };
    case "W":
      return { x: p.x - standoff, y: p.y };
    case "S":
      return { x: p.x, y: p.y + standoff };
    case "N":
      return { x: p.x, y: p.y - standoff };
  }
}

function sidePairs(from: Rect, to: Rect): Array<[Side, Side]> {
  const primary = preferredSidePair(from, to);
  const eastWest = to.x - (from.x + from.width);
  const westEast = from.x - (to.x + to.width);
  const southNorth = to.y - (from.y + from.height);
  const northSouth = from.y - (to.y + to.height);
  const secondary: [Side, Side] =
    primary[0] === "E" || primary[0] === "W"
      ? southNorth >= northSouth
        ? ["S", "N"]
        : ["N", "S"]
      : eastWest >= westEast
        ? ["E", "W"]
        : ["W", "E"];
  return [primary, secondary, ["E", "W"], ["W", "E"], ["S", "N"], ["N", "S"]];
}

/** Primary attach faces — shared with arranged fan-slot grouping. */
export function preferredSidePair(from: Rect, to: Rect): [Side, Side] {
  const eastWest = to.x - (from.x + from.width);
  const westEast = from.x - (to.x + to.width);
  const southNorth = to.y - (from.y + from.height);
  const northSouth = from.y - (to.y + to.height);
  const hClear = Math.max(eastWest, westEast);
  const vClear = Math.max(southNorth, northSouth);
  const separatedH = hClear > 8;
  const separatedV = vClear > 8;

  if (separatedH && (!separatedV || hClear >= vClear * 0.35 || hClear > 48)) {
    // Clear lateral gutter (column layouts) — prefer E/W even when |dy| is larger,
    // otherwise routes climb the mid column and escape around the whole platform.
    return eastWest >= westEast ? ["E", "W"] : ["W", "E"];
  }
  if (separatedV) {
    return southNorth >= northSouth ? ["S", "N"] : ["N", "S"];
  }
  const fc = centerOf(from);
  const tc = centerOf(to);
  const dx = tc.x - fc.x;
  const dy = tc.y - fc.y;
  return Math.abs(dx) >= Math.abs(dy)
    ? dx >= 0
      ? ["E", "W"]
      : ["W", "E"]
    : dy >= 0
      ? ["S", "N"]
      : ["N", "S"];
}

/** Clearance between facing sides; null when the pair does not face. */
function facingClearance(from: Rect, to: Rect, fs: Side, ts: Side): number | null {
  if (fs === "S" && ts === "N") return to.y - (from.y + from.height);
  if (fs === "N" && ts === "S") return from.y - (to.y + to.height);
  if (fs === "E" && ts === "W") return to.x - (from.x + from.width);
  if (fs === "W" && ts === "E") return from.x - (to.x + to.width);
  return null;
}

/** True when the boxes overlap on the axis orthogonal to the facing sides. */
function facesOverlap(from: Rect, to: Rect, fs: Side): boolean {
  if (fs === "S" || fs === "N") {
    return rangesOverlap(from.x, from.x + from.width, to.x, to.x + to.width);
  }
  return rangesOverlap(from.y, from.y + from.height, to.y, to.y + to.height);
}

/**
 * Pack/stack cells leave ~16px gaps, but the default egress turn is ~36px.
 * When neighbors face across a tight clear gap, route in the interstitial
 * channel instead of overshooting into the target and escaping around the hull.
 */
function tryTightNeighborRoute(
  from: Rect,
  to: Rect,
  obstacles: Rect[],
  pad: number,
  tFrom: number,
  tTo: number,
  turn: number,
): Point[] | null {
  const [fs, ts] = sidePairs(from, to)[0]!;
  const gap = facingClearance(from, to, fs, ts);
  if (gap == null || gap <= 0 || gap >= turn * 2) return null;
  if (!facesOverlap(from, to, fs)) return null;

  const aAttach = attach(from, fs, tFrom);
  const bAttach = attach(to, ts, tTo);
  const half = gap / 2;
  let mid: Point[];
  if (fs === "S" || fs === "N") {
    const y = fs === "S" ? from.y + from.height + half : from.y - half;
    mid = [
      { x: aAttach.x, y },
      { x: bAttach.x, y },
    ];
  } else {
    const x = fs === "E" ? from.x + from.width + half : from.x - half;
    mid = [
      { x, y: aAttach.y },
      { x, y: bAttach.y },
    ];
  }

  const points = collapseColinear(dedupe([aAttach, ...mid, bAttach]));
  // Keep obstacle padding inside the gap so a clear pack channel stays usable.
  const channelPad = Math.min(pad, Math.max(0, gap / 4 - 1));
  const inflated = obstacles.map((b) => inflate(b, channelPad));
  if (countHits(points, inflated, [from, to]) > 0) return null;
  return points;
}

function turnForPair(baseTurn: number, gap: number | null): number {
  if (gap == null || gap <= 0) return baseTurn;
  // Stay inside the facing channel; leave a little slack so stubs do not meet.
  return Math.min(baseTurn, Math.max(2, gap / 2 - 1));
}

function hvPath(a: Point, b: Point): Point[] {
  if (Math.abs(a.y - b.y) < EPS || Math.abs(a.x - b.x) < EPS) return [a, b];
  return [a, { x: b.x, y: a.y }, b];
}

function vhPath(a: Point, b: Point): Point[] {
  if (Math.abs(a.y - b.y) < EPS || Math.abs(a.x - b.x) < EPS) return [a, b];
  return [a, { x: a.x, y: b.y }, b];
}

function unionBounds(rects: Rect[]): Rect | null {
  if (rects.length === 0) return null;
  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity;
  for (const b of rects) {
    minX = Math.min(minX, b.x);
    minY = Math.min(minY, b.y);
    maxX = Math.max(maxX, b.x + b.width);
    maxY = Math.max(maxY, b.y + b.height);
  }
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

/**
 * Rectilinear route between two node boxes that prefers corridors clear of
 * other node footprints. Candidate channels only (not a grid/A* router).
 */
export function routeOrthogonalAvoiding(
  from: Rect,
  to: Rect,
  obstacles: Rect[],
  pad: number,
  tFrom = 0.5,
  tTo = 0.5,
): Point[] {
  const pads = [pad, Math.min(pad, 12), 6, 2].filter((p, i, arr) => arr.indexOf(p) === i);
  let fallback: Point[] | null = null;
  for (const tryPad of pads) {
    const result = routeWithPad(from, to, obstacles, tryPad, tFrom, tTo);
    if (result.clear) return result.points;
    fallback ??= result.points;
  }
  return fallback ?? [centerOf(from), centerOf(to)];
}

type Cand = { raw: Point[]; rank: number };

function routeWithPad(
  from: Rect,
  to: Rect,
  obstacles: Rect[],
  pad: number,
  tFrom: number,
  tTo: number,
): { points: Point[]; clear: boolean } {
  const standoff = Math.max(SIDE_STANDOFF, pad);
  // Turn farther out than the attach stub so first corridors do not hug the face.
  const turn = Math.max(standoff * 2.25, pad + 14);
  const tight = tryTightNeighborRoute(from, to, obstacles, pad, tFrom, tTo, turn);
  if (tight) return { points: tight, clear: true };

  const hugReach = Math.max(SIDE_STANDOFF, turn * 0.75);
  const inflated = obstacles.map((b) => inflate(b, pad));
  const endpointBoxes = [from, to];
  const candidates: Cand[] = [];
  const pairs = sidePairs(from, to);
  const preferred = pairs[0]!;

  for (let rank = 0; rank < pairs.length; rank++) {
    const [fs, ts] = pairs[rank]!;
    const pairTurn = turnForPair(turn, facingClearance(from, to, fs, ts));
    const aAttach = attach(from, fs, tFrom);
    const bAttach = attach(to, ts, tTo);
    const a = egress(from, fs, tFrom, pairTurn);
    const b = egress(to, ts, tTo, pairTurn);

    for (const mid of [hvPath(a, b), vhPath(a, b)]) {
      candidates.push({ raw: [aAttach, ...mid, bAttach], rank });
    }

    const midX = (a.x + b.x) / 2;
    const midY = (a.y + b.y) / 2;
    candidates.push({
      raw: [aAttach, a, { x: midX, y: a.y }, { x: midX, y: b.y }, b, bAttach],
      rank,
    });
    candidates.push({
      raw: [aAttach, a, { x: a.x, y: midY }, { x: b.x, y: midY }, b, bAttach],
      rank,
    });
  }

  // When a pack sibling sits in the facing gutter, hull rails tour the whole local
  // AABB. Prefer short lanes just above/below the blockers in that channel.
  pushFacingChannelDetours(candidates, from, to, inflated, pad, tFrom, tTo, preferred);

  // Local hull only — wrapping the whole diagram makes "outside" rails cut through
  // other arrange bands. Endpoint boxes are included so rails clear both faces.
  const local = localObstacles(from, to, inflated);
  const hull = unionBounds([...local, inflate(from, pad), inflate(to, pad)]);
  if (hull) {
    const clear = Math.max(pad, turn);
    const left = hull.x - clear;
    const right = hull.x + hull.width + clear;
    const top = hull.y - clear;
    const bottom = hull.y + hull.height + clear;
    // Prefer rails that land on the geometrically preferred entry face.
    const entrySides: Side[] = [
      preferred[1],
      ...(["N", "S", "E", "W"] as Side[]).filter((s) => s !== preferred[1]),
    ];
    for (const ts of entrySides) {
      const bAttach = attach(to, ts, tTo);
      const railRank = ts === preferred[1] ? 2 : 5;
      pushRailEscapes(
        candidates,
        from,
        tFrom,
        turn,
        pad,
        left,
        right,
        top,
        bottom,
        bAttach,
        railRank,
      );
    }
  }

  let bestClear: Point[] | null = null;
  let bestClearScore = Infinity;
  let bestAny: Point[] = candidates[0]?.raw ?? [centerOf(from), centerOf(to)];
  let bestAnyScore = Infinity;

  for (const cand of candidates) {
    const points = collapseColinear(dedupe(cand.raw));
    if (points.length < 2) continue;
    const len = pathLength(points);
    const hits = countHits(points, inflated, endpointBoxes);
    // Strong hug reach on endpoints (no self-silhouette slides); lighter on obstacles
    // so narrow interstitial channels between stacked cards stay usable.
    const hugs =
      countHugs(points, endpointBoxes, hugReach) + countHugs(points, obstacles, SIDE_STANDOFF);
    const facePenalty = facePreferencePenalty(from, to, points, preferred);
    // Hits must dominate: in a dense pack every detour lightly hugs something, and a
    // short through-node path used to beat a clear perimeter route on hug+length alone.
    const score = hits * 100_000 + hugs * 140 + cand.rank * 320 + facePenalty + len;
    if (score < bestAnyScore) {
      bestAnyScore = score;
      bestAny = points;
    }
    // Accept clear paths even with light hugs — hugs only rank among hit-free routes.
    if (hits === 0 && score < bestClearScore) {
      bestClearScore = score;
      bestClear = points;
    }
  }

  return { points: bestClear ?? bestAny, clear: bestClear != null };
}

/**
 * Short detours that skim above/below (or beside) blockers in the facing
 * channel — avoids full-hull perimeter tours when only a pack sibling blocks.
 */
function pushFacingChannelDetours(
  candidates: Cand[],
  from: Rect,
  to: Rect,
  inflated: Rect[],
  pad: number,
  tFrom: number,
  tTo: number,
  preferred: [Side, Side],
): void {
  const [fs, ts] = preferred;
  const clear = Math.max(pad, SIDE_STANDOFF);
  const bAttach = attach(to, ts, tTo);
  const b = egress(to, ts, tTo, clear);

  if ((fs === "E" && ts === "W") || (fs === "W" && ts === "E")) {
    const x0 = fs === "E" ? from.x + from.width : to.x + to.width;
    const x1 = fs === "E" ? to.x : from.x;
    if (x1 <= x0 + 1) return;
    // Only same-row (or target-row) siblings in the gutter — not cards that merely
    // sit in the vertical span between offset endpoints (those inflate topLane
    // to the far side of the column and recreate perimeter tours).
    const blockers = inflated.filter(
      (box) =>
        box.x + box.width > x0 - 1 &&
        box.x < x1 - 1 &&
        (rangesOverlap(box.y, box.y + box.height, from.y, from.y + from.height) ||
          rangesOverlap(box.y, box.y + box.height, to.y, to.y + to.height)),
    );
    if (blockers.length === 0) return;
    const topLane = Math.min(...blockers.map((box) => box.y)) - clear;
    const bottomLane = Math.max(...blockers.map((box) => box.y + box.height)) + clear;
    const aN = attach(from, "N", tFrom);
    const aS = attach(from, "S", tFrom);
    candidates.push({
      raw: [aN, { x: aN.x, y: topLane }, { x: b.x, y: topLane }, b, bAttach],
      rank: 1,
    });
    candidates.push({
      raw: [aS, { x: aS.x, y: bottomLane }, { x: b.x, y: bottomLane }, b, bAttach],
      rank: 1,
    });
    // Preferred-face exit with a jog into the free lane (when the stub is clear).
    const aF = attach(from, fs, tFrom);
    const jogX =
      fs === "E" ? Math.min(aF.x + clear, (x0 + x1) / 2) : Math.max(aF.x - clear, (x0 + x1) / 2);
    candidates.push({
      raw: [aF, { x: jogX, y: aF.y }, { x: jogX, y: topLane }, { x: b.x, y: topLane }, b, bAttach],
      rank: 0,
    });
    candidates.push({
      raw: [
        aF,
        { x: jogX, y: aF.y },
        { x: jogX, y: bottomLane },
        { x: b.x, y: bottomLane },
        b,
        bAttach,
      ],
      rank: 0,
    });
    return;
  }

  if ((fs === "S" && ts === "N") || (fs === "N" && ts === "S")) {
    const y0 = fs === "S" ? from.y + from.height : to.y + to.height;
    const y1 = fs === "S" ? to.y : from.y;
    if (y1 <= y0 + 1) return;
    const blockers = inflated.filter(
      (box) =>
        box.y + box.height > y0 - 1 &&
        box.y < y1 - 1 &&
        (rangesOverlap(box.x, box.x + box.width, from.x, from.x + from.width) ||
          rangesOverlap(box.x, box.x + box.width, to.x, to.x + to.width)),
    );
    if (blockers.length === 0) return;
    const leftLane = Math.min(...blockers.map((box) => box.x)) - clear;
    const rightLane = Math.max(...blockers.map((box) => box.x + box.width)) + clear;
    const aW = attach(from, "W", tFrom);
    const aE = attach(from, "E", tFrom);
    candidates.push({
      raw: [aW, { x: leftLane, y: aW.y }, { x: leftLane, y: b.y }, b, bAttach],
      rank: 1,
    });
    candidates.push({
      raw: [aE, { x: rightLane, y: aE.y }, { x: rightLane, y: b.y }, b, bAttach],
      rank: 1,
    });
  }
}

/**
 * Obstacles near the endpoints — generous AABB so pack siblings beside the
 * straight span still shape the local hull (and its outside rails).
 */
function localObstacles(from: Rect, to: Rect, inflated: Rect[], margin = 160): Rect[] {
  const x0 = Math.min(from.x, to.x) - margin;
  const y0 = Math.min(from.y, to.y) - margin;
  const x1 = Math.max(from.x + from.width, to.x + to.width) + margin;
  const y1 = Math.max(from.y + from.height, to.y + to.height) + margin;
  return inflated.filter(
    (box) => !(box.x + box.width < x0 || box.x > x1 || box.y + box.height < y0 || box.y > y1),
  );
}

/** Ortho routes that ride the outside of a local hull without mid-pack cuts. */
function pushRailEscapes(
  candidates: Cand[],
  from: Rect,
  tFrom: number,
  turn: number,
  pad: number,
  left: number,
  right: number,
  top: number,
  bottom: number,
  bAttach: Point,
  rank = 3,
): void {
  const aN = attach(from, "N", tFrom);
  const aS = attach(from, "S", tFrom);
  const aE = attach(from, "E", tFrom);
  const aW = attach(from, "W", tFrom);
  const nTurn = Math.min(turn, Math.max(pad, aN.y - top));
  const sTurn = Math.min(turn, Math.max(pad, bottom - aS.y));
  const eTurn = Math.min(turn, Math.max(pad, right - aE.x));
  const wTurn = Math.min(turn, Math.max(pad, aW.x - left));
  const n = egress(from, "N", tFrom, nTurn);
  const s = egress(from, "S", tFrom, sTurn);
  const e = egress(from, "E", tFrom, eTurn);
  const w = egress(from, "W", tFrom, wTurn);

  // East → right rail → top/bottom → target
  candidates.push({
    raw: [aE, e, { x: right, y: e.y }, { x: right, y: top }, { x: bAttach.x, y: top }, bAttach],
    rank,
  });
  candidates.push({
    raw: [
      aE,
      e,
      { x: right, y: e.y },
      { x: right, y: bottom },
      { x: bAttach.x, y: bottom },
      bAttach,
    ],
    rank: rank + 1,
  });
  // West → left rail → top/bottom → target
  candidates.push({
    raw: [aW, w, { x: left, y: w.y }, { x: left, y: top }, { x: bAttach.x, y: top }, bAttach],
    rank,
  });
  candidates.push({
    raw: [aW, w, { x: left, y: w.y }, { x: left, y: bottom }, { x: bAttach.x, y: bottom }, bAttach],
    rank: rank + 1,
  });
  // North → top rail → left/right corner → target (avoids dropping through the pack)
  candidates.push({
    raw: [aN, n, { x: n.x, y: top }, { x: left, y: top }, { x: left, y: bAttach.y }, bAttach],
    rank,
  });
  candidates.push({
    raw: [aN, n, { x: n.x, y: top }, { x: right, y: top }, { x: right, y: bAttach.y }, bAttach],
    rank,
  });
  candidates.push({
    raw: [aN, n, { x: n.x, y: top }, { x: bAttach.x, y: top }, bAttach],
    rank: rank + 1,
  });
  // South → bottom rail → left/right corner → target
  candidates.push({
    raw: [aS, s, { x: s.x, y: bottom }, { x: left, y: bottom }, { x: left, y: bAttach.y }, bAttach],
    rank,
  });
  candidates.push({
    raw: [
      aS,
      s,
      { x: s.x, y: bottom },
      { x: right, y: bottom },
      { x: right, y: bAttach.y },
      bAttach,
    ],
    rank,
  });
  candidates.push({
    raw: [aS, s, { x: s.x, y: bottom }, { x: bAttach.x, y: bottom }, bAttach],
    rank: rank + 1,
  });
}

function countHits(points: Point[], obstacles: Rect[], endpoints: Rect[]): number {
  let n = 0;
  for (let i = 0; i < points.length - 1; i++) {
    const isStub = i === 0 || i === points.length - 2;
    for (const box of obstacles) {
      if (segmentHitsRect(points[i]!, points[i + 1]!, box)) n += 1;
    }
    // Mid segments must not cut through source/target interiors.
    if (!isStub) {
      for (const box of endpoints) {
        if (segmentHitsRect(points[i]!, points[i + 1]!, box)) n += 1;
      }
    }
  }
  return n;
}

function countHugs(points: Point[], boxes: Rect[], reach: number): number {
  let n = 0;
  for (let i = 0; i < points.length - 1; i++) {
    const isStub = i === 0 || i === points.length - 2;
    for (const box of boxes) {
      if (segmentHugsRect(points[i]!, points[i + 1]!, box, reach, isStub)) n += 1;
    }
  }
  return n;
}
