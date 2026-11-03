import assert from "node:assert/strict";
import test from "node:test";

import { mapVsCodeExtensionVersion } from "./map-vscode-extension-version.mjs";

test("keeps stable extension versions unchanged", () => {
  assert.deepEqual(mapVsCodeExtensionVersion("1.2.3"), {
    publish: true,
    version: "1.2.3",
    preRelease: false,
    reason: "stable release 1.2.3",
  });
});

test("maps 1.0.0 release candidates to 0.9 prereleases", () => {
  assert.deepEqual(mapVsCodeExtensionVersion("1.0.0-rc.13"), {
    publish: true,
    version: "0.9.13",
    preRelease: true,
    reason: "release candidate 1.0.0-rc.13",
  });
});

test("skips other prerelease patterns", () => {
  assert.deepEqual(mapVsCodeExtensionVersion("1.1.0-beta.2"), {
    publish: false,
    version: "1.1.0-beta.2",
    preRelease: false,
    reason: "unsupported prerelease pattern 1.1.0-beta.2",
  });
});

test("rejects malformed versions", () => {
  assert.throws(() => mapVsCodeExtensionVersion("latest"), /Invalid release version/);
});
