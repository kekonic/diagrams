---
"@kekonic/diagrams": minor
"@kekonic/diagrams-cli": minor
"@kekonic/diagrams-core": minor
"@kekonic/diagrams-element": minor
"@kekonic/diagrams-geometry": minor
"@kekonic/diagrams-icons": minor
"@kekonic/diagrams-layout": minor
"@kekonic/diagrams-render-svg": minor
"@kekonic/diagrams-routing": minor
"@kekonic/diagrams-theme": minor
"@kekonic/diagrams-ui": minor
"@kekonic/diagrams-website": minor
---

Harden the final release candidate across delivery, tooling, and documentation.

- Load only requested Iconify glyphs in browsers while preserving the complete installed collections for Node and CLI rendering.
- Split the lightweight React live renderer from playground and Shiki entry points, and add copy/download playground actions.
- Add strict CLI flag handling, stdin and JSON diagnostics, version output, browser bundle budgets, and representative SVG regression snapshots.
- Scope snapshot theme tokens to inline SVGs, improve package metadata and compatibility declarations, and expand the product, quick-start, comparison, CLI, API, icon, and embedding documentation.
