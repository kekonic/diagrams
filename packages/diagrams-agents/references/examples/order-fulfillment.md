# Reference example: order fulfillment event map

This example is intentionally complete. It shows the questions and design decisions that turn a
short request into a useful diagram. Copy the process, not the fictional company or system.

## Human prompt

> Create an architecture diagram showing what happens after a customer places an order. We use a
> browser storefront, an order service with PostgreSQL, Stripe for payment authorization, and Kafka
> with a transactional outbox. Inventory and notifications react to `OrderPlaced`. Inventory owns
> its own PostgreSQL database and sends work to a warehouse system. Notifications use an external
> email provider. Show team boundaries and the dead-letter path. The audience is developers joining
> the commerce platform.

## Questions asked and answered

Only questions that could materially change the picture are needed.

| Question                                        | Answer used in the diagram                                                                                             |
| ----------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| What should a new developer understand?         | The successful path from checkout through durable event publication to fulfillment and email.                          |
| Which calls are synchronous?                    | Checkout, payment authorization, database writes, warehouse submission, and email submission.                          |
| What is published asynchronously?               | The outbox relay publishes `OrderPlaced`; inventory and notifications consume it independently.                        |
| What do the visible groups mean?                | They are ownership boundaries: digital experience, ordering, event backbone, fulfillment, and customer communications. |
| Is the warehouse software part of our platform? | No. It is an external system used by the fulfillment team.                                                             |
| How much failure handling belongs here?         | Only the dead-letter destination. Retry timing and replay operations need a separate failure-handling diagram.         |
| Which stories should animation explain?         | One successful order and the point where exhausted delivery retries enter the dead-letter queue.                       |

## Reasoning summary

This records the decisions another person can review. It does not attempt to reproduce private
chain-of-thought.

- Use an event map, not a sequence diagram. The reader needs ownership and integration structure
  more than exact timing.
- Keep every main box at the application, service, infrastructure, or outside-system level. Do not
  mix classes into this view.
- Make the order service and `orders.v1` topic visually prominent because they connect the direct
  checkout path to the asynchronous work.
- Use `->` for direct work and `=>` for event delivery. Labels name the command, event, or useful
  action instead of saying only “calls.”
- Use semantic kinds, familiar icons, and three restrained semantic styles. Keep Stripe's brand mark
  because the prompt establishes that product; use quiet generic icons for stores and the topic so
  the diagram still works when logos are unavailable. Keep visible names on every important box.
- Keep subtitles to a single short clue. Put behavior on arrows instead of stuffing it into boxes.
- Add two short, named animations. The successful story shows the two consumers beginning in
  parallel; the retry story isolates the failure destination without pretending to explain replay.
- Exclude refunds, cancellations, shipment tracking, retry schedules, Kafka partitions, and runtime
  deployments. They do not answer this diagram's question.

## Layout comparison

The first left-to-right render followed the business path but produced a panoramic 5.02:1 canvas
with two crossings. A top-to-bottom render overcorrected to a 0.19:1 canvas, introduced a reverse
edge, and remained hard to scan. Both were rejected.

A three equal-height ownership columns layout kept reading width but stretched empty Events chrome
to match Checkout and Consumers. That was rejected too.

The selected source keeps left-to-right flow but arranges the meaningful regions in a three-column,
two-row grid. Its canvas stays near 16:9, with no long canvas-spanning edges, reverse-flow edges, or
edge crossings. The grid also keeps Stripe outside the ordering-team boundary—layout must not imply
ownership that is not true.

## Final source and render

- Source: [order-fulfillment.kdiagram](order-fulfillment.kdiagram)
- Portable render: [order-fulfillment.svg](order-fulfillment.svg)

The source is the editable truth. The SVG must be regenerated after the final source change.

## Animation stories

`Order accepted` guides the reader through checkout, payment authorization, the order-and-outbox
commit, event publication, and the independent inventory and notification consumers. Parallel cues
are used only where the event genuinely fans out. Inventory reaches the warehouse only after its
own persistence step.

`Delivery retries exhausted` dims the successful branches and focuses on the event reaching the
dead-letter queue. It intentionally stops there because replay policy and operator steps were not
provided in the prompt.

The portable SVG remains a useful static image. An interactive KDiagram host exposes these named
stories with playback controls from the same source.

## Final review

- Every box is identifiable as a person, application, gateway, service, worker, store, messaging
  destination, or outside system.
- Visible groups communicate ownership or shared infrastructure; Stripe and the warehouse and email
  providers are presented as outside systems.
- Solid direct-work arrows and dashed event arrows separate checkout from downstream reactions.
- The animations guide attention through real paths already present in the diagram; they do not add
  hidden nodes, relationships, or timing guarantees.
- `commits + outbox` states the transaction boundary without claiming the bus participates in it.
- Labels and kinds preserve meaning without icons or color.
- Stripe keeps a brand mark because the prompt establishes it; stores and the topic use quiet
  generic icons so the diagram still reads when logos are unavailable.
- `kdiagrams check` reports zero errors and zero warnings. `kdiagrams analyze` reports no quality
  diagnostics; the measured canvas is near 16:9, with no crossings and no long-span or reverse
  edges.
- The final portable SVG was regenerated from the final formatted source and inspected at normal
  reading size.
