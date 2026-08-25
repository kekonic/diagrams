import type {
  Diagnostic,
  GraphModel,
  InteractiveRenderOptions,
  RenderStats,
  SourceRange,
} from "@kekonic/diagrams";

export const STUDIO_PROTOCOL_VERSION = 1 as const;

export type StudioCompileTarget = {
  kind: "model-view";
  viewName: string;
  title: string;
};

export type StudioDocument = {
  id: string;
  path: string;
  label: string;
  revision: number;
  source: string;
  /** Import-resolved source for preview hosts that cannot read the filesystem. */
  resolvedSource?: string;
  activeView?: string;
  compileTargets?: StudioCompileTarget[];
};

export type StudioCapabilities = {
  write: boolean;
  export: true;
};

export type StudioSelection = {
  documentId: string;
  range?: SourceRange;
  graphElement?: { type: "node" | "edge"; id: string };
};

export type StudioViewport = {
  zoom: number;
  x: number;
  y: number;
};

export type StudioPresentation = {
  theme: "dark" | "light";
  options: InteractiveRenderOptions;
};

export type StudioRender = {
  documentId: string;
  revision: number;
  ok: boolean;
  svg?: string;
  diagnostics: Diagnostic[];
  graph?: GraphModel;
  stats: RenderStats;
};

export type StudioServerMessage =
  | {
      version: 1;
      type: "ready";
      sessionId: string;
      documents: StudioDocument[];
      activeDocumentId: string;
      capabilities: StudioCapabilities;
      presentation: StudioPresentation;
    }
  | ({ version: 1; type: "document"; reason: "open" | "external" | "saved" } & StudioDocument)
  | ({ version: 1; type: "render" } & StudioRender)
  | { version: 1; type: "selection"; selection: StudioSelection }
  | { version: 1; type: "viewport"; viewport: StudioViewport }
  | { version: 1; type: "presentation"; presentation: StudioPresentation }
  | { version: 1; type: "saved"; documentId: string; revision: number }
  | { version: 1; type: "error"; code: string; message: string; requestType?: string };

export type StudioClientMessage =
  | { version: 1; type: "open"; documentId: string }
  | { version: 1; type: "selectView"; documentId: string; view?: string }
  | { version: 1; type: "source"; documentId: string; revision: number; source: string }
  | { version: 1; type: "save"; documentId: string; revision: number; source: string }
  | { version: 1; type: "selection"; selection: StudioSelection }
  | { version: 1; type: "viewport"; viewport: StudioViewport }
  | { version: 1; type: "presentation"; presentation: StudioPresentation };

export function parseStudioClientMessage(value: unknown): StudioClientMessage {
  if (
    !isRecord(value) ||
    value.version !== STUDIO_PROTOCOL_VERSION ||
    typeof value.type !== "string"
  ) {
    throw new Error("Expected a version 1 studio message");
  }
  switch (value.type) {
    case "open":
      return {
        version: 1,
        type: "open",
        documentId: requiredString(value.documentId, "documentId"),
      };
    case "selectView":
      return {
        version: 1,
        type: "selectView",
        documentId: requiredString(value.documentId, "documentId"),
        view: typeof value.view === "string" ? value.view : undefined,
      };
    case "source":
    case "save":
      return {
        version: 1,
        type: value.type,
        documentId: requiredString(value.documentId, "documentId"),
        revision: requiredRevision(value.revision),
        source: requiredString(value.source, "source", true),
      };
    case "selection":
      return { version: 1, type: "selection", selection: parseSelection(value.selection) };
    case "viewport":
      return { version: 1, type: "viewport", viewport: parseViewport(value.viewport) };
    case "presentation":
      return {
        version: 1,
        type: "presentation",
        presentation: parsePresentation(value.presentation),
      };
    default:
      throw new Error(`Unknown studio message type: ${value.type}`);
  }
}

export function studioMessageJson(message: StudioServerMessage): string {
  return JSON.stringify(message);
}

function parseSelection(value: unknown): StudioSelection {
  if (!isRecord(value)) throw new Error("selection must be an object");
  const selection: StudioSelection = {
    documentId: requiredString(value.documentId, "selection.documentId"),
  };
  if (value.range != null) selection.range = value.range as SourceRange;
  if (isRecord(value.graphElement)) {
    const type = value.graphElement.type;
    if (type !== "node" && type !== "edge") throw new Error("Invalid graph element type");
    selection.graphElement = {
      type,
      id: requiredString(value.graphElement.id, "selection.graphElement.id"),
    };
  }
  return selection;
}

function parseViewport(value: unknown): StudioViewport {
  if (!isRecord(value)) throw new Error("viewport must be an object");
  const zoom = requiredFinite(value.zoom, "viewport.zoom");
  if (zoom < 0.1 || zoom > 8) throw new Error("viewport.zoom must be between 0.1 and 8");
  return {
    zoom,
    x: requiredFinite(value.x, "viewport.x"),
    y: requiredFinite(value.y, "viewport.y"),
  };
}

function parsePresentation(value: unknown): StudioPresentation {
  if (!isRecord(value) || (value.theme !== "dark" && value.theme !== "light")) {
    throw new Error("presentation.theme must be dark or light");
  }
  if (!isRecord(value.options)) throw new Error("presentation.options must be an object");
  return { theme: value.theme, options: value.options as InteractiveRenderOptions };
}

function requiredString(value: unknown, label: string, allowEmpty = false): string {
  if (typeof value !== "string" || (!allowEmpty && value.length === 0)) {
    throw new Error(`${label} must be a string`);
  }
  return value;
}

function requiredRevision(value: unknown): number {
  if (!Number.isSafeInteger(value) || (value as number) < 0) {
    throw new Error("revision must be a non-negative safe integer");
  }
  return value as number;
}

function requiredFinite(value: unknown, label: string): number {
  if (typeof value !== "number" || !Number.isFinite(value))
    throw new Error(`${label} must be finite`);
  return value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value != null && typeof value === "object" && !Array.isArray(value);
}
