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
    description: "One `kdiagram 2` model with context and container lenses.",
    blurb:
      "Switch views in the live host: C4 context collapses the platform; containers opens the same topology without duplicating the model.",
    cluster: "system-maps",
    sourceExport: "storefrontModel",
    tryThis:
      "Use the view picker to flip between context and containers, then edit a node and watch both lenses stay in sync.",
    patterns: ["person-system-container", "group-as-plane"],
    language: ["/design/architecture/", "/reference/language/#models-and-views-kdiagram-2-draft"],
  },
  {
    id: "storefront-context",
    title: "Storefront — system context",
    description: "C4 context: customer, commerce platform, and external software systems.",
    blurb:
      "Who uses the storefront and which outside software systems it depends on — Stripe, warehouse, and email.",
    cluster: "system-maps",
    sourceExport: "storefrontContext",
    tryThis:
      "Prefer Storefront — shared model with views for the same picture derived from one model. At this level do not add internal applications or databases.",
    patterns: ["person-system-container", "group-as-plane"],
    language: ["/design/architecture/", "/reference/language/#nodes"],
  },
  {
    id: "storefront-containers",
    title: "Storefront — containers",
    description: "C4 container view: applications and stores inside the commerce platform.",
    blurb:
      "Web application, API, databases, inventory, and notification worker — one software system opened.",
    cluster: "system-maps",
    sourceExport: "storefrontContainers",
    tryThis:
      "Prefer Storefront — shared model with views for the containers lens without a second source file.",
    patterns: ["person-system-container", "group-as-plane"],
    language: ["/design/architecture/", "/reference/language/#nodes"],
  },
  {
    id: "storefront-components",
    title: "API application — components",
    description: "C4 component view: internals of the API application container.",
    blurb:
      "Controller, order service, payment client, repository, and outbox publisher — neighboring containers stay closed.",
    cluster: "system-maps",
    sourceExport: "storefrontComponents",
    tryThis: "Rename a component, or add a `description` that states its responsibility.",
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
  workflows: "refund-request",
  "state-machines": "order-lifecycle",
  erd: "checkout-schema",
  "database-diagram": "checkout-schema",
  c4: "storefront-model",
  storefront: "storefront-model",
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
    "/use-cases/workflows": "/gallery/refund-request/",
    "/use-cases/data-models": "/gallery/checkout-schema/",
    "/gallery/layout-craft/": "/design/layout/",
  };
  for (const [slug, exampleId] of Object.entries(GALLERY_SLUG_ALIASES)) {
    redirects[`/gallery/${slug}/`] = galleryPath(exampleId);
  }
  return redirects;
}
