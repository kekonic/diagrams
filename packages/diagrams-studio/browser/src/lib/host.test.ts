import { describe, expect, it } from "vite-plus/test";
import { publicStudioUrl, resolveStudioIconApiBaseUrl, studioHostUrl } from "./host.ts";

describe("Studio host URLs", () => {
  it("keeps transport and icon routes inside a hosted subpath", () => {
    const base = "https://docs.example.test/products/diagrams/studio/index.html";

    expect(studioHostUrl("message?token=secret", base)).toBe(
      "https://docs.example.test/products/diagrams/studio/message?token=secret",
    );
    expect(resolveStudioIconApiBaseUrl(base)).toBe(
      "https://docs.example.test/products/diagrams/studio/__kdiagram/icons",
    );
  });

  it("supports an absolute Iconify-compatible host override", () => {
    expect(
      resolveStudioIconApiBaseUrl(
        "https://docs.example.test/studio/",
        "https://icons.example.test/api/",
      ),
    ).toBe("https://icons.example.test/api");
  });
});

describe("publicStudioUrl", () => {
  it("uses an explicit canonical Studio host for portable links", () => {
    const hostDocument = {
      baseURI: "http://127.0.0.1:4312/",
      querySelector: () => ({ content: "https://diagrams.example/studio/" }),
    } as unknown as Pick<Document, "baseURI" | "querySelector">;
    expect(publicStudioUrl(hostDocument)).toBe("https://diagrams.example/studio/");
  });
});
