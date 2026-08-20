import { defineConfig } from "astro/config";
import starlight from "@astrojs/starlight";
import react from "@astrojs/react";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { kdiagramLanguage } from "@kekonic/diagrams-ui/shiki";
import { pluginDefaultCodeTitles } from "./src/expressive-code/default-code-titles.js";
import { studioStaticIntegration } from "./studio-static-integration.mjs";
import { galleryAstroRedirects } from "./src/data/gallery-catalog.ts";

const root = fileURLToPath(new URL("../..", import.meta.url));
const packages = resolve(root, "packages");

export default defineConfig({
  site: "https://diagrams.kekonic.com",
  redirects: {
    ...galleryAstroRedirects(),
    "/start/why": "/start/",
    "/start/compare": "/start/choose/",
    "/language/overview": "/reference/language/",
    "/language/nodes": "/reference/language/#nodes",
    "/language/edges": "/reference/language/#connections",
    "/language/groups": "/design/layout/",
    "/language/layout": "/design/layout/",
    "/language/tables": "/design/data-models/",
    "/language/sequence": "/design/sequence-diagrams/",
    "/language/animation": "/design/stories/",
    "/language/icons": "/reference/icons/",
    "/patterns": "/design/",
    "/patterns/sync-vs-event": "/design/architecture/#make-connections-mean-something",
    "/patterns/group-as-plane": "/design/layout/#groups-are-layout-boundaries",
    "/patterns/columns-and-bands": "/design/layout/#arrange-groups-deliberately",
    "/patterns/grid-with-spans": "/design/layout/#use-a-grid-for-two-dimensional-structure",
    "/patterns/person-system-container": "/design/architecture/#show-the-right-level-of-detail",
    "/patterns/table-fk-edges": "/design/data-models/",
    "/patterns/workflow-branches": "/design/workflows/",
    "/patterns/theme-and-presentation": "/publish/theming/",
    "/patterns/icon-brand-vs-theme": "/reference/icons/",
    "/patterns/density-and-crossings": "/design/layout/#tune-the-result-not-the-coordinates",
    "/use": "/publish/",
    "/use/wiki": "/publish/svg/",
    "/use/static-site": "/publish/svg/",
    "/use/markdown-git": "/publish/svg/#keep-source-and-output-together",
    "/use/html": "/publish/web-component/",
    "/use/react": "/publish/react/",
    "/use/ci": "/publish/ci/",
    "/use/playground": "/publish/react/#editable-playground",
    "/use/sdk": "/reference/api/",
    "/use/theming": "/publish/theming/",
    "/internals/pipeline": "/reference/api/#the-rendering-pipeline",
    "/internals/layout": "/design/layout/",
    "/ecosystem/roadmap": "https://github.com/kekonic/diagrams/blob/main/ROADMAP.md",
    "/ecosystem/contributing": "https://github.com/kekonic/diagrams/blob/main/CONTRIBUTING.md",
    "/ecosystem/editors": "/publish/ci/#work-with-any-editor",
    "/ecosystem/adapters": "/start/choose/#what-kdiagram-does-not-do",
    "/ecosystem/renderers-themes": "/publish/theming/",
    "/guides/integrate": "/publish/",
    "/guides/embed": "/publish/web-component/",
    "/guides/cli": "/publish/ci/",
    "/guides/theming": "/publish/theming/",
    "/design/agents": "/agents/",
  },

  integrations: [
    studioStaticIntegration(),
    react(),
    starlight({
      title: "Kekonic Diagrams",
      description:
        "Describe software systems as readable text. Kekonic Diagrams arranges the graph, routes the connections, and produces SVG for docs, apps, and CI.",
      favicon: "/favicon.svg",
      logo: {
        light: "./src/assets/logo-light.svg",
        dark: "./src/assets/logo-dark.svg",
        alt: "",
        replacesTitle: false,
      },
      social: [
        {
          icon: "github",
          label: "GitHub",
          href: "https://github.com/kekonic/diagrams",
        },
      ],
      editLink: {
        baseUrl: "https://github.com/kekonic/diagrams/edit/main/apps/website/",
      },
      components: {
        TwoColumnContent: "./src/components/starlight/TwoColumnContent.astro",
        PageTitle: "./src/components/starlight/PageTitle.astro",
        Hero: "./src/components/starlight/Hero.astro",
        Header: "./src/components/starlight/Header.astro",
        ThemeSelect: "./src/components/starlight/ThemeSelect.astro",
        MobileMenuFooter: "./src/components/starlight/MobileMenuFooter.astro",
      },
      customCss: [
        "@fontsource/ibm-plex-sans/400.css",
        "@fontsource/ibm-plex-sans/500.css",
        "@fontsource/ibm-plex-sans/600.css",
        "@fontsource/ibm-plex-mono/400.css",
        "@fontsource/ibm-plex-mono/500.css",
        "@kekonic/diagrams-ui/chrome.css",
        "./src/styles/starlight.css",
        "./src/styles/starlight-chrome.css",
      ],
      expressiveCode: {
        themes: ["github-dark", "github-light"],
        useStarlightDarkModeSwitch: true,
        // Custom themes disable this by default — without it, EC frame chrome
        // (active tab top border) uses github-dark's salmon `#f9826c`
        // (`tab.activeBorderTop`). Starlight UI colors remap that to
        // `--sl-color-accent` / `--sl-color-accent-high` (purple brand accent).
        useStarlightUiThemeColors: true,
        shiki: {
          langs: [kdiagramLanguage],
        },
        // Editor frames need a title; shell langs already get terminal chrome.
        // Plugin supplies default tab titles so bare fences match CLI windows.
        plugins: [pluginDefaultCodeTitles()],
        styleOverrides: {
          borderRadius: "0",
          borderWidth: "1px",
          frames: {
            shadowColor: "transparent",
          },
        },
      },
      sidebar: [
        {
          label: "Start",
          items: [
            { label: "Open Studio ↗", link: "/studio/" },
            { label: "Meet Kekonic Diagrams", link: "/start/" },
            { label: "Quickstart", link: "/start/quick-start/" },
            { label: "Design with agents", link: "/agents/" },
            { label: "VS Code and compatible editors", link: "/start/vscode/" },
            { label: "Build your first diagram", link: "/start/first-diagram/" },
            { label: "Is Kekonic Diagrams right for you?", link: "/start/choose/" },
          ],
        },
        {
          label: "Design diagrams",
          items: [
            { label: "Overview", link: "/design/" },
            { label: "Architecture", link: "/design/architecture/" },
            { label: "Workflows", link: "/design/workflows/" },
            { label: "Data models", link: "/design/data-models/" },
            { label: "Sequence diagrams", link: "/design/sequence-diagrams/" },
            { label: "Control layout", link: "/design/layout/" },
            { label: "Tell a story", link: "/design/stories/" },
          ],
        },
        {
          label: "Publish diagrams",
          collapsed: true,
          items: [
            { label: "Choose an integration", link: "/publish/" },
            { label: "SVG and static sites", link: "/publish/svg/" },
            { label: "Markdown", link: "/publish/markdown/" },
            { label: "Build tools and imports", link: "/publish/build-tools/" },
            { label: "Web component", link: "/publish/web-component/" },
            { label: "React", link: "/publish/react/" },
            { label: "CI and automation", link: "/publish/ci/" },
            { label: "Themes", link: "/publish/theming/" },
          ],
        },
        {
          label: "Examples",
          collapsed: true,
          items: [{ label: "Gallery", link: "/gallery/" }],
        },
        {
          label: "Reference",
          collapsed: true,
          items: [
            { label: "Language", link: "/reference/language/" },
            { label: "Icons", link: "/reference/icons/" },
            { label: "JavaScript API", link: "/reference/api/" },
            { label: "CLI reference", link: "/reference/cli/" },
            { label: "Language service", link: "/reference/language-service/" },
            { label: "Troubleshooting", link: "/reference/troubleshooting/" },
          ],
        },
      ],
    }),
  ],
  vite: {
    resolve: {
      // Subpath CSS/JS aliases first. Package-root entries are exact (`/^name$/`) so
      // `@kekonic/diagrams` cannot prefix-match `@kekonic/diagrams/theme.css` into
      // `src/index.ts/theme.css` (PostCSS ENOTDIR).
      alias: [
        {
          find: "@kekonic/diagrams/theme.css",
          replacement: resolve(packages, "diagrams/theme.css"),
        },
        {
          find: "@kekonic/diagrams-ui/shiki",
          replacement: resolve(packages, "diagrams-ui/src/shiki/kdiagram.ts"),
        },
        {
          find: "@kekonic/diagrams-ui/chrome.css",
          replacement: resolve(packages, "diagrams-ui/src/chrome/tokens.css"),
        },
        {
          find: "@kekonic/diagrams-ui/live.css",
          replacement: resolve(packages, "diagrams-ui/src/diagram/live.css"),
        },
        {
          find: "@kekonic/diagrams-ui/playground.css",
          replacement: resolve(packages, "diagrams-ui/src/diagram/playground.css"),
        },
        {
          find: "@kekonic/diagrams-ui/playground",
          replacement: resolve(packages, "diagrams-ui/src/playground.ts"),
        },
        {
          find: /^@kekonic\/diagrams-ui$/,
          replacement: resolve(packages, "diagrams-ui/src/index.ts"),
        },
        {
          find: /^@kekonic\/diagrams-element$/,
          replacement: resolve(packages, "diagrams-element/src/index.ts"),
        },
        {
          find: /^@kekonic\/diagrams$/,
          replacement: resolve(packages, "diagrams/src/index.ts"),
        },
        {
          find: /^@kekonic\/diagrams-core$/,
          replacement: resolve(packages, "diagrams-core/src/index.ts"),
        },
        {
          find: /^@kekonic\/diagrams-icons$/,
          replacement: resolve(packages, "diagrams-icons/src/index.ts"),
        },
        {
          find: /^@kekonic\/diagrams-layout$/,
          replacement: resolve(packages, "diagrams-layout/src/index.ts"),
        },
        {
          find: /^@kekonic\/diagrams-routing$/,
          replacement: resolve(packages, "diagrams-routing/src/index.ts"),
        },
        {
          find: /^@kekonic\/diagrams-render-svg$/,
          replacement: resolve(packages, "diagrams-render-svg/src/index.ts"),
        },
        {
          find: /^@kekonic\/diagrams-theme$/,
          replacement: resolve(packages, "diagrams-theme/src/index.ts"),
        },
      ],
    },
    server: {
      fs: { allow: [root] },
    },
    // Lazy highlightKDiagram → import("shiki"). Hoisted @shikijs/* (see root .npmrc).
    optimizeDeps: {
      include: ["shiki"],
    },
    assetsInclude: ["**/*.kdiagram"],
    ssr: {
      external: ["opentype.js", "@fontsource/inter"],
      noExternal: [
        "@kekonic/diagrams",
        "@kekonic/diagrams-ui",
        "@kekonic/diagrams-element",
        "@kekonic/diagrams-core",
        "@kekonic/diagrams-icons",
        "@kekonic/diagrams-layout",
        "@kekonic/diagrams-routing",
        "@kekonic/diagrams-render-svg",
        "@kekonic/diagrams-theme",
        "@lit/react",
        "lit",
      ],
    },
  },
});
