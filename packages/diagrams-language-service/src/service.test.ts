import { describe, expect, it } from "vite-plus/test";
import { KDiagramLanguageService, offsetAt, positionAt } from "./index.ts";

const URI = "file:///architecture.kdiagram";
const SOURCE = `diagram "Checkout" {
  api: service "API" { icon: server } is important
  db: database "Orders" { shape: cylinder }
  api -> db "writes"
  style important { --node-stroke: "red" }
}
`;

describe("KDiagramLanguageService", () => {
  it("offers the state diagram keyword", () => {
    const service = new KDiagramLanguageService();
    service.updateDocument(URI, "sta", 1);
    expect(
      service.complete(URI, { line: 0, column: 3 }).some((item) => item.label === "state"),
    ).toBe(true);
  });

  it("maintains versioned snapshots and deterministic diagnostics", () => {
    const service = new KDiagramLanguageService();
    expect(service.updateDocument(URI, SOURCE, 2).version).toBe(2);
    expect(service.updateDocument(URI, "invalid", 1).source).toBe(SOURCE);
    expect(service.diagnostics(URI)).toEqual([]);
  });

  it("applies incremental document changes before refreshing diagnostics", () => {
    const service = new KDiagramLanguageService();
    const source = "diagram {\n  api: servce\n}\n";
    service.updateDocument(URI, source, 1);
    const snapshot = service.applyDocumentChanges(URI, 2, [
      {
        range: {
          start: { line: 2, column: 8, offset: source.indexOf("servce") },
          end: { line: 2, column: 14, offset: source.indexOf("servce") + 6 },
        },
        text: "service",
      },
    ]);
    expect(snapshot.source).toContain("api: service");
    expect(snapshot.diagnostics).toEqual([]);
  });

  it("completes kinds, icons, properties, references, and extension semantics", () => {
    const service = new KDiagramLanguageService();
    service.registerExtension({
      protocolVersion: 1,
      id: "acme",
      kinds: { queueWorker: { description: "Acme queue worker", shape: "hexagon" } },
      properties: [{ name: "owner", description: "Owning team" }],
    });
    const kindSource = "diagram {\n  worker: que\n}";
    service.updateDocument(URI, kindSource, 1);
    expect(service.complete(URI, positionAt(kindSource, kindSource.indexOf("que") + 3))).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ label: "service", kind: "kind" }),
        expect.objectContaining({ label: "queueWorker" }),
      ]),
    );
    service.updateDocument(URI, "diagram { worker: queueWorker }", 2);
    expect(service.hover(URI, positionAt("diagram { worker: queueWorker }", 22))?.preview).toEqual({
      kind: "queueWorker",
      shape: "hexagon",
    });

    const propertySource = "diagram {\n  api: service { ow\n}";
    service.updateDocument(URI, propertySource, 3);
    expect(
      service.complete(URI, positionAt(propertySource, propertySource.indexOf("ow") + 2)),
    ).toEqual(
      expect.arrayContaining([expect.objectContaining({ label: "owner", kind: "property" })]),
    );

    const iconSource = "diagram { api: service { icon: ser } }";
    service.updateDocument(URI, iconSource, 4);
    expect(service.complete(URI, positionAt(iconSource, iconSource.indexOf("ser }") + 3))).toEqual(
      expect.arrayContaining([expect.objectContaining({ label: "builtin:server", kind: "icon" })]),
    );
  });

  it("provides hover, definition, references, rename, and symbols", () => {
    const service = new KDiagramLanguageService();
    service.updateDocument(URI, SOURCE, 1);
    const referenceOffset = SOURCE.indexOf("api ->");
    expect(service.hover(URI, positionAt(SOURCE, referenceOffset + 1))?.markdown).toContain(
      "KDiagram node",
    );
    expect(service.definition(URI, positionAt(SOURCE, referenceOffset + 1))?.range.start.line).toBe(
      2,
    );
    expect(service.references(URI, positionAt(SOURCE, referenceOffset + 1))).toHaveLength(2);
    expect(service.rename(URI, positionAt(SOURCE, referenceOffset + 1), "gateway")).toHaveLength(2);
    expect(service.documentSymbols(URI)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: "api", kind: "node" }),
        expect.objectContaining({ name: "important", kind: "style" }),
      ]),
    );
    expect(service.hover(URI, positionAt(SOURCE, SOURCE.indexOf("service") + 1))?.preview).toEqual({
      kind: "service",
      shape: "rounded",
    });
  });

  it("navigates and renames across open documents without changing labels or comments", () => {
    const service = new KDiagramLanguageService();
    const declaration = 'diagram { api: service "api label" // api comment\n}\n';
    const usage = "diagram { client: service\n client -> api\n}\n";
    service.updateDocument(URI, declaration, 1);
    service.updateDocument("file:///usage.kdiagram", usage, 1);
    const position = positionAt(usage, usage.lastIndexOf("api") + 1);
    expect(service.definition("file:///usage.kdiagram", position)?.uri).toBe(URI);
    const edits = service.renameWorkspace("file:///usage.kdiagram", position, "gateway");
    expect(edits.filter((item) => item.uri === URI)).toHaveLength(1);
    expect(edits).toHaveLength(2);
  });

  it("returns folding, semantic tokens, formatting, and migrations", () => {
    const service = new KDiagramLanguageService();
    const source = "diagram {\n x: service { density: roomy }   \n}\n";
    service.updateDocument(URI, source, 1);
    expect(service.foldingRanges(URI)).toEqual(
      expect.arrayContaining([{ startLine: 1, endLine: 3 }]),
    );
    expect(service.semanticTokens(URI)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: "keyword" }),
        expect.objectContaining({ type: "type" }),
      ]),
    );
    expect(service.format(URI)).not.toHaveLength(0);
    expect(service.codeActions(URI)).toEqual(
      expect.arrayContaining([expect.objectContaining({ kind: "source.migrate" })]),
    );
  });

  it("converts offsets and one-based positions", () => {
    const source = "one\ntwo";
    expect(positionAt(source, 5)).toEqual({ line: 2, column: 2, offset: 5 });
    expect(offsetAt(source, { line: 2, column: 2 })).toBe(5);
  });
});
