---
"@kekonic/diagrams-studio": minor
"@kekonic/diagrams-cli": minor
"@kekonic/diagrams-website": patch
---

Add a published browser-safe Studio protocol, stale-render coordinator, state reducer, and shared
presentation controls, and migrate the established authoring UI into that host-neutral contract.

Add `kdiagrams studio` with an offline Monaco browser host, live watched previews and diagnostics,
graph inspection, source-range and graph-element selection, layout/theme controls, SVG export, and
explicitly authorized saves. The local adapter binds to loopback, authenticates each session with an
unguessable token, and scopes file access to resolved inputs.
