"use client";

/**
 * Crop PDF Pages — 100x UI.
 * Margin presets, custom margins with mm/in/pt units, per-page ranges,
 * live before/after dimension preview, reset-to-full-page.
 */

import React, { useEffect, useRef, useState } from "react";
import { PDFDocument } from "pdf-lib";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Download, FileUp, Trash2, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { ActionBar, ClearButton, ErrorBanner, RunButton } from "../../_shared";
import { downloadBytes, formatBytes } from "../_shared/download";
import { cropPdf, previewCrop, CROP_PRESETS, type CropUnit } from "./logic";

type LoadedFile = { name: string; bytes: Uint8Array; pageCount: number };
type Preview = { before: { page: number; width: number; height: number }[]; after: { page: number; width: number; height: number }[] };

export default function CropPdf() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<LoadedFile | null>(null);
  const [top, setTop] = useState("0");
  const [bottom, setBottom] = useState("0");
  const [left, setLeft] = useState("0");
  const [right, setRight] = useState("0");
  const [unit, setUnit] = useState<CropUnit>("mm");
  const [pages, setPages] = useState("");
  const [reset, setReset] = useState(false);
  const [preview, setPreview] = useState<Preview | null>(null);
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
      setPreview(null);
    } catch {
      toast.error(`Could not read ${f.name} — it may be corrupted or password-protected.`);
    }
  }

  function resetAll() {
    setFile(null);
    setResult(null);
    setError("");
    setPreview(null);
    setPages("");
    setTop("0");
    setBottom("0");
    setLeft("0");
    setRight("0");
    setReset(false);
  }

  function applyPreset(mm: number) {
    setTop(String(mm));
    setBottom(String(mm));
    setLeft(String(mm));
    setRight(String(mm));
    setReset(false);
    setResult(null);
  }

  useEffect(() => {
    let alive = true;
    if (file && !reset) {
      const t = setTimeout(async () => {
        const r = await previewCrop(file.bytes, {
          marginTop: Number(top) || 0,
          marginBottom: Number(bottom) || 0,
          marginLeft: Number(left) || 0,
          marginRight: Number(right) || 0,
          unit,
          pages,
        });
        if (alive && r.ok) setPreview(r.output);
      }, 300);
      return () => {
        alive = false;
        clearTimeout(t);
      };
    }
    if (file && reset) setPreview(null);
    return undefined;
  }, [file, top, bottom, left, right, unit, pages, reset]);

  async function run() {
    if (!file) return;
    setWorking(true);
    setError("");
    setResult(null);
    const r = await cropPdf(file.bytes, {
      marginTop: Number(top) || 0,
      marginBottom: Number(bottom) || 0,
      marginLeft: Number(left) || 0,
      marginRight: Number(right) || 0,
      unit,
      pages,
      reset,
    });
    setWorking(false);
    if (r.ok) {
      setResult(r.output);
      toast.success(reset ? "Crop reset to full page" : "Crop applied");
    } else {
      setError(r.error);
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
          <Button variant="ghost" size="icon-sm" aria-label="Remove file" onClick={resetAll}>
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
            const f = e.dataTransfer.files?.[0];
            if (f) void loadFile(f);
          }}
          className="w-full rounded-xl border-2 border-dashed border-border p-10 text-center hover:border-primary/50 hover:bg-primary/5 transition-colors"
        >
          <FileUp className="mx-auto mb-2 h-9 w-9 text-muted-foreground" />
          <p className="text-sm font-medium">Drop a PDF here or click to browse</p>
          <p className="mt-1 text-xs text-muted-foreground">Crop any or all pages with presets or custom margins.</p>
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
          {/* Presets */}
          <div className="space-y-1.5">
            <Label>Quick presets</Label>
            <div className="flex flex-wrap gap-2">
              {CROP_PRESETS.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => applyPreset(p.mm)}
                  className="px-3 py-1.5 rounded-full text-xs font-medium bg-muted text-foreground/80 hover:bg-muted/80 cursor-pointer transition-colors"
                >
                  {p.label}
                </button>
              ))}
              <button
                type="button"
                onClick={() => setReset(true)}
                className="px-3 py-1.5 rounded-full text-xs font-medium bg-muted text-foreground/80 hover:bg-muted/80 cursor-pointer transition-colors flex items-center gap-1"
              >
                <RotateCcw className="h-3 w-3" /> Reset to full page
              </button>
            </div>
          </div>

          {/* Custom margins */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label>Custom margins</Label>
              <div className="flex gap-1">
                {(["mm", "in", "pt"] as CropUnit[]).map((u) => (
                  <button
                    key={u}
                    type="button"
                    onClick={() => setUnit(u)}
                    aria-pressed={unit === u}
                    className={`px-2 py-0.5 rounded text-xs font-medium cursor-pointer ${
                      unit === u ? "bg-primary text-primary-foreground" : "bg-muted text-foreground/80"
                    }`}
                  >
                    {u}
                  </button>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {(
                [
                  ["Top", top, setTop],
                  ["Bottom", bottom, setBottom],
                  ["Left", left, setLeft],
                  ["Right", right, setRight],
                ] as const
              ).map(([label, val, setter]) => (
                <div key={label} className="space-y-1">
                  <Label htmlFor={`crop-${label}`}>{label}</Label>
                  <Input
                    id={`crop-${label}`}
                    type="number"
                    min={0}
                    value={val}
                    onChange={(e) => {
                      setter(e.target.value);
                      setReset(false);
                      setResult(null);
                    }}
                    placeholder="0"
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Pages */}
          <div className="space-y-1">
            <Label htmlFor="crop-pages">Pages (optional)</Label>
            <Input
              id="crop-pages"
              value={pages}
              onChange={(e) => {
                setPages(e.target.value);
                setResult(null);
              }}
              placeholder={`All pages — or e.g. 1, 3-5`}
            />
          </div>

          {/* Live preview */}
          {preview && !reset && (
            <div className="rounded-lg border bg-muted/40 p-3 text-xs text-muted-foreground">
              <p className="font-medium text-foreground mb-1">Dimension preview</p>
              <p>
                Page 1: {preview.before[0]!.width}×{preview.before[0]!.height} → {preview.after[0]!.width}×{preview.after[0]!.height} pt
                {preview.after.length > 1 && (
                  <span> · Page {preview.after.length}: {preview.after[preview.after.length - 1]!.width}×{preview.after[preview.after.length - 1]!.height} pt</span>
                )}
              </p>
            </div>
          )}
          {reset && (
            <p className="text-xs text-muted-foreground rounded-lg border bg-muted/40 p-3">
              Reset mode: removes any existing crop and restores every selected page to its full size.
            </p>
          )}

          <ActionBar>
            <RunButton
              onClick={() => void run()}
              disabled={!file}
              loading={working}
              label={reset ? "Reset crop" : "Apply crop"}
            />
            <ClearButton onClick={resetAll} disabled={!file && !result && !error} label="Clear" />
          </ActionBar>

          {error && <ErrorBanner message={error} />}

          {result && (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-primary/30 bg-primary/5 p-4">
              <div>
                <p className="text-sm font-medium">Cropped PDF ready</p>
                <p className="text-xs text-muted-foreground">{formatBytes(result.length)}</p>
              </div>
              <Button onClick={() => downloadBytes(result, file?.name.replace(/\.pdf$/i, "") + "-cropped.pdf")} className="gap-1.5">
                <Download className="h-4 w-4" /> Download
              </Button>
            </div>
          )}
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        Privacy: 100% local — your PDF never leaves your device. Cropping sets a non-destructive CropBox, so the
        original content is always recoverable.
      </p>
    </div>
  );
}
