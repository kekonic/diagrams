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

    await act(async () => root.unmount());
    host.remove();
  });
});
