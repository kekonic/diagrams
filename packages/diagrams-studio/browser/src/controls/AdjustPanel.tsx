import { GitBranch, LayoutTemplate, Palette, RotateCcw } from "lucide-react";
import { Accordion, AccordionItem } from "../components/Accordion.tsx";
import { IconButton } from "../components/IconButton.tsx";
import { ThemePanel } from "../components/ThemePanel.tsx";
import { ControlField } from "./ControlField.tsx";
import { controlsFor } from "./registry.ts";
import type { StudioOptions } from "../lib/buildRenderOptions.ts";
import type { ThemeSeeds } from "../lib/deriveTheme.ts";

type Props = {
  options: StudioOptions;
  onChange: <K extends keyof StudioOptions>(key: K, value: StudioOptions[K]) => void;
  onReset: () => void;
  themeSeeds: ThemeSeeds;
  onThemeSeedsChange: (patch: Partial<ThemeSeeds>) => void;
  onResetThemeSeeds: () => void;
};

export function AdjustPanel({
  options,
  onChange,
  onReset,
  themeSeeds,
  onThemeSeedsChange,
  onResetThemeSeeds,
}: Props) {
  const appearance = controlsFor("appearance");
  const layout = controlsFor("layout");
  const edges = controlsFor("edges");

  return (
    <div className="sidebar-panel adjust-panel">
      <Accordion
        type="multiple"
        defaultValue={["appearance", "layout", "edges"]}
        className="sidebar-accordion"
      >
        <AccordionItem
          value="appearance"
          title={
            <>
              <Palette size={14} strokeWidth={1.75} aria-hidden />
              Appearance
            </>
          }
        >
          <div className="field-stack">
            {appearance.map((def) => (
              <ControlField key={def.id} def={def} options={options} onChange={onChange} />
            ))}
            <ThemePanel
              seeds={themeSeeds}
              onChange={onThemeSeedsChange}
              onReset={onResetThemeSeeds}
            />
            <p className="field-help">
              Mode is saved in source. The selected palette is embedded in exported SVG files.
            </p>
          </div>
        </AccordionItem>
        <AccordionItem
          value="layout"
          title={
            <>
              <LayoutTemplate size={14} strokeWidth={1.75} aria-hidden />
              Layout
            </>
          }
        >
          <div className="field-stack">
            {layout.map((def) => (
              <ControlField key={def.id} def={def} options={options} onChange={onChange} />
            ))}
            <div className="section-actions">
              <IconButton
                icon={RotateCcw}
                label="Remove settings"
                className="ghost tiny"
                onClick={onReset}
              />
            </div>
          </div>
        </AccordionItem>
        <AccordionItem
          value="edges"
          title={
            <>
              <GitBranch size={14} strokeWidth={1.75} aria-hidden />
              Edges
            </>
          }
        >
          <div className="field-stack">
            {edges.map((def) => (
              <ControlField key={def.id} def={def} options={options} onChange={onChange} />
            ))}
          </div>
        </AccordionItem>
      </Accordion>
    </div>
  );
}
