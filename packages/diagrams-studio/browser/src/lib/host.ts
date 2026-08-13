const ICON_API_META_NAME = "kdiagram-icon-api";
const PUBLIC_STUDIO_META_NAME = "kdiagram-public-studio";

/** Resolve a Studio host route relative to the HTML document, including subpath deployments. */
export function studioHostUrl(path: string, baseUrl = document.baseURI): string {
  return new URL(path.replace(/^\//, ""), new URL(".", baseUrl)).toString();
}

/**
 * Resolve the Iconify-compatible API configured by the host. Relative values are resolved from
 * Studio's document directory; the default is the CLI/Vite same-origin subset endpoint.
 */
export function studioIconApiBaseUrl(hostDocument: Document): string {
  const configured = hostDocument
    .querySelector<HTMLMetaElement>(`meta[name="${ICON_API_META_NAME}"]`)
    ?.content.trim();
  return resolveStudioIconApiBaseUrl(hostDocument.baseURI, configured);
}

export function resolveStudioIconApiBaseUrl(baseUrl: string, configured?: string): string {
  return new URL(configured || "__kdiagram/icons", new URL(".", baseUrl))
    .toString()
    .replace(/\/$/, "");
}

/** Canonical public Studio used for portable share links, even from a local CLI session. */
export function publicStudioUrl(hostDocument: Pick<Document, "baseURI" | "querySelector">): string {
  const configured = hostDocument
    .querySelector<HTMLMetaElement>(`meta[name="${PUBLIC_STUDIO_META_NAME}"]`)
    ?.content.trim();
  return new URL(configured || ".", hostDocument.baseURI).toString();
}
