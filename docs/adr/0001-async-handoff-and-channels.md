# Async handoff, eventual observation, and channels

`=>` is an asynchronous handoff on every diagram, and `~>` is an eventual observation on every diagram. Pub/sub is a topic or stream with those edges, and point-to-point is a queue. Authors can omit the channel when the pipe is not the question.

A filled head means the sender waits. An open head means it does not. Both surfaces use that pair, which is the UML and PlantUML sequence rule (`>` waits, `>>` does not). A flow diagram draws `=>` as a dashed open arrow and `~>` as a dotted open arrow, because at map scale the shaft separates them from a solid call. A sequence draws `=>` as a solid open arrow and `~>` as a dotted open arrow, because that surface already uses a dashed shaft for the reply.

PlantUML's default channel is a `queue` shape. It has no topic shape and no pub/sub connector; publish-subscribe is the same queue with a stereotype, and the async connector is the open arrow. The queue stays the point-to-point shape. A topic or stream keeps the stacked-log shape so pub/sub is visible without a stereotype.
