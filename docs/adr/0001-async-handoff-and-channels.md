# Async handoff, eventual observation, and channels

`=>` is an asynchronous handoff on every diagram, and `~>` is an eventual observation on every diagram. Pub/sub is a topic or stream with those edges, and point-to-point is a queue. Authors can omit the channel when the pipe is not the question.

A flow diagram draws `=>` dashed and `~>` dotted, because at map scale the shaft is the cue that separates them from a solid synchronous call. A sequence draws `=>` as a solid open head and `~>` as a dotted open head, because that surface already uses a dashed shaft for the reply. One shared stroke would make a sequence handoff look like a reply, or make a flow handoff look like a call.
