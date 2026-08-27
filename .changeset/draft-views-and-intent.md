---
"@kekonic/diagrams-core": major
"@kekonic/diagrams": major
"@kekonic/diagrams-cli": minor
"@kekonic/diagrams-studio": minor
"@kekonic/diagrams-element": minor
"@kekonic/diagrams-ui": minor
"@kekonic/diagrams-language-service": minor
"@kekonic/diagrams-agents": minor
"@kekonic/diagrams-website": patch
---

Thin `kdiagram 2` model + view reshape (breaking, gated on `kdiagram 2`):

- **Model** owns nodes, structural groups, and shared styles only — no edges, layout, or presentation in multi-view files (`FM222`).
- **View** owns `include` / `exclude`, edges, layout, presentation, animation, and edge-route policy.
- Removed `intent { }`, `collapse`, and `analyze --compare-layouts`.
- Level of detail via explicit summary nodes in the model (e.g. `platform: system "…"` for context, `commerce.*` for containers).
- Default view when omitted: `default`, then `main`, else first view in source order.
- `diagram { }` remains one-shot sugar with co-located edges; CLI `--view`, studio/embed view switchers, and `graph --json` `payload.targets` unchanged.

Updated `examples/storefront-model.kdiagram`, architecture notes in `docs/architecture/views-and-intent.md`, and public language/CLI/agent docs.
