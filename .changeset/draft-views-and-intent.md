---
"@kekonic/diagrams-core": minor
"@kekonic/diagrams": minor
"@kekonic/diagrams-cli": minor
"@kekonic/diagrams-studio": minor
"@kekonic/diagrams-element": minor
"@kekonic/diagrams-ui": minor
"@kekonic/diagrams-language-service": minor
"@kekonic/diagrams-agents": minor
"@kekonic/diagrams-website": patch
---

Draft `kdiagram 2` views and intent: optional `intent { }`, shared `model` + embedded `view` lenses, `--view` targeting, `analyze --compare-layouts`, studio/embed view switchers, gallery entry for `storefront-model`, collapse `description`, parent-boundary projection for zone grids, public language/CLI/embed/agent docs, LS/Shiki keywords, selector diagnostics (FM233/FM234), and architecture notes in `docs/architecture/views-and-intent.md`. One self-contained file per model — no cross-file `import`. Breaking changes remain gated on `kdiagram 2`; `diagram { }` stays the default path.
