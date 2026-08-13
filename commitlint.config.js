/** @type {import('@commitlint/types').UserConfig} */
export default {
  extends: ["@commitlint/config-conventional"],
  rules: {
    // Allow longer subjects for monorepo package names.
    "header-max-length": [2, "always", 100],
    "body-max-line-length": [2, "always", 120],
  },
};
