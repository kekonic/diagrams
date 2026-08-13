import { useEffect, useRef, useState } from "react";
import { Editor } from "@monaco-editor/react";
import type { SourceRange } from "@kekonic/diagrams-core";
import type { editor } from "monaco-editor";
import {
  KDIAGRAM_LANGUAGE_ID,
  MONACO_THEME_DARK,
  MONACO_THEME_LIGHT,
  prepareMonaco,
} from "../editor/monaco-setup.ts";

type Props = {
  value: string;
  onChange: (value: string) => void;
  themeMode: "dark" | "light";
  revealRange?: { range: SourceRange; requestId: number };
};

export function SourceEditor({ value, onChange, themeMode, revealRange }: Props) {
  const [ready, setReady] = useState(false);
  const language = useRef<{ dispose(): void } | null>(null);
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null);

  useEffect(() => {
    let cancelled = false;
    void prepareMonaco().then(() => {
      if (!cancelled) setReady(true);
    });
    return () => {
      cancelled = true;
      language.current?.dispose();
    };
  }, []);

  useEffect(() => {
    const instance = editorRef.current;
    if (!instance || !revealRange) return;
    const { range } = revealRange;
    const selection = {
      startLineNumber: range.start.line,
      startColumn: range.start.column,
      endLineNumber: range.end.line,
      endColumn: Math.max(range.end.column, range.start.column + 1),
    };
    instance.setSelection(selection);
    instance.revealRangeInCenter(selection);
    instance.focus();
  }, [revealRange]);

  return (
    <div className="source-editor-host" data-editor-theme={themeMode}>
      {ready ? (
        <Editor
          value={value}
          language={KDIAGRAM_LANGUAGE_ID}
          theme={themeMode === "dark" ? MONACO_THEME_DARK : MONACO_THEME_LIGHT}
          onMount={(editor, monaco) => {
            editorRef.current = editor;
            const model = editor.getModel();
            if (!model) return;
            void import("../language.ts").then(({ installKDiagramLanguage }) => {
              if (model.isDisposed()) return;
              language.current?.dispose();
              language.current = installKDiagramLanguage(monaco, model);
            });
          }}
          onChange={(next: string | undefined) => onChange(next ?? "")}
          height="100%"
          options={{
            fontFamily: "var(--font-mono), ui-monospace, monospace",
            fontSize: 13,
            lineHeight: 20,
            minimap: { enabled: false },
            scrollBeyondLastLine: false,
            wordWrap: "on",
            automaticLayout: true,
            tabSize: 2,
            renderLineHighlight: "line",
            padding: { top: 12, bottom: 12 },
            folding: true,
            glyphMargin: false,
            overviewRulerLanes: 0,
            hideCursorInOverviewRuler: true,
            overviewRulerBorder: false,
            scrollbar: {
              verticalScrollbarSize: 10,
              horizontalScrollbarSize: 10,
            },
          }}
          loading={<div className="source-editor-loading">Loading editor…</div>}
        />
      ) : (
        <div className="source-editor-loading">Loading editor…</div>
      )}
    </div>
  );
}
