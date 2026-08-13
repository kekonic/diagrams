import type { Plugin } from "vite";
import { loadIconSubset } from "@kekonic/diagrams-icons";
import { existsSync } from "node:fs";
import { writeFile } from "node:fs/promises";
import { resolve, sep } from "node:path";

const EXAMPLE_ID = /^[a-z0-9][a-z0-9-]*$/i;
const ICON_NAME = /^[a-z0-9][a-z0-9-]*$/;
const MAX_ICONS_PER_REQUEST = 64;

type SaveBody = {
  id?: unknown;
  source?: unknown;
};

/** Dev-only same-origin icon endpoint matching the Iconify per-collection API shape. */
export function iconSubsetPlugin(): Plugin {
  return {
    name: "kdiagram-local-icons",
    apply: "serve",
    configureServer(server) {
      server.middlewares.use("/__kdiagram/icons", (req, res, next) => {
        if (req.method !== "GET" || !req.url) return next();
        const requestUrl = req.url;
        void (async () => {
          try {
            const url = new URL(requestUrl, "http://127.0.0.1");
            const match = /^\/([a-z0-9-]+)\.json$/.exec(url.pathname);
            const names = parseIconNames(url.searchParams.get("icons"));
            if (!match || !names) return respondJson(res, 400, { error: "Invalid icon request" });
            const subset = await loadIconSubset(match[1]!, names);
            if (!subset) return respondJson(res, 404, { error: "Unknown icon collection" });
            return respondJson(res, 200, subset);
          } catch (error) {
            return respondJson(res, 500, {
              error: error instanceof Error ? error.message : "Icon load failed",
            });
          }
        })();
      });
    },
  };
}

/**
 * Dev-only: POST /__kdiagram/save-example { id, source }
 * Overwrites an existing examples/<id>.kdiagram under the monorepo root.
 */
export function saveExamplePlugin(monorepoRoot: string): Plugin {
  const examplesDir = resolve(monorepoRoot, "examples");

  return {
    name: "kdiagram-save-example",
    apply: "serve",
    configureServer(server) {
      server.middlewares.use("/__kdiagram/save-example", (req, res, next) => {
        if (req.method !== "POST") {
          res.statusCode = 405;
          res.end("Method Not Allowed");
          return;
        }

        let raw = "";
        req.setEncoding("utf8");
        req.on("data", (chunk: string) => {
          raw += chunk;
        });
        req.on("end", () => {
          void (async () => {
            try {
              const body = JSON.parse(raw) as SaveBody;
              const id = typeof body.id === "string" ? body.id.trim() : "";
              const source = typeof body.source === "string" ? body.source : null;

              if (!EXAMPLE_ID.test(id) || source == null) {
                res.statusCode = 400;
                res.setHeader("Content-Type", "application/json");
                res.end(JSON.stringify({ ok: false, error: "Invalid id or source" }));
                return;
              }

              const filePath = resolve(examplesDir, `${id}.kdiagram`);
              const rootWithSep = examplesDir.endsWith(sep) ? examplesDir : examplesDir + sep;
              if (!filePath.startsWith(rootWithSep) && filePath !== examplesDir) {
                res.statusCode = 400;
                res.setHeader("Content-Type", "application/json");
                res.end(JSON.stringify({ ok: false, error: "Path rejected" }));
                return;
              }

              if (!existsSync(filePath)) {
                res.statusCode = 404;
                res.setHeader("Content-Type", "application/json");
                res.end(JSON.stringify({ ok: false, error: "Example not found" }));
                return;
              }

              const normalized = source.endsWith("\n") ? source : `${source}\n`;
              await writeFile(filePath, normalized, "utf8");

              res.statusCode = 200;
              res.setHeader("Content-Type", "application/json");
              res.end(JSON.stringify({ ok: true, id, path: `examples/${id}.kdiagram` }));
            } catch (err) {
              res.statusCode = 500;
              res.setHeader("Content-Type", "application/json");
              res.end(
                JSON.stringify({
                  ok: false,
                  error: err instanceof Error ? err.message : "Save failed",
                }),
              );
            }
          })();
        });
        req.on("error", () => next());
      });
    },
  };
}

function parseIconNames(value: string | null): string[] | null {
  if (!value) return null;
  const names = [...new Set(value.split(","))];
  if (
    names.length === 0 ||
    names.length > MAX_ICONS_PER_REQUEST ||
    names.some((name) => !ICON_NAME.test(name))
  ) {
    return null;
  }
  return names;
}

function respondJson(
  response: {
    statusCode: number;
    setHeader(name: string, value: string): void;
    end(body: string): void;
  },
  status: number,
  body: unknown,
): void {
  response.statusCode = status;
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  response.setHeader("Cache-Control", "public, max-age=86400");
  response.setHeader("X-Content-Type-Options", "nosniff");
  response.end(JSON.stringify(body));
}
