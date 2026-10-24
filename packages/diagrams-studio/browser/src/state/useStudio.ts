import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { RenderResult } from "@kekonic/diagrams";
import {
  formatSource as formatKDiagramSource,
  listCompileTargets,
  parse,
} from "@kekonic/diagrams-core";
import type { KDiagramElement } from "@kekonic/diagrams-element";
import { registerTheme } from "@kekonic/diagrams-theme";
import {
  readStudioSourceSettings,
  resetStudioSourceSettings,
  updateStudioSourceSetting,
  type StudioSourceSetting,
} from "../../../src/index.ts";
import {
  buildRenderOptions,
  DEFAULT_OPTIONS,
  type StudioOptions,
} from "../lib/buildRenderOptions.ts";
import { finishExportSvg, seedsForPalette, type FileDelivery } from "../lib/delivery.ts";
import { interFontFaceCss } from "../lib/embed-font.ts";
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
import { themeAfterSourceEdit } from "../lib/shared-theme.ts";
import { strictHex } from "../lib/color.ts";
import { loadJson, saveJson } from "../lib/storage.ts";

const EXPORT_THEME_NAME = "studio-export";

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

export function useStudio(sharedSource?: string, sharedSeeds?: ThemeSeeds) {
  const storedDraft = loadJson<StoredDraft | null>("draft", null);
  const initialSource = sharedSource ?? storedDraft?.source ?? DEFAULT_EXAMPLE?.source ?? STARTER;
  const initialMode = sharedSeeds?.mode ?? readStudioSourceSettings(initialSource).theme;
  const initialSeeds =
    sharedSeeds ??
    normalizeSeeds(initialMode, loadJson<Partial<ThemeSeeds> | null>("themeSeeds", null));
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
    ...(sharedSeeds ? { theme: sharedSeeds.mode } : {}),
  }));
  const [themeSeeds, setThemeSeeds] = useState<ThemeSeeds>(initialSeeds);
  const [result, setResult] = useState<RenderResult | null>(null);
  const [ready, setReady] = useState(false);
  const [activeView, setActiveView] = useState<string | undefined>(undefined);
  const liveRef = useRef<KDiagramElement | null>(null);
  const sourceTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const renderQueue = useRef<Promise<unknown>>(Promise.resolve());
  const sourceRef = useRef(source);
  const optionsRef = useRef(options);
  const seedsRef = useRef(themeSeeds);
  const presentationTheme = useRef(sharedSeeds?.mode);
  const incomingSeeds = useRef(sharedSeeds);
  const allowThemePersist = useRef(incomingSeeds.current == null);
  const allowSeedPersist = useRef(incomingSeeds.current == null);

  sourceRef.current = source;
  optionsRef.current = options;
  seedsRef.current = themeSeeds;

  const compileTargets = useMemo(() => {
    const ast = parse(previewSource);
    return listCompileTargets(ast)
      .filter((target) => target.kind === "model-view" && target.viewName)
      .map((target) => ({
        kind: "model-view" as const,
        viewName: target.viewName!,
        title: target.title ?? target.viewName!,
      }));
  }, [previewSource]);

  useEffect(() => {
    if (compileTargets.length === 0) {
      setActiveView(undefined);
      return;
    }
    setActiveView((current) =>
      current && compileTargets.some((target) => target.viewName === current)
        ? current
        : (compileTargets.find((target) => target.viewName === "default")?.viewName ??
          compileTargets.find((target) => target.viewName === "main")?.viewName ??
          compileTargets[0]?.viewName),
    );
  }, [compileTargets]);

  const renderOptions = useMemo(
    () => ({ ...buildRenderOptions(options), view: activeView }),
    [activeView, options],
  );
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

  // Preview chrome + persist mode. A shared link's palette stays in this session
  // until the person changes it, and does not replace their stored palette.
  useEffect(() => {
    document.documentElement.dataset.chromeTheme = options.theme;
    document.documentElement.dataset.theme = options.theme;
    const shared = incomingSeeds.current;
    if (shared && options.theme !== shared.mode) allowThemePersist.current = true;
    if (allowThemePersist.current) saveJson("theme", options.theme);
    setThemeSeeds((previous) => {
      if (previous.mode === options.theme) return previous;
      const next = seedsForModeToggle(previous, options.theme);
      seedsRef.current = next;
      return next;
    });
  }, [options.theme]);

  useEffect(() => {
    seedsRef.current = themeSeeds;
    const shared = incomingSeeds.current;
    const sameAsShare =
      shared != null &&
      themeSeeds.mode === shared.mode &&
      strictHex(themeSeeds.accent) === strictHex(shared.accent) &&
      strictHex(themeSeeds.neutral) === strictHex(shared.neutral);
    if (!sameAsShare) allowSeedPersist.current = true;
    if (allowSeedPersist.current) saveJson("themeSeeds", themeSeeds);
    publishLiveTheme(themeSeeds);
    void liveRef.current?.refreshTheme();
  }, [themeSeeds]);

  useEffect(() => {
    if (sharedSource != null) return;
    saveJson("draft", { source, name: documentName } satisfies StoredDraft);
  }, [documentName, sharedSource, source]);

  const updateSource = useCallback((next: string) => {
    const previousTheme = readStudioSourceSettings(sourceRef.current).theme;
    sourceRef.current = next;
    setSource(next);
    setOptions((previous) => {
      const fromSource = readStudioSourceSettings(next);
      const decided = themeAfterSourceEdit(
        previousTheme,
        fromSource.theme,
        previous.theme,
        presentationTheme.current,
      );
      presentationTheme.current = decided.sharedTheme;
      const updated = { ...previous, ...fromSource, theme: decided.theme };
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
        if (key === "theme") presentationTheme.current = undefined;
        const previousTheme = readStudioSourceSettings(sourceRef.current).theme;
        const nextSource = updateStudioSourceSetting(sourceRef.current, key, value);
        sourceRef.current = nextSource;
        setSource(nextSource);
        setPreviewSource(nextSource);
        setOptions((previous) => {
          const fromSource = readStudioSourceSettings(nextSource);
          const decided = themeAfterSourceEdit(
            previousTheme,
            fromSource.theme,
            previous.theme,
            presentationTheme.current,
          );
          presentationTheme.current = decided.sharedTheme;
          const updated = { ...previous, ...fromSource, theme: decided.theme };
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
    presentationTheme.current = undefined;
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

  const replaceThemeSeeds = useCallback((next: ThemeSeeds) => {
    seedsRef.current = next;
    setThemeSeeds(next);
  }, []);

  const dirty = source !== baselineSource;
  const canSave = saveState !== "saving";

  const loadExample = useCallback(
    (
      id: string,
      exampleSource: string,
      options?: {
        activeView?: string;
        compileTargets?: Array<{ kind: "model-view"; viewName: string; title: string }>;
      },
    ) => {
      const example = EXAMPLES.find((item) => item.id === id);
      presentationTheme.current = undefined;
      setExampleId(id);
      setDocumentName(example?.label ?? id);
      setFileHandle(undefined);
      sourceRef.current = exampleSource;
      setSource(exampleSource);
      setPreviewSource(exampleSource);
      setBaselineSource(exampleSource);
      if (options?.activeView !== undefined) setActiveView(options.activeView);
      if (options?.compileTargets && options.compileTargets.length > 0) {
        setActiveView(
          options.activeView ??
            options.compileTargets.find((target) => target.viewName === "default")?.viewName ??
            options.compileTargets.find((target) => target.viewName === "main")?.viewName ??
            options.compileTargets[0]?.viewName,
        );
      }
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
    },
    [],
  );

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
      presentationTheme.current = undefined;
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

  const activeViewRef = useRef(activeView);
  activeViewRef.current = activeView;

  const renderDeliverySvg = useCallback((file: FileDelivery) => {
    const run = async () => {
      const seeds = seedsForPalette(file.palette, file.mode, seedsRef.current);
      const portable = file.format === "png" || file.portable;
      const embedFonts = file.format === "png" || file.embedFonts;
      if (portable) registerTheme(EXPORT_THEME_NAME, deriveThemeTokens(seeds));
      const { KDiagram } = await import("@kekonic/diagrams");
      const opts = {
        ...buildRenderOptions(optionsRef.current),
        theme: portable ? EXPORT_THEME_NAME : "auto",
        snapshotTheme: portable,
        view: activeViewRef.current,
      };
      const rendered = await KDiagram.renderToSvg(sourceRef.current, opts);
      if (!rendered.ok || !rendered.svg) return null;
      const fontFaceCss = embedFonts ? await interFontFaceCss() : undefined;
      return finishExportSvg(rendered.svg, { background: file.background, fontFaceCss });
    };
    const result = renderQueue.current.then(run, run);
    renderQueue.current = result.then(
      () => undefined,
      () => undefined,
    );
    return result;
  }, []);

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
    replaceThemeSeeds,
    loadExample,
    saveExample,
    saveAs: () => saveExample(true),
    openFile,
    formatSource,
    renderDeliverySvg,
    applyResult,
    fit,
    zoomIn,
    zoomOut,
    resetView,
    compileTargets,
    activeView,
    setActiveView,
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
