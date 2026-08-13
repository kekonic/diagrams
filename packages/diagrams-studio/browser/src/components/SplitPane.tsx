import { useCallback, useEffect, useRef, useState, type PointerEvent, type ReactNode } from "react";
import { loadJson, saveJson } from "../lib/storage.ts";

type Props = {
  left: ReactNode;
  right: ReactNode;
  storageKey?: string;
  defaultRatio?: number;
  minLeftPct?: number;
  maxLeftPct?: number;
};

export function SplitPane({
  left,
  right,
  storageKey = "splitRatio",
  defaultRatio = 0.38,
  minLeftPct = 22,
  maxLeftPct = 62,
}: Props) {
  const [ratio, setRatio] = useState(() => loadJson(storageKey, defaultRatio));
  const dragging = useRef(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    saveJson(storageKey, ratio);
  }, [ratio, storageKey]);

  const onPointerDown = useCallback((e: PointerEvent) => {
    dragging.current = true;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }, []);

  const onPointerMove = useCallback(
    (e: PointerEvent) => {
      if (!dragging.current || !rootRef.current) return;
      const rect = rootRef.current.getBoundingClientRect();
      const next = (e.clientX - rect.left) / rect.width;
      const clamped = Math.min(maxLeftPct / 100, Math.max(minLeftPct / 100, next));
      setRatio(clamped);
    },
    [maxLeftPct, minLeftPct],
  );

  const onPointerUp = useCallback(() => {
    dragging.current = false;
  }, []);

  return (
    <div
      className="split-pane"
      ref={rootRef}
      style={{ gridTemplateColumns: `minmax(0, ${ratio}fr) 6px minmax(0, ${1 - ratio}fr)` }}
    >
      <div className="split-pane-left">{left}</div>
      <div
        className="split-handle"
        role="separator"
        aria-orientation="vertical"
        aria-valuenow={Math.round(ratio * 100)}
        tabIndex={0}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onKeyDown={(e) => {
          if (e.key === "ArrowLeft") setRatio((r) => Math.max(minLeftPct / 100, r - 0.02));
          if (e.key === "ArrowRight") setRatio((r) => Math.min(maxLeftPct / 100, r + 0.02));
        }}
      />
      <div className="split-pane-right">{right}</div>
    </div>
  );
}
