/** Core geometry and shared primitives — no AST types here. */

export type Point = { x: number; y: number };
export type Vec2 = { x: number; y: number };
export type Rect = { x: number; y: number; width: number; height: number };
export type BoxPadding = { top: number; right: number; bottom: number; left: number };

export type SourceRange = {
  start: { line: number; column: number; offset: number };
  end: { line: number; column: number; offset: number };
};

export type Diagnostic = {
  severity: "error" | "warning" | "info";
  code: string;
  message: string;
  range: SourceRange;
  hint?: string;
};

export function rectCenter(r: Rect): Point {
  return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
}

export function rectRight(r: Rect): number {
  return r.x + r.width;
}

export function rectBottom(r: Rect): number {
  return r.y + r.height;
}

export function rectsOverlap(a: Rect, b: Rect, gap = 0): boolean {
  return !(
    a.x + a.width + gap <= b.x ||
    b.x + b.width + gap <= a.x ||
    a.y + a.height + gap <= b.y ||
    b.y + b.height + gap <= a.y
  );
}

export function expandRect(r: Rect, pad: number): Rect {
  return {
    x: r.x - pad,
    y: r.y - pad,
    width: r.width + pad * 2,
    height: r.height + pad * 2,
  };
}

export function manhattan(a: Point, b: Point): number {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}
