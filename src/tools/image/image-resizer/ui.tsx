"use client";

import React, { useState, useCallback, useRef, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { ErrorBanner } from "../../_shared";
import {
  calculateResize, SOCIAL_PRESETS, GENERIC_PRESETS, formatFileSize,
  encodeResizeParams, decodeResizeParams,
  type ResizeMode, type OutputFormat,
} from "./logic";
import { toast } from "sonner";

export default function ImageResizer() {
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [fileName, setFileName] = useState("resized.png");
  const [mode, setMode] = useState<ResizeMode>("pixels");
  const [width, setWidth] = useState("");
  const [height, setHeight] = useState("");
  const [scalePercent, setScalePercent] = useState("");
  const [targetSizeKB, setTargetSizeKB] = useState("");
  const [selectedPreset, setSelectedPreset] = useState("");
  const [lockAspect, setLockAspect] = useState(true);
  const [preventEnlarge, setPreventEnlarge] = useState(false);
  const [format, setFormat] = useState<OutputFormat>("image/png");
  const [quality, setQuality] = useState(0.9);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [result, setResult] = useState<ReturnType<typeof calculateResize> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const onFile = useCallback((file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) { setError("Please choose an image file."); return; }
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      setImage(img);
      setWidth(String(img.naturalWidth));
      setHeight(String(img.naturalHeight));
      setFileName(file.name.replace(/\.[^.]+$/, "") + "-resized." + format.split("/")[1]);
      setError(null);
    };
    img.onerror = () => setError("Could not load image.");
    img.src = url;
  }, [format]);

  // Drag-drop support (blueprint §7: "Drag-drop, paste, or file picker")
  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    onFile(e.dataTransfer.files?.[0]);
  }, [onFile]);

  // Paste support (blueprint §7: "paste")
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      for (const item of items) {
        if (item.type.startsWith("image/")) {
          const file = item.getAsFile();
          if (file) onFile(file);
          break;
        }
      }
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [onFile]);

  const applyResize = useCallback(() => {
    if (!image || !canvasRef.current) return;
    const r = calculateResize({
      originalWidth: image.naturalWidth,
      originalHeight: image.naturalHeight,
      mode,
      targetWidth: width.trim() ? Number(width) : undefined,
      targetHeight: height.trim() ? Number(height) : undefined,
      scalePercent: scalePercent.trim() ? Number(scalePercent) : undefined,
      targetSizeKB: targetSizeKB.trim() ? Number(targetSizeKB) : undefined,
      presetName: selectedPreset || undefined,
      lockAspect,
      preventEnlarge,
    });
    if ("error" in r) { setError(r.error); setResult(null); return; }
    setError(null);
    setResult(r);

    // Multi-step downscale (blueprint §5 Advanced)
    const canvas = canvasRef.current;
    const steps = r.downscaleSteps;
    if (steps.length > 1) {
      // Multi-step: create temp canvas, resize in steps
      let tempCanvas = document.createElement("canvas");
      tempCanvas.width = image.naturalWidth;
      tempCanvas.height = image.naturalHeight;
      let tempCtx = tempCanvas.getContext("2d")!;
      tempCtx.drawImage(image, 0, 0);
      for (let i = 0; i < steps.length; i++) {
        const step = steps[i]!;
        tempCanvas = document.createElement("canvas");
        tempCanvas.width = step.width;
        tempCanvas.height = step.height;
        tempCtx = tempCanvas.getContext("2d")!;
        tempCtx.imageSmoothingEnabled = true;
        tempCtx.imageSmoothingQuality = "high";
        // Draw from previous canvas
        const prevCanvas = i === 0 ? canvasRef.current : document.createElement("canvas");
        if (i === 0) {
          tempCtx.drawImage(image, 0, 0, step.width, step.height);
        } else {
          // Use the last temp canvas
          tempCtx.drawImage(document.getElementsByTagName("canvas")[0]!, 0, 0, step.width, step.height);
        }
      }
      canvas.width = r.width;
      canvas.height = r.height;
      const ctx = canvas.getContext("2d")!;
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(tempCanvas, 0, 0, r.width, r.height);
    } else {
      // Single step
      canvas.width = r.width;
      canvas.height = r.height;
      const ctx = canvas.getContext("2d")!;
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(image, 0, 0, r.width, r.height);
    }

    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        if (previewUrl) URL.revokeObjectURL(previewUrl);
        setPreviewUrl(URL.createObjectURL(blob));
        toast.success(`Resized to ${r.width}×${r.height}`);
      },
      format,
      format === "image/png" ? undefined : quality,
    );
  }, [image, mode, width, height, scalePercent, targetSizeKB, selectedPreset, lockAspect, preventEnlarge, format, quality, previewUrl]);

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

  // Share URL (blueprint §5 Advanced: "URL preset sharing")
  const shareUrl = useCallback(() => {
    if (!result || "error" in result) return;
    const encoded = encodeResizeParams({ w: result.width, h: result.height, mode, lock: lockAspect });
    const url = `${window.location.origin}/tools/image-resizer#preset=${encoded}`;
    navigator.clipboard.writeText(url);
    toast.success("Share URL copied to clipboard");
  }, [result, mode, lockAspect]);

  const onWidthChange = (v: string) => {
    setWidth(v);
    if (lockAspect && image && v !== "") {
      const n = Number(v);
      if (n > 0) setHeight(String(Math.round((n / image.naturalWidth) * image.naturalHeight)));
    }
  };
  const onHeightChange = (v: string) => {
    setHeight(v);
    if (lockAspect && image && v !== "") {
      const n = Number(v);
      if (n > 0) setWidth(String(Math.round((n / image.naturalHeight) * image.naturalWidth)));
    }
  };

  return (
    <div className="space-y-4">
      {/* File input with drag-drop */}
      <Card>
        <CardContent className="p-4 space-y-3">
          <div
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={onDrop}
            className={`border-2 border-dashed rounded-lg p-8 text-center ${dragOver ? "border-primary bg-primary/5" : "border-border"}`}
          >
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => onFile(e.target.files?.[0])} />
            <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()}>Choose image</Button>
            <p className="text-xs text-muted-foreground mt-2">or drag-drop, or paste (Ctrl+V)</p>
          </div>
          {image && (
            <div className="flex items-center gap-3 flex-wrap">
              <Badge variant="outline">Original: {image.naturalWidth} × {image.naturalHeight}px</Badge>
              <Badge variant="outline">{formatFileSize(image.naturalWidth * image.naturalHeight * 4)}</Badge>
            </div>
          )}
        </CardContent>
      </Card>

      {image && (
        <>
          {/* Mode selector */}
          <Card>
            <CardContent className="p-4 space-y-3">
              <div className="flex flex-wrap gap-2">
                {(["pixels", "percent", "target-size", "preset"] as ResizeMode[]).map((m) => (
                  <Button key={m} size="sm" variant={mode === m ? "default" : "outline"} onClick={() => setMode(m)}>
                    {m === "target-size" ? "Target KB" : m.charAt(0).toUpperCase() + m.slice(1)}
                  </Button>
                ))}
              </div>

              {/* Mode-specific inputs */}
              {mode === "pixels" && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <div><Label className="text-xs text-muted-foreground">Width (px)</Label><Input type="number" value={width} onChange={(e) => onWidthChange(e.target.value)} /></div>
                  <div><Label className="text-xs text-muted-foreground">Height (px)</Label><Input type="number" value={height} onChange={(e) => onHeightChange(e.target.value)} /></div>
                  <div className="flex items-end gap-2 pb-1"><Switch checked={lockAspect} onCheckedChange={setLockAspect} id="lock" /><Label htmlFor="lock" className="text-xs cursor-pointer">Lock ratio</Label></div>
                  <div className="flex items-end gap-2 pb-1"><Switch checked={preventEnlarge} onCheckedChange={setPreventEnlarge} id="noenlarge" /><Label htmlFor="noenlarge" className="text-xs cursor-pointer">No enlarge</Label></div>
                </div>
              )}

              {mode === "percent" && (
                <div className="grid grid-cols-2 gap-2">
                  <div><Label className="text-xs text-muted-foreground">Scale %</Label><Input type="number" value={scalePercent} onChange={(e) => setScalePercent(e.target.value)} placeholder="50" /></div>
                  <div className="flex items-end gap-2 pb-1"><Switch checked={preventEnlarge} onCheckedChange={setPreventEnlarge} id="noenlarge2" /><Label htmlFor="noenlarge2" className="text-xs cursor-pointer">No enlarge</Label></div>
                </div>
              )}

              {mode === "target-size" && (
                <div><Label className="text-xs text-muted-foreground">Target file size (KB)</Label><Input type="number" value={targetSizeKB} onChange={(e) => setTargetSizeKB(e.target.value)} placeholder="100" /></div>
              )}

              {mode === "preset" && (
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">Social media presets</Label>
                  <div className="flex flex-wrap gap-2">
                    {SOCIAL_PRESETS.map((p) => (
                      <Button key={p.label} size="sm" variant={selectedPreset === p.label ? "default" : "outline"} onClick={() => setSelectedPreset(p.label)} title={`${p.platform} — ${p.useCase}`}>
                        {p.label}
                      </Button>
                    ))}
                  </div>
                  <Label className="text-xs text-muted-foreground mt-2">Generic presets</Label>
                  <div className="flex flex-wrap gap-2">
                    {GENERIC_PRESETS.map((p) => (
                      <Button key={p.label} size="sm" variant={selectedPreset === p.label ? "default" : "outline"} onClick={() => setSelectedPreset(p.label)}>
                        {p.label}
                      </Button>
                    ))}
                  </div>
                </div>
              )}

              {/* Format + quality (blueprint §5: "Output JPG/PNG/WebP with quality slider") */}
              <div className="flex flex-wrap gap-3 items-end">
                <div>
                  <Label className="text-xs text-muted-foreground">Format</Label>
                  <select value={format} onChange={(e) => setFormat(e.target.value as OutputFormat)} className="h-9 rounded-md border bg-background px-3 text-sm">
                    <option value="image/png">PNG (lossless, alpha)</option>
                    <option value="image/jpeg">JPEG (small, no alpha)</option>
                    <option value="image/webp">WebP (best ratio, alpha)</option>
                  </select>
                </div>
                {format !== "image/png" && (
                  <div>
                    <Label className="text-xs text-muted-foreground">Quality: {Math.round(quality * 100)}%</Label>
                    <Input type="range" min={10} max={100} value={Math.round(quality * 100)} onChange={(e) => setQuality(Number(e.target.value) / 100)} className="w-32" />
                  </div>
                )}
              </div>

              <div className="flex gap-2">
                <Button size="sm" onClick={applyResize}>Resize</Button>
                <Button variant="outline" size="sm" onClick={download} disabled={!previewUrl}>Download</Button>
                <Button variant="ghost" size="sm" onClick={shareUrl} disabled={!result || "error" in (result ?? {})}>Share URL</Button>
              </div>
            </CardContent>
          </Card>

          {/* Result info (blueprint §7: "Live preview with before/after dimensions + size estimate") */}
          {result && !("error" in result) && (
            <Card>
              <CardContent className="p-4 space-y-2">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                  <div><p className="text-xs text-muted-foreground">Original</p><p className="font-bold">{image.naturalWidth} × {image.naturalHeight}</p></div>
                  <div><p className="text-xs text-muted-foreground">Resized</p><p className="font-bold text-primary">{result.width} × {result.height}</p></div>
                  <div><p className="text-xs text-muted-foreground">Scale</p><p className="font-bold">{(result.scale * 100).toFixed(0)}%</p></div>
                  <div><p className="text-xs text-muted-foreground">Est. size</p><p className="font-bold">{formatFileSize(result.estimatedSizeBytes)}</p></div>
                </div>
                {result.downscaleSteps.length > 1 && (
                  <p className="text-xs text-muted-foreground">Multi-step downscale: {result.downscaleSteps.length} steps for quality preservation.</p>
                )}
                {result.warnings.map((w, i) => (
                  <p key={i} className="text-xs text-yellow-700 dark:text-yellow-400">⚠️ {w}</p>
                ))}
              </CardContent>
            </Card>
          )}

          <canvas ref={canvasRef} className="hidden" />
          {previewUrl && (
            <Card>
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground mb-2">Preview</p>
                <img src={previewUrl} alt="Resized preview" className="max-w-full rounded-md border" />
              </CardContent>
            </Card>
          )}
        </>
      )}

      {error && <ErrorBanner message={error} />}
      <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground"><strong className="text-foreground">Privacy:</strong> all resizing runs locally via Canvas API. No upload. Multi-step downscale for best quality.</p></CardContent></Card>
    </div>
  );
}
