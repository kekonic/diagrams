# Brief: Commerce context map

## Reader and question

**Audience:** Teams that own catalog, ordering, payments, or fulfillment.

**Question:** How do the commerce bounded contexts relate, and who is upstream of whom?

**When appropriate:** A DDD **context map**. Distinct from C4 system context (`storefront-model`) — this picture is about relationship _patterns_ between contexts, not people and external software systems.

## Facts (established)

- Identity publishes customer ids that Ordering consumes.
- Ordering takes a product snapshot from Catalog through an anticorruption layer rather than sharing Catalog’s model.
- Ordering is customer of Payments for authorization; Payments reports results that Ordering conforms to.
- Fulfillment consumes Ordering’s `OrderPlaced` contract (open-host) and reports reservation results.

## Assumptions

- Five contexts are enough to teach the map; marketing, tax, and search are omitted.
- Edge labels use plain language first, pattern names second.

## Intentional omissions

- Formal context-map DSL / relationship operators.
- Shared Kernel (none in this fiction).
- Team org chart vs context ownership.

## Layout / presentation policy

- LR compound boundaries; spacious; group accents on; orthogonal.
- Animation `Checkout integration` highlights Ordering ↔ Payments then Ordering → Fulfillment.
- No icons — context boxes and labeled relationships carry the meaning.
