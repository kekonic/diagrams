---
"@kekonic/diagrams": patch
"@kekonic/diagrams-core": patch
"@kekonic/diagrams-element": patch
"@kekonic/diagrams-studio": patch
"@kekonic/diagrams-ui": patch
"@kekonic/diagrams-website": patch
---

Stop live diagram embeds from trapping page scroll: unmodified wheel now scrolls the page, and zoom requires Ctrl/⌘ + scroll (trackpad pinch still zooms). Dedicated canvases such as Studio preview can opt back into wheel-zoom with `zoomOnWheel: "always"`.
