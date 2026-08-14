# Brief: Order fulfillment — interaction

## Reader and question

**Audience:** Developers debugging checkout → publish → consumer timing.

**Question:** In what order do checkout, outbox publish, and consumers interact?

**When appropriate:** Sequence / interaction timing for the fulfillment path. Not an orchestrator product demo.

## Facts

Same commerce path as `order-fulfillment`, told as messages over time.

## Assumptions

- No Temporal or other orchestrator product.

## Intentional omissions

- Hexagon internals.
- Exact retry backoff.

## Layout / presentation policy

- Sequence with autonumber; parallel inventory/notifications; DLQ divider.
- Keep the participant set tight (no separate storefront/email lanes) so the canvas stays nearer reading width.
- Quiet icons; `groupAccent: false`.
- Named animations aligned with the fulfillment map.
