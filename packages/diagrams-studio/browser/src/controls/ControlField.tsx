import type { ControlDef } from "./registry.ts";
import type { StudioOptions } from "../lib/buildRenderOptions.ts";

type Props = {
  def: ControlDef;
  options: StudioOptions;
  onChange: <K extends keyof StudioOptions>(key: K, value: StudioOptions[K]) => void;
};

function isAutoValue(value: unknown): boolean {
  return value === "" || value == null;
}

export function ControlField({ def, options, onChange }: Props) {
  const value = options[def.id];

  if (def.kind === "segment") {
    const current = String(value ?? "");
    const auto = isAutoValue(value);
    return (
      <div
        className={auto ? "field field-segment is-auto" : "field field-segment"}
        title={def.title}
      >
        <span className="field-label">{def.label}</span>
        <div className="segmented" role="radiogroup" aria-label={def.label}>
          {def.options.map((opt) => {
            const selected = current === opt.value;
            const tip = opt.title ?? opt.label;
            return (
              <button
                key={opt.value || "__empty"}
                type="button"
                role="radio"
                aria-checked={selected}
                className={selected ? "segment is-selected" : "segment"}
                title={tip}
                onClick={() => onChange(def.id, opt.value as StudioOptions[typeof def.id])}
              >
                {opt.shortLabel ?? opt.label}
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  if (def.kind === "select") {
    const auto = isAutoValue(value);
    return (
      <label className={auto ? "field is-auto" : "field"} title={def.title}>
        <span className="field-label">{def.label}</span>
        <select
          value={String(value ?? "")}
          onChange={(e) => onChange(def.id, e.target.value as StudioOptions[typeof def.id])}
        >
          {def.options.map((opt) => (
            <option key={opt.value || "__empty"} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </label>
    );
  }

  if (def.kind === "range") {
    const numeric = typeof value === "number" ? value : null;
    const auto = numeric == null;
    const display = auto ? (def.nullLabel ?? "Auto") : (def.format?.(numeric) ?? String(numeric));
    const mid = (def.min + def.max) / 2;

    return (
      <label className={auto ? "field field-range is-auto" : "field field-range"} title={def.title}>
        <span className="field-label">
          {def.label}
          <output>{display}</output>
        </span>
        <div className="range-row">
          <input
            type="range"
            min={def.min}
            max={def.max}
            step={def.step}
            value={numeric ?? mid}
            onChange={(e) =>
              onChange(def.id, parseFloat(e.target.value) as StudioOptions[typeof def.id])
            }
          />
          <button
            type="button"
            className="ghost tiny"
            title="Use diagram source / engine default"
            disabled={auto}
            onClick={() => onChange(def.id, null as StudioOptions[typeof def.id])}
          >
            Auto
          </button>
        </div>
      </label>
    );
  }

  const on = Boolean(value);
  return (
    <div className="field field-toggle" title={def.title}>
      <span className="field-label" id={`toggle-${def.id}`}>
        {def.label}
      </span>
      <button
        type="button"
        className={on ? "toggle is-on" : "toggle"}
        role="switch"
        aria-checked={on}
        aria-labelledby={`toggle-${def.id}`}
        onClick={() => onChange(def.id, !on as StudioOptions[typeof def.id])}
      >
        <span className="toggle-thumb" aria-hidden />
      </button>
    </div>
  );
}
