import { readFileSync } from "node:fs";

const workflow = readFileSync(new URL("../.github/workflows/release.yml", import.meta.url), "utf8");

const required = [
  "workflow_dispatch:",
  "Resolve release delivery version",
  "steps.delivery.outputs.version != ''",
  "Verify resumed npm release",
  "Recovered ${artifact} from the existing GitHub release",
  "RELEASE_VERSION: ${{ steps.delivery.outputs.version }}",
  "Open VSX / VS Marketplace publishing intentionally deferred",
  "create-github-releases: false",
  "push-git-tags: false",
  "steps.changesets.outputs.published-packages",
  "if (includeVsix) args.push(vsix);",
  "!cancelled() && steps.delivery.outputs.version != ''",
];

for (const contract of required) {
  if (!workflow.includes(contract)) throw new Error(`Release workflow is missing: ${contract}`);
}

if (workflow.includes("ovsx") || workflow.includes("vsce publish")) {
  throw new Error(
    "Open VSX / VS Marketplace publishing must stay disabled until the extension is ready",
  );
}

if (workflow.includes("deprecate-retired-packages") || workflow.includes("Deprecate retired")) {
  throw new Error("Retired-package deprecation must not run in release CI");
}

if (workflow.includes("$extra") || workflow.includes('extra="--pre-release"')) {
  throw new Error("Prepackaged VSIX publication must not pass --pre-release");
}

if (workflow.includes("gh release upload") || workflow.includes("--clobber")) {
  throw new Error("Do not mutate GitHub Releases with gh release upload; attach VSIX at create time");
}

const packageIdx = workflow.indexOf("Prepare VS Code extension package");
const createIdx = workflow.indexOf("Create GitHub release");
if (packageIdx < 0 || createIdx < 0 || packageIdx > createIdx) {
  throw new Error("VSIX must be packaged before GitHub release create");
}

console.log("Release recovery contract is valid");
