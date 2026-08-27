# @kekonic/diagrams-website

## 1.0.0-rc.7

### Patch Changes

- 982f2c0: Put agent docs on the normal Starlight page layout and rewrite the copy as install-and-workflow instructions instead of a splash pitch.
- 982f2c0: Refresh brand assets and colors from the new Kekonic Diagrams logo.

  Wordmark, reverse wordmark, and symbol replace the old geometric K. The docs header uses the symbol; the homepage cinematic hero follows the site theme (color wordmark in light, reverse in dark) instead of forcing a dark stage under a light header. Chrome and diagram accents now use the logo purple (OKLCH hue 301), with gold warning nudged to the mark. Semantic `on-*` title tokens contrast against success, warning, danger, and muted fills.

- 982f2c0: Publish a single `kdiagrams` executable so `npx` and `pnpm dlx @kekonic/diagrams-cli` can run Studio.

  The extra `kdiagrams-lsp` binary made those one-off tools refuse to choose an executable. Launch the language server with `kdiagrams lsp --stdio`.

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

- 982f2c0: Let inline SVG inherit the host light/dark theme. Unthemed `.k-diagram` no longer locks to dark tokens, and `theme: "auto"` omits snapshot lock attributes.
- 982f2c0: Show a registered custom theme with rounded corners and shadows on the Themes docs page. Snapshot token CSS targets the stamped SVG so sibling inline diagrams keep their own palette.
- Updated dependencies [982f2c0]
- Updated dependencies [50ecddf]
- Updated dependencies [982f2c0]
- Updated dependencies [982f2c0]
- Updated dependencies [982f2c0]
  - @kekonic/diagrams-ui@1.0.0-rc.7
  - @kekonic/diagrams-element@1.0.0-rc.7
  - @kekonic/diagrams@1.0.0-rc.7

## 1.0.0-rc.6

### Patch Changes

- 981712f: Promote the official agent skill to a first-class product surface with a homepage flagship section, a dedicated /agents/ landing, and start-path documentation.
- 981712f: Give C4 Context, Container, and Component distinct type names and separate example views of the same commerce platform — instead of a mixed-level “boxes labeled container” toy. Presentation stays on the Kekonic Diagrams theme; C4 does not require Structurizr’s palette.
- 981712f: Replace the leftover Flowmark F mark with a geometric Kekonic K on the docs site, favicons, and Studio toolbar.
- 981712f: Stop live diagram embeds from trapping page scroll: unmodified wheel now scrolls the page, and zoom requires Ctrl/⌘ + scroll (trackpad pinch still zooms). Dedicated canvases such as Studio preview can opt back into wheel-zoom with `zoomOnWheel: "always"`.
- 981712f: Document the verified Skills CLI shorthand `npx skills add kekonic/diagrams` as the public install command for the official agent skill.
- 981712f: Skin the Starlight docs shell to Kekonic chrome: square corners, a quiet search well, and a sun/moon light/dark toggle instead of stock Starlight header controls.
- 981712f: Make `route: straight` and `route: bezier` real path styles: straight uses a port-to-port chord when the line of sight is clear (otherwise a short corridor dogleg), and bezier is an obstacle-aware cubic that follows layout ports instead of a naive center-to-center curve.
- 981712f: Make ERD tables a usable schema surface: parameterized types, inferred 1:1 and identifying relationships, composite keys, multi-FK fan-out, table notes, and crow’s-foot docs and examples that match what the pipeline actually draws.
- Updated dependencies [981712f]
- Updated dependencies [981712f]
- Updated dependencies [981712f]
- Updated dependencies [981712f]
- Updated dependencies [981712f]
- Updated dependencies [981712f]
  - @kekonic/diagrams@1.0.0-rc.6
  - @kekonic/diagrams-element@1.0.0-rc.6
  - @kekonic/diagrams-ui@1.0.0-rc.6

## 1.0.0-rc.5

### Minor Changes

- 7a35d7a: Replace the legacy example/gallery corpus with a grounded commerce progressive set and language atlas.

  Delete Salesforce demos and layout posters that predated the agent quality bar. Ship twelve examples indexed by `examples/catalog.json`, promote the skill order-fulfillment exemplar as the public hero, add the first gallery state machine, and keep the packaged skill copy identical to the repo exemplar. Fix sequence fragment formatting so `} and` / `} else` survive `kdiagrams format`.

### Patch Changes

- Updated dependencies [7a35d7a]
- Updated dependencies [7a35d7a]
  - @kekonic/diagrams@1.0.0-rc.5
  - @kekonic/diagrams-element@1.0.0-rc.5
  - @kekonic/diagrams-ui@1.0.0-rc.5

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

### Patch Changes

- Updated dependencies [1d5519f]
  - @kekonic/diagrams@1.0.0-rc.4
  - @kekonic/diagrams-ui@1.0.0-rc.4
  - @kekonic/diagrams-element@1.0.0-rc.4

## 1.0.0-rc.3

### Minor Changes

- e7a2d1f: Harden the final release candidate across delivery, tooling, and documentation.

  - Load only requested Iconify glyphs in browsers while preserving the complete installed collections for Node and CLI rendering.
  - Split the lightweight React live renderer from playground and Shiki entry points, and add copy/download playground actions.
  - Add strict CLI flag handling, stdin and JSON diagnostics, version output, browser bundle budgets, and representative SVG regression snapshots.
  - Scope snapshot theme tokens to inline SVGs, improve package metadata and compatibility declarations, and expand the product, quick-start, comparison, CLI, API, icon, and embedding documentation.

- d12b18d: Add first-class sequence diagrams: top-level `sequence { … }` DSL, SequenceIR compile path, dedicated `sequence-v1` time-axis layout (lifelines, activations, fragments, notes), SVG paint + theme tokens, return op `-->`, and auto message-walk animation. Includes Temporal order-workflow sequence twin in examples/gallery.

### Patch Changes

- 8fd0c2b: Remove pre-1.0 experimental residue that no supported consumer owns: renderer selection and layout
  contribution profiles, the redundant CLI renderer flag and SVG marker, unreachable removed-flag
  handling, obsolete authoring-state storage migrations, and unused public type and icon-size aliases.

  Keep and document the supported registry contracts, authored shape synonyms, documentation
  redirects, and the development-only example-save boundary.

- 8873815: Add a published browser-safe Studio protocol, stale-render coordinator, state reducer, and shared
  presentation controls, and migrate the established authoring UI into that host-neutral contract.

  Add `kdiagrams studio` with an offline Monaco browser host, live watched previews and diagnostics,
  graph inspection, source-range and graph-element selection, layout/theme controls, SVG export, and
  explicitly authorized saves. The local adapter binds to loopback, authenticates each session with an
  unguessable token, and scopes file access to resolved inputs.

- c807e6c: Add a static, accessible Markdown-it renderer with Markdown-line diagnostics, a dedicated LSP
  launcher for editor hosts, and the first-party VS Code extension with language intelligence,
  KDiagram syntax highlighting, side-by-side preview, SVG export, and rendered Markdown fences.
  The extension ships as a validated, self-contained VSIX with automated Open VSX and GitHub Release
  delivery.

  Add a Remark plugin for Unified, MDX, Astro, and Docusaurus pipelines that converts KDiagram fences
  to static HAST/SVG without enabling raw HTML, while mapping diagnostics to Markdown source lines.

  Add a shared build integration core and an Unplugin adapter for explicit static SVG, data URL,
  source, React, and custom-element imports across Vite and compatible bundlers.

- e7a2d1f: Rebuild the documentation around reader outcomes with a new learning path, task-based design and publishing guides, consolidated reference material, honest adoption guidance, troubleshooting, and redirects from the previous structure.

  Allow editable playgrounds to select, autoplay, loop, and show controls for authored diagram animations.

  Add a frameless live-embed mode that removes the host border and panel background without changing
  control behavior.

- 30bdebd: Publish the product roadmap covering a more capable and portable CLI; separately packaged,
  `npx skills add`-installable agent-ready design workflows; deterministic feedback; editor and build
  integrations; reusable models and views; architecture governance; a CLI-launched studio; Markdown
  preview and publishing adapters; export quality; adapters; selective diagram growth; and pre-1.0
  removal of obsolete experiments and planning artifacts. Replace release-state and speculative prose
  in public READMEs and documentation with evergreen guidance, and replace the monolithic project
  specification with focused pipeline architecture contracts.
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

- Updated dependencies [8fd0c2b]
- Updated dependencies [e7a2d1f]
- Updated dependencies [e7a2d1f]
- Updated dependencies [d12b18d]
- Updated dependencies [2618a95]
  - @kekonic/diagrams@1.0.0-rc.3
  - @kekonic/diagrams-ui@1.0.0-rc.3
  - @kekonic/diagrams-element@1.0.0-rc.3

## 1.0.0-rc.2

### Minor Changes

- 27349fb: Add diagram animations: opt-in Automatic via empty named `animation` blocks (exclusive chapters vs parallel fan-out; `dim *` clears sticky highlights between chapters), authored cue scripts (including `parallel`), an SVG player on RenderController (`setSpeed`, `subscribe`, …), and Lit/React controls (picker, scrubber, 0.5×–2× speed). Diagrams stay static until an animation is declared.

### Patch Changes

- Updated dependencies [27349fb]
- Updated dependencies [27349fb]
  - @kekonic/diagrams@1.0.0-rc.2
  - @kekonic/diagrams-element@1.0.0-rc.2
  - @kekonic/diagrams-ui@1.0.0-rc.2

## 1.0.0-rc.1

### Minor Changes

- 5032ae2: Polish the DSL before stable: EdgeKind sync/async/eventual/association, soft keywords, concrete spacing, trimmed presentation chrome, and Shiki/lexer parity.

### Patch Changes

- 2465ce7: Add Changesets, Conventional Commits, CI/release workflows, Dependabot, and contributing docs.
  Keep guide docs evergreen (versions live in CHANGELOG / package metadata).
  One product version across publishable packages and the private website app.
- Updated dependencies [5032ae2]
- Updated dependencies [5032ae2]
- Updated dependencies [2465ce7]
  - @kekonic/diagrams@1.0.0-rc.1
  - @kekonic/diagrams-element@1.0.0-rc.1
  - @kekonic/diagrams-ui@1.0.0-rc.1
