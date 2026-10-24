import { useEffect, useMemo, useState } from "react";
import { Check, Copy, Download, X } from "lucide-react";
import { strictHex } from "../lib/color.ts";
import {
  buildEmbedSnippet,
  EMBED_STYLES,
  effectiveEmbedColor,
  exportFilename,
  FILE_PRESETS,
  filePresetPatch,
  matchingFilePreset,
  paletteLabel,
  pngPixelSize,
  pngScaleFits,
  PNG_SCALES,
  seedsForPalette,
  type EmbedColorMode,
  type EmbedDelivery,
  type EmbedStyleId,
  type ExportBackground,
  type FileDelivery,
  type FilePresetId,
  type PngScale,
} from "../lib/delivery.ts";
import { deriveThemeTokens, THEME_PRESETS, type ThemeSeeds } from "../lib/deriveTheme.ts";
import { rasterizeSvg } from "../lib/rasterize.ts";
import { IconButton } from "./IconButton.tsx";

type Tab = "file" | "embed";

type Props = {
  source: string;
  documentName: string;
  studioUrl: string;
  studioSeeds: ThemeSeeds;
  initialTab: Tab;
  onRender: (file: FileDelivery) => Promise<string | null>;
  onApplyPalette: (seeds: ThemeSeeds) => void;
  onClose: () => void;
};

export function ExportDialog({
  source,
  documentName,
  studioUrl,
  studioSeeds,
  initialTab,
  onRender,
  onApplyPalette,
  onClose,
}: Props) {
  const [tab, setTab] = useState<Tab>(initialTab);
  const [file, setFile] = useState<FileDelivery>(() => ({
    format: "svg",
    palette: "studio",
    mode: studioSeeds.mode,
    background: "transparent",
    portable: true,
    embedFonts: false,
    scale: 2,
  }));
  const [embed, setEmbed] = useState<EmbedDelivery>({ style: "explorer", color: "lock" });
  const [svg, setSvg] = useState<string | null>();
  const [previewUrl, setPreviewUrl] = useState<string>();
  const [rendering, setRendering] = useState(true);
  const [renderError, setRenderError] = useState<string>();
  const [actionError, setActionError] = useState<string>();
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);

  const seeds = useMemo(
    () => seedsForPalette(file.palette, file.mode, studioSeeds),
    [file.mode, file.palette, studioSeeds],
  );
  const color = effectiveEmbedColor(embed.style, embed.color);
  const previewRequest = useMemo<FileDelivery>(() => {
    if (tab === "embed" && embed.style === "still") {
      return {
        ...file,
        format: "svg",
        portable: color === "lock",
        embedFonts: color === "lock" && file.embedFonts,
      };
    }
    if (tab === "embed") return { ...file, format: "svg" };
    return file;
  }, [color, embed.style, file, tab]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  useEffect(() => {
    let cancelled = false;
    const timer = window.setTimeout(() => {
      setRendering(true);
      setActionError(undefined);
      void onRender(previewRequest)
        .then((next) => {
          if (cancelled) return;
          setSvg(next);
          setRenderError(next ? undefined : "Fix the diagram errors before exporting.");
        })
        .catch((error: unknown) => {
          if (cancelled) return;
          setSvg(null);
          setRenderError(error instanceof Error ? error.message : "Could not render the diagram.");
        })
        .finally(() => {
          if (!cancelled) setRendering(false);
        });
    }, 160);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [onRender, previewRequest]);

  useEffect(() => {
    if (!svg) {
      setPreviewUrl(undefined);
      return;
    }
    const url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" }));
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [svg]);

  const snippet = useMemo(() => {
    try {
      return buildEmbedSnippet({
        style: embed.style,
        color: embed.color,
        source,
        studioUrl,
        documentName,
        seeds,
        background: file.background,
        svg,
        tokens: deriveThemeTokens(seeds),
      });
    } catch (error) {
      return {
        text: "",
        hint: error instanceof Error ? error.message : "Could not build this embed.",
      };
    }
  }, [documentName, embed.color, embed.style, file.background, seeds, source, studioUrl, svg]);

  const pixels = svg && file.format === "png" ? pngPixelSize(svg, file.scale) : undefined;
  const scaleFits = !svg || file.format !== "png" || pngScaleFits(svg, file.scale);
  const preset = matchingFilePreset(file);
  const presetDetail =
    FILE_PRESETS.find((item) => item.id === preset)?.detail ?? "Custom file settings.";
  const styleDetail = EMBED_STYLES.find((item) => item.id === embed.style)?.detail ?? "";
  const samePalette =
    seeds.mode === studioSeeds.mode &&
    strictHex(seeds.accent) === strictHex(studioSeeds.accent) &&
    strictHex(seeds.neutral) === strictHex(studioSeeds.neutral);

  const patch = (next: Partial<FileDelivery>) => setFile((current) => ({ ...current, ...next }));

  const copyText = async (text: string) => {
    setActionError(undefined);
    if (!text) throw new Error("Nothing to copy yet.");
    await writeClipboard(text);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  };

  const onDownload = async () => {
    if (!svg) return;
    setBusy(true);
    setActionError(undefined);
    try {
      if (file.format === "png") {
        const blob = await rasterizeSvg(svg, file.scale);
        downloadBlob(blob, exportFilename(documentName, "png"));
      } else {
        downloadBlob(
          new Blob([svg], { type: "image/svg+xml" }),
          exportFilename(documentName, "svg"),
        );
      }
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Could not download the diagram.");
    } finally {
      setBusy(false);
    }
  };

  const onCopy = async () => {
    setBusy(true);
    try {
      if (tab === "embed") {
        await copyText(snippet.text);
        return;
      }
      if (!svg) throw new Error("Fix the diagram errors before copying.");
      if (file.format === "png") {
        const blob = await rasterizeSvg(svg, file.scale);
        if (!navigator.clipboard?.write || typeof ClipboardItem === "undefined") {
          throw new Error("This browser cannot copy a PNG. Download it instead.");
        }
        await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1800);
        return;
      }
      await copyText(svg);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Could not copy.");
    } finally {
      setBusy(false);
    }
  };

  const meta = renderError
    ? renderError
    : rendering
      ? "Rendering preview…"
      : file.format === "png" && tab === "file" && pixels
        ? `PNG · ${pixels.width}×${pixels.height} at ${file.scale}× · ${paletteLabel(file.palette)} · ${file.mode}`
        : `SVG · ${paletteLabel(file.palette)} · ${file.mode} · ${groundLabel(file.background)}`;

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <section
        className="export-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="export-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="export-header">
          <div>
            <h2 id="export-title">Export</h2>
            <p>Download a file, or copy an embed that keeps this look.</p>
          </div>
          <IconButton icon={X} iconOnly label="Close" onClick={onClose} autoFocus />
          <div className="export-tabs" role="tablist" aria-label="Export destination">
            <button
              type="button"
              role="tab"
              id="export-tab-file"
              className="export-tab"
              aria-selected={tab === "file"}
              aria-controls="export-panel"
              onClick={() => setTab("file")}
            >
              File
            </button>
            <button
              type="button"
              role="tab"
              id="export-tab-embed"
              className="export-tab"
              aria-selected={tab === "embed"}
              aria-controls="export-panel"
              onClick={() => setTab("embed")}
            >
              Embed
            </button>
          </div>
        </header>

        <div className="export-body">
          <div className="export-preview-column">
            <div
              className="export-preview-stage"
              data-ground={file.background}
              aria-busy={rendering}
            >
              {previewUrl ? (
                <img src={previewUrl} alt="Export preview of the diagram" />
              ) : (
                <p>{rendering ? "Rendering…" : "No preview"}</p>
              )}
            </div>
            <p className="export-preview-meta" role="status">
              {meta}
            </p>
          </div>

          <div
            className="export-controls"
            id="export-panel"
            role="tabpanel"
            aria-labelledby={tab === "file" ? "export-tab-file" : "export-tab-embed"}
          >
            {tab === "file" ? (
              <FileControls
                file={file}
                seeds={seeds}
                studioSeeds={studioSeeds}
                presetDetail={presetDetail}
                samePalette={samePalette}
                scaleFits={scaleFits}
                onPreset={(id) => setFile((current) => filePresetPatch(id, current))}
                onPatch={patch}
                onApply={() => onApplyPalette(seeds)}
              />
            ) : (
              <EmbedControls
                embed={embed}
                color={color}
                detail={styleDetail}
                snippet={snippet.text}
                hint={snippet.hint}
                onStyle={(style) => setEmbed((current) => ({ ...current, style }))}
                onColor={(next) => setEmbed((current) => ({ ...current, color: next }))}
              />
            )}
            {actionError ? <p className="share-error">{actionError}</p> : null}
          </div>
        </div>

        <footer className="export-footer">
          <p className="export-footer-note">
            {tab === "file"
              ? file.format === "png"
                ? "PNG flattens the diagram, including Inter, so it can be dropped into a slide."
                : file.portable
                  ? "SVG stays sharp at any size."
                  : "This SVG expects the host page to supply theme tokens."
              : "The preview uses the file look. Embeds say when the host takes over color."}
          </p>
          <div className="export-footer-actions">
            <IconButton
              icon={copied ? Check : Copy}
              label={
                copied
                  ? "Copied"
                  : tab === "embed"
                    ? "Copy embed"
                    : file.format === "png"
                      ? "Copy PNG"
                      : "Copy SVG"
              }
              onClick={() => void onCopy()}
              disabled={busy || (tab === "file" ? rendering || !svg || !scaleFits : !snippet.text)}
            />
            {tab === "file" ? (
              <button
                type="button"
                className="export-primary"
                onClick={() => void onDownload()}
                disabled={busy || rendering || !svg || !scaleFits}
              >
                <Download size={16} strokeWidth={1.75} aria-hidden />
                {file.format === "png" ? "Download PNG" : "Download SVG"}
              </button>
            ) : null}
          </div>
        </footer>
      </section>
    </div>
  );
}

function FileControls({
  file,
  seeds,
  studioSeeds,
  presetDetail,
  samePalette,
  scaleFits,
  onPreset,
  onPatch,
  onApply,
}: {
  file: FileDelivery;
  seeds: ThemeSeeds;
  studioSeeds: ThemeSeeds;
  presetDetail: string;
  samePalette: boolean;
  scaleFits: boolean;
  onPreset: (id: FilePresetId) => void;
  onPatch: (patch: Partial<FileDelivery>) => void;
  onApply: () => void;
}) {
  return (
    <>
      <Segment
        name="export-preset"
        label="Start from"
        value={matchingFilePreset(file) ?? ""}
        options={FILE_PRESETS.map((item) => ({ value: item.id, label: item.label }))}
        onChange={(value) => onPreset(value as FilePresetId)}
      />
      <p className="field-help">{presetDetail}</p>

      <Segment
        name="export-format"
        label="Format"
        value={file.format}
        options={[
          { value: "svg", label: "SVG" },
          { value: "png", label: "PNG" },
        ]}
        onChange={(format) => onPatch({ format: format as FileDelivery["format"] })}
      />

      <div className="export-field">
        <span className="field-label">Palette</span>
        <div className="export-swatches" role="group" aria-label="Palette">
          <Swatch
            label="Studio"
            accent={seedsForPalette("studio", file.mode, studioSeeds).accent}
            neutral={seedsForPalette("studio", file.mode, studioSeeds).neutral}
            active={file.palette === "studio"}
            onClick={() => onPatch({ palette: "studio" })}
          />
          {THEME_PRESETS.map((item) => {
            const preview = seedsForPalette(item.id, file.mode, studioSeeds);
            return (
              <Swatch
                key={item.id}
                label={item.label}
                accent={preview.accent}
                neutral={preview.neutral}
                active={file.palette === item.id}
                onClick={() => onPatch({ palette: item.id })}
              />
            );
          })}
        </div>
      </div>

      <Segment
        name="export-mode"
        label="Mode"
        value={file.mode}
        options={[
          { value: "dark", label: "Dark" },
          { value: "light", label: "Light" },
        ]}
        onChange={(mode) => onPatch({ mode: mode as FileDelivery["mode"] })}
      />
      <Segment
        name="export-ground"
        label="Ground"
        value={file.background}
        options={[
          { value: "transparent", label: "Transparent" },
          { value: "canvas", label: "Canvas" },
          { value: "white", label: "White" },
        ]}
        onChange={(background) => onPatch({ background: background as ExportBackground })}
      />

      {file.format === "png" ? (
        <>
          <Segment
            name="export-scale"
            label="Scale"
            value={String(file.scale)}
            options={PNG_SCALES.map((scale) => ({ value: String(scale), label: `${scale}×` }))}
            onChange={(value) => onPatch({ scale: Number(value) as PngScale })}
          />
          <p className="field-help">
            {scaleFits
              ? "PNG saves this palette and Inter so the text stays sharp."
              : "This scale is larger than the browser can encode. Choose a smaller one."}
          </p>
        </>
      ) : (
        <details className="export-details">
          <summary>
            {file.portable ? "Colors are saved in the file" : "Colors follow the host page"}
            {file.embedFonts ? " · Inter embedded" : ""}
          </summary>
          <label className="export-check">
            <input
              type="checkbox"
              checked={file.portable}
              onChange={(event) =>
                onPatch({
                  portable: event.target.checked,
                  embedFonts: event.target.checked ? file.embedFonts : false,
                })
              }
            />
            Portable colors
          </label>
          <label className="export-check">
            <input
              type="checkbox"
              checked={file.embedFonts}
              disabled={!file.portable}
              onChange={(event) => onPatch({ embedFonts: event.target.checked })}
            />
            Embed Inter
          </label>
          <p className="field-help">
            Portable files keep their colors in Preview, slides, and README images. Turn that off
            only when the page already provides Kekonic Diagrams theme tokens.
          </p>
        </details>
      )}

      <button type="button" className="icon-btn ghost" onClick={onApply} disabled={samePalette}>
        {samePalette ? "This is the studio palette" : "Use this palette in the studio"}
      </button>
      <p className="field-help">
        {paletteLabel(file.palette)} · {seeds.mode}. Applying it changes the studio chrome
        {file.mode === studioSeeds.mode ? "." : " and writes the mode into the diagram."}
      </p>
    </>
  );
}

function EmbedControls({
  embed,
  color,
  detail,
  snippet,
  hint,
  onStyle,
  onColor,
}: {
  embed: EmbedDelivery;
  color: EmbedColorMode;
  detail: string;
  snippet: string;
  hint: string;
  onStyle: (style: EmbedStyleId) => void;
  onColor: (color: EmbedColorMode) => void;
}) {
  const colorLocked = embed.style === "ambient" || embed.style === "markdown";
  return (
    <>
      <div className="export-field">
        <span className="field-label">Style</span>
        <div className="export-styles" role="group" aria-label="Embed style">
          {EMBED_STYLES.map((item) => (
            <button
              key={item.id}
              type="button"
              className="export-style"
              data-active={embed.style === item.id ? "true" : undefined}
              aria-pressed={embed.style === item.id}
              onClick={() => onStyle(item.id)}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>
      <p className="field-help">{detail}</p>
      <Segment
        name="export-embed-color"
        label="Colors"
        value={color}
        options={[
          { value: "lock", label: "This palette" },
          { value: "follow", label: "Follow the page" },
        ]}
        disabled={colorLocked}
        onChange={(value) => onColor(value as EmbedColorMode)}
      />
      <textarea
        className="export-snippet"
        readOnly
        rows={8}
        spellCheck={false}
        value={snippet}
        aria-label="Embed snippet"
        onFocus={(event) => event.currentTarget.select()}
      />
      <p className="field-help">{hint}</p>
    </>
  );
}

function Swatch({
  label,
  accent,
  neutral,
  active,
  onClick,
}: {
  label: string;
  accent: string;
  neutral: string;
  active: boolean;
  onClick: () => void;
}) {
  const accentSafe = strictHex(accent) ?? "#888888";
  const neutralSafe = strictHex(neutral) ?? "#111111";
  return (
    <button
      type="button"
      className="theme-preset"
      data-active={active ? "true" : undefined}
      aria-pressed={active}
      onClick={onClick}
    >
      <span
        className="theme-preset__swatch"
        style={{ background: `linear-gradient(135deg, ${neutralSafe} 45%, ${accentSafe} 45%)` }}
        aria-hidden
      />
      <span>{label}</span>
    </button>
  );
}

function Segment({
  name,
  label,
  value,
  options,
  disabled,
  onChange,
}: {
  name: string;
  label: string;
  value: string;
  options: ReadonlyArray<{ value: string; label: string }>;
  disabled?: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <fieldset className="export-segment" disabled={disabled}>
      <legend>{label}</legend>
      <div className="export-segment-options">
        {options.map((option) => (
          <label
            key={option.value}
            className="export-segment-option"
            data-active={!disabled && value === option.value ? "true" : undefined}
          >
            <input
              type="radio"
              name={name}
              value={option.value}
              checked={value === option.value}
              onChange={() => onChange(option.value)}
            />
            <span>{option.label}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

function groundLabel(background: ExportBackground): string {
  if (background === "canvas") return "Canvas";
  if (background === "white") return "White";
  return "Transparent";
}

function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

async function writeClipboard(text: string): Promise<void> {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }
  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  document.body.append(textarea);
  textarea.select();
  const copied = document.execCommand("copy");
  textarea.remove();
  if (!copied) throw new Error("Clipboard access is unavailable.");
}
