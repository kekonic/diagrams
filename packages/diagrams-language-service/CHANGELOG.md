# @kekonic/diagrams-language-service

## 1.0.0-rc.8

### Patch Changes

- @kekonic/diagrams-core@1.0.0-rc.8
  - @kekonic/diagrams-icons@1.0.0-rc.8
  - @kekonic/diagrams-theme@1.0.0-rc.8

## 1.0.0-rc.7

### Minor Changes

- 50ecddf: Thin `kdiagram 2` model + view reshape (breaking, gated on `kdiagram 2`):

  - **Model** owns nodes, structural groups, and shared styles only — no edges, layout, or presentation in multi-view files (`FM222`).
  - **View** owns `include` / `exclude`, edges, layout, presentation, animation, and edge-route policy.
  - Removed `intent { }`, `collapse`, and `analyze --compare-layouts`.
  - Level of detail via explicit summary nodes in the model (e.g. `platform: system "…"` for context, `commerce.*` for containers).
  - Default view when omitted: `default`, then `main`, else first view in source order.
  - `diagram { }` remains one-shot sugar with co-located edges; CLI `--view`, studio/embed view switchers, and `graph --json` `payload.targets` unchanged.

  Updated `examples/storefront-model.kdiagram`, architecture notes in `docs/architecture/views-and-intent.md`, and public language/CLI/agent docs.

### Patch Changes

- Updated dependencies [982f2c0]
- Updated dependencies [50ecddf]
- Updated dependencies [982f2c0]
- Updated dependencies [982f2c0]
- Updated dependencies [982f2c0]
  - @kekonic/diagrams-theme@1.0.0-rc.7
  - @kekonic/diagrams-core@1.0.0-rc.7
  - @kekonic/diagrams-icons@1.0.0-rc.7

## 1.0.0-rc.6

### Patch Changes

- 981712f: Make `route: straight` and `route: bezier` real path styles: straight uses a port-to-port chord when the line of sight is clear (otherwise a short corridor dogleg), and bezier is an obstacle-aware cubic that follows layout ports instead of a naive center-to-center curve.
- 981712f: Make ERD tables a usable schema surface: parameterized types, inferred 1:1 and identifying relationships, composite keys, multi-FK fan-out, table notes, and crow’s-foot docs and examples that match what the pipeline actually draws.
- Updated dependencies [981712f]
- Updated dependencies [981712f]
- Updated dependencies [981712f]
- Updated dependencies [981712f]
- Updated dependencies [981712f]
  - @kekonic/diagrams-core@1.0.0-rc.6
  - @kekonic/diagrams-theme@1.0.0-rc.6
  - @kekonic/diagrams-icons@1.0.0-rc.6

## 1.0.0-rc.5

### Patch Changes

- Updated dependencies [7a35d7a]
  - @kekonic/diagrams-core@1.0.0-rc.5
  - @kekonic/diagrams-theme@1.0.0-rc.5
  - @kekonic/diagrams-icons@1.0.0-rc.5

## 1.0.0-rc.4

### Patch Changes

- 1d5519f: Add the official host-neutral `design-kekonic-diagrams` agent skill with grounded modeling,
  deterministic validation and rendering, progressively loaded editorial design, diagram-pattern,
  repair, and delivery guidance, and public installation documentation. Plan a clean replacement of
  the legacy example corpus after the agent capability and evaluation foundations are stable, and
  record the semantic, view, boundary, layout, provenance, and quality-analysis gaps revealed by the
  expert workflow as future product opportunities. Add KDiagram-specific semantic and measurable
  visual-review guidance plus an explicit architecture modeling and feature-use contract based on
  clean-room agent evaluation, and restore arrowheads on directed dependency edges discovered by that
  evaluation.
  Require concise plain-language subtitles and a bounded rendered layout bake-off so agents compare
  credible directions, region arrangements, and density choices instead of accepting the first valid
  composition.
  Add focused hexagonal-architecture guidance for ports, adapter placement, inward dependencies,
  repeated module stacks, single-poster limits, and progressive detail views based on a second
  clean-room evaluation.
  Make diagram-level region arrangement include ungrouped nodes as declaration-ordered track cells,
  so architecture views can stage actors, service regions, adapters, and external systems without
  inventing layout-only wrapper groups.
  Add the first-class `state` diagram surface with initial/final structural validation and UML-style
  initial/final rendering. Add post-layout FM220–FM224 quality diagnostics for extreme canvases,
  perimeter-spanning edges, crossings, reverse-flow pressure, and edge-label density. Expand the
  official skill and public design documentation with focused state-machine, responsibility-workflow,
  and event-driven composition guidance derived from clean-room evaluations.
  Fix formatting of styled edges with property blocks so agents can combine semantic styles and
  layout priority without producing invalid source.
- Updated dependencies [1d5519f]
  - @kekonic/diagrams-core@1.0.0-rc.4
  - @kekonic/diagrams-theme@1.0.0-rc.4
  - @kekonic/diagrams-icons@1.0.0-rc.4

## 1.0.0-rc.3

### Minor Changes

- 33971d5: Add the browser-compatible KDiagram language service, connect it to Studio's Monaco editor and CLI
  validation/formatting, and expose the same diagnostics, completion, navigation, refactoring,
  symbols, folding, semantic tokens, formatting, and code actions through `kdiagrams lsp --stdio`.

### Patch Changes

- Updated dependencies [8fd0c2b]
- Updated dependencies [e7a2d1f]
- Updated dependencies [d12b18d]
- Updated dependencies [2618a95]
- Updated dependencies [982bd4c]
  - @kekonic/diagrams-core@1.0.0-rc.3
  - @kekonic/diagrams-icons@1.0.0-rc.3
  - @kekonic/diagrams-theme@1.0.0-rc.3
