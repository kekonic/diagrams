import type { Diagnostic } from "../types/geometry.ts";
import type {
  CompileResult,
  GraphEdge,
  GraphModel,
  GraphNode,
  StyleDefinition,
} from "../types/graph.ts";
import type {
  SequenceActivation,
  SequenceDivider,
  SequenceFragment,
  SequenceFragmentOperand,
  SequenceIR,
  SequenceMessage,
  SequenceMessageKind,
  SequenceNote,
} from "../types/sequence.ts";
import type {
  EdgeAst,
  KDiagramAst,
  NodeAst,
  SequenceAst,
  SequenceFragmentAst,
  SequenceStatementAst,
  AnimationBlockAst,
} from "../parser/ast.ts";
import { getKindDefaults } from "./kinds.ts";
import { isKnownShapeId, normalizeShapeId } from "../types/shapes.ts";
import { compileAnimationBlocks } from "./compile-animations.ts";
import {
  mergePresentationOptions,
  presentationFromProperties,
  type PresentationOptions,
} from "../types/presentation.ts";
import type { LayoutOptions, RenderOptions, RoutingOptions } from "../types/graph.ts";
import { normalizeDirection } from "./direction.ts";
import { classifyBranch, normalizeBranch } from "../types/branch.ts";

function edgeOpToSequenceKind(op: EdgeAst["op"], from: string, to: string): SequenceMessageKind {
  if (from === "*") return "found";
  if (to === "*") return "lost";
  switch (op) {
    case "-->":
      return "return";
    case "~>":
    case "<~":
    case "=>":
    case "<=":
      return "async";
    case "-x":
    case "x-":
      return "failure";
    default:
      return "sync";
  }
}

function collectStyleRefsFromProperties(properties: Record<string, unknown>): string[] {
  const raw = properties.styles ?? properties.style;
  if (Array.isArray(raw)) return raw.map(String);
  if (typeof raw === "string") return [raw];
  return [];
}

function collectUnresolvedVars(properties: Record<string, unknown>): Record<string, string> {
  const vars: Record<string, string> = {};
  for (const [key, value] of Object.entries(properties)) {
    if (typeof value !== "string" && typeof value !== "number" && typeof value !== "boolean") {
      continue;
    }
    if (key.startsWith("--") || key === "iconColor") {
      if (key === "iconColor") vars["--icon-color"] = String(value);
      else if (key.startsWith("--")) vars[key] = String(value);
    }
  }
  return vars;
}

function materializeNode(
  stmt: NodeAst,
  nodes: Map<string, GraphNode>,
  diagnostics: Diagnostic[],
): GraphNode | null {
  if (nodes.has(stmt.id)) {
    diagnostics.push({
      severity: "error",
      code: "FM101",
      message: `Duplicate participant id "${stmt.id}"`,
      range: stmt.range,
    });
    return nodes.get(stmt.id) ?? null;
  }

  const { defaults, isBuiltin } = getKindDefaults(stmt.kind);
  if (!isBuiltin) {
    diagnostics.push({
      severity: "warning",
      code: "FM102",
      message: `Unknown node kind "${stmt.kind}" — using generic defaults`,
      range: stmt.range,
      hint: "Any kind can be a sequence lifeline; prefer participant, actor, or architecture kinds.",
    });
  }
  const rawShape = stmt.properties.shape != null ? String(stmt.properties.shape) : undefined;
  const shapeOverride = rawShape ? normalizeShapeId(rawShape) : undefined;
  if (rawShape && !isKnownShapeId(shapeOverride)) {
    diagnostics.push({
      severity: "warning",
      code: "FM111",
      message: `Unknown shape "${rawShape}"`,
      range: stmt.range,
    });
  }
  const styleRefs = [...collectStyleRefsFromProperties(stmt.properties), ...stmt.styleRefs];
  const unresolvedVars = {
    ...defaults.cssVars,
    ...collectUnresolvedVars(stmt.properties),
  };
  const rawIcon = stmt.properties.icon != null ? String(stmt.properties.icon) : undefined;
  const icon =
    rawIcon === "none"
      ? undefined
      : rawIcon !== undefined
        ? rawIcon
        : defaults.shape === "person"
          ? undefined
          : defaults.icon;
  const authoredPaint =
    stmt.properties.iconPaint != null ? String(stmt.properties.iconPaint).toLowerCase() : undefined;
  const iconPaint =
    authoredPaint === "theme" || authoredPaint === "brand" ? authoredPaint : undefined;
  const iconColor =
    stmt.properties.iconColor != null && String(stmt.properties.iconColor).length > 0
      ? String(stmt.properties.iconColor)
      : undefined;
  const nodeVars = {
    ...unresolvedVars,
    ...(iconColor ? { "--icon-color": iconColor } : {}),
  };
  const node: GraphNode = {
    id: stmt.id,
    label: stmt.label ?? stmt.id,
    labelAuthored: stmt.label != null,
    kind: stmt.kind,
    shape: shapeOverride ?? defaults.shape,
    icon,
    iconPaint,
    iconColor,
    minWidth: defaults.defaultMinWidth,
    maxWidth: defaults.defaultMaxWidth,
    depth: defaults.defaultDepth,
    styleRefs,
    unresolvedVars: Object.keys(nodeVars).length ? nodeVars : undefined,
    sourceRange: stmt.range,
  };
  nodes.set(stmt.id, node);
  return node;
}

type SeqCtx = {
  nodes: Map<string, GraphNode>;
  edges: GraphEdge[];
  styles: StyleDefinition[];
  diagnostics: Diagnostic[];
  participantOrder: string[];
  messages: SequenceMessage[];
  activations: SequenceActivation[];
  fragments: SequenceFragment[];
  notes: SequenceNote[];
  dividers: SequenceDivider[];
  autonumber: boolean;
  order: number;
  edgeCounter: number;
  /** Open activation stacks per participant (explicit activate). */
  openActivations: Map<
    string,
    { id: string; startOrder: number; range?: SequenceMessage["sourceRange"] }[]
  >;
  /** Auto sync-call stack for return pairing + auto-activate. */
  callStack: { messageId: string; to: string; from: string }[];
  nextActId: number;
  nextFragId: number;
  nextNoteId: number;
  nextDivId: number;
};

function nextOrder(ctx: SeqCtx): number {
  const o = ctx.order;
  ctx.order += 1;
  return o;
}

function ensureParticipant(ctx: SeqCtx, id: string, range: SequenceMessage["sourceRange"]): void {
  if (id === "*" || !id) return;
  if (!ctx.nodes.has(id)) {
    ctx.diagnostics.push({
      severity: "error",
      code: "FM147",
      message: `Unknown participant "${id}" — declare with \`id: kind "Label"\` before use`,
      range: range ?? {
        start: { line: 1, column: 1, offset: 0 },
        end: { line: 1, column: 1, offset: 0 },
      },
    });
  } else if (!ctx.participantOrder.includes(id)) {
    ctx.participantOrder.push(id);
  }
}

function pushMessage(
  ctx: SeqCtx,
  partial: Omit<SequenceMessage, "id" | "order"> & { id?: string },
  edgeMeta?: { styleRefs?: string[]; branch?: GraphEdge["branch"] },
): SequenceMessage {
  const order = nextOrder(ctx);
  const id = partial.id ?? `msg${ctx.edgeCounter++}`;
  const msg: SequenceMessage = { ...partial, id, order };
  ctx.messages.push(msg);

  const styleRefs = edgeMeta?.styleRefs ?? [];
  const branch = edgeMeta?.branch ?? (msg.label != null ? classifyBranch(msg.label) : undefined);

  // Mirror as GraphEdge for animation / tooling (skip found/lost ghosts without both ends).
  if (msg.from && msg.to && msg.from !== "*" && msg.to !== "*") {
    ctx.edges.push({
      id,
      from: msg.from,
      to: msg.to,
      label: msg.label,
      labelAuthored: msg.labelAuthored,
      kind:
        msg.kind === "async"
          ? "eventual"
          : msg.kind === "failure"
            ? "failure"
            : msg.kind === "return"
              ? "dependency"
              : msg.kind === "destroy"
                ? "failure"
                : "sync",
      arrows: "end",
      styleRefs,
      branch: branch === "neutral" ? undefined : branch,
      sequenceOrder: order,
      sequenceKind: msg.kind,
      sourceRange: msg.sourceRange,
    });
  }

  return msg;
}

function closeActivation(ctx: SeqCtx, participantId: string, endOrder: number): void {
  const stack = ctx.openActivations.get(participantId);
  if (!stack || stack.length === 0) return;
  const open = stack.pop()!;
  ctx.activations.push({
    id: open.id,
    participantId,
    startOrder: open.startOrder,
    endOrder,
    sourceRange: open.range,
  });
}

function openActivation(
  ctx: SeqCtx,
  participantId: string,
  startOrder: number,
  range?: SequenceMessage["sourceRange"],
): void {
  const stack = ctx.openActivations.get(participantId) ?? [];
  stack.push({ id: `act${ctx.nextActId++}`, startOrder, range });
  ctx.openActivations.set(participantId, stack);
}

function collectSequenceStatements(statements: SequenceStatementAst[], ctx: SeqCtx): void {
  for (const stmt of statements) {
    switch (stmt.type) {
      case "Node": {
        materializeNode(stmt, ctx.nodes, ctx.diagnostics);
        if (!ctx.participantOrder.includes(stmt.id)) ctx.participantOrder.push(stmt.id);
        break;
      }
      case "Edge": {
        const from = stmt.from;
        const to = stmt.to;
        ensureParticipant(ctx, from, stmt.range);
        ensureParticipant(ctx, to, stmt.range);
        const kind = edgeOpToSequenceKind(stmt.op, from, to);
        const styleRefs = [...collectStyleRefsFromProperties(stmt.properties), ...stmt.styleRefs];
        const branch =
          normalizeBranch(stmt.properties.branch) ??
          (stmt.label != null ? classifyBranch(stmt.label) : undefined);
        const msg = pushMessage(
          ctx,
          {
            from: from === "*" ? null : from,
            to: to === "*" ? null : to,
            kind,
            label: stmt.label,
            labelAuthored: stmt.label != null,
            sourceRange: stmt.range,
          },
          { styleRefs, branch },
        );

        // Auto-activate: sync call opens target; matching return closes it.
        if (kind === "sync" && msg.to) {
          openActivation(ctx, msg.to, msg.order, stmt.range);
          if (msg.from) ctx.callStack.push({ messageId: msg.id, to: msg.to, from: msg.from });
        } else if (kind === "return" && msg.from) {
          const idx = [...ctx.callStack].reverse().findIndex((c) => c.to === msg.from);
          if (idx >= 0) {
            const real = ctx.callStack.length - 1 - idx;
            const call = ctx.callStack[real]!;
            msg.replyTo = call.messageId;
            ctx.callStack.splice(real, 1);
          }
          closeActivation(ctx, msg.from, msg.order);
        }
        break;
      }
      case "SequenceActivate": {
        ensureParticipant(ctx, stmt.participantId, stmt.range);
        openActivation(ctx, stmt.participantId, ctx.order, stmt.range);
        break;
      }
      case "SequenceDeactivate": {
        ensureParticipant(ctx, stmt.participantId, stmt.range);
        closeActivation(ctx, stmt.participantId, Math.max(0, ctx.order - 1));
        break;
      }
      case "SequenceCreate": {
        materializeNode(stmt.node, ctx.nodes, ctx.diagnostics);
        if (!ctx.participantOrder.includes(stmt.node.id)) {
          ctx.participantOrder.push(stmt.node.id);
        }
        // Create message from previous speaker if any, else found-style.
        const prev = ctx.messages.at(-1);
        const from = prev?.to ?? prev?.from ?? null;
        pushMessage(ctx, {
          from,
          to: stmt.node.id,
          kind: "create",
          label: stmt.node.label,
          labelAuthored: stmt.node.label != null,
          sourceRange: stmt.range,
        });
        break;
      }
      case "SequenceDestroy": {
        ensureParticipant(ctx, stmt.participantId, stmt.range);
        pushMessage(ctx, {
          from: stmt.participantId,
          to: stmt.participantId,
          kind: "destroy",
          sourceRange: stmt.range,
        });
        closeActivation(ctx, stmt.participantId, ctx.order - 1);
        break;
      }
      case "SequenceNote": {
        for (const id of stmt.participantIds) ensureParticipant(ctx, id, stmt.range);
        const order = nextOrder(ctx);
        ctx.notes.push({
          id: `note${ctx.nextNoteId++}`,
          order,
          placement: stmt.placement,
          participantIds: stmt.participantIds,
          text: stmt.text,
          sourceRange: stmt.range,
        });
        break;
      }
      case "SequenceDivider": {
        const order = nextOrder(ctx);
        ctx.dividers.push({
          id: `div${ctx.nextDivId++}`,
          order,
          label: stmt.label,
          sourceRange: stmt.range,
        });
        break;
      }
      case "SequenceAutonumber": {
        ctx.autonumber = true;
        break;
      }
      case "SequenceFragment": {
        collectFragment(stmt, ctx);
        break;
      }
      case "Style": {
        ctx.styles.push({
          name: stmt.name,
          target: stmt.target,
          properties: Object.fromEntries(
            Object.entries(stmt.properties).map(([k, v]) => [k, String(v)]),
          ),
        });
        break;
      }
      case "StyleRef": {
        for (const id of stmt.targetIds) {
          const node = ctx.nodes.get(id);
          if (node && !node.styleRefs.includes(stmt.styleName)) {
            node.styleRefs.push(stmt.styleName);
          }
        }
        break;
      }
      case "Directive":
      case "LayoutBlock":
      case "EdgePolicyBlock":
      case "RenderBlock":
      case "PresentationBlock":
      case "AnimationBlock":
        break;
      default:
        break;
    }
  }
}

function collectFragment(stmt: SequenceFragmentAst, ctx: SeqCtx): void {
  const fragId = `frag${ctx.nextFragId++}`;
  const startOrder = ctx.order;
  const operands: SequenceFragmentOperand[] = [];

  for (const op of stmt.operands) {
    const opStart = ctx.order;
    const childFragsStart = ctx.fragments.length;
    collectSequenceStatements(op.statements, ctx);
    const nested = ctx.fragments.splice(childFragsStart);
    const opEnd = Math.max(opStart, ctx.order - 1);
    operands.push({
      label: op.label,
      styleRefs: [...op.styleRefs],
      startOrder: opStart,
      endOrder: opEnd,
      children: nested,
    });
  }

  const endOrder = Math.max(startOrder, ctx.order - 1);
  ctx.fragments.push({
    id: fragId,
    operator: stmt.operator,
    label: stmt.label,
    styleRefs: [...stmt.styleRefs],
    unresolvedVars: {},
    startOrder,
    endOrder,
    operands,
    sourceRange: stmt.range,
  });
}

function collectAnimationBlocks(statements: SequenceStatementAst[]): AnimationBlockAst[] {
  const blocks: AnimationBlockAst[] = [];
  for (const stmt of statements) {
    if (stmt.type === "AnimationBlock") blocks.push(stmt);
    if (stmt.type === "SequenceFragment") {
      for (const op of stmt.operands) {
        blocks.push(...collectAnimationBlocks(op.statements));
      }
    }
  }
  return blocks;
}

function finalizeOpenActivations(ctx: SeqCtx): void {
  const lastOrder = Math.max(0, ctx.order - 1);
  for (const [participantId, stack] of ctx.openActivations) {
    while (stack.length) {
      const open = stack.pop()!;
      ctx.activations.push({
        id: open.id,
        participantId,
        startOrder: open.startOrder,
        endOrder: lastOrder,
        sourceRange: open.range,
      });
    }
  }
}

/** Compile a `sequence { … }` document body into GraphModel + SequenceIR. */
export function compileSequence(ast: KDiagramAst, diagramIndex = 0): CompileResult {
  const diagnostics: Diagnostic[] = [...ast.diagnostics];
  const top = ast.body[diagramIndex];
  if (!top || top.type !== "Sequence") {
    diagnostics.push({
      severity: "error",
      code: "FM100",
      message: "No sequence diagram found at index",
      range: { start: { line: 1, column: 1, offset: 0 }, end: { line: 1, column: 1, offset: 0 } },
    });
    return {
      graph: {
        id: "empty",
        diagramKind: "sequence",
        nodes: [],
        edges: [],
        groups: [],
        styles: [],
        animations: [],
        diagnostics,
      },
      layoutHints: {},
      routingHints: {},
      renderHints: {},
      diagnostics,
    };
  }

  const seq = top as SequenceAst;
  const ctx: SeqCtx = {
    nodes: new Map(),
    edges: [],
    styles: [],
    diagnostics,
    participantOrder: [],
    messages: [],
    activations: [],
    fragments: [],
    notes: [],
    dividers: [],
    autonumber: false,
    order: 0,
    edgeCounter: 0,
    openActivations: new Map(),
    callStack: [],
    nextActId: 0,
    nextFragId: 0,
    nextNoteId: 0,
    nextDivId: 0,
  };

  collectSequenceStatements(seq.statements, ctx);
  finalizeOpenActivations(ctx);

  const sequence: SequenceIR = {
    autonumber: ctx.autonumber,
    messages: ctx.messages,
    activations: ctx.activations,
    fragments: ctx.fragments,
    notes: ctx.notes,
    dividers: ctx.dividers,
    participantOrder: ctx.participantOrder,
  };

  const graph: GraphModel = {
    id: seq.name ? seq.name.toLowerCase().replace(/\s+/g, "-") : "sequence",
    title: seq.name,
    diagramKind: "sequence",
    sequence,
    nodes: ctx.participantOrder.map((id) => ctx.nodes.get(id)!).filter(Boolean),
    edges: ctx.edges,
    groups: [],
    styles: ctx.styles,
    animations: compileAnimationBlocks(
      collectAnimationBlocks(seq.statements),
      ctx.nodes,
      diagnostics,
    ),
    diagnostics,
  };

  const hints = extractSequenceHints(seq);
  diagnostics.push(...hints.diagnostics);
  const { diagnostics: _d, ...hintFields } = hints;
  hintFields.layoutHints = {
    ...hintFields.layoutHints,
    direction: hintFields.layoutHints.direction ?? "TD",
  };

  return { graph, ...hintFields, diagnostics };
}

function extractSequenceHints(seq: SequenceAst): {
  layoutHints: LayoutOptions;
  routingHints: RoutingOptions;
  renderHints: RenderOptions;
  diagnostics: Diagnostic[];
} {
  const layoutHints: LayoutOptions = {};
  const routingHints: RoutingOptions = {};
  const renderHints: RenderOptions = {};
  const diagnostics: Diagnostic[] = [];
  let presentationLayers: PresentationOptions[] = [];

  for (const stmt of seq.statements) {
    if (stmt.type === "Directive") {
      if (stmt.name === "direction" && stmt.value) {
        layoutHints.direction = normalizeDirection(String(stmt.value));
      }
      if (stmt.name === "density" && stmt.value) {
        const d = String(stmt.value);
        if (d === "compact" || d === "normal" || d === "spacious") {
          layoutHints.density = d;
        }
      }
    }
    if (stmt.type === "LayoutBlock") {
      if (stmt.properties.direction) {
        layoutHints.direction = normalizeDirection(String(stmt.properties.direction));
      }
      if (stmt.properties.density) {
        const d = String(stmt.properties.density);
        if (d === "compact" || d === "normal" || d === "spacious") {
          layoutHints.density = d;
        }
      }
    }
    if (stmt.type === "EdgePolicyBlock") {
      if (stmt.properties.route) {
        routingHints.route = String(stmt.properties.route) as RoutingOptions["route"];
      }
    }
    if (stmt.type === "RenderBlock") {
      if (stmt.properties.theme) {
        renderHints.theme = String(stmt.properties.theme) as RenderOptions["theme"];
      }
    }
    if (stmt.type === "PresentationBlock") {
      const layer = presentationFromProperties(stmt.properties);
      if (layer) presentationLayers.push(layer);
    }
  }

  const merged = mergePresentationOptions(...presentationLayers);
  if (merged) renderHints.presentation = merged;

  return { layoutHints, routingHints, renderHints, diagnostics };
}
