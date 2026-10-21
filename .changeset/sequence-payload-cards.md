---
"@kekonic/diagrams": minor
"@kekonic/diagrams-core": minor
"@kekonic/diagrams-layout": minor
"@kekonic/diagrams-render-svg": minor
"@kekonic/diagrams-theme": minor
"@kekonic/diagrams-website": minor
"@kekonic/diagrams-agents": minor
---

Sequence messages can carry a short `payload` excerpt, such as the JSON fields on an HTTP call or an async event. Write the excerpt between `"""` quotes so its own quotes need no escaping. The label stays the call or event name. The excerpt is painted as a card under the arrow, keeping the author's line breaks, with an accent for a call, an async event, a reply, or a failure. Excerpts longer than six lines warn and shorten. Async sequence messages stay solid; the open head is what marks them.
