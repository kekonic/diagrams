# @kekonic/diagrams-routing

## 1.0.0-rc.6

### Minor Changes

- 981712f: Give `route: metro` (the default), `rounded`, and `bezier` natural curves: ease out of the source port, ease into the target, and treat each obstacle jog as its own curved section. `route: orthogonal` stays a sharp polyline.
- 981712f: Make `route: straight` and `route: bezier` real path styles: straight uses a port-to-port chord when the line of sight is clear (otherwise a short corridor dogleg), and bezier is an obstacle-aware cubic that follows layout ports instead of a naive center-to-center curve.

### Patch Changes

- 981712f: Stop arrowheads from piercing node fills: trim dependency (`..>`) and start/both arrows by the marker length, and shorten short last stubs along the full path so tips sit on the outer stroke.
- Updated dependencies [981712f]
- Updated dependencies [981712f]
- Updated dependencies [981712f]
- Updated dependencies [981712f]
- Updated dependencies [981712f]
  - @kekonic/diagrams-core@1.0.0-rc.6
  - @kekonic/diagrams-layout@1.0.0-rc.6
  - @kekonic/diagrams-geometry@1.0.0-rc.6

## 1.0.0-rc.5

### Patch Changes

- Updated dependencies [7a35d7a]
  - @kekonic/diagrams-core@1.0.0-rc.5
  - @kekonic/diagrams-geometry@1.0.0-rc.5
  - @kekonic/diagrams-layout@1.0.0-rc.5

## 1.0.0-rc.4

### Patch Changes

- Updated dependencies [1d5519f]
  - @kekonic/diagrams-core@1.0.0-rc.4
  - @kekonic/diagrams-layout@1.0.0-rc.4
  - @kekonic/diagrams-geometry@1.0.0-rc.4

## 1.0.0-rc.3

### Minor Changes

- e7a2d1f: Harden the final release candidate across delivery, tooling, and documentation.

  - Load only requested Iconify glyphs in browsers while preserving the complete installed collections for Node and CLI rendering.
  - Split the lightweight React live renderer from playground and Shiki entry points, and add copy/download playground actions.
  - Add strict CLI flag handling, stdin and JSON diagnostics, version output, browser bundle budgets, and representative SVG regression snapshots.
  - Scope snapshot theme tokens to inline SVGs, improve package metadata and compatibility declarations, and expand the product, quick-start, comparison, CLI, API, icon, and embedding documentation.

- d12b18d: Add first-class sequence diagrams: top-level `sequence { … }` DSL, SequenceIR compile path, dedicated `sequence-v1` time-axis layout (lifelines, activations, fragments, notes), SVG paint + theme tokens, return op `-->`, and auto message-walk animation. Includes Temporal order-workflow sequence twin in examples/gallery.

### Patch Changes

- Updated dependencies [8fd0c2b]
- Updated dependencies [e7a2d1f]
- Updated dependencies [d12b18d]
- Updated dependencies [2618a95]
- Updated dependencies [982bd4c]
  - @kekonic/diagrams-core@1.0.0-rc.3
  - @kekonic/diagrams-geometry@1.0.0-rc.3
  - @kekonic/diagrams-layout@1.0.0-rc.3

## 1.0.0-rc.2

### Minor Changes

- 27349fb: Add diagram animations: opt-in Automatic via empty named `animation` blocks (exclusive chapters vs parallel fan-out; `dim *` clears sticky highlights between chapters), authored cue scripts (including `parallel`), an SVG player on RenderController (`setSpeed`, `subscribe`, …), and Lit/React controls (picker, scrubber, 0.5×–2× speed). Diagrams stay static until an animation is declared.

### Patch Changes

- Updated dependencies [27349fb]
- Updated dependencies [27349fb]
  - @kekonic/diagrams-core@1.0.0-rc.2
  - @kekonic/diagrams-geometry@1.0.0-rc.2
  - @kekonic/diagrams-layout@1.0.0-rc.2

## 1.0.0-rc.1

### Minor Changes

- 5032ae2: Polish the DSL before stable: EdgeKind sync/async/eventual/association, soft keywords, concrete spacing, trimmed presentation chrome, and Shiki/lexer parity.

### Patch Changes

- 2465ce7: Add Changesets, Conventional Commits, CI/release workflows, Dependabot, and contributing docs.
  Keep guide docs evergreen (versions live in CHANGELOG / package metadata).
  One product version across publishable packages and the private website app.
- Updated dependencies [5032ae2]
- Updated dependencies [2465ce7]
  - @kekonic/diagrams-core@1.0.0-rc.1
  - @kekonic/diagrams-geometry@1.0.0-rc.1
  - @kekonic/diagrams-layout@1.0.0-rc.1
