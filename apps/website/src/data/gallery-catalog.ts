/** Gallery metadata — dogfood examples + inbound slug aliases.
 * Sources live in examples.ts (`loadExample` / inline teaching beats).
 * Corpus index: examples/catalog.json
 */

export type GalleryCluster =
  | "system-maps"
  | "event-pipelines"
  | "workflows"
  | "state"
  | "data-models"
  | "presentation"
  | "language-atlas";

export type GalleryExample = {
  /** Canonical URL slug under /gallery/<id>/ */
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

export const CLUSTER_LABELS: Record<GalleryCluster, string> = {
  "system-maps": "System maps",
  "event-pipelines": "Event pipelines",
  workflows: "Workflows",
  state: "State machines",
  "data-models": "Data models",
  presentation: "Presentation",
  "language-atlas": "Language atlas",
};

export const CLUSTER_ORDER: GalleryCluster[] = [
  "system-maps",
  "event-pipelines",
  "workflows",
  "state",
  "data-models",
  "presentation",
  "language-atlas",
];

export const DEFAULT_GALLERY_EXAMPLE = "order-fulfillment";

export const GALLERY_EXAMPLES: GalleryExample[] = [
  {
    id: "storefront-model",
    title: "Storefront — shared model with views",
    description: "One `kdiagram 2` model with context, container, and component lenses.",
    blurb:
      "Switch views in the live host: context shows the platform summary node; containers opens the commerce boundary; components drills into the API application.",
    cluster: "system-maps",
    sourceExport: "storefrontModel",
    tryThis:
      "Use the view picker to flip between Context, containers, and components, then edit a node and watch every lens stay in sync.",
    patterns: ["person-system-container", "group-as-plane"],
    language: ["/design/architecture/", "/reference/language/#models-and-views-kdiagram-2-draft"],
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
    id: "order-event-storm",
    title: "Order domain — event storm",
    description:
      "Discovery timeline: commands, events, aggregates, and policies from browse to fulfill.",
    blurb:
      "Event storming on the commerce story — not a runtime topology. Play Place order to walk PlaceOrder → OrderPlaced.",
    cluster: "event-pipelines",
    sourceExport: "orderEventStorm",
    tryThis: "Play the `Place order` animation, or add a `Cancel order` command after OrderPlaced.",
    patterns: ["sync-vs-event", "group-as-plane"],
    language: ["/design/ddd/", "/reference/language/#nodes"],
  },
  {
    id: "commerce-context-map",
    title: "Commerce bounded contexts",
    description: "How Identity, Catalog, Ordering, Payments, and Fulfillment relate.",
    blurb: "A DDD context map with plain-language relationship labels — not a C4 system context.",
    cluster: "system-maps",
    sourceExport: "commerceContextMap",
    tryThis: "Play `Checkout integration`, or label another edge as shared kernel if you add one.",
    patterns: ["group-as-plane", "sync-vs-event"],
    language: ["/design/ddd/", "/design/architecture/"],
  },
  {
    id: "order-aggregate",
    title: "Order aggregate",
    description: "Order root, line entity, money value object, and a currency invariant.",
    blurb: "What PlaceOrder must keep consistent in one transaction — not hexagonal adapters.",
    cluster: "system-maps",
    sourceExport: "orderAggregate",
    tryThis:
      "Play the `PlaceOrder` animation, or add a shipping-address entity inside the boundary.",
    patterns: ["group-as-plane"],
    language: ["/design/ddd/", "/reference/language/#nodes"],
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
    id: "expense-approval",
    title: "Expense approval",
    description: "True swimlanes: employee, automated controls, and manager from submit to pay.",
    blurb:
      "Horizontal responsibility bands with a shared left-to-right timeline — play Needs correction or Approved.",
    cluster: "workflows",
    sourceExport: "expenseApproval",
    tryThis: "Play the `Needs correction` animation, or add a finance lane for payout.",
    patterns: ["workflow-branches"],
    language: ["/design/workflows/", "/design/layout/"],
  },
  {
    id: "refund-request",
    title: "Customer refund request",
    description: "Owner-column workflow from request through approval and payout.",
    blurb:
      "Eligibility, inspection, auto-approve vs manager review, Stripe refund, and email — Support and Finance columns, not swimlanes.",
    cluster: "workflows",
    sourceExport: "refundRequest",
    tryThis: "Play the `Denied` animation, or raise the auto-approve path priority.",
    patterns: ["workflow-branches", "density-and-crossings"],
    language: ["/design/workflows/", "/reference/language/#nodes"],
  },
  {
    id: "order-lifecycle",
    title: "Order lifecycle",
    description: "Legal order statuses with guarded transitions and terminal outcomes.",
    blurb:
      "First-class `state` diagram — placed through shipped, with declined and cancelled finals.",
    cluster: "state",
    sourceExport: "orderLifecycle",
    tryThis: "Add a `Held` state with a release transition, or another final for expired holds.",
    patterns: ["workflow-branches"],
    language: ["/design/state-machines/", "/reference/language/"],
  },
  {
    id: "checkout-schema",
    title: "Checkout schema",
    description:
      "ERD for identity, catalog, and orders: parameterized types, keys, crow’s-foot cardinality, and schema groups.",
    blurb:
      "Eight tables with varchar/numeric types, PK/UK/FK/NN, optional vs required crow’s feet, identifying 1:1, a unique payment, composite order lines, and billing vs shipping FKs to the same address table.",
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

/**
 * Retired intent landings and historical gallery slugs → canonical example ids.
 * Astro redirects keep inbound URLs working.
 */
export const GALLERY_SLUG_ALIASES: Record<string, string> = {
  "architecture-diagram": "order-fulfillment",
  "event-driven": "order-placed-events",
  workflows: "expense-approval",
  ddd: "commerce-context-map",
  "event-storm": "order-event-storm",
  "event-storming": "order-event-storm",
  "context-map": "commerce-context-map",
  aggregate: "order-aggregate",
  swimlane: "expense-approval",
  swimlanes: "expense-approval",
  "state-machines": "order-lifecycle",
  erd: "checkout-schema",
  "database-diagram": "checkout-schema",
  c4: "storefront-model",
  storefront: "storefront-model",
  "storefront-context": "storefront-model",
  "storefront-containers": "storefront-model",
  "storefront-components": "storefront-model",
  "checkout-architecture": "order-fulfillment",
  "enterprise-rag": "order-fulfillment",
  "layered-architecture": "order-hexagon",
  "hexagonal-architecture": "order-hexagon",
  "order-placed-pipeline": "order-placed-events",
  "customer-refund-request": "refund-request",
  "temporal-order-workflow": "order-fulfillment",
  "temporal-order-workflow-sequence": "order-fulfillment-sequence",
  "platform-grid": "order-fulfillment",
  "platform-spans": "order-fulfillment",
  "presentation-slide": "order-review-slide",
};

export function exampleById(id: string): GalleryExample | undefined {
  return GALLERY_EXAMPLES.find((item) => item.id === id);
}

export function galleryPath(id: string): string {
  return `/gallery/${id}/`;
}

export function examplesByCluster(): Array<{
  cluster: GalleryCluster;
  label: string;
  items: GalleryExample[];
}> {
  return CLUSTER_ORDER.map((cluster) => ({
    cluster,
    label: CLUSTER_LABELS[cluster],
    items: GALLERY_EXAMPLES.filter((item) => item.cluster === cluster),
  })).filter((group) => group.items.length > 0);
}

export function resolveGallerySlug(slug: string | undefined): GalleryExample | undefined {
  if (!slug) return undefined;
  const direct = exampleById(slug);
  if (direct) return direct;
  const aliased = GALLERY_SLUG_ALIASES[slug];
  return aliased ? exampleById(aliased) : undefined;
}

/** Trailing-slash paths for Astro `redirects`. */
export function galleryAstroRedirects(): Record<string, string> {
  const redirects: Record<string, string> = {
    "/use-cases/architecture": "/gallery/order-fulfillment/",
    "/use-cases/c4": "/gallery/storefront-model/",
    "/use-cases/event-flows": "/gallery/order-placed-events/",
    "/use-cases/event-driven": "/gallery/order-placed-events/",
    "/use-cases/workflows": "/gallery/expense-approval/",
    "/use-cases/data-models": "/gallery/checkout-schema/",
    "/gallery/layout-craft/": "/design/layout/",
  };
  for (const [slug, exampleId] of Object.entries(GALLERY_SLUG_ALIASES)) {
    redirects[`/gallery/${slug}/`] = galleryPath(exampleId);
  }
  return redirects;
}
