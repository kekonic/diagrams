# Changelog

## 1.0.0-rc.7

### Patch Changes

- 982f2c0: Refresh brand assets and colors from the new Kekonic Diagrams logo.
  
  Wordmark, reverse wordmark, and symbol replace the old geometric K. The docs header uses the symbol; the homepage cinematic hero follows the site theme (color wordmark in light, reverse in dark) instead of forcing a dark stage under a light header. Chrome and diagram accents now use the logo purple (OKLCH hue 301), with gold warning nudged to the mark. Semantic `on-*` title tokens contrast against success, warning, danger, and muted fills.

## 1.0.0-rc.6

## 1.0.0-rc.5

### Patch Changes

- 7a35d7a: Ship an interactive VS Code side preview and make it discoverable without relying on a hidden title-bar icon.

  Host `<k-diagram>` in a script-enabled webview with offline Iconify collections, auto-open the preview for `.kdiagram` editors, and add a scoped Preview keybinding plus context-menu entry.

- 7a35d7a: Interactive VS Code side preview follows the editor color theme for accent and neutrals (export SVG still uses `diagrams.preview.theme`).

## 1.0.0-rc.4

## 1.0.0-rc.3

### Minor Changes

- c807e6c: Add a static, accessible Markdown-it renderer with Markdown-line diagnostics, a dedicated LSP
  launcher for editor hosts, and the first-party VS Code extension with language intelligence,
  KDiagram syntax highlighting, side-by-side preview, SVG export, and rendered Markdown fences.
  The extension ships as a validated, self-contained VSIX with automated Open VSX and GitHub Release
  delivery.

  Add a Remark plugin for Unified, MDX, Astro, and Docusaurus pipelines that converts KDiagram fences
  to static HAST/SVG without enabling raw HTML, while mapping diagnostics to Markdown source lines.

  Add a shared build integration core and an Unplugin adapter for explicit static SVG, data URL,
  source, React, and custom-element imports across Vite and compatible bundlers.

## 1.0.0-rc.2

- Initial KDiagram language support, language server, preview, SVG export, and Markdown fences.
