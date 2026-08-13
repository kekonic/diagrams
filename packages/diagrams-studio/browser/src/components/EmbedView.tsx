import { useMemo } from "react";
import { KDiagramLive } from "@kekonic/diagrams-ui";
import { buildStudioRenderOptions, readStudioSourceSettings } from "../../../src/index.ts";
import { DEFAULT_OPTIONS } from "../lib/buildRenderOptions.ts";

export function EmbedView({ source }: { source: string }) {
  const options = useMemo(() => {
    const configured = { ...DEFAULT_OPTIONS, ...readStudioSourceSettings(source) };
    const { theme: _theme, ...renderOptions } = buildStudioRenderOptions(configured, "dark");
    return renderOptions;
  }, [source]);

  return (
    <main className="embed-shell">
      <KDiagramLive
        source={source}
        theme="auto"
        height="100%"
        frameless
        showThemeToggle
        showViewControls
        showAnimationControls
        options={options}
      />
    </main>
  );
}
