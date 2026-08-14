# Brief: Order lifecycle

## Reader and question

**Audience:** Developers implementing order status transitions.

**Question:** Which order statuses are legal and which transitions move between them?

**When appropriate:** First-class state diagram for lifecycle legality.

## Facts

- Entry → Placed; approve → Authorized; decline → Abandoned.
- In stock → Reserved; ship → Shipped; cancel from Authorized/Reserved → Cancelled.

## Assumptions

- Guards in labels are illustrative.
- Ship completes fulfillment without modeling warehouse scans.

## Intentional omissions

- Refund lifecycle.
- Fraud review queues.

## Layout / presentation policy

- First-class `state` surface; LR compact; restrained styles on key states.
- Short everyday labels; no draft chrome.
