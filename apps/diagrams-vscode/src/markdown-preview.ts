async function renderDiagrams(): Promise<void> {
  const containers = document.querySelectorAll<HTMLElement>("[data-kdiagram-source]");
  if (containers.length === 0) return;
  const { KDiagram } = await import("@kekonic/diagrams");
  await Promise.all(
    [...containers].map(async (container) => {
      const encoded = container.dataset.kdiagramSource;
      if (!encoded) return;
      const source = decodeURIComponent(encoded);
      const dark =
        document.body.classList.contains("vscode-dark") ||
        document.body.classList.contains("vscode-high-contrast");
      const result = await KDiagram.renderToSvg(source, {
        theme: dark ? "dark" : "light",
        snapshotTheme: true,
      });
      if (result.svg) {
        // The renderer escapes authored text and validates URL-bearing values. Only its generated
        // SVG crosses this HTML boundary.
        container.innerHTML = result.svg;
      } else {
        container.classList.add("kdiagram-markdown-error");
        container.textContent = result.diagnostics.map((item) => item.message).join("\n");
      }
    }),
  );
}

window.addEventListener("load", () => void renderDiagrams());
window.addEventListener("vscode.markdown.updateContent", () => void renderDiagrams());
