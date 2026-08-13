# @kekonic/diagrams-studio

Browser-safe synchronization primitives and the canonical KDiagram authoring interface. The
private development host launches this same Studio source tree; it is not a second application.

Studio provides the complete authoring experience: the split editor and live preview, diagnostics,
source-backed diagram settings, view controls, formatting, export, and responsive shell. Direction,
density, group layout, edge routing, and crossing changes made in the sidebar update the KDiagram
document itself so the DSL remains the source of truth. Clicking a rendered node reveals its source
declaration without interfering with drag-to-pan. Studio consumes the public KDiagram chrome token
contract, including sharp geometry, light/dark modes, typography, and focus treatment.

Most users should launch the supported authoring host through the CLI:

```bash
kdiagrams studio architecture.kdiagram
```

The same application is hosted at <https://diagrams.kekonic.com/studio/>. Standalone Studio can
open `.kdiagram` files through the browser, save changes back through the File System Access API
when supported, and fall back to ordinary uploads/downloads elsewhere. It keeps a recovery draft in
local browser storage. Source saves remain distinct from SVG export.

The Share dialog produces an editable hosted-Studio link, a diagram-only iframe, web-component code
for applications that install KDiagram, and copyable SVG markup. Shared links encode source in the
URL fragment, so the document is not sent to the static web host or included in HTTP referrers.

The package API is for integrations that need the same versioned document, render, selection,
viewport, presentation, export, and save protocol without depending on a particular editor or
transport.

## Hosting the browser app

`dist/browser` is a relative-base production build, so it can be mounted at `/studio/`, nested
under a documentation site, or served from another subpath without rebuilding asset URLs. Studio
resolves its optional connection routes relative to that mount point. Without a CLI session token,
it opens in local example mode.

The default `<meta name="kdiagram-icon-api">` points to `./__kdiagram/icons`, the bounded endpoint
provided by the KDiagram CLI and development server. A different host can either implement the same
Iconify-compatible subset route or replace the meta value with its icon API base URL. If that URL is
cross-origin, the host must explicitly permit it in `connect-src`; Studio does not silently widen a
site's CSP.

The documentation host deliberately configures Iconify's public API because a static deployment
cannot resolve arbitrary user-selected collections on demand. CLI-launched Studio continues using
the bounded local endpoint and works without that external service.
