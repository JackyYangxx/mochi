#!/usr/bin/env node
/**
 * Pure-JS generator for the default pet GIF.
 *
 * Uses `gifenc` (a tiny, well-tested pure-JS GIF encoder, ~10 KB, no deps)
 * to encode a hand-drawn pixel cat face.
 *
 * Output: assets/pet-default.gif  (96x96, 2-frame blink, ~2-4 KB)
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import gifenc from 'gifenc';
const { GIFEncoder, applyPalette } = gifenc;

const SIZE = 96;
const cx = SIZE / 2;
const cy = SIZE / 2 + 6; // face center, shifted down to leave room for ears
const faceR = 30;

// 8-color palette: index 0 reserved as transparent (rgba 0,0,0,0)
const PALETTE = [
  [0, 0, 0, 0],         // 0 transparent
  [255, 179, 112, 255], // 1 orange (body)
  [90, 58, 42, 255],    // 2 dark brown (eyes, mouth, whiskers)
  [255, 245, 224, 255], // 3 cream (muzzle)
  [255, 143, 163, 255], // 4 pink (nose, inner ear)
  [232, 144, 85, 255],  // 5 darker orange (cheek shading)
  [255, 255, 255, 255], // 6 white (eye highlight)
  [58, 32, 16, 255],    // 7 dark outline
];

// --- geometry helpers ---
const inCircle = (x, y, ccx, ccy, r) => {
  const dx = x - ccx;
  const dy = y - ccy;
  return dx * dx + dy * dy <= r * r;
};
const inEllipse = (x, y, ccx, ccy, rx, ry) => {
  const dx = (x - ccx) / rx;
  const dy = (y - ccy) / ry;
  return dx * dx + dy * dy <= 1;
};
const inTriangle = (px, py, ax, ay, bx, by, cxx, cyy) => {
  const d = (bx - ax) * (cyy - ay) - (by - ay) * (cxx - ax);
  const a = ((px - ax) * (cyy - ay) - (py - ay) * (cxx - ax)) / d;
  const b = ((bx - ax) * (py - ay) - (by - ay) * (px - ax)) / d;
  const c = 1 - a - b;
  return a >= 0 && b >= 0 && c >= 0;
};

function drawRGBA(blink) {
  const rgba = new Uint8Array(SIZE * SIZE * 4);
  const setPx = (i, p) => {
    rgba[i * 4] = p[0];
    rgba[i * 4 + 1] = p[1];
    rgba[i * 4 + 2] = p[2];
    rgba[i * 4 + 3] = p[3];
  };

  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      let idx = 0;
      // ears (outer orange, inner pink) — drawn first so head can cover overlap
      if (inTriangle(x, y, cx - 30, cy - 12, cx - 19, cy - 32, cx - 4, cy - 14)) idx = 1;
      if (inTriangle(x, y, cx + 30, cy - 12, cx + 19, cy - 32, cx + 4, cy - 14)) idx = 1;
      if (inTriangle(x, y, cx - 24, cy - 16, cx - 19, cy - 27, cx - 9, cy - 16)) idx = 4;
      if (inTriangle(x, y, cx + 24, cy - 16, cx + 19, cy - 27, cx + 9, cy - 16)) idx = 4;
      // head outline (1-px ring at faceR) + body
      if (inCircle(x, y, cx, cy, faceR + 0.5) && !inCircle(x, y, cx, cy, faceR - 0.5)) idx = 7;
      if (inCircle(x, y, cx, cy, faceR - 0.5)) idx = 1;
      // cheek shading
      if (idx === 1 && inEllipse(x, y, cx - 16, cy + 6, 5, 3)) idx = 5;
      if (idx === 1 && inEllipse(x, y, cx + 16, cy + 6, 5, 3)) idx = 5;
      // muzzle (cream)
      if (idx === 1 && inEllipse(x, y, cx, cy + 8, 8, 5)) idx = 3;
      // eye highlights (drawn before eyes so eyes can paint over)
      if (!blink) {
        if (inEllipse(x, y, cx - 12, cy - 6, 1.6, 1.6)) idx = 6;
        if (inEllipse(x, y, cx + 8, cy - 6, 1.6, 1.6)) idx = 6;
      }
      // eyes
      if (inEllipse(x, y, cx - 11, cy - 5, 4, blink ? 0.8 : 5)) idx = 2;
      if (inEllipse(x, y, cx + 11, cy - 5, 4, blink ? 0.8 : 5)) idx = 2;
      // nose
      if (inTriangle(x, y, cx - 2.5, cy + 4, cx + 2.5, cy + 4, cx, cy + 7.5)) idx = 4;
      // mouth: short vertical drop + W curve
      if (x === Math.round(cx) && y === Math.round(cy + 8)) idx = 2;
      const mY = Math.round(cy + 9);
      for (let dx of [-1, -2, -3]) {
        if (x === Math.round(cx + dx) && y === mY + Math.floor(Math.abs(dx) / 2)) idx = 2;
        if (x === Math.round(cx - dx) && y === mY + Math.floor(Math.abs(dx) / 2)) idx = 2;
      }
      setPx(y * SIZE + x, PALETTE[idx]);
    }
  }

  // whiskers (second pass — always paint, even over face, so they're visible)
  const drawLine = (x1, y1, x2, y2) => {
    const dx = Math.abs(x2 - x1);
    const dy = Math.abs(y2 - y1);
    const sx = x1 < x2 ? 1 : -1;
    const sy = y1 < y2 ? 1 : -1;
    let err = dx - dy;
    let x = x1, y = y1;
    for (let i = 0; i < 200; i++) {
      if (x >= 0 && x < SIZE && y >= 0 && y < SIZE) {
        const off = (y * SIZE + x) * 4;
        rgba[off] = PALETTE[2][0];
        rgba[off + 1] = PALETTE[2][1];
        rgba[off + 2] = PALETTE[2][2];
        rgba[off + 3] = 255;
      }
      if (x === x2 && y === y2) break;
      const e2 = 2 * err;
      if (e2 > -dy) { err -= dy; x += sx; }
      if (e2 < dx) { err += dx; y += sy; }
    }
  };
  const W = [
    [cx - 10, cy + 8, cx - 26, cy + 5],
    [cx - 10, cy + 10, cx - 28, cy + 10],
    [cx - 10, cy + 12, cx - 26, cy + 15],
    [cx + 10, cy + 8, cx + 26, cy + 5],
    [cx + 10, cy + 10, cx + 28, cy + 10],
    [cx + 10, cy + 12, cx + 26, cy + 15],
  ];
  for (const [x1, y1, x2, y2] of W) drawLine(x1, y1, x2, y2);

  return rgba;
}

// --- encode ---
const open = drawRGBA(false);
const blink = drawRGBA(true);

// applyPalette wants the palette as array of [r,g,b] (no alpha)
const paletteRGB = PALETTE.map(([r, g, b]) => [r, g, b]);
const idxOpen = applyPalette(open, paletteRGB, 'rgb565');
const idxBlink = applyPalette(blink, paletteRGB, 'rgb565');

const gif = GIFEncoder();
gif.writeFrame(idxOpen, SIZE, SIZE, {
  palette: paletteRGB,
  delay: 150,
  transparent: true,
  transparentIndex: 0,
});
gif.writeFrame(idxBlink, SIZE, SIZE, {
  palette: paletteRGB,
  delay: 15,
  transparent: true,
  transparentIndex: 0,
});
gif.writeFrame(idxOpen, SIZE, SIZE, {
  palette: paletteRGB,
  delay: 150,
  transparent: true,
  transparentIndex: 0,
});
gif.finish();

const outPath = resolve(dirname(fileURLToPath(import.meta.url)), '../assets/pet-default.gif');
mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, Buffer.from(gif.bytes()));
console.log(`Wrote ${gif.bytes().length} bytes to ${outPath}`);
