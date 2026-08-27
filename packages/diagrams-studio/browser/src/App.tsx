import { useCallback, useEffect, useState } from "react";
import type { SourceRange } from "@kekonic/diagrams-core";
import { EditorPane } from "./components/EditorPane.tsx";
import { EmbedView } from "./components/EmbedView.tsx";
import { PreviewPane } from "./components/PreviewPane.tsx";
import { ShareDialog } from "./components/ShareDialog.tsx";
import { Sidebar } from "./components/Sidebar.tsx";
import { SplitPane } from "./components/SplitPane.tsx";
import { Toolbar } from "./components/Toolbar.tsx";
import { STARTER } from "./lib/examples.ts";
import { publicStudioUrl } from "./lib/host.ts";
import { readStudioLaunch } from "./lib/share.ts";
import { loadJson, saveJson } from "./lib/storage.ts";
import { useStudio, type StudioApi } from "./state/useStudio.ts";
import {
  useConnectedStudio,
  type StudioConnection,
  type ConnectedStudioApi,
} from "./state/useConnectedStudio.ts";

function loadSidebarOpen(): boolean {
  return loadJson("sidebarOpen", false);
}

export function App() {
  const token = new URLSearchParams(location.search).get("token");
  const launch = readStudioLaunch(location.hash);
  if (launch.embed) return <EmbedView source={launch.source ?? STARTER} />;
  return token ? <ConnectedStudio token={token} /> : <LocalStudio sharedSource={launch.source} />;
}

function LocalStudio({ sharedSource }: { sharedSource?: string }) {
  const studio = useStudio(sharedSource);
  return (
    <StudioShell studio={studio} documents={studio.documents} activeDocumentId={studio.exampleId} />
  );
}

function ConnectedStudio({ token }: { token: string }) {
  const studio = useConnectedStudio(token);
  return (
    <StudioShell
      studio={studio}
      documents={studio.documents}
      activeDocumentId={studio.activeDocumentId}
      connection={studio.connection}
    />
  );
}

type StudioShellProps = {
  studio: StudioApi | ConnectedStudioApi;
  documents: Array<{ id: string; label: string; source?: string }>;
  activeDocumentId: string;
  connection?: StudioConnection;
};

function StudioShell({
  studio: studioState,
  documents,
  activeDocumentId,
  connection,
}: StudioShellProps) {
  const [sidebarOpen, setSidebarOpen] = useState(loadSidebarOpen);
  const [shareOpen, setShareOpen] = useState(false);
  const [revealRange, setRevealRange] = useState<{ range: SourceRange; requestId: number }>();
  const revealSourceRange = useCallback((range: SourceRange) => {
    setRevealRange({ range, requestId: Date.now() });
  }, []);

  const persistSidebarOpen = useCallback((open: boolean) => {
    setSidebarOpen(open);
    saveJson("sidebarOpen", open);
  }, []);

  useEffect(() => {
    requestAnimationFrame(() => studioState.fit());
  }, [sidebarOpen, studioState.fit]);

  const navigateToNode = useCallback(
    (nodeId: string) => {
      const range = studioState.result?.graph?.nodes.find(
        (node) => node.id === nodeId,
      )?.sourceRange;
      if (range) revealSourceRange(range);
    },
    [revealSourceRange, studioState.result],
  );

  const setActiveView = studioState.setActiveView;
  const fitPreview = studioState.fit;
  const selectView = "selectView" in studioState ? studioState.selectView : undefined;

  const handleViewChange = useCallback(
    (view?: string) => {
      setActiveView(view);
      selectView?.(view);
      requestAnimationFrame(() => fitPreview());
    },
    [fitPreview, selectView, setActiveView],
  );

  return (
    <div className="app-shell" data-chrome-theme={studioState.options.theme}>
      <Toolbar
        product="Studio"
        theme={studioState.options.theme}
        connection={connection}
        onToggleTheme={studioState.toggleTheme}
        onExport={() => void studioState.exportSvg()}
        onShare={() => setShareOpen(true)}
        onToggleSidebar={() => persistSidebarOpen(!sidebarOpen)}
        sidebarOpen={sidebarOpen}
      />

      <div className="workspace-row">
        <SplitPane
          left={
            <EditorPane
              source={studioState.source}
              onChange={studioState.updateSource}
              diagnostics={studioState.result?.diagnostics}
              themeMode={studioState.options.theme}
              documents={documents}
              activeDocumentId={activeDocumentId}
              onDocument={(id) => {
                const document = documents.find((item) => item.id === id);
                studioState.loadExample(id, document?.source ?? "");
              }}
              dirty={studioState.dirty}
              canSave={studioState.canSave}
              saveState={studioState.saveState}
              saveError={studioState.saveError}
              onSave={() => void studioState.saveExample()}
              onSaveAs={connection ? undefined : () => void studioState.saveAs()}
              onOpenFile={connection ? undefined : () => void studioState.openFile()}
              onFormat={studioState.formatSource}
              revealRange={revealRange}
              onRevealRange={revealSourceRange}
            />
          }
          right={
            <PreviewPane
              source={studioState.previewSource}
              renderOptions={studioState.renderOptions}
              activeView={studioState.activeView}
              onViewChange={handleViewChange}
              liveRef={studioState.liveRef}
              result={studioState.result}
              onRender={studioState.applyResult}
              onNodeNavigate={navigateToNode}
            />
          }
        />
        <Sidebar
          open={sidebarOpen}
          options={studioState.options}
          onChange={studioState.setOption}
          onReset={studioState.resetOptions}
          themeSeeds={studioState.themeSeeds}
          onThemeSeedsChange={studioState.patchThemeSeeds}
          onResetThemeSeeds={studioState.resetThemeSeeds}
        />
      </div>
      {shareOpen ? (
        <ShareDialog
          source={studioState.source}
          studioUrl={publicStudioUrl(document)}
          onRenderSvg={studioState.renderSvg}
          onClose={() => setShareOpen(false)}
        />
      ) : null}
    </div>
  );
}
