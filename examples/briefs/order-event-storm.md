# Brief: Order domain event storm

## Reader and question

**Audience:** Domain experts and developers facilitating an event-storming session after the first pass.

**Question:** What happens in the commerce domain from browse through payment to fulfillment?

**When appropriate:** A DDD **event storming** discovery view — chronological commands, events, aggregates, and policies. Not a runtime topology (`order-placed-events`) and not hexagonal ports (`order-hexagon`).

## Facts (established)

- A shopper browses the catalog, then places an order.
- Order is the aggregate that records checkout.
- Payment must be authorized before the order is confirmed (`PaymentAuthorized` then `OrderPlaced`).
- Fulfillment reserves stock and releases a warehouse pick; reservation can fail.

## Assumptions

- Sticky-note colors are not a second theme; kinds (`command`, `event`, `aggregate`, `policy`, `person`) carry meaning.
- Phase groups (Browse / Checkout / Fulfill) are facilitation columns, not bounded contexts.

## Intentional omissions

- Full workshop sticky palette / Miro parity.
- Every exception path (fraud, cancel, refund).
- Message-bus topology.

## Layout / presentation policy

- LR row of chromed phase groups; compact; orthogonal; kind subtitles on.
- `info` on pivotal events (`CatalogShown`, `OrderPlaced`); `success` on authorized payment; `warning` on reservation failure.
- No redundant icons.
- Animation `Place order` walks browse → PlaceOrder → OrderPlaced.
