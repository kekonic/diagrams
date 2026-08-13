# Before sharing the diagram

- Validate and format the final `.kdiagram` file.
- Render again after the last source change. Make sure the SVG, PNG, screenshot, or report actually
  came from that final version.
- Look at the complete result at normal reading size.
- Reconsider anything far wider or taller than 16:9, labels that require zooming, and arrows that
  cross most of the page.
- Make sure arrow direction is visible and important branches can be understood without reading a
  paragraph on an arrow.
- Check contrast and make sure color is never the only way to understand something.
- Use portable SVG for documents, presentations, and ordinary files. Use live theme colors only
  when the website or app deliberately supplies them.
- Keep the `.kdiagram` source beside the rendered file so it can be changed later.
- Prefer static SVG for embeds unless readers actually need pan, zoom, animation, or live themes.
- Include assumptions and unanswered questions with architecture documentation.
- If a requested title, note, legend, or description cannot appear in the chosen output, say so
  instead of claiming it is present.
- Reject any PNG conversion that loses colors, text, icons, or CSS variables. Use a supported
  browser renderer or omit the PNG and explain why.
