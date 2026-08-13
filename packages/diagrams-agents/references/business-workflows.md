# Business workflows

Show the work, the decisions, who is responsible, and how the case ends.

Use `person` for a human role, `task` or `process` for work, `decision` for a real choice, and
`start`/`end` for entry and outcomes. A person approves a request; the approval step itself is a
task, not a person-shaped box.

Use swimlanes when the reader cares who does each step. Put every task in exactly one owner's lane
and use `groupLayout: swimlane`. Style automated work consistently so it is easy to distinguish
from human work.

Make the normal path easiest to follow. Label decision arrows with plain conditions such as
`approved`, `needs changes`, or `over limit`. A rework path should return to the nearest correct
step, not loop around the entire page.

When several rejection, timeout, and escalation paths make the main process hard to read, create a
second diagram for exceptions. If KDiagram still reports arrows running backward through the whole
process after trying another layout, split the diagram rather than accepting the tangle.

Give the workflow a specific title and short scope sentence. Show its start, meaningful outcomes,
owners, and important conditions. Use icons and a few styles only when they make roles or outcomes
clearer.

KDiagram is not a full BPMN engine. If an exact parallel join or gateway behavior matters, explain
the limitation rather than drawing a symbol that promises more than the diagram can say.
