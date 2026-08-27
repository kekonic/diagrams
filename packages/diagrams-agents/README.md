# `@kekonic/diagrams-agents`

Host-neutral skill and references for coding agents that design Kekonic Diagrams.

## Install

```bash
npx skills add kekonic/diagrams
```

That installs `design-kekonic-diagrams` through the Skills CLI. Cursor, Claude Code, Codex, and
other Skills CLI hosts pick it up from the cloned skill files.

To pin the package directory instead of searching the repository:

```bash
npx skills add https://github.com/kekonic/diagrams/tree/main/packages/diagrams-agents
```

The same files publish on npm as `@kekonic/diagrams-agents` for dependency-managed agent
environments. The Skills CLI does not currently install from the npm package name.

See [Design with agents](https://diagrams.kekonic.com/start/agents/) for install and the workflow.
