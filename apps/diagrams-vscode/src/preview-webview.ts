import "@kekonic/diagrams-element";
import type { KDiagramElement } from "@kekonic/diagrams-element";
import { ensureOfflineIconCollections } from "./offline-icons.ts";
import { syncVsCodePreviewTheme, VSCODE_PREVIEW_THEME } from "./vscode-theme-bridge.ts";

type PreviewHostMessage =
  | {
      type: "update";
      source: string;
      theme: "dark" | "light";
      revision: number;
    }
  | { type: "retheme" };

let appliedRevision = -1;
let diagram: KDiagramElement | null = null;
let rethemeTimer: ReturnType<typeof setTimeout> | undefined;

function acquireDiagram(): KDiagramElement {
  if (diagram) return diagram;
  const el = document.getElementById("diagram");
  if (!(el instanceof HTMLElement) || el.tagName.toLowerCase() !== "k-diagram") {
    throw new Error("Preview <k-diagram> host is missing");
  }
  diagram = el as KDiagramElement;
  return diagram;
}

async function applyWorkbenchTheme(refresh = false): Promise<void> {
  syncVsCodePreviewTheme();
  const host = acquireDiagram();
  host.theme = VSCODE_PREVIEW_THEME;
  if (refresh) await host.refreshTheme();
}

function scheduleWorkbenchThemeRefresh(): void {
  if (rethemeTimer) clearTimeout(rethemeTimer);
  rethemeTimer = setTimeout(() => {
    rethemeTimer = undefined;
    void applyWorkbenchTheme(true);
  }, 50);
}

async function applyUpdate(
  message: Extract<PreviewHostMessage, { type: "update" }>,
): Promise<void> {
  if (message.revision < appliedRevision) return;
  appliedRevision = message.revision;
  await ensureOfflineIconCollections("preview-webview.js");
  await applyWorkbenchTheme(false);
  const host = acquireDiagram();
  host.source = message.source;
}

function isPreviewHostMessage(value: unknown): value is PreviewHostMessage {
  if (!value || typeof value !== "object") return false;
  const message = value as Record<string, unknown>;
  if (message.type === "retheme") return true;
  return (
    message.type === "update" &&
    typeof message.source === "string" &&
    (message.theme === "dark" || message.theme === "light") &&
    typeof message.revision === "number"
  );
}

window.addEventListener("message", (event) => {
  if (!isPreviewHostMessage(event.data)) return;
  if (event.data.type === "retheme") {
    scheduleWorkbenchThemeRefresh();
    return;
  }
  void applyUpdate(event.data);
});

const bodyObserver = new MutationObserver(() => {
  scheduleWorkbenchThemeRefresh();
});
bodyObserver.observe(document.body, { attributes: true, attributeFilter: ["class"] });

void ensureOfflineIconCollections("preview-webview.js").then(async () => {
  await applyWorkbenchTheme(false);
  const vscodeApi = (
    globalThis as typeof globalThis & {
      acquireVsCodeApi?: () => { postMessage: (message: unknown) => void };
    }
  ).acquireVsCodeApi?.();
  vscodeApi?.postMessage({ type: "ready" });
});
