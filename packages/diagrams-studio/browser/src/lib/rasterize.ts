import { pngPixelSize, pngScaleFits, readSvgSize, type PngScale } from "./delivery.ts";

/** Draw a library-rendered SVG onto a canvas. Callers must pass SVG from the renderer. */
export async function rasterizeSvg(svg: string, scale: PngScale): Promise<Blob> {
  if (!pngScaleFits(svg, scale)) {
    throw new Error(`This diagram is too large for a ${scale}× PNG. Choose a smaller scale.`);
  }
  const size = readSvgSize(svg);
  const pixels = pngPixelSize(svg, scale);
  if (!size || !pixels) throw new Error("The diagram SVG has no pixel size.");

  const url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml;charset=utf-8" }));
  try {
    const image = await loadImage(url);
    const canvas = document.createElement("canvas");
    canvas.width = pixels.width;
    canvas.height = pixels.height;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("This browser cannot export PNG.");
    context.drawImage(image, 0, 0, pixels.width, pixels.height);
    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(resolve, "image/png");
    });
    if (!blob) throw new Error("Could not encode the PNG.");
    return blob;
  } finally {
    URL.revokeObjectURL(url);
  }
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("The browser could not draw this diagram as PNG."));
    image.src = url;
  });
}
