---
"@kekonic/diagrams-studio": minor
"@kekonic/diagrams-cli": patch
"@kekonic/diagrams-core": patch
"@kekonic/diagrams-icons": patch
"@kekonic/diagrams-ui": patch
"@kekonic/diagrams": patch
"@kekonic/diagrams-website": patch
---

Make Studio the sole canonical authoring interface rather than retaining a parallel, reduced
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
