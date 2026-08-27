# @kekonic/diagrams-agents

## 1.0.0-rc.8

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

- 982f2c0: True swimlanes and a DDD example suite.

  - Top-level `swimlane` groups infer `groupLayout: swimlane` and `direction: LR`. ELK ranks every member on a shared left-to-right timeline (flattened, not nested compounds); bands then pack in declaration order with no gap, shared width, and a left header strip. Header titles inset from the divider and wrap. Chrome is the header strip plus a hairline between bands — not a dashed box around each lane. Ordinary groups keep a dashed outline with no fill, so nested boxes do not stack washes on the canvas.
  - Flagship workflow: `examples/expense-approval.kdiagram`. Refund stays owner columns, not swimlanes.
  - DDD dogfood: event storming, context mapping, and Order aggregate design on the shared commerce story, with named animations and semantic styles.

### Patch Changes

- 982f2c0: Put agent docs on the normal Starlight page layout and rewrite the copy as install-and-workflow instructions instead of a splash pitch.
- 982f2c0: Refresh brand assets and colors from the new Kekonic Diagrams logo.

  Wordmark, reverse wordmark, and symbol replace the old geometric K. The docs header uses the symbol; the homepage cinematic hero follows the site theme (color wordmark in light, reverse in dark) instead of forcing a dark stage under a light header. Chrome and diagram accents now use the logo purple (OKLCH hue 301), with gold warning nudged to the mark. Semantic `on-*` title tokens contrast against success, warning, danger, and muted fills.

## 1.0.0-rc.6

### Patch Changes

- 981712f: Document the verified Skills CLI shorthand `npx skills add kekonic/diagrams` as the public install command for the official agent skill.

## 1.0.0-rc.5

### Minor Changes

- 7a35d7a: Replace the legacy example/gallery corpus with a grounded commerce progressive set and language atlas.

  Delete Salesforce demos and layout posters that predated the agent quality bar. Ship twelve examples indexed by `examples/catalog.json`, promote the skill order-fulfillment exemplar as the public hero, add the first gallery state machine, and keep the packaged skill copy identical to the repo exemplar. Fix sequence fragment formatting so `} and` / `} else` survive `kdiagrams format`.

### Patch Changes

- 7a35d7a: Add `order-hexagon` as the ports-and-adapters skill exemplar and route hexagonal guidance to it.

## 1.0.0-rc.4

### Minor Changes

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
