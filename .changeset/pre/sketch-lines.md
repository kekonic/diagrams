---
"@kekonic/diagrams": patch
"@kekonic/diagrams-core": patch
"@kekonic/diagrams-render-svg": patch
"@kekonic/diagrams-cli": patch
"@kekonic/diagrams-element": patch
"@kekonic/diagrams-ui": patch
"@kekonic/diagrams-studio": patch
"@kekonic/diagrams-website": patch
---

Add a `sketch` render option and `kdiagrams render --sketch`. Relationship strokes and sequence lifelines use a deterministic hand-drawn centerline. Dashes, arrowheads, labels, and node shells stay on the routed geometry. Sequence `render` blocks now honor `sketch`, `shadows`, and `roundedCorners`.

Studio's Sketch control writes `render { sketch: true }` for diagrams, sequences, and every model view. `<k-diagram>` and `KDiagramLive` accept a `sketch` attribute and show a toolbar control. Docs show the precise and hand-drawn looks side by side.
