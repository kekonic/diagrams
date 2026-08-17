# Brief: Order fulfillment (container / event map)

## Reader and question

**Audience:** Developers joining the commerce platform.

**Question:** What happens after a customer places an order — from checkout through durable event publication to fulfillment and email?

**When appropriate:** Container-level architecture with ownership bands and sync vs event edges. Prefer this over sequence when ownership and integration structure matter more than exact timing.

## Facts (established)

- Browser storefront and Checkout API handle checkout.
- Order service owns order placement; Orders DB holds orders and the transactional outbox.
- Outbox relay publishes committed events to topic `orders.v1`.
- Stripe authorizes card payment (synchronous from the order service); Stripe sits beside Ordering, not inside it.
- Inventory service consumes `OrderPlaced`, reserves stock in Inventory DB, then releases a pick request to an external warehouse.
- Notification worker consumes `OrderPlaced` and sends confirmation via an external email provider.
- Exhausted delivery retries land in an order-event DLQ.
- Visible ownership regions: Digital experience, Ordering, Events, Fulfillment, Communications.

## Assumptions

- One commerce company; fictional but consistent across the corpus.
- Retry timing and operator replay are out of scope; only the DLQ destination is shown.
- Event bus is shown as a topic with a quiet icon, not a vendor wordmark.

## Intentional omissions

- Refunds, cancellations, shipment tracking.
- Partitions, consumer groups, deployment topology.
- Orchestrator products.
- Class-level internals (see `order-hexagon`).

## Layout / presentation policy

- Chromeless 3×2 composition grid (skill exemplar pattern) so peer regions keep content-sized boxes instead of equal-height empty columns.
- Compact density; `groupAccent: false`; orthogonal edges.
- Edge ops: `->` for direct work, `=>` for events.
- Styles: restrained `info` on order service / topic; muted on secondary externals; warning on DLQ.
- Animations: “Order accepted” and “Delivery retries exhausted”.

## Provenance

Promoted from the published `design-kekonic-diagrams` skill exemplar. Source of truth for the gallery is `examples/order-fulfillment.kdiagram`; the skill package keeps a matching copy.
