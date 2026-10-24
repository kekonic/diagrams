// @vitest-environment happy-dom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vite-plus/test";
import { defaultSeeds } from "../lib/deriveTheme.ts";
import { ExportDialog } from "./ExportDialog.tsx";

const SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="80" height="40"><desc id="d">Diagram</desc></svg>`;

describe("ExportDialog", () => {
  it("switches between an SVG download and a locked embed", async () => {
    const host = document.createElement("div");
    document.body.appendChild(host);
    const root = createRoot(host);
    const onRender = vi.fn(async () => SVG);

    await act(async () => {
      root.render(
        <ExportDialog
          source={'diagram "Café" {\n  a: service "A"\n}'}
          documentName="checkout.kdiagram"
          studioUrl="https://example.test/studio/"
          studioSeeds={defaultSeeds("dark")}
          initialTab="file"
          onRender={onRender}
          onApplyPalette={() => undefined}
          onClose={() => undefined}
        />,
      );
    });

    expect(host.textContent).toContain("Download SVG");
    const png = host.querySelector<HTMLInputElement>('input[name="export-format"][value="png"]');
    await act(async () => {
      png?.click();
    });
    expect(host.textContent).toContain("Download PNG");

    const embedTab = [...host.querySelectorAll("button")].find(
      (button) => button.textContent === "Embed",
    );
    await act(async () => {
      embedTab?.click();
    });
    const snippet = host.querySelector("textarea");
    expect(snippet?.value).toContain("#embed=1");
    expect(snippet?.value).toContain("style=explorer");
    expect(snippet?.value).not.toContain("Café");
    expect(host.textContent).toContain("File look:");

    await act(async () => {
      [...host.querySelectorAll("button")].find((button) => button.textContent === "File")?.click();
    });
    const svgFormat = host.querySelector<HTMLInputElement>(
      'input[name="export-format"][value="svg"]',
    );
    await act(async () => {
      svgFormat?.click();
    });
    const white = host.querySelector<HTMLInputElement>(
      'input[name="export-ground"][value="white"]',
    );
    await act(async () => {
      white?.click();
    });
    expect(host.textContent).toContain("Custom. SVG on a white ground");

    await act(async () => root.unmount());
    host.remove();
  });

  it("disables a PNG scale the browser cannot encode", async () => {
    const host = document.createElement("div");
    document.body.appendChild(host);
    const root = createRoot(host);
    const huge = `<svg xmlns="http://www.w3.org/2000/svg" width="5000" height="4000"></svg>`;

    await act(async () => {
      root.render(
        <ExportDialog
          source={'diagram "A" {}'}
          documentName="wide.kdiagram"
          studioUrl="https://example.test/studio/"
          studioSeeds={defaultSeeds("dark")}
          initialTab="file"
          onRender={async () => huge}
          onApplyPalette={() => undefined}
          onClose={() => undefined}
        />,
      );
    });

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 200));
    });
    const png = host.querySelector<HTMLInputElement>('input[name="export-format"][value="png"]');
    await act(async () => {
      png?.click();
    });
    const double = host.querySelector<HTMLInputElement>('input[name="export-scale"][value="2"]');
    const single = host.querySelector<HTMLInputElement>('input[name="export-scale"][value="1"]');
    expect(double?.disabled).toBe(true);
    expect(single?.disabled).toBe(false);
    expect(host.textContent).toContain("larger than the browser");

    await act(async () => root.unmount());
    host.remove();
  });
});
