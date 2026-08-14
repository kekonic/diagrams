# @kekonic/diagrams-ui

## 1.0.0-rc.5

### Patch Changes

- Updated dependencies [7a35d7a]
- Updated dependencies [7a35d7a]
  - @kekonic/diagrams@1.0.0-rc.5
  - @kekonic/diagrams-core@1.0.0-rc.5
  - @kekonic/diagrams-element@1.0.0-rc.5

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
  - @kekonic/diagrams@1.0.0-rc.4
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

- e7a2d1f: Rebuild the documentation around reader outcomes with a new learning path, task-based design and publishing guides, consolidated reference material, honest adoption guidance, troubleshooting, and redirects from the previous structure.

  Allow editable playgrounds to select, autoplay, loop, and show controls for authored diagram animations.

  Add a frameless live-embed mode that removes the host border and panel background without changing
  control behavior.

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
- Updated dependencies [8fd0c2b]
- Updated dependencies [e7a2d1f]
- Updated dependencies [e7a2d1f]
- Updated dependencies [d12b18d]
- Updated dependencies [2618a95]
- Updated dependencies [982bd4c]
  - @kekonic/diagrams@1.0.0-rc.3
  - @kekonic/diagrams-core@1.0.0-rc.3
  - @kekonic/diagrams-element@1.0.0-rc.3

## 1.0.0-rc.2

### Minor Changes

- 27349fb: Add diagram animations: opt-in Automatic via empty named `animation` blocks (exclusive chapters vs parallel fan-out; `dim *` clears sticky highlights between chapters), authored cue scripts (including `parallel`), an SVG player on RenderController (`setSpeed`, `subscribe`, …), and Lit/React controls (picker, scrubber, 0.5×–2× speed). Diagrams stay static until an animation is declared.

### Patch Changes

- Updated dependencies [27349fb]
- Updated dependencies [27349fb]
  - @kekonic/diagrams@1.0.0-rc.2
  - @kekonic/diagrams-element@1.0.0-rc.2

## 1.0.0-rc.1

### Minor Changes

- 5032ae2: Polish the DSL before stable: EdgeKind sync/async/eventual/association, soft keywords, concrete spacing, trimmed presentation chrome, and Shiki/lexer parity.
- 5032ae2: Move the default theme accent to purple and retune the group accent palette.

  The brand sits at OKLCH hue 288 (between indigo and Tailwind violet). Past ~300
  the hue runs into purple → fuchsia → pink, so raising chroma there turns the
  brand pink; at 288 more chroma reads as richer violet. Link accents are
  `oklch(72% 0.14 288)` dark / `oklch(48% 0.21 288)` light. Filled brand surfaces
  use a separate theme-independent `--accent-strong` (`oklch(52% 0.24 288)`) with
  `--on-accent-strong` near-white labels (~5.8:1), so primary buttons stay
  legible in both modes instead of washing out as pale lavender. A related
  `--accent-contrast` token tracks the accent seed for text placed on `--accent`
  fills.

  Group washes render at ~12% alpha, where amber, orange, and red desaturated into
  olive, brown, and maroon over a dark panel. The palette now holds a consistent
  lightness across cool and magenta hues so multi-group diagrams stay legible on
  both dark and light backgrounds.

### Patch Changes

- 2465ce7: Add Changesets, Conventional Commits, CI/release workflows, Dependabot, and contributing docs.
  Keep guide docs evergreen (versions live in CHANGELOG / package metadata).
  One product version across publishable packages and the private website app.
- Updated dependencies [5032ae2]
- Updated dependencies [5032ae2]
- Updated dependencies [2465ce7]
  - @kekonic/diagrams@1.0.0-rc.1
  - @kekonic/diagrams-element@1.0.0-rc.1
