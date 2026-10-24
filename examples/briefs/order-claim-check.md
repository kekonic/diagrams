# Brief: Claim check

## Reader and question

**Audience:** Someone who cannot put the order body on the topic.

**Question:** Where is the order body when the event only carries an id?

**When appropriate:** Claim check. The topic is the pointer. The bucket is the body.

## Facts

- Orders stores the body, then publishes `OrderPlaced` with the id only.
- Inventory receives the event and reads the body from the bucket.

## Assumptions

- The topic payload is the order id.
- The read happens after the event arrives.

## Intentional omissions

- Signed URL expiry.
- Body encryption.

## Layout / presentation policy

- Left to right: store, event, inventory. The body read returns to the bucket.
- Compact, metro, `groupAccent: false`.
