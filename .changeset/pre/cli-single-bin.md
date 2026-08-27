---
"@kekonic/diagrams-cli": patch
"@kekonic/diagrams-website": patch
---

Publish a single `kdiagrams` executable so `npx` and `pnpm dlx @kekonic/diagrams-cli` can run Studio.

The extra `kdiagrams-lsp` binary made those one-off tools refuse to choose an executable. Launch the language server with `kdiagrams lsp --stdio`.
