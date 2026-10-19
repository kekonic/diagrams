import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vite-plus/test";
import { renderPipeline } from "./pipeline/render.ts";

const source = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), "../../../examples/employee-schedules.kdiagram"),
  "utf8",
);

describe("employee schedule document model", () => {
  it("renders partition markers and reports the cross-partition team query", async () => {
    const result = await renderPipeline(source);
    expect(result.ok).toBe(true);
    expect(result.diagnostics.filter((item) => item.severity === "error")).toEqual([]);
    expect(result.diagnostics.map((item) => item.code)).toContain("DM206");
    expect(result.diagnostics.map((item) => item.code)).not.toContain("DM204");
    expect(result.diagnostics.map((item) => item.code)).not.toContain("DM205");
    expect(result.svg).toContain("employeeId");
    expect(result.svg).toContain("flow-doc-mark");
    expect(result.svg).toContain("flow-doc-required");
    expect(result.svg).toContain("flow-group-database");
    expect(result.svg).toContain("◆");
  });
});
