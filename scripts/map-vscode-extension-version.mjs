import { appendFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

export function mapVsCodeExtensionVersion(releaseVersion) {
  if (/^\d+\.\d+\.\d+$/.test(releaseVersion)) {
    return {
      publish: true,
      version: releaseVersion,
      preRelease: false,
      reason: `stable release ${releaseVersion}`,
    };
  }

  const releaseCandidate = /^1\.0\.0-rc\.(0|[1-9]\d*)$/.exec(releaseVersion);
  if (releaseCandidate) {
    return {
      publish: true,
      version: `0.9.${releaseCandidate[1]}`,
      preRelease: true,
      reason: `release candidate ${releaseVersion}`,
    };
  }

  if (/^\d+\.\d+\.\d+-[0-9A-Za-z.-]+$/.test(releaseVersion)) {
    return {
      publish: false,
      version: releaseVersion,
      preRelease: false,
      reason: `unsupported prerelease pattern ${releaseVersion}`,
    };
  }

  throw new Error(`Invalid release version: ${releaseVersion}`);
}

function run() {
  const releaseVersion = process.argv[2]?.trim();
  if (!releaseVersion) {
    throw new Error("Usage: node scripts/map-vscode-extension-version.mjs <release-version>");
  }

  const mapped = mapVsCodeExtensionVersion(releaseVersion);
  const message = mapped.publish
    ? `VS Code extension ${releaseVersion} maps to ${mapped.version}${mapped.preRelease ? " (pre-release)" : ""}`
    : `Skipping extension marketplace publication: ${mapped.reason}`;
  console.log(message);

  if (process.env.GITHUB_OUTPUT) {
    appendFileSync(
      process.env.GITHUB_OUTPUT,
      [
        `publish=${mapped.publish}`,
        `version=${mapped.version}`,
        `pre_release=${mapped.preRelease}`,
        `reason=${mapped.reason}`,
        "",
      ].join("\n"),
    );
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) run();
