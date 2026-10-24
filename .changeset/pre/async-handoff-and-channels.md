---
"@kekonic/diagrams": minor
"@kekonic/diagrams-core": minor
"@kekonic/diagrams-render-svg": minor
"@kekonic/diagrams-theme": minor
"@kekonic/diagrams-import-plantuml": minor
"@kekonic/diagrams-agents": minor
"@kekonic/diagrams-website": minor
---

Asynchronous handoff (`=>`) and eventual observation (`~>`) stay distinct on flow diagrams and sequences, and both use an open arrowhead. A call (`->`) keeps the filled head. A flow handoff is a dashed open arrow and an eventual observation is a dotted open arrow. On a sequence, a handoff stays a solid open head and an eventual signal is dotted; a reply is still the dashed shaft. Sequence `=>` edges are kind `async`. Pub/sub is a `topic` or `stream`, and point-to-point is a `queue`; the channel can be omitted when it is not the question. PlantUML `->>` imports as `=>`.

The gallery adds commerce examples for choreography, orchestration, compensation, delivery guarantees, inbox and outbox, topic fan-out to queues, competing consumers, exchange routing, partitioned logs, change data capture, claim check, and inbound and outbound webhooks.
