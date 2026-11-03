import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

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
  "name: Detect pending changesets",
  "node ./scripts/prepare-release-changesets.mjs",
  "name: Verify pending changesets were handled",
  "steps.changesets.outputs.has-changesets",
  "::error title=Pending changesets were skipped::",
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

const releasePreparationScript = fileURLToPath(
  new URL("./prepare-release-changesets.mjs", import.meta.url),
);

function git(cwd, ...args) {
  return execFileSync("git", args, { cwd, encoding: "utf8" }).trim();
}

function createReleaseFixture() {
  const cwd = mkdtempSync(path.join(tmpdir(), "kekonic-release-check-"));
  mkdirSync(path.join(cwd, ".changeset", "pre"), { recursive: true });
  mkdirSync(path.join(cwd, "packages", "example"), { recursive: true });
  writeFileSync(path.join(cwd, ".changeset", "pre.json"), '{"mode":"pre","tag":"rc"}\n');
  writeFileSync(
    path.join(cwd, "packages", "example", "package.json"),
    '{"name":"example","version":"1.0.0-rc.14"}\n',
  );
  git(cwd, "init", "-q");
  git(cwd, "config", "user.email", "release-check@example.com");
  git(cwd, "config", "user.name", "Release Check");
  git(cwd, "add", ".");
  git(cwd, "commit", "-qm", "initial");
  return cwd;
}

function runReleasePreparation(cwd, before, after) {
  const output = path.join(cwd, "github-output.txt");
  execFileSync(process.execPath, [releasePreparationScript], {
    cwd,
    env: { ...process.env, BEFORE_SHA: before, AFTER_SHA: after, GITHUB_OUTPUT: output },
    stdio: "pipe",
  });
  return readFileSync(output, "utf8");
}

const recoveryFixture = createReleaseFixture();
try {
  const before = git(recoveryFixture, "rev-parse", "HEAD");
  writeFileSync(
    path.join(recoveryFixture, ".changeset", "pre", "sketch.md"),
    '---\n"example": patch\n---\n\nAdd sketch rendering.\n',
  );
  git(recoveryFixture, "add", ".");
  git(recoveryFixture, "commit", "-qm", "feature");
  const after = git(recoveryFixture, "rev-parse", "HEAD");
  const output = runReleasePreparation(recoveryFixture, before, after);
  if (!existsSync(path.join(recoveryFixture, ".changeset", "sketch.md"))) {
    throw new Error("Release preparation did not recover a misplaced prerelease changeset");
  }
  if (!output.includes("pending=true") || !output.includes("recovered=1")) {
    throw new Error("Release preparation did not report the recovered pending changeset");
  }
} finally {
  rmSync(recoveryFixture, { recursive: true, force: true });
}

const archiveFixture = createReleaseFixture();
try {
  const before = git(archiveFixture, "rev-parse", "HEAD");
  writeFileSync(
    path.join(archiveFixture, ".changeset", "pre", "released.md"),
    '---\n"example": patch\n---\n\nAlready released.\n',
  );
  writeFileSync(
    path.join(archiveFixture, "packages", "example", "package.json"),
    '{"name":"example","version":"1.0.0-rc.15"}\n',
  );
  git(archiveFixture, "add", ".");
  git(archiveFixture, "commit", "-qm", "release");
  const after = git(archiveFixture, "rev-parse", "HEAD");
  const output = runReleasePreparation(archiveFixture, before, after);
  if (existsSync(path.join(archiveFixture, ".changeset", "released.md"))) {
    throw new Error("Release preparation treated an archived changeset as pending");
  }
  if (!output.includes("pending=false") || !output.includes("recovered=0")) {
    throw new Error("Release preparation did not ignore the archived changeset");
  }
} finally {
  rmSync(archiveFixture, { recursive: true, force: true });
}

console.log("Release recovery contract is valid");
