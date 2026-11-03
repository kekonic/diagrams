/**
 * Deterministic hand-drawn centerlines.
 * Open strokes keep their endpoints. Closed outlines wobble as a loop so fill
 * and stroke share one contour. Strokes shorter than two fade windows stay put.
 */

const ALGORITHM = 1;
const AMPLITUDE = 1.25;
const FADE = 24;
const SAMPLE_STEP = 6;
const MIN_LENGTH = FADE * 2;

type Point = { x: number; y: number };

type Segment =
  | { kind: "L"; from: Point; to: Point }
  | { kind: "C"; from: Point; c1: Point; c2: Point; to: Point }
  | { kind: "Q"; from: Point; c: Point; to: Point };

export function sketchOpenPath(d: string, key: string): string {
  if (!d) return d;
  const segments = parseOpenPath(d);
  const length = segments.reduce((sum, segment) => sum + segmentLength(segment), 0);
  if (length < MIN_LENGTH) return d;

  const flat = flatten(segments);
  const samples = resample(flat, SAMPLE_STEP);
  if (samples.length < 3) return d;

  const salt = `${ALGORITHM}:${key}`;
  const total = samples[samples.length - 1]!.distance;
  const moved = samples.map((sample, index) => {
    const envelope = Math.min(fade(sample.distance), fade(total - sample.distance));
    if (envelope === 0 || index === 0 || index === samples.length - 1) return sample.point;
    const normal = sampleNormal(samples, index);
    const magnitude = AMPLITUDE * envelope * noise(salt, sample.distance);
    return {
      x: sample.point.x + normal.x * magnitude,
      y: sample.point.y + normal.y * magnitude,
    };
  });
  const first = segments[0]!.from;
  const last = segments[segments.length - 1]!.to;
  moved[0] = first;
  moved[moved.length - 1] = last;
  return polyline(moved);
}

type Subpath = { points: Point[]; closed: boolean };

/**
 * Hand-drawn outline. Closed subpaths loop without fading into a corner.
 * Open subpaths (rims, folds) keep the endpoint fade of `sketchOpenPath`.
 * A path whose every subpath is shorter than two fade windows is unchanged,
 * so the caller's arcs and commands survive.
 */
export function sketchShapePath(d: string, key: string): string {
  if (!d) return d;
  const subpaths = parseSubpaths(d);
  if (!subpaths.length) return d;
  const lengths = subpaths.map((subpath) => polylineLength(subpath.points));
  if (lengths.every((length) => length < MIN_LENGTH)) return d;
  return subpaths
    .map((subpath, index) => {
      const partKey = index === 0 ? key : `${key}:${index}`;
      if (lengths[index]! < MIN_LENGTH) return subpathPath(subpath);
      if (subpath.closed) return sketchLoop(subpath.points, partKey);
      return sketchOpenPath(subpathPath(subpath), partKey);
    })
    .join(" ");
}

/** Closed rectangle, or a rounded one when `radius` is positive. */
export function roundedRectPath(
  bounds: { x: number; y: number; width: number; height: number },
  radius: number,
): string {
  const { x, y, width, height } = bounds;
  const r = Math.max(0, Math.min(radius, width / 2, height / 2));
  if (r <= 0) return `M ${x} ${y} H ${x + width} V ${y + height} H ${x} Z`;
  return [
    `M ${x + r} ${y}`,
    `L ${x + width - r} ${y}`,
    `A ${r} ${r} 0 0 1 ${x + width} ${y + r}`,
    `L ${x + width} ${y + height - r}`,
    `A ${r} ${r} 0 0 1 ${x + width - r} ${y + height}`,
    `L ${x + r} ${y + height}`,
    `A ${r} ${r} 0 0 1 ${x} ${y + height - r}`,
    `L ${x} ${y + r}`,
    `A ${r} ${r} 0 0 1 ${x + r} ${y}`,
    `Z`,
  ].join(" ");
}

/** Two-arc circle, matching the ellipse geometry shells use. */
export function circlePath(cx: number, cy: number, r: number): string {
  return `M ${cx - r} ${cy} A ${r} ${r} 0 1 0 ${cx + r} ${cy} A ${r} ${r} 0 1 0 ${cx - r} ${cy} Z`;
}

/** Polygon `points` attribute (`x,y x,y`) as a closed path. */
export function polygonPointsPath(points: string): string {
  const pairs = points.trim().split(/\s+/).filter(Boolean);
  if (!pairs.length) return "";
  const [first, ...rest] = pairs;
  const [x, y] = first!.split(",");
  let d = `M ${x} ${y}`;
  for (const pair of rest) {
    const [px, py] = pair.split(",");
    d += ` L ${px} ${py}`;
  }
  return `${d} Z`;
}

function sketchLoop(points: Point[], key: string): string {
  const ring = ringPoints(points);
  if (ring.length < 3) return subpathPath({ points, closed: true });
  const sampled = resampleClosed(ring);
  if (sampled.samples.length < 3 || sampled.length < MIN_LENGTH) {
    return subpathPath({ points, closed: true });
  }
  const salt = `${ALGORITHM}:${key}`;
  const moved = sampled.samples.map((sample, index) => {
    const normal = loopNormal(sampled.samples, index);
    const magnitude = AMPLITUDE * loopNoise(salt, sample.distance, sampled.length);
    return {
      x: sample.point.x + normal.x * magnitude,
      y: sample.point.y + normal.y * magnitude,
    };
  });
  return `${polyline(moved)} Z`;
}

function loopNoise(salt: string, distance: number, length: number): number {
  return (
    loopWave(salt, distance, length, 36) * 0.7 +
    loopWave(`${salt}:fast`, distance, length, 14) * 0.3
  );
}

/** Cell count divides the perimeter so offset at 0 matches offset at `length`. */
function loopWave(salt: string, distance: number, length: number, nominalCell: number): number {
  const cells = Math.max(3, Math.round(length / nominalCell));
  const cellSize = length / cells;
  const wrapped = ((distance % length) + length) % length;
  const index = Math.min(cells - 1, Math.floor(wrapped / cellSize + 1e-9));
  const frac = (wrapped - index * cellSize) / cellSize;
  const t = frac * frac * (3 - 2 * frac);
  const a = signed(hashUnit(salt, index));
  const b = signed(hashUnit(salt, (index + 1) % cells));
  return a + (b - a) * t;
}

function loopNormal(samples: Sample[], index: number): Point {
  const count = samples.length;
  const previous = samples[(index - 1 + count) % count]!.point;
  const next = samples[(index + 1) % count]!.point;
  const dx = next.x - previous.x;
  const dy = next.y - previous.y;
  const length = Math.hypot(dx, dy) || 1;
  return { x: -dy / length, y: dx / length };
}

function ringPoints(points: Point[]): Point[] {
  if (points.length > 1 && distance(points[0]!, points[points.length - 1]!) <= 0.05) {
    return points.slice(0, -1);
  }
  return points;
}

function resampleClosed(points: Point[]): { samples: Sample[]; length: number } {
  const samples: Sample[] = [{ point: points[0]!, distance: 0 }];
  let traveled = 0;
  let nextAt = SAMPLE_STEP;
  const count = points.length;
  for (let i = 0; i < count; i++) {
    const from = points[i]!;
    const to = points[(i + 1) % count]!;
    const span = distance(from, to);
    if (span === 0) continue;
    while (traveled + span >= nextAt - 1e-9) {
      const t = (nextAt - traveled) / span;
      if (t >= 0 && t < 1 - 1e-6) {
        samples.push({
          point: { x: from.x + (to.x - from.x) * t, y: from.y + (to.y - from.y) * t },
          distance: nextAt,
        });
      }
      nextAt += SAMPLE_STEP;
    }
    traveled += span;
    if (i < count - 1) {
      const last = samples[samples.length - 1]!;
      if (distance(last.point, to) > 0.5) samples.push({ point: to, distance: traveled });
    }
  }
  return { samples, length: traveled };
}

function fade(distance: number): number {
  if (distance >= FADE) return 1;
  if (distance <= 0) return 0;
  const t = distance / FADE;
  return t * t * (3 - 2 * t);
}

function noise(salt: string, distance: number): number {
  return wave(salt, distance, 36) * 0.7 + wave(`${salt}:fast`, distance, 14) * 0.3;
}

function wave(salt: string, distance: number, cellSize: number): number {
  const cell = Math.floor(distance / cellSize);
  const frac = (distance - cell * cellSize) / cellSize;
  const t = frac * frac * (3 - 2 * frac);
  const a = signed(hashUnit(salt, cell));
  const b = signed(hashUnit(salt, cell + 1));
  return a + (b - a) * t;
}

function signed(unit: number): number {
  const value = unit * 2 - 1;
  return Math.sign(value) * Math.sqrt(Math.abs(value));
}

function hashUnit(salt: string, cell: number): number {
  let hash = 2166136261;
  for (let i = 0; i < salt.length; i++) {
    hash ^= salt.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  let mixed = (hash + Math.imul(cell + 1, 0x9e3779b9)) >>> 0;
  mixed = Math.imul(mixed ^ (mixed >>> 16), 0x85ebca6b);
  mixed = Math.imul(mixed ^ (mixed >>> 13), 0xc2b2ae35);
  return ((mixed ^ (mixed >>> 16)) >>> 0) / 4294967295;
}

function parseOpenPath(d: string): Segment[] {
  const tokens = tokenize(d);
  const segments: Segment[] = [];
  let cursor: Point | undefined;
  let i = 0;
  while (i < tokens.length) {
    const token = tokens[i]!;
    if (token.kind !== "cmd") {
      throw new Error(`Sketch path has a number before a command: ${d}`);
    }
    const op = token.op;
    i += 1;
    if (op === "M") {
      const point = takePoint(tokens, i, d);
      i += 2;
      cursor = point;
      continue;
    }
    if (!cursor) throw new Error(`Sketch path command ${op} has no start: ${d}`);
    if (op === "L") {
      const to = takePoint(tokens, i, d);
      i += 2;
      segments.push({ kind: "L", from: cursor, to });
      cursor = to;
      continue;
    }
    if (op === "Q") {
      const c = takePoint(tokens, i, d);
      const to = takePoint(tokens, i + 2, d);
      i += 4;
      segments.push({ kind: "Q", from: cursor, c, to });
      cursor = to;
      continue;
    }
    if (op === "C") {
      const c1 = takePoint(tokens, i, d);
      const c2 = takePoint(tokens, i + 2, d);
      const to = takePoint(tokens, i + 4, d);
      i += 6;
      segments.push({ kind: "C", from: cursor, c1, c2, to });
      cursor = to;
      continue;
    }
    throw new Error(`Sketch path command ${op} is not an open stroke: ${d}`);
  }
  if (!segments.length) throw new Error(`Sketch path has no segments: ${d}`);
  return segments;
}

type Token = { kind: "cmd"; op: string } | { kind: "num"; value: number };

function tokenize(d: string): Token[] {
  const tokens: Token[] = [];
  const pattern = /[A-Za-z]|-?(?:\d+\.\d+|\d+|\.\d+)/g;
  for (const match of d.matchAll(pattern)) {
    const text = match[0]!;
    if (/[A-Za-z]/.test(text)) tokens.push({ kind: "cmd", op: text });
    else tokens.push({ kind: "num", value: Number(text) });
  }
  return tokens;
}

function takePoint(tokens: Token[], index: number, d: string): Point {
  const x = tokens[index];
  const y = tokens[index + 1];
  if (!x || x.kind !== "num" || !y || y.kind !== "num") {
    throw new Error(`Sketch path is missing a coordinate: ${d}`);
  }
  return { x: x.value, y: y.value };
}

function segmentLength(segment: Segment): number {
  const slices = 12;
  let length = 0;
  let previous = segment.from;
  for (let i = 1; i <= slices; i++) {
    const point = pointAt(segment, i / slices);
    length += distance(previous, point);
    previous = point;
  }
  return length;
}

function flatten(segments: Segment[]): Point[] {
  const points: Point[] = [];
  for (const segment of segments) {
    if (!points.length) points.push(segment.from);
    const length = segmentLength(segment);
    const slices = Math.max(1, Math.ceil(length / 2));
    for (let i = 1; i <= slices; i++) points.push(pointAt(segment, i / slices));
  }
  return dedupe(points);
}

type Sample = { point: Point; distance: number };

function resample(points: Point[], step: number): Sample[] {
  const samples: Sample[] = [{ point: points[0]!, distance: 0 }];
  let traveled = 0;
  let nextAt = step;
  for (let i = 1; i < points.length; i++) {
    const from = points[i - 1]!;
    const to = points[i]!;
    const span = distance(from, to);
    if (span === 0) continue;
    while (traveled + span >= nextAt - 1e-9) {
      const t = (nextAt - traveled) / span;
      samples.push({
        point: { x: from.x + (to.x - from.x) * t, y: from.y + (to.y - from.y) * t },
        distance: nextAt,
      });
      nextAt += step;
    }
    traveled += span;
  }
  const end = points[points.length - 1]!;
  const last = samples[samples.length - 1]!;
  if (distance(last.point, end) > 0.01) samples.push({ point: end, distance: traveled });
  else samples[samples.length - 1] = { point: end, distance: traveled };
  return samples;
}

function sampleNormal(samples: Sample[], index: number): Point {
  const previous = samples[Math.max(0, index - 1)]!.point;
  const next = samples[Math.min(samples.length - 1, index + 1)]!.point;
  const dx = next.x - previous.x;
  const dy = next.y - previous.y;
  const length = Math.hypot(dx, dy) || 1;
  return { x: -dy / length, y: dx / length };
}

function pointAt(segment: Segment, t: number): Point {
  if (segment.kind === "L") return lerp(segment.from, segment.to, t);
  if (segment.kind === "Q") return quadratic(segment.from, segment.c, segment.to, t);
  return cubic(segment.from, segment.c1, segment.c2, segment.to, t);
}

function lerp(a: Point, b: Point, t: number): Point {
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
}

function quadratic(p0: Point, p1: Point, p2: Point, t: number): Point {
  const u = 1 - t;
  return {
    x: u * u * p0.x + 2 * u * t * p1.x + t * t * p2.x,
    y: u * u * p0.y + 2 * u * t * p1.y + t * t * p2.y,
  };
}

function cubic(p0: Point, p1: Point, p2: Point, p3: Point, t: number): Point {
  const u = 1 - t;
  const uu = u * u;
  const tt = t * t;
  return {
    x: uu * u * p0.x + 3 * uu * t * p1.x + 3 * u * tt * p2.x + tt * t * p3.x,
    y: uu * u * p0.y + 3 * uu * t * p1.y + 3 * u * tt * p2.y + tt * t * p3.y,
  };
}

function polyline(points: Point[]): string {
  const unique = dedupe(points.map((point) => ({ x: round(point.x), y: round(point.y) })));
  return unique
    .map((point, index) => `${index === 0 ? "M" : "L"} ${fmt(point.x)} ${fmt(point.y)}`)
    .join(" ");
}

function dedupe(points: Point[]): Point[] {
  const result: Point[] = [];
  for (const point of points) {
    const previous = result[result.length - 1];
    if (previous && previous.x === point.x && previous.y === point.y) continue;
    result.push(point);
  }
  return result;
}

function distance(a: Point, b: Point): number {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

function round(value: number): number {
  const rounded = Math.round(value * 100) / 100;
  return Object.is(rounded, -0) ? 0 : rounded;
}

function fmt(value: number): string {
  return String(round(value));
}

const FLATTEN_STEP = 4;

function polylineLength(points: Point[]): number {
  let length = 0;
  for (let i = 1; i < points.length; i++) length += distance(points[i - 1]!, points[i]!);
  return length;
}

function subpathPath(subpath: Subpath): string {
  const body = polyline(subpath.points);
  return subpath.closed ? `${body} Z` : body;
}

function parseSubpaths(d: string): Subpath[] {
  const tokens = tokenize(d);
  const subpaths: Subpath[] = [];
  let points: Point[] = [];
  let cursor: Point = { x: 0, y: 0 };
  let start: Point = { x: 0, y: 0 };
  let closed = false;
  let command = "";
  let prevCubic: Point | undefined;
  let prevQuad: Point | undefined;
  let i = 0;

  const read = (): number => {
    const token = tokens[i];
    if (!token || token.kind !== "num") {
      throw new Error(`Sketch path is missing a number: ${d}`);
    }
    i += 1;
    return token.value;
  };

  const flush = () => {
    const unique = dedupe(points);
    if (unique.length >= 2) {
      const isClosed = closed || distance(unique[0]!, unique[unique.length - 1]!) <= 0.05;
      subpaths.push({ points: unique, closed: isClosed });
    }
    points = [];
    closed = false;
  };

  const ensureStart = () => {
    if (!points.length) points.push({ ...cursor });
  };

  const addCorner = (to: Point) => {
    ensureStart();
    points.push(to);
    cursor = to;
    prevCubic = undefined;
    prevQuad = undefined;
  };

  const addSamples = (samples: Point[], to: Point) => {
    ensureStart();
    for (const sample of samples) points.push(sample);
    if (!samples.length || distance(samples[samples.length - 1]!, to) > 0.01) points.push(to);
    cursor = to;
  };

  const absolute = (x: number, y: number, relative: boolean): Point =>
    relative ? { x: cursor.x + x, y: cursor.y + y } : { x, y };

  while (i < tokens.length) {
    const token = tokens[i]!;
    if (token.kind === "cmd") {
      command = token.op;
      i += 1;
    } else if (!command) {
      throw new Error(`Sketch path has a number before a command: ${d}`);
    }

    const relative = command === command.toLowerCase();
    const op = command.toUpperCase();
    if (op === "Z") {
      if (points.length) {
        points.push({ ...start });
        closed = true;
        flush();
      }
      cursor = { ...start };
      prevCubic = undefined;
      prevQuad = undefined;
      command = "";
      continue;
    }
    if (op === "M") {
      const next = absolute(read(), read(), relative);
      flush();
      cursor = next;
      start = next;
      points = [next];
      command = relative ? "l" : "L";
      continue;
    }
    if (op === "L") {
      addCorner(absolute(read(), read(), relative));
      continue;
    }
    if (op === "H") {
      const x = read();
      addCorner({ x: relative ? cursor.x + x : x, y: cursor.y });
      continue;
    }
    if (op === "V") {
      const y = read();
      addCorner({ x: cursor.x, y: relative ? cursor.y + y : y });
      continue;
    }
    if (op === "C") {
      const origin = cursor;
      const c1 = absolute(read(), read(), relative);
      const c2 = relative
        ? { x: origin.x + read(), y: origin.y + read() }
        : { x: read(), y: read() };
      const to = relative
        ? { x: origin.x + read(), y: origin.y + read() }
        : { x: read(), y: read() };
      addSamples(sampleCubic(origin, c1, c2, to), to);
      prevCubic = c2;
      prevQuad = undefined;
      continue;
    }
    if (op === "S") {
      const origin = cursor;
      const c1 = prevCubic ? reflectPoint(prevCubic, origin) : origin;
      const c2 = absolute(read(), read(), relative);
      const to = relative
        ? { x: origin.x + read(), y: origin.y + read() }
        : { x: read(), y: read() };
      addSamples(sampleCubic(origin, c1, c2, to), to);
      prevCubic = c2;
      prevQuad = undefined;
      continue;
    }
    if (op === "Q") {
      const origin = cursor;
      const c = absolute(read(), read(), relative);
      const to = relative
        ? { x: origin.x + read(), y: origin.y + read() }
        : { x: read(), y: read() };
      addSamples(sampleQuadratic(origin, c, to), to);
      prevQuad = c;
      prevCubic = undefined;
      continue;
    }
    if (op === "T") {
      const origin = cursor;
      const c = prevQuad ? reflectPoint(prevQuad, origin) : origin;
      const to = absolute(read(), read(), relative);
      addSamples(sampleQuadratic(origin, c, to), to);
      prevQuad = c;
      prevCubic = undefined;
      continue;
    }
    if (op === "A") {
      const origin = cursor;
      const rx = read();
      const ry = read();
      const rotation = read();
      const large = read() !== 0;
      const sweep = read() !== 0;
      const to = absolute(read(), read(), relative);
      addSamples(sampleArc(origin, rx, ry, rotation, large, sweep, to), to);
      prevCubic = undefined;
      prevQuad = undefined;
      continue;
    }
    throw new Error(`Sketch path command ${command} is not supported: ${d}`);
  }
  flush();
  return subpaths;
}

function reflectPoint(control: Point, about: Point): Point {
  return { x: about.x * 2 - control.x, y: about.y * 2 - control.y };
}

function sampleCubic(p0: Point, p1: Point, p2: Point, p3: Point): Point[] {
  return sampleParametric((t) => cubic(p0, p1, p2, p3, t), curveLength(p0, p1, p2, p3));
}

function sampleQuadratic(p0: Point, p1: Point, p2: Point): Point[] {
  return sampleParametric((t) => quadratic(p0, p1, p2, t), curveLength(p0, p1, p2));
}

function curveLength(...points: Point[]): number {
  let length = 0;
  const slices = 12;
  let previous = points[0]!;
  for (let i = 1; i <= slices; i++) {
    const t = i / slices;
    const point =
      points.length === 4
        ? cubic(points[0]!, points[1]!, points[2]!, points[3]!, t)
        : quadratic(points[0]!, points[1]!, points[2]!, t);
    length += distance(previous, point);
    previous = point;
  }
  return length;
}

function sampleParametric(at: (t: number) => Point, length: number): Point[] {
  const steps = Math.max(1, Math.ceil(length / FLATTEN_STEP));
  const samples: Point[] = [];
  for (let i = 1; i < steps; i++) samples.push(at(i / steps));
  return samples;
}

function sampleArc(
  from: Point,
  rx0: number,
  ry0: number,
  rotationDeg: number,
  large: boolean,
  sweep: boolean,
  to: Point,
): Point[] {
  if (distance(from, to) < 1e-6) return [];
  let rx = Math.abs(rx0);
  let ry = Math.abs(ry0);
  if (rx < 1e-6 || ry < 1e-6) return [];

  const phi = (rotationDeg * Math.PI) / 180;
  const cosPhi = Math.cos(phi);
  const sinPhi = Math.sin(phi);
  const dx = (from.x - to.x) / 2;
  const dy = (from.y - to.y) / 2;
  const x1p = cosPhi * dx + sinPhi * dy;
  const y1p = -sinPhi * dx + cosPhi * dy;

  const lambda = (x1p * x1p) / (rx * rx) + (y1p * y1p) / (ry * ry);
  if (lambda > 1) {
    const scale = Math.sqrt(lambda);
    rx *= scale;
    ry *= scale;
  }

  const rxsq = rx * rx;
  const rysq = ry * ry;
  const numerator = rxsq * rysq - rxsq * y1p * y1p - rysq * x1p * x1p;
  const denominator = rxsq * y1p * y1p + rysq * x1p * x1p;
  let coef = denominator === 0 ? 0 : Math.sqrt(Math.max(0, numerator / denominator));
  if (large === sweep) coef = -coef;
  const cxp = coef * ((rx * y1p) / ry);
  const cyp = coef * ((-ry * x1p) / rx);
  const cx = cosPhi * cxp - sinPhi * cyp + (from.x + to.x) / 2;
  const cy = sinPhi * cxp + cosPhi * cyp + (from.y + to.y) / 2;
  const theta1 = Math.atan2((y1p - cyp) / ry, (x1p - cxp) / rx);
  let delta = Math.atan2((-y1p - cyp) / ry, (-x1p - cxp) / rx) - theta1;
  if (!sweep && delta > 0) delta -= Math.PI * 2;
  if (sweep && delta < 0) delta += Math.PI * 2;

  const arcLength = Math.abs(delta) * Math.sqrt((rx * rx + ry * ry) / 2);
  const steps = Math.max(2, Math.ceil(arcLength / FLATTEN_STEP));
  const samples: Point[] = [];
  for (let i = 1; i < steps; i++) {
    const angle = theta1 + delta * (i / steps);
    const cosAngle = Math.cos(angle);
    const sinAngle = Math.sin(angle);
    samples.push({
      x: cx + rx * cosAngle * cosPhi - ry * sinAngle * sinPhi,
      y: cy + rx * cosAngle * sinPhi + ry * sinAngle * cosPhi,
    });
  }
  return samples;
}
