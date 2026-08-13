import type { ShapeId } from "../types/shapes.ts";
import { BUILTIN_SHAPE_IDS, isKnownShapeId, normalizeShapeId } from "../types/shapes.ts";

/**
 * Capabilities communicate layout/render behavior beyond the visible shape.
 * Example: ERD column cards need row anchors even when themed like a cylinder.
 */
export type NodeCapability =
  | "erd-table"
  | "symbolic"
  | "icon-only"
  | "card"
  | "annotation"
  | "boundary"
  | "messaging"
  | "datastore"
  | "sequence-lifeline";

export type NodeKindCategory =
  | "general"
  | "flowchart"
  | "architecture"
  | "infrastructure"
  | "messaging"
  | "modeling"
  | "state"
  | "git"
  /** Bare geometry ids usable as kinds: `n: diamond "X"`. */
  | "shape";

export type NodeKindDefaults = {
  shape: ShapeId;
  /** Default icon when the author omits `icon:` (suppressed with `icon: none`). */
  icon?: string;
  /** Presentation subtitle (C4 / architecture eyebrow). */
  subtitle: string;
  classNames: string[];
  cssVars: Record<string, string>;
  defaultMinWidth: number;
  defaultMaxWidth: number;
  defaultDepth: number;
  category: NodeKindCategory;
  capabilities: NodeCapability[];
};

type KindSpec = {
  shape: ShapeId;
  subtitle: string;
  category: NodeKindCategory;
  icon?: string;
  min?: number;
  max?: number;
  depth?: number;
  /** Extra CSS classes beyond `flow-node-${id}`. */
  extraClasses?: string[];
  capabilities?: NodeCapability[];
  cssVars?: Record<string, string>;
};

function defineKind(id: string, spec: KindSpec): NodeKindDefaults {
  const caps = new Set<NodeCapability>(spec.capabilities ?? []);
  if (
    spec.shape === "rounded" ||
    spec.shape === "rectangle" ||
    spec.shape === "table" ||
    spec.shape === "boundary"
  ) {
    caps.add("card");
  }
  const shapeId = normalizeShapeId(spec.shape);
  const classNames = [`flow-node-${id}`, `flow-shape-${shapeId}`, ...(spec.extraClasses ?? [])];
  return {
    shape: shapeId,
    icon: spec.icon,
    subtitle: spec.subtitle,
    classNames: [...new Set(classNames)],
    cssVars: spec.cssVars ?? {},
    defaultMinWidth: spec.min ?? 120,
    defaultMaxWidth: spec.max ?? 240,
    defaultDepth: spec.depth ?? 1,
    category: spec.category,
    capabilities: [...caps],
  };
}

function titleCaseKind(kind: string): string {
  const words = kind.replace(/[_-]+/g, " ").trim();
  if (!words) return "Node";
  return words.replace(/\b\w/g, (c) => c.toUpperCase());
}

function sanitizeKindClass(kind: string): string {
  return kind.replace(/[^a-z0-9-]/gi, "") || "generic";
}

/**
 * Built-in semantic node kinds.
 * Geometry is selected via `shape`; meaning via kind + theme (+ optional authored `icon`).
 * Do not invent a unique SVG engine per kind — map onto the shared geometry library.
 */
const BUILTIN_KINDS: Record<string, NodeKindDefaults> = {
  // —— General / annotation ——
  note: defineKind("note", {
    shape: "folded-document",
    subtitle: "Note",
    category: "general",
    min: 120,
    max: 280,
    capabilities: ["annotation"],
  }),
  label: defineKind("label", {
    shape: "rounded",
    subtitle: "Label",
    category: "general",
    min: 64,
    max: 200,
    capabilities: ["annotation", "symbolic"],
  }),
  group: defineKind("group", {
    shape: "boundary",
    subtitle: "Group",
    category: "general",
    min: 160,
    max: 400,
    capabilities: ["boundary"],
  }),
  image: defineKind("image", {
    shape: "rectangle",
    subtitle: "Image",
    category: "general",
    min: 80,
    max: 320,
  }),
  icon: defineKind("icon", {
    shape: "rounded",
    subtitle: "Icon",
    category: "general",
    min: 56,
    max: 96,
    capabilities: ["symbolic", "icon-only"],
  }),

  // —— Flowchart ——
  start: defineKind("start", {
    shape: "pill",
    subtitle: "Start",
    category: "flowchart",
    min: 88,
    max: 160,
    capabilities: ["symbolic"],
  }),
  end: defineKind("end", {
    shape: "pill",
    subtitle: "End",
    category: "flowchart",
    min: 88,
    max: 160,
    capabilities: ["symbolic"],
  }),
  process: defineKind("process", {
    shape: "rounded",
    subtitle: "Process",
    category: "flowchart",
    min: 128,
    max: 260,
  }),
  task: defineKind("task", {
    shape: "rounded",
    subtitle: "Task",
    category: "flowchart",
    min: 120,
    max: 240,
  }),
  subprocess: defineKind("subprocess", {
    shape: "rounded",
    subtitle: "Subprocess",
    category: "flowchart",
    min: 140,
    max: 280,
  }),
  choice: defineKind("choice", {
    shape: "diamond",
    subtitle: "Decision",
    category: "flowchart",
    min: 180,
    max: 360,
  }),
  decision: defineKind("decision", {
    shape: "diamond",
    subtitle: "Decision",
    category: "flowchart",
    min: 180,
    max: 360,
    extraClasses: ["flow-node-choice"],
  }),
  io: defineKind("io", {
    shape: "parallelogram",
    subtitle: "Input / Output",
    category: "flowchart",
    min: 120,
    max: 240,
  }),
  document: defineKind("document", {
    shape: "document",
    subtitle: "Document",
    category: "flowchart",
    min: 120,
    max: 240,
  }),
  preparation: defineKind("preparation", {
    shape: "hexagon",
    subtitle: "Preparation",
    category: "flowchart",
    min: 120,
    max: 220,
  }),
  manual: defineKind("manual", {
    shape: "trapezoid",
    subtitle: "Manual",
    category: "flowchart",
    min: 120,
    max: 240,
  }),
  connector: defineKind("connector", {
    shape: "circle",
    subtitle: "Connector",
    category: "flowchart",
    min: 36,
    max: 56,
    capabilities: ["symbolic"],
  }),

  // —— Architecture / C4 ——
  user: defineKind("user", {
    shape: "person",
    subtitle: "User",
    category: "architecture",
    icon: "user",
    min: 100,
    max: 220,
    extraClasses: ["flow-node-user"],
  }),
  person: defineKind("person", {
    shape: "person",
    subtitle: "Person",
    category: "architecture",
    icon: "user",
    min: 100,
    max: 220,
    extraClasses: ["flow-node-user"],
  }),
  actor: defineKind("actor", {
    shape: "rounded",
    subtitle: "Actor",
    category: "architecture",
    icon: "user",
    min: 120,
    max: 240,
    extraClasses: ["flow-node-actor"],
    capabilities: ["sequence-lifeline"],
  }),
  participant: defineKind("participant", {
    shape: "rounded",
    subtitle: "Participant",
    category: "architecture",
    min: 120,
    max: 240,
    extraClasses: ["flow-node-participant"],
    capabilities: ["sequence-lifeline"],
  }),
  system: defineKind("system", {
    shape: "rounded",
    subtitle: "System",
    category: "architecture",
    min: 176,
    max: 340,
  }),
  external: defineKind("external", {
    shape: "rectangle",
    subtitle: "External",
    category: "architecture",
    min: 120,
    max: 260,
  }),
  container: defineKind("container", {
    shape: "rounded",
    subtitle: "Container",
    category: "architecture",
    min: 148,
    max: 300,
  }),
  component: defineKind("component", {
    shape: "rounded",
    subtitle: "Component",
    category: "architecture",
    min: 120,
    max: 240,
  }),
  service: defineKind("service", {
    shape: "rounded",
    subtitle: "Service",
    category: "architecture",
    min: 128,
    max: 280,
  }),
  application: defineKind("application", {
    shape: "rounded",
    subtitle: "Application",
    category: "architecture",
    min: 140,
    max: 280,
    extraClasses: ["flow-node-service"],
  }),
  module: defineKind("module", {
    shape: "rounded",
    subtitle: "Module",
    category: "architecture",
    min: 120,
    max: 240,
    extraClasses: ["flow-node-service"],
  }),
  package: defineKind("package", {
    shape: "folded-document",
    subtitle: "Package",
    category: "architecture",
    min: 120,
    max: 240,
  }),
  deployment: defineKind("deployment", {
    shape: "rectangle",
    subtitle: "Deployment",
    category: "architecture",
    min: 140,
    max: 280,
    extraClasses: ["flow-node-service"],
  }),

  // —— Infrastructure / cloud ——
  server: defineKind("server", {
    shape: "rectangle",
    subtitle: "Server",
    category: "infrastructure",
    min: 120,
    max: 240,
    extraClasses: ["flow-node-service"],
  }),
  database: defineKind("database", {
    shape: "cylinder",
    subtitle: "Database",
    category: "infrastructure",
    min: 100,
    max: 200,
    capabilities: ["datastore"],
  }),
  cache: defineKind("cache", {
    shape: "cylinder",
    subtitle: "Cache",
    category: "infrastructure",
    min: 100,
    max: 200,
    capabilities: ["datastore"],
    extraClasses: ["flow-node-database"],
  }),
  store: defineKind("store", {
    shape: "cylinder",
    subtitle: "Data store",
    category: "infrastructure",
    min: 100,
    max: 220,
    capabilities: ["datastore"],
    extraClasses: ["flow-node-database"],
  }),
  bucket: defineKind("bucket", {
    shape: "cylinder",
    subtitle: "Object store",
    category: "infrastructure",
    min: 100,
    max: 220,
    capabilities: ["datastore"],
    extraClasses: ["flow-node-database"],
  }),
  queue: defineKind("queue", {
    shape: "queue",
    subtitle: "Queue",
    category: "infrastructure",
    min: 100,
    max: 180,
    capabilities: ["messaging"],
  }),
  topic: defineKind("topic", {
    shape: "stream",
    subtitle: "Topic",
    category: "infrastructure",
    min: 100,
    max: 220,
    capabilities: ["messaging"],
    extraClasses: ["flow-node-stream"],
  }),
  stream: defineKind("stream", {
    shape: "stream",
    subtitle: "Stream",
    category: "infrastructure",
    min: 120,
    max: 260,
    capabilities: ["messaging"],
  }),
  gateway: defineKind("gateway", {
    shape: "hexagon",
    subtitle: "Gateway",
    category: "infrastructure",
    min: 110,
    max: 200,
  }),
  loadbalancer: defineKind("loadbalancer", {
    shape: "hexagon",
    subtitle: "Load balancer",
    category: "infrastructure",
    min: 120,
    max: 220,
    extraClasses: ["flow-node-gateway"],
  }),
  cloud: defineKind("cloud", {
    shape: "cloud",
    subtitle: "Cloud",
    category: "infrastructure",
    min: 140,
    max: 260,
  }),
  firewall: defineKind("firewall", {
    shape: "rectangle",
    subtitle: "Firewall",
    category: "infrastructure",
    min: 100,
    max: 200,
    extraClasses: ["flow-node-gateway"],
  }),
  zone: defineKind("zone", {
    shape: "boundary",
    subtitle: "Zone",
    category: "infrastructure",
    min: 180,
    max: 400,
    capabilities: ["boundary"],
  }),

  // —— Messaging / data flow ——
  broker: defineKind("broker", {
    shape: "hexagon",
    subtitle: "Broker",
    category: "messaging",
    min: 110,
    max: 200,
    capabilities: ["messaging"],
  }),
  event: defineKind("event", {
    shape: "pill",
    subtitle: "Event",
    category: "messaging",
    min: 90,
    max: 180,
    capabilities: ["messaging", "symbolic"],
  }),
  command: defineKind("command", {
    shape: "rounded",
    subtitle: "Command",
    category: "messaging",
    min: 110,
    max: 220,
    capabilities: ["messaging"],
    extraClasses: ["flow-node-service"],
  }),
  message: defineKind("message", {
    shape: "document",
    subtitle: "Message",
    category: "messaging",
    min: 100,
    max: 200,
    capabilities: ["messaging"],
  }),
  worker: defineKind("worker", {
    shape: "rounded",
    subtitle: "Worker",
    category: "messaging",
    min: 110,
    max: 200,
    extraClasses: ["flow-node-service"],
  }),
  producer: defineKind("producer", {
    shape: "rounded",
    subtitle: "Producer",
    category: "messaging",
    min: 110,
    max: 200,
    capabilities: ["messaging"],
    extraClasses: ["flow-node-service"],
  }),
  consumer: defineKind("consumer", {
    shape: "rounded",
    subtitle: "Consumer",
    category: "messaging",
    min: 110,
    max: 200,
    capabilities: ["messaging"],
    extraClasses: ["flow-node-service"],
  }),
  dlq: defineKind("dlq", {
    shape: "queue",
    subtitle: "Dead-letter queue",
    category: "messaging",
    min: 110,
    max: 200,
    capabilities: ["messaging"],
    extraClasses: ["flow-node-queue", "flow-node-warning"],
  }),
  job: defineKind("job", {
    shape: "rounded",
    subtitle: "Job",
    category: "messaging",
    min: 110,
    max: 200,
    extraClasses: ["flow-node-worker"],
  }),

  // —— Modeling / ERD / UML-ish ——
  table: defineKind("table", {
    // Without columns → architecture cylinder; with columns → ERD card (`shape: "table"`).
    shape: "cylinder",
    subtitle: "Table",
    category: "modeling",
    min: 160,
    max: 320,
    capabilities: ["datastore", "erd-table"],
  }),
  entity: defineKind("entity", {
    shape: "cylinder",
    subtitle: "Entity",
    category: "modeling",
    min: 160,
    max: 320,
    capabilities: ["datastore", "erd-table"],
    extraClasses: ["flow-node-table"],
  }),
  class: defineKind("class", {
    shape: "table",
    subtitle: "Class",
    category: "modeling",
    min: 160,
    max: 320,
    capabilities: ["erd-table"],
    extraClasses: ["flow-node-table"],
  }),
  interface: defineKind("interface", {
    shape: "rounded",
    subtitle: "Interface",
    category: "modeling",
    min: 120,
    max: 240,
    extraClasses: ["flow-node-service"],
  }),
  aggregate: defineKind("aggregate", {
    shape: "rounded",
    subtitle: "Aggregate",
    category: "modeling",
    min: 140,
    max: 280,
    extraClasses: ["flow-node-service"],
  }),
  projection: defineKind("projection", {
    shape: "rounded",
    subtitle: "Projection",
    category: "modeling",
    min: 140,
    max: 280,
    extraClasses: ["flow-node-service"],
  }),
  policy: defineKind("policy", {
    shape: "hexagon",
    subtitle: "Policy",
    category: "modeling",
    min: 120,
    max: 220,
    extraClasses: ["flow-node-gateway"],
  }),

  // —— State machine ——
  state: defineKind("state", {
    shape: "rounded",
    subtitle: "State",
    category: "state",
    min: 100,
    max: 200,
  }),
  initial: defineKind("initial", {
    shape: "circle",
    subtitle: "Initial",
    category: "state",
    min: 28,
    max: 40,
    capabilities: ["symbolic"],
  }),
  final: defineKind("final", {
    shape: "circle",
    subtitle: "Final",
    category: "state",
    min: 32,
    max: 48,
    capabilities: ["symbolic"],
  }),
  junction: defineKind("junction", {
    shape: "circle",
    subtitle: "Junction",
    category: "state",
    min: 24,
    max: 36,
    capabilities: ["symbolic"],
  }),
  fork: defineKind("fork", {
    shape: "rectangle",
    subtitle: "Fork",
    category: "state",
    min: 80,
    max: 160,
    capabilities: ["symbolic"],
  }),
  join: defineKind("join", {
    shape: "rectangle",
    subtitle: "Join",
    category: "state",
    min: 80,
    max: 160,
    capabilities: ["symbolic"],
  }),

  // —— Outcomes ——
  success: defineKind("success", {
    shape: "rounded",
    subtitle: "Success",
    category: "flowchart",
    min: 128,
    max: 260,
  }),
  warning: defineKind("warning", {
    shape: "rounded",
    subtitle: "Manual review",
    category: "flowchart",
    min: 128,
    max: 260,
  }),
  failure: defineKind("failure", {
    shape: "rounded",
    subtitle: "Failure",
    category: "flowchart",
    min: 120,
    max: 240,
    extraClasses: ["flow-node-warning"],
  }),

  // —— Git ——
  commit: defineKind("commit", {
    shape: "circle",
    subtitle: "Commit",
    category: "git",
    min: 28,
    max: 44,
    capabilities: ["symbolic"],
  }),
  branch: defineKind("branch", {
    shape: "pill",
    subtitle: "Branch",
    category: "git",
    min: 72,
    max: 160,
    capabilities: ["symbolic"],
  }),
  tag: defineKind("tag", {
    shape: "pill",
    subtitle: "Tag",
    category: "git",
    min: 64,
    max: 140,
    capabilities: ["symbolic"],
  }),
};

/**
 * Bare geometry kinds — shape ids usable directly as DSL kinds.
 * Skips ids already claimed by a semantic kind above (cloud, document, person, queue, …).
 * Those semantic kinds already expose the same geometries.
 */
const GEOMETRY_KIND_SPECS: Record<string, KindSpec> = {
  rectangle: { shape: "rectangle", subtitle: "Rectangle", category: "shape", min: 100, max: 240 },
  rounded: { shape: "rounded", subtitle: "Rounded", category: "shape", min: 100, max: 240 },
  pill: {
    shape: "pill",
    subtitle: "Pill",
    category: "shape",
    min: 88,
    max: 180,
    capabilities: ["symbolic"],
  },
  circle: {
    shape: "circle",
    subtitle: "Circle",
    category: "shape",
    min: 36,
    max: 72,
    capabilities: ["symbolic"],
  },
  ellipse: { shape: "ellipse", subtitle: "Ellipse", category: "shape", min: 100, max: 200 },
  diamond: { shape: "diamond", subtitle: "Diamond", category: "shape", min: 120, max: 280 },
  hexagon: { shape: "hexagon", subtitle: "Hexagon", category: "shape", min: 110, max: 220 },
  triangle: {
    shape: "triangle",
    subtitle: "Triangle",
    category: "shape",
    min: 64,
    max: 140,
    capabilities: ["symbolic"],
  },
  parallelogram: {
    shape: "parallelogram",
    subtitle: "Parallelogram",
    category: "shape",
    min: 120,
    max: 240,
  },
  trapezoid: { shape: "trapezoid", subtitle: "Trapezoid", category: "shape", min: 120, max: 240 },
  "folded-document": {
    shape: "folded-document",
    subtitle: "Folded document",
    category: "shape",
    min: 120,
    max: 240,
    capabilities: ["annotation"],
  },
  cylinder: {
    shape: "cylinder",
    subtitle: "Cylinder",
    category: "shape",
    min: 100,
    max: 200,
    capabilities: ["datastore"],
  },
  boundary: {
    shape: "boundary",
    subtitle: "Boundary",
    category: "shape",
    min: 160,
    max: 400,
    capabilities: ["boundary"],
  },
};

for (const [id, spec] of Object.entries(GEOMETRY_KIND_SPECS)) {
  if (!(id in BUILTIN_KINDS)) {
    BUILTIN_KINDS[id] = defineKind(id, spec);
  }
}

const GENERIC_DEFAULTS: NodeKindDefaults = {
  shape: "rounded",
  subtitle: "Node",
  classNames: ["flow-node-generic"],
  cssVars: {},
  defaultMinWidth: 100,
  defaultMaxWidth: 200,
  defaultDepth: 1,
  category: "general",
  capabilities: ["card"],
};

function geometryDefaultsFor(shapeId: string): NodeKindDefaults {
  const existing = BUILTIN_KINDS[shapeId];
  if (existing) return existing;
  return defineKind(shapeId, {
    shape: shapeId,
    subtitle: titleCaseKind(shapeId),
    category: "shape",
  });
}

export function getKindDefaults(kind: string): { defaults: NodeKindDefaults; isBuiltin: boolean } {
  const defaults = BUILTIN_KINDS[kind];
  if (defaults) return { defaults, isBuiltin: true };

  const shapeId = normalizeShapeId(kind);
  // Shape aliases (`diam`, `hex`, `rect`, `card`, …) resolve to geometry kinds.
  if (shapeId !== kind && isKnownShapeId(shapeId)) {
    return { defaults: geometryDefaultsFor(shapeId), isBuiltin: true };
  }
  if ((BUILTIN_SHAPE_IDS as readonly string[]).includes(kind)) {
    return { defaults: geometryDefaultsFor(kind), isBuiltin: true };
  }

  return {
    defaults: {
      ...GENERIC_DEFAULTS,
      subtitle: titleCaseKind(kind),
      classNames: [`flow-node-${sanitizeKindClass(kind)}`, "flow-node-generic"],
    },
    isBuiltin: false,
  };
}

export function isBuiltinKind(kind: string): boolean {
  return getKindDefaults(kind).isBuiltin;
}

/**
 * True when `kind` names a built-in shape (or alias): `diamond`, `hex`, `cloud`, …
 * Semantic kinds that share a shape id (`cloud`, `document`, `person`, `queue`) count —
 * they are usable as both meaning and geometry. ERD `table` is excluded.
 */
export function isGeometryKind(kind: string): boolean {
  const shapeId = normalizeShapeId(kind);
  if (!isKnownShapeId(shapeId) || shapeId === "table") return false;
  if (shapeId !== kind) return true;
  return kind === shapeId && (BUILTIN_SHAPE_IDS as readonly string[]).includes(kind);
}

export function kindHasCapability(kind: string, capability: NodeCapability): boolean {
  return getKindDefaults(kind).defaults.capabilities.includes(capability);
}

/** Human-readable kind subtitle for presentation chrome. */
export function kindSubtitle(kind: string): string {
  return getKindDefaults(kind).defaults.subtitle;
}

export function listKindsByCategory(category: NodeKindCategory): string[] {
  return Object.entries(BUILTIN_KINDS)
    .filter(([, d]) => d.category === category)
    .map(([id]) => id)
    .sort();
}

/**
 * Shape ids usable directly as kinds (excludes ERD `table`, which stays semantic-only).
 * Includes semantic synonyms that share a shape id (`cloud`, `document`, `person`, `queue`).
 */
export function listGeometryKinds(): string[] {
  return BUILTIN_SHAPE_IDS.filter((id) => id !== "table" && id in BUILTIN_KINDS).sort();
}

export const BUILTIN_KIND_LIST = Object.keys(BUILTIN_KINDS).sort();

export const BUILTIN_KIND_CATALOG: Readonly<Record<string, NodeKindDefaults>> = BUILTIN_KINDS;
