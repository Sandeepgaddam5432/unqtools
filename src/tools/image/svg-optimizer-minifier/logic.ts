/**
 * SVG Optimizer & Minifier — pure logic.
 * SVG processing utilities.
 */

export interface SvgStats {
  size: number;
  elements: number;
  paths: number;
  circles: number;
  rects: number;
  lines: number;
  polygons: number;
  defs: number;
  groups: number;
}

export function analyzeSvg(svg: string): SvgStats {
  return {
    size: svg.length,
    elements: (svg.match(/<[a-zA-Z]/g) || []).length,
    paths: (svg.match(/<path/g) || []).length,
    circles: (svg.match(/<circle/g) || []).length,
    rects: (svg.match(/<rect/g) || []).length,
    lines: (svg.match(/<line/g) || []).length,
    polygons: (svg.match(/<polygon/g) || []).length,
    defs: (svg.match(/<defs/g) || []).length,
    groups: (svg.match(/<g[ >]/g) || []).length,
  };
}

export function minifySvg(svg: string): string {
  let result = svg;
  // Remove comments
  result = result.replace(/<!--[^]*?-->/g, "");
  // Remove XML declaration (we add it back if needed)
  result = result.replace(/<\?xml[^]*?\?>/g, "");
  // Remove DOCTYPE
  result = result.replace(/<!DOCTYPE[^>]*>/g, "");
  // Collapse whitespace
  result = result.replace(/\s{2,}/g, " ");
  // Remove space before />
  result = result.replace(/\s+\/>/g, "/>");
  // Remove space before >
  result = result.replace(/\s+>/g, ">");
  // Remove space after <
  result = result.replace(/<\s+/g, "<");
  // Trim
  result = result.trim();
  return result;
}

export function removeMetadata(svg: string): string {
  return svg
    .replace(/<metadata>[\s\S]*?<\/metadata>/g, "")
    .replace(/<title>[\s\S]*?<\/title>/g, "")
    .replace(/<desc>[\s\S]*?<\/desc>/g, "")
    .replace(/<!--[^]*?-->/g, "");
}

export function removeInkscape(svg: string): string {
  return svg
    .replace(/\s(?:sodipodi|inkscape):[a-zA-Z-]+="[^"]*"/g, "")
    .replace(/\sxmlns:(sodipodi|inkscape)="[^"]*"/g, "");
}

export function roundNumbers(svg: string, decimals = 2): string {
  return svg.replace(/(-?\d+\.\d+)/g, (match) => {
    const num = parseFloat(match);
    if (isNaN(num)) return match;
    return num.toFixed(decimals).replace(/\.?0+$/, "");
  });
}

export function extractPaths(svg: string): string[] {
  const matches = svg.matchAll(/<path[^>]*d="([^"]*)"[^>]*>/g);
  return Array.from(matches).map((m) => m[1]);
}

export function getViewBox(svg: string): { x: number; y: number; width: number; height: number } | null {
  const m = svg.match(/viewBox="([\d.\s-]+)"/);
  if (!m) return null;
  const parts = m[1].split(/[\s,]+/).map(Number);
  if (parts.length !== 4 || parts.some(isNaN)) return null;
  return { x: parts[0], y: parts[1], width: parts[2], height: parts[3] };
}

export function setViewBox(svg: string, vb: { x: number; y: number; width: number; height: number }): string {
  const vbStr = `${vb.x} ${vb.y} ${vb.width} ${vb.height}`;
  if (/viewBox=/.test(svg)) {
    return svg.replace(/viewBox="[^"]*"/, `viewBox="${vbStr}"`);
  }
  return svg.replace(/<svg/, `<svg viewBox="${vbStr}"`);
}

export function getOptimizationStats(original: string, optimized: string): {
  originalSize: number;
  optimizedSize: number;
  savings: number;
  savingsPercent: number;
} {
  const originalSize = original.length;
  const optimizedSize = optimized.length;
  const savings = originalSize - optimizedSize;
  const savingsPercent = originalSize > 0 ? (savings / originalSize) * 100 : 0;
  return { originalSize, optimizedSize, savings, savingsPercent };
}
