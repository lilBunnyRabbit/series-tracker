import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import sharp from "sharp";

const ROOT = new URL("..", import.meta.url).pathname;
const STATIC = join(ROOT, "static");

const ANY_SVG = await readFile(join(STATIC, "icon.svg"));
const MASKABLE_SVG = await readFile(join(STATIC, "icon-maskable.svg"));

async function pngFrom(svg: Buffer, size: number, out: string): Promise<void> {
  const buf = await sharp(svg, { density: 384 }).resize(size, size).png({ compressionLevel: 9 }).toBuffer();
  await writeFile(join(STATIC, out), buf);
  console.log(`✓ ${out} (${size}x${size}, ${buf.length} bytes)`);
}

await Promise.all([
  pngFrom(ANY_SVG, 64, "pwa-64x64.png"),
  pngFrom(ANY_SVG, 192, "pwa-192x192.png"),
  pngFrom(ANY_SVG, 512, "pwa-512x512.png"),
  pngFrom(ANY_SVG, 180, "apple-touch-icon-180x180.png"),
  pngFrom(MASKABLE_SVG, 512, "maskable-icon-512x512.png"),
]);

const ICO_BUF = await sharp(ANY_SVG, { density: 192 }).resize(32, 32).png().toBuffer();
await writeFile(join(STATIC, "favicon.ico"), ICO_BUF);
console.log(`✓ favicon.ico (32x32 PNG container, ${ICO_BUF.length} bytes)`);

console.log("\nAll icons generated.");
