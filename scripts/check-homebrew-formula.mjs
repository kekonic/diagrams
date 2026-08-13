import assert from "node:assert/strict";
import {
  npmTarballUrl,
  renderHomebrewFormula,
} from "../distribution/homebrew/diagrams-formula.mjs";

const sha256 = "a".repeat(64);
const formula = renderHomebrewFormula({ version: "1.2.3", sha256 });

assert.equal(
  npmTarballUrl("1.2.3"),
  "https://registry.npmjs.org/@kekonic/diagrams-cli/-/diagrams-cli-1.2.3.tgz",
);
assert.match(formula, /class Diagrams < Formula/);
assert.match(formula, /depends_on "node"/);
assert.match(formula, /diagrams-cli-1\.2\.3\.tgz/);
assert.match(formula, new RegExp(`sha256 "${sha256}"`));
assert.match(formula, /bin\.install_symlink libexec\/["']bin\/kdiagrams["']/);
assert.throws(
  () => renderHomebrewFormula({ version: "1.2.3-rc.1", sha256 }),
  /stable semantic version/,
);
assert.throws(
  () => renderHomebrewFormula({ version: "1.2.3", sha256: "not-a-checksum" }),
  /SHA-256/,
);

console.log("Homebrew formula contract is valid");
