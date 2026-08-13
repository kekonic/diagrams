import { describe, expect, it } from "vite-plus/test";
import { createKDiagramModule, offsetKDiagramDiagnostic, renderKDiagramForBuild } from "./index.ts";

const source = 'diagram "System" { api: service "API" }';

describe("KDiagram build contracts", () => {
  it("renders portable accessible SVG", async () => {
    const result = await renderKDiagramForBuild(source, { renderOptions: { theme: "light" } });
    expect(result.svg).toContain('role="img"');
    expect(result.svg).toContain('data-node-id="api"');
    expect(result.svg).toContain("--kd-bg:");
  });

  it("generates framework modules without duplicating rendering logic", () => {
    expect(createKDiagramModule("react", source)).toContain(
      'import { KDiagramLive } from "@kekonic/diagrams-ui"',
    );
    expect(createKDiagramModule("element", source)).toContain(
      'import { KDiagramElement } from "@kekonic/diagrams-element"',
    );
  });

  it("offsets diagnostics into a host document", () => {
    const mapped = offsetKDiagramDiagnostic(
      {
        severity: "error",
        code: "FM000",
        message: "bad",
        range: {
          start: { line: 2, column: 1, offset: 1 },
          end: { line: 3, column: 1, offset: 2 },
        },
      },
      10,
    );
    expect([mapped.hostLine, mapped.hostEndLine]).toEqual([11, 12]);
  });
});
