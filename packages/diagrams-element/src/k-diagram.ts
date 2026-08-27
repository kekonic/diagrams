import { LitElement, html, svg, css, nothing, type PropertyValues, type TemplateResult } from "lit";
import { listCompileTargets, parse } from "@kekonic/diagrams-core";
import type {
  AnimationListItem,
  AnimationPlayerState,
  InteractiveRenderOptions,
  RenderController,
  RenderStats,
  ThemeMode,
} from "@kekonic/diagrams";

const boolFromAttribute = {
  fromAttribute: (value: string | null) => value !== "false",
  toAttribute: (value: boolean) => (value ? "" : "false"),
};

function readSiteTheme(): ThemeMode {
  if (typeof document === "undefined") return "dark";
  return document.documentElement.dataset.theme === "light" ? "light" : "dark";
}

function resolveTheme(theme: ThemeMode | "auto"): ThemeMode {
  if (theme === "auto") return readSiteTheme();
  return theme;
}

function formatMs(ms: number): string {
  return ms >= 100 ? `${Math.round(ms)}ms` : `${ms.toFixed(1)}ms`;
}

function cssHeight(height: string | number): string {
  return typeof height === "number" ? `${height}px` : height;
}

const CONTROLS_IDLE_MS = 2_400;
const CONTROLS_LEAVE_MS = 400;

/**
 * Interactive Kekonic Diagrams diagram as a Lit custom element.
 * Wraps `KDiagram.renderToElement` — pan/zoom, theme, live `source` updates.
 */
export class KDiagramElement extends LitElement {
  static override properties = {
    source: { type: String },
    theme: { type: String },
    height: {},
    frameless: {
      type: Boolean,
      converter: boolFromAttribute,
      reflect: true,
    },
    showThemeToggle: {
      type: Boolean,
      attribute: "show-theme-toggle",
      converter: boolFromAttribute,
    },
    showViewControls: {
      type: Boolean,
      attribute: "show-view-controls",
      converter: boolFromAttribute,
    },
    showStats: {
      type: Boolean,
      attribute: "show-stats",
      converter: boolFromAttribute,
    },
    showAnimationControls: {
      type: Boolean,
      attribute: "animation-controls",
      converter: boolFromAttribute,
    },
    autoplay: {
      type: Boolean,
      converter: boolFromAttribute,
    },
    animationLoop: {
      type: Boolean,
      attribute: "loop",
      converter: boolFromAttribute,
    },
    animation: { type: String },
    view: { type: String, reflect: true },
    showViewSwitcher: {
      type: Boolean,
      attribute: "show-view-switcher",
      converter: boolFromAttribute,
    },
    options: { attribute: false },
  };

  static override styles = css`
    :host {
      display: flex;
      flex-direction: column;
      position: relative;
      box-sizing: border-box;
      width: 100%;
      height: 100%;
      min-height: 0;
      border: 1px solid var(--border, color-mix(in oklch, currentColor 18%, transparent));
      background: var(--kd-bg, var(--bg-panel, var(--bg, transparent)));
      color: var(--text, inherit);
      overflow: hidden;
      font-family: var(--font-ui, inherit);
    }

    :host([hidden]) {
      display: none !important;
    }

    :host(:fullscreen) {
      width: 100%;
      height: 100% !important;
      background: var(--kd-bg, var(--bg, #0b0f14));
      border: 0;
    }

    :host([frameless]:not([frameless="false"]):not(:fullscreen)) {
      border: 0;
      background: transparent;
    }

    :host([frameless]:not([frameless="false"]):not(:fullscreen)) .viewport {
      background: transparent;
    }

    .sr-only {
      position: absolute;
      width: 1px;
      height: 1px;
      padding: 0;
      margin: -1px;
      overflow: hidden;
      clip: rect(0, 0, 0, 0);
      white-space: nowrap;
      border: 0;
    }

    .error {
      margin: 0;
      padding: 0.55rem 0.75rem;
      border-bottom: 1px solid
        var(--border-soft, color-mix(in oklch, currentColor 12%, transparent));
      color: var(--danger, #f87171);
      font-size: 0.85rem;
    }

    .stage {
      position: relative;
      display: flex;
      flex-direction: column;
      flex: 1 1 0;
      min-height: 0;
      width: 100%;
      height: 100%;
    }

    .stage:focus {
      outline: none;
    }

    .viewport {
      position: relative;
      flex: 1 1 0;
      width: 100%;
      min-height: 0;
      background: var(--kd-bg, var(--bg, transparent));
      z-index: 0;
    }

    .viewport .kdiagram-viewport,
    .viewport .kdiagram-canvas,
    .viewport svg {
      width: 100%;
      height: 100%;
      display: block;
    }

    .overlay {
      position: absolute;
      z-index: 2;
      display: inline-flex;
      align-items: center;
      gap: 0.35rem;
      pointer-events: none;
      opacity: 1;
      transform: translateY(0);
      transition:
        opacity 180ms ease,
        transform 180ms ease;
    }

    .overlay > * {
      pointer-events: auto;
    }

    .stage[data-controls-visible="false"] .overlay {
      opacity: 0;
      pointer-events: none;
    }

    .stage[data-controls-visible="false"] .overlay > * {
      pointer-events: none;
    }

    .stage[data-controls-visible="false"] .overlay--tools {
      transform: translateY(-4px);
    }

    .stage[data-controls-visible="false"] .overlay--animation,
    .stage[data-controls-visible="false"] .overlay--stats {
      transform: translateY(4px);
    }

    .overlay--tools {
      top: 0.55rem;
      right: 0.55rem;
      padding: 0.15rem;
      border: 1px solid var(--border-soft, color-mix(in oklch, currentColor 12%, transparent));
      background: color-mix(in oklch, var(--bg-elevated, var(--bg, #111)) 92%, transparent);
    }

    .overlay--stats {
      left: 0.55rem;
      bottom: 0.55rem;
      padding: 0.2rem 0.45rem;
      border: 1px solid var(--border-soft, color-mix(in oklch, currentColor 12%, transparent));
      background: color-mix(in oklch, var(--bg-elevated, var(--bg, #111)) 88%, transparent);
      color: var(--text-muted, color-mix(in oklch, currentColor 70%, transparent));
      font-size: 0.68rem;
      font-variant-numeric: tabular-nums;
      gap: 0.55rem;
    }

    .tools {
      display: inline-flex;
      gap: 0.25rem;
    }

    .icon-btn {
      appearance: none;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 1.85rem;
      height: 1.85rem;
      padding: 0;
      border: 1px solid transparent;
      background: transparent;
      color: var(--text-muted, color-mix(in oklch, currentColor 70%, transparent));
      cursor: pointer;
      flex: 0 0 auto;
    }

    .icon-btn:hover {
      color: var(--text, inherit);
      border-color: var(--border, color-mix(in oklch, currentColor 18%, transparent));
      background: color-mix(in oklch, var(--bg-elevated, currentColor) 8%, transparent);
    }

    .icon-btn:focus-visible {
      color: var(--text, inherit);
      outline: none;
      border-color: var(--accent, #5b9fd4);
      box-shadow: 0 0 0 1px color-mix(in oklch, var(--accent, #5b9fd4) 55%, transparent);
    }

    .icon-btn svg {
      width: 16px;
      height: 16px;
      display: block;
      flex: none;
    }

    .overlay--animation {
      left: 0.55rem;
      right: 0.55rem;
      bottom: 0.55rem;
      justify-content: center;
    }

    .anim-bar {
      display: inline-flex;
      align-items: center;
      gap: 0.25rem;
      max-width: min(44rem, 100%);
      padding: 0.3rem 0.45rem;
      border: 1px solid var(--border-soft, color-mix(in oklch, currentColor 12%, transparent));
      background: color-mix(in oklch, var(--bg-elevated, var(--bg, #111)) 92%, transparent);
      color: var(--text, inherit);
      font-size: 0.72rem;
      font-variant-numeric: tabular-nums;
      border-radius: 0;
    }

    .anim-select {
      position: relative;
      display: inline-flex;
      align-items: center;
      gap: 0.28rem;
      height: 1.85rem;
      min-width: 0;
      max-width: 12rem;
      padding: 0 1.25rem 0 0.4rem;
      border: 1px solid transparent;
      border-radius: 0;
      background: transparent;
      color: var(--text-muted, color-mix(in oklch, currentColor 78%, transparent));
      flex: 0 1 auto;
      box-sizing: border-box;
    }

    .anim-select--speed {
      max-width: 4.75rem;
      padding-left: 0.4rem;
    }

    .model-view-select {
      max-width: 10rem;
      margin-right: 0.15rem;
    }

    .anim-select:hover {
      color: var(--text, inherit);
      border-color: var(--border, color-mix(in oklch, currentColor 18%, transparent));
      background: color-mix(in oklch, var(--bg-elevated, currentColor) 8%, transparent);
    }

    /* Keyboard focus only — mouse/open must not stack a second system ring. */
    .anim-select:has(select:focus-visible) {
      color: var(--text, inherit);
      border-color: var(--accent, #5b9fd4);
      background: color-mix(in oklch, var(--bg-elevated, currentColor) 8%, transparent);
      outline: none;
      box-shadow: 0 0 0 1px color-mix(in oklch, var(--accent, #5b9fd4) 55%, transparent);
    }

    .anim-select__glyph {
      display: inline-flex;
      flex: 0 0 auto;
      opacity: 0.8;
      pointer-events: none;
      color: inherit;
    }

    .anim-select__glyph svg {
      width: 14px;
      height: 14px;
      display: block;
    }

    .anim-select select {
      appearance: none;
      -webkit-appearance: none;
      -moz-appearance: none;
      border: 0;
      background: transparent;
      color: inherit;
      font: inherit;
      font-size: inherit;
      line-height: 1.2;
      padding: 0;
      margin: 0;
      min-width: 0;
      max-width: 100%;
      flex: 1 1 auto;
      cursor: pointer;
      outline: none;
      box-shadow: none;
    }

    .anim-select select:focus,
    .anim-select select:focus-visible,
    .anim-select select:active {
      outline: none;
      outline-offset: 0;
      box-shadow: none;
      border: 0;
    }

    .anim-select select::-moz-focus-inner {
      border: 0;
    }

    .anim-select__caret {
      position: absolute;
      right: 0.3rem;
      top: 50%;
      transform: translateY(-50%);
      display: inline-flex;
      pointer-events: none;
      opacity: 0.75;
      color: inherit;
    }

    .anim-select__caret svg {
      width: 12px;
      height: 12px;
      display: block;
    }

    .anim-scrub {
      -webkit-appearance: none;
      appearance: none;
      width: min(14rem, 32vw);
      height: 1.85rem;
      margin: 0 0.25rem;
      background: transparent;
      cursor: pointer;
      flex: 1 1 auto;
      min-width: 6rem;
      border-radius: 0;
    }

    .anim-scrub:focus {
      outline: none;
    }

    .anim-scrub:focus-visible {
      box-shadow: 0 0 0 1px var(--accent, #5b9fd4);
    }

    .anim-scrub::-webkit-slider-runnable-track {
      height: 6px;
      border-radius: 0;
      background: color-mix(in oklch, var(--text, currentColor) 16%, transparent);
    }

    .anim-scrub::-webkit-slider-thumb {
      -webkit-appearance: none;
      appearance: none;
      width: 12px;
      height: 12px;
      margin-top: -3px;
      border-radius: 0;
      border: 2px solid var(--bg-elevated, var(--bg, #111));
      background: var(--accent, #b38eee);
      box-shadow: 0 0 0 1px color-mix(in oklch, var(--accent, #b38eee) 55%, transparent);
    }

    .anim-scrub::-moz-range-track {
      height: 6px;
      border-radius: 0;
      background: color-mix(in oklch, var(--text, currentColor) 16%, transparent);
    }

    .anim-scrub::-moz-range-thumb {
      width: 12px;
      height: 12px;
      border-radius: 0;
      border: 2px solid var(--bg-elevated, var(--bg, #111));
      background: var(--accent, #b38eee);
      box-shadow: 0 0 0 1px color-mix(in oklch, var(--accent, #b38eee) 55%, transparent);
    }

    .anim-time {
      color: var(--text-muted, color-mix(in oklch, currentColor 70%, transparent));
      min-width: 4.5rem;
      text-align: center;
    }

    .icon-btn.is-pressed,
    .icon-btn[aria-pressed="true"] {
      color: var(--accent-contrast, #0b0f14);
      background: var(--accent, #b38eee);
      border-color: var(--accent, #b38eee);
    }

    .icon-btn.is-pressed:hover,
    .icon-btn[aria-pressed="true"]:hover {
      color: var(--accent-contrast, #0b0f14);
      background: color-mix(in oklch, var(--accent, #b38eee) 85%, white);
    }

    @media (prefers-reduced-motion: reduce) {
      .overlay {
        transition: none;
      }
    }
  `;

  source = "";
  theme: ThemeMode | "auto" = "auto";
  height: string | number = 420;
  /** Remove the host border and panel background for ambient or page-level compositions. */
  frameless = false;
  showThemeToggle = true;
  showViewControls = true;
  showStats = false;
  /** Animation chrome when an animation exists (auto or authored). Default on. */
  showAnimationControls = true;
  autoplay = false;
  animationLoop = false;
  /** Preferred authored animation name or id. */
  animation = "";
  /** Named model view for `kdiagram 2` files (`context`, `containers`, …). */
  view = "";
  /** Lens picker when the source exposes multiple model views. Default on. */
  showViewSwitcher = true;
  options?: Omit<InteractiveRenderOptions, "theme">;

  #controller: RenderController | null = null;
  #modelViews: Array<{ viewName: string; title: string }> = [];
  #mountGen = 0;
  #appliedTheme: ThemeMode | null = null;
  #themeObserver: MutationObserver | null = null;
  #activeTheme: ThemeMode = "dark";
  #ready = false;
  #busy = false;
  #error: string | null = null;
  #stats: RenderStats | null = null;
  #isFullscreen = false;
  #controlsVisible = true;
  #controlsIdleTimer: ReturnType<typeof setTimeout> | null = null;
  #animList: AnimationListItem[] = [];
  #animState: AnimationPlayerState = {
    id: null,
    playing: false,
    timeMs: 0,
    durationMs: 0,
    loop: false,
    speed: 1,
  };
  #animUnsub: (() => void) | null = null;
  #onFullscreenChange = () => {
    this.#isFullscreen = document.fullscreenElement != null && document.fullscreenElement === this;
    this.requestUpdate();
    requestAnimationFrame(() => {
      requestAnimationFrame(() => this.#controller?.fit());
    });
  };

  override connectedCallback(): void {
    super.connectedCallback();
    this.#syncHostHeight();
    document.addEventListener("fullscreenchange", this.#onFullscreenChange);
    this.#watchAutoTheme();
    // Remount after reconnect (firstUpdated only runs once).
    if (this.hasUpdated) void this.#mountController();
  }

  override disconnectedCallback(): void {
    document.removeEventListener("fullscreenchange", this.#onFullscreenChange);
    this.#themeObserver?.disconnect();
    this.#themeObserver = null;
    this.#clearControlsIdleTimer();
    this.#destroyController();
    super.disconnectedCallback();
  }

  override firstUpdated(): void {
    this.#syncModelViews();
    this.#revealControls();
    void this.#mountController();
  }

  override updated(changed: PropertyValues): void {
    if (changed.has("height")) {
      this.#syncHostHeight();
      if (this.#ready) requestAnimationFrame(() => this.#controller?.fit());
    }
    if (changed.has("theme")) {
      this.#watchAutoTheme();
      void this.#applyTheme();
    }
    if ((changed.has("source") || changed.has("options")) && this.#ready) {
      if (changed.has("source")) this.#syncModelViews();
      void this.#applySource();
    }
    if (changed.has("view") && this.#ready) {
      void this.#applySource();
      this.#emitViewChange(this.view || undefined);
    }
    if (
      this.#ready &&
      (changed.has("autoplay") ||
        changed.has("animationLoop") ||
        changed.has("animation") ||
        changed.has("showAnimationControls"))
    ) {
      this.#syncAnimationHostPrefs();
    }
  }

  /** Height lives on the host so flex parents (playground) can fill the pane. */
  #syncHostHeight(): void {
    this.style.height = cssHeight(this.height);
  }

  /** Resolves when the first interactive render finishes. */
  async ready(): Promise<void> {
    await this.updateComplete;
    if (!this.#controller) await this.#mountController();
    if (!this.#controller) {
      throw new Error(this.#error ?? "k-diagram failed to mount");
    }
    await this.#controller.ready();
  }

  fit(): void {
    this.#controller?.fit();
  }

  zoomIn(): void {
    this.#controller?.zoomIn();
  }

  zoomOut(): void {
    this.#controller?.zoomOut();
  }

  resetView(): void {
    this.#controller?.resetView();
  }

  /** Interactive animation controller (auto path or authored blocks). */
  get animations() {
    return this.#controller?.animations;
  }

  /**
   * Re-apply the current theme name (picks up `registerTheme` token updates
   * even when the theme id is unchanged).
   */
  async refreshTheme(): Promise<void> {
    if (!this.#ready || !this.#controller) return;
    const next = resolveTheme(this.theme === "auto" ? "auto" : this.theme);
    this.#activeTheme = next;
    this.#appliedTheme = next;
    const result = await this.#controller.setTheme(next);
    this.#stats = result.stats;
    this.#emitRender(result);
    this.requestUpdate();
    requestAnimationFrame(() => this.#controller?.fit());
  }

  #emitRender(result: import("@kekonic/diagrams").RenderResult): void {
    this.dispatchEvent(
      new CustomEvent("kdiagram-render", {
        detail: result,
        bubbles: true,
        composed: true,
      }),
    );
  }

  #emitViewChange(view: string | undefined): void {
    this.dispatchEvent(
      new CustomEvent("kdiagram-view-change", {
        detail: { view },
        bubbles: true,
        composed: true,
      }),
    );
  }

  #syncModelViews(): void {
    const ast = parse(this.source);
    this.#modelViews = listCompileTargets(ast)
      .filter((target) => target.kind === "model-view" && target.viewName)
      .map((target) => ({
        viewName: target.viewName!,
        title: target.title ?? target.viewName!,
      }));
    if (
      this.#modelViews.length > 0 &&
      this.view &&
      !this.#modelViews.some((entry) => entry.viewName === this.view)
    ) {
      this.view = this.#modelViews[0]!.viewName;
    }
  }

  #compileOptions(): Omit<InteractiveRenderOptions, "theme"> {
    const view = this.options?.view ?? this.view;
    return view ? { ...this.options, view } : { ...this.options };
  }

  #onViewSelect(event: Event): void {
    const value = (event.target as HTMLSelectElement).value;
    this.view = value;
  }

  #showModelViewSwitcher(): boolean {
    return this.showViewSwitcher && this.#modelViews.length > 1;
  }

  #bindAnimations(controller: RenderController): void {
    this.#animUnsub?.();
    this.#animList = controller.animations.list();
    let lastUiMs = 0;
    let lastSig = "";
    this.#animUnsub = controller.animations.subscribe((state) => {
      this.#animState = state;
      this.#animList = controller.animations.list();
      this.dispatchEvent(
        new CustomEvent("kdiagram-animation-timeupdate", {
          detail: state,
          bubbles: true,
          composed: true,
        }),
      );
      const sig = `${state.id}|${state.playing}|${state.loop}|${state.speed}|${state.durationMs}`;
      const now = performance.now();
      // Always refresh on control-state changes; throttle scrubber text while playing.
      if (sig !== lastSig || !state.playing || now - lastUiMs > 50) {
        lastSig = sig;
        lastUiMs = now;
        this.requestUpdate();
      }
    });
    this.#syncAnimationHostPrefs();
  }

  #syncAnimationHostPrefs(): void {
    const anim = this.#controller?.animations;
    if (!anim) return;
    this.#animList = anim.list();
    if (this.animationLoop) anim.setLoop(true);
    const preferred = (this.animation ?? "").trim();
    if (preferred) {
      const match = this.#animList.find(
        (a) => a.id === preferred || a.name.toLowerCase() === preferred.toLowerCase(),
      );
      if (match && this.#animState.id !== match.id) {
        anim.play(match.id);
        if (!this.autoplay) anim.pause();
        this.dispatchEvent(
          new CustomEvent("kdiagram-animation-change", {
            detail: { id: match.id },
            bubbles: true,
            composed: true,
          }),
        );
      }
    }
    if (this.autoplay && this.#animList.length > 0) {
      anim.play(this.#animState.id ?? this.#animList[0]!.id);
    }
  }

  #onAnimKeydown = (e: KeyboardEvent): void => {
    if (!this.showAnimationControls || this.#animList.length === 0) return;
    const anim = this.#controller?.animations;
    if (!anim) return;
    if (e.key === " " || e.code === "Space") {
      e.preventDefault();
      if (this.#animState.playing) anim.pause();
      else anim.play();
    } else if (e.key === "ArrowRight") {
      e.preventDefault();
      anim.step(1);
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      anim.step(-1);
    }
  };

  #clearControlsIdleTimer(): void {
    if (this.#controlsIdleTimer == null) return;
    clearTimeout(this.#controlsIdleTimer);
    this.#controlsIdleTimer = null;
  }

  #scheduleControlsHide(delay = CONTROLS_IDLE_MS): void {
    this.#clearControlsIdleTimer();
    this.#controlsIdleTimer = setTimeout(() => {
      this.#controlsIdleTimer = null;
      const root = this.renderRoot;
      const focused = root instanceof ShadowRoot ? root.activeElement : null;
      if (focused instanceof Element && focused.closest(".overlay")) return;
      this.#controlsVisible = false;
      this.requestUpdate();
    }, delay);
  }

  #revealControls(persist = false): void {
    if (!this.#controlsVisible) {
      this.#controlsVisible = true;
      this.requestUpdate();
    }
    this.#clearControlsIdleTimer();
    if (!persist) this.#scheduleControlsHide();
  }

  #onStagePointerActivity = (): void => {
    this.#revealControls();
  };

  #onStagePointerLeave = (): void => {
    this.#scheduleControlsHide(CONTROLS_LEAVE_MS);
  };

  #onStageFocusIn = (event: FocusEvent): void => {
    // Keep chrome visible while a real control has focus. The stage itself is
    // focusable for keyboard playback, but should still become idle.
    this.#revealControls(event.target !== event.currentTarget);
  };

  #onStageFocusOut = (): void => {
    queueMicrotask(() => {
      const root = this.renderRoot;
      const focused = root instanceof ShadowRoot ? root.activeElement : null;
      if (focused instanceof Element && focused.closest(".overlay")) return;
      this.#scheduleControlsHide(CONTROLS_LEAVE_MS);
    });
  };

  #onStageKeydown = (event: KeyboardEvent): void => {
    this.#revealControls(event.target !== event.currentTarget);
    this.#onAnimKeydown(event);
  };

  /** Pan/zoom the canvas should release select/scrub focus like clicking the page backdrop. */
  #onStagePointerDown = (e: PointerEvent): void => {
    this.#revealControls();
    const onChrome = e
      .composedPath()
      .some(
        (n) =>
          n instanceof Element &&
          (n.classList.contains("overlay--animation") ||
            n.classList.contains("overlay--tools") ||
            n.classList.contains("overlay--stats")),
      );
    if (onChrome) return;

    const root = this.renderRoot;
    const focused = root instanceof ShadowRoot ? root.activeElement : null;
    if (focused instanceof HTMLElement) focused.blur();

    const stage = e.currentTarget;
    if (stage instanceof HTMLElement) stage.focus({ preventScroll: true });
  };

  #watchAutoTheme(): void {
    this.#themeObserver?.disconnect();
    this.#themeObserver = null;
    if (this.theme === "auto") {
      this.#activeTheme = readSiteTheme();
      this.#themeObserver = new MutationObserver(() => {
        const next = readSiteTheme();
        if (next === this.#activeTheme) return;
        this.#activeTheme = next;
        void this.#applyTheme();
        this.requestUpdate();
      });
      this.#themeObserver.observe(document.documentElement, {
        attributes: true,
        attributeFilter: ["data-theme"],
      });
    } else {
      this.#activeTheme = resolveTheme(this.theme);
    }
  }

  #viewport(): HTMLElement | null {
    return this.renderRoot.querySelector<HTMLElement>(".viewport");
  }

  #destroyController(): void {
    this.#animUnsub?.();
    this.#animUnsub = null;
    this.#animList = [];
    this.#mountGen += 1;
    this.#controller?.destroy();
    this.#controller = null;
    this.#ready = false;
    this.#appliedTheme = null;
  }

  async #mountController(): Promise<void> {
    const viewport = this.#viewport();
    if (!viewport || !this.isConnected) return;

    const gen = ++this.#mountGen;
    this.#animUnsub?.();
    this.#animUnsub = null;
    this.#controller?.destroy();
    this.#controller = null;
    this.#ready = false;
    this.#appliedTheme = null;

    try {
      const { KDiagram } = await import("@kekonic/diagrams");
      try {
        await KDiagram.ensureFonts();
      } catch {
        // Font URLs may be unavailable in some test/SSR hosts; layout still runs.
      }
      if (gen !== this.#mountGen || !this.isConnected) return;

      const host = this.#viewport();
      if (!host) return;
      host.replaceChildren();

      const mountedSource = this.source;
      const theme = resolveTheme(this.theme === "auto" ? "auto" : this.theme);
      this.#activeTheme = theme;

      const controller = KDiagram.renderToElement(mountedSource, host, {
        ...this.#compileOptions(),
        theme,
      });
      if (gen !== this.#mountGen) {
        controller.destroy();
        return;
      }

      this.#controller = controller;
      const result = await controller.ready();
      if (gen !== this.#mountGen) return;

      this.#appliedTheme = theme;
      this.#stats = result.stats;
      this.#ready = true;
      this.#error = result.ok ? null : (result.diagnostics[0]?.message ?? "Render failed");
      this.#bindAnimations(controller);
      this.#emitRender(result);
      this.requestUpdate();
      requestAnimationFrame(() => controller.fit());
    } catch (err) {
      if (gen !== this.#mountGen) return;
      this.#error = err instanceof Error ? err.message : String(err);
      this.requestUpdate();
    }
  }

  async #applyTheme(): Promise<void> {
    if (!this.#ready || !this.#controller) return;
    const next = resolveTheme(this.theme === "auto" ? "auto" : this.theme);
    this.#activeTheme = next;
    if (this.#appliedTheme === next) {
      this.requestUpdate();
      return;
    }
    this.#appliedTheme = next;
    const result = await this.#controller.setTheme(next);
    this.#stats = result.stats;
    this.#emitRender(result);
    this.requestUpdate();
    requestAnimationFrame(() => this.#controller?.fit());
  }

  async #applySource(): Promise<void> {
    const controller = this.#controller;
    if (!this.#ready || !controller) return;
    this.#busy = true;
    this.requestUpdate();
    try {
      const result = await controller.update(this.source, this.#compileOptions());
      this.#stats = result.stats;
      this.#error = result.ok ? null : (result.diagnostics[0]?.message ?? "Update failed");
      this.#animList = controller.animations.list();
      this.#syncAnimationHostPrefs();
      this.#emitRender(result);
      requestAnimationFrame(() => controller.fit());
    } catch (err) {
      this.#error = err instanceof Error ? err.message : String(err);
    } finally {
      this.#busy = false;
      this.requestUpdate();
    }
  }

  async #toggleFullscreen(): Promise<void> {
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      } else {
        await this.requestFullscreen();
      }
    } catch {
      // Fullscreen may be blocked by the host page.
    }
  }

  #toggleTheme(): void {
    this.theme = this.#activeTheme === "dark" ? "light" : "dark";
  }

  #icon(paths: TemplateResult | TemplateResult[], size = 16): TemplateResult {
    return html`
      <svg
        width=${size}
        height=${size}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="1.75"
        stroke-linecap="round"
        stroke-linejoin="round"
        aria-hidden="true"
      >
        ${paths}
      </svg>
    `;
  }

  override render() {
    const panHint = this.#busy
      ? "Updating…"
      : this.options?.zoomOnWheel === "always"
        ? "Drag to pan / scroll to zoom"
        : "Drag to pan / Ctrl or ⌘ plus scroll to zoom";
    const showTools =
      this.showThemeToggle || this.showViewControls || this.#showModelViewSwitcher();
    const showModelViews = this.#showModelViewSwitcher();
    const showStatsBadge = this.showStats && this.#stats;
    const showAnim =
      this.showAnimationControls && this.#animList.length > 0 && this.#controller != null;
    const duration = Math.max(this.#animState.durationMs, 1);
    const timeLabel = `${formatAnimClock(this.#animState.timeMs)} / ${formatAnimClock(this.#animState.durationMs)}`;

    return html`
      <span class="sr-only">Live diagram. ${panHint}.</span>
      ${this.#error ? html`<p class="error" role="status">${this.#error}</p>` : nothing}
      <div
        class="stage"
        data-controls-visible=${String(this.#controlsVisible)}
        tabindex="0"
        @keydown=${this.#onStageKeydown}
        @pointerdown=${this.#onStagePointerDown}
        @pointermove=${this.#onStagePointerActivity}
        @pointerenter=${this.#onStagePointerActivity}
        @pointerleave=${this.#onStagePointerLeave}
        @focusin=${this.#onStageFocusIn}
        @focusout=${this.#onStageFocusOut}
      >
        <div class="viewport" data-theme=${this.#activeTheme}></div>
        ${
          showStatsBadge && this.#stats
            ? html`
                <div
                  class="overlay overlay--stats"
                  aria-label="${this.#stats.layoutAlgorithm} / ${this.#stats.routerAlgorithm}"
                >
                  <span>${this.#stats.nodeCount}n</span>
                  <span>${this.#stats.edgeCount}e</span>
                  <span>${formatMs(this.#stats.totalMs)}</span>
                </div>
              `
            : nothing
        }
        ${
          showAnim
            ? html`
                <div
                  class="overlay overlay--animation"
                  role="toolbar"
                  aria-label="Animation controls"
                >
                  <div class="anim-bar">
                    ${
                      this.#animList.length > 1
                        ? html`
                            <label class="anim-select">
                              <span class="anim-select__glyph" aria-hidden="true">
                                ${this.#icon(
                                  [
                                    svg`<path d="M20.2 6 3 11l-.9-2.4c-.3-1.1.3-2.2 1.3-2.5l13.5-4c1.1-.3 2.2.3 2.5 1.3Z"></path>`,
                                    svg`<path d="m6.2 5.3 3.1 3.9"></path>`,
                                    svg`<path d="m12.4 3.4 3.1 4"></path>`,
                                    svg`<path d="M3 11h18v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z"></path>`,
                                  ],
                                  14,
                                )}
                              </span>
                              <select
                                aria-label="Animation"
                                @change=${(e: Event) => {
                                  const id = (e.target as HTMLSelectElement).value;
                                  this.#controller?.animations.play(id);
                                  this.dispatchEvent(
                                    new CustomEvent("kdiagram-animation-change", {
                                      detail: { id },
                                      bubbles: true,
                                      composed: true,
                                    }),
                                  );
                                }}
                              >
                                ${this.#animList.map(
                                  (a) => html`
                                    <option
                                      value=${a.id}
                                      ?selected=${
                                        a.id === (this.#animState.id ?? this.#animList[0]?.id)
                                      }
                                    >
                                      ${a.name}
                                    </option>
                                  `,
                                )}
                              </select>
                              <span class="anim-select__caret" aria-hidden="true">
                                ${this.#icon(svg`<path d="M6 9l6 6 6-6"></path>`, 12)}
                              </span>
                            </label>
                          `
                        : nothing
                    }
                    <button
                      type="button"
                      class="icon-btn"
                      aria-label="Previous step"
                      @click=${() => this.#controller?.animations.step(-1)}
                    >
                      ${this.#icon(svg`<path d="M15 18l-6-6 6-6"></path>`)}
                    </button>
                    <button
                      type="button"
                      class="icon-btn"
                      aria-label=${this.#animState.playing ? "Pause" : "Play"}
                      @click=${() => {
                        if (this.#animState.playing) this.#controller?.animations.pause();
                        else this.#controller?.animations.play();
                      }}
                    >
                      ${
                        this.#animState.playing
                          ? this.#icon(
                              svg`<path d="M6 4h4v16H6zM14 4h4v16h-4z" fill="currentColor" stroke="none"></path>`,
                            )
                          : this.#icon(
                              svg`<path d="M8 5v14l11-7z" fill="currentColor" stroke="none"></path>`,
                            )
                      }
                    </button>
                    <button
                      type="button"
                      class="icon-btn"
                      aria-label="Next step"
                      @click=${() => this.#controller?.animations.step(1)}
                    >
                      ${this.#icon(svg`<path d="M9 18l6-6-6-6"></path>`)}
                    </button>
                    <input
                      class="anim-scrub"
                      type="range"
                      min="0"
                      max=${duration}
                      step="16"
                      .value=${String(this.#animState.timeMs)}
                      aria-label="Scrub animation"
                      @input=${(e: Event) => {
                        const ms = Number((e.target as HTMLInputElement).value);
                        this.#controller?.animations.seek(ms);
                      }}
                    />
                    <span class="anim-time">${timeLabel}</span>
                    <label class="anim-select anim-select--speed">
                      <select
                        aria-label="Playback speed"
                        @change=${(e: Event) => {
                          const rate = Number((e.target as HTMLSelectElement).value);
                          this.#controller?.animations.setSpeed(rate);
                        }}
                      >
                        ${SPEED_OPTIONS.map((rate) => {
                          const value = formatSpeedValue(rate);
                          return html`
                            <option
                              value=${value}
                              ?selected=${value === formatSpeedValue(this.#animState.speed)}
                            >
                              ${formatSpeedLabel(rate)}
                            </option>
                          `;
                        })}
                      </select>
                      <span class="anim-select__caret" aria-hidden="true">
                        ${this.#icon(svg`<path d="M6 9l6 6 6-6"></path>`, 12)}
                      </span>
                    </label>
                    <button
                      type="button"
                      class="icon-btn ${this.#animState.loop ? "is-pressed" : ""}"
                      aria-label=${this.#animState.loop ? "Loop on" : "Loop off"}
                      aria-pressed=${this.#animState.loop ? "true" : "false"}
                      title=${this.#animState.loop ? "Loop on" : "Loop off"}
                      @click=${() => this.#controller?.animations.setLoop(!this.#animState.loop)}
                    >
                      ${this.#icon(
                        svg`<path d="M17 1l4 4-4 4M3 11V9a4 4 0 0 1 4-4h14M7 23l-4-4 4-4M21 13v2a4 4 0 0 1-4 4H3"></path>`,
                      )}
                    </button>
                  </div>
                </div>
              `
            : nothing
        }
        ${
          showTools
            ? html`
                <div class="overlay overlay--tools" role="toolbar" aria-label="Diagram controls">
                  ${
                    showModelViews
                      ? html`
                          <label class="anim-select model-view-select">
                            <span class="sr-only">Model view</span>
                            <select
                              aria-label="Model view"
                              .value=${this.view || this.#modelViews[0]?.viewName || ""}
                              @change=${this.#onViewSelect}
                            >
                              ${this.#modelViews.map(
                                (entry) => html`
                                  <option value=${entry.viewName}>${entry.title}</option>
                                `,
                              )}
                            </select>
                            <span class="anim-select__caret" aria-hidden="true">
                              ${this.#icon(svg`<path d="M6 9l6 6 6-6"></path>`, 12)}
                            </span>
                          </label>
                        `
                      : nothing
                  }
                  ${
                    this.showViewControls
                      ? html`
                          <div class="tools" role="group" aria-label="View">
                            <button
                              type="button"
                              class="icon-btn"
                              aria-label="Zoom out"
                              @click=${() => this.zoomOut()}
                            >
                              ${this.#icon(svg`<path d="M5 12h14"></path>`)}
                            </button>
                            <button
                              type="button"
                              class="icon-btn"
                              aria-label="Zoom in"
                              @click=${() => this.zoomIn()}
                            >
                              ${this.#icon(svg`<path d="M12 5v14M5 12h14"></path>`)}
                            </button>
                            <button
                              type="button"
                              class="icon-btn"
                              aria-label="Fit to view"
                              @click=${() => this.fit()}
                            >
                              ${this.#icon(
                                svg`<path d="M8 3H5a2 2 0 0 0-2 2v3M16 3h3a2 2 0 0 1 2 2v3M8 21H5a2 2 0 0 1-2-2v-3M16 21h3a2 2 0 0 0 2-2v-3"></path>`,
                              )}
                            </button>
                            <button
                              type="button"
                              class="icon-btn"
                              aria-label=${this.#isFullscreen ? "Exit fullscreen" : "Fullscreen"}
                              @click=${() => void this.#toggleFullscreen()}
                            >
                              ${
                                this.#isFullscreen
                                  ? this.#icon(
                                      svg`<path d="M4 14h6v6M20 10h-6V4M14 10l7-7M3 21l7-7"></path>`,
                                    )
                                  : this.#icon(
                                      svg`<path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"></path>`,
                                    )
                              }
                            </button>
                          </div>
                        `
                      : nothing
                  }
                  ${
                    this.showThemeToggle
                      ? html`
                          <button
                            type="button"
                            class="icon-btn"
                            aria-label=${
                              this.#activeTheme === "dark"
                                ? "Switch to light theme"
                                : "Switch to dark theme"
                            }
                            @click=${() => this.#toggleTheme()}
                          >
                            ${
                              this.#activeTheme === "dark"
                                ? this.#icon([
                                    svg`<circle cx="12" cy="12" r="4"></circle>`,
                                    svg`<path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"></path>`,
                                  ])
                                : this.#icon(
                                    svg`<path d="M21 14.5A8.5 8.5 0 1 1 9.5 3a7 7 0 0 0 11.5 11.5z"></path>`,
                                  )
                            }
                          </button>
                        `
                      : nothing
                  }
                </div>
              `
            : nothing
        }
      </div>
    `;
  }
}

function formatAnimClock(ms: number): string {
  const total = Math.max(0, Math.round(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

const SPEED_OPTIONS = [0.5, 0.75, 1, 1.25, 1.5, 2] as const;

function formatSpeedValue(rate: number): string {
  const snapped =
    SPEED_OPTIONS.find((o) => Math.abs(o - rate) < 0.01) ??
    SPEED_OPTIONS.reduce((best, o) => (Math.abs(o - rate) < Math.abs(best - rate) ? o : best));
  return String(snapped);
}

function formatSpeedLabel(rate: number): string {
  return `${rate}×`;
}

declare global {
  interface HTMLElementTagNameMap {
    "k-diagram": KDiagramElement;
  }
}
