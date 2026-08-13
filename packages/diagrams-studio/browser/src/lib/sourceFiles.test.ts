import { describe, expect, it } from "vite-plus/test";
import {
  ensureKDiagramFilename,
  saveKDiagramFile,
  type KDiagramFileHandle,
} from "./sourceFiles.ts";

describe("KDiagram source files", () => {
  it("normalizes source filenames", () => {
    expect(ensureKDiagramFilename("architecture")).toBe("architecture.kdiagram");
    expect(ensureKDiagramFilename("model.kdiagram")).toBe("model.kdiagram");
    expect(ensureKDiagramFilename(" ")).toBe("diagram.kdiagram");
  });

  it("writes normalized source through an existing native handle", async () => {
    let written = "";
    let closed = false;
    const handle: KDiagramFileHandle = {
      name: "architecture.kdiagram",
      getFile: async () => new File([], "architecture.kdiagram"),
      createWritable: async () => ({
        write: async (source) => {
          written = source;
        },
        close: async () => {
          closed = true;
        },
      }),
    };

    const result = await saveKDiagramFile(
      "diagram {}",
      "ignored",
      handle,
      false,
      {} as Window,
      {} as Document,
    );
    expect(result).toEqual({ name: "architecture.kdiagram", handle, downloaded: false });
    expect(written).toBe("diagram {}\n");
    expect(closed).toBe(true);
  });
});
