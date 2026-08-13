import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";
import {
  adaptIconBodyColors,
  collectIconIds,
  defaultIconPaint,
  iconDisplaySize,
  loadIconSubset,
  isThemeableInk,
  normalizeIconId,
  preloadIcons,
  resetIconCaches,
  resolveIcon,
  resolveIconPaint,
  renderIconById,
  registerIcon,
} from "./index.ts";

describe("kdiagram-icons", () => {
  it("creates a bounded same-origin subset with aliases flattened", async () => {
    const subset = await loadIconSubset("lucide", ["shopping-cart", "not-a-real-icon"]);

    expect(subset?.prefix).toBe("lucide");
    expect(Object.keys(subset?.icons ?? {})).toEqual(["shopping-cart"]);
    expect(subset?.icons["shopping-cart"]?.body).toContain("path");
    expect(await loadIconSubset("unknown", ["anything"])).toBeNull();
  });

  beforeEach(() => {
    resetIconCaches();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("normalizes builtins and aliases", () => {
    expect(normalizeIconId("database")).toBe("builtin:database");
    expect(normalizeIconId("cart")).toBe("lucide:shopping-cart");
    expect(normalizeIconId("shopping-cart")).toBe("lucide:shopping-cart");
    expect(normalizeIconId("logos:aws")).toBe("logos:aws");
    expect(normalizeIconId("AWS")).toBe("logos:aws");
    expect(normalizeIconId("person")).toBe("lucide:user");
    expect(normalizeIconId("actor")).toBe("lucide:user");
  });

  it("returns empty string for unknown icons instead of service fallback", () => {
    expect(renderIconById("not-a-real-icon-name-xyz", 10, 10)).toBe("");
  });

  it("resolves builtins synchronously", () => {
    const icon = resolveIcon("database");
    expect(icon?.id).toBe("builtin:database");
    expect(icon?.body).toContain("ellipse");
    expect(icon?.paint).toBe("stroke");
  });

  it("lazy-loads Iconify collections and caches icons", async () => {
    expect(resolveIcon("mdi:database")).toBeNull();
    await preloadIcons(["mdi:database", "logos:aws"]);
    const db = resolveIcon("mdi:database");
    const aws = resolveIcon("logos:aws");
    expect(db?.body.length).toBeGreaterThan(10);
    expect(aws?.body.length).toBeGreaterThan(10);
    expect(db?.paint).toBe("fill");
  });

  it("loads only requested Iconify icons in browsers", async () => {
    vi.stubGlobal("window", {});
    const fetchMock = vi.fn(async (url: string) => {
      const requested = new URL(url).searchParams.get("icons")?.split(",") ?? [];
      return {
        ok: true,
        json: async () => ({
          prefix: "logos",
          icons: Object.fromEntries(
            requested.map((name) => [name, { body: `<path data-icon="${name}"/>` }]),
          ),
        }),
      };
    });
    vi.stubGlobal("fetch", fetchMock);

    await preloadIcons(["logos:postgresql", "logos:redis"]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain("icons=postgresql%2Credis");
    expect(resolveIcon("logos:postgresql")?.body).toContain("postgresql");

    await preloadIcons(["logos:postgresql", "logos:kafka"]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(String(fetchMock.mock.calls[1]?.[0])).toContain("icons=kafka");
    expect(String(fetchMock.mock.calls[1]?.[0])).not.toContain("postgresql");
  });

  it("defaults brand paint for all collections; iconColor forces theme", () => {
    expect(defaultIconPaint("logos")).toBe("brand");
    expect(defaultIconPaint("simple-icons")).toBe("brand");
    expect(defaultIconPaint("lucide")).toBe("brand");
    expect(defaultIconPaint("mdi")).toBe("brand");
    expect(resolveIconPaint("logos:aws")).toBe("brand");
    expect(resolveIconPaint("logos:aws", "theme")).toBe("theme");
    expect(resolveIconPaint("lucide:cloud")).toBe("brand");
    expect(resolveIconPaint("lucide:cloud", undefined, { hasIconColor: true })).toBe("theme");
    expect(resolveIconPaint("logos:aws", undefined, { hasIconColor: true })).toBe("theme");
  });

  it("rewrites dark brand ink to currentColor but keeps accent colors", () => {
    expect(isThemeableInk("#252f3e")).toBe(true);
    expect(isThemeableInk("#f90")).toBe(false);
    expect(isThemeableInk("#ff9900")).toBe(false);
    expect(adaptIconBodyColors(`<path fill="#252f3e"/><path fill="#f90"/>`)).toBe(
      `<path fill="currentColor"/><path fill="#f90"/>`,
    );
  });

  it("preserves brand logo fills by default and themes on override", async () => {
    await preloadIcons(["logos:aws"]);
    const aws = resolveIcon("logos:aws");
    expect(aws?.body).toMatch(/#252f3e/i);
    expect(aws?.body).toMatch(/#f90/i);

    const brand = renderIconById("logos:aws", 50, 40, { height: 24 });
    expect(brand).not.toContain('color="var(--node-stroke');
    expect(brand).toMatch(/#252f3e/i);
    expect(brand).toMatch(/#f90/i);

    const themed = renderIconById("logos:aws", 50, 40, { height: 24, paint: "theme" });
    expect(themed).toContain(
      'color="var(--icon-color, var(--node-stroke, var(--kd-node-stroke)))"',
    );
    expect(themed).toContain('fill="currentColor"');
    expect(themed).toMatch(/fill="#f90"/i);
    expect(themed).not.toContain("#252f3e");
  });

  it("sizes glyphs by aspect ratio with a max width clamp", () => {
    expect(iconDisplaySize({ width: 24, height: 24 }, 20)).toEqual({ width: 20, height: 20 });
    expect(iconDisplaySize({ width: 48, height: 24 }, 20)).toEqual({ width: 35, height: 20 });
    expect(iconDisplaySize({ width: 100, height: 20 }, 20, { maxAspect: 1.75 })).toEqual({
      width: 35,
      height: 20,
    });
  });

  it("renders positioned SVG fragments; Lucide follows CSS icon color by default", async () => {
    await preloadIcons(["lucide:cloud"]);
    const icon = resolveIcon("lucide:cloud");
    const { width, height } = iconDisplaySize(icon!, 24);
    const svg = renderIconById("lucide:cloud", 50, 40, { height: 24 });
    expect(svg).toContain(`transform="translate(${50 - width / 2}, ${40 - height / 2})"`);
    expect(svg).toContain(`width="${width}"`);
    expect(svg).toContain(`height="${height}"`);
    expect(svg).toContain("<svg");
    // Brand default — no forced color attr; .flow-node-icon-mark CSS supplies ink.
    expect(svg).not.toContain('color="var(--node-stroke');
    expect(svg).toContain('class="flow-node-icon-mark"');

    const tinted = renderIconById("lucide:cloud", 50, 40, {
      height: 24,
      color: "var(--icon-color, var(--node-stroke, var(--kd-node-stroke)))",
    });
    expect(tinted).toContain(
      'color="var(--icon-color, var(--node-stroke, var(--kd-node-stroke)))"',
    );
  });

  it("supports custom registered icons", () => {
    registerIcon("arch:box", {
      body: `<rect width="16" height="16" fill="currentColor"/>`,
      viewBox: "0 0 16 16",
      width: 16,
      height: 16,
      paint: "fill",
    });
    expect(resolveIcon("arch:box")?.body).toContain("rect");
  });

  it("collects unique icon ids from nodes", () => {
    const ids = collectIconIds([
      { icon: "database" },
      { icon: "mdi:cart" },
      { icon: "database" },
      { icon: "none" },
      {},
    ]);
    expect(ids.sort()).toEqual(["builtin:database", "mdi:cart"]);
  });
});
