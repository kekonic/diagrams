/** @type {import('@commitlint/types').UserConfig} */
export default {
  extends: ["@commitlint/config-conventional"],
  ignores: [
    (message) => /Signed-off-by: dependabot\[bot\] <support@github\.com>/u.test(message),
    // GitHub squash merges use a `(#123)` subject and a `---------` trailer.
    // Those bodies already passed commitlint on the source pull request. The
    // generated co-author lines push the rest of the message into the footer,
    // so the concatenated message fails line-length on its own.
    (message) => {
      const subject = message.split("\n")[0] ?? "";
      return /\(#\d+\)$/u.test(subject) && /^---------$/mu.test(message);
    },
  ],
  rules: {
    // Allow longer subjects for monorepo package names.
    "header-max-length": [2, "always", 100],
    "body-max-line-length": [2, "always", 120],
  },
};
