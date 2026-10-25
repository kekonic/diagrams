/**
 * Deterministic hand-drawn centerline for an open stroke.
 * Endpoints stay on the routed path. Callers keep dash, markers, and classes.
 * Strokes shorter than two fade windows are returned unchanged.
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
