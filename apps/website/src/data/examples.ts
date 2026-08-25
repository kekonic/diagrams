/** Shared KDiagram sources used across docs pages.
 * Dogfood diagrams load from repo-root examples/*.kdiagram (single source of truth).
 * Teaching beats (tinyFirst, icon paint, …) stay inline below.
 */

const exampleModules = import.meta.glob<string>("../../../../examples/*.kdiagram", {
  query: "?raw",
  import: "default",
  eager: true,
});

function loadExample(id: string): string {
  const suffix = `/${id}.kdiagram`;
  const entry = Object.entries(exampleModules).find(([path]) => path.endsWith(suffix));
  if (!entry) {
    throw new Error(`Missing examples/${id}.kdiagram (website dogfood)`);
  }
  return entry[1].replace(/^\uFEFF/, "").trimEnd() + "\n";
}

// —— Dogfood (examples/*.kdiagram; see examples/catalog.json) ——
export const storefrontContext = loadExample("storefront-context");
export const storefrontContainers = loadExample("storefront-containers");
export const storefrontComponents = loadExample("storefront-components");
export const orderFulfillment = loadExample("order-fulfillment");
export const orderHexagon = loadExample("order-hexagon");
export const orderPlacedEvents = loadExample("order-placed-events");
export const orderFulfillmentSequence = loadExample("order-fulfillment-sequence");
export const orderLifecycle = loadExample("order-lifecycle");
export const refundRequest = loadExample("refund-request");
export const checkoutSchema = loadExample("checkout-schema");
export const orderReviewSlide = loadExample("order-review-slide");
export const languageKindsAndEdges = loadExample("language-kinds-and-edges");
/** Alias — language atlas kinds/edges catalog. */
export const languageShowcase = languageKindsAndEdges;
export const geometryKinds = loadExample("geometry-kinds");
export const architectureIcons = loadExample("architecture-icons");

// —— Docs-only teaching beats ——
export const iconPaintCompare = `diagram "Icon colors" {
  direction LR

  presentation {
    title: "Icon colors"
    titleSubtitle: "brand logos by default / iconColor tints the glyph only"
  }

  layout {
    density: comfortable
  }

  group brandGroup "Brand (default)" {
    padding: roomy
    arrange: pack
    gap: comfortable

    aws: cloud "AWS" {
      icon: logos:aws
      subtitle: "keeps logo colors"
    }
    stripe: external "Stripe" {
      icon: simple-icons:stripe
      subtitle: "keeps logo colors"
    }
  }

  group tintGroup "iconColor" {
    padding: roomy
    arrange: pack
    gap: comfortable

    cart: service "Checkout" {
      icon: shopping-cart
      iconColor: #f97316
      subtitle: "glyph only"
    }
    api: gateway "API" {
      icon: waypoints
      iconColor: #38bdf8
      subtitle: "shell unchanged"
    }
  }
}`;

export const nodeColors = `diagram "Node colors" {
  direction LR

  presentation {
    title: "Coloring nodes"
    titleSubtitle: "Built-in semantic styles / custom style blocks / iconColor"
  }

  layout {
    density: comfortable
  }

  style hot {
    --node-stroke: #f97316
    --node-fill: #431407
  }

  style coolIcon {
    --icon-color: #38bdf8
  }

  checkout: service "Checkout" {
    icon: shopping-cart
    styles: [hot]
  }

  api: gateway "API" {
    icon: waypoints
    iconColor: #38bdf8
  }

  pay: external "Stripe" {
    icon: simple-icons:stripe
  }

  alert: service "Alerts" {
    icon: bell
    styles: [coolIcon]
  }

  declined: service "Declined" {
    icon: circle-x
    styles: [danger]
  }

  ready: service "Ready" {
    icon: circle-check
    styles: [success]
  }

  legacy: service "Legacy" {
    icon: archive
    styles: [muted]
  }
}`;

export const nodeSubtitles = `diagram "Subtitles" {
  direction LR

  presentation {
    title: "Subtitles"
    titleSubtitle: "Authored caption vs kind eyebrow"
  }

  layout {
    density: comfortable
  }

  custom: service "Checkout" {
    icon: shopping-cart
    subtitle: "Owns payment intents"
  }

  kindEyebrow: service "Inventory" {
    icon: package
    subtitle: true
  }

  plain: service "Billing" {
    icon: credit-card
  }
}`;

export const nodeScaleAndNotes = `diagram "Scale & notes" {
  direction LR

  presentation {
    title: "Scale & notes"
  }

  layout {
    density: comfortable
  }

  hub: gateway "API Gateway" {
    icon: waypoints
    scale: 1.25
    note: "public edge"
  }

  worker: service "Worker" {
    icon: cog
    scale: 0.9
    note: "async"
  }

  db: database "Orders" {
    icon: database
    minWidth: 160
  }

  hub -> worker
  worker -> db
}`;

export const archEdgeSemantics = `diagram "Edge operators" {
  direction LR

  ranking: service "Improve ranking"
  generator: service "Generator"
  histStore: database "History storage"
  telemetry: service "Telemetry"
  bus: broker "Event bus"

  ranking -> generator
  generator => bus "ResponseReady"
  generator ..> histStore
  generator ..> telemetry
}`;

export const eventPublishShape = `diagram "Publish once, fan out" {
  direction LR

  checkout: service "Checkout"
  bus: broker "Event bus"
  inventory: worker "Inventory"
  email: worker "Email"
  analytics: worker "Analytics"

  checkout => bus "OrderPlaced"
  bus -> inventory
  bus -> email
  bus -> analytics
}`;

export const workflowBranchKinds = `diagram "Policy fork" {
  direction TD
  layout { density: comfortable }
  edges { route: metro crossings: jumps }

  start: user "Submit request"
  check: choice "Within policy?"
  auto: success "Auto-approve"
  review: warning "Manual review"
  pay: service "Payment"
  denied: warning "Notify customer"
  done: event "RefundIssued"

  start -> check
  check -> auto "yes"
  check -> review "no"
  auto -> pay
  review -> pay "approve"
  review -x denied "reject"
  pay => done
}`;

/** Docs-only ERD teaching beats — data-models how-to. Gallery uses checkoutSchema. */
export const erdDeclareTable = `diagram "Declare a table" {
  direction LR
  layout {
    density: compact
    groupLayout: flat
    nodePlacement: basic
  }
  edges { route: orthogonal crossings: gaps }
  presentation { groupAccent: false }

  customers: table "customers" {
    note: "Account holder"
    columns {
      id: uuid PK
      email: varchar(320) UK NN
      credit_limit: numeric(10,2)
      created_at: timestamptz NN
      default_locale: text NN // en|es
    }
  }
}`;

export const erdCardinality = `diagram "Optional vs required" {
  direction LR
  layout {
    density: compact
    groupLayout: flat
    nodePlacement: basic
  }
  edges { route: orthogonal crossings: gaps }
  presentation { groupAccent: false }

  customers: table "customers" {
    columns {
      id: uuid PK
      email: varchar(320) UK NN
    }
  }

  orders: table "orders" {
    columns {
      id: uuid PK
      customer_id: uuid FK NN -> customers.id
      status: text NN
    }
  }

  wishlists: table "wishlists" {
    columns {
      id: uuid PK
      customer_id: uuid FK -> customers.id
      name: text NN
    }
  }
}`;

export const erdOneToOne = `diagram "1:1 dashed and identifying" {
  direction LR
  layout {
    density: compact
    groupLayout: flat
    nodePlacement: basic
  }
  edges { route: orthogonal crossings: gaps }
  presentation { groupAccent: false }

  customers: table "customers" {
    columns {
      id: uuid PK
      email: varchar(320) UK NN
    }
  }

  customer_profiles: table "customer_profiles" {
    columns {
      customer_id: uuid PK FK NN -> customers.id
      phone: text
    }
  }

  orders: table "orders" {
    columns {
      id: uuid PK
      customer_id: uuid FK NN -> customers.id
    }
  }

  payments: table "payments" {
    columns {
      id: uuid PK
      order_id: uuid FK UK NN -> orders.id
      amount: numeric(10,2) NN
    }
  }
}`;

export const erdComposite = `diagram "Composite keys" {
  direction LR
  layout {
    density: compact
    groupLayout: flat
    nodePlacement: basic
  }
  edges { route: orthogonal crossings: gaps }
  presentation { groupAccent: false }

  orders: table "orders" {
    columns {
      id: uuid PK
      status: text NN
    }
  }

  order_items: table "order_items" {
    columns {
      order_id: uuid PK FK NN -> orders.id
      line_no: int PK NN
      qty: int NN
      unit_price: numeric(10,2) NN
    }
  }

  line_taxes: table "line_taxes" {
    columns {
      order_id: uuid PK FK NN -> order_items.order_id
      line_no: int PK FK NN -> order_items.line_no
      tax_code: text PK NN
      rate: numeric(10,2) NN
    }
  }
}`;

export const erdFanOut = `diagram "Two FKs to the same parent" {
  direction LR
  layout {
    density: compact
    groupLayout: flat
    nodePlacement: basic
  }
  edges { route: orthogonal crossings: gaps }
  presentation { groupAccent: false }

  addresses: table "addresses" {
    columns {
      id: uuid PK
      line1: text NN
      country: char(2) NN
    }
  }

  orders: table "orders" {
    columns {
      id: uuid PK
      billing_address_id: uuid FK NN -> addresses.id
      shipping_address_id: uuid FK -> addresses.id
      total: numeric(10,2) NN
    }
  }
}`;

export const erdOverride = `diagram "Override inference" {
  direction LR
  layout {
    density: compact
    groupLayout: flat
    nodePlacement: basic
  }
  edges { route: orthogonal crossings: gaps }
  presentation { groupAccent: false }

  orders: table "orders" {
    columns {
      id: uuid PK
      status: text NN
    }
  }

  fulfillments: table "fulfillments" {
    note: "Inferred: dashed 1:N"
    columns {
      id: uuid PK
      order_id: uuid FK NN -> orders.id
    }
  }

  shipments: table "shipments" {
    note: "Overridden: identifying"
    columns {
      id: uuid PK
      order_id: uuid FK NN -> orders.id
    }
  }

  orders.id -> shipments.order_id { identifying: true, cardinality: "1:N" }
}`;

export const erdGroups = `diagram "Schema groups" {
  direction LR
  layout {
    density: compact
    groupLayout: compound
    nodePlacement: basic
  }
  edges { route: orthogonal crossings: gaps }
  presentation { groupAccent: false }

  group identity "Identity" {
    customers: table "customers" {
      columns {
        id: uuid PK
        email: varchar(320) UK NN
      }
    }

    addresses: table "addresses" {
      columns {
        id: uuid PK
        customer_id: uuid FK NN -> customers.id
        country: char(2) NN
      }
    }
  }

  group sales "Orders" {
    orders: table "orders" {
      columns {
        id: uuid PK
        customer_id: uuid FK NN -> customers.id
        status: text NN
      }
    }
  }
}`;

export const kdiagramPipeline = `diagram "KDiagram pipeline" {
  direction LR

  layout {
    density: comfortable
    groupLayout: compound
    nodePlacement: straight
  }

  edges {
    route: metro
    crossings: jumps
  }

  group author "Author" {
    src: entity "KDiagram source"
  }

  group core "Core" {
    parse: service "Parse"
    compile: service "Compile"
    graph: entity "GraphModel"
  }

  group engine "Engine" {
    measure: service "Measure"
    elk: service "ELK layout"
    post: worker "Labels / crossings / trim"
  }

  group out "Output" {
    svgOut: success "SVG"
  }

  src -> parse
  parse -> compile
  compile -> graph
  graph -> measure
  measure -> elk
  elk -> post
  post -> svgOut
}`;

export const tinyFirstShell = `diagram {
  direction LR
}`;

export const tinyFirstNodes = `diagram {
  direction LR
  api: gateway "API"
  db: database "Postgres"
}`;

export const tinyFirst = `diagram {
  direction LR
  api: gateway "API"
  db: database "Postgres"
  api -> db "query"
}`;

export const tinyFirstGrouped = `diagram {
  direction LR

  group app "Application" {
    api: gateway "API"
    checkout: service "Checkout"
  }

  db: database "Postgres"
  api -> checkout
  checkout -> db "query"
}`;

export const tinyFirstPlus = `diagram {
  direction LR
  api: gateway "API"
  checkout: service "Checkout"
  db: database "Postgres"
  bus: broker "Events"
  api -> checkout
  checkout -> db "write"
  checkout => bus "OrderPlaced"
}`;

/** Pattern recipes — small teaching beats. */
export const patternSyncVsEvent = `diagram "Sync vs event" {
  direction LR

  layout { density: comfortable }

  api: gateway "API"
  checkout: service "Checkout"
  bus: broker "Events"
  mail: worker "Notifier"

  api -> checkout "POST /orders"
  checkout => bus "OrderPlaced"
  bus => mail "deliver"
}`;

export const patternGroupPlane = `diagram "Group as a plane" {
  direction LR

  layout { density: comfortable }

  group app "Application" {
    padding: roomy
    icon: layout-template
    api: gateway "API"
    checkout: service "Checkout"
  }

  group data "Data" {
    padding: roomy
    icon: logos:postgresql
    db: database "Postgres"
    bus: broker "Event bus"
  }

  api -> checkout
  checkout -> db "write"
  checkout => bus "OrderPlaced"
}`;

export const patternWorkflowBranches = `diagram "Refund decision" {
  direction LR

  layout { density: comfortable }
  edges { route: metro; crossings: smart }

  start: process "Request refund"
  check: choice "Within policy?"
  ok: success "Approve"
  warn: warning "Manual review"
  fail: failure "Decline"

  start -> check
  check -> ok "yes" { priority: high }
  check -> warn "maybe"
  check -x fail "no"
}`;

export const patternDensity = `diagram "Density knobs" {
  direction LR

  presentation {
    title: "Density"
    titleSubtitle: "Try comfortable vs spacious in layout { }"
  }

  layout {
    density: comfortable
  }

  edges {
    crossings: smart
  }

  a: service "A"
  b: service "B"
  c: service "C"
  d: service "D"
  e: broker "Bus"

  a -> b
  a -> c
  b -> d
  c -> d
  d => e "done"
  b => e "side"
}`;

export const patternC4Kinds = `diagram "C4 system context" {
  direction TD

  layout { density: spacious }
  presentation { showKindSubtitles: true }

  customer: person "Customer" {
    description: "A shopper placing an order."
  }

  boundary company "Commerce Co." {
    shop: system "Commerce platform" {
      description: "The software system of interest."
    }
  }

  stripe: external "Stripe" {
    description: "Authorizes card payments."
  }

  customer -> shop "Places orders [HTTPS]"
  shop -> stripe "Authorizes payments [HTTPS]"
}`;
