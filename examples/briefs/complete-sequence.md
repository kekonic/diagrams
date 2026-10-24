# Brief: Checkout payment

## Reader and question

**Audience:** Developers checking that a sequence can carry a full interaction, not a three-message sketch.

**Question:** How do authorize, capture, decline, and a short-lived shipment show up on one timeline?

**When appropriate:** A complete sequence specimen — participants, replies, fragments, notes, and lifecycle. Not the default shape for a small design review.

## Facts

Checkout authorizes a hold, captures or voids it, then hands a temporary shipment to the carrier.

## Assumptions

- The cart id is the idempotency key.
- Both the captured and declined branches are drawn; a sequence shows the alternatives together.

## Intentional omissions

- Refunds after 201.
- Retry backoff timing.

## Layout / presentation policy

- Autonumber on.
- Fragments stay on the participants they mention.
- `create` / `destroy` are the only reason Shipment exists.
- `Funds captured` and `Declined` each walk one path. A flow cue quotes the message label when several arrows share the same participants.
