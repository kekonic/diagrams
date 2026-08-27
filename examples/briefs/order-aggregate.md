# Brief: Order aggregate design

## Reader and question

**Audience:** Developers implementing PlaceOrder inside the Ordering context.

**Question:** What sits inside the Order aggregate, and what must stay consistent in one transaction?

**When appropriate:** A DDD **aggregate design** view — root, entities, value-object-ish cards, and an invariant. Distinct from `order-hexagon` (ports and adapters) and from C4 components (`storefront-model` components view).

## Facts (established)

- `PlaceOrder` mutates the Order root.
- Order lines cannot persist outside the aggregate.
- Money is a value object (muted); it is not an aggregate.
- Lines must share the order currency.
- A successful place emits `OrderPlaced`.

## Assumptions

- One aggregate is the useful zoom; customer and catalog entities live in other contexts.
- Kekonic Diagrams has no first-class value-object kind — a muted `entity` plus description states the role.

## Intentional omissions

- Repository / unit-of-work wiring.
- Full invariant list (stock, payment, address).
- Event sourcing internals.

## Layout / presentation policy

- LR command → aggregate boundary → outgoing event; compact; orthogonal; kind subtitles on.
- `info` on `OrderPlaced`; muted on Money.
- No icons.
- Animation `PlaceOrder` focuses the command that mutates the root.
