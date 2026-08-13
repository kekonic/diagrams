export type KDiagramFileHandle = {
  name: string;
  getFile(): Promise<File>;
  createWritable(): Promise<{
    write(data: string): Promise<void>;
    close(): Promise<void>;
  }>;
};

type PickerWindow = Window & {
  showOpenFilePicker?: (options: unknown) => Promise<KDiagramFileHandle[]>;
  showSaveFilePicker?: (options: unknown) => Promise<KDiagramFileHandle>;
};

export type OpenedKDiagramFile = {
  name: string;
  source: string;
  handle?: KDiagramFileHandle;
};

export type SavedKDiagramFile = {
  name: string;
  handle?: KDiagramFileHandle;
  downloaded: boolean;
};

const PICKER_OPTIONS = {
  types: [
    {
      description: "KDiagram diagram",
      accept: { "text/plain": [".kdiagram"] },
    },
  ],
  excludeAcceptAllOption: false,
};

export async function openKDiagramFile(
  pickerWindow: PickerWindow = window as PickerWindow,
  hostDocument: Document = document,
): Promise<OpenedKDiagramFile | null> {
  if (pickerWindow.showOpenFilePicker) {
    try {
      const [handle] = await pickerWindow.showOpenFilePicker({
        ...PICKER_OPTIONS,
        multiple: false,
      });
      if (!handle) return null;
      const file = await handle.getFile();
      return { name: handle.name, source: await file.text(), handle };
    } catch (error) {
      if (isAbort(error)) return null;
      throw error;
    }
  }

  return openWithInput(hostDocument);
}

export async function saveKDiagramFile(
  source: string,
  suggestedName: string,
  currentHandle?: KDiagramFileHandle,
  saveAs = false,
  pickerWindow: PickerWindow = window as PickerWindow,
  hostDocument: Document = document,
): Promise<SavedKDiagramFile | null> {
  let handle = saveAs ? undefined : currentHandle;
  if (!handle && pickerWindow.showSaveFilePicker) {
    try {
      handle = await pickerWindow.showSaveFilePicker({
        ...PICKER_OPTIONS,
        suggestedName: ensureKDiagramFilename(suggestedName),
      });
    } catch (error) {
      if (isAbort(error)) return null;
      throw error;
    }
  }

  const normalized = source.endsWith("\n") ? source : `${source}\n`;
  if (handle) {
    const writable = await handle.createWritable();
    await writable.write(normalized);
    await writable.close();
    return { name: handle.name, handle, downloaded: false };
  }

  downloadText(normalized, ensureKDiagramFilename(suggestedName), hostDocument);
  return { name: ensureKDiagramFilename(suggestedName), downloaded: true };
}

export function ensureKDiagramFilename(name: string): string {
  const trimmed = name.trim() || "diagram";
  return trimmed.toLowerCase().endsWith(".kdiagram") ? trimmed : `${trimmed}.kdiagram`;
}

function openWithInput(hostDocument: Document): Promise<OpenedKDiagramFile | null> {
  return new Promise((resolve) => {
    const input = hostDocument.createElement("input");
    input.type = "file";
    input.accept = ".kdiagram,text/plain";
    input.hidden = true;
    input.addEventListener(
      "change",
      () => {
        const file = input.files?.[0];
        input.remove();
        if (!file) {
          resolve(null);
          return;
        }
        void file.text().then((source) => resolve({ name: file.name, source }));
      },
      { once: true },
    );
    input.addEventListener(
      "cancel",
      () => {
        input.remove();
        resolve(null);
      },
      { once: true },
    );
    hostDocument.body.append(input);
    input.click();
  });
}

function downloadText(source: string, name: string, hostDocument: Document): void {
  const url = URL.createObjectURL(new Blob([source], { type: "text/plain;charset=utf-8" }));
  const anchor = hostDocument.createElement("a");
  anchor.href = url;
  anchor.download = name;
  anchor.click();
  URL.revokeObjectURL(url);
}

function isAbort(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}
