import { RotateCcw } from "lucide-react";
import {
  THEME_PRESETS,
  seedsForPreset,
  type ThemePresetId,
  type ThemeSeeds,
} from "../lib/deriveTheme.ts";
import { IconButton } from "./IconButton.tsx";

type Props = {
  seeds: ThemeSeeds;
  onChange: (patch: Partial<ThemeSeeds>) => void;
  onReset: () => void;
};

function normalizeColorInput(value: string): string {
  const normalized = value.trim();
  if (/^#[0-9a-fA-F]{6}$/.test(normalized)) return normalized;
  if (/^#[0-9a-fA-F]{3}$/.test(normalized)) {
    const [r, g, b] = normalized.slice(1);
    return `#${r}${r}${g}${g}${b}${b}`;
  }
  return "#000000";
}

function activePresetId(seeds: ThemeSeeds): ThemePresetId | null {
  for (const { id } of THEME_PRESETS) {
    const preset = seedsForPreset(id, seeds.mode);
    if (
      normalizeColorInput(preset.accent).toLowerCase() ===
        normalizeColorInput(seeds.accent).toLowerCase() &&
      normalizeColorInput(preset.neutral).toLowerCase() ===
        normalizeColorInput(seeds.neutral).toLowerCase()
    ) {
      return id;
    }
  }
  return null;
}

function ColorField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="field color-field">
      <span className="field-label">{label}</span>
      <div className="color-row">
        <input
          type="color"
          value={normalizeColorInput(value)}
          onChange={(event) => onChange(event.target.value)}
          aria-label={`${label} color`}
        />
        <input
          type="text"
          className="color-hex"
          value={value}
          spellCheck={false}
          aria-label={`${label} hex value`}
          onChange={(event) => onChange(event.target.value)}
        />
      </div>
    </label>
  );
}

export function ThemePanel({ seeds, onChange, onReset }: Props) {
  const activePreset = activePresetId(seeds);

  return (
    <div className="theme-panel">
      <div className="theme-presets" role="group" aria-label="Palette presets">
        {THEME_PRESETS.map(({ id, label }) => {
          const preview = seedsForPreset(id, seeds.mode);
          return (
            <button
              key={id}
              type="button"
              className="theme-preset"
              data-active={activePreset === id ? "true" : undefined}
              aria-pressed={activePreset === id}
              title={`${label} palette`}
              onClick={() => onChange(preview)}
            >
              <span
                className="theme-preset__swatch"
                style={{
                  background: `linear-gradient(135deg, ${preview.neutral} 45%, ${preview.accent} 45%)`,
                }}
                aria-hidden
              />
              <span>{label}</span>
            </button>
          );
        })}
      </div>

      <div className="field-stack">
        <ColorField
          label="Accent"
          value={seeds.accent}
          onChange={(accent) => onChange({ accent })}
        />
        <ColorField
          label="Neutral"
          value={seeds.neutral}
          onChange={(neutral) => onChange({ neutral })}
        />
      </div>

      <IconButton icon={RotateCcw} label="Reset palette" className="ghost tiny" onClick={onReset} />
    </div>
  );
}
