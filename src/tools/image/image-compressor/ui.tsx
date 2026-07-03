"use client";

import React, { useState, useCallback, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { DownloadButton, ErrorBanner } from "../../_shared";
import { toast } from "sonner";
import {
  formatBytes,
  buildOutputFilename,
  type OutputFormat,
  type CompressResult,
  type CompressOptions,
} from "./logic";

/** Compress a single image file via Canvas re-encode. */
async function compressImage(file: File, opts: CompressOptions): Promise<CompressResult> {
  const bitmap = await createImageBitmap(file);
  let { width, height } = bitmap;
  if (opts.maxDimension && (width > opts.maxDimension || height > opts.maxDimension)) {
    const scale = opts.maxDimension / Math.max(width, height);
    width = Math.round(width * scale);
    height = Math.round(height * scale);
  }
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D context unavailable");
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();
  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("Canvas toBlob failed"))),
      opts.format,
      opts.quality,
    );
  });
  return {
    blob,
    width,
    height,
    originalSize: file.size,
    compressedSize: blob.size,
    savedBytes: file.size - blob.size,
    savedPct: file.size > 0 ? ((file.size - blob.size) / file.size) * 100 : 0,
    format: opts.format,
  };
}

interface FileEntry {
  file: File;
  result: CompressResult | null;
  error: string | null;
}

export default function ImageCompressor() {
  const [entries, setEntries] = useState<FileEntry[]>([]);
  const [format, setFormat] = useState<OutputFormat>("image/jpeg");
  const [quality, setQuality] = useState(0.8);
  const [maxDimension, setMaxDimension] = useState<string>("");
  const [stripExif, setStripExif] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const onFiles = useCallback((files: FileList | null) => {
    if (!files || files.length === 0) return;
    const newEntries: FileEntry[] = Array.from(files)
      .filter((f) => f.type.startsWith("image/"))
      .map((f) => ({ file: f, result: null, error: null }));
    setEntries((prev) => [...prev, ...newEntries]);
  }, []);

  const compressAll = useCallback(async () => {
    setBusy(true);
    setError(null);
    const updated: FileEntry[] = [];
    for (const entry of entries) {
      try {
        const result = await compressImage(entry.file, {
          format,
          quality,
          maxDimension: maxDimension ? Number(maxDimension) : undefined,
          stripExif,
        });
        updated.push({ ...entry, result, error: null });
      } catch (e) {
        updated.push({ ...entry, result: null, error: (e as Error).message });
      }
    }
    setEntries(updated);
    setBusy(false);
    toast.success(`Compressed ${updated.length} image${updated.length === 1 ? "" : "s"}`);
  }, [entries, format, quality, maxDimension, stripExif]);

  const downloadAll = useCallback(async () => {
    for (const entry of entries) {
      if (entry.result) {
        const url = URL.createObjectURL(entry.result.blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `compressed-${entry.file.name.replace(/\.[^.]+$/, "")}.${format.split("/")[1]}`;
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      }
    }
    toast.success("Downloaded all compressed images");
  }, [entries, format]);

  const clear = useCallback(() => {
    setEntries([]);
    setError(null);
  }, []);

  const totalOriginal = entries.reduce((s, e) => s + e.file.size, 0);
  const totalCompressed = entries.reduce((s, e) => s + (e.result?.compressedSize ?? 0), 0);
  const totalSaved = entries.reduce((s, e) => s + (e.result?.savedBytes ?? 0), 0);

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap items-end gap-4">
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-muted-foreground">Format</Label>
              <select
                value={format}
                onChange={(e) => setFormat(e.target.value as OutputFormat)}
                className="h-9 rounded-md border bg-background px-3 text-sm"
              >
                <option value="image/jpeg">JPEG</option>
                <option value="image/png">PNG</option>
                <option value="image/webp">WebP</option>
              </select>
            </div>
            {format !== "image/png" && (
              <div className="flex flex-col gap-1.5 min-w-[180px]">
                <Label className="text-xs text-muted-foreground">Quality: {Math.round(quality * 100)}%</Label>
                <Slider
                  value={[quality * 100]}
                  onValueChange={(v) => setQuality(v[0]! / 100)}
                  min={10}
                  max={100}
                  step={5}
                />
              </div>
            )}
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-muted-foreground">Max dimension (px)</Label>
              <Input
                type="number"
                value={maxDimension}
                onChange={(e) => setMaxDimension(e.target.value)}
                placeholder="No resize"
                className="w-32"
              />
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={stripExif} onCheckedChange={setStripExif} id="strip-exif" />
              <Label htmlFor="strip-exif" className="text-sm cursor-pointer">Strip EXIF</Label>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4">
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              onFiles(e.dataTransfer.files);
            }}
            className="rounded-lg border-2 border-dashed border-border p-8 text-center"
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(e) => onFiles(e.target.files)}
            />
            <p className="text-sm text-muted-foreground mb-2">
              Drop images here or click to browse
            </p>
            <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
              Choose files
            </Button>
          </div>
        </CardContent>
      </Card>

      {entries.length > 0 && (
        <Card>
          <CardContent className="p-4">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
              <p className="text-sm font-medium">
                {entries.length} image{entries.length === 1 ? "" : "s"} ·{" "}
                {formatBytes(totalOriginal)}
                {totalCompressed > 0 && (
                  <span className="text-emerald-500"> → {formatBytes(totalCompressed)} (saved {formatBytes(totalSaved)})</span>
                )}
              </p>
              <div className="flex gap-2">
                <Button size="sm" onClick={compressAll} disabled={busy}>
                  {busy ? "Compressing…" : "Compress all"}
                </Button>
                <Button variant="outline" size="sm" onClick={downloadAll} disabled={!entries.some((e) => e.result)}>
                  Download all
                </Button>
                <Button variant="ghost" size="sm" onClick={clear}>Clear</Button>
              </div>
            </div>
            <div className="space-y-2">
              {entries.map((entry, i) => (
                <div key={i} className="flex items-center gap-3 rounded-md border p-2">
                  <div className="h-10 w-10 rounded bg-muted flex-shrink-0 overflow-hidden">
                    <img
                      src={URL.createObjectURL(entry.file)}
                      alt={entry.file.name}
                      className="h-full w-full object-cover"
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{entry.file.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatBytes(entry.file.size)}
                      {entry.result && (
                        <span className="text-emerald-500">
                          {" "}→ {formatBytes(entry.result.compressedSize)} (-{entry.result.savedPct.toFixed(0)}%)
                        </span>
                      )}
                    </p>
                  </div>
                  {entry.error && <Badge variant="destructive" className="text-xs">{entry.error}</Badge>}
                  {entry.result && (
                    <a
                      href={URL.createObjectURL(entry.result.blob)}
                      download={`compressed-${entry.file.name.replace(/\.[^.]+$/, "")}.${format.split("/")[1]}`}
                      className="text-xs text-primary hover:underline"
                    >
                      Download
                    </a>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {error && <ErrorBanner message={error} />}

      <Card>
        <CardContent className="p-4">
          <p className="text-xs text-muted-foreground">
            <strong className="text-foreground">Privacy:</strong> all compression runs locally via Canvas API. Images never leave your browser.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
