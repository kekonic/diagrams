# Choosing KDiagram boxes, arrows, and groups

Use the installed CLI and language reference for exact syntax. This guide is about choosing the
right diagram elements.

## Arrows

- `->` is a direct call or flow.
- `=>` is an event or asynchronous message.
- `~>` is eventual or delayed flow.
- `..>` is a dependency, such as “implements” or “depends on.”
- `-x` is a failed or blocked flow.
- `--` is an undirected association.

Choose the arrow from what actually happens, not from which line looks best. Use a short verb or
event name: `authorizes`, `publishes OrderPlaced`, `reads profile`, `implements port`.

If an arrow label needs a sentence containing “after,” “unless,” “and,” or “either,” the diagram is
probably hiding a decision, result, or missing step.

## Boxes

Use `person` for a human. Use `external` for a system outside the diagram's subject. Use specific
kinds such as `application`, `service`, `database`, or `broker` only when the description or code
supports that choice. Use `component` for an internal part when you do not know whether it runs on
its own, and give it a plain subtitle describing its job.

Keep neighboring boxes at roughly the same level. When showing a whole application beside one of
its internal parts, put the internal part inside the application or make a separate detail view.

## Groups

A visible group tells readers that its contents belong together for a real reason. Use one for a
known team, domain, trust zone, deployment, system, or area of responsibility. Do not draw a border
merely to make the layout tidy; use a chromeless group for that.

If you are unsure who owns something or where it belongs, say so in the notes instead of turning a
guess into a boundary.

## Decisions, joins, and human review

KDiagram does not currently model every BPMN gateway. Do not hide an important AND join, approval,
or fallback inside a long arrow label and then imply it is fully represented.

Show known outcomes and responsibilities as boxes. Show a human reviewer as a person and draw the
request and response when those directions are known. Do not invent queues, decision services,
approval records, or result events just to complete the picture.

When exact ordering, retries, or joins are the point, use a focused workflow or sequence diagram.
If KDiagram cannot express the important distinction honestly, say so and draw a smaller diagram.
