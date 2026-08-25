import { describe, expect, it } from "vite-plus/test";
import { getKindDefaults, kindSubtitle } from "./kinds.ts";

describe("C4 architecture kinds", () => {
  it("labels elements with C4 type names", () => {
    expect(kindSubtitle("person")).toBe("Person");
    expect(kindSubtitle("user")).toBe("Person");
    expect(kindSubtitle("system")).toBe("Software System");
    expect(kindSubtitle("external")).toBe("External System");
    expect(kindSubtitle("container")).toBe("Container");
    expect(kindSubtitle("component")).toBe("Component");
  });

  it("keeps a readable size ladder from system to component", () => {
    const system = getKindDefaults("system").defaults;
    const container = getKindDefaults("container").defaults;
    const component = getKindDefaults("component").defaults;
    expect(system.defaultMinWidth).toBeGreaterThan(container.defaultMinWidth);
    expect(container.defaultMinWidth).toBeGreaterThan(component.defaultMinWidth);
  });

  it("does not plant a user glyph inside the person silhouette", () => {
    expect(getKindDefaults("person").defaults.icon).toBeUndefined();
    expect(getKindDefaults("user").defaults.icon).toBeUndefined();
    expect(getKindDefaults("person").defaults.shape).toBe("person");
    expect(getKindDefaults("external").defaults.shape).toBe("rounded");
  });
});
