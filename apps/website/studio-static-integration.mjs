import { cp, readFile, stat, writeFile } from "node:fs/promises";
import { extname, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const studioBuild = new URL("../../packages/diagrams-studio/dist/browser/", import.meta.url);
const hostedIconMetadata = '<meta name="kdiagram-icon-api" content="https://api.iconify.design" />';

const contentTypes = new Map([
  [".css", "text/css; charset=utf-8"],
  [".html", "text/html; charset=utf-8"],
  [".js", "text/javascript; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".map", "application/json; charset=utf-8"],
  [".svg", "image/svg+xml"],
  [".ttf", "font/ttf"],
  [".wasm", "application/wasm"],
  [".woff", "font/woff"],
  [".woff2", "font/woff2"],
]);

function hostedStudioIndex(index) {
  const hosted = index.replace(
    '<meta name="kdiagram-icon-api" content="./__kdiagram/icons" />',
    hostedIconMetadata,
  );
  if (hosted === index) {
    throw new Error("Studio icon host metadata was not found in the production bundle");
  }
  return hosted;
}

/** Serve the same relative-base bundle during Astro development that production deploys. */
export function createStudioDevMiddleware(buildUrl = studioBuild) {
  const root = resolve(fileURLToPath(buildUrl));
  return async (request, response, next) => {
    const pathname = new URL(request.url ?? "/", "http://localhost").pathname;
    if (pathname === "/studio") {
      response.statusCode = 308;
      response.setHeader("Location", "/studio/");
      response.end();
      return;
    }
    if (!pathname.startsWith("/studio/")) {
      next();
      return;
    }

    let relativePath;
    try {
      relativePath = decodeURIComponent(pathname.slice("/studio/".length)) || "index.html";
    } catch {
      next();
      return;
    }
    const filePath = resolve(root, relativePath);
    if (filePath !== root && !filePath.startsWith(`${root}${sep}`)) {
      next();
      return;
    }

    try {
      if (!(await stat(filePath)).isFile()) {
        next();
        return;
      }
      const isIndex = relativePath === "index.html";
      const body = isIndex
        ? hostedStudioIndex(await readFile(filePath, "utf8"))
        : await readFile(filePath);
      response.statusCode = 200;
      response.setHeader(
        "Content-Type",
        contentTypes.get(extname(filePath)) ?? "application/octet-stream",
      );
      response.setHeader("Cache-Control", "no-cache");
      response.end(request.method === "HEAD" ? undefined : body);
    } catch (error) {
      if (error?.code === "ENOENT") {
        next();
        return;
      }
      next(error);
    }
  };
}

/** Copy the canonical relative-base Studio build into Astro's static output. */
export function studioStaticIntegration() {
  return {
    name: "kdiagram-static-studio",
    hooks: {
      "astro:server:setup": ({ server }) => {
        server.middlewares.use(createStudioDevMiddleware());
      },
      "astro:build:done": async ({ dir }) => {
        const destination = new URL("studio/", dir);
        await cp(studioBuild, destination, { recursive: true, force: true });

        const indexUrl = new URL("index.html", destination);
        await writeFile(indexUrl, hostedStudioIndex(await readFile(indexUrl, "utf8")), "utf8");
      },
    },
  };
}
