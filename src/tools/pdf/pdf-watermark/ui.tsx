"use client";

/**
 * PDF Watermark — 100x UI.
 * Text or image watermark, 4 placements (diagonal/tiled/centered/custom),
 * 9 anchors for custom placement, rotation, opacity, size, bold, color,
 * per-page ranges, and optional corner-stamp extras. 100% local.
 */

import React, { useRef, useState } from "react";
import { PDFDocument } from "pdf-lib";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Download, FileUp, Image as ImageIcon, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { ActionBar, ClearButton, ErrorBanner, RunButton } from "../../_shared";
import { downloadBytes, formatBytes } from "../_shared/download";
import { addWatermark, type WatermarkPlacement, type Anchor } from "./logic";

const PLACEMENTS: { value: WatermarkPlacement; label: string; hint: string }[] = [
  { value: "diagonal", label: "Diagonal", hint: "45° across center" },
  { value: "tiled", label: "Tiled", hint: "Repeated grid" },
  { value: "centered", label: "Centered", hint: "Horizontal, center" },
  { value: "custom", label: "Custom position", hint: "Pick an anchor + offset" },
];

const ANCHORS: Anchor[] = [
  "top-left", "top", "top-right",
  "left", "center", "right",
  "bottom-left", "bottom", "bottom-right",
];

export default function PdfWatermark() {
  const inputRef = useRef<HTMLInputElement>(null);
  const imgRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<{ name: string; bytes: Uint8Array; pageCount: number } | null>(null);
  const [wmImage, setWmImage] = useState<Uint8Array | null>(null);
  const [wmImageName, setWmImageName] = useState("");
  const [text, setText] = useState("DRAFT");
  const [placement, setPlacement] = useState<WatermarkPlacement>("diagonal");
  const [anchor, setAnchor] = useState<Anchor>("center");
  const [xOff, setXOff] = useState("0");
  const [yOff, setYOff] = useState("0");
  const [opacity, setOpacity] = useState("0.30");
  const [fontSize, setFontSize] = useState("48");
  const [bold, setBold] = useState(true);
  const [color, setColor] = useState("#808080");
  const [rotate, setRotate] = useState("45");
  const [imgWidth, setImgWidth] = useState("120");
  const [pages, setPages] = useState("");
  const [stampText, setStampText] = useState("");
  const [result, setResult] = useState<Uint8Array | null>(null);
  const [error, setError] = useState("");
  const [working, setWorking] = useState(false);

  async function loadFile(f: File) {
    try {
      const bytes = new Uint8Array(await f.arrayBuffer());
      const doc = await PDFDocument.load(bytes);
      setFile({ name: f.name, bytes, pageCount: doc.getPageCount() });
      setResult(null);
      setError("");
    } catch {
      toast.error(`Could not read ${f.name}`);
    }
  }

  async function loadImage(f: File) {
    try {
      const bytes = new Uint8Array(await f.arrayBuffer());
      if (!/\.(png|jpe?g)$/i.test(f.name)) {
        toast.error("Use a PNG or JPEG image");
        return;
      }
      setWmImage(bytes);
      setWmImageName(f.name);
    } catch {
      toast.error(`Could not read ${f.name}`);
    }
  }

  function reset() {
    setFile(null);
    setResult(null);
    setError("");
    setWmImage(null);
    setWmImageName("");
  }

  async function run() {
    if (!file) return;
    const hasText = text.trim().length > 0;
    const hasImage = wmImage !== null;
    if (!hasText && !hasImage) {
      setError("Enter watermark text or choose a watermark image.");
      return;
    }
    setWorking(true);
    setError("");
    setResult(null);
    const res = await addWatermark(file.bytes, {
      text: hasText ? text : undefined,
      image: hasImage && wmImage ? { imageBytes: wmImage, widthPt: Number(imgWidth) || 120, opacity: Number(opacity) || 0.3 } : undefined,
      placement,
      anchor: placement === "custom" ? anchor : undefined,
      xOffset: placement === "custom" ? Number(xOff) || 0 : undefined,
      yOffset: placement === "custom" ? Number(yOff) || 0 : undefined,
      opacity: Number(opacity) || 0.3,
      fontSize: Number(fontSize) || 48,
      bold,
      color,
      rotateDeg: placement === "diagonal" ? Number(rotate) || 45 : Number(rotate) || 0,
      pages,
      extras: stampText.trim()
        ? [{ text: stampText.trim(), fontSize: 9, anchor: "bottom-left" as Anchor }]
        : undefined,
    });
    setWorking(false);
    if (res.ok) {
      setResult(res.output);
      toast.success("Watermark added!");
    } else {
      setError(res.error);
    }
  }

  return (
    <div className="space-y-4">
      {file ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-card p-4">
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{file.name}</p>
            <p className="text-xs text-muted-foreground">{file.pageCount} pages • {formatBytes(file.bytes.length)}</p>
          </div>
          <Button variant="ghost" size="icon-sm" aria-label="Remove" onClick={reset}>
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            const f = e.dataTransfer.files[0];
            if (f) void loadFile(f);
          }}
          className="w-full rounded-xl border-2 border-dashed border-border p-8 text-center hover:border-primary/50 hover:bg-primary/5 transition-colors"
        >
          <FileUp className="mx-auto mb-2 h-8 w-8 text-muted-foreground" />
          <p className="text-sm font-medium">Drop a PDF here or click to browse</p>
        </button>
      )}
      <input
        ref={inputRef}
        type="file"
        accept="application/pdf,.pdf"
        className="hidden"
        aria-label="Choose PDF"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void loadFile(f);
          e.target.value = "";
        }}
      />

      {file && (
        <div className="space-y-4 rounded-xl border bg-card p-4">
          {/* Text watermark */}
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="wm-text">Watermark text</Label>
              <Input id="wm-text" value={text} onChange={(e) => setText(e.target.value)} placeholder="DRAFT" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="wm-img">Or image watermark</Label>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" className="gap-1.5 cursor-pointer flex-1" onClick={() => imgRef.current?.click()}>
                  <ImageIcon className="h-3.5 w-3.5" /> {wmImageName || "Choose PNG/JPG"}
                </Button>
                {wmImage && (
                  <Button variant="ghost" size="icon-sm" aria-label="Remove image watermark" onClick={() => { setWmImage(null); setWmImageName(""); }}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
          </div>
          <input
            ref={imgRef}
            type="file"
            accept="image/png,image/jpeg"
            className="hidden"
            aria-label="Choose watermark image"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void loadImage(f);
              e.target.value = "";
            }}
          />
          {wmImage && (
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="wm-imgw">Image width (pt)</Label>
                <Input id="wm-imgw" type="number" min={10} max={400} value={imgWidth} onChange={(e) => setImgWidth(e.target.value)} />
              </div>
            </div>
          )}

          {/* Placement */}
          <div className="space-y-1.5">
            <Label>Placement</Label>
            <div className="flex flex-wrap gap-2">
              {PLACEMENTS.map((p) => (
                <button
                  key={p.value}
                  type="button"
                  title={p.hint}
                  onClick={() => setPlacement(p.value)}
                  aria-pressed={placement === p.value}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium cursor-pointer transition-colors ${
                    placement === p.value ? "bg-primary text-primary-foreground" : "bg-muted text-foreground/80"
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {placement === "custom" && (
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="space-y-1.5">
                <Label>Anchor</Label>
                <div className="grid grid-cols-3 gap-1">
                  {ANCHORS.map((a) => (
                    <button
                      key={a}
                      type="button"
                      onClick={() => setAnchor(a)}
                      aria-pressed={anchor === a}
                      className={`px-1 py-1 rounded text-[10px] cursor-pointer transition-colors ${
                        anchor === a ? "bg-primary text-primary-foreground" : "bg-muted text-foreground/70"
                      }`}
                    >
                      {a}
                    </button>
                  ))}
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="wm-x">X offset (pt)</Label>
                <Input id="wm-x" type="number" value={xOff} onChange={(e) => setXOff(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="wm-y">Y offset (pt)</Label>
                <Input id="wm-y" type="number" value={yOff} onChange={(e) => setYOff(e.target.value)} />
              </div>
            </div>
          )}

          {/* Style */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="wm-size">Font size</Label>
              <Input id="wm-size" type="number" min={8} max={200} value={fontSize} onChange={(e) => setFontSize(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="wm-op">Opacity ({Math.round(Number(opacity) * 100)}%)</Label>
              <input id="wm-op" type="range" min={5} max={100} value={Math.round((Number(opacity) || 0.3) * 100)} onChange={(e) => setOpacity((Number(e.target.value) / 100).toFixed(2))} className="w-full mt-2" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="wm-rot">Rotation (°)</Label>
              <Input id="wm-rot" type="number" min={-180} max={180} value={rotate} onChange={(e) => setRotate(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="wm-color">Color</Label>
              <Input id="wm-color" type="color" value={color} onChange={(e) => setColor(e.target.value)} className="h-9 p-1" />
            </div>
          </div>

          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input type="checkbox" checked={bold} onChange={(e) => setBold(e.target.checked)} className="h-4 w-4 accent-primary" />
            Bold text
          </label>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="wm-pages">Pages (optional)</Label>
              <Input id="wm-pages" value={pages} onChange={(e) => setPages(e.target.value)} placeholder="All — or e.g. 1, 3-5" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="wm-stamp">Corner stamp (optional)</Label>
              <Input id="wm-stamp" value={stampText} onChange={(e) => setStampText(e.target.value)} placeholder="e.g. © 2026 UnQTools" />
            </div>
          </div>

          <ActionBar>
            <RunButton onClick={() => void run()} disabled={!file} loading={working} label="Add watermark" />
            <ClearButton onClick={reset} disabled={!file && !result && !error} label="Clear" />
          </ActionBar>

          {error && <ErrorBanner message={error} />}

          {result && (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-primary/30 bg-primary/5 p-4">
              <p className="text-sm font-medium">Watermarked PDF ready • {formatBytes(result.length)}</p>
              <Button onClick={() => downloadBytes(result, `watermarked-${file?.name ?? "output.pdf"}`)} className="gap-1.5">
                <Download className="h-4 w-4" /> Download
              </Button>
            </div>
          )}
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        Privacy: runs 100% locally in your browser — your PDF and watermark image never leave your device.
      </p>
    </div>
  );
}
