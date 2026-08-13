import { describe, expect, it } from "vite-plus/test";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { startStudioServer } from "./studio-server.ts";

describe("local studio server", () => {
  it("binds loopback, requires its session token, and gates writes", async () => {
    const root = mkdtempSync(join(tmpdir(), "kdiagram-studio-server-"));
    const sourcePath = join(root, "architecture.kdiagram");
    const browserRoot = join(root, "browser");
    mkdirSync(browserRoot);
    writeFileSync(sourcePath, 'diagram {\n  api: service "API"\n}\n');
    writeFileSync(join(browserRoot, "index.html"), "<!doctype html><title>Studio</title>");
    const studio = await startStudioServer({ files: [sourcePath], browserRoot });

    try {
      expect(studio.url).toMatch(new RegExp(`^http://127\\.0\\.0\\.1:${studio.port}/`));
      const forbidden = await fetch(`http://127.0.0.1:${studio.port}/`);
      expect(forbidden.status).toBe(403);

      const page = await fetch(studio.url);
      expect(page.status).toBe(200);
      expect(page.headers.get("set-cookie")).toContain("kdiagram_studio=");
      expect(page.headers.get("content-security-policy")).toContain(
        "script-src 'self' 'wasm-unsafe-eval'",
      );
      expect(await page.text()).toContain("Studio");

      const iconResponse = await fetch(
        `http://127.0.0.1:${studio.port}/__kdiagram/icons/lucide.json?icons=shopping-cart&token=${encodeURIComponent(studio.token)}`,
      );
      expect(iconResponse.status).toBe(200);
      const iconSet = (await iconResponse.json()) as {
        prefix: string;
        icons: Record<string, { body: string }>;
      };
      expect(iconSet.prefix).toBe("lucide");
      expect(iconSet.icons["shopping-cart"]?.body).toContain("path");

      const remoteCollection = await fetch(
        `http://127.0.0.1:${studio.port}/__kdiagram/icons/private.json?icons=secret&token=${encodeURIComponent(studio.token)}`,
      );
      expect(remoteCollection.status).toBe(404);

      const save = await fetch(
        `http://127.0.0.1:${studio.port}/message?token=${encodeURIComponent(studio.token)}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            version: 1,
            type: "save",
            documentId: "architecture.kdiagram",
            revision: 1,
            source: "diagram {}",
          }),
        },
      );
      expect(save.status).toBe(403);
    } finally {
      await studio.close();
    }
  });
});
