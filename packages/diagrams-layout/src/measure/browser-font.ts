/** Load bundled Inter via FontFace so canvas metrics match CLI opentype measurer. */

let fontLoadPromise: Promise<void> | null = null;
let fontsReady = false;

export function browserFontsReady(): boolean {
  return fontsReady;
}

export function ensureBrowserFonts(fontUrl: string): Promise<void> {
  if (typeof document === "undefined") return Promise.resolve();
  if (fontsReady) return Promise.resolve();
  if (fontLoadPromise) return fontLoadPromise;

  fontLoadPromise = (async () => {
    const face = new FontFace("Inter", `url(${fontUrl})`, {
      weight: "500",
      style: "normal",
    });
    await face.load();
    document.fonts.add(face);
    await document.fonts.load('500 14px "Inter"');
    fontsReady = true;
  })();

  return fontLoadPromise;
}
