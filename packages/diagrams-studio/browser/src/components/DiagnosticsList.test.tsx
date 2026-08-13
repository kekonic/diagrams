// @vitest-environment happy-dom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vite-plus/test";
import { DiagnosticsList } from "./DiagnosticsList.tsx";

describe("DiagnosticsList", () => {
  it("reveals the diagnostic source range", () => {
    const host = document.createElement("div");
    document.body.appendChild(host);
    const root = createRoot(host);
    const onReveal = vi.fn();
    const range = {
      start: { line: 3, column: 5, offset: 20 },
      end: { line: 3, column: 9, offset: 24 },
    };

    act(() => {
      root.render(
        <DiagnosticsList
          diagnostics={[{ severity: "error", code: "FM001", message: "Broken declaration", range }]}
          onReveal={onReveal}
        />,
      );
    });

    act(() => host.querySelector("button")?.click());
    expect(onReveal).toHaveBeenCalledWith(range);

    act(() => root.unmount());
    host.remove();
  });
});
