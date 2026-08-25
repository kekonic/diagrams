import { Eye } from "lucide-react";
import { useMemo, useRef, type PointerEvent, type RefObject } from "react";
import type { RenderResult } from "@kekonic/diagrams";
import type { KDiagramElement } from "@kekonic/diagrams-element";
import { KDiagramLive } from "@kekonic/diagrams-ui";
import type { InteractiveRenderOptions } from "@kekonic/diagrams";
import { LIVE_THEME_NAME } from "../lib/deriveTheme.ts";
import { nodeNavigationTarget, type NodeNavigationPointer } from "../lib/nodeNavigation.ts";

type Props = {
  source: string;
  renderOptions: InteractiveRenderOptions;
  liveRef: RefObject<KDiagramElement | null>;
  result: RenderResult | null;
  onRender: (result: RenderResult) => void;
  onNodeNavigate: (nodeId: string) => void;
};

export function PreviewPane({
  source,
  renderOptions,
  liveRef,
  result,
  onRender,
  onNodeNavigate,
}: Props) {
  const liveOptions = useMemo(() => {
    const { theme: _theme, ...rest } = renderOptions;
    // Dedicated editor canvas: keep wheel-zoom. Page embeds default to modifier.
    return { ...rest, zoomOnWheel: "always" as const };
  }, [renderOptions]);

  return (
    <section className="preview-pane output-pane">
      <div className="pane-header preview-header">
        <h2>
          <Eye size={14} strokeWidth={1.75} aria-hidden />
          Preview
        </h2>
        <span className="preview-hint">Click a node to reveal its source</span>
      </div>
      <PreviewStage
        source={source}
        liveOptions={liveOptions}
        liveRef={liveRef}
        onRender={onRender}
        onNodeNavigate={onNodeNavigate}
      />
      {result?.stats ? (
        <footer className="output-status">
          <span>{result.stats.nodeCount}n</span>
          <span>{result.stats.edgeCount}e</span>
          <span>{result.stats.totalMs.toFixed(1)}ms</span>
        </footer>
      ) : null}
    </section>
  );
}

function PreviewStage({
  source,
  liveOptions,
  liveRef,
  onRender,
  onNodeNavigate,
}: {
  source: string;
  liveOptions: Omit<InteractiveRenderOptions, "theme">;
  liveRef: RefObject<KDiagramElement | null>;
  onRender: (result: RenderResult) => void;
  onNodeNavigate: (nodeId: string) => void;
}) {
  const pointer = useRef<NodeNavigationPointer | undefined>(undefined);
  const nodeIdFromEvent = (event: PointerEvent<HTMLDivElement>): string | null => {
    for (const target of event.nativeEvent.composedPath()) {
      if (target instanceof Element) {
        const nodeId = target.getAttribute("data-node-id");
        if (nodeId) return nodeId;
      }
    }
    return null;
  };

  return (
    <div
      className="preview-stage"
      onPointerDownCapture={(event) => {
        if (event.button !== 0) return;
        const nodeId = nodeIdFromEvent(event);
        if (nodeId) {
          pointer.current = { id: event.pointerId, x: event.clientX, y: event.clientY, nodeId };
        }
      }}
      onPointerUpCapture={(event) => {
        const candidate = pointer.current;
        pointer.current = undefined;
        const nodeId = nodeNavigationTarget(candidate, {
          id: event.pointerId,
          x: event.clientX,
          y: event.clientY,
        });
        if (nodeId) onNodeNavigate(nodeId);
      }}
      onPointerCancelCapture={() => {
        pointer.current = undefined;
      }}
    >
      <KDiagramLive
        ref={liveRef}
        className="preview preview--live"
        source={source}
        theme={LIVE_THEME_NAME}
        height="100%"
        showThemeToggle={false}
        showViewControls={true}
        showAnimationControls={true}
        options={liveOptions}
        onKDiagramRender={(event) => onRender(event.detail)}
      />
    </div>
  );
}
