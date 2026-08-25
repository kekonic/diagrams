# @kekonic/diagrams-cli

## 1.0.0-rc.6

### Patch Changes

- Updated dependencies [981712f]
- Updated dependencies [981712f]
- Updated dependencies [981712f]
- Updated dependencies [981712f]
- Updated dependencies [981712f]
- Updated dependencies [981712f]
- Updated dependencies [981712f]
  - @kekonic/diagrams@1.0.0-rc.6
  - @kekonic/diagrams-studio@1.0.0-rc.6
  - @kekonic/diagrams-language-service@1.0.0-rc.6
  - @kekonic/diagrams-icons@1.0.0-rc.6

## 1.0.0-rc.5

### Patch Changes

- Updated dependencies [7a35d7a]
- Updated dependencies [7a35d7a]
  - @kekonic/diagrams@1.0.0-rc.5
  - @kekonic/diagrams-studio@1.0.0-rc.5
  - @kekonic/diagrams-language-service@1.0.0-rc.5
  - @kekonic/diagrams-icons@1.0.0-rc.5

## 1.0.0-rc.4

### Patch Changes

- Updated dependencies [1d5519f]
  - @kekonic/diagrams-language-service@1.0.0-rc.4
  - @kekonic/diagrams@1.0.0-rc.4
  - @kekonic/diagrams-studio@1.0.0-rc.4
  - @kekonic/diagrams-icons@1.0.0-rc.4

## 1.0.0-rc.3

### Minor Changes

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

- e7a2d1f: Harden the final release candidate across delivery, tooling, and documentation.

  - Load only requested Iconify glyphs in browsers while preserving the complete installed collections for Node and CLI rendering.
  - Split the lightweight React live renderer from playground and Shiki entry points, and add copy/download playground actions.
  - Add strict CLI flag handling, stdin and JSON diagnostics, version output, browser bundle budgets, and representative SVG regression snapshots.
  - Scope snapshot theme tokens to inline SVGs, improve package metadata and compatibility declarations, and expand the product, quick-start, comparison, CLI, API, icon, and embedding documentation.

- 6507282: Add predictable batch input discovery for files, directories, globs, ignore rules, path lists, and
  stdin, plus safe multi-file check, format, and structured render output workflows.
- d12b18d: Add first-class sequence diagrams: top-level `sequence { … }` DSL, SequenceIR compile path, dedicated `sequence-v1` time-axis layout (lifelines, activations, fragments, notes), SVG paint + theme tokens, return op `-->`, and auto message-walk animation. Includes Temporal order-workflow sequence twin in examples/gallery.
- 33971d5: Add the browser-compatible KDiagram language service, connect it to Studio's Monaco editor and CLI
  validation/formatting, and expose the same diagnostics, completion, navigation, refactoring,
  symbols, folding, semantic tokens, formatting, and code actions through `kdiagrams lsp --stdio`.
- 982bd4c: Make CLI SVG exports portable theme snapshots by default, with discoverable JSON project config,
  named themes and export profiles, explicit live-theme output, background and print controls, and
  optional bundled-font embedding.

  Stabilize CLI automation and terminal contracts with versioned JSON envelopes, distinct exit codes,
  quiet/verbose/debug and color modes, real EPIPE handling, rich source-frame diagnostics, command and
  option suggestions, shell completions, and environment diagnostics. Add reviewed Homebrew formula
  generation and CI publication to the Kekonic tap for stable releases.

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
- Updated dependencies [8fd0c2b]
- Updated dependencies [8873815]
- Updated dependencies [e7a2d1f]
- Updated dependencies [d12b18d]
- Updated dependencies [33971d5]
- Updated dependencies [2618a95]
  - @kekonic/diagrams@1.0.0-rc.3
  - @kekonic/diagrams-icons@1.0.0-rc.3
  - @kekonic/diagrams-studio@1.0.0-rc.3
  - @kekonic/diagrams-language-service@1.0.0-rc.3

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
