import { formatSource } from "@kekonic/diagrams-core";
import {
  ensureBrowserFonts,
  resetDefaultMeasurer,
  type LayoutResult,
} from "@kekonic/diagrams-layout";
import { getThemeTokens, THEME_CSS } from "@kekonic/diagrams-theme";
import {
  compileSource,
  layoutFromGraph,
  parseSource,
  renderPipeline,
  routeFromLayout,
} from "./pipeline/index.ts";
import type {
  CompileResult,
  GraphModel,
  InteractiveRenderOptions,
  LayoutOptions,
  ParseResult,
  RenderController,
  RenderOptions,
  RenderResult,
  RoutingOptions,
  ThemeMode,
  ZoomOnWheelMode,
} from "@kekonic/diagrams-core";
import type { RouteFromLayoutResult } from "./pipeline/index.ts";
import { AnimationPlayer } from "./animation/player.ts";
import {
  shouldCaptureWheelZoom,
  wheelZoomHintText,
  ZOOM_HINT_VISIBLE_MS,
} from "./interactive/wheel-zoom.ts";
export {
  KDIAGRAM_CAPABILITIES_VERSION,
  getCapabilities,
  type KDiagramCapabilities,
} from "./capabilities.ts";
export {
  analyzeDiagramQuality,
  DEFAULT_TARGET_ASPECT_RATIO,
  QUALITY_CHECKS,
  type DiagramQualityAnalysis,
  type DiagramQualityMetrics,
  type QualityCheck,
} from "./quality.ts";

export type * from "@kekonic/diagrams-core";
export {
  parse,
  compile,
  compileDocument,
  listCompileTargets,
  getKindDefaults,
  isBuiltinKind,
  BUILTIN_KIND_LIST,
  BUILTIN_KIND_CATALOG,
  kindHasCapability,
  kindSubtitle,
  listKindsByCategory,
  listGeometryKinds,
  isGeometryKind,
  normalizeShapeId,
  isKnownShapeId,
  BUILTIN_SHAPE_IDS,
  formatSource,
  mergeOptions,
  resolvePresentation,
  mergePresentationOptions,
  formatLabelText,
  displayLabelCase,
  EDGE_OPS,
  edgeOpsPattern,
  STATEMENT_KEYWORDS,
  inferAutoAnimation,
  planAutoWalk,
  enumerateAutoPaths,
  traceDeclarationPath,
  animationIdFromName,
} from "@kekonic/diagrams-core";
export { AnimationPlayer } from "./animation/player.ts";
export type {
  PresentationOptions,
  ResolvedPresentation,
  EdgeOperator,
  AutoWalkStep,
} from "@kekonic/diagrams-core";
export type {
  LayoutResult,
  LaidOutNode,
  LaidOutGroup,
  DiagramTopology,
  LayoutEdgePath,
} from "@kekonic/diagrams-layout";
export {
  measureGraph,
  layoutAndRouteWithElk,
  analyzeDiagramTopology,
  ELK_LAYOUT_ALGORITHM,
  ELK_ROUTER_ALGORITHM,
} from "@kekonic/diagrams-layout";
export type {
  RoutingResult,
  RoutedEdge,
  TreatedEdge,
  EdgeLabelPlacement,
} from "@kekonic/diagrams-routing";
export { applyCrossingTreatment, attachPointOnPerimeter } from "@kekonic/diagrams-routing";
export { renderSvg } from "@kekonic/diagrams-render-svg";
export {
  resolveShapeGeometry,
  registerShape,
  registerNodeType,
  getNodeTypeDefinition,
  resolveNodeTypeGeometry,
  listRegisteredNodeTypeIds,
  buildNodeBoundsModel,
  listRegisteredShapeIds,
  type ShapeGeometry,
  type NodeBoundsModel,
  type NodeTypeDefinition,
} from "@kekonic/diagrams-geometry";
export { registerTheme, getThemeTokens, themeToCss, THEME_CSS } from "@kekonic/diagrams-theme";
export {
  normalizeIconId,
  parseIconId,
  preloadIcons,
  preloadCollections,
  collectIconIds,
  resolveIcon,
  renderIconById,
  registerIcon,
  registerCollection,
  registerCollectionLoader,
  setIconifyApiBaseUrl,
  listBuiltinIconIds,
  listDefaultCollections,
  BUILTIN_ICON_ALIASES,
} from "@kekonic/diagrams-icons";
export {
  parseSource,
  compileSource,
  measureFromGraph,
  layoutFromGraph,
  layoutMeasuredGraph,
  routeFromLayout,
  routeLaidOutGraph,
  finalizeRoutedGraph,
  renderPipeline,
  finalizeElkEdges,
  type RouteFromLayoutResult,
  type FinalizeElkEdgesInput,
  type FinalizeElkEdgesResult,
  type MeasuredGraph,
  type LaidOutGraph,
  type RoutedGraph,
  type FinalizedGraph,
} from "./pipeline/index.ts";

export type { PipelineCompileOptions } from "./pipeline/index.ts";

export type {
  CompileResult,
  GraphModel,
  InteractiveRenderOptions,
  LayoutOptions,
  ParseResult,
  RenderController,
  RenderOptions,
  RenderResult,
  RoutingOptions,
  ThemeMode,
  ZoomOnWheelMode,
};

export const KDiagram = {
  parse(source: string): ParseResult {
    return parseSource(source);
  },

  compile(source: string, _options?: Record<string, never>): CompileResult {
    return compileSource(source);
  },

  async layout(graph: GraphModel, options?: LayoutOptions): Promise<LayoutResult> {
    return layoutFromGraph(graph, options);
  },

  route(graph: GraphModel, layout: LayoutResult, options?: RoutingOptions): RouteFromLayoutResult {
    return routeFromLayout(graph, layout, options);
  },

  format(source: string): string {
    return formatSource(source);
  },

  async ensureFonts(): Promise<void> {
    const { default: interFontUrl } =
      await import("@fontsource/inter/files/inter-latin-500-normal.woff?url");
    await ensureBrowserFonts(interFontUrl);
    resetDefaultMeasurer();
  },

  async renderToSvg(
    source: string,
    options?: RenderOptions & { layout?: LayoutOptions; edges?: RoutingOptions },
  ): Promise<RenderResult> {
    return renderPipeline(source, options);
  },

  renderToElement(
    source: string,
    container: HTMLElement,
    options?: InteractiveRenderOptions,
  ): RenderController {
    let currentTheme: ThemeMode = options?.theme ?? "dark";
    let currentOptions: InteractiveRenderOptions = { ...options };
    type ViewBox = { x: number; y: number; w: number; h: number };
    let naturalView: ViewBox = { x: 0, y: 0, w: 1, h: 1 };
    let viewport: ViewBox = { ...naturalView };
    let isPanning = false;
    let panOrigin: ViewBox = { x: 0, y: 0, w: 0, h: 0 };
    let panPointer = { x: 0, y: 0 };
    let hasPainted = false;
    let resizeObserver: ResizeObserver | null = null;
    let zoomHintTimer: ReturnType<typeof setTimeout> | null = null;

    const MIN_ZOOM = 0.15;
    const MAX_ZOOM = 4;

    const wrapper = document.createElement("div");
    wrapper.className = `kdiagram-viewport kdiagram-theme-${currentTheme}`;
    wrapper.style.cssText =
      "width:100%;height:100%;overflow:hidden;position:relative;cursor:grab;touch-action:none;user-select:none;-webkit-user-select:none;";
    const applyLiveThemeTokens = () => {
      for (const [property, value] of Object.entries(getThemeTokens(currentTheme))) {
        wrapper.style.setProperty(property, value);
        container.style.setProperty(property, value);
      }
    };
    applyLiveThemeTokens();
    const inner = document.createElement("div");
    inner.className = "kdiagram-canvas";
    inner.style.cssText = "width:100%;height:100%;user-select:none;-webkit-user-select:none;";
    const zoomHint = document.createElement("div");
    zoomHint.className = "kdiagram-zoom-hint";
    zoomHint.setAttribute("role", "status");
    zoomHint.setAttribute("aria-hidden", "true");
    wrapper.appendChild(inner);
    wrapper.appendChild(zoomHint);
    container.innerHTML = "";
    container.appendChild(wrapper);

    const themeCssText = `${THEME_CSS}
.kdiagram-viewport, .kdiagram-viewport svg, .kdiagram-viewport text {
  user-select: none;
  -webkit-user-select: none;
}
.kdiagram-viewport svg { display:block; width:100%; height:100%; }
.kdiagram-zoom-hint {
  position: absolute;
  left: 50%;
  top: 50%;
  transform: translate(-50%, -50%);
  margin: 0;
  padding: 0.5rem 0.75rem;
  border-radius: 0.5rem;
  background: color-mix(in oklch, var(--kd-bg, Canvas) 18%, var(--kd-text, CanvasText) 82%);
  color: var(--kd-bg, Canvas);
  font: 600 12px/1.4 system-ui, sans-serif;
  letter-spacing: 0.01em;
  pointer-events: none;
  z-index: 2;
  opacity: 0;
  visibility: hidden;
  transition: opacity 120ms ease, visibility 120ms ease;
}
.kdiagram-zoom-hint[data-visible="true"] {
  opacity: 1;
  visibility: visible;
}
@media (prefers-reduced-motion: reduce) {
  .kdiagram-zoom-hint { transition: none; }
}`;
    let themeStyle = document.getElementById("kdiagram-theme-css") as HTMLStyleElement | null;
    if (!themeStyle) {
      themeStyle = document.createElement("style");
      themeStyle.id = "kdiagram-theme-css";
      document.head.appendChild(themeStyle);
    }
    themeStyle.textContent = themeCssText;

    let lastSource = source;
    const animationPlayer = new AnimationPlayer();

    const parseViewBox = (svg: SVGSVGElement): ViewBox => {
      const parts = (svg.getAttribute("viewBox") ?? "0 0 1 1").trim().split(/\s+/).map(Number);
      return {
        x: parts[0] ?? 0,
        y: parts[1] ?? 0,
        w: parts[2] ?? 1,
        h: parts[3] ?? 1,
      };
    };

    const applyView = () => {
      const svg = inner.querySelector("svg");
      if (!svg) return;
      svg.setAttribute("viewBox", `${viewport.x} ${viewport.y} ${viewport.w} ${viewport.h}`);
      svg.setAttribute("preserveAspectRatio", "xMidYMid meet");
      svg.style.width = "100%";
      svg.style.height = "100%";
      svg.style.display = "block";
    };

    const clientToView = (clientX: number, clientY: number): { x: number; y: number } => {
      const rect = wrapper.getBoundingClientRect();
      const nx = (clientX - rect.left) / rect.width;
      const ny = (clientY - rect.top) / rect.height;
      return {
        x: viewport.x + nx * viewport.w,
        y: viewport.y + ny * viewport.h,
      };
    };

    const zoomAt = (clientX: number, clientY: number, factor: number) => {
      const pt = clientToView(clientX, clientY);
      const minW = naturalView.w / MAX_ZOOM;
      const maxW = naturalView.w / MIN_ZOOM;
      const nextW = Math.min(maxW, Math.max(minW, viewport.w * factor));
      const ratio = nextW / viewport.w;
      const nextH = viewport.h * ratio;
      viewport = {
        x: pt.x - (pt.x - viewport.x) * ratio,
        y: pt.y - (pt.y - viewport.y) * ratio,
        w: nextW,
        h: nextH,
      };
      applyView();
    };

    const fitView = () => {
      const cw = wrapper.clientWidth;
      const ch = wrapper.clientHeight;
      if (!cw || !ch) return;
      const pad = 0.06;
      const contentW = naturalView.w * (1 + pad * 2);
      const contentH = naturalView.h * (1 + pad * 2);
      const contentAspect = contentW / contentH;
      const containerAspect = cw / ch;
      let w: number;
      let h: number;
      if (contentAspect > containerAspect) {
        w = contentW;
        h = w / containerAspect;
      } else {
        h = contentH;
        w = h * containerAspect;
      }
      viewport = {
        x: naturalView.x + naturalView.w / 2 - w / 2,
        y: naturalView.y + naturalView.h / 2 - h / 2,
        w,
        h,
      };
      applyView();
    };

    const render = async (src: string, opts?: Partial<InteractiveRenderOptions>) => {
      lastSource = src;
      if (opts) currentOptions = { ...currentOptions, ...opts };
      const prevRatio = hasPainted && naturalView.w > 0 ? viewport.w / naturalView.w : 1;
      const centerX = viewport.x + viewport.w / 2;
      const centerY = viewport.y + viewport.h / 2;
      const result = await renderPipeline(src, {
        ...currentOptions,
        theme: currentTheme,
      });
      inner.innerHTML = result.svg ?? "";
      const svg = inner.querySelector("svg");
      animationPlayer.rebind(svg, result.graph ?? null);
      if (svg) {
        naturalView = parseViewBox(svg);
        if (!hasPainted) {
          hasPainted = true;
          // First paint: fit content to host (avoids 1×1 placeholder centering bug).
          fitView();
          if (
            (!wrapper.clientWidth || !wrapper.clientHeight) &&
            typeof ResizeObserver !== "undefined"
          ) {
            resizeObserver = new ResizeObserver(() => {
              if (wrapper.clientWidth && wrapper.clientHeight) {
                fitView();
                resizeObserver?.disconnect();
                resizeObserver = null;
              }
            });
            resizeObserver.observe(wrapper);
          }
        } else {
          const w = naturalView.w * prevRatio;
          const h = naturalView.h * prevRatio;
          viewport = {
            x: centerX - w / 2,
            y: centerY - h / 2,
            w,
            h,
          };
          applyView();
        }
      }
      return result;
    };

    const hideZoomHint = () => {
      zoomHint.dataset.visible = "false";
    };

    const showZoomHint = () => {
      zoomHint.textContent = wheelZoomHintText();
      zoomHint.dataset.visible = "true";
      if (zoomHintTimer != null) clearTimeout(zoomHintTimer);
      zoomHintTimer = setTimeout(() => {
        zoomHintTimer = null;
        hideZoomHint();
      }, ZOOM_HINT_VISIBLE_MS);
    };

    const onWheel = (e: WheelEvent) => {
      if (!inner.querySelector("svg")) return;
      if (!shouldCaptureWheelZoom(e, currentOptions.zoomOnWheel)) {
        if (Math.abs(e.deltaY) >= Math.abs(e.deltaX)) showZoomHint();
        return;
      }
      if (e.deltaY === 0) return;
      e.preventDefault();
      hideZoomHint();
      const factor = e.deltaY > 0 ? 1.1 : 1 / 1.1;
      zoomAt(e.clientX, e.clientY, factor);
    };

    const onPointerDown = (e: PointerEvent) => {
      if (e.button === 0 || e.button === 1) {
        e.preventDefault();
        window.getSelection()?.removeAllRanges();
        isPanning = true;
        panOrigin = { ...viewport };
        panPointer = { x: e.clientX, y: e.clientY };
        wrapper.style.cursor = "grabbing";
        wrapper.setPointerCapture(e.pointerId);
      }
    };

    const onPointerMove = (e: PointerEvent) => {
      if (!isPanning) return;
      e.preventDefault();
      const dx = ((e.clientX - panPointer.x) / wrapper.clientWidth) * viewport.w;
      const dy = ((e.clientY - panPointer.y) / wrapper.clientHeight) * viewport.h;
      viewport = {
        ...viewport,
        x: panOrigin.x - dx,
        y: panOrigin.y - dy,
      };
      applyView();
    };

    const onPointerUp = (e: PointerEvent) => {
      if (isPanning) {
        isPanning = false;
        wrapper.style.cursor = "grab";
        wrapper.releasePointerCapture(e.pointerId);
      }
    };

    const onSelectStart = (e: Event) => {
      e.preventDefault();
    };

    wrapper.addEventListener("wheel", onWheel, { passive: false });
    wrapper.addEventListener("pointerdown", onPointerDown);
    wrapper.addEventListener("pointermove", onPointerMove);
    wrapper.addEventListener("pointerup", onPointerUp);
    wrapper.addEventListener("pointercancel", onPointerUp);
    wrapper.addEventListener("selectstart", onSelectStart);

    const readyPromise = render(source, options);

    return {
      async update(src: string, opts?: Partial<InteractiveRenderOptions>): Promise<RenderResult> {
        return render(src, opts);
      },
      async setTheme(theme: ThemeMode): Promise<RenderResult> {
        currentTheme = theme;
        wrapper.className = `kdiagram-viewport kdiagram-theme-${theme}`;
        applyLiveThemeTokens();
        return render(lastSource);
      },
      ready() {
        return readyPromise;
      },
      fit() {
        fitView();
      },
      zoomIn() {
        const rect = wrapper.getBoundingClientRect();
        zoomAt(rect.left + rect.width / 2, rect.top + rect.height / 2, 1 / 1.2);
      },
      zoomOut() {
        const rect = wrapper.getBoundingClientRect();
        zoomAt(rect.left + rect.width / 2, rect.top + rect.height / 2, 1.2);
      },
      resetView() {
        fitView();
      },
      animations: animationPlayer,
      destroy() {
        animationPlayer.destroy();
        resizeObserver?.disconnect();
        resizeObserver = null;
        if (zoomHintTimer != null) {
          clearTimeout(zoomHintTimer);
          zoomHintTimer = null;
        }
        wrapper.removeEventListener("wheel", onWheel);
        wrapper.removeEventListener("pointerdown", onPointerDown);
        wrapper.removeEventListener("pointermove", onPointerMove);
        wrapper.removeEventListener("pointerup", onPointerUp);
        wrapper.removeEventListener("pointercancel", onPointerUp);
        wrapper.removeEventListener("selectstart", onSelectStart);
        wrapper.remove();
      },
    };
  },
};
