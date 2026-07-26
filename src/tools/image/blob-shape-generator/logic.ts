/**
 * Blob Shape Generator (SVG) — pure logic.
 * SVG generation utilities.
 */

export interface SvgOptions {
  width: number;
  height: number;
  fill: string;
  stroke: string;
  strokeWidth: number;
  opacity: number;
}

export function defaultOptions(): SvgOptions {
  return { width: 200, height: 200, fill: "#3b82f6", stroke: "#1e40af", strokeWidth: 2, opacity: 1 };
}

export function generateBlob(seed: number, opts: SvgOptions): string {
  // Seeded random
  let s = seed;
  const rng = () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };

  const points = 8;
  const cx = opts.width / 2;
  const cy = opts.height / 2;
  const baseRadius = Math.min(opts.width, opts.height) / 2 - opts.strokeWidth;
  const pts: { x: number; y: number }[] = [];
  for (let i = 0; i < points; i++) {
    const angle = (i / points) * Math.PI * 2;
    const r = baseRadius * (0.7 + rng() * 0.3);
    pts.push({ x: cx + Math.cos(angle) * r, y: cy + Math.sin(angle) * r });
  }

  // Smooth Bezier path through points
  let path = `M ${pts[0].x.toFixed(2)} ${pts[0].y.toFixed(2)}`;
  for (let i = 0; i < points; i++) {
    const cur = pts[i];
    const next = pts[(i + 1) % points];
    const mid = { x: (cur.x + next.x) / 2, y: (cur.y + next.y) / 2 };
    path += ` Q ${cur.x.toFixed(2)} ${cur.y.toFixed(2)}, ${mid.x.toFixed(2)} ${mid.y.toFixed(2)}`;
  }
  path += " Z";

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${opts.width}" height="${opts.height}" viewBox="0 0 ${opts.width} ${opts.height}">
  <path d="${path}" fill="${opts.fill}" stroke="${opts.stroke}" stroke-width="${opts.strokeWidth}" opacity="${opts.opacity}"/>
</svg>`;
}

export function generateStripes(opts: SvgOptions & { stripeWidth: number; color2: string }): string {
  const w = opts.width, h = opts.height;
  const sw = opts.stripeWidth;
  const stripes = Math.ceil(w / (sw * 2));
  let rects = "";
  for (let i = 0; i < stripes; i++) {
    const x = i * sw * 2;
    rects += `  <rect x="${x}" y="0" width="${sw}" height="${h}" fill="${opts.fill}"/>\n`;
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
  <rect width="${w}" height="${h}" fill="${opts.color2}"/>
${rects}}</svg>`;
}

export function generateDots(opts: SvgOptions & { spacing: number; radius: number; color2: string }): string {
  const w = opts.width, h = opts.height;
  const sp = opts.spacing, r = opts.radius;
  let circles = "";
  for (let y = sp; y < h; y += sp) {
    for (let x = sp; x < w; x += sp) {
      circles += `  <circle cx="${x}" cy="${y}" r="${r}" fill="${opts.fill}"/>\n`;
    }
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
  <rect width="${w}" height="${h}" fill="${opts.color2}"/>
${circles}}</svg>`;
}

export function generateGrid(opts: SvgOptions & { cellSize: number; color2: string }): string {
  const w = opts.width, h = opts.height;
  const cs = opts.cellSize;
  let lines = "";
  for (let x = 0; x <= w; x += cs) {
    lines += `  <line x1="${x}" y1="0" x2="${x}" y2="${h}" stroke="${opts.fill}" stroke-width="${opts.strokeWidth}"/>\n`;
  }
  for (let y = 0; y <= h; y += cs) {
    lines += `  <line x1="0" y1="${y}" x2="${w}" y2="${y}" stroke="${opts.fill}" stroke-width="${opts.strokeWidth}"/>\n`;
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
  <rect width="${w}" height="${h}" fill="${opts.color2}"/>
${lines}}</svg>`;
}

export function generateCheckerboard(opts: SvgOptions & { cellSize: number; color2: string }): string {
  const w = opts.width, h = opts.height;
  const cs = opts.cellSize;
  let rects = "";
  for (let y = 0; y < h; y += cs) {
    for (let x = 0; x < w; x += cs) {
      if ((Math.floor(x / cs) + Math.floor(y / cs)) % 2 === 0) {
        rects += `  <rect x="${x}" y="${y}" width="${cs}" height="${cs}" fill="${opts.fill}"/>\n`;
      }
    }
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
  <rect width="${w}" height="${h}" fill="${opts.color2}"/>
${rects}}</svg>`;
}

export function generateWave(opts: SvgOptions & { amplitude: number; frequency: number; color2: string }): string {
  const w = opts.width, h = opts.height;
  const amp = opts.amplitude, freq = opts.frequency;
  const steps = 100;
  let path = `M 0 ${h / 2}`;
  for (let i = 0; i <= steps; i++) {
    const x = (i / steps) * w;
    const y = h / 2 + Math.sin((i / steps) * Math.PI * 2 * freq) * amp;
    path += ` L ${x.toFixed(2)} ${y.toFixed(2)}`;
  }
  path += ` L ${w} ${h} L 0 ${h} Z`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
  <rect width="${w}" height="${h}" fill="${opts.color2}"/>
  <path d="${path}" fill="${opts.fill}" opacity="${opts.opacity}"/>
</svg>`;
}

export function generateBulk(seed: number, count: number, opts: SvgOptions): string[] {
  return Array.from({ length: count }, (_, i) => generateBlob(seed + i * 1000, opts));
}

export function optimizeSvg(svg: string): string {
  return svg
    .replace(/<!--[^]*?-->/g, "")
    .replace(/\s{2,}/g, " ")
    .replace(/\s+\/>/g, "/>")
    .replace(/\s+>/g, ">")
    .replace(/\n/g, "")
    .trim();
}

export function validateSvg(svg: string): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  if (!svg.includes("<svg")) errors.push("Missing <svg> tag");
  if (!svg.includes("</svg>")) errors.push("Missing </svg> closing tag");
  if (!svg.includes("xmlns")) errors.push("Missing xmlns attribute");
  const openTags = (svg.match(/<(?!\/)(?!!)[a-zA-Z]/g) || []).length;
  const closeTags = (svg.match(/<\//g) || []).length + (svg.match(/\/>/g) || []).length;
  if (openTags !== closeTags) errors.push(`Tag mismatch: ${openTags} open, ${closeTags} close`);
  return { valid: errors.length === 0, errors };
}
