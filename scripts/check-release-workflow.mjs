import { readFileSync } from "node:fs";

const workflow = readFileSync(new URL("../.github/workflows/release.yml", import.meta.url), "utf8");

const required = [
  "workflow_dispatch:",
  "Resolve release delivery version",
  "needs.release.outputs.version != ''",
  "Verify resumed npm release",
  "Map VS Code extension version",
  "Recovered ${artifact} from the existing GitHub release",
  'VSCODE_EXTENSION_VERSION="$EXTENSION_VERSION"',
  "RELEASE_VERSION: ${{ steps.delivery.outputs.version }}",
  "name: Publish to VS Marketplace",
  "name: Publish to Open VSX",
  "VSCE_PAT: ${{ env.VSCE_PAT }}",
  "OVSX_PAT: ${{ env.OVSX_PAT }}",
  "--skip-duplicate",
  "args+=(--pre-release)",
  "OVSX_PAT is empty; skipping Open VSX publication",
  "create-github-releases: false",
  "push-git-tags: false",
  "steps.changesets.outputs.published-packages",
  "if (includeVsix) args.push(vsix);",
  "name: Deliver release",
  "needs: release",
  "always() && needs.release.outputs.version != ''",
  "Build workspace packages",
  "pnpm exec vp run -r build",
  "Deploy docs to Cloudflare Pages",
];

for (const contract of required) {
  if (!workflow.includes(contract)) throw new Error(`Release workflow is missing: ${contract}`);
}

if (workflow.includes("deprecate-retired-packages") || workflow.includes("Deprecate retired")) {
  throw new Error("Retired-package deprecation must not run in release CI");
}

if (workflow.includes("gh release upload") || workflow.includes("--clobber")) {
  throw new Error(
    "Do not mutate GitHub Releases with gh release upload; attach VSIX at create time",
  );
}

const packageIdx = workflow.indexOf("Prepare VS Code extension package");
const createIdx = workflow.indexOf("Create GitHub release");
const marketplaceIdx = workflow.indexOf("Publish to VS Marketplace");
const openVsxIdx = workflow.indexOf("Publish to Open VSX");
if (
  packageIdx < 0 ||
  createIdx < 0 ||
  marketplaceIdx < 0 ||
  openVsxIdx < 0 ||
  packageIdx > createIdx ||
  createIdx > marketplaceIdx ||
  marketplaceIdx > openVsxIdx
) {
  throw new Error("VSIX must be packaged before GitHub release create");
}

const deliverIdx = workflow.indexOf("name: Deliver release");
const openVsxSection = workflow.slice(openVsxIdx, deliverIdx);
const requiredOpenVsxContracts = [
  'output=$(pnpm exec ovsx "${args[@]}" 2>&1)',
  'if [[ "$output" == *"Unknown publisher: kekonic"* ]]',
  "::warning title=Open VSX namespace missing::",
  'exit "$status"',
];
for (const contract of requiredOpenVsxContracts) {
  if (!openVsxSection.includes(contract)) {
    throw new Error(`Open VSX publication is missing: ${contract}`);
  }
}
if (openVsxSection.includes("--pre-release")) {
  throw new Error("Open VSX must use the prerelease metadata already embedded in the VSIX");
}

const buildIdx = workflow.indexOf("Build workspace packages");
const deployIdx = workflow.indexOf("Deploy docs to Cloudflare Pages");
if (deliverIdx < 0 || buildIdx < 0 || deployIdx < 0 || buildIdx > deployIdx) {
  throw new Error("Delivery must build workspace packages before deploying docs");
}

const releaseJobEnd = workflow.indexOf("  deliver:");
if (
  releaseJobEnd > 0 &&
  workflow.slice(0, releaseJobEnd).includes("Deploy docs to Cloudflare Pages")
) {
  throw new Error("Docs deploy must run in the deliver job, not the release job");
}

console.log("Release recovery contract is valid");
