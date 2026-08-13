import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import {
  createReadStream,
  existsSync,
  readFileSync,
  statSync,
  watch,
  writeFileSync,
} from "node:fs";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { basename, dirname, extname, relative, resolve, sep } from "node:path";
import { createRequire } from "node:module";
import { renderPipeline } from "@kekonic/diagrams";
import { loadIconSubset } from "@kekonic/diagrams-icons";
import {
  STUDIO_PROTOCOL_VERSION,
  createStudioPreviewCoordinator,
  parseStudioClientMessage,
  studioMessageJson,
  type StudioDocument,
  type StudioPresentation,
  type StudioRender,
  type StudioServerMessage,
} from "@kekonic/diagrams-studio";

const require = createRequire(import.meta.url);
const ICON_NAME = /^[a-z0-9][a-z0-9-]*$/;
const MAX_ICONS_PER_REQUEST = 64;

export type StudioServer = {
  url: string;
  port: number;
  token: string;
  closed: Promise<void>;
  close(): Promise<void>;
};

export type StartStudioServerOptions = {
  files: string[];
  allowWrite?: boolean;
  port?: number;
  browserRoot?: string;
};

export async function startStudioServer(options: StartStudioServerOptions): Promise<StudioServer> {
  const files = [...new Set(options.files.map((file) => resolve(file)))].sort();
  if (files.length === 0) throw new Error("Studio requires at least one .kdiagram file");
  for (const file of files) {
    if (!existsSync(file) || !statSync(file).isFile())
      throw new Error(`Studio input is not a file: ${file}`);
  }
  const roots = minimalRoots(files.map(dirname));
  const documents = new Map<string, StudioDocument>();
  for (const file of files) {
    const id = relative(commonRoot(files), file).split(sep).join("/") || basename(file);
    documents.set(id, {
      id,
      path: file,
      label: id,
      revision: 0,
      source: readFileSync(file, "utf8"),
    });
  }
  let activeDocumentId = documents.keys().next().value as string;
  let presentation: StudioPresentation = { theme: "dark", options: { theme: "dark" } };
  const token = randomBytes(32).toString("base64url");
  const sessionId = randomBytes(16).toString("hex");
  const browserRoot = resolve(
    options.browserRoot ?? dirname(require.resolve("@kekonic/diagrams-studio/browser")),
  );
  const clients = new Set<ServerResponse>();
  const renders = new Map<string, StudioRender>();
  const coordinator = createStudioPreviewCoordinator((source, renderOptions) =>
    renderPipeline(source, { ...renderOptions, snapshotTheme: true, shadows: false }),
  );

  const broadcast = (message: StudioServerMessage): void => {
    const line = `data: ${studioMessageJson(message)}\n\n`;
    for (const client of clients) client.write(line);
  };
  const renderDocument = async (document: StudioDocument): Promise<void> => {
    const result = await coordinator.render(
      document.id,
      document.revision,
      document.source,
      presentation.options,
    );
    if (result) {
      renders.set(document.id, result);
      broadcast({ version: STUDIO_PROTOCOL_VERSION, type: "render", ...result });
    }
  };

  const server = createServer(async (request, response) => {
    try {
      const url = new URL(request.url ?? "/", "http://127.0.0.1");
      const cookieToken = request.headers.cookie
        ?.split(";")
        .map((item) => item.trim())
        .find((item) => item.startsWith("kdiagram_studio="))
        ?.slice("kdiagram_studio=".length);
      if (url.searchParams.get("token") !== token && cookieToken !== token) {
        return respond(response, 403, "Forbidden");
      }
      if (request.method === "GET" && url.pathname === "/events") {
        response.writeHead(200, {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache, no-transform",
          Connection: "keep-alive",
          "X-Content-Type-Options": "nosniff",
        });
        clients.add(response);
        response.write(
          `data: ${studioMessageJson({
            version: 1,
            type: "ready",
            sessionId,
            documents: [...documents.values()],
            activeDocumentId,
            capabilities: { write: options.allowWrite === true, export: true },
            presentation,
          })}\n\n`,
        );
        request.on("close", () => clients.delete(response));
        void renderDocument(documents.get(activeDocumentId)!);
        return;
      }
      if (request.method === "POST" && url.pathname === "/message") {
        const message = parseStudioClientMessage(JSON.parse(await readBody(request)));
        const document = "documentId" in message ? documents.get(message.documentId) : undefined;
        if ("documentId" in message && !document) return respond(response, 404, "Unknown document");
        switch (message.type) {
          case "open":
            activeDocumentId = message.documentId;
            broadcast({ version: 1, type: "document", reason: "open", ...document! });
            void renderDocument(document!);
            break;
          case "source":
            if (message.revision <= document!.revision)
              return respond(response, 409, "Stale revision");
            document!.revision = message.revision;
            document!.source = message.source;
            void renderDocument(document!);
            break;
          case "save":
            if (!options.allowWrite)
              return respond(response, 403, "Studio writes are not authorized");
            assertWithinRoots(document!.path, roots);
            if (message.revision < document!.revision)
              return respond(response, 409, "Stale revision");
            writeFileSync(
              document!.path,
              message.source.endsWith("\n") ? message.source : `${message.source}\n`,
              "utf8",
            );
            document!.source = readFileSync(document!.path, "utf8");
            document!.revision = message.revision;
            broadcast({
              version: 1,
              type: "saved",
              documentId: document!.id,
              revision: document!.revision,
            });
            break;
          case "selection":
            if (message.selection.graphElement && !message.selection.range) {
              const graph = renders.get(message.selection.documentId)?.graph;
              const collection =
                message.selection.graphElement.type === "node" ? graph?.nodes : graph?.edges;
              const element = collection?.find(
                (item) => item.id === message.selection.graphElement?.id,
              );
              if (element?.sourceRange) message.selection.range = element.sourceRange;
            }
            broadcast({ version: 1, type: "selection", selection: message.selection });
            break;
          case "viewport":
            broadcast({ version: 1, type: "viewport", viewport: message.viewport });
            break;
          case "presentation":
            presentation = message.presentation;
            broadcast({ version: 1, type: "presentation", presentation });
            void renderDocument(documents.get(activeDocumentId)!);
            break;
        }
        return respond(response, 204, "");
      }
      if (request.method === "GET" && url.pathname.startsWith("/__kdiagram/icons/")) {
        return serveIconSubset(url, response);
      }
      if (request.method !== "GET") return respond(response, 405, "Method not allowed");
      const requestedPath =
        url.pathname === "/" ? "index.html" : decodeURIComponent(url.pathname.slice(1));
      const assetPath = resolve(browserRoot, requestedPath);
      assertWithinRoots(assetPath, [browserRoot]);
      if (!existsSync(assetPath) || !statSync(assetPath).isFile())
        return respond(response, 404, "Not found");
      response.writeHead(200, {
        "Content-Type": contentType(assetPath),
        "Cache-Control":
          requestedPath === "index.html" ? "no-store" : "public, max-age=31536000, immutable",
        "Content-Security-Policy":
          "default-src 'self'; script-src 'self' 'wasm-unsafe-eval'; style-src 'self' 'unsafe-inline'; font-src 'self'; img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'",
        "X-Content-Type-Options": "nosniff",
        "Referrer-Policy": "no-referrer",
        ...(requestedPath === "index.html"
          ? { "Set-Cookie": `kdiagram_studio=${token}; HttpOnly; SameSite=Strict; Path=/` }
          : {}),
      });
      createReadStream(assetPath).pipe(response);
    } catch (error) {
      respond(response, 400, error instanceof Error ? error.message : String(error));
    }
  });

  const watchers = files.map((file) =>
    watch(file, { persistent: false }, () => {
      const document = [...documents.values()].find((item) => item.path === file);
      if (!document) return;
      const source = readFileSync(file, "utf8");
      if (source === document.source) return;
      document.source = source;
      document.revision += 1;
      broadcast({ version: 1, type: "document", reason: "external", ...document });
      void renderDocument(document);
    }),
  );
  const heartbeat = setInterval(() => {
    for (const client of clients) client.write(": heartbeat\n\n");
  }, 15_000);
  heartbeat.unref();

  await new Promise<void>((resolveListen, reject) => {
    server.once("error", reject);
    server.listen(options.port ?? 0, "127.0.0.1", resolveListen);
  });
  const address = server.address();
  if (!address || typeof address === "string")
    throw new Error("Studio server did not bind a TCP port");
  let resolveClosed!: () => void;
  const closed = new Promise<void>((resolvePromise) => (resolveClosed = resolvePromise));
  server.once("close", resolveClosed);
  const close = async (): Promise<void> => {
    clearInterval(heartbeat);
    for (const watcher of watchers) watcher.close();
    for (const client of clients) client.end();
    await new Promise<void>((resolveClose, reject) =>
      server.close((error) => (error ? reject(error) : resolveClose())),
    );
  };
  return {
    url: `http://127.0.0.1:${address.port}/?token=${encodeURIComponent(token)}`,
    port: address.port,
    token,
    closed,
    close,
  };
}

export async function openStudioBrowser(url: string): Promise<void> {
  const command =
    process.platform === "darwin"
      ? { executable: "open", args: [url] }
      : process.platform === "win32"
        ? { executable: "cmd", args: ["/c", "start", "", url] }
        : { executable: "xdg-open", args: [url] };
  const child = spawn(command.executable, command.args, { detached: true, stdio: "ignore" });
  child.unref();
  await new Promise<void>((resolveSpawn, reject) => {
    child.once("spawn", resolveSpawn);
    child.once("error", reject);
  });
}

function respond(response: ServerResponse, status: number, body: string): void {
  response.writeHead(status, {
    "Content-Type": "text/plain; charset=utf-8",
    "X-Content-Type-Options": "nosniff",
  });
  response.end(body);
}

async function serveIconSubset(url: URL, response: ServerResponse): Promise<void> {
  const match = /^\/__kdiagram\/icons\/([a-z0-9-]+)\.json$/.exec(url.pathname);
  const names = parseIconNames(url.searchParams.get("icons"));
  if (!match || !names) return respondJson(response, 400, { error: "Invalid icon request" });
  const subset = await loadIconSubset(match[1]!, names);
  if (!subset) return respondJson(response, 404, { error: "Unknown icon collection" });
  return respondJson(response, 200, subset);
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

function respondJson(response: ServerResponse, status: number, body: unknown): void {
  response.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "public, max-age=86400",
    "X-Content-Type-Options": "nosniff",
  });
  response.end(JSON.stringify(body));
}

async function readBody(request: IncomingMessage): Promise<string> {
  const chunks: Buffer[] = [];
  let bytes = 0;
  for await (const chunk of request) {
    const buffer = Buffer.from(chunk);
    bytes += buffer.byteLength;
    if (bytes > 2_000_000) throw new Error("Studio message exceeds 2 MB");
    chunks.push(buffer);
  }
  return Buffer.concat(chunks).toString("utf8");
}

function assertWithinRoots(path: string, roots: string[]): void {
  const absolute = resolve(path);
  if (!roots.some((root) => absolute === root || absolute.startsWith(`${resolve(root)}${sep}`))) {
    throw new Error("Path is outside the studio session roots");
  }
}

function minimalRoots(directories: string[]): string[] {
  const sorted = [...new Set(directories.map((directory) => resolve(directory)))].sort();
  return sorted.filter(
    (directory, index) =>
      !sorted.some(
        (other, otherIndex) => otherIndex !== index && directory.startsWith(`${other}${sep}`),
      ),
  );
}

function commonRoot(files: string[]): string {
  let root = dirname(files[0]!);
  while (!files.every((file) => file === root || file.startsWith(`${root}${sep}`)))
    root = dirname(root);
  return root;
}

function contentType(path: string): string {
  switch (extname(path)) {
    case ".html":
      return "text/html; charset=utf-8";
    case ".js":
      return "text/javascript; charset=utf-8";
    case ".css":
      return "text/css; charset=utf-8";
    case ".ttf":
      return "font/ttf";
    case ".map":
      return "application/json";
    default:
      return "application/octet-stream";
  }
}
