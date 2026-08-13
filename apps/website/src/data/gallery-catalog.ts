/** Gallery metadata — dogfood examples + thin intent landings.
 * Sources live in examples.ts (`loadExample` / inline teaching beats).
 */

export type GalleryCluster =
  | "system-maps"
  | "event-pipelines"
  | "workflows"
  | "data-models"
  | "layout-craft"
  | "presentation"
  | "language-atlas";

export type GalleryExample = {
  /** URL slug under /gallery/ */
  id: string;
  title: string;
  description: string;
  blurb: string;
  cluster: GalleryCluster;
  /** Named export on examples.ts */
  sourceExport: string;
  tryThis: string;
  patterns: string[];
  language: string[];
};

export type GalleryIntent = {
  id: string;
  title: string;
  description: string;
  blurb: string;
  /** Dogfood / teaching export to feature */
  sourceExport: string;
  /** Related example slugs */
  related: string[];
  patterns: string[];
  language: string[];
  faq: Array<{ q: string; a: string }>;
};

export const CLUSTER_LABELS: Record<GalleryCluster, string> = {
  "system-maps": "System maps",
  "event-pipelines": "Event pipelines",
  workflows: "Workflows",
  "data-models": "Data models",
  "layout-craft": "Layout craft",
  presentation: "Presentation",
  "language-atlas": "Language atlas",
};

export const GALLERY_EXAMPLES: GalleryExample[] = [
  {
    id: "checkout-architecture",
    title: "Checkout architecture",
    description: "Multi-plane checkout with icons, sync calls, events, and Stripe.",
    blurb:
      "Clients through edge, services, data, and Stripe — metro routing, brand icons, and OrderPlaced on the bus.",
    cluster: "system-maps",
    sourceExport: "heroCheckout",
    tryThis: "Flip `direction LR` to `TD`, or add another worker on the bus with `=>`.",
    patterns: ["sync-vs-event", "group-as-plane", "icon-brand-vs-theme"],
    language: ["/design/layout/", "/reference/language/#connections", "/reference/icons/"],
  },
  {
    id: "enterprise-rag",
    title: "Enterprise RAG",
    description: "Guarded RAG across ingress, orchestration, knowledge, and controls.",
    blurb:
      "Four planes — ingress policy, retrieval orchestration, knowledge stores, and output guards — with sync, dependency, and failure edges.",
    cluster: "system-maps",
    sourceExport: "enterpriseRag",
    tryThis: "Add another knowledge store and wire `retrieval ..> store`.",
    patterns: ["group-as-plane", "sync-vs-event", "workflow-branches"],
    language: ["/design/layout/", "/reference/language/#nodes", "/reference/language/#connections"],
  },
  {
    id: "layered-architecture",
    title: "Layered architecture",
    description: "Stretch bands for presentation, API, and data.",
    blurb:
      "Horizontal layers that hold as planes. Pack members side-by-side; wire across band boundaries.",
    cluster: "system-maps",
    sourceExport: "layeredArchitecture",
    tryThis: "Move billing into the data band and watch the band reflow.",
    patterns: ["group-as-plane", "columns-and-bands"],
    language: ["/design/layout/", "/design/layout/"],
  },
  {
    id: "hexagonal-architecture",
    title: "Hexagonal architecture",
    description: "Order core with driving/driven adapters and queue-side contexts.",
    blurb:
      "Ports & adapters: actors drive the Order hexagon; RabbitMQ opens Inventory and Fulfillment contexts with cache-aside stock.",
    cluster: "system-maps",
    sourceExport: "hexagonalArchitecture",
    tryThis: "Add a Notification context that also consumes from RabbitMQ.",
    patterns: ["group-as-plane", "columns-and-bands", "sync-vs-event"],
    language: ["/design/layout/", "/reference/language/#nodes", "/reference/language/#connections"],
  },
  {
    id: "order-placed-pipeline",
    title: "OrderPlaced pipeline",
    description: "Event fan-out across queues, workers, sinks, and a DLQ.",
    blurb:
      "Publish once — Kafka routes to queues, workers hit sinks, poison paths land in dead-letter.",
    cluster: "event-pipelines",
    sourceExport: "eventPipeline",
    tryThis: "Add a `fraud` queue and worker on the bus.",
    patterns: ["sync-vs-event", "workflow-branches"],
    language: ["/reference/language/#connections", "/reference/language/#nodes"],
  },
  {
    id: "customer-refund-request",
    title: "Customer refund request",
    description: "Workflow with choices, approval lane, metro routing, and jumps.",
    blurb:
      "Eligibility → inspection → approval → payout. Priorities keep the happy path obvious; jumps keep crossings legible.",
    cluster: "workflows",
    sourceExport: "refundWorkflow",
    tryThis: "Raise `priority: high` on deny, or switch `crossings: jumps` to `smart`.",
    patterns: ["workflow-branches", "density-and-crossings"],
    language: ["/reference/language/#connections", "/reference/language/#nodes", "/design/layout/"],
  },
  {
    id: "temporal-order-workflow",
    title: "Order orchestration (Temporal)",
    description: "Complex Temporal workflow: activities, signal+timer, child workflow, saga.",
    blurb:
      "Checkout starts OrderWorkflow — parallel activities, PaymentCaptured signal vs timer, ShipOrder child, and compensate on timeout.",
    cluster: "workflows",
    sourceExport: "temporalOrderWorkflow",
    tryThis: "Add a `ReviewFraud` activity before AuthorizePayment.",
    patterns: ["workflow-branches", "sync-vs-event"],
    language: ["/reference/language/#connections", "/reference/language/#nodes", "/design/layout/"],
  },
  {
    id: "temporal-order-workflow-sequence",
    title: "Order orchestration (Temporal) — sequence",
    description: "Same Temporal story as a sequence: par, alt, create/destroy child, activations.",
    blurb:
      "Interaction view of OrderWorkflow — parallel reserve/authorize, payment signal, ShipOrder child create/destroy, and compensate on timeout.",
    cluster: "workflows",
    sourceExport: "temporalOrderWorkflowSequence",
    tryThis: "Add an `opt` fragment for fraud review before authorize.",
    patterns: ["workflow-branches", "sync-vs-event"],
    language: ["/design/sequence-diagrams/", "/reference/language/#connections"],
  },
  {
    id: "checkout-schema",
    title: "Checkout schema",
    description: "ERD with customers, orders, payments, and shipments.",
    blurb:
      "First-class tables and FK crow’s-feet — persistence that shares the same SVG path as architecture maps.",
    cluster: "data-models",
    sourceExport: "schemaErd",
    tryThis: "Add `refunds` with `order_id: uuid FK NN -> orders.id`.",
    patterns: ["table-fk-edges"],
    language: ["/design/data-models/"],
  },
  {
    id: "platform-grid",
    title: "Platform grid",
    description: "Named grid tracks with rowSpan for a tall core.",
    blurb: "Edge / core / data on named columns. A spanning core shows what region arrange is for.",
    cluster: "layout-craft",
    sourceExport: "platformGrid",
    tryThis: "Change core `rowSpan` or move ops to another column.",
    patterns: ["grid-with-spans", "columns-and-bands"],
    language: ["/design/layout/", "/design/layout/"],
  },
  {
    id: "platform-spans",
    title: "Platform spans",
    description: "Full-width ingress and partial ops bands with colSpan.",
    blurb: "Ingress spans the width; core owns height; ops shares a band. Spans without a canvas.",
    cluster: "layout-craft",
    sourceExport: "platformSpans",
    tryThis: "Shrink ingress `colSpan` and watch the band.",
    patterns: ["grid-with-spans"],
    language: ["/design/layout/", "/design/layout/"],
  },
  {
    id: "presentation-slide",
    title: "Presentation slide",
    description: "Review-ready title, legend, and group accents.",
    blurb:
      "Opt-in chrome for design reviews — title, legend, accents — same graph, still embeddable SVG.",
    cluster: "presentation",
    sourceExport: "presentationSlide",
    tryThis: "Toggle theme on the live host, or edit the subtitle.",
    patterns: ["theme-and-presentation"],
    language: ["/design/layout/", "/publish/theming/"],
  },
];

export const GALLERY_INTENTS: GalleryIntent[] = [
  {
    id: "architecture-diagram",
    title: "Architecture diagram",
    description: "Text-to-architecture diagrams with automatic layout — KDiagram gallery.",
    blurb:
      "Describe services, gateways, stores, and boundaries in text. KDiagram lays out planes and routes edges so the map reads like the system.",
    sourceExport: "heroCheckout",
    related: [
      "checkout-architecture",
      "enterprise-rag",
      "layered-architecture",
      "hexagonal-architecture",
    ],
    patterns: ["group-as-plane", "sync-vs-event", "columns-and-bands"],
    language: ["/design/layout/", "/reference/language/#nodes"],
    faq: [
      {
        q: "Is this a replacement for drawing tools?",
        a: "For system maps that change in git — yes. You edit text; layout and routing stay automatic.",
      },
      {
        q: "Can I group by plane or region?",
        a: "Use `group` with optional `arrange: row | stack | grid`. See Groups in the language reference.",
      },
    ],
  },
  {
    id: "event-driven",
    title: "Event-driven diagram",
    description: "Event pipelines, queues, and workers as text-to-diagram — KDiagram.",
    blurb:
      "Show what fires after a publish: brokers, workers, retries, and dead-letter paths. Event edges (`=>`) stay visually distinct from sync calls.",
    sourceExport: "eventPipeline",
    related: ["order-placed-pipeline", "checkout-architecture"],
    patterns: ["sync-vs-event", "workflow-branches"],
    language: ["/reference/language/#connections", "/reference/language/#nodes"],
    faq: [
      {
        q: "How do events differ from API calls in the language?",
        a: "`->` is a flow/sync edge; `=>` is an event edge with a dashed default stroke.",
      },
    ],
  },
  {
    id: "workflows",
    title: "Workflow diagram",
    description: "Workflow and decision diagrams with automatic layout — KDiagram.",
    blurb:
      "Choices, branch labels, and success/warning paths that stay legible when the graph fans out.",
    sourceExport: "refundWorkflow",
    related: ["customer-refund-request", "temporal-order-workflow"],
    patterns: ["workflow-branches", "density-and-crossings"],
    language: ["/reference/language/#nodes", "/reference/language/#connections"],
    faq: [
      {
        q: "Do I place diamonds by hand?",
        a: "No — `choice` / `decision` kinds get diamond geometry; layout places them.",
      },
    ],
  },
  {
    id: "erd",
    title: "Database diagram (ERD)",
    description: "Entity-relationship diagrams from table nodes and FK refs — KDiagram.",
    blurb:
      "Tables with column markers and foreign keys become crow’s-foot relationships. Same pipeline as architecture diagrams.",
    sourceExport: "schemaErd",
    related: ["checkout-schema"],
    patterns: ["table-fk-edges"],
    language: ["/design/data-models/"],
    faq: [
      {
        q: "How do foreign keys become edges?",
        a: "Write `column: type FK NN -> other.id` inside a `columns { }` block.",
      },
    ],
  },
  {
    id: "database-diagram",
    title: "Database diagram",
    description: "Database / ERD diagrams in KDiagram — tables, keys, and relationships.",
    blurb:
      "Persistence models as first-class table nodes. Alias of the ERD gallery landing for common search terms.",
    sourceExport: "schemaErd",
    related: ["checkout-schema", "erd"],
    patterns: ["table-fk-edges"],
    language: ["/design/data-models/"],
    faq: [
      {
        q: "Is this separate from architecture diagrams?",
        a: "Same language and SVG path — different node kinds (`table`) and FK edges.",
      },
    ],
  },
  {
    id: "c4",
    title: "C4 architecture diagram",
    description: "C4-style context diagrams with person, system, and external kinds — KDiagram.",
    blurb:
      "Use `person`, `system`, `container`, and `component` kinds for C4-shaped cards — without a separate C4 dialect.",
    sourceExport: "c4SystemContext",
    related: ["checkout-architecture", "builtin-kinds-and-edges"],
    patterns: ["person-system-container", "group-as-plane"],
    language: ["/reference/language/#nodes"],
    faq: [
      {
        q: "Is KDiagram a C4 modeling tool?",
        a: "It ships C4-friendly kinds and silhouettes. You still write KDiagram, not a separate C4 DSL.",
      },
    ],
  },
  {
    id: "layout-craft",
    title: "Layout craft",
    description: "Grid, row, and stack arrange examples — KDiagram gallery.",
    blurb:
      "When ELK nesting isn’t enough, region `arrange` places child groups on tracks — columns, bands, and named grids with spans.",
    sourceExport: "platformGrid",
    related: [
      "platform-grid",
      "platform-spans",
      "module-columns",
      "layered-architecture",
      "hexagonal-architecture",
    ],
    patterns: ["grid-with-spans", "columns-and-bands", "density-and-crossings"],
    language: ["/design/layout/", "/design/layout/"],
    faq: [
      {
        q: "When should I use arrange vs plain groups?",
        a: "Use `arrange` when you need explicit columns, bands, or a grid. Otherwise let compound layout place nested groups.",
      },
    ],
  },
];

export function exampleById(id: string): GalleryExample | undefined {
  return GALLERY_EXAMPLES.find((e) => e.id === id);
}

export function intentById(id: string): GalleryIntent | undefined {
  return GALLERY_INTENTS.find((e) => e.id === id);
}

export function examplesByCluster(): Array<{
  cluster: GalleryCluster;
  label: string;
  items: GalleryExample[];
}> {
  const order: GalleryCluster[] = [
    "system-maps",
    "event-pipelines",
    "workflows",
    "data-models",
    "layout-craft",
    "presentation",
    "language-atlas",
  ];
  return order
    .map((cluster) => ({
      cluster,
      label: CLUSTER_LABELS[cluster],
      items: GALLERY_EXAMPLES.filter((e) => e.cluster === cluster),
    }))
    .filter((group) => group.items.length > 0);
}
