/**
 * Direction predicates for diagram flow (`LR`/`RL`/`TD`/`BT`).
 * Used by topology analysis and ELK option mapping — not edge geometry.
 */

import type { Direction } from "@kekonic/diagrams-core";

/** True for left↔right flow (`LR` / `RL`). */
export function isHorizontal(direction: Direction): boolean {
  return direction === "LR" || direction === "RL";
}

/** True for top↔bottom flow (`TD` / `BT`). */
export function isVertical(direction: Direction): boolean {
  return direction === "TD" || direction === "BT";
}
