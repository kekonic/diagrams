import type { Direction } from "../types/graph.ts";

/** Normalize DSL direction aliases to canonical values (§6.5). */
export function normalizeDirection(value: string): Direction {
  switch (value.toLowerCase()) {
    case "lr":
    case "right":
      return "LR";
    case "rl":
      return "RL";
    case "td":
    case "tb":
    case "down":
      return "TD";
    case "bt":
      return "BT";
    default:
      return value.toUpperCase() as Direction;
  }
}
