// @vitest-environment happy-dom

import { describe, expect, it } from "vite-plus/test";
import { KDiagram, registerTheme } from "./index.ts";

describe("interactive live themes", () => {
  it("applies registered theme tokens to the interactive viewport", async () => {
    registerTheme("studio-test", {
      "--kd-bg": "rgb(1, 2, 3)",
      "--kd-node-fill": "rgb(4, 5, 6)",
      "--kd-text": "rgb(250, 251, 252)",
    });
    const container = document.createElement("div");
    document.body.append(container);

    const controller = KDiagram.renderToElement('diagram { api: service "API" }', container, {
      theme: "studio-test",
    });
    await controller.ready();

    const viewport = container.querySelector<HTMLElement>(".kdiagram-viewport");
    expect(viewport?.style.getPropertyValue("--kd-bg")).toBe("rgb(1, 2, 3)");
    expect(viewport?.style.getPropertyValue("--kd-node-fill")).toBe("rgb(4, 5, 6)");
    expect(viewport?.style.getPropertyValue("--kd-text")).toBe("rgb(250, 251, 252)");

    controller.destroy();
  });
});
