# @kekonic/diagrams-theme

## 1.0.0-rc.7

### Minor Changes

- 982f2c0: True swimlanes and a DDD example suite.

  - Top-level `swimlane` groups infer `groupLayout: swimlane` and `direction: LR`. ELK ranks every member on a shared left-to-right timeline (flattened, not nested compounds); bands then pack in declaration order with no gap, shared width, and a left header strip. Header titles inset from the divider and wrap. Chrome is the header strip plus a hairline between bands — not a dashed box around each lane. Ordinary groups keep a dashed outline with no fill, so nested boxes do not stack washes on the canvas.
  - Flagship workflow: `examples/expense-approval.kdiagram`. Refund stays owner columns, not swimlanes.
  - DDD dogfood: event storming, context mapping, and Order aggregate design on the shared commerce story, with named animations and semantic styles.

### Patch Changes

- 982f2c0: Refresh brand assets and colors from the new Kekonic Diagrams logo.

  Wordmark, reverse wordmark, and symbol replace the old geometric K. The docs header uses the symbol; the homepage cinematic hero follows the site theme (color wordmark in light, reverse in dark) instead of forcing a dark stage under a light header. Chrome and diagram accents now use the logo purple (OKLCH hue 301), with gold warning nudged to the mark. Semantic `on-*` title tokens contrast against success, warning, danger, and muted fills.

- 982f2c0: Let inline SVG inherit the host light/dark theme. Unthemed `.k-diagram` no longer locks to dark tokens, and `theme: "auto"` omits snapshot lock attributes.
- 982f2c0: Show a registered custom theme with rounded corners and shadows on the Themes docs page. Snapshot token CSS targets the stamped SVG so sibling inline diagrams keep their own palette.
- Updated dependencies [50ecddf]
- Updated dependencies [982f2c0]
- Updated dependencies [982f2c0]
  - @kekonic/diagrams-core@1.0.0-rc.7

## 1.0.0-rc.6

### Patch Changes

- 981712f: Give C4 Context, Container, and Component distinct type names and separate example views of the same commerce platform — instead of a mixed-level “boxes labeled container” toy. Presentation stays on the Kekonic Diagrams theme; C4 does not require Structurizr’s palette.
- 981712f: Make ERD tables a usable schema surface: parameterized types, inferred 1:1 and identifying relationships, composite keys, multi-FK fan-out, table notes, and crow’s-foot docs and examples that match what the pipeline actually draws.
- Updated dependencies [981712f]
- Updated dependencies [981712f]
- Updated dependencies [981712f]
- Updated dependencies [981712f]
- Updated dependencies [981712f]
  - @kekonic/diagrams-core@1.0.0-rc.6

## 1.0.0-rc.5

### Patch Changes

- Updated dependencies [7a35d7a]
  - @kekonic/diagrams-core@1.0.0-rc.5

## 1.0.0-rc.4

### Patch Changes

- Updated dependencies [1d5519f]
  - @kekonic/diagrams-core@1.0.0-rc.4

## 1.0.0-rc.3

### Minor Changes

- e7a2d1f: Harden the final release candidate across delivery, tooling, and documentation.

  - Load only requested Iconify glyphs in browsers while preserving the complete installed collections for Node and CLI rendering.
  - Split the lightweight React live renderer from playground and Shiki entry points, and add copy/download playground actions.
  - Add strict CLI flag handling, stdin and JSON diagnostics, version output, browser bundle budgets, and representative SVG regression snapshots.
  - Scope snapshot theme tokens to inline SVGs, improve package metadata and compatibility declarations, and expand the product, quick-start, comparison, CLI, API, icon, and embedding documentation.

- d12b18d: Add first-class sequence diagrams: top-level `sequence { … }` DSL, SequenceIR compile path, dedicated `sequence-v1` time-axis layout (lifelines, activations, fragments, notes), SVG paint + theme tokens, return op `-->`, and auto message-walk animation. Includes Temporal order-workflow sequence twin in examples/gallery.

### Patch Changes

- 982bd4c: Make CLI SVG exports portable theme snapshots by default, with discoverable JSON project config,
  named themes and export profiles, explicit live-theme output, background and print controls, and
  optional bundled-font embedding.

  Stabilize CLI automation and terminal contracts with versioned JSON envelopes, distinct exit codes,
  quiet/verbose/debug and color modes, real EPIPE handling, rich source-frame diagnostics, command and
  option suggestions, shell completions, and environment diagnostics. Add reviewed Homebrew formula
  generation and CI publication to the Kekonic tap for stable releases.

- Updated dependencies [8fd0c2b]
- Updated dependencies [e7a2d1f]
- Updated dependencies [d12b18d]
- Updated dependencies [2618a95]
- Updated dependencies [982bd4c]
  - @kekonic/diagrams-core@1.0.0-rc.3

## 1.0.0-rc.2

### Minor Changes

- 27349fb: Add diagram animations: opt-in Automatic via empty named `animation` blocks (exclusive chapters vs parallel fan-out; `dim *` clears sticky highlights between chapters), authored cue scripts (including `parallel`), an SVG player on RenderController (`setSpeed`, `subscribe`, …), and Lit/React controls (picker, scrubber, 0.5×–2× speed). Diagrams stay static until an animation is declared.

### Patch Changes

- Updated dependencies [27349fb]
- Updated dependencies [27349fb]
  - @kekonic/diagrams-core@1.0.0-rc.2

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
- Updated dependencies [2465ce7]
  - @kekonic/diagrams-core@1.0.0-rc.1
