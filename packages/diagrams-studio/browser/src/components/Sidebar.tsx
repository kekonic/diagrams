import { SlidersHorizontal } from "lucide-react";
import { AdjustPanel } from "../controls/AdjustPanel.tsx";
import type { StudioOptions } from "../lib/buildRenderOptions.ts";
import type { ThemeSeeds } from "../lib/deriveTheme.ts";

type Props = {
  open: boolean;
  options: StudioOptions;
  onChange: <K extends keyof StudioOptions>(key: K, value: StudioOptions[K]) => void;
  onReset: () => void;
  themeSeeds: ThemeSeeds;
  onThemeSeedsChange: (patch: Partial<ThemeSeeds>) => void;
  onResetThemeSeeds: () => void;
};

export function Sidebar({
  open,
  options,
  onChange,
  onReset,
  themeSeeds,
  onThemeSeedsChange,
  onResetThemeSeeds,
}: Props) {
  if (!open) return null;

  return (
    <aside className="drawer sidebar" aria-label="Adjust diagram">
      <header className="sidebar-header">
        <h2>
          <SlidersHorizontal size={16} strokeWidth={1.75} aria-hidden />
          Diagram settings
        </h2>
      </header>
      <div className="sidebar-body">
        <AdjustPanel
          options={options}
          onChange={onChange}
          onReset={onReset}
          themeSeeds={themeSeeds}
          onThemeSeedsChange={onThemeSeedsChange}
          onResetThemeSeeds={onResetThemeSeeds}
        />
      </div>
    </aside>
  );
}
