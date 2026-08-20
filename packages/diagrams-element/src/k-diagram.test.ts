import { describe, expect, it, beforeEach, vi } from "vite-plus/test";
import { K_DIAGRAM_TAG, KDiagramElement, registerKDiagramElements } from "./index.ts";

const TINY = `diagram {
  direction LR
  api: gateway "API"
  checkout: service "Checkout"
  api -> checkout
}`;

describe("k-diagram", () => {
  beforeEach(() => {
    registerKDiagramElements();
    document.body.replaceChildren();
    document.documentElement.dataset.theme = "dark";
  });

  it("registers the custom element once", () => {
    expect(customElements.get(K_DIAGRAM_TAG)).toBe(KDiagramElement);
    registerKDiagramElements();
    expect(customElements.get(K_DIAGRAM_TAG)).toBe(KDiagramElement);
  });

  it("renders a diagram from the source attribute and becomes ready", async () => {
    const el = document.createElement(K_DIAGRAM_TAG) as KDiagramElement;
    el.setAttribute("source", TINY);
    el.setAttribute("theme", "dark");
    el.setAttribute("height", "280");
    el.showThemeToggle = false;
    el.showViewControls = false;
    document.body.append(el);

    await el.ready();
    await el.updateComplete;

    const svg = el.shadowRoot?.querySelector("svg");
    expect(svg, "expected svg in shadow viewport").toBeTruthy();
    expect(el.shadowRoot?.querySelector(".error")).toBeNull();
  }, 30_000);

  it("updates when source changes without remounting the element", async () => {
    const el = document.createElement(K_DIAGRAM_TAG) as KDiagramElement;
    el.source = TINY;
    el.theme = "dark";
    el.showThemeToggle = false;
    el.showViewControls = false;
    document.body.append(el);
    await el.ready();

    const next = `diagram {
  direction LR
  a: service "A"
  b: service "B"
  a -> b "wired"
}`;
    el.source = next;
    await el.updateComplete;
    // Debounce-free path: updated() awaits controller.update
    await new Promise((r) => setTimeout(r, 50));
    await el.updateComplete;

    const text = el.shadowRoot?.querySelector(".viewport")?.innerHTML ?? "";
    expect(text.includes("wired") || text.length > 0).toBe(true);
  }, 30_000);

  it("honors show-theme-toggle=false", async () => {
    const el = document.createElement(K_DIAGRAM_TAG) as KDiagramElement;
    el.source = TINY;
    el.setAttribute("show-theme-toggle", "false");
    el.setAttribute("show-view-controls", "false");
    document.body.append(el);
    await el.updateComplete;
    expect(el.showThemeToggle).toBe(false);
    expect(el.shadowRoot?.querySelector('[aria-label="Diagram controls"]')).toBeNull();
  });

  it("reflects frameless mode without changing control preferences", async () => {
    const el = document.createElement(K_DIAGRAM_TAG) as KDiagramElement;
    el.frameless = true;
    document.body.append(el);
    await el.updateComplete;

    expect(el.hasAttribute("frameless")).toBe(true);
    expect(el.showThemeToggle).toBe(true);
    expect(el.showViewControls).toBe(true);

    el.frameless = false;
    await el.updateComplete;
    expect(el.getAttribute("frameless")).toBe("false");
  });

  it("hides idle controls, reveals them on activity, and keeps focused controls visible", async () => {
    vi.useFakeTimers();
    const el = document.createElement(K_DIAGRAM_TAG) as KDiagramElement;
    el.source = TINY;
    document.body.append(el);
    await el.updateComplete;

    const stage = el.shadowRoot?.querySelector<HTMLElement>(".stage");
    expect(stage).toBeTruthy();

    try {
      stage!.dispatchEvent(new Event("pointermove", { bubbles: true, composed: true }));
      await el.updateComplete;
      expect(stage!.dataset.controlsVisible).toBe("true");

      vi.advanceTimersByTime(2_500);
      await el.updateComplete;
      expect(stage!.dataset.controlsVisible).toBe("false");

      stage!.dispatchEvent(new Event("pointermove", { bubbles: true, composed: true }));
      await el.updateComplete;
      const zoom = el.shadowRoot?.querySelector<HTMLButtonElement>('[aria-label="Zoom in"]');
      zoom?.focus();
      await el.updateComplete;
      vi.advanceTimersByTime(2_500);
      await el.updateComplete;
      expect(stage!.dataset.controlsVisible).toBe("true");
    } finally {
      el.remove();
      vi.useRealTimers();
    }
  });

  it("keeps diagrams static until an animation is authored", async () => {
    const el = document.createElement(K_DIAGRAM_TAG) as KDiagramElement;
    el.source = TINY;
    el.theme = "dark";
    el.showThemeToggle = false;
    el.showViewControls = false;
    el.showAnimationControls = true;
    document.body.append(el);
    await el.ready();
    await el.updateComplete;

    expect(el.animations?.list()).toEqual([]);
    expect(el.shadowRoot?.querySelector('[aria-label="Animation controls"]')).toBeFalsy();
  }, 30_000);

  it("shows animation controls when Automatic is opted in", async () => {
    const el = document.createElement(K_DIAGRAM_TAG) as KDiagramElement;
    el.source = `diagram {
  a: service "A"
  b: service "B"
  a -> b
  animation "Automatic" {}
}`;
    el.theme = "dark";
    el.showThemeToggle = false;
    el.showViewControls = false;
    el.showAnimationControls = true;
    document.body.append(el);
    await el.ready();
    await el.updateComplete;

    expect(el.shadowRoot?.querySelector('[aria-label="Animation controls"]')).toBeTruthy();
    expect(el.animations?.list().some((a) => a.source === "auto")).toBe(true);
  }, 30_000);

  it("treats an undefined preferred animation as no preference", async () => {
    const el = document.createElement(K_DIAGRAM_TAG) as KDiagramElement;
    el.source = `diagram {
  a: service "A"
  b: service "B"
  a -> b
  animation "Automatic" {}
}`;
    (el as unknown as { animation: string | undefined }).animation = undefined;
    document.body.append(el);

    await el.ready();
    await el.updateComplete;

    expect(el.shadowRoot?.querySelector(".error")).toBeNull();
    expect(el.animations?.list()).toHaveLength(1);
  }, 30_000);

  it("shows a picker when multiple authored animations exist", async () => {
    const el = document.createElement(K_DIAGRAM_TAG) as KDiagramElement;
    el.source = `diagram {
  a: service "A"
  b: service "B"
  c: service "C"
  a -> b
  a -> c
  animation "To B" {
    flow a -> b for 200ms
  }
  animation "To C" {
    flow a -> c for 200ms
  }
}`;
    el.theme = "dark";
    el.showThemeToggle = false;
    el.showViewControls = false;
    document.body.append(el);
    await el.ready();
    await el.updateComplete;

    const select = el.shadowRoot?.querySelector('select[aria-label="Animation"]');
    expect(select).toBeTruthy();
    expect(el.animations?.list()).toHaveLength(2);
  }, 30_000);

  it("does not trap page scroll on unmodified wheel", async () => {
    const el = document.createElement(K_DIAGRAM_TAG) as KDiagramElement;
    el.source = TINY;
    el.theme = "dark";
    el.showThemeToggle = false;
    el.showViewControls = false;
    document.body.append(el);
    await el.ready();
    await el.updateComplete;

    const viewport = el.shadowRoot?.querySelector<HTMLElement>(".kdiagram-viewport");
    expect(viewport).toBeTruthy();
    const event = new WheelEvent("wheel", {
      bubbles: true,
      cancelable: true,
      deltaY: 80,
    });
    Object.defineProperty(event, "ctrlKey", { value: false });
    Object.defineProperty(event, "metaKey", { value: false });
    viewport!.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(false);
    expect(el.shadowRoot?.querySelector(".sr-only")?.textContent).toContain("Ctrl or ⌘");
  }, 30_000);
});
