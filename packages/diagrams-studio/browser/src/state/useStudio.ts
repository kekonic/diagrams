import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { RenderResult } from "@kekonic/diagrams";
import { formatSource as formatKDiagramSource } from "@kekonic/diagrams-core";
import type { KDiagramElement } from "@kekonic/diagrams-element";
import { registerTheme } from "@kekonic/diagrams-theme";
import {
  readStudioSourceSettings,
  resetStudioSourceSettings,
  updateStudioSourceSetting,
  type StudioSourceSetting,
} from "../../../src/index.ts";
import {
  buildExportOptions,
  buildRenderOptions,
  DEFAULT_OPTIONS,
  type StudioOptions,
} from "../lib/buildRenderOptions.ts";
import {
  applyChromeTokens,
  defaultSeeds,
  deriveChromeTokens,
  deriveThemeTokens,
  LIVE_THEME_NAME,
  normalizeSeeds,
  seedsForModeToggle,
  type ThemeSeeds,
} from "../lib/deriveTheme.ts";
import { DEFAULT_EXAMPLE, EXAMPLES, STARTER } from "../lib/examples.ts";
import { canSaveExampleToRepo, saveExampleToRepo } from "../lib/saveExample.ts";
import { openKDiagramFile, saveKDiagramFile, type KDiagramFileHandle } from "../lib/sourceFiles.ts";
import { loadJson, saveJson } from "../lib/storage.ts";

/** Option changes that reshape the diagram enough to warrant fit-to-view. */
const LAYOUT_REFIT_KEYS = new Set<keyof StudioOptions>([
  "direction",
  "density",
  "spacingScale",
  "nodePlacement",
  "groupLayout",
  "modelOrder",
  "groupGap",
  "edgeGaps",
]);

function publishLiveTheme(seeds: ThemeSeeds): void {
  registerTheme(LIVE_THEME_NAME, deriveThemeTokens(seeds));
  applyChromeTokens(deriveChromeTokens(seeds));
}

type StoredDraft = {
  source: string;
  name: string;
};

export function useStudio(sharedSource?: string) {
  const storedDraft = loadJson<StoredDraft | null>("draft", null);
  const initialSource = sharedSource ?? storedDraft?.source ?? DEFAULT_EXAMPLE?.source ?? STARTER;
  const initialMode = readStudioSourceSettings(initialSource).theme;
  const initialSeeds = normalizeSeeds(
    initialMode,
    loadJson<Partial<ThemeSeeds> | null>("themeSeeds", null),
  );
  const initialDocumentName = sharedSource
    ? "Shared diagram.kdiagram"
    : (storedDraft?.name ?? DEFAULT_EXAMPLE?.label ?? "Diagram");
  const initialDocumentId =
    sharedSource || storedDraft ? "browser-document" : (DEFAULT_EXAMPLE?.id ?? "browser-document");
  const [source, setSource] = useState(initialSource);
  const [previewSource, setPreviewSource] = useState(initialSource);
  const [baselineSource, setBaselineSource] = useState(initialSource);
  const [exampleId, setExampleId] = useState(initialDocumentId);
  const [documentName, setDocumentName] = useState(initialDocumentName);
  const [fileHandle, setFileHandle] = useState<KDiagramFileHandle>();
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [options, setOptions] = useState<StudioOptions>(() => ({
    ...DEFAULT_OPTIONS,
    ...readStudioSourceSettings(initialSource),
  }));
  const [themeSeeds, setThemeSeeds] = useState<ThemeSeeds>(initialSeeds);
  const [result, setResult] = useState<RenderResult | null>(null);
  const [ready, setReady] = useState(false);
  const liveRef = useRef<KDiagramElement | null>(null);
  const sourceTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const sourceRef = useRef(source);
  const optionsRef = useRef(options);
  const seedsRef = useRef(themeSeeds);

  sourceRef.current = source;
  optionsRef.current = options;
  seedsRef.current = themeSeeds;

  const renderOptions = useMemo(() => buildRenderOptions(options), [options]);
  const documents = useMemo(() => {
    if (EXAMPLES.some((example) => example.id === exampleId)) return EXAMPLES;
    return [...EXAMPLES, { id: exampleId, label: documentName, source }];
  }, [documentName, exampleId, source]);

  const applyResult = useCallback((next: RenderResult) => {
    setResult(next);
    setReady(true);
  }, []);

  // Ensure live theme exists before first SVG paint
  useEffect(() => {
    publishLiveTheme(seedsRef.current);
  }, []);

  // Preview chrome + persist mode
  useEffect(() => {
    document.documentElement.dataset.chromeTheme = options.theme;
    document.documentElement.dataset.theme = options.theme;
    saveJson("theme", options.theme);
    setThemeSeeds((previous) => {
      if (previous.mode === options.theme) return previous;
      const next = seedsForModeToggle(previous, options.theme);
      seedsRef.current = next;
      return next;
    });
  }, [options.theme]);

  useEffect(() => {
    seedsRef.current = themeSeeds;
    saveJson("themeSeeds", themeSeeds);
    publishLiveTheme(themeSeeds);
    void liveRef.current?.refreshTheme();
  }, [themeSeeds]);

  useEffect(() => {
    saveJson("draft", { source, name: documentName } satisfies StoredDraft);
  }, [documentName, source]);

  const updateSource = useCallback((next: string) => {
    sourceRef.current = next;
    setSource(next);
    setOptions((previous) => {
      const updated = { ...previous, ...readStudioSourceSettings(next) };
      optionsRef.current = updated;
      return updated;
    });
    clearTimeout(sourceTimer.current);
    sourceTimer.current = setTimeout(() => {
      setPreviewSource(next);
    }, 200);
  }, []);

  const setOption = useCallback(
    <K extends keyof StudioOptions>(key: K, value: StudioOptions[K]) => {
      if (isStudioSourceSetting(key) && typeof value === "string") {
        const nextSource = updateStudioSourceSetting(sourceRef.current, key, value);
        sourceRef.current = nextSource;
        setSource(nextSource);
        setPreviewSource(nextSource);
        setOptions((previous) => {
          const updated = { ...previous, ...readStudioSourceSettings(nextSource) };
          optionsRef.current = updated;
          return updated;
        });
        clearTimeout(sourceTimer.current);
        return;
      }
      setOptions((prev) => {
        const next = { ...prev, [key]: value };
        optionsRef.current = next;
        return next;
      });
      if (LAYOUT_REFIT_KEYS.has(key)) {
        requestAnimationFrame(() => {
          liveRef.current?.fit();
        });
      }
    },
    [],
  );

  const resetOptions = useCallback(() => {
    const nextSource = resetStudioSourceSettings(sourceRef.current);
    sourceRef.current = nextSource;
    setSource(nextSource);
    setPreviewSource(nextSource);
    setOptions((previous) => {
      const updated = { ...previous, ...readStudioSourceSettings(nextSource) };
      optionsRef.current = updated;
      return updated;
    });
    clearTimeout(sourceTimer.current);
    requestAnimationFrame(() => {
      liveRef.current?.fit();
    });
  }, []);

  const toggleTheme = useCallback(() => {
    const mode: StudioOptions["theme"] = optionsRef.current.theme === "dark" ? "light" : "dark";
    setOption("theme", mode);
  }, [setOption]);

  const patchThemeSeeds = useCallback((patch: Partial<ThemeSeeds>) => {
    setThemeSeeds((previous) => {
      const next = { ...previous, ...patch, mode: previous.mode };
      seedsRef.current = next;
      return next;
    });
  }, []);

  const resetThemeSeeds = useCallback(() => {
    setThemeSeeds((previous) => {
      const next = defaultSeeds(previous.mode);
      seedsRef.current = next;
      return next;
    });
  }, []);

  const dirty = source !== baselineSource;
  const canSave = saveState !== "saving";

  const loadExample = useCallback((id: string, exampleSource: string) => {
    const example = EXAMPLES.find((item) => item.id === id);
    setExampleId(id);
    setDocumentName(example?.label ?? id);
    setFileHandle(undefined);
    sourceRef.current = exampleSource;
    setSource(exampleSource);
    setPreviewSource(exampleSource);
    setBaselineSource(exampleSource);
    setOptions((previous) => {
      const updated = { ...previous, ...readStudioSourceSettings(exampleSource) };
      optionsRef.current = updated;
      return updated;
    });
    setSaveState("idle");
    setSaveError(null);
    clearTimeout(sourceTimer.current);
    requestAnimationFrame(() => {
      liveRef.current?.fit();
    });
  }, []);

  const saveExample = useCallback(
    async (saveAs = false) => {
      setSaveState("saving");
      setSaveError(null);
      try {
        const isRepoExample = EXAMPLES.some((example) => example.id === exampleId);
        if (!saveAs && !fileHandle && canSaveExampleToRepo() && isRepoExample) {
          const saveResult = await saveExampleToRepo(exampleId, sourceRef.current);
          if (!saveResult.ok) throw new Error(saveResult.error);
        } else {
          const saved = await saveKDiagramFile(sourceRef.current, documentName, fileHandle, saveAs);
          if (!saved) {
            setSaveState("idle");
            return;
          }
          setFileHandle(saved.handle);
          setDocumentName(saved.name);
          setExampleId("browser-document");
        }

        const written = sourceRef.current.endsWith("\n")
          ? sourceRef.current
          : `${sourceRef.current}\n`;
        sourceRef.current = written;
        setSource(written);
        setPreviewSource(written);
        setBaselineSource(written);
        setSaveState("saved");
        window.setTimeout(
          () => setSaveState((state) => (state === "saved" ? "idle" : state)),
          1600,
        );
      } catch (error) {
        setSaveState("error");
        setSaveError(error instanceof Error ? error.message : "Could not save the diagram file");
      }
    },
    [documentName, exampleId, fileHandle],
  );

  const openFile = useCallback(async () => {
    try {
      const opened = await openKDiagramFile();
      if (!opened) return;
      setFileHandle(opened.handle);
      setDocumentName(opened.name);
      setExampleId("browser-document");
      sourceRef.current = opened.source;
      setSource(opened.source);
      setPreviewSource(opened.source);
      setBaselineSource(opened.source);
      setOptions((previous) => {
        const updated = { ...previous, ...readStudioSourceSettings(opened.source) };
        optionsRef.current = updated;
        return updated;
      });
      setSaveState("idle");
      setSaveError(null);
      clearTimeout(sourceTimer.current);
      requestAnimationFrame(() => liveRef.current?.fit());
    } catch (error) {
      setSaveState("error");
      setSaveError(error instanceof Error ? error.message : "Could not open the diagram file");
    }
  }, []);

  const formatSource = useCallback(() => {
    const formatted = formatKDiagramSource(sourceRef.current);
    sourceRef.current = formatted;
    setSource(formatted);
    setPreviewSource(formatted);
    clearTimeout(sourceTimer.current);
  }, []);

  const renderSvg = useCallback(async () => {
    publishLiveTheme(seedsRef.current);
    const opts = buildExportOptions(optionsRef.current);
    const { KDiagram } = await import("@kekonic/diagrams");
    const rendered = await KDiagram.renderToSvg(sourceRef.current, opts);
    return rendered.ok && rendered.svg ? rendered.svg : null;
  }, []);

  const exportDiagram = useCallback(async () => {
    const svg = await renderSvg();
    if (!svg) return;
    const blob = new Blob([svg], { type: "image/svg+xml" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${documentName.replace(/\.kdiagram$/i, "") || "diagram"}.svg`;
    a.click();
    URL.revokeObjectURL(url);
  }, [documentName, renderSvg]);

  const fit = useCallback(() => {
    liveRef.current?.fit();
  }, []);
  const zoomIn = useCallback(() => {
    liveRef.current?.zoomIn();
  }, []);
  const zoomOut = useCallback(() => {
    liveRef.current?.zoomOut();
  }, []);
  const resetView = useCallback(() => {
    liveRef.current?.resetView();
  }, []);

  return {
    liveRef,
    source,
    previewSource,
    exampleId,
    documents,
    documentName,
    dirty,
    canSave,
    saveState,
    saveError,
    options,
    themeSeeds,
    renderOptions,
    result,
    ready,
    updateSource,
    setOption,
    resetOptions,
    toggleTheme,
    patchThemeSeeds,
    resetThemeSeeds,
    loadExample,
    saveExample,
    saveAs: () => saveExample(true),
    openFile,
    formatSource,
    exportSvg: exportDiagram,
    renderSvg,
    applyResult,
    fit,
    zoomIn,
    zoomOut,
    resetView,
  };
}

export type StudioApi = ReturnType<typeof useStudio>;

function isStudioSourceSetting(key: keyof StudioOptions): key is StudioSourceSetting {
  return (
    key === "theme" ||
    key === "direction" ||
    key === "density" ||
    key === "groupLayout" ||
    key === "edgeStyle" ||
    key === "crossings"
  );
}
