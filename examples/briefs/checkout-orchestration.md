# Brief: Checkout orchestration

## Reader and question

**Audience:** Someone comparing a saga with the choreography map.

**Question:** Where is the order of reserve and charge decided?

**When appropriate:** A process manager that sends commands and waits for replies.

## Facts

- Checkout starts the saga with `PlaceOrder`. The saga stores a step cursor.
- `ReserveStock` and `ChargeCard` are separate queues. `ChargeCard` is not sent in parallel.
- Workers reply on `order.replies` with a correlation id. The saga then marks the order confirmed.

## Assumptions

- `StockReserved` arrives before `ChargeCard` is sent.
- Replies share one topic.

## Intentional omissions

- Compensation commands.
- Queue depth and retry timers.

## Layout / presentation policy

- Left to right: saga, pipes, workers. Reply edges return to the saga.
- Compact, metro, `groupAccent: false`.
