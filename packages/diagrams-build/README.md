# `@kekonic/diagrams-build`

Shared build-time contracts for first-party KDiagram adapters. Most applications should install a
host integration such as `@kekonic/diagrams-remark`,
`@kekonic/diagrams-markdown-it`, or `@kekonic/diagrams-unplugin` instead.

This package deliberately delegates parsing, layout, and rendering to the public
`@kekonic/diagrams` facade. It owns portable build defaults, diagnostic offsets, and virtual
module generation so integrations do not duplicate KDiagram behavior.
