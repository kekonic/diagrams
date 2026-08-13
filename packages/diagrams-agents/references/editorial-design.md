# Making a diagram easy to understand

A diagram competes for a reader's attention. Every box, arrow, label, border, icon, and color should
help answer the question.

## Show the right detail for the reader

- **Business leaders:** show major systems, responsibilities, partners, risks, and changes. Leave
  out libraries, ports, and internal APIs.
- **Engineering leaders:** show teams or domains, major responsibilities, integrations, and data
  ownership.
- **Developers:** add the APIs, events, queues, stores, and read/write paths needed to understand
  the design, without dropping into every class.
- **Infrastructure and SRE:** show deployments, networks, regions, gateways, observability, and
  failover only when those details are known and relevant.

Start with roughly five to twelve important boxes. This is a useful starting point, not a rule.
Create another diagram when several unrelated stories compete, everything looks equally important,
or labels must shrink to fit.

Keep most boxes at the same level. A whole platform, one service, and one class usually do not
belong beside one another. Use a second diagram to zoom in.

## Name things by what they do

Prefer `Payment authorization` or `Order fulfillment` over `Processor`, `Manager`, `Backend`, or
`API service`. Use code names only when the implementation itself matters.

Use short verbs on important arrows: `authorizes`, `publishes OrderPlaced`, `reads profile`,
`stores order`. Avoid mystery arrows and two-way arrows that hide separate interactions.

Subtitles should be short clues such as `Browser app`, `Internal component`, or `External system`.
Do not join several facts with bullets, pipes, slashes, or comma lists. Put the second fact on an
arrow, in a note, or in the explanation beside the diagram.

## Arrange the explanation

- Use left-to-right for requests, pipelines, and transformations.
- Use top-to-bottom for layers and hierarchies.
- Put something in the center only when it truly acts as a broker, gateway, or coordinator.
- Use groups for real teams, domains, trust zones, deployments, or system boundaries.
- Make peers look like peers.
- Leave breathing room between distinct parts of the diagram.
- Make one system, path, process, or event stream clearly most important.
- Never rely on color or icons alone to explain a difference.

Use a specific title such as `Order fulfillment — event processing`, not `Architecture`. Add one
short sentence when readers need to know what the diagram intentionally leaves out.

## Improve the first render

After the diagram is correct, make it clearer:

1. Remove anything that does not answer the question.
2. Group only things that truly belong together.
3. Replace vague names with clear responsibilities.
4. Make the reading order obvious.
5. Emphasize the part the reader came to understand.
6. Move secondary questions into another diagram.
7. Make equivalent things look equivalent.

The goal is not to fit the whole system on one canvas. The goal is to help someone understand it
without misleading them.
