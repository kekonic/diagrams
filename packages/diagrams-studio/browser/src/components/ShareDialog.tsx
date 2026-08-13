import { useEffect, useMemo, useState } from "react";
import { Check, Code2, Copy, ExternalLink, Image, Link2, X } from "lucide-react";
import { IconButton } from "./IconButton.tsx";
import { buildIframeEmbed, buildStudioSourceUrl, buildWebComponentEmbed } from "../lib/share.ts";

type Props = {
  source: string;
  studioUrl: string;
  onRenderSvg: () => Promise<string | null>;
  onClose: () => void;
};

type CopyTarget = "link" | "iframe" | "component" | "svg";

export function ShareDialog({ source, studioUrl, onRenderSvg, onClose }: Props) {
  const [copied, setCopied] = useState<CopyTarget>();
  const [error, setError] = useState<string>();
  const outputs = useMemo(
    () => ({
      link: buildStudioSourceUrl(source, studioUrl),
      iframe: buildIframeEmbed(source, studioUrl),
      component: buildWebComponentEmbed(source),
    }),
    [source, studioUrl],
  );

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  const copy = async (target: CopyTarget, value?: string) => {
    setError(undefined);
    try {
      const text = value ?? (await onRenderSvg());
      if (!text) throw new Error("Fix diagram errors before copying SVG.");
      await copyText(text);
      setCopied(target);
      window.setTimeout(
        () => setCopied((current) => (current === target ? undefined : current)),
        1800,
      );
    } catch (copyError) {
      setError(copyError instanceof Error ? copyError.message : "Could not copy to the clipboard");
    }
  };

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <section
        className="share-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="share-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="share-header">
          <div>
            <h2 id="share-title">Share and embed</h2>
            <p>Choose an editable source link or a presentation-ready embed.</p>
          </div>
          <IconButton icon={X} iconOnly label="Close" onClick={onClose} autoFocus />
        </header>

        <div className="share-options">
          <ShareOption
            icon={Link2}
            title="Editable Studio link"
            description="Opens this source in the hosted Studio. Source stays in the URL fragment."
            value={outputs.link}
            copied={copied === "link"}
            onCopy={() => void copy("link", outputs.link)}
          />
          <ShareOption
            icon={ExternalLink}
            title="Interactive iframe"
            description="A diagram-only pan, zoom, fullscreen, and animation embed."
            value={outputs.iframe}
            copied={copied === "iframe"}
            onCopy={() => void copy("iframe", outputs.iframe)}
          />
          <ShareOption
            icon={Code2}
            title="Web component"
            description="Framework-neutral code for projects that install KDiagram from npm."
            value={outputs.component}
            copied={copied === "component"}
            onCopy={() => void copy("component", outputs.component)}
          />
          <ShareOption
            icon={Image}
            title="SVG markup"
            description="Self-contained rendered markup for documents, sites, and design tools."
            copied={copied === "svg"}
            onCopy={() => void copy("svg")}
          />
        </div>
        {error ? <p className="share-error">{error}</p> : null}
      </section>
    </div>
  );
}

function ShareOption({
  icon: Icon,
  title,
  description,
  value,
  copied,
  onCopy,
}: {
  icon: typeof Link2;
  title: string;
  description: string;
  value?: string;
  copied: boolean;
  onCopy: () => void;
}) {
  return (
    <article className="share-option">
      <Icon size={18} strokeWidth={1.75} aria-hidden />
      <div className="share-option-copy">
        <h3>{title}</h3>
        <p>{description}</p>
        {value ? (
          <textarea value={value} readOnly rows={title === "Editable Studio link" ? 2 : 4} />
        ) : null}
      </div>
      <IconButton
        icon={copied ? Check : Copy}
        iconOnly
        label={copied ? "Copied" : `Copy ${title}`}
        active={copied}
        onClick={onCopy}
      />
    </article>
  );
}

async function copyText(text: string): Promise<void> {
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
