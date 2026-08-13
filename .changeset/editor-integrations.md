---
"@kekonic/diagrams-markdown-it": minor
"@kekonic/diagrams-remark": minor
"@kekonic/diagrams-build": minor
"@kekonic/diagrams-unplugin": minor
"@kekonic/diagrams-website": patch
"@kekonic/diagrams-cli": minor
"diagrams": minor
---

Add a static, accessible Markdown-it renderer with Markdown-line diagnostics, a dedicated LSP
launcher for editor hosts, and the first-party VS Code extension with language intelligence,
KDiagram syntax highlighting, side-by-side preview, SVG export, and rendered Markdown fences.
The extension ships as a validated, self-contained VSIX with automated Open VSX and GitHub Release
delivery.

Add a Remark plugin for Unified, MDX, Astro, and Docusaurus pipelines that converts KDiagram fences
to static HAST/SVG without enabling raw HTML, while mapping diagnostics to Markdown source lines.

Add a shared build integration core and an Unplugin adapter for explicit static SVG, data URL,
source, React, and custom-element imports across Vite and compatible bundlers.
