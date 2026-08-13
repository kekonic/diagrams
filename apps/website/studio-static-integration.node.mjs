import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { createStudioDevMiddleware } from "./studio-static-integration.mjs";

let directory;
let middleware;

before(async () => {
  directory = await mkdtemp(join(tmpdir(), "kdiagram-studio-static-"));
  await mkdir(join(directory, "assets"));
  await writeFile(
    join(directory, "index.html"),
    '<meta name="kdiagram-icon-api" content="./__kdiagram/icons" /><main>Studio</main>',
  );
  await writeFile(join(directory, "assets", "studio.js"), "export const studio = true;");
  middleware = createStudioDevMiddleware(pathToFileURL(`${directory}/`));
});

after(async () => {
  await rm(directory, { recursive: true, force: true });
});

void test("serves the hosted Studio shell and its relative assets", async () => {
  const shell = await request("/studio/?source=diagram");
  assert.equal(shell.statusCode, 200);
  assert.equal(shell.headers.get("content-type"), "text/html; charset=utf-8");
  assert.match(String(shell.body), /content="https:\/\/api\.iconify\.design"/);

  const asset = await request("/studio/assets/studio.js");
  assert.equal(asset.statusCode, 200);
  assert.equal(asset.headers.get("content-type"), "text/javascript; charset=utf-8");
  assert.equal(String(asset.body), "export const studio = true;");
});

void test("redirects the unqualified Studio path and ignores unrelated requests", async () => {
  const redirect = await request("/studio");
  assert.equal(redirect.statusCode, 308);
  assert.equal(redirect.headers.get("location"), "/studio/");

  assert.equal((await request("/reference/cli/")).next, true);
  assert.equal((await request("/studio/%2Fetc/passwd")).next, true);
});

function request(url) {
  return new Promise((resolve, reject) => {
    const headers = new Map();
    const response = {
      statusCode: 0,
      setHeader(name, value) {
        headers.set(name.toLowerCase(), value);
      },
      end(body) {
        resolve({ statusCode: this.statusCode, headers, body, next: false });
      },
    };
    void middleware({ url, method: "GET" }, response, (error) => {
      if (error) reject(error);
      else resolve({ statusCode: response.statusCode, headers, next: true });
    });
  });
}
