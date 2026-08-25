---
"@kekonic/diagrams": minor
"@kekonic/diagrams-core": minor
"@kekonic/diagrams-routing": minor
"@kekonic/diagrams-render-svg": minor
"@kekonic/diagrams-language-service": patch
"@kekonic/diagrams-studio": patch
"@kekonic/diagrams-website": patch
---

Make `route: straight` and `route: bezier` real path styles: straight uses a port-to-port chord when the line of sight is clear (otherwise a short corridor dogleg), and bezier is an obstacle-aware cubic that follows layout ports instead of a naive center-to-center curve.
