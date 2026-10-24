# Brief: Checkout orchestration — interaction

## Reader and question

**Audience:** Someone checking that charge does not start early.

**Question:** When does `ChargeCard` start relative to `StockReserved`?

**When appropriate:** Command and reply order. The queues stay on the orchestration map.

## Facts

- The saga sends `ReserveStock`, receives `StockReserved`, then sends `ChargeCard`.
- `PaymentCaptured` returns to the saga before the order is marked confirmed.
- There is no parallel fragment.

## Assumptions

- The saga waits for each reply.

## Intentional omissions

- Queue and reply-topic lifelines.
- Compensation.

## Layout / presentation policy

- Sequence with autonumber and a saga activation.
