import { createHash } from "node:crypto";
import {
  npmTarballUrl,
  renderHomebrewFormula,
} from "../distribution/homebrew/diagrams-formula.mjs";

const TAP_REPOSITORY = "kekonic/homebrew-tap";
const FORMULA_PATH = "Formula/diagrams.rb";
const CLI_PACKAGE = "@kekonic/diagrams-cli";

function parsePublishedPackages(raw) {
  const text = typeof raw === "string" ? raw.trim() : "";
  if (!text) return [];
  try {
    const parsed = JSON.parse(text);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    throw new Error(`PUBLISHED_PACKAGES must be a JSON array, received: ${JSON.stringify(raw)}`);
  }
}

const publishedPackages = parsePublishedPackages(process.env.PUBLISHED_PACKAGES);
const cli = publishedPackages.find((entry) => entry.name === CLI_PACKAGE);
const releaseVersion = process.env.RELEASE_VERSION || cli?.version;

if (!releaseVersion) {
  console.log(`No release version was provided; skipping Homebrew formula`);
  process.exit(0);
}

if (releaseVersion.includes("-")) {
  console.log(`Kekonic Diagrams ${releaseVersion} is a prerelease; skipping Homebrew formula`);
  process.exit(0);
}

const token = process.env.HOMEBREW_TAP_TOKEN;
if (!token) {
  throw new Error("HOMEBREW_TAP_TOKEN is required to publish a stable Homebrew formula");
}

const tarballUrl = npmTarballUrl(releaseVersion);
const tarballResponse = await fetch(tarballUrl);
if (!tarballResponse.ok) {
  throw new Error(`Could not download published npm tarball: ${tarballResponse.status}`);
}
const tarball = Buffer.from(await tarballResponse.arrayBuffer());
const sha256 = createHash("sha256").update(tarball).digest("hex");
const formula = renderHomebrewFormula({ version: releaseVersion, sha256 });

const apiUrl = `https://api.github.com/repos/${TAP_REPOSITORY}/contents/${FORMULA_PATH}`;
const headers = {
  Accept: "application/vnd.github+json",
  Authorization: `Bearer ${token}`,
  "X-GitHub-Api-Version": "2022-11-28",
  "User-Agent": "kdiagram-release",
};

const existingResponse = await fetch(apiUrl, { headers });
let existingSha;
if (existingResponse.ok) {
  existingSha = (await existingResponse.json()).sha;
} else if (existingResponse.status !== 404) {
  throw new Error(`Could not inspect the Homebrew tap formula: ${existingResponse.status}`);
}

const body = {
  message: `chore(diagrams): update formula to ${releaseVersion}`,
  content: Buffer.from(formula).toString("base64"),
  ...(existingSha ? { sha: existingSha } : {}),
};
const updateResponse = await fetch(apiUrl, {
  method: "PUT",
  headers: { ...headers, "Content-Type": "application/json" },
  body: JSON.stringify(body),
});
if (!updateResponse.ok) {
  const detail = await updateResponse.text();
  throw new Error(`Could not publish the Homebrew formula: ${updateResponse.status} ${detail}`);
}

console.log(`Published ${TAP_REPOSITORY}/${FORMULA_PATH} for Kekonic Diagrams ${releaseVersion}`);
