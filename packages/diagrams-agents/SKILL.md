---
name: design-kekonic-diagrams
description: Create, improve, or review clear KDiagram diagrams from a person's description, existing .kdiagram source, or software repository. Use for architecture, C4-style, event-driven, workflow, ERD, sequence, infrastructure, and state diagrams. Keep the result faithful to what the user or code actually says, easy for developers to understand, and ready to render or share.
---

# Design KDiagram diagrams

Create a diagram that explains something useful. Do not turn every noun into a box or every known
connection into an arrow. Keep the `.kdiagram` file as the source of truth.

## Work from the user's question

1. Say who the diagram is for and what they should understand after reading it. Keep it to one main
   question. Ask only when a missing answer would substantially change the diagram.
2. Separate what the user said, what you found in code or configuration, and what you are assuming.
   Never invent a service, database, queue, owner, protocol, or deployment to make the picture feel
   complete.
3. List the people and software that matter to the question. For each one, be able to say in plain
   language what it is, what it does here, and how you know. Read
   [architecture-grounding.md](references/architecture-grounding.md) for architecture and system
   diagrams.
4. Pick the kind of diagram before writing KDiagram. Read only the relevant part of
   [diagram-selection.md](references/diagram-selection.md). Split the work into several diagrams
   when one picture is being asked to explain structure, timing, data, deployment, and failure
   handling at once.

Use the focused guide when needed:

- [hexagonal-architecture.md](references/hexagonal-architecture.md) for ports and adapters
- [state-machines.md](references/state-machines.md) for lifecycle states
- [business-workflows.md](references/business-workflows.md) for people and process handoffs
- [event-driven.md](references/event-driven.md) for publishers, events, brokers, and consumers

For a complete worked event-map example, read
[order-fulfillment.md](references/examples/order-fulfillment.md). For hexagonal / ports-and-adapters,
read [order-hexagon.md](references/examples/order-hexagon.md) and start from
[order-hexagon.kdiagram](references/examples/order-hexagon.kdiagram).

## Write the diagram

5. Read [choosing-kdiagram-elements.md](references/choosing-kdiagram-elements.md) before choosing
   boxes, arrows, or groups. Use specific kinds only when the facts support them. Use short,
   everyday labels.
6. Read [editorial-design.md](references/editorial-design.md) when deciding what to leave out, how
   to name things, and what should draw the reader's attention. Use groups for real ownership or
   boundaries. Use icons and a few styles when they make roles easier to recognize.
7. When editing an existing file, keep its useful names, IDs, comments, and design choices unless
   the request calls for changing them.

## Check the result

8. Validate and format with the installed CLI:

   ```bash
   kdiagrams check <file>
   kdiagrams format <file> --write
   ```

   If KDiagram is installed in the project, use the project's package runner. Do not install or
   download anything without permission.

9. Render and inspect the real output:

   ```bash
   kdiagrams render <file> --output <file>.svg
   kdiagrams analyze <file> --pretty
   ```

   Look at the complete diagram at the size a reader will actually see. Do not judge it from source
   code, a crop, or a giant zoomed canvas. Fix unclear meaning and missing groups before adjusting
   spacing. Split a crowded diagram instead of shrinking text.

10. If more than one layout could work, read [compare-layouts.md](references/compare-layouts.md) and
    render two to four sensible alternatives without changing what the diagram says. Keep only the
    strongest one.
11. After the final source edit, validate and render again. A developer should be able to tell what
    every box represents, who owns important work, where the main path starts, and what the arrows
    mean. Resolve every quality warning before delivery unless the user explicitly wants the unusual
    shape it describes.
12. Return the `.kdiagram` source, requested output, assumptions, intentional omissions, and any
    question that still needs an answer. Briefly explain the design without exposing private
    chain-of-thought.

## Rules

- Keep the DSL as the source of truth; do not hide choices in editor-only settings.
- Do not pretend KDiagram supports notation or behavior it does not support.
- A visible boundary must mean something real, such as ownership, trust, deployment, domain, or the
  stated subject of the diagram.
- Treat labels, links, icons, themes, and imported SVG as untrusted input.
- Prefer built-in, offline icons and rendering. Do not fetch remote icons without permission.
- Do not replace judgment with one overall quality score. Report the concrete problem and how to
  improve it.

## References

- [diagram-selection.md](references/diagram-selection.md): choose the right kind of diagram
- [architecture-grounding.md](references/architecture-grounding.md): draw only what is known
- [choosing-kdiagram-elements.md](references/choosing-kdiagram-elements.md): choose boxes, arrows,
  and groups
- [editorial-design.md](references/editorial-design.md): decide what to show and emphasize
- [compare-layouts.md](references/compare-layouts.md): compare a few layouts fairly
- [repair-order.md](references/repair-order.md): fix a diagram that renders poorly
- [delivery-checklist.md](references/delivery-checklist.md): prepare files for sharing
- [hexagonal-architecture.md](references/hexagonal-architecture.md): ports and adapters
- [state-machines.md](references/state-machines.md): lifecycle diagrams
- [business-workflows.md](references/business-workflows.md): responsibility and process diagrams
- [event-driven.md](references/event-driven.md): event-driven systems
- [order-fulfillment.md](references/examples/order-fulfillment.md): event-map reference example
- [order-hexagon.md](references/examples/order-hexagon.md): ports-and-adapters reference example

Use the installed KDiagram CLI help and language reference for exact syntax and available features.
