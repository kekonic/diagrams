/**
 * Studio share fragment used by hosted `/studio/` (`readStudioLaunch` in Studio).
 * Keep this encoder aligned with `packages/diagrams-studio/browser/src/lib/share.ts`.
 */
const MAX_SHARED_SOURCE_BYTES = 200_000;

function encodeStudioSource(source: string): string {
  const bytes = new TextEncoder().encode(source);
  if (bytes.byteLength > MAX_SHARED_SOURCE_BYTES) {
    throw new Error("Diagram is too large to open in a Studio URL.");
  }
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
}

/** Same-origin Studio launch with the example source in the hash. */
export function galleryStudioHref(source: string): string {
  try {
    const params = new URLSearchParams();
    params.set("source", encodeStudioSource(source));
    return `/studio/#${params.toString()}`;
  } catch {
    return "/studio/";
  }
}
