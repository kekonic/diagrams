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

Add a `sketch` render option and `kdiagrams render --sketch`. Relationship strokes, sequence lifelines, and shape outlines use a deterministic hand-drawn centerline. Fill follows the same contour as the stroke. Dashes, arrowheads, labels, and markers stay precise. Sequence `render` blocks now honor `sketch`, `shadows`, and `roundedCorners`.

Studio's Sketch control writes `render { sketch: true }` for diagrams, sequences, and every model view. `<k-diagram>` and `KDiagramLive` accept a `sketch` attribute and show a toolbar control. Docs show the precise and hand-drawn looks side by side.
