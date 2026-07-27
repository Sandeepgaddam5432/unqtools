/**
 * Blob Shape Generator (SVG) — pure logic.
 */

export interface BlobOptions {
  width: number;
  height: number;
  fill: string;
  stroke: string;
  strokeWidth: number;
  complexity: number; // number of points (5-12)
  smoothness: number; // 0-1
  seed: number;
}

export function defaultOptions(): BlobOptions {
  return { width: 200, height: 200, fill: "#3b82f6", stroke: "none", strokeWidth: 0, complexity: 8, smoothness: 0.5, seed: 42 };
}

function seededRandom(seed: number): () => number {
  let s = seed;
  return () => { s = (s * 9301 + 49297) % 233280; return s / 233280; };
}

export function generateBlob(opts: BlobOptions): string {
  const rng = seededRandom(opts.seed);
  const cx = opts.width / 2;
  const cy = opts.height / 2;
  const baseRadius = Math.min(opts.width, opts.height) / 2 - Math.max(opts.strokeWidth, 0);
  const points: { x: number; y: number }[] = [];
  const count = Math.max(5, Math.min(12, opts.complexity));
  for (let i = 0; i < count; i++) {
    const angle = (i / count) * Math.PI * 2;
    const r = baseRadius * (0.7 + rng() * 0.3 * (1 - opts.smoothness + 0.3));
    points.push({ x: cx + Math.cos(angle) * r, y: cy + Math.sin(angle) * r });
  }
  let path = `M ${points[0].x.toFixed(2)} ${points[0].y.toFixed(2)}`;
  for (let i = 0; i < count; i++) {
    const cur = points[i];
    const next = points[(i + 1) % count];
    const mid = { x: (cur.x + next.x) / 2, y: (cur.y + next.y) / 2 };
    const cp = opts.smoothness;
    const cpx = cur.x * (1 - cp) + mid.x * cp;
    const cpy = cur.y * (1 - cp) + mid.y * cp;
    path += ` Q ${cpx.toFixed(2)} ${cpy.toFixed(2)}, ${mid.x.toFixed(2)} ${mid.y.toFixed(2)}`;
  }
  path += " Z";
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${opts.width}" height="${opts.height}" viewBox="0 0 ${opts.width} ${opts.height}"><path d="${path}" fill="${opts.fill}" stroke="${opts.stroke}" stroke-width="${opts.strokeWidth}"/></svg>`;
}

export function generateBulk(seed: number, count: number, opts: BlobOptions): string[] {
  return Array.from({ length: count }, (_, i) => generateBlob({ ...opts, seed: seed + i * 1000 }));
}

export function getPresets(): { name: string; options: Partial<BlobOptions> }[] {
  return [
    { name: "Default", options: {} },
    { name: "Smooth", options: { smoothness: 0.8, complexity: 6 } },
    { name: "Spiky", options: { smoothness: 0.2, complexity: 10 } },
    { name: "Organic", options: { smoothness: 0.6, complexity: 8 } },
    { name: "Minimal", options: { smoothness: 0.9, complexity: 5 } },
  ];
}
