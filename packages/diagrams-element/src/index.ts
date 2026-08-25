import { KDiagramElement } from "./k-diagram.ts";

export { KDiagramElement } from "./k-diagram.ts";
export type { InteractiveRenderOptions, ThemeMode, ZoomOnWheelMode } from "@kekonic/diagrams";

/** Tag name for `<k-diagram>`. */
export const K_DIAGRAM_TAG = "k-diagram";

/** Register `<k-diagram>` (idempotent). Called on package import. */
export function registerKDiagramElements(): void {
  if (!customElements.get(K_DIAGRAM_TAG)) {
    customElements.define(K_DIAGRAM_TAG, KDiagramElement);
  }
}

registerKDiagramElements();
