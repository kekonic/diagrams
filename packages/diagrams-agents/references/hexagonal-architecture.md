# Hexagonal architecture

Use this reference for ports-and-adapters, hexagonal, clean, or onion architecture. KDiagram can
express the model well, but it does not provide a radial hexagon layout or boundary-attached ports.
Compose the architecture as meaningful regions and repeated stacks rather than imitating a literal
hexagon.

## Decide what the diagram should explain

Hexagonal diagrams commonly conflate two different stories:

- **Static dependency direction:** inbound and outbound adapters implement or depend on ports;
  application/domain code owns the ports and does not depend on infrastructure.
- **Runtime interaction:** an actor enters through an inbound adapter and use-case port; application
  logic coordinates domain behavior and calls outbound ports; adapters perform external effects.

Choose one as primary. Use `..>` and concise labels such as `implements` or `depends on` for the
static dependency story. Use `->`, `=>`, or `~>` for selected runtime interactions. Do not show both
stories exhaustively on every adapter, port, class, and module. When both are important, create an
architecture view plus a focused sequence or interaction view.

## Establish a consistent grammar

- Inbound adapters: `component` with subtitle `Inbound adapter`; place outside the service scope.
- Inbound ports: `interface` with subtitle `Inbound port` or `Use-case port`; keep inside the service.
- Application layer: handlers, use cases, or coordinators as `component` with subtitle `Application`.
- Domain layer: aggregates, entities, value objects, policies, and domain services as meaningful
  modeling kinds where available, otherwise `component` with subtitle `Domain`.
- Outbound ports: `interface` with subtitle `Outbound port`; these belong to the application/core,
  even when visually placed at its edge.
- Outbound adapters: `component` with subtitle `Outbound adapter`; place outside the core boundary.
- External systems and stores: use concrete kinds only when the prompt establishes them. For an
  explicitly illustrative reference architecture, label invented examples as illustrative in the
  visible scope and delivery notes.

Use one restrained style for the core, one for inbound elements, one for outbound elements, and a
muted treatment for secondary/shared concerns. Icons aid scanning but do not replace the port and
adapter subtitles.

## Detailed internal modules

Represent each module as one repeated stack with the same layer order. A useful default is:

1. application handler or use case;
2. aggregate/entity or domain model;
3. policy/domain service only when it adds a distinct responsibility;
4. owned outbound port.

Use `arrange: stack` inside each module and arrange peer modules in a row or bounded grid. Keep
equivalent layers visually equivalent. Do not add a separate box for every class merely to satisfy
“detailed”; select classes that explain responsibility and dependency direction. Prefer three to
five nodes per module. Put class lists in a focused module view when they exceed that budget.

Show only important relationships between modules. One application-level coordination edge is
usually clearer than connections among every handler, aggregate, policy, and port. A shared kernel
should contain only genuinely shared domain concepts; infrastructure dispatchers, units of work,
and event publishers are application/outbound concerns, not a generic “shared kernel.”

## Prefer progressive views for depth

When the request asks for varied adapters plus several detailed module/class stacks, default to a
coordinated set unless the user explicitly requires one poster:

1. **Ports-and-adapters overview:** adapter categories, ports, core/application boundary, external
   systems, and dependency direction.
2. **Internal modules:** repeated layer/class stacks and only important module collaboration.
3. **Focused module or runtime view:** one module's classes or one representative request path.

Use a KDiagram `sequence` diagram for the runtime view when ordering and synchronous/asynchronous
handoffs are the question. Do not stretch a general architecture graph into a timeline with long
returning perimeter edges.

Reuse names, colors, icons, and box types, but make every view stand alone with its own title and scope. This
is not evading “very detailed”; it preserves the requested detail at a readable scale.

## Single-poster strategy

If one canvas is required:

- use a left-to-right staged composition: inbound adapters, inbound ports, core modules, outbound
  ports/adapters, external systems;
- activate diagram-level `layout { arrange: row }` for that staged composition. Top-level groups and
  ungrouped actors/adapters then remain in declaration order while nested groups control their own
  stacks. Use a bounded grid instead when the row would make ordinary text unreadable;
- use visible groups for the logical service and modules, and chromeless groups for peer columns;
- cap the primary poster at roughly four module stacks and four important inbound/outbound adapter
  categories; consolidate repetitive adapters by category or move them to notes;
- keep edge labels sparse, avoiding repeated `implements` labels when grouping and style already
  establish the grammar;
- omit most request-flow arrows or most dependency arrows according to the question you chose;
- keep external systems aligned beside their adapters rather than in a long vertical tail;
- render both LR and an appropriate grid/TD alternative, then inspect the complete diagram—not a
  crop or thumbnail—at the intended display width.

Quote presentation strings containing punctuation. For example,
`titleSubtitle: "Illustrative logical architecture; static dependencies are primary"` must render
in full; seeing only its first word is a failed visual check.

Split the poster if ordinary reading requires zooming merely to read labels, if a module boundary
contains large unused areas, if an external-system tail determines most of the canvas, or if more
than a few edges span multiple module stacks.

## Failure signs

- A literal hexagon shape is used without showing port ownership or inward dependency.
- Ports appear outside the core or adapters appear inside it without explanation.
- Domain classes depend on databases, brokers, HTTP clients, or adapter implementations.
- Static dependency and runtime flow edges are visually indistinguishable.
- Every adapter connects to every applicable port.
- Every class relationship is drawn across module boundaries.
- “Shared kernel” becomes a bucket for framework or infrastructure utilities.
- The diagram passes a size check even though its text is too small to read.
- Visual QA covers only a cropped preview or the “visible portion” of the diagram.
