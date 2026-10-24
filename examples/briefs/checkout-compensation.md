# Brief: Payment compensation

## Reader and question

**Audience:** Someone tracing a failed capture.

**Question:** What happens after payment capture fails?

**When appropriate:** The failure hop that the choreography map leaves out.

## Facts

- Payments records the failure and an outbox row, then the relay publishes `PaymentFailed`.
- Orders handles that event by sending `ReleaseStock` on a queue.
- Inventory releases the reservation. One worker will take that command.

## Assumptions

- `ReleaseStock` is point-to-point.
- Payments publishes from an outbox, same as Orders on the happy path.

## Intentional omissions

- Refund settlement.
- Customer notification.

## Layout / presentation policy

- Left to right: Payments, the event, Orders, Inventory.
- Compact, metro, `groupAccent: false`.
