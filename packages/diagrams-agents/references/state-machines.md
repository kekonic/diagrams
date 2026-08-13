# State machines

Use a state diagram when the reader needs to know which states something can be in and which
changes are allowed.

Start with `state "Title" { ... }`. Include exactly one `initial` point and at least one `final`
state. Nothing should point into the initial point, and a final state should not lead anywhere else.
KDiagram checks these rules.

Use ordinary `state` boxes for the lifecycle. Use `junction`, `fork`, and `join` only when they
clarify a real branch or merge. They are not decoration.

Label important transitions with what causes the change. Put a condition in square brackets when
useful, for example `authorize [approved]`. Do not imply that KDiagram executes guards, actions,
timeouts, or concurrent behavior. Call out anything that is only illustrative.

Keep the normal lifecycle easiest to follow. If returns, cancellation, administrative overrides,
or recovery paths create arrows around most of the page, put them in a second diagram.

Give the diagram a visible title and a short sentence describing the subject. Use a few styles or
icons on ordinary states when they help; keep the initial and final symbols simple. Check that every
important path can reach an ending, then inspect the final render for crossings, long loops, and
readability.
