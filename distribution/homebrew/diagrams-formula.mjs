const PACKAGE_NAME = "@kekonic/diagrams-cli";

export function npmTarballUrl(version) {
  assertStableVersion(version);
  return `https://registry.npmjs.org/${PACKAGE_NAME}/-/diagrams-cli-${version}.tgz`;
}

export function renderHomebrewFormula({ version, sha256 }) {
  assertStableVersion(version);
  if (!/^[a-f0-9]{64}$/.test(sha256)) {
    throw new Error("Homebrew formula SHA-256 must be 64 lowercase hexadecimal characters");
  }

  return `class Diagrams < Formula
  desc "Text-to-diagram CLI for deterministic, portable diagrams"
  homepage "https://diagrams.kekonic.com"
  url "${npmTarballUrl(version)}"
  version "${version}"
  sha256 "${sha256}"
  license "MIT"

  depends_on "node"

  def install
    system "npm", "install", "--global", "--prefix", libexec, "."
    bin.install_symlink libexec/"bin/kdiagrams"
  end

  test do
    assert_match version.to_s, shell_output("#{bin}/kdiagrams --version")
    assert_match "Common jobs:", shell_output("#{bin}/kdiagrams --help")
  end
end
`;
}

function assertStableVersion(version) {
  if (!/^\d+\.\d+\.\d+$/.test(version)) {
    throw new Error(`Homebrew publication requires a stable semantic version, received ${version}`);
  }
}
