import { describe, expect, it } from "vite-plus/test";
import { themeAfterSourceEdit } from "./shared-theme.ts";

describe("shared presentation theme", () => {
  it("keeps the shared palette while the document theme is untouched", () => {
    expect(themeAfterSourceEdit("dark", "dark", "light", "light")).toEqual({
      theme: "light",
      sharedTheme: "light",
    });
  });

  it("follows the document once its theme setting changes", () => {
    expect(themeAfterSourceEdit("dark", "light", "light", "light")).toEqual({
      theme: "light",
      sharedTheme: undefined,
    });
  });
});
