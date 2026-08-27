---
"@kekonic/diagrams-layout": minor
"@kekonic/diagrams-render-svg": minor
"@kekonic/diagrams-theme": minor
"@kekonic/diagrams-core": patch
"@kekonic/diagrams": minor
"@kekonic/diagrams-agents": minor
"@kekonic/diagrams-element": patch
"@kekonic/diagrams-ui": patch
"@kekonic/diagrams-website": patch
---

True swimlanes and a DDD example suite.

- Top-level `swimlane` groups infer `groupLayout: swimlane` and `direction: LR`. ELK ranks every member on a shared left-to-right timeline (flattened, not nested compounds); bands then pack in declaration order with no gap, shared width, and a left header strip. Header titles inset from the divider and wrap. Chrome is the header strip plus a hairline between bands — not a dashed box around each lane. Ordinary groups keep a dashed outline with no fill, so nested boxes do not stack washes on the canvas.
- Flagship workflow: `examples/expense-approval.kdiagram`. Refund stays owner columns, not swimlanes.
- DDD dogfood: event storming, context mapping, and Order aggregate design on the shared commerce story, with named animations and semantic styles.
