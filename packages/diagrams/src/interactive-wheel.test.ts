// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { KDiagram } from "./index.ts";
import { ZOOM_HINT_VISIBLE_MS } from "./interactive/wheel-zoom.ts";

const SOURCE = `diagram { api: service "API" }`;

function mount(options?: Parameters<typeof KDiagram.renderToElement>[2]) {
  const container = document.createElement("div");
  document.body.append(container);
  const controller = KDiagram.renderToElement(SOURCE, container, options);
  return { container, controller };
}

function viewportOf(container: HTMLElement): HTMLElement {
  const viewport = container.querySelector<HTMLElement>(".kdiagram-viewport");
  if (!viewport) throw new Error("expected interactive viewport");
  return viewport;
}

function dispatchWheel(target: HTMLElement, init: WheelEventInit): WheelEvent {
  const event = new WheelEvent("wheel", {
    bubbles: true,
    cancelable: true,
    deltaY: 80,
    ...init,
  });
  // happy-dom ignores modifier keys on the WheelEvent constructor.
  Object.defineProperty(event, "ctrlKey", { value: init.ctrlKey === true });
  Object.defineProperty(event, "metaKey", { value: init.metaKey === true });
  target.dispatchEvent(event);
  return event;
}

describe("interactive wheel zoom", () => {
  afterEach(() => {
    document.body.replaceChildren();
    vi.useRealTimers();
  });

  it("does not capture unmodified wheel so the page can keep scrolling", async () => {
    const { container, controller } = mount();
    await controller.ready();

    const event = dispatchWheel(viewportOf(container), { ctrlKey: false, metaKey: false });
    expect(event.defaultPrevented).toBe(false);

    const hint = container.querySelector(".kdiagram-zoom-hint");
    expect(hint?.getAttribute("data-visible")).toBe("true");
    expect(hint?.textContent?.length).toBeGreaterThan(0);

    controller.destroy();
  });

  it("does not show the zoom hint for horizontal-dominant wheel", async () => {
    const { container, controller } = mount();
    await controller.ready();

    dispatchWheel(viewportOf(container), { deltaX: 80, deltaY: 10 });
    expect(container.querySelector(".kdiagram-zoom-hint")?.getAttribute("data-visible")).not.toBe(
      "true",
    );

    controller.destroy();
  });

  it("hides the zoom hint after a short idle", async () => {
    const { container, controller } = mount();
    await controller.ready();
    vi.useFakeTimers();

    dispatchWheel(viewportOf(container), {});
    expect(container.querySelector(".kdiagram-zoom-hint")?.getAttribute("data-visible")).toBe(
      "true",
    );

    vi.advanceTimersByTime(ZOOM_HINT_VISIBLE_MS);
    expect(container.querySelector(".kdiagram-zoom-hint")?.getAttribute("data-visible")).toBe(
      "false",
    );

    controller.destroy();
  });

  it("zooms when Ctrl or ⌘ is held", async () => {
    const { container, controller } = mount();
    await controller.ready();
    const svg = container.querySelector("svg");
    const before = svg?.getAttribute("viewBox");

    const event = dispatchWheel(viewportOf(container), { ctrlKey: true, clientX: 10, clientY: 10 });
    expect(event.defaultPrevented).toBe(true);
    expect(svg?.getAttribute("viewBox")).not.toBe(before);
    expect(container.querySelector(".kdiagram-zoom-hint")?.getAttribute("data-visible")).not.toBe(
      "true",
    );

    controller.destroy();
  });

  it("still zooms on unmodified wheel when the host opts into always", async () => {
    const { container, controller } = mount({ zoomOnWheel: "always" });
    await controller.ready();
    const svg = container.querySelector("svg");
    const before = svg?.getAttribute("viewBox");

    const event = dispatchWheel(viewportOf(container), { ctrlKey: false, metaKey: false });
    expect(event.defaultPrevented).toBe(true);
    expect(svg?.getAttribute("viewBox")).not.toBe(before);
    expect(container.querySelector(".kdiagram-zoom-hint")?.getAttribute("data-visible")).not.toBe(
      "true",
    );

    controller.destroy();
  });

  it("leaves toolbar zoom available regardless of wheel policy", async () => {
    const { container, controller } = mount();
    await controller.ready();
    const svg = container.querySelector("svg");
    const fitted = svg?.getAttribute("viewBox");

    controller.zoomIn();
    expect(svg?.getAttribute("viewBox")).not.toBe(fitted);

    controller.destroy();
  });
});
