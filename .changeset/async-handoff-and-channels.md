---
"@kekonic/diagrams": minor
"@kekonic/diagrams-core": minor
"@kekonic/diagrams-render-svg": minor
"@kekonic/diagrams-theme": minor
"@kekonic/diagrams-import-plantuml": minor
"@kekonic/diagrams-agents": minor
"@kekonic/diagrams-website": minor
---

Asynchronous handoff (`=>`) and eventual observation (`~>`) stay distinct on flow diagrams and sequences. A flow handoff is dashed and an eventual observation is dotted. On a sequence, a handoff stays a solid open head and an eventual signal is dotted; a reply is still the dashed shaft. Sequence `=>` edges are kind `async`. Pub/sub is a `topic` or `stream`, and point-to-point is a `queue`; the channel can be omitted when it is not the question. PlantUML `->>` imports as `=>`.
