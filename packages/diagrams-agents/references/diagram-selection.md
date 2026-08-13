# Choosing a diagram family

Choose one reader question and one primary pattern. Combine families only when the question truly
requires it.

When a complex system needs several views, sequence them progressively: ecosystem/context, major
architecture, one important runtime flow, focused domain or data detail, and deployment only when
deployment is part of the question. Each view must stand on its own and avoid repeating every fact.

## Architecture and C4-style views

Use for boundaries, responsibilities, dependencies, ownership, or deployment context. Start with
people and external systems for a context view; add deployable applications and stores only for a
container-level question. Group by a real semantic boundary such as domain, trust zone, or runtime,
not merely to balance the picture.

Keep C4-style levels distinct:

- **Context:** people, the subject system, and external systems. Do not expose its internal
  services.
- **Container/application:** separately running applications, services, workers, and stores. A C4
  container does not mean a Docker container.
- **Component:** important internal collaborators within one application. Create this only when
  internal organization is the reader's question.

Use architecture views for modular monoliths, layers, ports and adapters, domain context, security
boundaries, and deployment topology only to the fidelity KDiagram's current capabilities can state
honestly. A logical architecture should not imply a physical deployment.

Failure signs: mixed abstraction levels, every dependency shown, unlabeled cross-boundary edges,
or technology details that do not affect the reader's decision.

## Event-driven views

Use for producers, events/topics, consumers, and asynchronous responsibility. Distinguish commands,
events, synchronous calls, and data flow. Label business events in past tense and show stores only
when persistence matters to the question.

Failure signs: treating every arrow as generic flow, inventing topics, or hiding which component
owns publication and consumption.

## Workflows

Use for decisions, branches, retries, failure paths, and human/system handoffs. Give decision edges
meaningful conditions. Keep the happy path visually primary without deleting important failure
behavior.

Failure signs: ambiguous branches, process steps modeled as systems, or a workflow used where a
sequence interaction is the real question.

## ERDs

Use for entity identity, cardinality, ownership, and important constraints. Include only columns
needed to explain keys and the reader's data question. Use explicit foreign-key relationships and
cardinality.

Failure signs: database dumps masquerading as explanations, missing ownership boundaries, or
relationships inferred only from similarly named columns.

## Sequence views

Use when time ordering, request/response behavior, asynchronous handoff, retry, or failure timing is
the question. Keep participants at one useful abstraction level and label interactions with intent.

Failure signs: using sequence to show static topology, omitting responses that matter, or asserting
an order not established by supplied facts.

## State machines

Use for lifecycle legality, guarded transitions, terminal outcomes, retry states, and recovery.
Use the first-class `state` surface and read [state-machines.md](state-machines.md). Keep runtime
message order and responsibility handoffs in separate sequence or workflow views.

Failure signs: generic process nodes used as states, missing initial/final semantics, unlabeled
guards, unreachable terminals, or retry/compensation edges surrounding the canvas.

## Know when not to force KDiagram

KDiagram can explain many systems with semantic architecture, event, workflow, ERD, and sequence
views. Do not simulate a notation it does not currently model. Full BPMN execution semantics,
executable UML behavior, column-level lineage, threat modeling, and exhaustive cloud-resource
topology may need a different tool or a deliberately simpler KDiagram view. Check the installed
capability contract when available and tell the user what was intentionally simplified.
