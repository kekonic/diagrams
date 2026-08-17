# Brief: Order fulfillment — review slide

## Reader and question

**Audience:** Design review / architecture review attendees.

**Question:** Same as order fulfillment — what happens after checkout? — presented with review chrome and named animation stories.

**When appropriate:** Presentation / review export of an already-correct architecture graph. Do not invent a second topology.

## Facts

Identical to `order-fulfillment` brief.

## Assumptions

- Topology matches `order-fulfillment.kdiagram`; differentiation is presentation chrome (`theme: light`, metro routing, slightly roomier spacingScale).
- Portable SVG for slides; interactive hosts expose animation playback.

## Intentional omissions

Same as fulfillment. No extra systems for “slide drama.”

## Layout / presentation policy

- Same semantic graph and 3×2 composition grid as fulfillment.
- `groupAccent: false`; light theme; metro + smart crossings.
- Keep the two named animations from the fulfillment exemplar.
