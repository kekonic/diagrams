const HTTP_METHODS = new Set([
  "GET",
  "POST",
  "PUT",
  "PATCH",
  "DELETE",
  "HEAD",
  "OPTIONS",
  "TRACE",
  "CONNECT",
]);

/** A route token value: `/checkout` or `/orders/{id}`. */
const ROUTE = /^\/[A-Za-z0-9._~:@%+{}/-]+$/;

export function isHttpMethod(word: string): boolean {
  return HTTP_METHODS.has(word.toUpperCase());
}

/**
 * Print a message label. `POST /checkout` and `/orders/{id}` stay unquoted.
 * Every other label stays a string.
 */
export function formatEdgeLabel(label: string): string {
  const space = label.indexOf(" ");
  if (space > 0) {
    const method = label.slice(0, space);
    const route = label.slice(space + 1);
    if (isHttpMethod(method) && ROUTE.test(route)) return `${method} ${route}`;
  }
  if (ROUTE.test(label)) return label;
  return `"${label}"`;
}
