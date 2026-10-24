# Brief: Topic fan-out to queues

## Reader and question

**Audience:** Someone splitting one event across team-owned queues.

**Question:** How does one `OrderPlaced` become a private queue per team?

**When appropriate:** Pub/sub fan-out into point-to-point queues. Competing consumers on the billing queue are part of this picture.

## Facts

- The outbox relay publishes to an SNS topic.
- The topic copies the event onto an SQS queue for inventory, billing, and notifications.
- Billing delivers one copy to one worker. The other billing worker waits.

## Assumptions

- Each subscribed queue receives its own copy.
- A queue still hands each copy to a single consumer.

## Intentional omissions

- Filter policies.
- A dead-letter queue on each team queue.

## Layout / presentation policy

- Left to right: publish, fan-out, team queues, workers.
- Compact, metro, `groupAccent: false`. One delivery edge into the billing pool.
