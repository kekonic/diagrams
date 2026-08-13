const MAX_SHARED_SOURCE_BYTES = 200_000;

export type StudioLaunch = {
  source?: string;
  embed: boolean;
};

export function readStudioLaunch(hash: string): StudioLaunch {
  const params = new URLSearchParams(hash.replace(/^#/, ""));
  const encoded = params.get("source");
  return {
    source: encoded ? decodeStudioSource(encoded) : undefined,
    embed: params.get("embed") === "1",
  };
}

export function buildStudioSourceUrl(
  source: string,
  studioUrl = "https://diagrams.kekonic.com/studio/",
  embed = false,
): string {
  const url = new URL(studioUrl);
  url.search = "";
  const params = new URLSearchParams();
  if (embed) params.set("embed", "1");
  params.set("source", encodeStudioSource(source));
  url.hash = params.toString();
  return url.toString();
}

export function buildIframeEmbed(source: string, studioUrl?: string): string {
  const src = escapeHtmlAttribute(buildStudioSourceUrl(source, studioUrl, true));
  return `<iframe src="${src}" title="KDiagram diagram" width="100%" height="560" loading="lazy" allow="fullscreen"></iframe>`;
}

export function buildWebComponentEmbed(source: string): string {
  const scriptSource = JSON.stringify(source).replaceAll("<", "\\u003c");
  return `<k-diagram id="k-diagram" theme="auto" height="560"></k-diagram>

<script type="module">
  import "@kekonic/diagrams-element";

  const diagram = document.querySelector("#k-diagram");
  diagram.source = ${scriptSource};
</script>`;
}

export function encodeStudioSource(source: string): string {
  const bytes = new TextEncoder().encode(source);
  if (bytes.byteLength > MAX_SHARED_SOURCE_BYTES) {
    throw new Error(
      "This diagram is too large to share in a URL. Save the .kdiagram file instead.",
    );
  }
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
}

export function decodeStudioSource(encoded: string): string | undefined {
  try {
    const normalized = encoded.replaceAll("-", "+").replaceAll("_", "/");
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
    const binary = atob(padded);
    const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
    if (bytes.byteLength > MAX_SHARED_SOURCE_BYTES) return undefined;
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    return undefined;
  }
}

function escapeHtmlAttribute(value: string): string {
  return value.replaceAll("&", "&amp;").replaceAll('"', "&quot;");
}
