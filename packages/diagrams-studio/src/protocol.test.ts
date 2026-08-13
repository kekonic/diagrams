import { describe, expect, it } from "vite-plus/test";
import { parseStudioClientMessage } from "./protocol.ts";

describe("studio protocol", () => {
  it("accepts versioned document updates", () => {
    expect(
      parseStudioClientMessage({
        version: 1,
        type: "source",
        documentId: "architecture.kdiagram",
        revision: 4,
        source: "diagram {}",
      }),
    ).toEqual({
      version: 1,
      type: "source",
      documentId: "architecture.kdiagram",
      revision: 4,
      source: "diagram {}",
    });
  });

  it("rejects unknown versions, messages, and unsafe viewport values", () => {
    expect(() => parseStudioClientMessage({ version: 2, type: "open" })).toThrow("version 1");
    expect(() => parseStudioClientMessage({ version: 1, type: "execute" })).toThrow(
      "Unknown studio message type",
    );
    expect(() =>
      parseStudioClientMessage({
        version: 1,
        type: "viewport",
        viewport: { zoom: 100, x: 0, y: 0 },
      }),
    ).toThrow("between 0.1 and 8");
  });
});
