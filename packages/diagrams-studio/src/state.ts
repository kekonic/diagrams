import type {
  StudioCapabilities,
  StudioDocument,
  StudioPresentation,
  StudioRender,
  StudioSelection,
  StudioServerMessage,
  StudioViewport,
} from "./protocol.ts";

export type StudioState = {
  connected: boolean;
  sessionId?: string;
  documents: StudioDocument[];
  activeDocumentId?: string;
  capabilities: StudioCapabilities;
  presentation: StudioPresentation;
  render?: StudioRender;
  selection?: StudioSelection;
  viewport: StudioViewport;
  error?: { code: string; message: string };
};

export const INITIAL_STUDIO_STATE: StudioState = {
  connected: false,
  documents: [],
  capabilities: { write: false, export: true },
  presentation: { theme: "dark", options: { theme: "dark" } },
  viewport: { zoom: 1, x: 0, y: 0 },
};

export function reduceStudioMessage(state: StudioState, message: StudioServerMessage): StudioState {
  switch (message.type) {
    case "ready":
      return {
        ...state,
        connected: true,
        sessionId: message.sessionId,
        documents: message.documents,
        activeDocumentId: message.activeDocumentId,
        capabilities: message.capabilities,
        presentation: message.presentation,
        error: undefined,
      };
    case "document": {
      const documents = state.documents.some((item) => item.id === message.id)
        ? state.documents.map((item) =>
            item.id === message.id ? documentFromMessage(message) : item,
          )
        : [...state.documents, documentFromMessage(message)];
      return { ...state, documents, activeDocumentId: message.id, error: undefined };
    }
    case "render":
      if (message.documentId !== state.activeDocumentId) return state;
      if (state.render && message.revision < state.render.revision) return state;
      return { ...state, render: message };
    case "selection":
      return { ...state, selection: message.selection };
    case "viewport":
      return { ...state, viewport: message.viewport };
    case "presentation":
      return { ...state, presentation: message.presentation };
    case "saved":
      return state;
    case "error":
      return { ...state, error: { code: message.code, message: message.message } };
  }
}

function documentFromMessage(
  message: Extract<StudioServerMessage, { type: "document" }>,
): StudioDocument {
  return {
    id: message.id,
    path: message.path,
    label: message.label,
    revision: message.revision,
    source: message.source,
    resolvedSource: message.resolvedSource,
    activeView: message.activeView,
    compileTargets: message.compileTargets,
  };
}
