export type ThemeMode = "dark" | "light";

/**
 * A shared Studio link presents a palette without rewriting the diagram.
 * Keep that presentation theme until the document's own theme setting changes.
 */
export function themeAfterSourceEdit(
  previousSourceTheme: ThemeMode,
  nextSourceTheme: ThemeMode,
  currentTheme: ThemeMode,
  sharedTheme: ThemeMode | undefined,
): { theme: ThemeMode; sharedTheme: ThemeMode | undefined } {
  if (sharedTheme && nextSourceTheme === previousSourceTheme) {
    return { theme: currentTheme, sharedTheme };
  }
  return { theme: nextSourceTheme, sharedTheme: undefined };
}
