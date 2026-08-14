/** Gallery metadata — dogfood examples + thin intent landings.
 * Sources live in examples.ts (`loadExample` / inline teaching beats).
 * Corpus index: examples/catalog.json
 */

export type GalleryCluster =
  | "system-maps"
  | "event-pipelines"
  | "workflows"
  | "data-models"
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
  presentation: "Presentation",
  "language-atlas": "Language atlas",
};

export const GALLERY_EXAMPLES: GalleryExample[] = [
  {
    id: "storefront-context",
    title: "Storefront — system context",
    description: "C4-style context: customer, commerce platform, and outside systems.",
    blurb:
      "Who uses the storefront and which outside systems it depends on — Stripe, warehouse, and email.",
    cluster: "system-maps",
    sourceExport: "storefrontContext",
    tryThis: "Add a support agent as a second `person`, or rename the subject `system`.",
    patterns: ["person-system-container", "group-as-plane"],
    language: ["/design/architecture/", "/reference/language/#nodes"],
  },
  {
    id: "order-fulfillment",
    title: "Order fulfillment",
    description: "Checkout through outbox publish to inventory, email, and DLQ.",
    blurb:
      "Team ownership, sync vs event edges, transactional outbox, and dead-letter recovery — the canonical commerce map.",
    cluster: "system-maps",
    sourceExport: "orderFulfillment",
    tryThis: "Flip a region to `arrange: stack`, or follow the `Order accepted` animation.",
    patterns: ["sync-vs-event", "group-as-plane"],
    language: ["/design/architecture/", "/reference/language/#connections"],
  },
  {
    id: "order-hexagon",
    title: "Order service — ports and adapters",
    description:
      "Nested hex chrome: driving UI → CreateOrderCommand → CreateOrderHandler → OrderRepositoryPort → driven adapters.",
    blurb:
      "Outer hex row stages adapters around an application surround; Domain sits inside Application.",
    cluster: "system-maps",
    sourceExport: "orderHexagon",
    tryThis: "Add an OrderEventPublisherPort on the east ring and a driven Kafka publisher.",
    patterns: ["group-as-plane", "sync-vs-event"],
    language: ["/design/layout/", "/design/architecture/", "/reference/language/#nodes"],
  },
  {
    id: "order-placed-events",
    title: "OrderPlaced — event consumers",
    description: "Outbox publish fans out to inventory and notifications, with a DLQ.",
    blurb:
      "Focused event fan-out after commit — consumers, side effects, and exhausted deliveries.",
    cluster: "event-pipelines",
    sourceExport: "orderPlacedEvents",
    tryThis: "Add a fraud consumer on `orders.v1` with `=>`.",
    patterns: ["sync-vs-event", "workflow-branches"],
    language: ["/reference/language/#connections", "/reference/language/#nodes"],
  },
  {
    id: "order-fulfillment-sequence",
    title: "Order fulfillment — sequence",
    description: "Interaction timing for checkout, publish, and parallel consumers.",
    blurb:
      "Sequence view of the same commerce path — parallel inventory and email, then DLQ after retry limit.",
    cluster: "workflows",
    sourceExport: "orderFulfillmentSequence",
    tryThis: "Add an `opt` fragment for fraud review before authorize.",
    patterns: ["workflow-branches", "sync-vs-event"],
    language: ["/design/sequence-diagrams/", "/reference/language/#connections"],
  },
  {
    id: "order-lifecycle",
    title: "Order lifecycle",
    description: "Legal order statuses with guarded transitions and terminal outcomes.",
    blurb:
      "First-class `state` diagram — placed through shipped, with declined and cancelled finals.",
    cluster: "workflows",
    sourceExport: "orderLifecycle",
    tryThis: "Add a `Held` state with a release transition, or another final for expired holds.",
    patterns: ["workflow-branches"],
    language: ["/design/state-machines/", "/reference/language/"],
  },
  {
    id: "refund-request",
    title: "Customer refund request",
    description: "Swimlane workflow from request through approval and payout.",
    blurb:
      "Eligibility, inspection, auto-approve vs manager review, Stripe refund, and email — by owner.",
    cluster: "workflows",
    sourceExport: "refundRequest",
    tryThis: "Raise the auto-approve path priority, or play the `Denied` animation.",
    patterns: ["workflow-branches", "density-and-crossings"],
    language: ["/design/workflows/", "/reference/language/#nodes"],
  },
  {
    id: "checkout-schema",
    title: "Checkout schema",
    description: "ERD for customers, catalog, orders, payments, and shipments.",
    blurb:
      "Tables and FK crow’s-feet for checkout persistence — same SVG path as architecture maps.",
    cluster: "data-models",
    sourceExport: "checkoutSchema",
    tryThis: "Add `refunds` with `order_id: uuid FK NN -> orders.id`.",
    patterns: ["table-fk-edges"],
    language: ["/design/data-models/"],
  },
  {
    id: "order-review-slide",
    title: "Order fulfillment — review slide",
    description: "Fulfillment map with review chrome and named animations.",
    blurb: "Same topology as order fulfillment — title, accents, and stories for a design review.",
    cluster: "presentation",
    sourceExport: "orderReviewSlide",
    tryThis: "Toggle theme on the live host, or edit the subtitle.",
    patterns: ["theme-and-presentation"],
    language: ["/design/stories/", "/publish/theming/"],
  },
  {
    id: "language-kinds-and-edges",
    title: "Language atlas — kinds and edges",
    description: "Catalog of kinds, content knobs, and edge operators.",
    blurb:
      "Not a system map — a language atlas for kinds, content properties, and every edge treatment.",
    cluster: "language-atlas",
    sourceExport: "languageKindsAndEdges",
    tryThis: "Search the source for an edge operator or kind you need.",
    patterns: [],
    language: ["/reference/language/"],
  },
  {
    id: "geometry-kinds",
    title: "Geometry kinds",
    description: "Bare shapes and common aliases.",
    blurb: "Shape catalog — rectangles, diamonds, cylinders, and aliases — not a system map.",
    cluster: "language-atlas",
    sourceExport: "geometryKinds",
    tryThis: "Swap a node's `shape:` and re-render.",
    patterns: [],
    language: ["/reference/language/#nodes"],
  },
  {
    id: "architecture-icons",
    title: "Architecture icons",
    description: "Lucide, logos, and simple-icons on architecture nodes.",
    blurb: "Icon catalog with Lucide names, `logos:`, and `simple-icons:` — not a system map.",
    cluster: "language-atlas",
    sourceExport: "architectureIcons",
    tryThis: "Change `iconPaint` or swap a Lucide name.",
    patterns: ["icon-brand-vs-theme"],
    language: ["/reference/icons/"],
  },
];

export const GALLERY_INTENTS: GalleryIntent[] = [
  {
    id: "architecture-diagram",
    title: "Architecture diagram",
    description: "Text-to-architecture diagrams with automatic layout — KDiagram gallery.",
    blurb:
      "Describe services, gateways, stores, and boundaries in text. KDiagram lays out planes and routes edges so the map reads like the system.",
    sourceExport: "orderFulfillment",
    related: ["order-fulfillment", "order-hexagon", "storefront-context"],
    patterns: ["group-as-plane", "sync-vs-event"],
    language: ["/design/architecture/", "/reference/language/#nodes"],
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
    sourceExport: "orderPlacedEvents",
    related: ["order-placed-events", "order-fulfillment"],
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
    sourceExport: "refundRequest",
    related: ["refund-request", "order-lifecycle", "order-fulfillment-sequence"],
    patterns: ["workflow-branches", "density-and-crossings"],
    language: ["/design/workflows/", "/reference/language/#nodes"],
    faq: [
      {
        q: "Do I place diamonds by hand?",
        a: "No — `choice` / `decision` kinds get diamond geometry; layout places them.",
      },
    ],
  },
  {
    id: "state-machines",
    title: "State machine diagram",
    description: "Lifecycle states, guarded transitions, and terminal outcomes — KDiagram.",
    blurb:
      "Use the first-class `state` surface when legal transitions matter more than who performs the work.",
    sourceExport: "orderLifecycle",
    related: ["order-lifecycle", "refund-request"],
    patterns: ["workflow-branches"],
    language: ["/design/state-machines/", "/reference/language/"],
    faq: [
      {
        q: "How is this different from a workflow?",
        a: "State diagrams answer which statuses are legal. Workflows answer who does the work and in what order.",
      },
    ],
  },
  {
    id: "erd",
    title: "Database diagram (ERD)",
    description: "Entity-relationship diagrams from table nodes and FK refs — KDiagram.",
    blurb:
      "Tables with column markers and foreign keys become crow’s-foot relationships. Same pipeline as architecture diagrams.",
    sourceExport: "checkoutSchema",
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
    sourceExport: "checkoutSchema",
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
    sourceExport: "storefrontContext",
    related: ["storefront-context", "order-fulfillment", "language-kinds-and-edges"],
    patterns: ["person-system-container", "group-as-plane"],
    language: ["/reference/language/#nodes"],
    faq: [
      {
        q: "Is KDiagram a C4 modeling tool?",
        a: "It ships C4-friendly kinds and silhouettes. You still write KDiagram, not a separate C4 DSL.",
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
