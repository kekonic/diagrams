# Brief: Checkout choreography — interaction

## Reader and question

**Audience:** Someone who needs the order of messages, not the topic topology.

**Question:** In what order do `OrderPlaced`, the two results, and `OrderConfirmed` happen?

**When appropriate:** Interaction view of the choreography map. One log stands in for the separate topics.

## Facts

- Orders publishes `OrderPlaced` first. The payload excerpt shows `orderId` and `amount`.
- Inventory and Payments handle that event in parallel and publish their results.
- Orders publishes `OrderConfirmed` only after both results are back. Notifications receives it.

## Assumptions

- Happy path only.
- The sequence collapses `StockReserved` and `PaymentCaptured` onto `orders.v1`.

## Intentional omissions

- Outbox relay.
- `PaymentFailed`.

## Layout / presentation policy

- Sequence with autonumber, one parallel fragment, and a payload on the first publish.
