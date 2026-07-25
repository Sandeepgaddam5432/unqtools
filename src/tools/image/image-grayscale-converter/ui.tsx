"use client";

import React, { useState, useCallback, useRef, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ErrorBanner, CopyButton, DownloadButton } from "../../_shared";
import {
  grayscalePixel,
  invertPixel,
  thresholdPixel,
  posterizePixel,
  duochromePixel,
  bayerDitherPixel,
  validateGrayscaleOptions,
  cssFilter,
  preservesAlpha,
  isIdentity,
  type GrayscaleAlgorithm,
  type OutputFormat,
  type FilterType,
  type RgbPixel,
} from "./logic";
import { toast } from "sonner";

interface FilterEntry {
  id: string;
  type: FilterType;
  label: string;
  strength: number;
  threshold: number;
  levels: number;
  algorithm: GrayscaleAlgorithm;
  channels: { r: boolean; g: boolean; b: boolean };
  dark: RgbPixel;
  light: RgbPixel;
}

const FILTER_LABELS: Record<FilterType, string> = {
  grayscale: "Grayscale",
  invert: "Invert",
  threshold: "Threshold",
  posterize: "Posterize",
  dither: "Dither (Bayer)",
  duochrome: "Duochrome",
};

function defaultEntry(type: FilterType, id: string): FilterEntry {
  return {
    id,
    type,
    label: FILTER_LABELS[type],
    strength: 1,
    threshold: 128,
    levels: 4,
    algorithm: "luminance",
    channels: { r: true, g: true, b: true },
    dark: { r: 0, g: 0, b: 0, a: 255 },
    light: { r: 255, g: 255, b: 255, a: 255 },
  };
}

export default function ImageGrayscaleConverter() {
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [fileName, setFileName] = useState("grayscale.png");
  const [stack, setStack] = useState<FilterEntry[]>([defaultEntry("grayscale", "1")]);
  const [format, setFormat] = useState<OutputFormat>("image/png");
  const [quality, setQuality] = useState(0.9);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const onFile = useCallback((file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("Please choose an image file.");
      return;
    }
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      setImage(img);
      setFileName(file.name.replace(/\.[^.]+$/, "") + "-grayscale.png");
      setError(null);
    };
    img.onerror = () => setError("Could not load image.");
    img.src = url;
  }, []);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    onFile(e.dataTransfer.files?.[0]);
  }, [onFile]);

  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      for (const item of items) {
        if (item.type.startsWith("image/")) {
          const f = item.getAsFile();
          if (f) onFile(f);
          break;
        }
      }
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [onFile]);

  const apply = useCallback(() => {
    if (!image || !canvasRef.current) return;
    for (const f of stack) {
      if (f.type === "grayscale") {
        const v = validateGrayscaleOptions({ strength: f.strength, algorithm: f.algorithm });
        if ("error" in v) {
          setError(v.error);
          return;
        }
      }
    }
    setError(null);
    const canvas = canvasRef.current;
    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(image, 0, 0);
    const data = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const px = data.data;
    for (let y = 0; y < canvas.height; y++) {
      for (let x = 0; x < canvas.width; x++) {
        const i = (y * canvas.width + x) * 4;
        let p: RgbPixel = { r: px[i]!, g: px[i + 1]!, b: px[i + 2]!, a: px[i + 3]! };
        for (const f of stack) {
          switch (f.type) {
            case "grayscale":
              p = grayscalePixel(p, f.strength, f.algorithm);
              break;
            case "invert":
              p = invertPixel(p, f.channels);
              break;
            case "threshold":
              p = thresholdPixel(p, f.threshold);
              break;
            case "posterize":
              p = posterizePixel(p, f.levels);
              break;
            case "duochrome":
              p = duochromePixel(p, f.dark, f.light);
              break;
            case "dither":
              p = bayerDitherPixel(p, x, y, f.levels);
              break;
          }
        }
        px[i] = p.r;
        px[i + 1] = p.g;
        px[i + 2] = p.b;
      }
    }
    ctx.putImageData(data, 0, 0);
    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        if (previewUrl) URL.revokeObjectURL(previewUrl);
        setPreviewUrl(URL.createObjectURL(blob));
        toast.success("Filter applied");
      },
      format,
      format === "image/png" ? undefined : quality,
    );
  }, [image, stack, format, quality, previewUrl]);

  // Live preview on stack change
  useEffect(() => {
    if (!image) return;
    const t = setTimeout(() => apply(), 100);
    return () => clearTimeout(t);
  }, [image, stack, apply]);

  const download = useCallback(() => {
    if (!canvasRef.current) return;
    canvasRef.current.toBlob(
      (blob) => {
        if (!blob) return;
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = fileName;
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
        toast.success("Image downloaded");
      },
      format,
      format === "image/png" ? undefined : quality,
    );
  }, [fileName, format, quality]);

  const updateEntry = (id: string, patch: Partial<FilterEntry>) => {
    setStack((s) => s.map((e) => (e.id === id ? { ...e, ...patch } : e)));
  };

  const addFilter = (type: FilterType) => {
    setStack((s) => [...s, defaultEntry(type, String(Date.now()))]);
  };

  const removeFilter = (id: string) => {
    setStack((s) => s.filter((e) => e.id !== id));
  };

  const moveFilter = (id: string, dir: -1 | 1) => {
    setStack((s) => {
      const i = s.findIndex((e) => e.id === id);
      if (i < 0) return s;
      const j = i + dir;
      if (j < 0 || j >= s.length) return s;
      const next = [...s];
      [next[i], next[j]] = [next[j]!, next[i]!];
      return next;
    });
  };

  const reset = () => setStack([defaultEntry("grayscale", "1")]);

  const cssString = cssFilter(
    { strength: stack.find((f) => f.type === "grayscale")?.strength ?? 1, algorithm: "luminance" },
    stack.map((f) => f.type),
  );

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4 space-y-3">
          <div
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={onDrop}
            className={`border-2 border-dashed rounded-lg p-6 text-center ${dragOver ? "border-primary bg-primary/5" : "border-border"}`}
          >
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => onFile(e.target.files?.[0])} />
            <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()}>Choose image</Button>
            <p className="text-xs text-muted-foreground mt-2">or drag-drop, or paste (Ctrl+V)</p>
          </div>
          {image && (
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant="outline">{image.naturalWidth} × {image.naturalHeight}</Badge>
              <Badge variant="secondary">{stack.length} filter{stack.length !== 1 ? "s" : ""}</Badge>
            </div>
          )}
        </CardContent>
      </Card>

      {image && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <Label className="text-xs text-muted-foreground">Add filter</Label>
            <div className="flex flex-wrap gap-2">
              {(Object.keys(FILTER_LABELS) as FilterType[]).map((t) => (
                <Button key={t} size="sm" variant="outline" onClick={() => addFilter(t)}>
                  + {FILTER_LABELS[t]}
                </Button>
              ))}
            </div>

            <div className="space-y-3">
              <Label className="text-xs text-muted-foreground">Filter stack (applied top-to-bottom)</Label>
              {stack.map((f, idx) => (
                <div key={f.id} className="border rounded-lg p-3 space-y-2">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">{idx + 1}</Badge>
                    <span className="text-sm font-medium">{f.label}</span>
                    <Button size="sm" variant="ghost" onClick={() => moveFilter(f.id, -1)} disabled={idx === 0}>↑</Button>
                    <Button size="sm" variant="ghost" onClick={() => moveFilter(f.id, 1)} disabled={idx === stack.length - 1}>↓</Button>
                    <Button size="sm" variant="ghost" onClick={() => removeFilter(f.id)}>✕</Button>
                  </div>
                  {f.type === "grayscale" && (
                    <>
                      <div>
                        <Label className="text-xs text-muted-foreground">Strength: {Math.round(f.strength * 100)}%</Label>
                        <input type="range" min={0} max={100} value={Math.round(f.strength * 100)} onChange={(e) => updateEntry(f.id, { strength: Number(e.target.value) / 100 })} className="w-full" />
                      </div>
                      <div>
                        <Label className="text-xs text-muted-foreground">Algorithm</Label>
                        <select value={f.algorithm} onChange={(e) => updateEntry(f.id, { algorithm: e.target.value as GrayscaleAlgorithm })} className="h-9 rounded-md border bg-background px-3 text-sm">
                          <option value="luminance">BT.601 (luminance)</option>
                          <option value="bt709">BT.709 (HD)</option>
                          <option value="bt2020">BT.2020 (UHD)</option>
                          <option value="average">Average</option>
                          <option value="lightness">Lightness (HSL)</option>
                          <option value="rms">RMS</option>
                        </select>
                      </div>
                    </>
                  )}
                  {f.type === "invert" && (
                    <div className="flex gap-3">
                      <label className="flex items-center gap-1 text-xs"><input type="checkbox" checked={f.channels.r} onChange={(e) => updateEntry(f.id, { channels: { ...f.channels, r: e.target.checked } })} /> R</label>
                      <label className="flex items-center gap-1 text-xs"><input type="checkbox" checked={f.channels.g} onChange={(e) => updateEntry(f.id, { channels: { ...f.channels, g: e.target.checked } })} /> G</label>
                      <label className="flex items-center gap-1 text-xs"><input type="checkbox" checked={f.channels.b} onChange={(e) => updateEntry(f.id, { channels: { ...f.channels, b: e.target.checked } })} /> B</label>
                    </div>
                  )}
                  {f.type === "threshold" && (
                    <div>
                      <Label className="text-xs text-muted-foreground">Threshold: {f.threshold}</Label>
                      <input type="range" min={0} max={255} value={f.threshold} onChange={(e) => updateEntry(f.id, { threshold: Number(e.target.value) })} className="w-full" />
                    </div>
                  )}
                  {(f.type === "posterize" || f.type === "dither") && (
                    <div>
                      <Label className="text-xs text-muted-foreground">Levels: {f.levels}</Label>
                      <input type="range" min={2} max={32} value={f.levels} onChange={(e) => updateEntry(f.id, { levels: Number(e.target.value) })} className="w-full" />
                    </div>
                  )}
                  {f.type === "duochrome" && (
                    <div className="flex gap-3 text-xs items-center">
                      <span>Dark:</span>
                      <input type="color" value={`#${[f.dark.r, f.dark.g, f.dark.b].map((v) => v.toString(16).padStart(2, "0")).join("")}`} onChange={(e) => {
                        const hex = e.target.value;
                        updateEntry(f.id, { dark: { r: parseInt(hex.slice(1, 3), 16), g: parseInt(hex.slice(3, 5), 16), b: parseInt(hex.slice(5, 7), 16), a: 255 } });
                      }} />
                      <span>Light:</span>
                      <input type="color" value={`#${[f.light.r, f.light.g, f.light.b].map((v) => v.toString(16).padStart(2, "0")).join("")}`} onChange={(e) => {
                        const hex = e.target.value;
                        updateEntry(f.id, { light: { r: parseInt(hex.slice(1, 3), 16), g: parseInt(hex.slice(3, 5), 16), b: parseInt(hex.slice(5, 7), 16), a: 255 } });
                      }} />
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div className="flex flex-wrap gap-3 items-end pt-2">
              <div>
                <Label className="text-xs text-muted-foreground">Format</Label>
                <select value={format} onChange={(e) => setFormat(e.target.value as OutputFormat)} className="h-9 rounded-md border bg-background px-3 text-sm">
                  <option value="image/png">PNG (alpha)</option>
                  <option value="image/jpeg">JPEG (small)</option>
                  <option value="image/webp">WebP</option>
                </select>
              </div>
              {format !== "image/png" && (
                <div>
                  <Label className="text-xs text-muted-foreground">Quality: {Math.round(quality * 100)}%</Label>
                  <Input type="range" min={10} max={100} value={Math.round(quality * 100)} onChange={(e) => setQuality(Number(e.target.value) / 100)} className="w-32" />
                </div>
              )}
            </div>
            {!preservesAlpha(format) && (
              <p className="text-xs text-yellow-700 dark:text-yellow-400">⚠️ JPEG does not preserve transparency.</p>
            )}
            <div className="flex flex-wrap gap-2">
              <Button size="sm" onClick={apply}>Apply</Button>
              <Button variant="outline" size="sm" onClick={reset}>Reset stack</Button>
              <CopyButton getText={() => cssString} label="Copy CSS filter" />
              <DownloadButton
                getText={async () => {
                  if (!canvasRef.current) return "";
                  return await new Promise<string>((resolve) => {
                    canvasRef.current!.toBlob(
                      (blob) => {
                        if (!blob) return resolve("");
                        const reader = new FileReader();
                        reader.onload = () => resolve(reader.result as string);
                        reader.readAsDataURL(blob);
                      },
                      format,
                      format === "image/png" ? undefined : quality,
                    );
                  });
                }}
                filename={fileName}
                mime={format}
                label="Download"
                disabled={!previewUrl}
              />
            </div>
          </CardContent>
        </Card>
      )}

      <canvas ref={canvasRef} className="hidden" />
      {previewUrl && (
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground mb-2">Preview</p>
            <img src={previewUrl} alt="Grayscale preview" className="max-w-full rounded-md border" />
          </CardContent>
        </Card>
      )}
      {error && <ErrorBanner message={error} />}
      <Card>
        <CardContent className="p-4">
          <p className="text-xs text-muted-foreground">
            <strong className="text-foreground">Privacy:</strong> all filters run locally via the Canvas API. Stack filters, copy as CSS, and export at full resolution — all in-browser.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
