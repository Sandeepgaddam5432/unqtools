/**
 * ASCII Art Generator — UI, PART 1 of 3.
 *
 * Only this part carries the "use client" pragma and the import block.
 * PARTS 2 and 3 add no imports and reuse every identifier declared here.
 * Concatenate PART-1 + PART-2 + PART-3, in that order, to produce the real
 * ui.tsx (this concatenation happens at UI-assembly time, same convention
 * as the 5-part engine).
 *
 * PART 1 owns: the import block, small DOM/file helpers unchanged from the
 * live tool (fileToImageData, cropImageData, downloadBlob, exportPdf,
 * localStorage custom-ramp store), the tab list (now 5 tabs — new "Batch"
 * tab), the option constants (dithering options extended with the 3 new
 * ordered engines; image/webcam color options relabeled "(real)" since they
 * now render genuinely sampled per-cell color, fixing DOCS.md defect #1),
 * RampPicker and StatsReadout (unchanged), the new FilterControls and
 * DitherControls shared panels (wire up every new AsciiOptions field from
 * the 5-part engine), and the updated AsciiPreview / ExportBar (both now
 * real-color-aware via imageToAsciiWithColor's colorGrid instead of the old
 * character-code-hash coloring).
 */
"use client";

import React, { useState, useCallback, useRef, useEffect, useMemo } from "react";
import * as Tabs from "@radix-ui/react-tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { CopyButton, DownloadButton, ErrorBanner, EmptyState } from "../../_shared";
import { toast } from "sonner";
import {
  Image as ImageIcon,
  Type,
  Camera,
  RefreshCw,
  Upload,
  Crop,
  Eraser,
  ChevronLeft,
  ChevronRight,
  Layers,
  Trash2,
  Terminal,
  FileText,
  Image as ImageExport,
  Code2,
  Film,
  FileDown,
  Share2,
  Gauge,
  Wand2,
  Boxes,
  SlidersHorizontal,
} from "lucide-react";
import {
  RAMP_PRESETS,
  FIGLET_FONTS,
  listFigletFonts,
  applyAspectCorrection,
  imageToAscii,
  imageToAsciiWithColor,
  textToAscii,
  asciiToHtml,
  asciiToAnsi,
  asciiToSvg,
  asciiToPngBlob,
  asciiToHtmlWithColor,
  asciiToAnsiWithColor,
  asciiToSvgWithColor,
  asciiToPngBlobWithColor,
  reverseAsciiToImage,
  computeReconstructionFidelity,
  estimateClipboardSize,
  computeCrop,
  computeEdgeMask,
  measureDitherPerformance,
  downsampleToLuminanceGrid,
  createImageDataLike,
  computeAutoEnhanceSuggestion,
  batchImagesToAscii,
  getSampleGallery,
  encodeSettingsHash,
  parseSettingsHash,
  type AsciiOptions,
  type DitherExtraOpts,
  type DitheringMode,
  type ColorMode,
  type ProcessMode,
  type ImageDataLike,
  type CropPreset,
  type ImageAsciiColorResult,
  type DitherPerformanceMeasurement,
  type BatchAsciiItem,
  type ReconstructionFidelity,
} from "./logic";

/* ------------------------------------------------------------------ */
/* Helpers (unchanged from the live tool)                             */
/* ------------------------------------------------------------------ */

/** Decode a File/Blob into an ImageDataLike via Canvas. */
async function fileToImageData(file: File | Blob): Promise<ImageDataLike> {
  const bitmap = await createImageBitmap(file);
  const canvas = document.createElement("canvas");
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D context unavailable");
  ctx.drawImage(bitmap, 0, 0);
  bitmap.close();
  const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  return { width: imgData.width, height: imgData.height, data: imgData.data };
}

/** Crop an ImageDataLike to a sub-rectangle. */
function cropImageData(img: ImageDataLike, x: number, y: number, w: number, h: number): ImageDataLike {
  const out = { width: w, height: h, data: new Uint8ClampedArray(w * h * 4) };
  for (let dy = 0; dy < h; dy++) {
    for (let dx = 0; dx < w; dx++) {
      const si = ((y + dy) * img.width + (x + dx)) * 4;
      const di = (dy * w + dx) * 4;
      out.data[di] = img.data[si]!;
      out.data[di + 1] = img.data[si + 1]!;
      out.data[di + 2] = img.data[si + 2]!;
      out.data[di + 3] = img.data[si + 3]!;
    }
  }
  return out;
}

/** Trigger a browser download for a Blob. */
function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Lazy-load pdf-lib for PDF export. */
async function exportPdf(ascii: string, fontSize = 10): Promise<Blob> {
  const { PDFDocument, StandardFonts, rgb } = await import("pdf-lib");
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Courier);
  const lines = ascii.split("\n");
  const charWidth = font.widthOfTextAtSize("M", fontSize);
  const lineHeight = fontSize * 1.2;
  const maxWidthChars = Math.max(...lines.map((l) => l.length));
  const pageWidth = Math.max(612, maxWidthChars * charWidth + 72);
  const pageHeight = Math.max(792, lines.length * lineHeight + 72);
  const page = doc.addPage([pageWidth, pageHeight]);
  const startY = pageHeight - 36;
  lines.forEach((line, i) => {
    page.drawText(line, {
      x: 36,
      y: startY - i * lineHeight,
      size: fontSize,
      font,
      color: rgb(0, 0, 0),
    });
  });
  const bytes = await doc.save();
  return new Blob([bytes], { type: "application/pdf" });
}

/** localStorage-backed custom ramp store. */
const CUSTOM_RAMP_KEY = "ascii-art-custom-ramps";
function loadCustomRamps(): { id: string; name: string; ramp: string }[] {
  try {
    const raw = localStorage.getItem(CUSTOM_RAMP_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}
function saveCustomRamp(name: string, ramp: string) {
  const list = loadCustomRamps();
  list.push({ id: `custom-${Date.now()}`, name, ramp });
  localStorage.setItem(CUSTOM_RAMP_KEY, JSON.stringify(list));
}
function deleteCustomRamp(id: string) {
  const list = loadCustomRamps().filter((r) => r.id !== id);
  localStorage.setItem(CUSTOM_RAMP_KEY, JSON.stringify(list));
}

/**
 * Build a small RGBA ImageDataLike from a real luminance downsample of
 * `img` at the given cell dimensions. Used locally by the UI to compute a
 * real (not fabricated) edge mask and to feed `measureDitherPerformance`
 * with a real cell-sized image — it mirrors, but is not guaranteed
 * byte-identical to, the engine's own internal cell image (which also
 * applies whichever extra filters are enabled first). Both are real
 * measurements of real pixel data, so this stays honest either way.
 */
function buildCellLuminanceImage(img: ImageDataLike, targetW: number, targetH: number): ImageDataLike {
  const grid = downsampleToLuminanceGrid(img, targetW, targetH);
  const cell = createImageDataLike(targetW, targetH);
  for (let i = 0, p = 0; i < cell.data.length; i += 4, p++) {
    const v = grid[p]!;
    cell.data[i] = v;
    cell.data[i + 1] = v;
    cell.data[i + 2] = v;
    cell.data[i + 3] = 255;
  }
  return cell;
}

/* ------------------------------------------------------------------ */
/* Tab definitions — new "Batch" tab (DOCS.md batch feature)          */
/* ------------------------------------------------------------------ */

type TabValue = "image" | "text" | "webcam" | "reverse" | "batch";

const TABS: { value: TabValue; label: string; icon: React.ReactNode }[] = [
  { value: "image", label: "Image to ASCII", icon: <ImageIcon className="h-3.5 w-3.5" /> },
  { value: "text", label: "Text to ASCII", icon: <Type className="h-3.5 w-3.5" /> },
  { value: "webcam", label: "Webcam", icon: <Camera className="h-3.5 w-3.5" /> },
  { value: "reverse", label: "Reverse", icon: <RefreshCw className="h-3.5 w-3.5" /> },
  { value: "batch", label: "Batch", icon: <Boxes className="h-3.5 w-3.5" /> },
];

/* ------------------------------------------------------------------ */
/* Ramp picker (unchanged)                                            */
/* ------------------------------------------------------------------ */

function RampPicker({
  ramp,
  onRampChange,
}: {
  ramp: string;
  onRampChange: (r: string) => void;
}) {
  const [customRamps, setCustomRamps] = useState(loadCustomRamps());
  const [newName, setNewName] = useState("");
  const [newRamp, setNewRamp] = useState("");

  const refresh = useCallback(() => setCustomRamps(loadCustomRamps()), []);
  const handleSave = useCallback(() => {
    if (!newRamp.trim()) {
      toast.error("Ramp cannot be empty");
      return;
    }
    if (!newName.trim()) {
      toast.error("Ramp name is required");
      return;
    }
    saveCustomRamp(newName, newRamp);
    setNewName("");
    setNewRamp("");
    refresh();
    toast.success("Custom ramp saved");
  }, [newName, newRamp, refresh]);
  const handleDelete = useCallback((id: string) => {
    deleteCustomRamp(id);
    refresh();
  }, [refresh]);

  return (
    <div className="space-y-3">
      <Label className="text-xs text-muted-foreground">Character ramp</Label>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-2" role="radiogroup" aria-label="Character ramp presets">
        {RAMP_PRESETS.map((p) => (
          <button
            key={p.id}
            type="button"
            role="radio"
            aria-checked={ramp === p.ramp}
            onClick={() => onRampChange(p.ramp)}
            className={`text-left rounded-md border p-2 text-xs transition-colors ${
              ramp === p.ramp ? "border-primary bg-primary/10" : "hover:border-foreground/30"
            }`}
          >
            <div className="font-medium">{p.name}</div>
            <div className="mt-1 font-mono text-[10px] text-muted-foreground truncate" aria-hidden="true">{p.ramp}</div>
          </button>
        ))}
        {customRamps.map((p) => (
          <button
            key={p.id}
            type="button"
            role="radio"
            aria-checked={ramp === p.ramp}
            onClick={() => onRampChange(p.ramp)}
            className={`text-left rounded-md border p-2 text-xs transition-colors relative ${
              ramp === p.ramp ? "border-primary bg-primary/10" : "hover:border-foreground/30"
            }`}
          >
            <div className="font-medium">{p.name}</div>
            <div className="mt-1 font-mono text-[10px] text-muted-foreground truncate" aria-hidden="true">{p.ramp}</div>
            <span
              role="button"
              tabIndex={0}
              aria-label={`Delete ${p.name}`}
              onClick={(e) => { e.stopPropagation(); handleDelete(p.id); }}
              onKeyDown={(e) => { if (e.key === "Enter") { e.stopPropagation(); handleDelete(p.id); } }}
              className="absolute top-1 right-1 text-muted-foreground hover:text-destructive"
            >
              <Trash2 className="h-3 w-3" />
            </span>
          </button>
        ))}
      </div>
      <div className="rounded-md border p-2 space-y-2">
        <Label className="text-xs text-muted-foreground">Custom ramp builder</Label>
        <Input
          aria-label="Custom ramp name"
          placeholder="Ramp name (e.g. MyBlocks)"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          className="h-8 text-xs"
        />
        <Input
          aria-label="Custom ramp characters (darkest to lightest)"
          placeholder="Characters, darkest first (e.g.  .:-=+*#%@)"
          value={newRamp}
          onChange={(e) => setNewRamp(e.target.value)}
          className="h-8 text-xs font-mono"
        />
        <Button size="sm" variant="outline" onClick={handleSave} className="h-7 text-xs">Save ramp</Button>
      </div>
      <Input
        aria-label="Current ramp (editable)"
        value={ramp}
        onChange={(e) => onRampChange(e.target.value)}
        className="font-mono text-xs"
      />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Stats readout (unchanged)                                          */
/* ------------------------------------------------------------------ */

function StatsReadout({ ascii, width, height }: { ascii: string; width: number; height: number }) {
  const stats = useMemo(() => estimateClipboardSize(ascii), [ascii]);
  return (
    <div className="flex flex-wrap gap-2 text-xs">
      <Badge variant="secondary">{width} × {height} chars</Badge>
      <Badge variant="secondary">{stats.chars.toLocaleString()} chars</Badge>
      <Badge variant="secondary">{stats.lines} lines</Badge>
      <Badge variant={stats.kb > 100 ? "destructive" : "secondary"}>
        {stats.kb < 1 ? `${Math.round(stats.kb * 1024)} B` : `${stats.kb.toFixed(1)} KB`} clipboard
      </Badge>
      {stats.kb > 100 && (
        <Badge variant="destructive" title="Output may be too large to paste in some editors">
          Large output
        </Badge>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Preview pane — now real-color-aware (fixes DOCS.md defect #1)      */
/* ------------------------------------------------------------------ */

function AsciiPreview({
  ascii,
  colorMode,
  terminalStyle,
  fontSize,
  realColorResult,
}: {
  ascii: string;
  colorMode: ColorMode;
  terminalStyle: boolean;
  fontSize: number;
  /** When provided and colorMode !== "bw", render using the real per-cell
   * color sampled from the source image instead of the legacy
   * character-code-hash coloring. Omit for text-mode ASCII, which has no
   * source image to sample real color from. */
  realColorResult?: ImageAsciiColorResult | null;
}) {
  const preRef = useRef<HTMLPreElement>(null);
  const style: React.CSSProperties = terminalStyle
    ? {
        background: colorMode === "phosphor" ? "#000" : "#0a0a0a",
        color: colorMode === "phosphor" ? "#33ff66" : "#e5e5e5",
        textShadow: colorMode === "phosphor" ? "0 0 6px #33ff66" : undefined,
        fontFamily: "ui-monospace, 'SF Mono', Menlo, Consolas, monospace",
        fontSize: `${fontSize}px`,
        lineHeight: 1.1,
        padding: "1rem",
        margin: 0,
        overflow: "auto",
        maxHeight: "60vh",
        whiteSpace: "pre",
        position: "relative",
      }
    : {
        background: "#0a0a0a",
        color: "#e5e5e5",
        fontFamily: "ui-monospace, 'SF Mono', Menlo, Consolas, monospace",
        fontSize: `${fontSize}px`,
        lineHeight: 1.1,
        padding: "1rem",
        margin: 0,
        overflow: "auto",
        maxHeight: "60vh",
        whiteSpace: "pre",
      };

  if (!ascii) {
    return <EmptyState title="No preview yet" hint="Adjust settings or load an image to see ASCII output." icon={<Terminal className="h-6 w-6" />} />;
  }

  if (colorMode !== "bw") {
    const html = realColorResult ? asciiToHtmlWithColor(realColorResult) : asciiToHtml(ascii, colorMode);
    return (
      <pre ref={preRef} style={style} aria-label="ASCII art preview" className={terminalStyle ? "scanlines" : ""} dangerouslySetInnerHTML={{ __html: html.replace(/<pre[^>]*>|<\/pre>/g, "") }} />
    );
  }
  return (
    <pre ref={preRef} style={style} aria-label="ASCII art preview" className={terminalStyle ? "scanlines" : ""}>
      {ascii}
    </pre>
  );
}

/* ------------------------------------------------------------------ */
/* Export buttons — now real-color-aware exports (fixes defect #1)    */
/* ------------------------------------------------------------------ */

function ExportBar({
  ascii,
  colorMode,
  fontSize,
  realColorResult,
}: {
  ascii: string;
  colorMode: ColorMode;
  fontSize: number;
  realColorResult?: ImageAsciiColorResult | null;
}) {
  const [pdfBusy, setPdfBusy] = useState(false);
  const [recording, setRecording] = useState(false);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const useRealColor = colorMode !== "bw" && !!realColorResult;

  const handlePng = useCallback(async () => {
    const res = useRealColor ? await asciiToPngBlobWithColor(realColorResult!, fontSize) : await asciiToPngBlob(ascii, fontSize);
    if (res.ok) downloadBlob(res.output, "ascii-art.png");
    else toast.error(res.error);
  }, [ascii, fontSize, useRealColor, realColorResult]);

  const handleSvg = useCallback(() => {
    const svg = useRealColor ? asciiToSvgWithColor(realColorResult!, fontSize) : asciiToSvg(ascii, fontSize);
    downloadBlob(new Blob([svg], { type: "image/svg+xml" }), "ascii-art.svg");
  }, [ascii, fontSize, useRealColor, realColorResult]);

  const handleHtml = useCallback(() => {
    const inner = useRealColor ? asciiToHtmlWithColor(realColorResult!) : asciiToHtml(ascii, colorMode);
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>ASCII Art</title><style>body{background:#000;color:#fff;margin:0;padding:1rem}</style></head><body>${inner}</body></html>`;
    downloadBlob(new Blob([html], { type: "text/html" }), "ascii-art.html");
  }, [ascii, colorMode, useRealColor, realColorResult]);

  const handleAnsi = useCallback(() => {
    const out = useRealColor ? asciiToAnsiWithColor(realColorResult!) : asciiToAnsi(ascii, colorMode);
    downloadBlob(new Blob([out], { type: "text/plain" }), "ascii-art.ans");
  }, [ascii, colorMode, useRealColor, realColorResult]);

  const handlePdf = useCallback(async () => {
    setPdfBusy(true);
    try {
      const blob = await exportPdf(ascii, Math.min(10, fontSize));
      downloadBlob(blob, "ascii-art.pdf");
      toast.success("PDF downloaded");
    } catch (e) {
      toast.error(`PDF export failed: ${(e as Error).message}`);
    } finally {
      setPdfBusy(false);
    }
  }, [ascii, fontSize]);

  const handleRecord = useCallback(async () => {
    if (recording) {
      recorderRef.current?.stop();
      setRecording(false);
      return;
    }
    try {
      const lines = ascii.split("\n");
      const fs = 14;
      const charW = fs * 0.6;
      const lineH = fs * 1.2;
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.ceil(Math.max(...lines.map((l) => l.length)) * charW));
      canvas.height = Math.max(1, Math.ceil(lines.length * lineH));
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Canvas 2D context unavailable");
      ctx.fillStyle = "#000";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = colorMode === "phosphor" ? "#33ff66" : "#fff";
      ctx.font = `${fs}px ui-monospace, Menlo, Consolas, monospace`;
      lines.forEach((line, i) => ctx.fillText(line, 0, (i + 1) * lineH - fs * 0.2));
      const stream = canvas.captureStream(10);
      const rec = new MediaRecorder(stream, { mimeType: "video/webm" });
      const chunks: Blob[] = [];
      rec.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
      rec.onstop = () => {
        const blob = new Blob(chunks, { type: "video/webm" });
        downloadBlob(blob, "ascii-art.webm");
        toast.success("WebM recording downloaded");
      };
      rec.start();
      recorderRef.current = rec;
      setRecording(true);
      setTimeout(() => {
        if (rec.state !== "inactive") rec.stop();
        setRecording(false);
      }, 3000);
    } catch (e) {
      toast.error(`Recording failed: ${(e as Error).message}`);
      setRecording(false);
    }
  }, [ascii, colorMode, recording]);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <CopyButton getText={() => ascii} label="Copy" />
      <CopyButton getText={() => `\`\`\`\n${ascii}\n\`\`\``} label="Copy as code block" />
      <DownloadButton getText={() => ascii} filename="ascii-art.txt" label="TXT" />
      <Button variant="outline" size="sm" onClick={handlePng} className="gap-1.5" disabled={!ascii}>
        <ImageExport className="h-3.5 w-3.5" /> PNG{useRealColor ? " (real color)" : ""}
      </Button>
      <Button variant="outline" size="sm" onClick={handleSvg} className="gap-1.5" disabled={!ascii}>
        <Code2 className="h-3.5 w-3.5" /> SVG
      </Button>
      <Button variant="outline" size="sm" onClick={handleHtml} className="gap-1.5" disabled={!ascii}>
        <FileText className="h-3.5 w-3.5" /> HTML
      </Button>
      <Button variant="outline" size="sm" onClick={handleAnsi} className="gap-1.5" disabled={!ascii}>
        <Terminal className="h-3.5 w-3.5" /> ANSI
      </Button>
      <Button variant="outline" size="sm" onClick={handlePdf} disabled={pdfBusy || !ascii} className="gap-1.5">
        <FileDown className="h-3.5 w-3.5" /> {pdfBusy ? "PDF..." : "PDF"}
      </Button>
      <Button variant="outline" size="sm" onClick={handleRecord} disabled={!ascii} className="gap-1.5">
        <Film className="h-3.5 w-3.5" /> {recording ? "Stop" : "WebM"}
      </Button>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Shared option constants                                            */
/* ------------------------------------------------------------------ */

const CROP_PRESETS: { value: CropPreset; label: string }[] = [
  { value: "free", label: "Free" },
  { value: "square", label: "1:1" },
  { value: "16:9", label: "16:9" },
  { value: "4:3", label: "4:3" },
  { value: "9:16", label: "9:16" },
];

/** Extended with the 3 new ordered/clustered engines (DOCS.md #31/#32). */
const DITHER_OPTIONS: { value: DitheringMode; label: string }[] = [
  { value: "none", label: "None" },
  { value: "floyd-steinberg", label: "Floyd-Steinberg" },
  { value: "atkinson", label: "Atkinson" },
  { value: "jjn", label: "JJN" },
  { value: "stucki", label: "Stucki" },
  { value: "bayer4x4", label: "Bayer 4×4" },
  { value: "bayer8x8", label: "Bayer 8×8" },
  { value: "halftone", label: "Halftone" },
];

/** Used by Text tab, which has no source image — coloring stays the original
 * stylistic character-hash treatment, honestly labeled (not a real-color claim). */
const COLOR_OPTIONS: { value: ColorMode; label: string }[] = [
  { value: "bw", label: "B/W" },
  { value: "truecolor", label: "True color (stylized)" },
  { value: "ansi256", label: "256-ANSI (stylized)" },
  { value: "ansi16", label: "16-ANSI (stylized)" },
  { value: "phosphor", label: "Phosphor" },
];

/** Used by Image/Webcam tabs, which DO have a real source image — these
 * colors are genuinely sampled per cell via imageToAsciiWithColor, fixing
 * DOCS.md defect #1. */
const REAL_COLOR_OPTIONS: { value: ColorMode; label: string }[] = [
  { value: "bw", label: "B/W" },
  { value: "truecolor", label: "True color (real)" },
  { value: "ansi256", label: "256-ANSI (real)" },
  { value: "ansi16", label: "16-ANSI (real)" },
  { value: "phosphor", label: "Phosphor" },
];

const MODE_OPTIONS: { value: ProcessMode; label: string }[] = [
  { value: "normal", label: "Normal" },
  { value: "grayscale", label: "Grayscale" },
  { value: "edge-detect", label: "Edge detect" },
];

const CHANNEL_OPTIONS: { value: "none" | "r" | "g" | "b"; label: string }[] = [
  { value: "none", label: "All (luminance)" },
  { value: "r", label: "Red channel" },
  { value: "g", label: "Green channel" },
  { value: "b", label: "Blue channel" },
];

/* ------------------------------------------------------------------ */
/* New: Filter controls (wires AsciiOptions' new filter fields)       */
/* ------------------------------------------------------------------ */

interface FilterState {
  channel: "r" | "g" | "b" | null;
  posterizeEnabled: boolean;
  posterizeLevels: number;
  thresholdEnabled: boolean;
  threshold: number;
  blurRadius: number;
  unsharpAmount: number;
  unsharpRadius: number;
  autoLevels: boolean;
  autoEnhance: boolean;
  vignetteCorrection: boolean;
}

const DEFAULT_FILTER_STATE: FilterState = {
  channel: null,
  posterizeEnabled: false,
  posterizeLevels: 4,
  thresholdEnabled: false,
  threshold: 128,
  blurRadius: 0,
  unsharpAmount: 0,
  unsharpRadius: 1,
  autoLevels: false,
  autoEnhance: false,
  vignetteCorrection: false,
};

function FilterControls({
  state,
  onChange,
  suggestion,
}: {
  state: FilterState;
  onChange: (patch: Partial<FilterState>) => void;
  /** Real measured auto-enhance suggestion (computeAutoEnhanceSuggestion), shown
   * only when autoEnhance is on and a suggestion has actually been measured. */
  suggestion?: { brightness: number; contrast: number; gamma: number } | null;
}) {
  return (
    <div className="space-y-3 rounded-md border p-3">
      <Label className="text-xs text-muted-foreground flex items-center gap-1.5">
        <SlidersHorizontal className="h-3.5 w-3.5" /> Advanced filters
      </Label>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div>
          <Label className="text-xs text-muted-foreground">Channel isolation</Label>
          <select
            aria-label="Channel isolation"
            value={state.channel ?? "none"}
            onChange={(e) => onChange({ channel: e.target.value === "none" ? null : (e.target.value as "r" | "g" | "b") })}
            className="mt-1 h-9 w-full rounded-md border bg-background px-2 text-sm"
          >
            {CHANNEL_OPTIONS.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
          </select>
        </div>
        <div className="flex items-center gap-2 pt-5">
          <Switch checked={state.autoLevels} onCheckedChange={(v) => onChange({ autoLevels: v })} id="auto-levels" />
          <Label htmlFor="auto-levels" className="text-sm cursor-pointer">Auto-levels</Label>
        </div>
        <div className="flex items-center gap-2 pt-5">
          <Switch checked={state.autoEnhance} onCheckedChange={(v) => onChange({ autoEnhance: v })} id="auto-enhance" />
          <Label htmlFor="auto-enhance" className="text-sm cursor-pointer">Auto-enhance</Label>
        </div>
        <div className="flex items-center gap-2 pt-5">
          <Switch checked={state.vignetteCorrection} onCheckedChange={(v) => onChange({ vignetteCorrection: v })} id="vignette" />
          <Label htmlFor="vignette" className="text-sm cursor-pointer">Fix vignette</Label>
        </div>
      </div>

      {state.autoEnhance && suggestion && (
        <p className="text-[10px] text-muted-foreground flex items-center gap-1">
          <Wand2 className="h-3 w-3" /> Measured suggestion: brightness {suggestion.brightness}, contrast {suggestion.contrast}, gamma {suggestion.gamma.toFixed(2)}
        </p>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Switch checked={state.posterizeEnabled} onCheckedChange={(v) => onChange({ posterizeEnabled: v })} id="posterize-on" />
            <Label htmlFor="posterize-on" className="text-sm cursor-pointer">Posterize: {state.posterizeLevels} levels</Label>
          </div>
          {state.posterizeEnabled && (
            <Slider aria-label="Posterize levels" value={[state.posterizeLevels]} onValueChange={(v) => onChange({ posterizeLevels: v[0]! })} min={2} max={16} step={1} className="mt-2" />
          )}
        </div>
        <div>
          <div className="flex items-center gap-2">
            <Switch checked={state.thresholdEnabled} onCheckedChange={(v) => onChange({ thresholdEnabled: v })} id="threshold-on" />
            <Label htmlFor="threshold-on" className="text-sm cursor-pointer">Threshold: {state.threshold}</Label>
          </div>
          {state.thresholdEnabled && (
            <Slider aria-label="Threshold level" value={[state.threshold]} onValueChange={(v) => onChange({ threshold: v[0]! })} min={0} max={255} step={1} className="mt-2" />
          )}
        </div>
        <div>
          <Label className="text-xs text-muted-foreground">Blur radius: {state.blurRadius}px</Label>
          <Slider aria-label="Blur radius" value={[state.blurRadius]} onValueChange={(v) => onChange({ blurRadius: v[0]! })} min={0} max={8} step={1} />
        </div>
        <div>
          <Label className="text-xs text-muted-foreground">Sharpen amount: {state.unsharpAmount.toFixed(1)}</Label>
          <Slider aria-label="Sharpen amount" value={[state.unsharpAmount * 10]} onValueChange={(v) => onChange({ unsharpAmount: v[0]! / 10 })} min={0} max={30} step={1} />
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* New: Dither controls (engine picker + strength/serpentine/edge +   */
/* real measured performance button)                                  */
/* ------------------------------------------------------------------ */

interface DitherState {
  dithering: DitheringMode;
  strength: number;
  serpentine: boolean;
  edgePreserve: boolean;
}

const DEFAULT_DITHER_STATE: DitherState = { dithering: "floyd-steinberg", strength: 1, serpentine: false, edgePreserve: false };

function DitherControls({
  state,
  onChange,
  onMeasure,
  measurement,
  idPrefix = "dither",
}: {
  state: DitherState;
  onChange: (patch: Partial<DitherState>) => void;
  onMeasure?: () => void;
  /** Real elapsed-time measurement from measureDitherPerformance; null until
   * the user actually runs a measurement (never a guessed number — D20). */
  measurement?: DitherPerformanceMeasurement | null;
  idPrefix?: string;
}) {
  // The 3 ordered/clustered engines ignore serpentine scan order and edge
  // masking (see engine PART 3 — ditherOrdered only reads `strength`), so
  // those controls are disabled rather than silently doing nothing (D19).
  const isOrdered = state.dithering === "bayer4x4" || state.dithering === "bayer8x8" || state.dithering === "halftone";
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 items-end">
        <div>
          <Label className="text-xs text-muted-foreground">Dithering engine</Label>
          <select aria-label="Dithering engine" value={state.dithering} onChange={(e) => onChange({ dithering: e.target.value as DitheringMode })} className="mt-1 h-9 w-full rounded-md border bg-background px-2 text-sm">
            {DITHER_OPTIONS.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}
          </select>
        </div>
        <div>
          <Label className="text-xs text-muted-foreground">Strength: {state.strength.toFixed(2)}</Label>
          <Slider aria-label="Dither strength" value={[state.strength * 100]} onValueChange={(v) => onChange({ strength: v[0]! / 100 })} min={0} max={150} step={5} className="mt-3" />
        </div>
        <div className="flex items-center gap-2 pb-1">
          <Switch checked={state.serpentine} onCheckedChange={(v) => onChange({ serpentine: v })} disabled={isOrdered} id={`${idPrefix}-serpentine`} />
          <Label htmlFor={`${idPrefix}-serpentine`} className="text-sm cursor-pointer">Serpentine scan</Label>
        </div>
        <div className="flex items-center gap-2 pb-1">
          <Switch checked={state.edgePreserve} onCheckedChange={(v) => onChange({ edgePreserve: v })} disabled={isOrdered} id={`${idPrefix}-edge`} />
          <Label htmlFor={`${idPrefix}-edge`} className="text-sm cursor-pointer">Edge-preserve</Label>
        </div>
      </div>
      {onMeasure && (
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" onClick={onMeasure} className="gap-1.5">
            <Gauge className="h-3.5 w-3.5" /> Measure performance
          </Button>
          {measurement && (
            <Badge variant="secondary">
              {measurement.ms.toFixed(2)} ms for {measurement.cells.toLocaleString()} cells ({measurement.msPerThousandCells.toFixed(3)} ms/1k cells)
            </Badge>
          )}
        </div>
      )}
    </div>
  );
}

/* === END OF PART 1 === (next: PART 2 adds ImageTab, SampleThumbnail, BatchPanel) */

function ImageTab() {
  const [sourceImage, setSourceImage] = useState<ImageDataLike | null>(null);
  const [sourceUrl, setSourceUrl] = useState<string>("");
  const [fileName, setFileName] = useState<string>("");
  const [width, setWidth] = useState(80);
  const [ramp, setRamp] = useState(RAMP_PRESETS[0]!.ramp);
  const [ditherState, setDitherState] = useState<DitherState>(DEFAULT_DITHER_STATE);
  const [colorMode, setColorMode] = useState<ColorMode>("bw");
  const [brightness, setBrightness] = useState(0);
  const [contrast, setContrast] = useState(0);
  const [gamma, setGamma] = useState(1);
  const [invert, setInvert] = useState(false);
  const [mode, setMode] = useState<ProcessMode>("normal");
  const [aspectCorrection, setAspectCorrection] = useState(true);
  const [cropPreset, setCropPreset] = useState<CropPreset>("free");
  const [comparisonDither, setComparisonDither] = useState<DitheringMode>("atkinson");
  const [comparisonMode, setComparisonMode] = useState(false);
  const [terminalStyle, setTerminalStyle] = useState(false);
  const [fontSize, setFontSize] = useState(8);
  const [filterState, setFilterState] = useState<FilterState>(DEFAULT_FILTER_STATE);
  const [measurement, setMeasurement] = useState<DitherPerformanceMeasurement | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const patchFilter = useCallback((patch: Partial<FilterState>) => setFilterState((s) => ({ ...s, ...patch })), []);
  const patchDither = useCallback((patch: Partial<DitherState>) => { setDitherState((s) => ({ ...s, ...patch })); setMeasurement(null); }, []);

  // Load settings from URL hash on mount — extended with the new filter and
  // dither fields, still tolerant of hashes produced by the original tool.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const hash = window.location.hash.slice(1);
    if (!hash) return;
    const parsed = parseSettingsHash(hash);
    if (!parsed) return;
    if (typeof parsed.width === "number") setWidth(parsed.width as number);
    if (typeof parsed.ramp === "string") setRamp(parsed.ramp as string);
    if (typeof parsed.brightness === "number") setBrightness(parsed.brightness as number);
    if (typeof parsed.contrast === "number") setContrast(parsed.contrast as number);
    if (typeof parsed.gamma === "number") setGamma(parsed.gamma as number);
    if (typeof parsed.invert === "boolean") setInvert(parsed.invert as boolean);
    if (typeof parsed.mode === "string") setMode(parsed.mode as ProcessMode);
    if (typeof parsed.aspectCorrection === "boolean") setAspectCorrection(parsed.aspectCorrection as boolean);
    if (typeof parsed.colorMode === "string") setColorMode(parsed.colorMode as ColorMode);
    if (typeof parsed.dithering === "string") {
      setDitherState((s) => ({
        ...s,
        dithering: parsed.dithering as DitheringMode,
        strength: typeof parsed.ditherStrength === "number" ? (parsed.ditherStrength as number) : s.strength,
        serpentine: typeof parsed.serpentine === "boolean" ? (parsed.serpentine as boolean) : s.serpentine,
        edgePreserve: typeof parsed.edgePreserve === "boolean" ? (parsed.edgePreserve as boolean) : s.edgePreserve,
      }));
    }
    setFilterState((s) => ({
      ...s,
      channel: (parsed.channel as "r" | "g" | "b" | null | undefined) ?? s.channel,
      posterizeEnabled: typeof parsed.posterizeEnabled === "boolean" ? (parsed.posterizeEnabled as boolean) : s.posterizeEnabled,
      posterizeLevels: typeof parsed.posterizeLevels === "number" ? (parsed.posterizeLevels as number) : s.posterizeLevels,
      thresholdEnabled: typeof parsed.thresholdEnabled === "boolean" ? (parsed.thresholdEnabled as boolean) : s.thresholdEnabled,
      threshold: typeof parsed.threshold === "number" ? (parsed.threshold as number) : s.threshold,
      blurRadius: typeof parsed.blurRadius === "number" ? (parsed.blurRadius as number) : s.blurRadius,
      unsharpAmount: typeof parsed.unsharpAmount === "number" ? (parsed.unsharpAmount as number) : s.unsharpAmount,
      autoLevels: typeof parsed.autoLevels === "boolean" ? (parsed.autoLevels as boolean) : s.autoLevels,
      autoEnhance: typeof parsed.autoEnhance === "boolean" ? (parsed.autoEnhance as boolean) : s.autoEnhance,
      vignetteCorrection: typeof parsed.vignetteCorrection === "boolean" ? (parsed.vignetteCorrection as boolean) : s.vignetteCorrection,
    }));
    toast.success("Loaded shared settings");
  }, []);

  const onFile = useCallback(async (file: File | Blob, name?: string) => {
    try {
      const img = await fileToImageData(file);
      setSourceImage(img);
      setSourceUrl(URL.createObjectURL(file));
      setFileName(name ?? "uploaded-image");
      setError(null);
      setMeasurement(null);
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);

  const onFiles = useCallback((files: FileList | null) => {
    if (!files || files.length === 0) return;
    const f = files[0]!;
    if (!f.type.startsWith("image/")) {
      toast.error("Please drop an image file");
      return;
    }
    void onFile(f, f.name);
  }, [onFile]);

  const croppedImage = useMemo(() => {
    if (!sourceImage) return null;
    if (cropPreset === "free") return sourceImage;
    const crop = computeCrop(sourceImage.width, sourceImage.height, cropPreset);
    return cropImageData(sourceImage, crop.x, crop.y, crop.width, crop.height);
  }, [sourceImage, cropPreset]);

  const cellDims = useMemo(() => {
    if (!croppedImage) return { width: 0, height: 0 };
    return applyAspectCorrection(width, Math.round((width * croppedImage.height) / croppedImage.width), aspectCorrection ? 0.5 : 1);
  }, [croppedImage, width, aspectCorrection]);

  // Real edge mask built from the real cropped image at the current cell
  // size — not a guess (DOCS.md #38/#39). See buildCellLuminanceImage's doc
  // comment in PART 1 for the honest caveat about not being byte-identical
  // to the engine's own internal (post-filter) cell image.
  const edgeMask = useMemo(() => {
    if (!ditherState.edgePreserve || !croppedImage || cellDims.width <= 0 || cellDims.height <= 0) return undefined;
    const cellImg = buildCellLuminanceImage(croppedImage, cellDims.width, cellDims.height);
    return computeEdgeMask(cellImg);
  }, [ditherState.edgePreserve, croppedImage, cellDims]);

  const ditherOpts: DitherExtraOpts = useMemo(() => ({
    strength: ditherState.strength,
    serpentine: ditherState.serpentine,
    edgeMask,
  }), [ditherState.strength, ditherState.serpentine, edgeMask]);

  const asciiOptions: AsciiOptions = useMemo(() => ({
    width,
    ramp,
    dithering: ditherState.dithering,
    brightness, contrast, gamma, invert, mode,
    aspectCorrection, cellRatio: 0.5,
    channel: filterState.channel,
    posterizeLevels: filterState.posterizeEnabled ? filterState.posterizeLevels : null,
    threshold: filterState.thresholdEnabled ? filterState.threshold : null,
    blurRadius: filterState.blurRadius,
    unsharpAmount: filterState.unsharpAmount,
    unsharpRadius: filterState.unsharpRadius,
    autoLevels: filterState.autoLevels,
    autoEnhance: filterState.autoEnhance,
    vignetteCorrection: filterState.vignetteCorrection,
    ditherOpts,
  }), [width, ramp, ditherState.dithering, brightness, contrast, gamma, invert, mode, aspectCorrection, filterState, ditherOpts]);

  const ascii = useMemo(() => {
    if (!croppedImage) return "";
    const res = imageToAscii(croppedImage, asciiOptions);
    if (res.ok) return res.output;
    queueMicrotask(() => queueMicrotask(() => setError(res.error)));
    return "";
  }, [croppedImage, asciiOptions]);

  // Real per-cell color, only computed (and only rendered/exported) when a
  // color mode is actually selected — fixes DOCS.md defect #1.
  const colorResult = useMemo(() => {
    if (!croppedImage || colorMode === "bw") return null;
    const res = imageToAsciiWithColor(croppedImage, asciiOptions);
    return res.ok ? res.output : null;
  }, [croppedImage, asciiOptions, colorMode]);

  // Real measured auto-enhance suggestion, shown only while the toggle is on
  // and only once real image data exists to measure (DOCS.md #17, ties D20).
  const autoEnhanceSuggestion = useMemo(() => {
    if (!croppedImage || !filterState.autoEnhance) return null;
    return computeAutoEnhanceSuggestion(croppedImage);
  }, [croppedImage, filterState.autoEnhance]);

  const comparisonOptions: AsciiOptions = useMemo(() => ({ ...asciiOptions, dithering: comparisonDither, ditherOpts: { strength: ditherState.strength, serpentine: ditherState.serpentine } }), [asciiOptions, comparisonDither, ditherState.strength, ditherState.serpentine]);

  const comparisonAscii = useMemo(() => {
    if (!comparisonMode || !croppedImage) return "";
    const res = imageToAscii(croppedImage, comparisonOptions);
    return res.ok ? res.output : "";
  }, [comparisonMode, croppedImage, comparisonOptions]);

  const handleMeasure = useCallback(() => {
    if (!croppedImage || cellDims.width <= 0 || cellDims.height <= 0) {
      toast.error("Load an image first");
      return;
    }
    const cellImg = buildCellLuminanceImage(croppedImage, cellDims.width, cellDims.height);
    const result = measureDitherPerformance(cellImg, ramp, ditherState.dithering, ditherOpts);
    setMeasurement(result);
  }, [croppedImage, cellDims, ramp, ditherState.dithering, ditherOpts]);

  const handleShare = useCallback(() => {
    const hash = encodeSettingsHash({
      width, ramp, dithering: ditherState.dithering, ditherStrength: ditherState.strength,
      serpentine: ditherState.serpentine, edgePreserve: ditherState.edgePreserve,
      brightness, contrast, gamma, invert, mode, aspectCorrection, colorMode,
      channel: filterState.channel, posterizeEnabled: filterState.posterizeEnabled, posterizeLevels: filterState.posterizeLevels,
      thresholdEnabled: filterState.thresholdEnabled, threshold: filterState.threshold,
      blurRadius: filterState.blurRadius, unsharpAmount: filterState.unsharpAmount,
      autoLevels: filterState.autoLevels, autoEnhance: filterState.autoEnhance, vignetteCorrection: filterState.vignetteCorrection,
    });
    if (typeof window !== "undefined") {
      const url = `${window.location.pathname}#${hash}`;
      navigator.clipboard.writeText(window.location.origin + url).then(
        () => toast.success("Share link copied"),
        () => toast.error("Could not copy share link"),
      );
    }
  }, [width, ramp, ditherState, brightness, contrast, gamma, invert, mode, aspectCorrection, colorMode, filterState]);

  const handleResetFilters = useCallback(() => {
    setBrightness(0); setContrast(0); setGamma(1); setInvert(false); setMode("normal");
    setFilterState(DEFAULT_FILTER_STATE);
  }, []);

  const onPreviewKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.altKey || e.metaKey || e.ctrlKey) return;
    if (e.key === "ArrowRight") { setWidth((w) => Math.min(400, w + (e.shiftKey ? 10 : 1))); e.preventDefault(); }
    if (e.key === "ArrowLeft") { setWidth((w) => Math.max(8, w - (e.shiftKey ? 10 : 1))); e.preventDefault(); }
    if (e.key === "ArrowUp") { setBrightness((b) => Math.min(100, b + 5)); e.preventDefault(); }
    if (e.key === "ArrowDown") { setBrightness((b) => Math.max(-100, b - 5)); e.preventDefault(); }
  }, []);

  return (
    <div className="space-y-4" onKeyDown={onPreviewKeyDown} tabIndex={0} role="region" aria-label="ASCII art preview (arrow keys adjust width and brightness)">
      <Card>
        <CardContent className="p-4">
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => { e.preventDefault(); onFiles(e.dataTransfer.files); }}
            className="rounded-lg border-2 border-dashed border-border p-6 text-center"
          >
            <input
              ref={fileInputRef}
              type="file"
              aria-label="Choose an image file"
              accept="image/*"
              className="hidden"
              onChange={(e) => onFiles(e.target.files)}
            />
            <p className="text-sm text-muted-foreground mb-2">Drop an image here or click to browse</p>
            <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
              <Upload className="h-3.5 w-3.5 mr-1.5" /> Choose image
            </Button>
          </div>
          <div className="mt-4">
            <Label className="text-xs text-muted-foreground mb-2 block">Sample gallery — one click to try</Label>
            <div className="grid grid-cols-5 gap-2">
              {getSampleGallery().map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    const canvas = document.createElement("canvas");
                    canvas.width = item.image.width;
                    canvas.height = item.image.height;
                    const ctx = canvas.getContext("2d");
                    if (!ctx) return;
                    const imageData = new ImageData(item.image.data, item.image.width, item.image.height);
                    ctx.putImageData(imageData, 0, 0);
                    canvas.toBlob((b) => { if (b) void onFile(b, `${item.id}.png`); });
                  }}
                  className="aspect-square rounded border hover:border-primary overflow-hidden bg-muted"
                  aria-label={`Try sample ${item.name}`}
                >
                  <SampleThumbnail image={item.image} />
                </button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {sourceImage && (
        <Card>
          <CardContent className="p-4">
            <div className="flex flex-wrap items-end justify-between gap-2 mb-2">
              <p className="text-sm font-medium truncate">{fileName}</p>
              <div className="flex items-center gap-1">
                <Crop className="h-3.5 w-3.5 text-muted-foreground" />
                {CROP_PRESETS.map((p) => (
                  <Button
                    key={p.value}
                    size="sm"
                    variant={cropPreset === p.value ? "default" : "outline"}
                    onClick={() => setCropPreset(p.value)}
                    className="h-7 text-xs px-2"
                  >
                    {p.label}
                  </Button>
                ))}
              </div>
            </div>
            <div className="rounded-md border bg-muted overflow-hidden" style={{ maxHeight: "200px" }}>
              {sourceUrl && (
                <img src={sourceUrl} alt={fileName} className="w-full object-contain" style={{ maxHeight: "200px" }} />
              )}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-4 space-y-4">
          <div>
            <Label className="text-xs text-muted-foreground flex items-center justify-between">
              <span>Width: {width} chars</span>
              <span className="text-[10px]">arrow keys nudge; Shift+arrows = ±10</span>
            </Label>
            <div className="flex items-center gap-2">
              <Button size="icon-sm" variant="outline" onClick={() => setWidth((w) => Math.max(8, w - 1))} aria-label="Decrease width">
                <ChevronLeft className="h-3.5 w-3.5" />
              </Button>
              <Slider
                aria-label="Output width in characters"
                value={[width]}
                onValueChange={(v) => setWidth(v[0]!)}
                min={8}
                max={400}
                step={1}
                className="flex-1"
              />
              <Button size="icon-sm" variant="outline" onClick={() => setWidth((w) => Math.min(400, w + 1))} aria-label="Increase width">
                <ChevronRight className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>

          <RampPicker ramp={ramp} onRampChange={setRamp} />

          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <div>
              <Label className="text-xs text-muted-foreground">Process mode</Label>
              <select aria-label="Process mode" value={mode} onChange={(e) => setMode(e.target.value as ProcessMode)} className="mt-1 h-9 w-full rounded-md border bg-background px-2 text-sm">
                {MODE_OPTIONS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
              </select>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Color mode</Label>
              <select aria-label="Color mode" value={colorMode} onChange={(e) => setColorMode(e.target.value as ColorMode)} className="mt-1 h-9 w-full rounded-md border bg-background px-2 text-sm">
                {REAL_COLOR_OPTIONS.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Font size: {fontSize}px</Label>
              <Slider aria-label="Preview font size" value={[fontSize]} onValueChange={(v) => setFontSize(v[0]!)} min={4} max={20} step={1} className="mt-3" />
            </div>
          </div>

          <DitherControls state={ditherState} onChange={patchDither} onMeasure={handleMeasure} measurement={measurement} idPrefix="image-dither" />

          <FilterControls state={filterState} onChange={patchFilter} suggestion={autoEnhanceSuggestion} />

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <Label className="text-xs text-muted-foreground">Brightness: {brightness}</Label>
              <Slider aria-label="Brightness" value={[brightness]} onValueChange={(v) => setBrightness(v[0]!)} min={-100} max={100} step={1} />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Contrast: {contrast}</Label>
              <Slider aria-label="Contrast" value={[contrast]} onValueChange={(v) => setContrast(v[0]!)} min={-100} max={100} step={1} />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Gamma: {gamma.toFixed(2)}</Label>
              <Slider aria-label="Gamma" value={[gamma * 100]} onValueChange={(v) => setGamma(v[0]! / 100)} min={10} max={300} step={5} />
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <Switch checked={invert} onCheckedChange={setInvert} id="invert" />
              <Label htmlFor="invert" className="text-sm cursor-pointer">Invert</Label>
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={aspectCorrection} onCheckedChange={setAspectCorrection} id="aspect" />
              <Label htmlFor="aspect" className="text-sm cursor-pointer">Aspect correction (0.5 cell ratio)</Label>
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={terminalStyle} onCheckedChange={setTerminalStyle} id="terminal" />
              <Label htmlFor="terminal" className="text-sm cursor-pointer">Terminal style</Label>
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={comparisonMode} onCheckedChange={setComparisonMode} id="comparison" />
              <Label htmlFor="comparison" className="text-sm cursor-pointer">Comparison mode</Label>
            </div>
          </div>

          {comparisonMode && (
            <div>
              <Label className="text-xs text-muted-foreground">Comparison dithering engine</Label>
              <select aria-label="Comparison dithering engine" value={comparisonDither} onChange={(e) => setComparisonDither(e.target.value as DitheringMode)} className="mt-1 h-9 w-full md:w-1/3 rounded-md border bg-background px-2 text-sm">
                {DITHER_OPTIONS.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}
              </select>
            </div>
          )}

          <div className="flex items-center gap-2 pt-2">
            <Button variant="ghost" size="sm" onClick={handleShare} className="gap-1.5">
              <Share2 className="h-3.5 w-3.5" /> Share settings
            </Button>
            <Button variant="ghost" size="sm" onClick={handleResetFilters} className="gap-1.5">
              <Eraser className="h-3.5 w-3.5" /> Reset filters
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <StatsReadout ascii={ascii} width={cellDims.width} height={cellDims.height} />
          </div>
          {comparisonMode ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1"><Layers className="h-3 w-3" /> {DITHER_OPTIONS.find((d) => d.value === ditherState.dithering)?.label}</p>
                <AsciiPreview ascii={ascii} colorMode={colorMode} terminalStyle={terminalStyle} fontSize={fontSize} realColorResult={colorResult} />
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1"><Layers className="h-3 w-3" /> {DITHER_OPTIONS.find((d) => d.value === comparisonDither)?.label}</p>
                <AsciiPreview ascii={comparisonAscii} colorMode={colorMode} terminalStyle={terminalStyle} fontSize={fontSize} realColorResult={null} />
              </div>
            </div>
          ) : (
            <AsciiPreview ascii={ascii} colorMode={colorMode} terminalStyle={terminalStyle} fontSize={fontSize} realColorResult={colorResult} />
          )}
          <ExportBar ascii={ascii} colorMode={colorMode} fontSize={fontSize} realColorResult={colorResult} />
        </CardContent>
      </Card>

      {error && <ErrorBanner message={error} />}

      <Card>
        <CardContent className="p-4">
          <p className="text-xs text-muted-foreground">
            <strong className="text-foreground">Privacy:</strong> all image processing runs locally via the Canvas API. Your image never leaves your browser.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

/* Sample-thumbnail component (unchanged) — renders a tiny preview via canvas. */
function SampleThumbnail({ image }: { image: ImageDataLike }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;
    c.width = image.width;
    c.height = image.height;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    const imgData = new ImageData(image.data, image.width, image.height);
    ctx.putImageData(imgData, 0, 0);
  }, [image]);
  return <canvas ref={canvasRef} className="w-full h-full" aria-hidden="true" />;
}

/* ------------------------------------------------------------------ */
/* Batch tab — new (wires batchImagesToAscii, D16)                    */
/* ------------------------------------------------------------------ */

interface BatchImageItem {
  id: string;
  name: string;
  image: ImageDataLike;
}

function BatchPanel() {
  const [items, setItems] = useState<BatchImageItem[]>([]);
  const [width, setWidth] = useState(60);
  const [ramp, setRamp] = useState(RAMP_PRESETS[0]!.ramp);
  const [dithering, setDithering] = useState<DitheringMode>("floyd-steinberg");
  const [results, setResults] = useState<BatchAsciiItem[] | null>(null);
  const [busy, setBusy] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const onFiles = useCallback(async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const next: BatchImageItem[] = [];
    for (const file of Array.from(files)) {
      if (!file.type.startsWith("image/")) continue;
      try {
        const image = await fileToImageData(file);
        next.push({ id: `${file.name}-${Date.now()}-${Math.random()}`, name: file.name, image });
      } catch (e) {
        toast.error(`Could not read ${file.name}: ${(e as Error).message}`);
      }
    }
    setItems((prev) => [...prev, ...next]);
    setResults(null);
  }, []);

  const removeItem = useCallback((id: string) => {
    setItems((prev) => prev.filter((it) => it.id !== id));
    setResults(null);
  }, []);

  const runBatch = useCallback(() => {
    if (items.length === 0) {
      toast.error("Add at least one image first");
      return;
    }
    setBusy(true);
    const opts: AsciiOptions = { width, ramp, dithering, aspectCorrection: true, cellRatio: 0.5 };
    const out = batchImagesToAscii(items.map((it) => it.image), opts);
    setResults(out);
    setBusy(false);
    const failed = out.filter((r) => !r.ok).length;
    if (failed > 0) toast.error(`${failed} of ${out.length} image(s) failed — see errors below`);
    else toast.success(`Processed ${out.length} image(s)`);
  }, [items, width, ramp, dithering]);

  const downloadAllZip = useCallback(async () => {
    if (!results) return;
    const JSZip = (await import("jszip")).default;
    const zip = new JSZip();
    results.forEach((r) => {
      const name = items[r.index]?.name?.replace(/\.[^.]+$/, "") ?? `image-${r.index}`;
      if (r.ok && r.ascii) zip.file(`${name}.txt`, r.ascii);
      else zip.file(`${name}.error.txt`, r.error ?? "Unknown error");
    });
    const blob = await zip.generateAsync({ type: "blob" });
    downloadBlob(blob, "ascii-art-batch.zip");
  }, [results, items]);

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4 space-y-3">
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => { e.preventDefault(); void onFiles(e.dataTransfer.files); }}
            className="rounded-lg border-2 border-dashed border-border p-6 text-center"
          >
            <input
              ref={fileInputRef}
              type="file"
              multiple
              aria-label="Choose image files for batch processing"
              accept="image/*"
              className="hidden"
              onChange={(e) => void onFiles(e.target.files)}
            />
            <p className="text-sm text-muted-foreground mb-2">Drop multiple images here or click to browse — each is processed independently; one failure never stops the rest.</p>
            <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
              <Upload className="h-3.5 w-3.5 mr-1.5" /> Choose images
            </Button>
          </div>
          {items.length > 0 && (
            <div className="space-y-1">
              {items.map((it) => (
                <div key={it.id} className="flex items-center justify-between text-xs rounded-md border px-2 py-1">
                  <span className="truncate">{it.name}</span>
                  <button type="button" onClick={() => removeItem(it.id)} aria-label={`Remove ${it.name}`} className="text-muted-foreground hover:text-destructive">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <Label className="text-xs text-muted-foreground">Width: {width} chars</Label>
              <Slider aria-label="Batch output width" value={[width]} onValueChange={(v) => setWidth(v[0]!)} min={20} max={200} step={1} />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Dithering</Label>
              <select aria-label="Batch dithering engine" value={dithering} onChange={(e) => setDithering(e.target.value as DitheringMode)} className="mt-1 h-9 w-full rounded-md border bg-background px-2 text-sm">
                {DITHER_OPTIONS.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}
              </select>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Ramp</Label>
              <select aria-label="Batch ramp preset" value={ramp} onChange={(e) => setRamp(e.target.value)} className="mt-1 h-9 w-full rounded-md border bg-background px-2 text-sm">
                {RAMP_PRESETS.map((p) => <option key={p.id} value={p.ramp}>{p.name}</option>)}
              </select>
            </div>
          </div>
          <Button size="sm" onClick={runBatch} disabled={busy || items.length === 0} className="gap-1.5">
            <Boxes className="h-3.5 w-3.5" /> {busy ? "Processing..." : `Process ${items.length} image(s)`}
          </Button>
        </CardContent>
      </Card>

      {results && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium">Results</p>
              <Button variant="outline" size="sm" onClick={() => void downloadAllZip()} className="gap-1.5">
                <FileDown className="h-3.5 w-3.5" /> Download all (.zip)
              </Button>
            </div>
            <div className="space-y-2">
              {results.map((r) => (
                <div key={r.index} className="rounded-md border p-2">
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="font-medium truncate">{items[r.index]?.name ?? `Image ${r.index + 1}`}</span>
                    <Badge variant={r.ok ? "secondary" : "destructive"}>{r.ok ? "OK" : "Failed"}</Badge>
                  </div>
                  {r.ok && r.ascii ? (
                    <>
                      <pre className="text-[8px] leading-tight overflow-hidden max-h-24 bg-muted rounded p-1" aria-hidden="true">{r.ascii}</pre>
                      <div className="flex gap-2 mt-1">
                        <CopyButton getText={() => r.ascii ?? ""} label="Copy" />
                        <DownloadButton getText={() => r.ascii ?? ""} filename={`${(items[r.index]?.name ?? `image-${r.index}`).replace(/\.[^.]+$/, "")}.txt`} label="TXT" />
                      </div>
                    </>
                  ) : (
                    <ErrorBanner message={r.error ?? "Unknown error"} />
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-4">
          <p className="text-xs text-muted-foreground">
            <strong className="text-foreground">Privacy:</strong> batch processing runs entirely in your browser — images are never uploaded.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

/* === END OF PART 2 === (next: PART 3 adds TextTab, WebcamTab, ReverseTab, root component) */

function TextTab() {
  const [text, setText] = useState("Hello");
  const [fontName, setFontName] = useState("Standard");
  const [layout, setLayout] = useState<"full" | "fitted" | "default">("default");
  const [colorMode, setColorMode] = useState<ColorMode>("bw");
  const [terminalStyle, setTerminalStyle] = useState(false);
  const [fontSize, setFontSize] = useState(8);
  const [ascii, setAscii] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fonts = useMemo(() => listFigletFonts(), []);

  const render = useCallback(async () => {
    setBusy(true);
    setError(null);
    const res = await textToAscii(text, fontName, { layout });
    if (res.ok) {
      setAscii(res.output);
    } else {
      setError(res.error);
      setAscii("");
    }
    setBusy(false);
  }, [text, fontName, layout]);

  useEffect(() => { void render(); }, []);

  const stats = useMemo(() => estimateClipboardSize(ascii), [ascii]);
  const dims = useMemo(() => {
    if (!ascii) return { width: 0, height: 0 };
    const lines = ascii.split("\n");
    return { width: Math.max(...lines.map((l) => l.length)), height: lines.length };
  }, [ascii]);

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4 space-y-3">
          <div>
            <Label htmlFor="text-input" className="text-xs text-muted-foreground">Text to render</Label>
            <Input id="text-input" value={text} onChange={(e) => setText(e.target.value)} placeholder="Hello" className="mt-1" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <Label className="text-xs text-muted-foreground">FIGlet font ({fonts.length} available)</Label>
              <select aria-label="FIGlet font" value={fontName} onChange={(e) => setFontName(e.target.value)} className="mt-1 h-9 w-full rounded-md border bg-background px-2 text-sm">
                {fonts.map((f) => <option key={f} value={f}>{f}</option>)}
              </select>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Layout</Label>
              <select aria-label="Layout" value={layout} onChange={(e) => setLayout(e.target.value as typeof layout)} className="mt-1 h-9 w-full rounded-md border bg-background px-2 text-sm">
                <option value="default">Default (smush)</option>
                <option value="full">Full (no smush)</option>
                <option value="fitted">Fitted</option>
              </select>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Color mode</Label>
              <select aria-label="Color mode" value={colorMode} onChange={(e) => setColorMode(e.target.value as ColorMode)} className="mt-1 h-9 w-full rounded-md border bg-background px-2 text-sm">
                {COLOR_OPTIONS.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-4">
            <Button size="sm" onClick={() => void render()} disabled={busy} className="gap-1.5">
              {busy ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Type className="h-3.5 w-3.5" />}
              {busy ? "Rendering..." : "Render"}
            </Button>
            <div className="flex items-center gap-2">
              <Switch checked={terminalStyle} onCheckedChange={setTerminalStyle} id="text-terminal" />
              <Label htmlFor="text-terminal" className="text-sm cursor-pointer">Terminal style</Label>
            </div>
            <div className="flex items-center gap-2 flex-1 min-w-[120px]">
              <Label htmlFor="text-fs" className="text-xs text-muted-foreground whitespace-nowrap">Font: {fontSize}px</Label>
              <Slider id="text-fs" aria-label="Preview font size" value={[fontSize]} onValueChange={(v) => setFontSize(v[0]!)} min={4} max={20} step={1} className="flex-1" />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex flex-wrap gap-2 text-xs">
            <Badge variant="secondary">{dims.width} × {dims.height} chars</Badge>
            <Badge variant="secondary">{stats.chars.toLocaleString()} chars</Badge>
            <Badge variant="secondary">{stats.lines} lines</Badge>
            <Badge variant={stats.kb > 100 ? "destructive" : "secondary"}>
              {stats.kb < 1 ? `${Math.round(stats.kb * 1024)} B` : `${stats.kb.toFixed(1)} KB`} clipboard
            </Badge>
          </div>
          <AsciiPreview ascii={ascii} colorMode={colorMode} terminalStyle={terminalStyle} fontSize={fontSize} />
          <ExportBar ascii={ascii} colorMode={colorMode} fontSize={fontSize} />
        </CardContent>
      </Card>

      {error && <ErrorBanner message={error} />}

      <Card>
        <CardContent className="p-4">
          <p className="text-xs text-muted-foreground">
            <strong className="text-foreground">Offline:</strong> FIGlet fonts are bundled — no network needed. Each font loads lazily on first use. Coloring here is a stylistic treatment (no source image to sample real color from).
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Webcam tab — extended dithering + real per-frame color              */
/* ------------------------------------------------------------------ */

function WebcamTab() {
  const [active, setActive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ascii, setAscii] = useState("");
  const [colorResult, setColorResult] = useState<ImageAsciiColorResult | null>(null);
  const [width, setWidth] = useState(80);
  const [ramp, setRamp] = useState(RAMP_PRESETS[0]!.ramp);
  const [dithering, setDithering] = useState<DitheringMode>("none");
  const [colorMode, setColorMode] = useState<ColorMode>("bw");
  const [invert, setInvert] = useState(false);
  const [aspectCorrection, setAspectCorrection] = useState(true);
  const [fontSize, setFontSize] = useState(8);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);

  const stop = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setActive(false);
  }, []);

  const start = useCallback(async () => {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480 }, audio: false });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setActive(true);
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);

  useEffect(() => {
    if (!active || !videoRef.current) return;
    const video = videoRef.current;
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const tick = () => {
      if (!video.videoWidth) {
        rafRef.current = requestAnimationFrame(tick);
        return;
      }
      const cellH = aspectCorrection ? Math.max(1, Math.round((width * video.videoHeight * 0.5) / video.videoWidth)) : Math.max(1, Math.round((width * video.videoHeight) / video.videoWidth));
      canvas.width = width;
      canvas.height = cellH;
      ctx.drawImage(video, 0, 0, width, cellH);
      const imgData = ctx.getImageData(0, 0, width, cellH);
      const frame: ImageDataLike = { width: imgData.width, height: imgData.height, data: imgData.data };
      const opts: AsciiOptions = { width, ramp, dithering, invert, aspectCorrection: false, cellRatio: 0.5 };
      if (colorMode !== "bw") {
        const res = imageToAsciiWithColor(frame, opts);
        if (res.ok) { setAscii(res.output.ascii); setColorResult(res.output); }
      } else {
        const res = imageToAscii(frame, opts);
        if (res.ok) { setAscii(res.output); setColorResult(null); }
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [active, width, ramp, dithering, invert, aspectCorrection, colorMode]);

  useEffect(() => () => stop(), [stop]);

  const stats = useMemo(() => estimateClipboardSize(ascii), [ascii]);

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex flex-wrap items-center gap-3">
            {!active ? (
              <Button size="sm" onClick={() => void start()} className="gap-1.5">
                <Camera className="h-3.5 w-3.5" /> Start webcam
              </Button>
            ) : (
              <Button size="sm" variant="destructive" onClick={stop} className="gap-1.5">
                <Camera className="h-3.5 w-3.5" /> Stop
              </Button>
            )}
            <p className="text-xs text-muted-foreground">Frames stay in your browser — nothing is uploaded.</p>
          </div>
          <video ref={videoRef} className={active ? "rounded-md border max-w-md" : "hidden"} muted playsInline aria-label="Webcam preview" />
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4 space-y-3">
          <div>
            <Label className="text-xs text-muted-foreground">Width: {width} chars</Label>
            <Slider aria-label="Output width" value={[width]} onValueChange={(v) => setWidth(v[0]!)} min={40} max={200} step={1} />
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <div>
              <Label className="text-xs text-muted-foreground">Dithering</Label>
              <select aria-label="Dithering" value={dithering} onChange={(e) => setDithering(e.target.value as DitheringMode)} className="mt-1 h-9 w-full rounded-md border bg-background px-2 text-sm">
                {DITHER_OPTIONS.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}
              </select>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Color mode</Label>
              <select aria-label="Color mode" value={colorMode} onChange={(e) => setColorMode(e.target.value as ColorMode)} className="mt-1 h-9 w-full rounded-md border bg-background px-2 text-sm">
                {REAL_COLOR_OPTIONS.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Font size: {fontSize}px</Label>
              <Slider aria-label="Font size" value={[fontSize]} onValueChange={(v) => setFontSize(v[0]!)} min={4} max={20} step={1} className="mt-3" />
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <Switch checked={invert} onCheckedChange={setInvert} id="wc-invert" />
              <Label htmlFor="wc-invert" className="text-sm cursor-pointer">Invert</Label>
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={aspectCorrection} onCheckedChange={setAspectCorrection} id="wc-aspect" />
              <Label htmlFor="wc-aspect" className="text-sm cursor-pointer">Aspect correction</Label>
            </div>
          </div>
          <RampPicker ramp={ramp} onRampChange={setRamp} />
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex flex-wrap gap-2 text-xs">
            <Badge variant="secondary">{stats.chars.toLocaleString()} chars</Badge>
            <Badge variant={active ? "default" : "secondary"}>{active ? "Live" : "Stopped"}</Badge>
          </div>
          <AsciiPreview ascii={ascii} colorMode={colorMode} terminalStyle fontSize={fontSize} realColorResult={colorResult} />
          <ExportBar ascii={ascii} colorMode={colorMode} fontSize={fontSize} realColorResult={colorResult} />
        </CardContent>
      </Card>

      {error && <ErrorBanner message={`Webcam error: ${error}. Note: getUserMedia requires HTTPS in production.`} />}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Reverse tab — now with a real measured fidelity score              */
/* ------------------------------------------------------------------ */

function ReverseTab() {
  const [input, setInput] = useState("  ##  \n #..# \n#....#\n#....#\n #..# \n  ##  ");
  const [ramp, setRamp] = useState(RAMP_PRESETS[0]!.ramp);
  const [reconstructed, setReconstructed] = useState<ImageDataLike | null>(null);
  const [originalImage, setOriginalImage] = useState<ImageDataLike | null>(null);
  const [originalName, setOriginalName] = useState<string>("");
  const [fidelity, setFidelity] = useState<ReconstructionFidelity | null>(null);
  const [error, setError] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const originalInputRef = useRef<HTMLInputElement>(null);

  const reconstruct = useCallback(() => {
    const res = reverseAsciiToImage(input, ramp, 8);
    if (res.ok) {
      setReconstructed(res.output);
      setError(null);
      // Only a REAL measured fidelity score, computed only when the user has
      // supplied a real original image to compare against — fixes DOCS.md
      // defect #9 (never a guessed/fabricated number, ties D20).
      setFidelity(originalImage ? computeReconstructionFidelity(originalImage, res.output) : null);
    } else {
      setError(res.error);
      setReconstructed(null);
      setFidelity(null);
    }
  }, [input, ramp, originalImage]);

  const onOriginalFile = useCallback(async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const f = files[0]!;
    if (!f.type.startsWith("image/")) {
      toast.error("Please choose an image file");
      return;
    }
    try {
      const img = await fileToImageData(f);
      setOriginalImage(img);
      setOriginalName(f.name);
      setFidelity(null);
    } catch (e) {
      toast.error((e as Error).message);
    }
  }, []);

  useEffect(() => {
    if (!reconstructed || !canvasRef.current) return;
    const c = canvasRef.current;
    c.width = reconstructed.width;
    c.height = reconstructed.height;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    const imgData = new ImageData(reconstructed.data, reconstructed.width, reconstructed.height);
    ctx.putImageData(imgData, 0, 0);
  }, [reconstructed]);

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4 space-y-3">
          <div>
            <Label htmlFor="reverse-input" className="text-xs text-muted-foreground">Paste ASCII art here</Label>
            <Textarea
              id="reverse-input"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              className="mt-1 font-mono text-xs"
              rows={8}
              aria-describedby="reverse-help"
            />
            <p id="reverse-help" className="text-[10px] text-muted-foreground mt-1">Each character is mapped back through the ramp to a luminance; unknown characters become mid-gray.</p>
          </div>
          <RampPicker ramp={ramp} onRampChange={setRamp} />
          <div className="rounded-md border p-2 space-y-2">
            <Label className="text-xs text-muted-foreground">Original image (optional — enables a real measured fidelity score)</Label>
            <input
              ref={originalInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => void onOriginalFile(e.target.files)}
              aria-label="Choose the original image for fidelity comparison"
            />
            <div className="flex items-center gap-2">
              <Button size="sm" variant="outline" onClick={() => originalInputRef.current?.click()} className="gap-1.5">
                <Upload className="h-3.5 w-3.5" /> Choose original image
              </Button>
              {originalName && <span className="text-xs text-muted-foreground truncate">{originalName}</span>}
            </div>
          </div>
          <Button size="sm" onClick={reconstruct} className="gap-1.5">
            <RefreshCw className="h-3.5 w-3.5" /> Reconstruct image
          </Button>
        </CardContent>
      </Card>

      {error && <ErrorBanner message={error} />}

      {reconstructed && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <p className="text-sm font-medium">Reconstructed image ({reconstructed.width} × {reconstructed.height}px)</p>
            {fidelity ? (
              <Badge variant={fidelity.score >= 70 ? "secondary" : "destructive"}>
                Measured fidelity: {fidelity.score.toFixed(1)}/100 (mean luminance error {fidelity.meanAbsoluteError.toFixed(1)})
              </Badge>
            ) : (
              <p className="text-[10px] text-muted-foreground">Upload the original image above to see a real measured fidelity score instead of no score at all.</p>
            )}
            <div className="rounded-md border bg-muted overflow-auto" style={{ maxHeight: "400px" }}>
              <canvas ref={canvasRef} className="w-full" style={{ imageRendering: "pixelated", maxWidth: "100%" }} aria-label="Reconstructed image preview" />
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                const c = canvasRef.current;
                if (!c) return;
                c.toBlob((b) => { if (b) downloadBlob(b, "reconstructed.png"); });
              }}
              className="gap-1.5"
            >
              <ImageExport className="h-3.5 w-3.5" /> Download PNG
            </Button>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-4">
          <p className="text-xs text-muted-foreground">
            <strong className="text-foreground">Best-effort:</strong> reconstruction cannot recover original colors — only the luminance per cell. The fidelity score, when shown, is a real measured comparison against the original image you provide, never a guess.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Root component — now renders the 5th "Batch" tab                   */
/* ------------------------------------------------------------------ */

export default function AsciiArtGenerator() {
  const [tab, setTab] = useState<TabValue>("image");
  return (
    <div className="space-y-4">
      <Tabs.Root value={tab} onValueChange={(v) => setTab(v as TabValue)}>
        <Tabs.List aria-label="ASCII Art Generator modes" className="inline-flex h-10 items-center justify-center rounded-md bg-muted p-1 text-muted-foreground">
          {TABS.map((t) => (
            <Tabs.Trigger
              key={t.value}
              value={t.value}
              className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-sm px-3 py-1.5 text-sm font-medium transition-all data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm"
            >
              {t.icon}
              <span className="hidden sm:inline">{t.label}</span>
            </Tabs.Trigger>
          ))}
        </Tabs.List>
        <Tabs.Content value="image" className="mt-4 focus-visible:outline-none">
          <ImageTab />
        </Tabs.Content>
        <Tabs.Content value="text" className="mt-4 focus-visible:outline-none">
          <TextTab />
        </Tabs.Content>
        <Tabs.Content value="webcam" className="mt-4 focus-visible:outline-none">
          <WebcamTab />
        </Tabs.Content>
        <Tabs.Content value="reverse" className="mt-4 focus-visible:outline-none">
          <ReverseTab />
        </Tabs.Content>
        <Tabs.Content value="batch" className="mt-4 focus-visible:outline-none">
          <BatchPanel />
        </Tabs.Content>
      </Tabs.Root>
    </div>
  );
}

/* === END OF PART 3 === (end of UI — concatenate PART-1 + PART-2 + PART-3 as ui.tsx) */
