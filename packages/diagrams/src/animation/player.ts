import {
  bindSequenceFlowEdgeIds,
  flowHopEdgeId,
  inferAutoAnimation,
  type AnimationController,
  type AnimationCue,
  type AnimationDefinition,
  type AnimationListItem,
  type AnimationPlayerState,
  type AnimationTarget,
  type GraphModel,
} from "@kekonic/diagrams-core";

export type TimedCue = {
  startMs: number;
  endMs: number;
  cue: AnimationCue;
};

/** In-flight or sticky flow paint state. */
export type ActiveFlow = {
  path: string[];
  progress: number;
  edgeId?: string;
  edgeIds?: string[];
};

function prefersReducedMotion(): boolean {
  if (typeof matchMedia !== "function") return false;
  return matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function buildTimeline(cues: AnimationCue[]): { timed: TimedCue[]; durationMs: number } {
  const timed: TimedCue[] = [];
  let t = 0;

  const appendCue = (cue: AnimationCue, at: number): number => {
    if (cue.op === "dim" || cue.op === "activate") {
      timed.push({ startMs: at, endMs: at, cue });
      return 0;
    }
    if (cue.op === "wait" || cue.op === "pulse" || cue.op === "flow") {
      const durationMs = Math.max(0, cue.durationMs);
      timed.push({ startMs: at, endMs: at + durationMs, cue });
      return durationMs;
    }
    if (cue.op === "parallel") {
      let maxDur = 0;
      for (const child of cue.cues) {
        maxDur = Math.max(maxDur, appendCue(child, at));
      }
      return maxDur;
    }
    return 0;
  };

  for (const cue of cues) {
    t += appendCue(cue, t);
  }
  return { timed, durationMs: t };
}

export type PlaybackEmphasis = {
  dimAll: boolean;
  activeNodes: Set<string>;
  activeEdges: Set<string>;
  /** Concrete edge/message ids — preferred on sequence diagrams. */
  activeEdgeIds: Set<string>;
  pulseTargets: AnimationTarget[];
  flows: ActiveFlow[];
};

/**
 * Resolve which nodes/edges are dimmed vs active at `timeMs`.
 * `dim *` starts a new focus chapter: prior activate/flow stickiness is cleared.
 */
export function resolvePlaybackEmphasis(
  timed: TimedCue[],
  timeMs: number,
  allNodeIds: Iterable<string>,
  reducedMotion = false,
): PlaybackEmphasis {
  let dimAll = false;
  const activeNodes = new Set<string>();
  const activeEdges = new Set<string>();
  const activeEdgeIds = new Set<string>();
  const pulseTargets: AnimationTarget[] = [];
  const flows: ActiveFlow[] = [];

  const markFlowHop = (cue: Extract<AnimationCue, { op: "flow" }>, hopIndex: number) => {
    const from = cue.path[hopIndex]!;
    const to = cue.path[hopIndex + 1]!;
    activeEdges.add(`${from}->${to}`);
    const id = flowHopEdgeId(hopIndex, cue);
    if (id) activeEdgeIds.add(id);
  };

  for (const item of timed) {
    if (item.startMs > timeMs) break;
    const cue = item.cue;
    if (cue.op === "dim") {
      for (const t of cue.targets) {
        if (t.type === "all") {
          dimAll = true;
          // Chapter / story reset — off-path highlights from earlier cues drop out.
          activeNodes.clear();
          activeEdges.clear();
          activeEdgeIds.clear();
          pulseTargets.length = 0;
          flows.length = 0;
        }
      }
    } else if (cue.op === "activate") {
      for (const t of cue.targets) {
        if (t.type === "all") {
          for (const id of allNodeIds) activeNodes.add(id);
        } else if (t.type === "node") {
          activeNodes.add(t.id);
        } else {
          activeEdges.add(`${t.from}->${t.to}`);
        }
      }
    } else if (cue.op === "pulse") {
      if (timeMs >= item.startMs && timeMs <= item.endMs && !reducedMotion) {
        pulseTargets.push(...cue.targets);
        for (const t of cue.targets) {
          if (t.type === "node") activeNodes.add(t.id);
          if (t.type === "edge") activeEdges.add(`${t.from}->${t.to}`);
        }
      }
    } else if (cue.op === "flow") {
      if (timeMs >= item.startMs && timeMs <= item.endMs) {
        const span = Math.max(1, item.endMs - item.startMs);
        const flowProgress = reducedMotion ? 1 : (timeMs - item.startMs) / span;
        flows.push({
          path: cue.path,
          progress: flowProgress,
          edgeId: cue.edgeId,
          edgeIds: cue.edgeIds,
        });
        const edgeCount = Math.max(1, cue.path.length - 1);
        for (let i = 0; i < cue.path.length; i++) {
          if (flowProgress >= i / edgeCount - 0.001) activeNodes.add(cue.path[i]!);
          if (cue.path[i + 1] && flowProgress >= i / edgeCount) markFlowHop(cue, i);
        }
      } else if (timeMs > item.endMs) {
        for (const nodeId of cue.path) activeNodes.add(nodeId);
        for (let i = 0; i < cue.path.length - 1; i++) markFlowHop(cue, i);
      }
    }
  }

  return { dimAll, activeNodes, activeEdges, activeEdgeIds, pulseTargets, flows };
}

/**
 * Interactive SVG animation player bound to a mounted KDiagram diagram.
 */
export class AnimationPlayer implements AnimationController {
  #svg: SVGSVGElement | null = null;
  #graph: GraphModel | null = null;
  #catalog: AnimationDefinition[] = [];
  #current: AnimationDefinition | null = null;
  #timed: TimedCue[] = [];
  #durationMs = 0;
  #timeMs = 0;
  #playing = false;
  #loop = false;
  #speed = 1;
  #raf: number | null = null;
  #lastTick = 0;
  #listeners = new Set<(state: AnimationPlayerState) => void>();
  #flowLayer: SVGGElement | null = null;

  list(): AnimationListItem[] {
    return this.#catalog.map((a) => ({ id: a.id, name: a.name, source: a.source }));
  }

  getState(): AnimationPlayerState {
    return {
      id: this.#current?.id ?? null,
      playing: this.#playing,
      timeMs: this.#timeMs,
      durationMs: this.#durationMs,
      loop: this.#loop,
      speed: this.#speed,
    };
  }

  subscribe(listener: (state: AnimationPlayerState) => void): () => void {
    this.#listeners.add(listener);
    listener(this.getState());
    return () => this.#listeners.delete(listener);
  }

  /** Rebind after SVG replace. Preserves current animation id and time when possible. */
  rebind(svg: SVGSVGElement | null, graph: GraphModel | null): void {
    const prevId = this.#current?.id ?? null;
    const prevTime = this.#timeMs;
    const wasPlaying = this.#playing;
    const prevLoop = this.#loop;
    const prevSpeed = this.#speed;
    this.#teardownVisuals();
    this.#svg = svg;
    this.#graph = graph;
    this.#rebuildCatalog();
    if (!svg || !graph) {
      this.#current = null;
      this.#timed = [];
      this.#durationMs = 0;
      this.#timeMs = 0;
      this.#playing = false;
      this.#notify();
      return;
    }
    const next = (prevId && this.#catalog.find((a) => a.id === prevId)) || this.#catalog[0] || null;
    this.#select(next, false);
    // Keep user loop/speed toggles across SVG rebuilds when still on the same clip.
    if (next && prevId === next.id) this.#loop = prevLoop;
    this.#speed = prevSpeed;
    if (next) {
      this.seek(Math.min(prevTime, this.#durationMs));
      if (wasPlaying) this.play();
    } else {
      this.#notify();
    }
  }

  play(id?: string): void {
    if (id) {
      const found = this.#catalog.find((a) => a.id === id);
      if (found) this.#select(found, true);
    } else if (!this.#current) {
      this.#select(this.#catalog[0] ?? null, true);
    }
    if (!this.#current || this.#durationMs <= 0) {
      this.#applyAt(0);
      this.#notify();
      return;
    }
    if (this.#timeMs >= this.#durationMs) this.#timeMs = 0;
    this.#playing = true;
    this.#lastTick = performance.now();
    this.#armRaf();
    this.#notify();
  }

  pause(): void {
    this.#playing = false;
    this.#cancelRaf();
    this.#notify();
  }

  stop(): void {
    this.#playing = false;
    this.#cancelRaf();
    this.#timeMs = 0;
    this.#clearEmphasis();
    this.#notify();
  }

  seek(ms: number): void {
    this.#timeMs = Math.max(0, Math.min(this.#durationMs, ms));
    this.#applyAt(this.#timeMs);
    this.#notify();
  }

  step(delta: -1 | 1): void {
    if (this.#timed.length === 0) return;
    const boundaries = [...new Set(this.#timed.flatMap((t) => [t.startMs, t.endMs]))].sort(
      (a, b) => a - b,
    );
    if (delta > 0) {
      const next = boundaries.find((b) => b > this.#timeMs + 0.5);
      this.seek(next ?? this.#durationMs);
    } else {
      const prev = [...boundaries].reverse().find((b) => b < this.#timeMs - 0.5);
      this.seek(prev ?? 0);
    }
  }

  setLoop(on: boolean): void {
    this.#loop = on;
    this.#notify();
  }

  setSpeed(rate: number): void {
    if (!Number.isFinite(rate)) return;
    this.#speed = Math.min(2, Math.max(0.5, rate));
    this.#notify();
  }

  destroy(): void {
    this.stop();
    this.#listeners.clear();
    this.#svg = null;
    this.#graph = null;
    this.#catalog = [];
  }

  #rebuildCatalog(): void {
    if (!this.#graph) {
      this.#catalog = [];
      return;
    }
    const authored = this.#graph.animations ?? [];
    const catalog: AnimationDefinition[] = [];
    for (const anim of authored) {
      if (anim.source === "auto") {
        const inferred = inferAutoAnimation(this.#graph);
        if (!inferred) continue;
        catalog.push({
          ...inferred,
          id: anim.id,
          name: anim.name,
          loop: anim.loop,
          source: "auto",
        });
        continue;
      }
      catalog.push({
        ...anim,
        cues: bindSequenceFlowEdgeIds(this.#graph, anim.cues),
      });
    }
    this.#catalog = catalog;
  }

  #select(anim: AnimationDefinition | null, resetTime: boolean): void {
    this.#current = anim;
    if (!anim) {
      this.#timed = [];
      this.#durationMs = 0;
      this.#timeMs = 0;
      this.#loop = false;
      this.#clearEmphasis();
      return;
    }
    const built = buildTimeline(anim.cues);
    this.#timed = built.timed;
    this.#durationMs = built.durationMs;
    this.#loop = anim.loop;
    if (resetTime) this.#timeMs = 0;
    this.#applyAt(this.#timeMs);
  }

  #notify(): void {
    const state = this.getState();
    for (const listener of this.#listeners) listener(state);
  }

  #armRaf(): void {
    this.#cancelRaf();
    this.#raf = requestAnimationFrame(this.#tick);
  }

  #cancelRaf(): void {
    if (this.#raf != null) {
      cancelAnimationFrame(this.#raf);
      this.#raf = null;
    }
  }

  #tick = (now: number): void => {
    if (!this.#playing) return;
    const dt = (now - this.#lastTick) * this.#speed;
    this.#lastTick = now;
    this.#timeMs += dt;
    if (this.#timeMs >= this.#durationMs) {
      if (this.#loop && this.#durationMs > 0) {
        this.#timeMs = this.#timeMs % this.#durationMs;
      } else {
        this.#timeMs = this.#durationMs;
        this.#playing = false;
        this.#applyAt(this.#timeMs);
        this.#notify();
        return;
      }
    }
    this.#applyAt(this.#timeMs);
    this.#notify();
    this.#armRaf();
  };

  #teardownVisuals(): void {
    this.#cancelRaf();
    this.#clearEmphasis();
  }

  #clearEmphasis(): void {
    if (!this.#svg) return;
    for (const el of this.#svg.querySelectorAll(
      ".flow-anim-dim, .flow-anim-active, .flow-anim-pulse",
    )) {
      el.classList.remove("flow-anim-dim", "flow-anim-active", "flow-anim-pulse");
    }
    this.#flowLayer?.remove();
    this.#flowLayer = null;
  }

  #applyAt(timeMs: number): void {
    if (!this.#svg || !this.#graph) return;
    this.#clearEmphasis();

    const reduced = prefersReducedMotion();
    const { dimAll, activeNodes, activeEdges, activeEdgeIds, pulseTargets, flows } =
      resolvePlaybackEmphasis(
        this.#timed,
        timeMs,
        this.#graph.nodes.map((n) => n.id),
        reduced,
      );

    // Dim the rest of the world while a story is in progress — keep actives crisp.
    if (dimAll) {
      for (const el of this.#svg.querySelectorAll(
        "[data-node-id], g.flow-edge[data-edge-id], .flow-sequence-activation, g.flow-sequence-fragment, .flow-sequence-fragment-operand, g.flow-sequence-note, g.flow-sequence-divider",
      )) {
        el.classList.add("flow-anim-dim");
      }
      for (const el of this.#svg.querySelectorAll("g.flow-edge-label")) {
        el.classList.add("flow-anim-dim");
      }
    }

    for (const id of activeNodes) {
      for (const el of this.#nodeEls(id)) {
        el.classList.remove("flow-anim-dim");
        el.classList.add("flow-anim-active");
      }
    }

    // Sequence messages share from→to pairs; always activate by concrete edge id.
    if (this.#graph.sequence) {
      for (const id of activeEdgeIds) this.#emphasizeEdgeId(id);
    } else {
      for (const key of activeEdges) {
        const [from, to] = key.split("->");
        if (!from || !to) continue;
        for (const el of this.#edgeEls(from, to)) {
          el.classList.remove("flow-anim-dim");
          el.classList.add("flow-anim-active");
          const edgeId = el.getAttribute("data-edge-id");
          if (edgeId) this.#emphasizeEdgeLabels(edgeId);
        }
      }
    }

    this.#applySequenceChrome(dimAll, activeEdgeIds);

    if (pulseTargets.length) {
      for (const t of pulseTargets) {
        if (t.type === "node") {
          this.#nodeEls(t.id).forEach((el) => el.classList.add("flow-anim-pulse"));
        } else if (t.type === "edge") {
          this.#edgeEls(t.from, t.to).forEach((el) => el.classList.add("flow-anim-pulse"));
        }
      }
    }

    if (flows.length && !reduced) {
      this.#paintFlows(flows);
    }
  }

  /**
   * Sequence chrome: highlight activation bars + fragments covering active message orders.
   * Orders come only from concrete message edge ids (never bare from→to).
   */
  #applySequenceChrome(dimAll: boolean, activeEdgeIds: Set<string>): void {
    if (!this.#svg || !this.#graph?.sequence) return;

    const focusOrders = new Set<number>();
    for (const id of activeEdgeIds) {
      for (const el of this.#edgeElsById(id)) {
        const raw = el.getAttribute("data-sequence-order");
        if (raw == null) continue;
        const order = Number(raw);
        if (Number.isFinite(order)) focusOrders.add(order);
      }
    }

    if (focusOrders.size === 0 && !dimAll) return;

    const emphasizeSpan = (el: Element) => {
      const start = Number(el.getAttribute("data-start-order"));
      const end = Number(el.getAttribute("data-end-order"));
      if (!Number.isFinite(start) || !Number.isFinite(end)) return;
      let live = false;
      for (const order of focusOrders) {
        if (start <= order && order <= end) {
          live = true;
          break;
        }
      }
      if (live) {
        el.classList.remove("flow-anim-dim");
        el.classList.add("flow-anim-active");
      } else if (dimAll) {
        el.classList.add("flow-anim-dim");
        el.classList.remove("flow-anim-active");
      }
    };

    for (const el of this.#svg.querySelectorAll(".flow-sequence-activation")) {
      emphasizeSpan(el);
    }
    for (const el of this.#svg.querySelectorAll("g.flow-sequence-fragment")) {
      emphasizeSpan(el);
    }
    for (const el of this.#svg.querySelectorAll(".flow-sequence-fragment-operand")) {
      emphasizeSpan(el);
    }
  }

  #emphasizeEdgeId(edgeId: string): void {
    for (const el of this.#edgeElsById(edgeId)) {
      el.classList.remove("flow-anim-dim");
      el.classList.add("flow-anim-active");
    }
    this.#emphasizeEdgeLabels(edgeId);
  }

  #emphasizeEdgeLabels(edgeId: string): void {
    if (!this.#svg) return;
    for (const label of this.#svg.querySelectorAll(
      `g.flow-edge-label[data-edge-id="${cssEscape(edgeId)}"]`,
    )) {
      label.classList.remove("flow-anim-dim");
      label.classList.add("flow-anim-active");
    }
  }

  #edgeElsById(edgeId: string): Element[] {
    if (!this.#svg) return [];
    return [...this.#svg.querySelectorAll(`g.flow-edge[data-edge-id="${cssEscape(edgeId)}"]`)];
  }

  #nodeEls(id: string): Element[] {
    if (!this.#svg) return [];
    return [...this.#svg.querySelectorAll(`[data-node-id="${cssEscape(id)}"]`)];
  }

  #edgeEls(from: string, to: string, edgeId?: string): Element[] {
    if (!this.#svg) return [];
    if (edgeId) {
      const exact = this.#edgeElsById(edgeId);
      if (exact.length) return exact;
    }
    return [
      ...this.#svg.querySelectorAll(
        `g.flow-edge[data-edge-from="${cssEscape(from)}"][data-edge-to="${cssEscape(to)}"]`,
      ),
    ];
  }

  /** Collect routed path `d` values for an edge (main strokes + jumps). */
  #edgePathDs(from: string, to: string, edgeId?: string): string[] {
    const edge = this.#edgeEls(from, to, edgeId)[0];
    if (!edge) return [];
    const ds: string[] = [];
    for (const p of edge.querySelectorAll("path.flow-edge-path, path.flow-edge-jump")) {
      const d = p.getAttribute("d");
      if (d) ds.push(d);
    }
    return ds;
  }

  /** Resolved paint of an edge — keeps yes/no/kind color on the flow bead. */
  #edgeStroke(from: string, to: string, edgeId?: string): string | null {
    const edge = this.#edgeEls(from, to, edgeId)[0];
    const path = edge?.querySelector("path.flow-edge-path, path.flow-edge-jump");
    if (!path) return null;
    const stroke = getComputedStyle(path).stroke;
    if (!stroke || stroke === "none") return null;
    return stroke;
  }

  /**
   * Diagram geometry lives under `.flow-diagram-content` (translated for padding).
   * Flow overlays must mount there or they sit at a parallel offset from real edges.
   */
  #diagramContent(): SVGElement {
    const content = this.#svg?.querySelector("g.flow-diagram-content");
    return (content as SVGElement | null) ?? this.#svg!;
  }

  #paintFlows(flows: ActiveFlow[]): void {
    if (!this.#svg) return;
    const mount = this.#diagramContent();
    const layer = document.createElementNS("http://www.w3.org/2000/svg", "g");
    layer.setAttribute("class", "flow-anim-flow-layer");
    layer.style.pointerEvents = "none";
    let painted = false;
    for (const flow of flows) {
      if (flow.path.length < 2) continue;
      if (this.#paintFlowOnto(layer, mount, flow)) painted = true;
    }
    if (!painted) return;
    mount.appendChild(layer);
    this.#flowLayer = layer;
  }

  /**
   * Paint one flow bead/trail into `layer`. Probes are attached to `mount` temporarily
   * for getTotalLength. Returns true when any geometry was drawn.
   */
  #paintFlowOnto(layer: SVGGElement, mount: SVGElement, flow: ActiveFlow): boolean {
    const { path, progress } = flow;
    // One hop = one authored edge (may include several path/jump strokes).
    // Keep a slot even when the edge isn't found so hop timing stays aligned with #applyAt.
    type Seg = { d: string; len: number; probe: SVGPathElement };
    type Hop = { stroke: string | null; segs: Seg[] };
    const hops: Hop[] = [];
    for (let i = 0; i < path.length - 1; i++) {
      const from = path[i]!;
      const to = path[i + 1]!;
      const hopId = flowHopEdgeId(i, flow);
      const ds = this.#edgePathDs(from, to, hopId);
      const segs: Seg[] = [];
      for (const d of ds) {
        const probe = document.createElementNS("http://www.w3.org/2000/svg", "path");
        probe.setAttribute("d", d);
        // Must be in the tree for reliable getTotalLength in some engines.
        probe.setAttribute("visibility", "hidden");
        mount.appendChild(probe);
        segs.push({ d, len: probe.getTotalLength?.() ?? 0, probe });
      }
      hops.push({ stroke: this.#edgeStroke(from, to, hopId), segs });
    }
    if (!hops.some((h) => h.segs.length > 0)) {
      for (const hop of hops) for (const seg of hop.segs) seg.probe.remove();
      return false;
    }

    // Equal time per hop (not per path-length). Longer edges move faster geometrically
    // so each edge gets the same beat of the cue — matches activate timing in #applyAt.
    const p = Math.max(0, Math.min(1, progress));
    const hopCount = hops.length;
    const scaled = p * hopCount;
    const hopIdx = p >= 1 ? hopCount - 1 : Math.min(hopCount - 1, Math.floor(scaled));
    const localT = p >= 1 ? 1 : scaled - hopIdx;

    let headPoint: DOMPoint | null = null;
    let headStroke: string | null = null;

    for (let h = 0; h < hopCount; h++) {
      const hop = hops[h]!;
      const segs = hop.segs;
      const hopLen = segs.reduce((sum, s) => sum + s.len, 0);
      const revealInHop =
        h < hopIdx ? hopLen : h > hopIdx ? 0 : Math.max(0, Math.min(hopLen, localT * hopLen));

      let walked = 0;
      for (const seg of segs) {
        const localReveal = Math.max(0, Math.min(seg.len, revealInHop - walked));
        if (localReveal > 0 && seg.len > 0) {
          // Trail only — never paint a full ghost of the remaining edge (looks like a redraw).
          const track = document.createElementNS("http://www.w3.org/2000/svg", "path");
          track.setAttribute("class", "flow-anim-flow-track");
          track.setAttribute("d", seg.d);
          track.style.strokeDasharray = `${seg.len}`;
          track.style.strokeDashoffset = `${seg.len - localReveal}`;
          if (hop.stroke) {
            track.style.stroke = `color-mix(in srgb, ${hop.stroke} 40%, transparent)`;
          }
          layer.appendChild(track);

          const overlay = document.createElementNS("http://www.w3.org/2000/svg", "path");
          overlay.setAttribute("class", "flow-anim-flow-overlay");
          overlay.setAttribute("d", seg.d);
          overlay.style.strokeDasharray = `${seg.len}`;
          overlay.style.strokeDashoffset = `${seg.len - localReveal}`;
          if (hop.stroke) overlay.style.stroke = hop.stroke;
          layer.appendChild(overlay);

          const core = document.createElementNS("http://www.w3.org/2000/svg", "path");
          core.setAttribute("class", "flow-anim-flow-core");
          core.setAttribute("d", seg.d);
          core.style.strokeDasharray = `${seg.len}`;
          core.style.strokeDashoffset = `${seg.len - localReveal}`;
          if (hop.stroke) {
            core.style.stroke = `color-mix(in srgb, ${hop.stroke} 35%, white)`;
          }
          layer.appendChild(core);

          if (revealInHop >= walked && revealInHop <= walked + seg.len) {
            headPoint = seg.probe.getPointAtLength(localReveal);
            headStroke = hop.stroke;
          } else if (revealInHop > walked + seg.len) {
            headPoint = seg.probe.getPointAtLength(seg.len);
            headStroke = hop.stroke;
          }
        }
        walked += seg.len;
      }
    }

    for (const hop of hops) for (const seg of hop.segs) seg.probe.remove();

    if (headPoint && p > 0 && p < 1) {
      const head = document.createElementNS("http://www.w3.org/2000/svg", "circle");
      head.setAttribute("class", "flow-anim-flow-head");
      head.setAttribute("cx", String(headPoint.x));
      head.setAttribute("cy", String(headPoint.y));
      head.setAttribute("r", "5.5");
      if (headStroke) {
        head.style.fill = `color-mix(in srgb, ${headStroke} 35%, white)`;
        head.style.stroke = headStroke;
      }
      layer.appendChild(head);
    }
    return true;
  }
}

function cssEscape(value: string): string {
  if (typeof CSS !== "undefined" && typeof CSS.escape === "function") return CSS.escape(value);
  return value.replace(/["\\]/g, "\\$&");
}
