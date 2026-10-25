---
"@kekonic/diagrams": patch
"@kekonic/diagrams-core": patch
"@kekonic/diagrams-render-svg": patch
"@kekonic/diagrams-cli": patch
"@kekonic/diagrams-website": patch
---

Add a `sketch` render option and `kdiagrams render --sketch`. Relationship strokes and sequence lifelines use a deterministic hand-drawn centerline. Dashes, arrowheads, labels, and node shells stay on the routed geometry. Sequence `render` blocks now honor `sketch`, `shadows`, and `roundedCorners`.
