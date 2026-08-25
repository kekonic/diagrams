import { useCallback, useEffect, useRef, useState } from "react";
import { formatSource as formatKDiagramSource } from "@kekonic/diagrams-core";
import {
  reduceStudioMessage,
  INITIAL_STUDIO_STATE,
  type StudioClientMessage,
  type StudioDocument,
  type StudioServerMessage,
  type StudioState,
} from "../../../src/index.ts";
import { useStudio, type StudioApi } from "./useStudio.ts";
import { studioHostUrl } from "../lib/host.ts";

export type StudioConnection = {
  label: string;
  connected: boolean;
};

export type ConnectedStudioApi = StudioApi & {
  documents: StudioDocument[];
  activeDocumentId: string;
  connection: StudioConnection;
  selectView: (view?: string) => void;
};

export function useConnectedStudio(token: string): ConnectedStudioApi {
  const studio = useStudio();
  const [state, setState] = useState<StudioState>(INITIAL_STUDIO_STATE);
  const [baseline, setBaseline] = useState("");
  const [writeAuthorized, setWriteAuthorized] = useState(false);
  const [connection, setConnection] = useState<StudioConnection>({
    label: "Connecting…",
    connected: false,
  });
  const stateRef = useRef(state);
  const sourceTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  stateRef.current = state;

  const send = useCallback(
    async (message: StudioClientMessage) => {
      const response = await fetch(studioHostUrl(`message?token=${encodeURIComponent(token)}`), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(message),
      });
      if (!response.ok) {
        setConnection({ label: `Request failed: ${response.status}`, connected: false });
      }
    },
    [token],
  );

  const applyDocument = useCallback(
    (document: StudioDocument) => {
      studio.loadExample(document.id, document.source, {
        previewSource: document.resolvedSource ?? document.source,
        activeView: document.activeView,
        compileTargets: document.compileTargets,
      });
      setBaseline(document.source);
    },
    [studio.loadExample],
  );

  useEffect(() => {
    const events = new EventSource(studioHostUrl(`events?token=${encodeURIComponent(token)}`));
    events.onmessage = (event) => {
      const message = JSON.parse(event.data) as StudioServerMessage;
      setState((current) => {
        const next = reduceStudioMessage(current, message);
        stateRef.current = next;
        return next;
      });
      switch (message.type) {
        case "ready": {
          setWriteAuthorized(message.capabilities.write);
          setConnection({ label: "Connected", connected: true });
          const document = message.documents.find((item) => item.id === message.activeDocumentId);
          if (document) applyDocument(document);
          break;
        }
        case "document":
          applyDocument(message);
          break;
        case "saved": {
          const document = stateRef.current.documents.find(
            (item) => item.id === message.documentId,
          );
          if (document) setBaseline(document.source);
          setConnection({ label: "Saved", connected: true });
          break;
        }
        case "error":
          setConnection({ label: `${message.code}: ${message.message}`, connected: false });
          break;
        case "render":
        case "selection":
        case "viewport":
        case "presentation":
          break;
      }
    };
    events.onerror = () => setConnection({ label: "Reconnecting…", connected: false });
    return () => events.close();
  }, [applyDocument, token]);

  const updateSource = useCallback(
    (source: string) => {
      studio.updateSource(source);
      clearTimeout(sourceTimer.current);
      sourceTimer.current = setTimeout(() => {
        const document = stateRef.current.documents.find(
          (item) => item.id === stateRef.current.activeDocumentId,
        );
        if (!document) return;
        const revision = Math.max(
          document.revision + 1,
          (stateRef.current.render?.revision ?? 0) + 1,
        );
        document.revision = revision;
        document.source = source;
        void send({ version: 1, type: "source", documentId: document.id, revision, source });
      }, 120);
    },
    [send, studio.updateSource],
  );

  const openDocument = useCallback(
    (id: string) => void send({ version: 1, type: "open", documentId: id }),
    [send],
  );

  const selectView = useCallback(
    (view?: string) => {
      const documentId = stateRef.current.activeDocumentId;
      if (!documentId) return;
      void send({ version: 1, type: "selectView", documentId, view });
    },
    [send],
  );

  const saveDocument = useCallback(() => {
    const document = stateRef.current.documents.find(
      (item) => item.id === stateRef.current.activeDocumentId,
    );
    if (!document || !writeAuthorized) return;
    void send({
      version: 1,
      type: "save",
      documentId: document.id,
      revision: document.revision,
      source: studio.source,
    });
  }, [send, studio.source, writeAuthorized]);

  const formatSource = useCallback(() => {
    updateSource(formatKDiagramSource(studio.source));
  }, [updateSource, studio.source]);

  return {
    ...studio,
    documents: state.documents,
    activeDocumentId: state.activeDocumentId ?? "",
    connection,
    dirty: studio.source !== baseline,
    canSave: writeAuthorized && studio.source !== baseline,
    updateSource,
    loadExample: (id) => openDocument(id),
    saveExample: async () => saveDocument(),
    formatSource,
    selectView,
  };
}
