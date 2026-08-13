# Drawing software architecture honestly

Before drawing a box, make sure you can answer three ordinary questions:

1. What is it?
2. What does it do in this diagram?
3. How do we know that?

The answer may come from the user's description, code or configuration you inspected, or an
assumption you clearly call out. If you cannot explain a box in plain language, ask, label the
uncertainty, or leave it out.

## Use specific boxes only when the facts are specific

- Use `service` only when it really is a service or separately running program.
- Use `application` for an actual application, such as a browser app or mobile app.
- Use `database`, `queue`, `topic`, and `deployment` only when those things are known to exist. A
  sentence such as “stores customer data” does not prove there is a database.
- Use `store` when you know data is kept but do not know how. A subtitle such as `Data store` is
  enough.
- Use `broker` when messaging infrastructure is known, even if its product or hosting is unknown.
- Use `component` for an internal part whose deployment is unknown. Add a short subtitle such as
  `Checkout logic` or `Application component` so readers do not mistake it for a service.
- Use `external` for something outside the subject of this diagram. It may still belong to the same
  company.

Keep subtitles short—usually one to four words. Do not manufacture strings such as
`Logical capability • event consumer`. If a box consumes an event, the arrow already shows that.

## Keep neighboring boxes comparable

A person, an entire platform, one microservice, and a class rarely belong side by side. If mixing
levels genuinely answers the question, make containment obvious. Otherwise create a second,
closer view.

For every box, a developer should be able to tell whether it is a person, application, service,
internal part, data store, messaging system, or outside system. The diagram should not require a
legend to answer that basic question.

## Use groups to explain ownership or boundaries

Draw a visible group when the boxes truly share something readers care about: ownership, domain,
trust, deployment, system scope, or responsibility. Name that reason. `Enrollment decisioning` is
more useful than `Backend`.

Use `chrome: false` when you only need to line up peers or stages. That improves layout without
pretending the boxes form another system boundary.

People and outside systems often sit outside the main group. Do not nest boxes simply to fill
space.

## Make the diagram easy to scan

- Choose kinds and shapes that match what things really are.
- Add short subtitles only where the box's role would otherwise be unclear.
- Use familiar icons when they help recognition; labels must still stand on their own.
- Use a few meaningful styles, such as normal, muted, warning, failure, and success.
- Give a standalone diagram a visible title and one short sentence explaining its scope.
- Emphasize the path or dependency the reader came to understand.
- Use layout groups, direction, and spacing to show stages and peers.

Avoid a different color for every box. Avoid vendor logos unless the vendor matters and is known.

## Final questions

Before delivery, ask:

- Does the title say what system or process this is?
- Can a developer tell what each box represents?
- Are boxes at comparable levels, or is the nesting clear?
- Do visible groups have a real-world meaning?
- Are important arrows labeled with useful verbs?
- Are icons and color helping, rather than decorating?
- Is the main idea obvious at normal reading size?
- Did you inspect the final render after the last source change?

It is fine not to use every KDiagram feature. It is not fine to stop because the source compiles.
