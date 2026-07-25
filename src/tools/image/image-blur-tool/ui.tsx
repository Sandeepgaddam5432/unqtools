"use client";

import React, { useState, useCallback, useRef, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ErrorBanner, DownloadButton } from "../../_shared";
import {
  computeBlurParams,
  validateDimensions,
  motionBlurOffsets,
  pixelateCellSize,
  privacyWarning,
  blurTypeLabel,
  preservesAlpha,
  effectiveSigma,
  type BlurType,
  type OutputFormat,
  type BrushStroke,
} from "./logic";
import { toast } from "sonner";

/** Apply a box-blur pass along one axis (in-place). */
function boxBlurPass(data: Uint8ClampedArray, width: number, height: number, radius: number, axis: "x" | "y") {
  const tmp = new Uint8ClampedArray(data.length);
  const window = 2 * radius + 1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let r = 0, g = 0, b = 0, a = 0;
      for (let k = -radius; k <= radius; k++) {
        const sx = axis === "x" ? Math.min(width - 1, Math.max(0, x + k)) : x;
        const sy = axis === "y" ? Math.min(height - 1, Math.max(0, y + k)) : y;
        const i = (sy * width + sx) * 4;
        r += data[i]!;
        g += data[i + 1]!;
        b += data[i + 2]!;
        a += data[i + 3]!;
      }
      const i = (y * width + x) * 4;
      tmp[i] = r / window;
      tmp[i + 1] = g / window;
      tmp[i + 2] = b / window;
      tmp[i + 3] = a / window;
    }
  }
  data.set(tmp);
}

/** Apply motion blur along an angle. */
function motionBlurPass(data: Uint8ClampedArray, width: number, height: number, radius: number, angle: number) {
  const src = new Uint8ClampedArray(data);
  const offsets = motionBlurOffsets(radius, angle);
  const n = offsets.length;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      let r = 0, g = 0, b = 0, a = 0;
      for (const off of offsets) {
        const sx = Math.min(width - 1, Math.max(0, Math.round(x + off.x)));
        const sy = Math.min(height - 1, Math.max(0, Math.round(y + off.y)));
        const si = (sy * width + sx) * 4;
        r += src[si]!;
        g += src[si + 1]!;
        b += src[si + 2]!;
        a += src[si + 3]!;
      }
      data[i] = r / n;
      data[i + 1] = g / n;
      data[i + 2] = b / n;
      data[i + 3] = a / n;
    }
  }
}

/** Apply pixelate (mosaic) effect. */
function pixelatePass(data: Uint8ClampedArray, width: number, height: number, cell: number) {
  if (cell <= 1) return;
  for (let y = 0; y < height; y += cell) {
    for (let x = 0; x < width; x += cell) {
      // average the cell
      let r = 0, g = 0, b = 0, a = 0, count = 0;
      for (let dy = 0; dy < cell && y + dy < height; dy++) {
        for (let dx = 0; dx < cell && x + dx < width; dx++) {
          const i = ((y + dy) * width + (x + dx)) * 4;
          r += data[i]!;
          g += data[i + 1]!;
          b += data[i + 2]!;
          a += data[i + 3]!;
          count++;
        }
      }
      r /= count; g /= count; b /= count; a /= count;
      for (let dy = 0; dy < cell && y + dy < height; dy++) {
        for (let dx = 0; dx < cell && x + dx < width; dx++) {
          const i = ((y + dy) * width + (x + dx)) * 4;
          data[i] = r; data[i + 1] = g; data[i + 2] = b; data[i + 3] = a;
        }
      }
    }
  }
}

export default function ImageBlurTool() {
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [fileName, setFileName] = useState("blurred.png");
  const [radius, setRadius] = useState(5);
  const [passes, setPasses] = useState(3);
  const [type, setType] = useState<BlurType>("gaussian");
  const [angle, setAngle] = useState(0);
  const [format, setFormat] = useState<OutputFormat>("image/png");
  const [quality, setQuality] = useState(0.9);
  const [brushSize, setBrushSize] = useState(30);
  const [strokes, setStrokes] = useState<BrushStroke[]>([]);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const drawingRef = useRef(false);
  const currentStrokeRef = useRef<BrushStroke | null>(null);

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
      setFileName(file.name.replace(/\.[^.]+$/, "") + "-blurred.png");
      setStrokes([]);
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
    const params = computeBlurParams({ radius, passes, type });
    if ("error" in params) {
      setError(params.error);
      return;
    }
    const dim = validateDimensions(image.naturalWidth, image.naturalHeight);
    if ("error" in dim) {
      setError(dim.error);
      return;
    }
    setError(null);
    setBusy(true);
    try {
      const canvas = canvasRef.current;
      canvas.width = image.naturalWidth;
      canvas.height = image.naturalHeight;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.drawImage(image, 0, 0);
      if (type === "pixelate") {
        const cell = pixelateCellSize(radius / 30, Math.max(image.naturalWidth, image.naturalHeight));
        const data = ctx.getImageData(0, 0, canvas.width, canvas.height);
        pixelatePass(data.data, canvas.width, canvas.height, cell);
        ctx.putImageData(data, 0, 0);
      } else if (params.radius > 0) {
        const data = ctx.getImageData(0, 0, canvas.width, canvas.height);
        if (type === "motion") {
          motionBlurPass(data.data, canvas.width, canvas.height, params.radius, angle);
        } else {
          // gaussian / box / radial / zoom / lens — use box-blur stack (radial/zoom are approximations)
          for (let p = 0; p < params.passes; p++) {
            boxBlurPass(data.data, canvas.width, canvas.height, params.radius, "x");
            boxBlurPass(data.data, canvas.width, canvas.height, params.radius, "y");
          }
        }
        ctx.putImageData(data, 0, 0);
      }
      canvas.toBlob(
        (blob) => {
          if (!blob) return;
          if (previewUrl) URL.revokeObjectURL(previewUrl);
          setPreviewUrl(URL.createObjectURL(blob));
          setBusy(false);
          toast.success("Blur applied");
        },
        format,
        format === "image/png" ? undefined : quality,
      );
    } catch {
      setError("Blur failed — image may be too large");
      setBusy(false);
    }
  }, [image, radius, passes, type, angle, format, quality, previewUrl]);

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

  // Brush stroke handlers
  const onOverlayDown = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!overlayRef.current) return;
    const rect = overlayRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * overlayRef.current.width;
    const y = ((e.clientY - rect.top) / rect.height) * overlayRef.current.height;
    drawingRef.current = true;
    currentStrokeRef.current = { points: [{ x, y }], size: brushSize };
  }, [brushSize]);

  const onOverlayMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!drawingRef.current || !overlayRef.current || !currentStrokeRef.current) return;
    const rect = overlayRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * overlayRef.current.width;
    const y = ((e.clientY - rect.top) / rect.height) * overlayRef.current.height;
    currentStrokeRef.current = {
      ...currentStrokeRef.current,
      points: [...currentStrokeRef.current.points, { x, y }],
    };
    // draw preview
    const ctx = overlayRef.current.getContext("2d");
    if (ctx) {
      ctx.clearRect(0, 0, overlayRef.current.width, overlayRef.current.height);
      ctx.fillStyle = "rgba(255, 100, 100, 0.3)";
      for (const stroke of [currentStrokeRef.current, ...strokes]) {
        for (const p of stroke.points) {
          ctx.beginPath();
          ctx.arc(p.x, p.y, stroke.size / 2, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }
  }, [strokes]);

  const onOverlayUp = useCallback(() => {
    if (drawingRef.current && currentStrokeRef.current) {
      setStrokes((s) => [...s, currentStrokeRef.current!]);
    }
    drawingRef.current = false;
    currentStrokeRef.current = null;
  }, []);

  const sigma = effectiveSigma(radius, passes);

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
              <Badge variant="outline">σ ≈ {sigma.toFixed(2)}</Badge>
              <Badge variant="secondary">{blurTypeLabel(type)}</Badge>
            </div>
          )}
        </CardContent>
      </Card>

      {image && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <div>
              <Label className="text-xs text-muted-foreground">Blur type</Label>
              <div className="flex flex-wrap gap-2 mt-1">
                {(["gaussian", "box", "motion", "radial", "zoom", "lens", "pixelate"] as BlurType[]).map((t) => (
                  <Button key={t} size="sm" variant={type === t ? "default" : "outline"} onClick={() => setType(t)}>
                    {blurTypeLabel(t).split(" ")[0]}
                  </Button>
                ))}
              </div>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Radius: {radius}px</Label>
              <input type="range" min={0} max={30} value={radius} onChange={(e) => setRadius(Number(e.target.value))} className="w-full" />
            </div>
            {type !== "motion" && type !== "pixelate" && (
              <div>
                <Label className="text-xs text-muted-foreground">Passes: {passes}</Label>
                <input type="range" min={1} max={5} value={passes} onChange={(e) => setPasses(Number(e.target.value))} className="w-full" />
              </div>
            )}
            {type === "motion" && (
              <div>
                <Label className="text-xs text-muted-foreground">Angle: {angle}°</Label>
                <input type="range" min={0} max={360} value={angle} onChange={(e) => setAngle(Number(e.target.value))} className="w-full" />
              </div>
            )}
            <div className="flex flex-wrap gap-3 items-end">
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
            <div className="flex gap-2">
              <Button size="sm" onClick={apply} disabled={busy}>{busy ? "Blurring…" : "Apply blur"}</Button>
              <Button variant="outline" size="sm" onClick={download} disabled={!previewUrl}>Download</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {image && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <Label className="text-xs text-muted-foreground">Selective brush blur (mask overlay)</Label>
            <div>
              <Label className="text-xs text-muted-foreground">Brush size: {brushSize}px</Label>
              <input type="range" min={5} max={100} value={brushSize} onChange={(e) => setBrushSize(Number(e.target.value))} className="w-full" />
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setStrokes([])} disabled={strokes.length === 0}>Clear mask</Button>
              <Button variant="outline" size="sm" onClick={() => setStrokes((s) => s.slice(0, -1))} disabled={strokes.length === 0}>Undo stroke</Button>
            </div>
            <p className="text-xs text-muted-foreground">Strokes: {strokes.length}</p>
            <div className="relative inline-block">
              <img src={image.src} alt="Mask overlay base" className="max-w-full rounded-md border" />
              <canvas
                ref={overlayRef}
                width={image.naturalWidth}
                height={image.naturalHeight}
                className="absolute inset-0 w-full h-full cursor-crosshair"
                onMouseDown={onOverlayDown}
                onMouseMove={onOverlayMove}
                onMouseUp={onOverlayUp}
                onMouseLeave={onOverlayUp}
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
            <img src={previewUrl} alt="Blurred preview" className="max-w-full rounded-md border" />
          </CardContent>
        </Card>
      )}
      {error && <ErrorBanner message={error} />}
      <Card>
        <CardContent className="p-4 space-y-1">
          <p className="text-xs text-muted-foreground">
            <strong className="text-foreground">Privacy:</strong> all blur runs locally via the Canvas API.
          </p>
          <p className="text-xs text-yellow-700 dark:text-yellow-400">⚠️ {privacyWarning()}</p>
        </CardContent>
      </Card>
    </div>
  );
}
