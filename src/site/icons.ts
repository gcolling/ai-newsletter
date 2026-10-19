import { crc32, deflateSync } from "node:zlib";

type Point = [number, number];

/** The gem mark on a 64-unit grid: facets drawn back to front, centered on (32, 32). */
const BACKGROUND = "#0A2A8F";
const FACETS: [string, Point[]][] = [
  [
    "#3F63D6",
    [
      [20, 17],
      [44, 17],
      [52, 26],
      [32, 47],
      [12, 26],
    ],
  ],
  [
    "#7F9BF0",
    [
      [20, 17],
      [44, 17],
      [52, 26],
      [12, 26],
    ],
  ],
  [
    "#C9D6FF",
    [
      [26, 17],
      [38, 17],
      [32, 26],
    ],
  ],
  [
    "#1E43B8",
    [
      [32, 47],
      [26, 26],
      [38, 26],
    ],
  ],
];

const rgb = (hex: string) => [1, 3, 5].map((i) => Number.parseInt(hex.slice(i, i + 2), 16));

function inside([x, y]: Point, poly: Point[]): boolean {
  let hit = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i] as Point;
    const [xj, yj] = poly[j] as Point;
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) hit = !hit;
  }
  return hit;
}

/**
 * Rasterises the mark into an RGBA buffer with 4×4 supersampling. `scale` shrinks the gem towards
 * the center, so maskable icons keep it inside the platform's safe zone.
 */
function rasterise(size: number, scale: number): Buffer {
  const pixels = Buffer.alloc(size * size * 4);
  const background = rgb(BACKGROUND);
  const facets = FACETS.map(([hex, poly]) => [rgb(hex), poly] as const);
  const samples = 4;
  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      const sum = [0, 0, 0];
      for (let sy = 0; sy < samples; sy++) {
        for (let sx = 0; sx < samples; sx++) {
          const gx = ((px + (sx + 0.5) / samples) / size) * 64;
          const gy = ((py + (sy + 0.5) / samples) / size) * 64;
          const p: Point = [32 + (gx - 32) / scale, 32 + (gy - 32) / scale];
          let color = background;
          for (const [c, poly] of facets) if (inside(p, poly)) color = c;
          for (let k = 0; k < 3; k++) sum[k] = (sum[k] ?? 0) + (color[k] ?? 0);
        }
      }
      const o = (py * size + px) * 4;
      for (let k = 0; k < 3; k++) pixels[o + k] = Math.round((sum[k] ?? 0) / samples ** 2);
      pixels[o + 3] = 255;
    }
  }
  return pixels;
}

function chunk(type: string, data: Buffer): Buffer {
  const head = Buffer.alloc(8);
  head.writeUInt32BE(data.length, 0);
  head.write(type, 4, "ascii");
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([head.subarray(4), data])), 0);
  return Buffer.concat([head, data, crc]);
}

/** A minimal PNG encoder (8-bit RGBA, no filtering): enough for app icons, no dependency. */
export function iconPng(size: number, scale = 1): Buffer {
  const pixels = rasterise(size, scale);
  const rows = Buffer.alloc(size * (size * 4 + 1));
  for (let y = 0; y < size; y++) {
    pixels.copy(rows, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4);
  }
  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0);
  header.writeUInt32BE(size, 4);
  header.set([8, 6, 0, 0, 0], 8); // 8-bit depth, RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", header),
    chunk("IDAT", deflateSync(rows)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}
