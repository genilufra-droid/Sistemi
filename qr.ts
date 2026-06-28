/**
 * QR code helper.
 *
 * We import the *browser* build of the `qrcode` package (`qrcode/lib/browser`)
 * rather than the package root. The root entry pulls in Node-only renderers
 * (PNG / terminal) that depend on `fs`/`zlib`/`canvas`, which break the Metro /
 * Hermes bundle. The browser build only needs pure JS + a lazily-created
 * <canvas>/<svg>, so it bundles cleanly in React Native.
 *
 * `toString(text, { type: "svg" })` returns a self-contained <svg> string that
 * we can both render on-screen (via react-native-svg's <SvgXml/>) and inject
 * straight into the print HTML.
 */
import QRCode from "qrcode/lib/browser";

export { qrPayload } from "./print-templates";

/**
 * Generate a pure SVG string for the given text. Returns "" on any failure so
 * callers can degrade gracefully (the document simply prints without a QR).
 */
export async function generateQrSvg(text: string, size = 120): Promise<string> {
  const value = (text || "").trim();
  if (!value) return "";
  try {
    const svg: string = await (QRCode as any).toString(value, {
      type: "svg",
      margin: 1,
      width: size,
      errorCorrectionLevel: "M",
    });
    return svg || "";
  } catch {
    return "";
  }
}
