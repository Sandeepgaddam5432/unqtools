import { PDFDocument } from "pdf-lib";
import type { ToolResult } from "../../../lib/tool";

export interface ExtractOptions {
  pageRanges: string;
  reverseOrder: boolean;
  shuffleOrder: boolean;
}

export interface ExtractResult {
  bytes: Uint8Array;
  pageCount: number;
  originalPageCount: number;
}

export function parsePageRanges(ranges: string, total: number): number[] {
  if (!ranges.trim()) return Array.from({ length: total }, (_, i) => i);
  const result: number[] = [];
  for (const part of ranges.split(",")) {
    const trimmed = part.trim();
    if (trimmed.includes("-")) {
      const [start, end] = trimmed.split("-").map(n => parseInt(n.trim(), 10));
      if (isNaN(start) || isNaN(end)) continue;
      for (let i = start; i <= Math.min(end, total); i++) {
        if (i >= 1) result.push(i - 1);
      }
    } else {
      const n = parseInt(trimmed, 10);
      if (!isNaN(n) && n >= 1 && n <= total) result.push(n - 1);
    }
  }
  return [...new Set(result)];
}

export async function extractPages(bytes: Uint8Array, opts: ExtractOptions): Promise<ToolResult<ExtractResult>> {
  try {
    const srcDoc = await PDFDocument.load(bytes);
    const total = srcDoc.getPageCount();
    let indices = parsePageRanges(opts.pageRanges, total);
    if (opts.reverseOrder) indices = indices.reverse();
    if (opts.shuffleOrder) indices = indices.sort(() => Math.random() - 0.5);
    if (indices.length === 0) return { ok: false, error: "No pages selected. Check your page range." };
    const destDoc = await PDFDocument.create();
    const copied = await destDoc.copyPages(srcDoc, indices);
    copied.forEach(p => destDoc.addPage(p));
    const out = await destDoc.save();
    return { ok: true, output: { bytes: new Uint8Array(out), pageCount: indices.length, originalPageCount: total } };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

export function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024; const u = ["B","KB","MB","GB"]; const i = Math.floor(Math.log(bytes)/Math.log(k));
  return `${(bytes/Math.pow(k,i)).toFixed(i===0?0:1)} ${u[i]}`;
}

const HISTORY_KEY = "unqtools-pdf-page-extractor-history";
const MAX_H = 10;
export interface HistoryEntry { filename: string; pageCount: number; extractedAt: string; }
export function loadHistory(): HistoryEntry[] { if (typeof localStorage==="undefined") return []; try { const r=localStorage.getItem(HISTORY_KEY); return r?JSON.parse(r).slice(0,MAX_H):[]; } catch { return []; } }
export function saveToHistory(e: HistoryEntry): HistoryEntry[] { if (typeof localStorage==="undefined") return []; const u=[e,...loadHistory()].slice(0,MAX_H); try{localStorage.setItem(HISTORY_KEY,JSON.stringify(u));}catch{} return u; }
export function clearHistory(): void { if(typeof localStorage==="undefined")return; try{localStorage.removeItem(HISTORY_KEY);}catch{} }
export function buildShareUrl(opts: ExtractOptions): string { if(typeof window==="undefined")return""; return `${window.location.origin}${window.location.pathname}#ranges=${encodeURIComponent(opts.pageRanges)}`; }
