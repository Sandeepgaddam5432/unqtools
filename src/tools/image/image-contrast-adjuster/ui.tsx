"use client";

import React, { useState, useCallback, useRef, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { ErrorBanner, DownloadButton } from "../../_shared";
import {
  applyAll,
  validateContrastOptions,
  computeHistogram,
  autoContrast,
  stretchPercentage,
  countClipped,
  preservesAlpha,
  isIdentity,
  nudgeValue,
  DEFAULT_OPTIONS,
  type ContrastOptions,
  type OutputFormat,
} from "./logic";
import { toast } from "sonner";

export default function ImageContrastAdjuster() {
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [fileName, setFileName] = useState("contrast.png");
  const [opts, setOpts] = useState<ContrastOptions>({ ...DEFAULT_OPTIONS });
  const [format, setFormat] = useState<OutputFormat>("image/png");
  const [quality, setQuality] = useState(0.9);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [histBefore, setHistBefore] = useState<{ r: number[]; g: number[]; b: number[] } | null>(null);
  const [histAfter, setHistAfter] = useState<{ r: number[]; g: number[]; b: number[] } | null>(null);
  const [clipped, setClipped] = useState<{ under: number; over: number; total: number } | null>(null);
  const [splitPreview, setSplitPreview] = useState(false);
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
      setFileName(file.name.replace(/\.[^.]+$/, "") + "-contrast.png");
      setOpts({ ...DEFAULT_OPTIONS });
      setError(null);
      const c = document.createElement("canvas");
      c.width = img.naturalWidth;
      c.height = img.naturalHeight;
      const cx = c.getContext("2d");
      if (cx) {
        cx.drawImage(img, 0, 0);
        try {
          const data = cx.getImageData(0, 0, c.width, c.height).data;
          setHistBefore(computeHistogram(data));
        } catch {
          setHistBefore(null);
        }
      }
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
    const v = validateContrastOptions(opts);
    if ("error" in v) {
      setError(v.error);
      return;
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
    if (!isIdentity(opts)) {
      for (let i = 0; i < px.length; i += 4) {
        const out = applyAll({ r: px[i]!, g: px[i + 1]!, b: px[i + 2]!, a: px[i + 3]! }, opts);
        px[i] = out.r;
        px[i + 1] = out.g;
        px[i + 2] = out.b;
      }
    }
    ctx.putImageData(data, 0, 0);
    setHistAfter(computeHistogram(px));
    setClipped(countClipped(px));

    if (splitPreview) {
      ctx.save();
      ctx.beginPath();
      ctx.rect(0, 0, canvas.width / 2, canvas.height);
      ctx.clip();
      ctx.drawImage(image, 0, 0);
      ctx.restore();
      ctx.strokeStyle = "#fff";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(canvas.width / 2, 0);
      ctx.lineTo(canvas.width / 2, canvas.height);
      ctx.stroke();
    }

    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        if (previewUrl) URL.revokeObjectURL(previewUrl);
        setPreviewUrl(URL.createObjectURL(blob));
        toast.success("Contrast applied");
      },
      format,
      format === "image/png" ? undefined : quality,
    );
  }, [image, opts, format, quality, previewUrl, splitPreview]);

  useEffect(() => {
    if (!image) return;
    const t = setTimeout(() => apply(), 100);
    return () => clearTimeout(t);
  }, [image, opts, apply]);

  const download = useCallback(() => {
    if (!canvasRef.current) return;
    if (splitPreview && image) {
      const canvas = canvasRef.current;
      canvas.width = image.naturalWidth;
      canvas.height = image.naturalHeight;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.drawImage(image, 0, 0);
        const data = ctx.getImageData(0, 0, canvas.width, canvas.height);
        for (let i = 0; i < data.data.length; i += 4) {
          const out = applyAll({ r: data.data[i]!, g: data.data[i + 1]!, b: data.data[i + 2]!, a: data.data[i + 3]! }, opts);
          data.data[i] = out.r;
          data.data[i + 1] = out.g;
          data.data[i + 2] = out.b;
        }
        ctx.putImageData(data, 0, 0);
      }
    }
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
  }, [image, opts, fileName, format, quality, splitPreview]);

  const setOpt = useCallback((key: keyof ContrastOptions, value: number) => {
    setOpts((o) => ({ ...o, [key]: value }));
  }, []);

  const reset = useCallback(() => setOpts({ ...DEFAULT_OPTIONS }), []);

  const runAutoContrast = useCallback(() => {
    if (!histBefore) return;
    const { blackPoint, whitePoint } = autoContrast(histBefore);
    setOpts((o) => ({ ...o, blackPoint, whitePoint }));
    toast.success(`Auto-contrast: black=${blackPoint}, white=${whitePoint}`);
  }, [histBefore]);

  const onKeyDown = useCallback((key: keyof ContrastOptions) => (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowUp" || e.key === "ArrowDown") {
      e.preventDefault();
      setOpts((o) => ({ ...o, [key]: nudgeValue(o[key], e.key.toLowerCase(), e.shiftKey) }));
    }
  }, []);

  const renderSlider = (key: keyof ContrastOptions, label: string, min: number, max: number) => (
    <div onDoubleClick={() => setOpt(key, key === "blackPoint" ? 0 : key === "whitePoint" ? 255 : 0)}>
      <Label className="text-xs text-muted-foreground">{label}: {opts[key] > 0 && key !== "blackPoint" && key !== "whitePoint" ? `+${opts[key]}` : opts[key]}</Label>
      <input
        type="range"
        min={min}
        max={max}
        value={opts[key]}
        onChange={(e) => setOpt(key, Number(e.target.value))}
        onKeyDown={onKeyDown(key)}
        className="w-full"
      />
    </div>
  );

  const stretch = stretchPercentage(opts.blackPoint, opts.whitePoint);

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
            <p className="text-xs text-muted-foreground mt-2">or drag-drop, or paste · Double-click slider to reset · ↑↓ to nudge (Shift = ±10)</p>
          </div>
          {image && (
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant="outline">{image.naturalWidth} × {image.naturalHeight}</Badge>
              {stretch > 0 && <Badge variant="secondary">Stretch: +{(stretch * 100).toFixed(0)}%</Badge>}
              {clipped && (
                <>
                  {clipped.under > 0 && <Badge variant="destructive">Under: {clipped.under}</Badge>}
                  {clipped.over > 0 && <Badge variant="destructive">Over: {clipped.over}</Badge>}
                </>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {image && (
        <Card>
          <CardContent className="p-4 space-y-3">
            {renderSlider("value", "Contrast", -100, 100)}
            {renderSlider("sigmoid", "Sigmoid strength", 0, 100)}
            {renderSlider("blackPoint", "Black point", 0, 255)}
            {renderSlider("whitePoint", "White point", 0, 255)}
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
              <div className="flex items-end gap-2 pb-1">
                <Switch checked={splitPreview} onCheckedChange={setSplitPreview} id="split2" />
                <Label htmlFor="split2" className="text-xs cursor-pointer">Split before/after</Label>
              </div>
            </div>
            {!preservesAlpha(format) && (
              <p className="text-xs text-yellow-700 dark:text-yellow-400">⚠️ JPEG does not preserve transparency.</p>
            )}
            <div className="flex flex-wrap gap-2">
              <Button size="sm" onClick={apply}>Apply</Button>
              <Button variant="outline" size="sm" onClick={reset}>Reset</Button>
              <Button variant="outline" size="sm" onClick={runAutoContrast}>Auto-contrast</Button>
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

      {histAfter && (
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground mb-2">Histogram (after)</p>
            <HistogramView hist={histAfter} />
          </CardContent>
        </Card>
      )}

      <canvas ref={canvasRef} className="hidden" />
      {previewUrl && (
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground mb-2">{splitPreview ? "Before (left) / After (right)" : "Preview"}</p>
            <img src={previewUrl} alt="Contrast preview" className="max-w-full rounded-md border" />
          </CardContent>
        </Card>
      )}
      {error && <ErrorBanner message={error} />}
      <Card>
        <CardContent className="p-4">
          <p className="text-xs text-muted-foreground">
            <strong className="text-foreground">Privacy:</strong> all contrast adjustments run locally via the Canvas API. Auto-contrast, sigmoid, and histogram stretch computed in-browser.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function HistogramView({ hist }: { hist: { r: number[]; g: number[]; b: number[] } }) {
  const max = Math.max(
    ...hist.r,
    ...hist.g,
    ...hist.b,
    1,
  );
  return (
    <div className="flex items-end gap-px h-24 bg-muted/30 rounded p-1">
      {Array.from({ length: 256 }, (_, i) => {
        const rH = (hist.r[i]! / max) * 100;
        const gH = (hist.g[i]! / max) * 100;
        const bH = (hist.b[i]! / max) * 100;
        return (
          <div key={i} className="flex-1 flex flex-col justify-end" style={{ minWidth: "1px" }}>
            <div style={{ height: `${Math.max(rH, gH, bH)}%`, background: `linear-gradient(to top, rgba(255,0,0,0.5) ${rH}%, rgba(0,255,0,0.5) ${gH}%, rgba(0,0,255,0.5) ${bH}%)` }} />
          </div>
        );
      })}
    </div>
  );
}
