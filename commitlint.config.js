/** @type {import('@commitlint/types').UserConfig} */
export default {
  extends: ["@commitlint/config-conventional"],
  ignores: [(message) => /Signed-off-by: dependabot\[bot\] <support@github\.com>/u.test(message)],
  rules: {
    // Allow longer subjects for monorepo package names.
    "header-max-length": [2, "always", 100],
    "body-max-line-length": [2, "always", 120],
  },
};
