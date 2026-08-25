import * as React from "react";
import { createComponent } from "@lit/react";
import { KDiagramElement, K_DIAGRAM_TAG } from "@kekonic/diagrams-element";
import type { InteractiveRenderOptions, RenderResult, ThemeMode } from "@kekonic/diagrams";

export type KDiagramLiveProps = {
  source: string;
  /** Diagram theme. `"auto"` follows the host page (`html[data-theme]`). */
  theme?: ThemeMode | "auto";
  className?: string;
  /** Remove the host border and panel background. Controls remain independently configurable. */
  frameless?: boolean;
  /** Sun/moon control that dogfoods theme swaps. */
  showThemeToggle?: boolean;
  /** Zoom / fit / fullscreen controls. */
  showViewControls?: boolean;
  /** Compact render stats badge (floating). Off by default for a clean embed. */
  showStats?: boolean;
  /** Animation play/scrub chrome when an animation exists. Default on. */
  showAnimationControls?: boolean;
  /** Start playing when the diagram mounts. */
  autoplay?: boolean;
  /** Loop the active animation. */
  animationLoop?: boolean;
  /** Preferred animation name or id (authored blocks). */
  animation?: string;
  /** Named model view (`kdiagram 2` model files). */
  view?: string;
  /** Show a lens picker when the source defines multiple model views. Default on. */
  showViewSwitcher?: boolean;
  height?: number | string;
  options?: Omit<InteractiveRenderOptions, "theme">;
  /** Fired after mount / source / theme renders complete. */
  onKDiagramRender?: (event: CustomEvent<RenderResult>) => void;
  /** Fired when the active model view changes. */
  onKDiagramViewChange?: (event: CustomEvent<{ view?: string }>) => void;
};

/** Lit + React prop inference drifts when the element surface grows; keep React props explicit. */
const KDiagramReact = createComponent({
  react: React,
  tagName: K_DIAGRAM_TAG,
  elementClass: KDiagramElement,
  events: {
    onKDiagramRender: "kdiagram-render",
    onKDiagramViewChange: "kdiagram-view-change",
  },
}) as unknown as React.ForwardRefExoticComponent<
  KDiagramLiveProps & React.RefAttributes<KDiagramElement>
>;

/**
 * React thin wrapper around Lit `<k-diagram>`.
 * Same interactive host as HTML embeds — pan/zoom, theme, live `source` updates.
 */
export const KDiagramLive = React.forwardRef<KDiagramElement, KDiagramLiveProps>(
  function KDiagramLive({ className, ...props }, ref) {
    return (
      <KDiagramReact
        ref={ref}
        className={["kd-live", className].filter(Boolean).join(" ")}
        {...props}
      />
    );
  },
);
