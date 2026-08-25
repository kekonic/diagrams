import { lazy, Suspense, useEffect } from "react";
import {
  AlertTriangle,
  ChevronDown,
  FileCode2,
  FolderOpen,
  Save,
  SaveAll,
  WandSparkles,
} from "lucide-react";
import { DiagnosticsList } from "./DiagnosticsList.tsx";
import { IconButton } from "./IconButton.tsx";
import type { RenderResult } from "@kekonic/diagrams";
import type { SourceRange } from "@kekonic/diagrams-core";

const SourceEditor = lazy(() =>
  import("./SourceEditor.tsx").then((module) => ({ default: module.SourceEditor })),
);

type Props = {
  source: string;
  onChange: (source: string) => void;
  diagnostics: RenderResult["diagnostics"] | undefined;
  themeMode: "dark" | "light";
  documents: Array<{ id: string; label: string }>;
  activeDocumentId: string;
  onDocument: (id: string) => void;
  compileTargets?: Array<{ viewName: string; title: string }>;
  activeView?: string;
  onView?: (view?: string) => void;
  dirty: boolean;
  canSave: boolean;
  saveState: "idle" | "saving" | "saved" | "error";
  saveError: string | null;
  onSave: () => void;
  onSaveAs?: () => void;
  onOpenFile?: () => void;
  onFormat: () => void;
  revealRange?: { range: SourceRange; requestId: number };
  onRevealRange: (range: SourceRange) => void;
};

export function EditorPane({
  source,
  onChange,
  diagnostics,
  themeMode,
  documents,
  activeDocumentId,
  onDocument,
  compileTargets = [],
  activeView,
  onView,
  dirty,
  canSave,
  saveState,
  saveError,
  onSave,
  onSaveAs,
  onOpenFile,
  onFormat,
  revealRange,
  onRevealRange,
}: Props) {
  const saveAvailable = true;

  useEffect(() => {
    if (!saveAvailable) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey) || e.key.toLowerCase() !== "s") return;
      e.preventDefault();
      if (canSave) onSave();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [canSave, onSave, saveAvailable]);

  const saveTitle = !saveAvailable
    ? "Saving is unavailable for this session"
    : saveState === "saving"
      ? "Saving…"
      : saveState === "saved"
        ? "Saved"
        : saveState === "error"
          ? (saveError ?? "Save failed")
          : "Save source (⌘S)";

  return (
    <section className="editor-pane">
      <div className="editor-filebar" role="navigation" aria-label="Open example">
        <FileCode2 size={14} strokeWidth={1.75} aria-hidden className="editor-filebar-icon" />
        <div className="editor-filebar-select-wrap">
          <select
            className="editor-filebar-select"
            value={activeDocumentId}
            disabled={documents.length === 0}
            aria-label="Document"
            onChange={(event) => onDocument(event.target.value)}
          >
            {documents.length === 0 ? (
              <option value="">(none yet)</option>
            ) : (
              documents.map((document) => (
                <option key={document.id} value={document.id}>
                  {document.label}
                  {document.id === activeDocumentId && dirty ? " *" : ""}
                </option>
              ))
            )}
          </select>
          <ChevronDown size={14} strokeWidth={2} aria-hidden className="editor-filebar-caret" />
        </div>
        {compileTargets.length > 0 && onView ? (
          <div className="editor-filebar-select-wrap">
            <select
              className="editor-filebar-select editor-filebar-select-view"
              value={activeView ?? compileTargets[0]?.viewName ?? ""}
              aria-label="Model view"
              onChange={(event) => onView(event.target.value || undefined)}
            >
              {compileTargets.map((target) => (
                <option key={target.viewName} value={target.viewName}>
                  view: {target.title}
                </option>
              ))}
            </select>
            <ChevronDown size={14} strokeWidth={2} aria-hidden className="editor-filebar-caret" />
          </div>
        ) : null}
        {dirty ? <span className="editor-dirty-dot" title="Unsaved changes" aria-hidden /> : null}
        {onOpenFile ? (
          <IconButton
            icon={FolderOpen}
            iconOnly
            label="Open .kdiagram file"
            title="Open .kdiagram file"
            onClick={onOpenFile}
          />
        ) : null}
        <IconButton
          icon={WandSparkles}
          iconOnly
          label="Format source"
          title="Format source"
          onClick={onFormat}
        />
        {saveAvailable ? (
          <IconButton
            icon={Save}
            iconOnly
            label="Save KDiagram source"
            title={saveTitle}
            disabled={!canSave}
            active={saveState === "saved"}
            onClick={onSave}
          />
        ) : null}
        {onSaveAs ? (
          <IconButton
            icon={SaveAll}
            iconOnly
            label="Save KDiagram source as"
            title="Save source as…"
            onClick={onSaveAs}
          />
        ) : null}
      </div>
      <Suspense fallback={<div className="source-editor-loading">Loading editor…</div>}>
        <SourceEditor
          value={source}
          onChange={onChange}
          themeMode={themeMode}
          revealRange={revealRange}
        />
      </Suspense>
      <div className="pane-header pane-header-sub">
        <h2>
          <AlertTriangle size={14} strokeWidth={1.75} aria-hidden />
          Diagnostics
        </h2>
      </div>
      <div className="diagnostics">
        <DiagnosticsList diagnostics={diagnostics} onReveal={onRevealRange} />
      </div>
    </section>
  );
}
