# Domain-driven design views

Pick one DDD question. Do not mix an event storm, a context map, and an aggregate on one canvas.

## Event storming

Use when the reader needs the domain timeline: commands, domain events (past tense), aggregates,
policies, and people. Walk left to right. Phase groups are facilitation columns, not bounded
contexts. Do not invent a second sticky-note color system — kinds already distinguish the stickies.

Prefer `examples/order-event-storm.kdiagram`. Do not reuse `order-placed-events` (runtime fan-out)
or `order-fulfillment` (container/event map) as a storm.

## Context mapping

Use when the reader needs relationship _patterns_ between bounded contexts. Draw each context as a
`boundary`. Label edges in plain language first (`Authorize charge — customer / supplier`), not
`U/D` or `OHS` alone.

Prefer `examples/commerce-context-map.kdiagram`. That is not a C4 system context
(`storefront-model`).

## Aggregate design

Use when the reader needs the consistency boundary of one aggregate: the command that mutates the
root, entities that cannot persist outside it, value objects (muted cards), and the invariant the
root protects.

Prefer `examples/order-aggregate.kdiagram`. Do not rewrite `order-hexagon` (ports and adapters) into
this view.

## Quality bar

Every DDD example should include a named animation that teaches a real path, skip icons that only
restate kind or shape, and use semantic styles where outcomes matter.
