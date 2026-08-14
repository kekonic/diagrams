# Brief: OrderPlaced — event consumers

## Reader and question

**Audience:** Developers owning inventory or notifications, or operating the outbox.

**Question:** Who consumes `OrderPlaced`, and where do exhausted deliveries go?

**When appropriate:** Focused event fan-out after publish. Omit the full checkout path.

## Facts

- Outbox relay reads the orders outbox and publishes to `orders.v1`.
- Inventory and notification consumers handle `OrderPlaced`.
- Exhausted deliveries land in the order-event DLQ.

## Assumptions

- Publisher is shown as outbox relay + topic only (no Stripe / storefront).

## Intentional omissions

- Checkout path and payment authorization.
- Retry schedules and operator replay tooling.

## Layout / presentation policy

- Same 3×2 composition-grid pattern as fulfillment (Publish + Events on the lower row; Communications above Fulfillment); compact; `groupAccent: false`.
- Quiet topic icon (`radio-tower`); keep Warehouse beside Inventory DB.
- Named animations for fan-out and DLQ.
