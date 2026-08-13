/**
 * Expressive Code: editor frames need a title (tab); terminal frames do not.
 * Shell langs already get terminal chrome. This plugin fills a sensible tab
 * title for other languages so fences aren't a second, bare system.
 */

const TERMINAL_LANGS = new Set([
  "ansi",
  "bash",
  "bat",
  "batch",
  "cmd",
  "console",
  "fish",
  "nu",
  "nushell",
  "powershell",
  "ps",
  "ps1",
  "psd1",
  "psm1",
  "sh",
  "shell",
  "shellscript",
  "shellsession",
  "zsh",
]);

/** Prefer familiar file names; fall back to `example.<lang>`. */
const TITLE_BY_LANG = {
  kdiagram: "diagram.kdiagram",
  ts: "example.ts",
  typescript: "example.ts",
  tsx: "example.tsx",
  js: "example.js",
  javascript: "example.js",
  jsx: "example.jsx",
  mjs: "example.mjs",
  cjs: "example.cjs",
  css: "styles.css",
  scss: "styles.scss",
  html: "index.html",
  mdx: "example.mdx",
  md: "example.md",
  markdown: "example.md",
  json: "data.json",
  yaml: "config.yaml",
  yml: "config.yml",
  toml: "config.toml",
  astro: "example.astro",
};

function defaultTitleForLang(language) {
  const lang = language?.toLowerCase?.() ?? "";
  if (!lang || lang === "plaintext" || lang === "text" || lang === "txt") {
    return "example.txt";
  }
  return TITLE_BY_LANG[lang] ?? `example.${lang}`;
}

function isTerminalBlock(codeBlock) {
  const frame = codeBlock.props.frame ?? "auto";
  if (frame === "terminal") return true;
  if (frame === "code" || frame === "none") return false;
  return TERMINAL_LANGS.has(codeBlock.language);
}

/** Runs after the built-in Frames plugin (user plugins are appended). */
export function pluginDefaultCodeTitles() {
  return {
    name: "Default code titles",
    hooks: {
      preprocessCode({ codeBlock }) {
        const { props } = codeBlock;
        if (props.title !== undefined) return;
        if (props.frame === "none") return;
        if (isTerminalBlock(codeBlock)) return;
        props.title = defaultTitleForLang(codeBlock.language);
      },
    },
  };
}
