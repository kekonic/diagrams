import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vite-plus/test";
import { KDiagram } from "./index.ts";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../../..");

const CASES = [
  "order-review-slide.kdiagram",
  "refund-request.kdiagram",
  "order-fulfillment.kdiagram",
  "order-fulfillment-sequence.kdiagram",
  "order-hexagon.kdiagram",
] as const;

describe("showcase SVG visual regression", () => {
  for (const file of CASES) {
    it(`keeps ${file} stable`, async () => {
      const source = readFileSync(join(ROOT, "examples", file), "utf8");
      const result = await KDiagram.renderToSvg(source, {
        theme: "light",
        snapshotTheme: true,
      });

      expect(result.ok).toBe(true);
      expect(result.diagnostics.filter((item) => item.severity === "error")).toEqual([]);
      expect(result.svg).toMatchSnapshot();
    });
  }
});
