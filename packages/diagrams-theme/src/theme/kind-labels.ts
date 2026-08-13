import { kindSubtitle as coreKindSubtitle } from "@kekonic/diagrams-core";

/** Human-readable kind subtitles for node chrome (not debug identifiers). */
export function kindSubtitle(kind: string): string {
  return coreKindSubtitle(kind);
}
