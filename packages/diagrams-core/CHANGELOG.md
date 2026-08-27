# @kekonic/diagrams-core

## 1.0.0-rc.7

### Major Changes

- 50ecddf: Thin `kdiagram 2` model + view reshape (breaking, gated on `kdiagram 2`):

  - **Model** owns nodes, structural groups, and shared styles only — no edges, layout, or presentation in multi-view files (`FM222`).
  - **View** owns `include` / `exclude`, edges, layout, presentation, animation, and edge-route policy.
  - Removed `intent { }`, `collapse`, and `analyze --compare-layouts`.
  - Level of detail via explicit summary nodes in the model (e.g. `platform: system "…"` for context, `commerce.*` for containers).
  - Default view when omitted: `default`, then `main`, else first view in source order.
  - `diagram { }` remains one-shot sugar with co-located edges; CLI `--view`, studio/embed view switchers, and `graph --json` `payload.targets` unchanged.

  Updated `examples/storefront-model.kdiagram`, architecture notes in `docs/architecture/views-and-intent.md`, and public language/CLI/agent docs.

### Patch Changes

- 982f2c0: True swimlanes and a DDD example suite.

  - Top-level `swimlane` groups infer `groupLayout: swimlane` and `direction: LR`. ELK ranks every member on a shared left-to-right timeline (flattened, not nested compounds); bands then pack in declaration order with no gap, shared width, and a left header strip. Header titles inset from the divider and wrap. Chrome is the header strip plus a hairline between bands — not a dashed box around each lane. Ordinary groups keep a dashed outline with no fill, so nested boxes do not stack washes on the canvas.
  - Flagship workflow: `examples/expense-approval.kdiagram`. Refund stays owner columns, not swimlanes.
  - DDD dogfood: event storming, context mapping, and Order aggregate design on the shared commerce story, with named animations and semantic styles.

- 982f2c0: Let inline SVG inherit the host light/dark theme. Unthemed `.k-diagram` no longer locks to dark tokens, and `theme: "auto"` omits snapshot lock attributes.

## 1.0.0-rc.6

### Minor Changes

- 981712f: Make `route: straight` and `route: bezier` real path styles: straight uses a port-to-port chord when the line of sight is clear (otherwise a short corridor dogleg), and bezier is an obstacle-aware cubic that follows layout ports instead of a naive center-to-center curve.
- 981712f: Make ERD tables a usable schema surface: parameterized types, inferred 1:1 and identifying relationships, composite keys, multi-FK fan-out, table notes, and crow’s-foot docs and examples that match what the pipeline actually draws.

### Patch Changes

- 981712f: Give C4 Context, Container, and Component distinct type names and separate example views of the same commerce platform — instead of a mixed-level “boxes labeled container” toy. Presentation stays on the Kekonic Diagrams theme; C4 does not require Structurizr’s palette.
- 981712f: Stop live diagram embeds from trapping page scroll: unmodified wheel now scrolls the page, and zoom requires Ctrl/⌘ + scroll (trackpad pinch still zooms). Dedicated canvases such as Studio preview can opt back into wheel-zoom with `zoomOnWheel: "always"`.
- 981712f: Give `route: metro` (the default), `rounded`, and `bezier` natural curves: ease out of the source port, ease into the target, and treat each obstacle jog as its own curved section. `route: orthogonal` stays a sharp polyline.

## 1.0.0-rc.5

### Patch Changes

- 7a35d7a: Replace the legacy example/gallery corpus with a grounded commerce progressive set and language atlas.

  Delete Salesforce demos and layout posters that predated the agent quality bar. Ship twelve examples indexed by `examples/catalog.json`, promote the skill order-fulfillment exemplar as the public hero, add the first gallery state machine, and keep the packaged skill copy identical to the repo exemplar. Fix sequence fragment formatting so `} and` / `} else` survive `kdiagrams format`.

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

## 1.0.0-rc.3

### Minor Changes

- 8fd0c2b: Remove pre-1.0 experimental residue that no supported consumer owns: renderer selection and layout
  contribution profiles, the redundant CLI renderer flag and SVG marker, unreachable removed-flag
  handling, obsolete authoring-state storage migrations, and unused public type and icon-size aliases.

  Keep and document the supported registry contracts, authored shape synonyms, documentation
  redirects, and the development-only example-save boundary.

- e7a2d1f: Harden the final release candidate across delivery, tooling, and documentation.

  - Load only requested Iconify glyphs in browsers while preserving the complete installed collections for Node and CLI rendering.
  - Split the lightweight React live renderer from playground and Shiki entry points, and add copy/download playground actions.
  - Add strict CLI flag handling, stdin and JSON diagnostics, version output, browser bundle budgets, and representative SVG regression snapshots.
  - Scope snapshot theme tokens to inline SVGs, improve package metadata and compatibility declarations, and expand the product, quick-start, comparison, CLI, API, icon, and embedding documentation.

- d12b18d: Add first-class sequence diagrams: top-level `sequence { … }` DSL, SequenceIR compile path, dedicated `sequence-v1` time-axis layout (lifelines, activations, fragments, notes), SVG paint + theme tokens, return op `-->`, and auto message-walk animation. Includes Temporal order-workflow sequence twin in examples/gallery.

### Patch Changes

- 2618a95: Make Studio the sole canonical authoring interface rather than retaining a parallel, reduced
  implementation. Studio now includes the split Monaco editor and live preview, diagnostics,
  source-backed diagram controls, viewport tools, formatting, export, responsive behavior, and the
  established sharp visual language while retaining CLI document
  discovery, synchronization, external-change handling, and authorized saves. The package's
  development command runs this same source tree, preventing development and CLI launch paths from
  drifting again. Studio now resolves requested Iconify glyphs through a bounded same-origin endpoint,
  so its strict CSP and offline contract no longer suppress diagram icons. Its production bundle also
  selects production Lit dependencies and includes the product favicon.
  The production app now preserves real lazy boundaries around Monaco, Shiki, and the KDiagram/ELK
  rendering engine, with a small initial entry and enforced compressed-size budgets. All browser host
  routes and assets are subpath-safe, and an Iconify-compatible endpoint can be configured through
  document metadata when Studio is mounted inside a documentation site or another web host.
  Studio's end-user surface is now focused on authoring: duplicate header fullscreen and developer-only
  AST/graph inspectors are removed, formatting lives beside the source document, and the sidebar keeps
  only high-value diagram settings. Sidebar changes are minimal edits to the KDiagram document rather
  than transient render overrides, and clicking a node reveals its declaration while drag gestures
  continue to pan. Diagnostics navigate to their source ranges as well. Diagram light/dark selection
  now lives in the Appearance sidebar and writes `render.theme` back to the document. Palette presets
  and custom accent/neutral colors are available again for export-oriented authoring. Studio SVG
  exports snapshot the resolved palette so downloaded files retain their colors without depending on
  a host stylesheet; the header theme control uses the same authored setting instead of creating a
  preview-only override.
  Formatting now preserves valid top-level direction and density shorthand plus quoted free-text
  properties. It also retains a single intentional blank line between statements while collapsing
  larger runs, keeps empty and one-property configuration blocks inline, and keeps one-property node
  and edge blocks inline without compacting structural or table-column bodies. Diagram-wide policy
  stays in a header above authored nodes and relationships while retaining precedence-sensitive source
  order; Studio inserts new policy into that header immediately rather than appending it.
  Source-backed Auto controls also remove settings correctly after the formatter compacts a
  single-property policy block.
  Studio's lazy Monaco bundle now includes the standard editing contributions omitted by the bare API
  entry: Find/Replace, multiple cursors, line move/copy/sort operations, commenting, indentation,
  folding, context menus, quick commands, and related keyboard shortcuts.
  The documentation build now publishes that same canonical application at `/studio/`. Standalone
  Studio opens and saves `.kdiagram` files with native browser file handles when available and portable
  upload/download fallbacks elsewhere, keeps a local recovery draft, and distinguishes source saves
  from rendered SVG export. Sharing can produce a fragment-backed editable Studio link, a diagram-only
  iframe, installed-package web-component code, or SVG markup. Fragment links keep source out of HTTP
  requests and referrers; the static docs host explicitly opts into Iconify's public API while the CLI
  host retains its bounded local icon endpoint.
- 982bd4c: Make CLI SVG exports portable theme snapshots by default, with discoverable JSON project config,
  named themes and export profiles, explicit live-theme output, background and print controls, and
  optional bundled-font embedding.

  Stabilize CLI automation and terminal contracts with versioned JSON envelopes, distinct exit codes,
  quiet/verbose/debug and color modes, real EPIPE handling, rich source-frame diagnostics, command and
  option suggestions, shell completions, and environment diagnostics. Add reviewed Homebrew formula
  generation and CI publication to the Kekonic tap for stable releases.

## 1.0.0-rc.2

### Minor Changes

- 27349fb: Add diagram animations: opt-in Automatic via empty named `animation` blocks (exclusive chapters vs parallel fan-out; `dim *` clears sticky highlights between chapters), authored cue scripts (including `parallel`), an SVG player on RenderController (`setSpeed`, `subscribe`, …), and Lit/React controls (picker, scrubber, 0.5×–2× speed). Diagrams stay static until an animation is declared.
- 27349fb: Edge label path bias via `labelPosition` / `labelAt` (`start` | `middle` | `end`; aliases `begin`/`source`, `mid`/`center`, `target`).

## 1.0.0-rc.1

### Minor Changes

- 5032ae2: Polish the DSL before stable: EdgeKind sync/async/eventual/association, soft keywords, concrete spacing, trimmed presentation chrome, and Shiki/lexer parity.

### Patch Changes

- 2465ce7: Add Changesets, Conventional Commits, CI/release workflows, Dependabot, and contributing docs.
  Keep guide docs evergreen (versions live in CHANGELOG / package metadata).
  One product version across publishable packages and the private website app.
