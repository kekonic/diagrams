import { describe, expect, it } from "vite-plus/test";
import {
  readStudioSourceSettings,
  resetStudioSourceSettings,
  updateStudioSourceSetting,
} from "./source-settings.ts";

const SOURCE = `diagram "Checkout" {
  direction LR
  layout {
    density: compact
    groupLayout: compound
  }
  edges {
    route: metro
    crossings: smart
  }
  render { theme: light }
  api: service "API"
}
`;

describe("Studio source settings", () => {
  it("reads authored settings", () => {
    expect(readStudioSourceSettings(SOURCE)).toEqual({
      theme: "light",
      direction: "LR",
      density: "compact",
      groupLayout: "compound",
      edgeStyle: "metro",
      crossings: "smart",
    });
  });

  it("updates blocks without discarding sibling properties", () => {
    const updated = updateStudioSourceSetting(SOURCE, "edgeStyle", "bezier");
    expect(updated).toContain("route: bezier");
    expect(updated).toContain("crossings: smart");
    expect(updated).toContain('api: service "API"');
  });

  it("preserves comments and hand formatting inside edited blocks", () => {
    const source = `diagram "Commented" {
  edges {
    // Keep this explanation
    route: metro // chosen for readability
    crossings: smart
  }
  api: service "API"
}
`;
    const updated = updateStudioSourceSetting(source, "edgeStyle", "straight");
    expect(updated).toContain("// Keep this explanation");
    expect(updated).toContain("route: straight // chosen for readability");
    expect(updated).toContain("crossings: smart");
  });

  it("inserts and removes settings while keeping valid source", () => {
    const initial = 'diagram "Small" {\n  a: service "A"\n}\n';
    const withDensity = updateStudioSourceSetting(initial, "density", "spacious");
    expect(readStudioSourceSettings(withDensity).density).toBe("spacious");
    expect(withDensity).toBe('diagram "Small" {\n  density spacious\n\n  a: service "A"\n}\n');
    expect(updateStudioSourceSetting(withDensity, "density", "")).toBe(initial);
  });

  it("inserts policy controls in canonical header order", () => {
    const initial = `diagram "Small" {
  render { theme: dark }

  a: service "A"
}
`;
    const withEdges = updateStudioSourceSetting(initial, "edgeStyle", "metro");
    const withDirection = updateStudioSourceSetting(withEdges, "direction", "LR");

    expect(withDirection).toBe(`diagram "Small" {
  direction LR
  edges {
    route: metro
  }
  render { theme: dark }

  a: service "A"
}
`);
  });

  it("authors the diagram theme and can update a compact render block", () => {
    const initial = 'diagram "Small" {\n  a: service "A"\n}\n';
    const light = updateStudioSourceSetting(initial, "theme", "light");
    expect(light).toContain("render {");
    expect(readStudioSourceSettings(light).theme).toBe("light");

    const dark = updateStudioSourceSetting(
      'diagram "Small" {\n  render { theme: light }\n  a: service "A"\n}\n',
      "theme",
      "dark",
    );
    expect(readStudioSourceSettings(dark).theme).toBe("dark");
    expect(dark).toContain("theme: dark");
  });

  it("updates other settings after formatting compacted their policy block", () => {
    const source = 'diagram "Small" {\n  edges { route: metro }\n  a: service "A"\n}\n';
    const updated = updateStudioSourceSetting(source, "crossings", "smart");
    expect(readStudioSourceSettings(updated)).toMatchObject({
      edgeStyle: "metro",
      crossings: "smart",
    });
  });

  it("removes density from a formatter-compacted layout block", () => {
    const source = 'diagram "Small" {\n  layout { density: compact }\n\n  a: service "A"\n}\n';
    const updated = updateStudioSourceSetting(source, "density", "");

    expect(readStudioSourceSettings(updated).density).toBe("");
    expect(updated).toBe('diagram "Small" {\n  a: service "A"\n}\n');
  });

  it("resets only Studio-owned authoring settings", () => {
    const reset = resetStudioSourceSettings(SOURCE);
    expect(reset).not.toContain("direction LR");
    expect(reset).not.toContain("groupLayout:");
    expect(reset).not.toContain("edges {");
    expect(reset).not.toContain("density:");
    expect(reset).not.toContain("render {");
    expect(reset).toContain('api: service "API"');
  });
});
