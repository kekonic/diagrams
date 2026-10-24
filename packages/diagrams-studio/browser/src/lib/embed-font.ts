import interFontUrl from "@fontsource/inter/files/inter-latin-500-normal.woff?url";

let pending: Promise<string> | undefined;

/** Inter Latin, inlined the same way the CLI embeds it. Loaded on export, not at startup. */
export function interFontFaceCss(): Promise<string> {
  pending ??= loadInterFontFace();
  return pending;
}

async function loadInterFontFace(): Promise<string> {
  const response = await fetch(interFontUrl);
  if (!response.ok) throw new Error("Could not load the Inter font for this export.");
  const bytes = new Uint8Array(await response.arrayBuffer());
  const css = `@font-face{font-family:"Inter";src:url(data:font/woff;base64,${bytesToBase64(bytes)}) format("woff");font-weight:100 900;font-style:normal;font-display:block;}`;
  if (/[<>]/.test(css)) throw new Error("Embedded font CSS is not safe to inline.");
  return css;
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}
