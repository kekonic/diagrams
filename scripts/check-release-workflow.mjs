import { readFileSync } from "node:fs";

const workflow = readFileSync(new URL("../.github/workflows/release.yml", import.meta.url), "utf8");
const packageJson = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));

const required = [
  "workflow_dispatch:",
  "Resolve release delivery version",
  "steps.delivery.outputs.version != ''",
  "Verify resumed npm release",
  "Recovered ${artifact} from the existing GitHub release",
  "Deprecate retired npm packages",
  "RELEASE_VERSION: ${{ steps.delivery.outputs.version }}",
  "Open VSX / VS Marketplace publishing intentionally deferred",
];

for (const contract of required) {
  if (!workflow.includes(contract)) throw new Error(`Release workflow is missing: ${contract}`);
}

if (workflow.includes("ovsx") || workflow.includes("vsce publish")) {
  throw new Error(
    "Open VSX / VS Marketplace publishing must stay disabled until the extension is ready",
  );
}

if (workflow.includes("$extra") || workflow.includes('extra="--pre-release"')) {
  throw new Error("Prepackaged VSIX publication must not pass --pre-release");
}

if (packageJson.scripts.release.includes("deprecate-retired-packages")) {
  throw new Error("Retired-package cleanup must not be part of atomic npm publication");
}

console.log("Release recovery contract is valid");
