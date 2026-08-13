import {
  lazy,
  Suspense,
  useEffect,
  useId,
  useRef,
  useState,
  type CSSProperties,
  type UIEvent,
} from "react";
import type { ThemeMode } from "@kekonic/diagrams";
import type { KDiagramLiveProps } from "./KDiagramLive.tsx";

const KDiagramLive = lazy(async () => {
  const mod = await import("./KDiagramLive.tsx");
  return { default: mod.KDiagramLive };
});

/** Kick off Shiki as soon as this island module evaluates (still lazy vs the page). */
const highlightModule = import("../shiki/highlight.ts");

export type KDiagramPlaygroundProps = {
  /** Initial KDiagram source (also the Reset target). */
  source: string;
  theme?: ThemeMode | "auto";
  className?: string;
  /** Remove the live diagram's host border and panel background. */
  frameless?: boolean;
  /** Source pane + diagram side-by-side, stacked, or gallery (diagram-first). */
  layout?: "split" | "stacked" | "gallery";
  /** Debounce before `controller.update` (ms). */
  debounceMs?: number;
  editable?: boolean;
  showThemeToggle?: boolean;
  showViewControls?: boolean;
  showStats?: boolean;
  showAnimationControls?: boolean;
  autoplay?: boolean;
  animationLoop?: boolean;
  animation?: string;
  /**
   * Playground root height — both panes stretch to fill.
   * Diagram viewport flexes inside; no separate short editor box.
   */
  height?: number | string;
  /**
   * Minimum height for the source editor region when the root is not stretched
   * (e.g. stacked layout without an explicit `height`).
   */
  editorHeight?: number | string;
  options?: KDiagramLiveProps["options"];
};

function escapeHtml(text: string): string {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function cssSize(value: number | string): string {
  return typeof value === "number" ? `${value}px` : value;
}

function copyTextFallback(text: string): boolean {
  const input = document.createElement("textarea");
  input.value = text;
  input.setAttribute("readonly", "");
  input.style.position = "fixed";
  input.style.opacity = "0";
  document.body.append(input);
  input.select();
  const copied = document.execCommand("copy");
  input.remove();
  return copied;
}

/**
 * Docs dogfood embed: editable KDiagram source (Shiki) + live diagram (`KDiagramLive`).
 * Shiki and the render path load lazily on mount / first highlight.
 */
export function KDiagramPlayground({
  source,
  theme = "auto",
  className,
  frameless = false,
  layout = "split",
  debounceMs = 280,
  editable = true,
  showThemeToggle = true,
  showViewControls = true,
  showStats = false,
  showAnimationControls = true,
  autoplay = false,
  animationLoop = false,
  animation,
  height = 360,
  editorHeight = 280,
  options,
}: KDiagramPlaygroundProps) {
  const [draft, setDraft] = useState(source);
  const [liveSource, setLiveSource] = useState(source);
  const [highlightHtml, setHighlightHtml] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const [actionStatus, setActionStatus] = useState("");
  const highlightRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const labelId = useId();
  const sourceGen = useRef(0);

  useEffect(() => {
    setDraft(source);
    setLiveSource(source);
    setDirty(false);
  }, [source]);

  useEffect(() => {
    if (draft === liveSource) return;
    const t = window.setTimeout(() => setLiveSource(draft), debounceMs);
    return () => window.clearTimeout(t);
  }, [draft, liveSource, debounceMs]);

  useEffect(() => {
    let cancelled = false;
    const gen = ++sourceGen.current;
    // Plain text first; upgrade once the module-level Shiki import resolves.
    setHighlightHtml(`<pre><code>${escapeHtml(draft)}</code></pre>`);
    void (async () => {
      try {
        const { highlightKDiagram } = await highlightModule;
        const html = await highlightKDiagram(draft);
        if (!cancelled && gen === sourceGen.current) setHighlightHtml(html);
      } catch {
        // Keep plain text if Shiki cannot load in this host.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [draft]);

  const syncScroll = (event: UIEvent<HTMLTextAreaElement>) => {
    const pre = highlightRef.current;
    if (!pre) return;
    pre.scrollTop = event.currentTarget.scrollTop;
    pre.scrollLeft = event.currentTarget.scrollLeft;
  };

  const reset = () => {
    setDraft(source);
    setLiveSource(source);
    setDirty(false);
    inputRef.current?.focus();
  };

  const copySource = async () => {
    let copied = false;
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(draft);
        copied = true;
      } else {
        copied = copyTextFallback(draft);
      }
    } catch {
      copied = copyTextFallback(draft);
    }
    setActionStatus(copied ? "Copied source" : "Could not copy source");
    window.setTimeout(() => setActionStatus(""), 1_500);
  };

  const downloadSvg = async () => {
    const { KDiagram } = await import("@kekonic/diagrams");
    const resolvedTheme =
      theme === "auto"
        ? document.documentElement.dataset.theme === "light"
          ? "light"
          : "dark"
        : theme;
    const result = await KDiagram.renderToSvg(draft, {
      ...options,
      theme: resolvedTheme,
      snapshotTheme: true,
    });
    if (!result.ok || !result.svg) {
      setActionStatus("Fix diagram errors before downloading");
      return;
    }
    const url = URL.createObjectURL(new Blob([result.svg], { type: "image/svg+xml" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = "diagram.svg";
    document.body.append(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
    setActionStatus("Downloaded SVG");
    window.setTimeout(() => setActionStatus(""), 1_500);
  };

  const rootStyle = {
    height: cssSize(height),
    "--kd-play-editor-min": cssSize(editorHeight),
  } as CSSProperties;

  const hint = editable ? "Edit source — diagram updates live" : "Source + live diagram";

  return (
    <div
      className={["kd-play", className].filter(Boolean).join(" ")}
      style={rootStyle}
      title={hint}
      aria-labelledby={labelId}
    >
      <span id={labelId} className="kd-play__sr-only">
        {hint}
      </span>
      <div className="kd-play__body" data-layout={layout}>
        <div className="kd-play__source">
          <div className="kd-play__pane-bar">
            <span className="kd-play__label">Source</span>
            <div className="kd-play__actions">
              <button type="button" className="kd-play__btn" onClick={() => void copySource()}>
                Copy source
              </button>
              <button type="button" className="kd-play__btn" onClick={() => void downloadSvg()}>
                Download SVG
              </button>
              {editable ? (
                <button type="button" className="kd-play__btn" disabled={!dirty} onClick={reset}>
                  Reset
                </button>
              ) : null}
            </div>
            <span className="kd-play__sr-only" role="status" aria-live="polite">
              {actionStatus}
            </span>
          </div>
          <div className="kd-play__editor">
            <div
              ref={highlightRef}
              className="kd-play__highlight"
              aria-hidden
              dangerouslySetInnerHTML={{
                __html: highlightHtml ?? `<pre><code>${escapeHtml(draft)}</code></pre>`,
              }}
            />
            {editable ? (
              <textarea
                ref={inputRef}
                className="kd-play__input"
                value={draft}
                spellCheck={false}
                autoCapitalize="off"
                autoCorrect="off"
                aria-label="KDiagram source"
                onScroll={syncScroll}
                onChange={(event) => {
                  setDraft(event.target.value);
                  setDirty(event.target.value !== source);
                }}
              />
            ) : null}
          </div>
        </div>
        <div className="kd-play__diagram">
          <Suspense fallback={<div className="kd-play__fallback">Loading diagram…</div>}>
            <KDiagramLive
              source={liveSource}
              theme={theme}
              height="100%"
              frameless={frameless}
              showThemeToggle={showThemeToggle}
              showViewControls={showViewControls}
              showStats={showStats}
              showAnimationControls={showAnimationControls}
              autoplay={autoplay}
              animationLoop={animationLoop}
              animation={animation}
              options={options}
            />
          </Suspense>
        </div>
      </div>
    </div>
  );
}
