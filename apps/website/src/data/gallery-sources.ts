/** Resolve gallery `sourceExport` names to diagram source strings. */
import * as examples from "./examples";

const map = examples as Record<string, string>;

export function sourceByExport(name: string): string {
  const value = map[name];
  if (typeof value !== "string") {
    throw new Error(`Unknown examples export: ${name}`);
  }
  return value;
}
