import { describe, expect, it } from "vite-plus/test";
import { compile, inferAutoAnimation, parse } from "@kekonic/diagrams-core";
import type { AnimationCue } from "@kekonic/diagrams-core";
import { AnimationPlayer, buildTimeline, resolvePlaybackEmphasis } from "./player.ts";

describe("AnimationPlayer catalog", () => {
  it("keeps diagrams static when no animation blocks are authored", () => {
    const src = `diagram {
      a: service "A"
      b: service "B"
      a -> b
    }`;
    const { graph } = compile(parse(src));
    expect(inferAutoAnimation(graph)).not.toBeNull();

    const player = new AnimationPlayer();
    player.rebind(null, graph);
    expect(player.list()).toEqual([]);
    player.destroy();
  });

  it("opts into Automatic via an empty named animation block", () => {
    const src = `diagram {
      a: service "A"
      b: service "B"
      a -> b
      animation "Automatic" {}
    }`;
    const { graph } = compile(parse(src));
    const player = new AnimationPlayer();
    player.rebind(null, graph);
    expect(player.list()).toEqual([{ id: "automatic", name: "Automatic", source: "auto" }]);
    const auto = graph.animations?.[0];
    expect(auto?.source).toBe("auto");
    expect(auto?.cues).toEqual([]);
    player.destroy();
  });

  it("lists opted-in auto beside authored animations", () => {
    const src = `diagram {
      a: service "A"
      b: service "B"
      a -> b
      animation "Automatic" {}
      animation "Denied" {
        dim *
        flow a -> b for 500ms
      }
    }`;
    const { graph } = compile(parse(src));
    const player = new AnimationPlayer();
    player.rebind(null, graph);
    expect(player.list()).toEqual([
      { id: "automatic", name: "Automatic", source: "auto" },
      { id: "denied", name: "Denied", source: "authored" },
    ]);
    player.destroy();
  });

  it("does not inject auto when only authored stories exist", () => {
    const src = `diagram {
      a: service "A"
      b: service "B"
      a -> b
      animation "Denied" {
        dim *
        flow a -> b for 500ms
      }
    }`;
    const { graph } = compile(parse(src));
    const player = new AnimationPlayer();
    player.rebind(null, graph);
    expect(player.list()).toEqual([{ id: "denied", name: "Denied", source: "authored" }]);
    player.destroy();
  });

  it("clamps and reports playback speed", () => {
    const src = `diagram {
      a: service "A"
      b: service "B"
      a -> b
      animation "Automatic" {}
    }`;
    const { graph } = compile(parse(src));
    const player = new AnimationPlayer();
    player.rebind(null, graph);
    expect(player.getState().speed).toBe(1);
    player.setSpeed(2);
    expect(player.getState().speed).toBe(2);
    player.setSpeed(0.25);
    expect(player.getState().speed).toBe(0.5);
    player.setSpeed(9);
    expect(player.getState().speed).toBe(2);
    player.destroy();
  });
});

describe("resolvePlaybackEmphasis", () => {
  const nodeIds = ["a", "yes", "no"];

  it("clears prior path highlights when dim * starts a new chapter", () => {
    const cues: AnimationCue[] = [
      { op: "dim", targets: [{ type: "all" }] },
      { op: "activate", targets: [{ type: "node", id: "a" }] },
      { op: "flow", path: ["a", "yes"], durationMs: 500 },
      { op: "dim", targets: [{ type: "all" }] },
      { op: "wait", durationMs: 100 },
      { op: "activate", targets: [{ type: "node", id: "a" }] },
      { op: "flow", path: ["a", "no"], durationMs: 500 },
    ];
    const { timed, durationMs } = buildTimeline(cues);

    // Destination lights near the end of the hop (progress ≈ 1).
    const afterFirst = resolvePlaybackEmphasis(timed, 499.9, nodeIds);
    expect(afterFirst.dimAll).toBe(true);
    expect([...afterFirst.activeNodes].sort()).toEqual(["a", "yes"]);
    expect([...afterFirst.activeEdges]).toEqual(["a->yes"]);

    // At the second dim (t=500): prior sticky highlights drop so off-path nodes go dim.
    const atReset = resolvePlaybackEmphasis(timed, 500, nodeIds);
    expect(atReset.dimAll).toBe(true);
    expect([...atReset.activeNodes]).toEqual([]);
    expect([...atReset.activeEdges]).toEqual([]);

    const afterSecond = resolvePlaybackEmphasis(timed, durationMs, nodeIds);
    expect(afterSecond.dimAll).toBe(true);
    expect([...afterSecond.activeNodes].sort()).toEqual(["a", "no"]);
    expect([...afterSecond.activeEdges]).toEqual(["a->no"]);
    expect(afterSecond.activeNodes.has("yes")).toBe(false);
  });

  it("keeps activate/flow sticky within a chapter until the next dim *", () => {
    const cues: AnimationCue[] = [
      { op: "dim", targets: [{ type: "all" }] },
      { op: "activate", targets: [{ type: "node", id: "a" }] },
      { op: "flow", path: ["a", "yes"], durationMs: 400 },
      { op: "activate", targets: [{ type: "node", id: "no" }] },
    ];
    const { timed, durationMs } = buildTimeline(cues);
    const atEnd = resolvePlaybackEmphasis(timed, durationMs, nodeIds);
    expect([...atEnd.activeNodes].sort()).toEqual(["a", "no", "yes"]);
    expect([...atEnd.activeEdges]).toEqual(["a->yes"]);
  });

  it("tracks per-hop edge ids on sticky multi-hop flows", () => {
    const cues: AnimationCue[] = [
      { op: "dim", targets: [{ type: "all" }] },
      {
        op: "flow",
        path: ["a", "yes", "no"],
        durationMs: 400,
        edgeId: "e1",
        edgeIds: ["e1", "e2"],
      },
    ];
    const { timed, durationMs } = buildTimeline(cues);
    const atEnd = resolvePlaybackEmphasis(timed, durationMs, nodeIds);
    expect([...atEnd.activeEdgeIds].sort()).toEqual(["e1", "e2"]);
    expect([...atEnd.activeEdges].sort()).toEqual(["a->yes", "yes->no"]);
  });
});
