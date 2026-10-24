# Brief: Checkout choreography

## Reader and question

**Audience:** Someone deciding whether checkout needs an orchestrator.

**Question:** How does an order get confirmed when inventory and payments each publish their own result?

**When appropriate:** Multi-hop choreography after a transactional outbox. Keep `PaymentFailed` on the compensation diagram.

## Facts

- Orders commits the order and an outbox row together. The relay publishes `OrderPlaced`.
- Inventory publishes `StockReserved`. Payments publishes `PaymentCaptured`.
- Confirm waits for both results, then publishes `OrderConfirmed` for notifications.

## Assumptions

- Confirm is an Orders policy, not a separate saga product.
- Each result is its own topic.

## Intentional omissions

- `PaymentFailed` and `ReleaseStock`.
- Retry schedules.

## Layout / presentation policy

- Left to right: Place, publish, the two collaborators, confirm.
- Compact, metro, `groupAccent: false`.
