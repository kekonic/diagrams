import { useMemo, useState } from "react";
import { Moon, Sun } from "lucide-react";
import { KDiagramLive } from "@kekonic/diagrams-ui";
import { registerTheme } from "@kekonic/diagrams-theme";
import { buildStudioRenderOptions, readStudioSourceSettings } from "../../../src/index.ts";
import { DEFAULT_OPTIONS } from "../lib/buildRenderOptions.ts";
import {
  deriveThemeTokens,
  seedsForModeToggle,
  seedsForPreset,
  type ThemeSeeds,
} from "../lib/deriveTheme.ts";
import type { LaunchLook } from "../lib/share.ts";
import { IconButton } from "./IconButton.tsx";

const EMBED_DARK = "studio-embed-dark";
const EMBED_LIGHT = "studio-embed-light";

function seedsForLook(look: LaunchLook, mode: "dark" | "light"): ThemeSeeds | undefined {
  if (look.preset) return seedsForPreset(look.preset, mode);
  if (!look.seeds) return undefined;
  return look.seeds.mode === mode ? look.seeds : seedsForModeToggle(look.seeds, mode);
}

export function EmbedView({ source, look }: { source: string; look?: LaunchLook }) {
  const style = look?.style ?? "explorer";
  const locked = style !== "ambient" && look?.mode !== "auto" && look?.seeds != null;
  const [mode, setMode] = useState<"dark" | "light">(
    look?.seeds?.mode === "light" ? "light" : "dark",
  );

  const options = useMemo(() => {
    const configured = { ...DEFAULT_OPTIONS, ...readStudioSourceSettings(source) };
    const { theme: _theme, ...renderOptions } = buildStudioRenderOptions(configured, "dark");
    return renderOptions;
  }, [source]);

  // Register before the element connects. A layout effect runs too late: the custom element
  // reads the theme registry from its connected callback, which happens during commit.
  const darkSeeds = locked && look ? seedsForLook(look, "dark") : undefined;
  const lightSeeds = locked && look ? seedsForLook(look, "light") : undefined;
  if (darkSeeds) registerTheme(EMBED_DARK, deriveThemeTokens(darkSeeds));
  if (lightSeeds) registerTheme(EMBED_LIGHT, deriveThemeTokens(lightSeeds));

  const activeSeeds = locked && look ? seedsForLook(look, mode) : look?.seeds;
  const shellBackground =
    style === "ambient" || look?.background === "transparent"
      ? "transparent"
      : look?.background === "white"
        ? "#ffffff"
        : look?.background === "canvas" && activeSeeds
          ? deriveThemeTokens(activeSeeds)["--kd-bg"]
          : undefined;

  return (
    <main
      className="embed-shell"
      data-embed-style={style}
      style={shellBackground ? { background: shellBackground } : undefined}
    >
      <KDiagramLive
        source={source}
        theme={locked ? (mode === "light" ? EMBED_LIGHT : EMBED_DARK) : "auto"}
        height="100%"
        frameless
        showThemeToggle={!locked && style === "explorer"}
        showSketchToggle={style === "explorer"}
        showViewControls={style !== "ambient"}
        showAnimationControls={style === "explorer"}
        showViewSwitcher={style !== "ambient"}
        options={options}
      />
      {locked && style === "explorer" ? (
        <div className="embed-palette-toggle">
          <IconButton
            icon={mode === "dark" ? Moon : Sun}
            iconOnly
            label={mode === "dark" ? "Switch to the light palette" : "Switch to the dark palette"}
            onClick={() => setMode((current) => (current === "dark" ? "light" : "dark"))}
          />
        </div>
      ) : null}
    </main>
  );
}
