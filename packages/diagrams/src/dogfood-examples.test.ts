import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vite-plus/test";
import type { Point, Rect } from "@kekonic/diagrams-core";
import { renderPipeline } from "./pipeline/render.ts";
import { rectsOverlap } from "@kekonic/diagrams-core";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../../..");
const EXAMPLES = join(ROOT, "examples");
const WEBSITE_EXAMPLES = join(ROOT, "apps/website/src/data/examples.ts");
const CATALOG = join(EXAMPLES, "catalog.json");

type Catalog = {
  defaultExampleId: string;
  examples: Array<{
    id: string;
    sourceFile: string;
    sourceExport: string;
    hero?: boolean;
    atlas?: boolean;
  }>;
};

const catalog = JSON.parse(readFileSync(CATALOG, "utf8")) as Catalog;

/** Hero / showcase diagrams that must keep rendering cleanly. */
const HERO_FILES = catalog.examples.filter((entry) => entry.hero).map((entry) => entry.sourceFile);

/** File ↔ `export const` name in apps/website/src/data/examples.ts */
const MIRROR_PAIRS = catalog.examples.map((entry) => ({
  file: entry.sourceFile,
  exportName: entry.sourceExport,
}));

const EPS = 0.5;

/** Orthogonal segment vs open AABB interior (same idea as layout segmentHitsRect). */
function segmentHitsRect(a: Point, b: Point, box: Rect): boolean {
  const minX = Math.min(a.x, b.x);
  const maxX = Math.max(a.x, b.x);
  const minY = Math.min(a.y, b.y);
  const maxY = Math.max(a.y, b.y);
  const L = box.x;
  const R = box.x + box.width;
  const T = box.y;
  const B = box.y + box.height;

  if (Math.abs(a.x - b.x) < EPS) {
    const x = a.x;
    if (x <= L + EPS || x >= R - EPS) return false;
    return maxY > T + EPS && minY < B - EPS;
  }
  if (Math.abs(a.y - b.y) < EPS) {
    const y = a.y;
    if (y <= T + EPS || y >= B - EPS) return false;
    return maxX > L + EPS && minX < R - EPS;
  }
  return false;
}

describe("dogfood examples — render gates", () => {
  for (const file of HERO_FILES) {
    it(`renders ${file} without errors or node punches`, async () => {
      const source = readFileSync(join(EXAMPLES, file), "utf8");
      const result = await renderPipeline(source, {
        sourcePath: join(EXAMPLES, file),
        readFile: (path) => readFileSync(path, "utf8"),
      });

      expect(result.ok, `${file} ok`).toBe(true);
      expect(
        result.diagnostics.filter((d) => d.severity === "error"),
        `${file} errors`,
      ).toHaveLength(0);
      expect(result.layout, `${file} layout`).toBeTruthy();
      expect(result.graph, `${file} graph`).toBeTruthy();
      expect(result.routing, `${file} routing`).toBeTruthy();

      const nodeById = new Map(result.layout!.nodes.map((n) => [n.nodeId, n.bounds]));
      const punches: string[] = [];

      for (const edge of result.graph!.edges) {
        const routed = result.routing!.edges.find((e) => e.edgeId === edge.id);
        if (!routed) continue;
        for (const seg of routed.segments) {
          for (const [nodeId, bounds] of nodeById) {
            if (nodeId === edge.from || nodeId === edge.to) continue;
            if (segmentHitsRect(seg.from, seg.to, bounds)) {
              punches.push(`${edge.id} through ${nodeId}`);
            }
          }
        }
      }

      expect(punches, `${file} edge-through-node punches`).toEqual([]);

      const labeledEdges = result.graph!.edges.filter((e) => e.label && e.label.trim().length > 0);
      if (labeledEdges.length > 0 && result.graph!.diagramKind !== "sequence") {
        const placed = result.labels ?? [];
        // Labels may be omitted for pure cardinality; require at least some placements when labels exist.
        expect(placed.length).toBeGreaterThan(0);

        for (const label of placed) {
          for (const node of result.layout!.nodes) {
            const edge = result.graph!.edges.find((e) => e.id === label.edgeId);
            if (!edge) continue;
            if (node.nodeId === edge.from || node.nodeId === edge.to) continue;
            // Soft: allow tiny overlap near stubs; fail on substantial card coverage.
            if (rectsOverlap(label.bounds, node.bounds, -2)) {
              const overlapW =
                Math.min(label.bounds.x + label.bounds.width, node.bounds.x + node.bounds.width) -
                Math.max(label.bounds.x, node.bounds.x);
              const overlapH =
                Math.min(label.bounds.y + label.bounds.height, node.bounds.y + node.bounds.height) -
                Math.max(label.bounds.y, node.bounds.y);
              if (overlapW > 8 && overlapH > 8) {
                expect.fail(
                  `${file}: label "${label.text}" on ${label.edgeId} overlaps node ${node.nodeId}`,
                );
              }
            }
          }
        }
      }
    });
  }
});

describe("dogfood examples — website single-source", () => {
  it("wires mirrored exports through loadExample(<id>)", () => {
    const website = readFileSync(WEBSITE_EXAMPLES, "utf8");
    expect(website).toContain("function loadExample(id: string)");
    expect(website).toContain('import.meta.glob<string>("../../../../examples/*.kdiagram"');

    const missing: string[] = [];
    for (const { file, exportName } of MIRROR_PAIRS) {
      const id = file.replace(/\.kdiagram$/, "");
      const re = new RegExp(`export const ${exportName}\\s*=\\s*loadExample\\("${id}"\\)`);
      if (!re.test(website)) missing.push(`${exportName} → ${id}`);
    }
    expect(missing).toEqual([]);
  });

  it("lists every catalogued .kdiagram file under examples/", () => {
    const files = readdirSync(EXAMPLES).filter((f) => f.endsWith(".kdiagram"));
    const catalogued = catalog.examples.map((entry) => entry.sourceFile).sort();
    expect(files.sort()).toEqual(catalogued);
    expect(files).not.toContain("language-showcase.kdiagram");
    expect(catalog.defaultExampleId).toBe("order-fulfillment");
  });
});
