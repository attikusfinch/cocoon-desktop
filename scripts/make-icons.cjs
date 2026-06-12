// Builds app icons from the upstream Cocoon marketing art
// (CocoonEggFull.webp: transparent bg, glossy egg in the middle, dotted
// callout lines + pills at the sides).
//
// Strategy: find the egg's exact alpha bounding box inside the central
// column (excluding the side pills), erase the dotted-line stubs that touch
// the egg, then center the egg on a transparent square with padding.
//
// Outputs:
//   app-icon.png      1024² — feed to `npm run tauri icon app-icon.png`
//   src/assets/egg.png 512² — in-app logo mark
// Usage: node scripts/make-icons.cjs
const sharp = require("sharp");
const path = require("path");

const SRC = path.resolve(__dirname, "../../gocoon/cmd/gocoon/assets/CocoonEggFull.webp");
const OUT_ICON = path.resolve(__dirname, "../app-icon.png");
const OUT_MARK = path.resolve(__dirname, "../src/assets/egg.png");

async function main() {
  const { data, info } = await sharp(SRC).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width, height, channels } = info;
  const alphaAt = (x, y) => data[(y * width + x) * channels + 3];

  // Egg lives in the central column; pills/lines live outside x∈[0.36w, 0.66w].
  const x0 = Math.round(width * 0.36);
  const x1 = Math.round(width * 0.66);
  let top = height, bottom = 0, left = width, right = 0;
  for (let y = 0; y < height; y++) {
    for (let x = x0; x < x1; x++) {
      if (alphaAt(x, y) > 24) {
        if (y < top) top = y;
        if (y > bottom) bottom = y;
        if (x < left) left = x;
        if (x > right) right = x;
      }
    }
  }
  const box = { left, top, width: right - left + 1, height: bottom - top + 1 };
  console.log("egg bbox:", box);

  // Find the dotted-line rows: opaque pixels well left of the egg.
  let lineTop = height, lineBottom = 0;
  for (let y = 0; y < height; y++) {
    for (let x = Math.round(width * 0.1); x < Math.round(width * 0.3); x++) {
      if (alphaAt(x, y) > 24) {
        if (y < lineTop) lineTop = y;
        if (y > lineBottom) lineBottom = y;
      }
    }
  }
  console.log("callout rows:", lineTop, "..", lineBottom);

  // Erase the dotted-line stubs without touching the egg: the egg is convex
  // and contiguous from its center column, so per row the first transparent
  // pixel outward marks the silhouette edge — clear everything beyond it.
  const raw = await sharp(SRC).extract(box).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const eggData = raw.data;
  const ew = raw.info.width;
  const ech = raw.info.channels;
  const cx = Math.round(ew / 2);
  const a = (x, y) => eggData[(y * ew + x) * ech + 3];
  const clear = (x, y) => {
    eggData[(y * ew + x) * ech + 3] = 0;
  };
  for (let y = Math.max(0, lineTop - top - 8); y <= Math.min(box.height - 1, lineBottom - top + 8); y++) {
    let edgeL = 0;
    for (let x = cx; x >= 0; x--) {
      if (a(x, y) <= 24) {
        edgeL = x;
        break;
      }
    }
    for (let x = 0; x <= edgeL; x++) clear(x, y);
    let edgeR = ew - 1;
    for (let x = cx; x < ew; x++) {
      if (a(x, y) <= 24) {
        edgeR = x;
        break;
      }
    }
    for (let x = edgeR; x < ew; x++) clear(x, y);
  }
  const egg = await sharp(eggData, { raw: { width: ew, height: raw.info.height, channels: ech } })
    .png()
    .toBuffer();

  const emit = async (outPath, outSize, pad) => {
    const side = Math.round(Math.max(box.width, box.height) * (1 + pad * 2));
    await sharp({ create: { width: side, height: side, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
      .composite([
        { input: egg, left: Math.round((side - box.width) / 2), top: Math.round((side - box.height) / 2) },
      ])
      .png()
      .toBuffer()
      .then((buf) => sharp(buf).resize(outSize, outSize).png().toFile(outPath));
    console.log("wrote", outPath);
  };

  await emit(OUT_ICON, 1024, 0.1);
  await emit(OUT_MARK, 512, 0.04);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
