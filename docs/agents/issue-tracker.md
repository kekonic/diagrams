# Issue tracker: Linear

Issues and specs for this repo live as Linear issues in the **Kekonic** workspace, on the
**Kekonic Diagrams** project. Identifiers are `KEK-*` (e.g. `KEK-123`). Use the Linear
plugin/MCP tools for every create, read, list, comment, label, assign, and status change.
Do not use `gh issue` for this repo.

Project: https://linear.app/kekonic/project/kekonic-diagrams-f1f721079e4c

If Linear MCP is not connected in the session, stop and say so. Do not fall back to
GitHub Issues or `.scratch/` files.

## Conventions

- **Create an issue**: Linear MCP create, always attached to the Kekonic Diagrams project.
  Include a short title and a full body. New issues start in the team's default open state
  (usually Backlog or Todo) unless the calling skill specifies otherwise.
- **Read an issue**: Linear MCP get by `KEK-*`, including comments and labels.
- **List issues**: Linear MCP list, scoped to the Kekonic Diagrams project, with label and
  status filters as the calling skill requires.
- **Comment**: Linear MCP comment on the issue.
- **Apply / remove labels**: Linear MCP update. Triage role strings live in
  `docs/agents/triage-labels.md`.
- **Assign**: Linear MCP assign to the current user when a skill says to claim a ticket.
- **Close**: comment the outcome first, then set status to **Done**. For `wontfix`, comment,
  apply the `wontfix` label, and set status to **Canceled**. Never silently close.

Treat Linear workflow states as the open/closed axis. Rough mapping: Backlog / Todo /
In Progress are open; Done is closed; Canceled is closed-and-rejected.

## Pull requests as a triage surface

**PRs as a request surface: no.** GitHub PRs are the code-review surface; they are not
feature requests for `/triage`.

## When a skill says "publish to the issue tracker"

Create a Linear issue on the Kekonic Diagrams project.

## When a skill says "fetch the relevant ticket"

Look up the Linear issue by `KEK-*` via MCP (including comments).

## Wayfinding operations

Used by `/wayfinder`. The **map** is a single Linear issue with **child** issues as tickets.

- **Map**: a Linear issue labelled `wayfinder:map`, holding the Notes / Decisions-so-far / Fog
  body, on the Kekonic Diagrams project.
- **Child ticket**: a Linear sub-issue of the map, labelled `wayfinder:<type>`
  (`research` / `prototype` / `grilling` / `task`). Once claimed, assign it to the driving
  dev.
- **Blocking**: Linear's native **blocked by** relation. A ticket is unblocked when every
  blocker is Done or Canceled.
- **Frontier query**: list the map's open sub-issues, drop any with an open blocker or an
  assignee; first in map order wins.
- **Claim**: assign the issue to the current user, the session's first write.
- **Resolve**: comment the answer, set status to Done, then append a context pointer
  (gist + link) to the map's Decisions-so-far.
