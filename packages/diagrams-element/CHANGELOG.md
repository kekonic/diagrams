# @kekonic/diagrams-element

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

- 982f2c0: Refresh brand assets and colors from the new Kekonic Diagrams logo.
  
  Wordmark, reverse wordmark, and symbol replace the old geometric K. The docs header uses the symbol; the homepage cinematic hero follows the site theme (color wordmark in light, reverse in dark) instead of forcing a dark stage under a light header. Chrome and diagram accents now use the logo purple (OKLCH hue 301), with gold warning nudged to the mark. Semantic `on-*` title tokens contrast against success, warning, danger, and muted fills.
- 982f2c0: True swimlanes and a DDD example suite.
  
  - Top-level `swimlane` groups infer `groupLayout: swimlane` and `direction: LR`. ELK ranks every member on a shared left-to-right timeline (flattened, not nested compounds); bands then pack in declaration order with no gap, shared width, and a left header strip. Header titles inset from the divider and wrap. Chrome is the header strip plus a hairline between bands — not a dashed box around each lane. Ordinary groups keep a dashed outline with no fill, so nested boxes do not stack washes on the canvas.
  - Flagship workflow: `examples/expense-approval.kdiagram`. Refund stays owner columns, not swimlanes.
  - DDD dogfood: event storming, context mapping, and Order aggregate design on the shared commerce story, with named animations and semantic styles.
- Updated dependencies [982f2c0]
- Updated dependencies [50ecddf]
- Updated dependencies [982f2c0]
- Updated dependencies [982f2c0]
- Updated dependencies [982f2c0]
  - @kekonic/diagrams@1.0.0-rc.7
  - @kekonic/diagrams-core@1.0.0-rc.7

## 1.0.0-rc.6

### Patch Changes

- 981712f: Stop live diagram embeds from trapping page scroll: unmodified wheel now scrolls the page, and zoom requires Ctrl/⌘ + scroll (trackpad pinch still zooms). Dedicated canvases such as Studio preview can opt back into wheel-zoom with `zoomOnWheel: "always"`.
- Updated dependencies [981712f]
- Updated dependencies [981712f]
- Updated dependencies [981712f]
- Updated dependencies [981712f]
- Updated dependencies [981712f]
- Updated dependencies [981712f]
  - @kekonic/diagrams@1.0.0-rc.6

## 1.0.0-rc.5

### Patch Changes

- Updated dependencies [7a35d7a]
- Updated dependencies [7a35d7a]
  - @kekonic/diagrams@1.0.0-rc.5

## 1.0.0-rc.4

### Patch Changes

- Updated dependencies [1d5519f]
  - @kekonic/diagrams@1.0.0-rc.4

## 1.0.0-rc.3

### Minor Changes

- e7a2d1f: Harden the final release candidate across delivery, tooling, and documentation.

  - Load only requested Iconify glyphs in browsers while preserving the complete installed collections for Node and CLI rendering.
  - Split the lightweight React live renderer from playground and Shiki entry points, and add copy/download playground actions.
  - Add strict CLI flag handling, stdin and JSON diagnostics, version output, browser bundle budgets, and representative SVG regression snapshots.
  - Scope snapshot theme tokens to inline SVGs, improve package metadata and compatibility declarations, and expand the product, quick-start, comparison, CLI, API, icon, and embedding documentation.

- d12b18d: Add first-class sequence diagrams: top-level `sequence { … }` DSL, SequenceIR compile path, dedicated `sequence-v1` time-axis layout (lifelines, activations, fragments, notes), SVG paint + theme tokens, return op `-->`, and auto message-walk animation. Includes Temporal order-workflow sequence twin in examples/gallery.

### Patch Changes

- e7a2d1f: Rebuild the documentation around reader outcomes with a new learning path, task-based design and publishing guides, consolidated reference material, honest adoption guidance, troubleshooting, and redirects from the previous structure.

  Allow editable playgrounds to select, autoplay, loop, and show controls for authored diagram animations.

  Add a frameless live-embed mode that removes the host border and panel background without changing
  control behavior.

- Updated dependencies [8fd0c2b]
- Updated dependencies [e7a2d1f]
- Updated dependencies [d12b18d]
- Updated dependencies [2618a95]
  - @kekonic/diagrams@1.0.0-rc.3

## 1.0.0-rc.2

### Minor Changes

- 27349fb: Add diagram animations: opt-in Automatic via empty named `animation` blocks (exclusive chapters vs parallel fan-out; `dim *` clears sticky highlights between chapters), authored cue scripts (including `parallel`), an SVG player on RenderController (`setSpeed`, `subscribe`, …), and Lit/React controls (picker, scrubber, 0.5×–2× speed). Diagrams stay static until an animation is declared.

### Patch Changes

- Updated dependencies [27349fb]
- Updated dependencies [27349fb]
  - @kekonic/diagrams@1.0.0-rc.2

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
