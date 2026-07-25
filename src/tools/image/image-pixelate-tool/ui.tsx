"use client";

import React, { useState, useCallback, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { ErrorBanner, DownloadButton } from "../../_shared";
import {
  applyToRgba,
  detectRegions,
  buildConfirmPrompt,
  buildPixelateFilename,
  validatePixelateOptions,
  DEFAULT_OPTIONS,
  type PixelateOptions,
  type PixelateRegion,
  type PixelateMode,
  type SelectionShape,
} from "./logic";
import { toast } from "sonner";

interface DragState { startX: number; startY: number; endX: number; endY: number; }

export default function ImagePixelateTool() {
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [inputName, setInputName] = useState("image.png");
  const [opts, setOpts] = useState<PixelateOptions>(DEFAULT_OPTIONS);
  const [shape, setShape] = useState<SelectionShape>("rect");
  const [regions, setRegions] = useState<PixelateRegion[]>([]);
  const [drag, setDrag] = useState<DragState | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const update = <K extends keyof PixelateOptions>(key: K, value: PixelateOptions[K]) =>
    setOpts((p) => ({ ...p, [key]: value }));

  const onFile = useCallback((file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) { setError("Please choose an image file"); return; }
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => { setImage(img); setInputName(file.name); setError(null); setPreviewUrl(null); setRegions([]); };
    img.onerror = () => setError("Could not load image");
    img.src = url;
  }, []);

  const drawOverlay = useCallback(() => {
    if (!image || !overlayRef.current) return;
    const canvas = overlayRef.current;
    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = "rgba(255, 0, 0, 0.9)";
    ctx.fillStyle = "rgba(255, 0, 0, 0.2)";
    ctx.lineWidth = 2;
    regions.forEach((r) => {
      const { x0, y0, x1, y1 } = r.rect;
      if (r.shape === "rect") ctx.strokeRect(x0, y0, x1 - x0, y1 - y0);
      else {
        ctx.beginPath();
        ctx.ellipse((x0 + x1) / 2, (y0 + y1) / 2, (x1 - x0) / 2, (y1 - y0) / 2, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      }
    });
    if (drag) {
      const x = Math.min(drag.startX, drag.endX);
      const y = Math.min(drag.startY, drag.endY);
      const w = Math.abs(drag.endX - drag.startX);
      const h = Math.abs(drag.endY - drag.startY);
      ctx.strokeStyle = "rgba(0, 255, 0, 0.9)";
      if (shape === "rect") ctx.strokeRect(x, y, w, h);
      else { ctx.beginPath(); ctx.ellipse(x + w / 2, y + h / 2, w / 2, h / 2, 0, 0, Math.PI * 2); ctx.stroke(); }
    }
  }, [image, regions, drag, shape]);

  React.useEffect(() => { drawOverlay(); }, [drawOverlay]);

  const onMouseDown = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!image || !overlayRef.current) return;
    const canvas = overlayRef.current;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const x = Math.round((e.clientX - rect.left) * scaleX);
    const y = Math.round((e.clientY - rect.top) * scaleY);
    setDrag({ startX: x, startY: y, endX: x, endY: y });
  }, [image]);

  const onMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!drag || !overlayRef.current) return;
    const canvas = overlayRef.current;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    setDrag({ ...drag, endX: Math.round((e.clientX - rect.left) * scaleX), endY: Math.round((e.clientY - rect.top) * scaleY) });
  }, [drag]);

  const onMouseUp = useCallback(() => {
    if (!drag) return;
    const x0 = Math.min(drag.startX, drag.endX);
    const y0 = Math.min(drag.startY, drag.endY);
    const x1 = Math.max(drag.startX, drag.endX);
    const y1 = Math.max(drag.startY, drag.endY);
    if (x1 - x0 >= 5 && y1 - y0 >= 5) {
      setRegions((prev) => [...prev, { shape, rect: { x0, y0, x1, y1 } }]);
    }
    setDrag(null);
  }, [drag, shape]);

  const autoDetect = useCallback(() => {
    if (!image) return;
    const found = detectRegions(image.naturalWidth, image.naturalHeight, opts.autoSensitivity);
    setRegions((prev) => [...prev, ...found]);
    toast.success(`Detected ${found.length} candidate regions`);
  }, [image, opts.autoSensitivity]);

  const apply = useCallback(() => {
    if (!image || !canvasRef.current) return;
    const v = validatePixelateOptions(opts, image.naturalWidth, image.naturalHeight);
    if ("error" in v) { setError(v.error); return; }
    setError(null);
    const canvas = canvasRef.current;
    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(image, 0, 0);
    const data = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const result = applyToRgba(data.data, canvas.width, canvas.height, opts, regions);
    data.data.set(result);
    ctx.putImageData(data, 0, 0);
    canvas.toBlob((blob) => {
      if (!blob) return;
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      setPreviewUrl(URL.createObjectURL(blob));
    }, "image/png");
  }, [image, opts, regions, previewUrl]);

  const requestApply = useCallback(() => {
    setShowConfirm(true);
  }, []);

  const confirmApply = useCallback(() => {
    setShowConfirm(false);
    apply();
    toast.success("Pixelation applied");
  }, [apply]);

  const download = useCallback(() => {
    if (!canvasRef.current) return;
    canvasRef.current.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = buildPixelateFilename(inputName, opts.mode); a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      toast.success("Image downloaded");
    }, "image/png");
  }, [inputName, opts.mode]);

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4 space-y-3">
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => onFile(e.target.files?.[0])} />
          <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()}>Choose image</Button>
        </CardContent>
      </Card>

      {image && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <div>
                <Label className="text-xs text-muted-foreground">Block size: {opts.blockSize}px</Label>
                <Slider value={[opts.blockSize]} onValueChange={(v) => update("blockSize", v[0]!)} min={2} max={80} step={1} />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Feather: {opts.feather}</Label>
                <Slider value={[opts.feather]} onValueChange={(v) => update("feather", v[0]!)} min={0} max={100} step={5} />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Auto-sensitivity: {opts.autoSensitivity}</Label>
                <Slider value={[opts.autoSensitivity]} onValueChange={(v) => update("autoSensitivity", v[0]!)} min={0} max={100} step={5} />
              </div>
            </div>
            <div className="flex flex-wrap items-end gap-3">
              <div>
                <Label className="text-xs text-muted-foreground">Mode</Label>
                <select value={opts.mode} onChange={(e) => update("mode", e.target.value as PixelateMode)} className="h-9 rounded-md border bg-background px-3 text-sm">
                  <option value="mosaic">Mosaic (avg color)</option>
                  <option value="blur">Blur</option>
                  <option value="solid">Solid block</option>
                </select>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Selection shape</Label>
                <select value={shape} onChange={(e) => setShape(e.target.value as SelectionShape)} className="h-9 rounded-md border bg-background px-3 text-sm">
                  <option value="rect">Rectangle</option>
                  <option value="ellipse">Ellipse</option>
                </select>
              </div>
              {opts.mode === "solid" && (
                <div>
                  <Label className="text-xs text-muted-foreground">Solid color</Label>
                  <input type="color" value={`#${[opts.solidColor.r, opts.solidColor.g, opts.solidColor.b].map((v) => v.toString(16).padStart(2, "0")).join("")}`}
                    onChange={(e) => {
                      const h = e.target.value.replace("#", "");
                      update("solidColor", { r: parseInt(h.slice(0, 2), 16), g: parseInt(h.slice(2, 4), 16), b: parseInt(h.slice(4, 6), 16) });
                    }} className="block h-9 w-16 rounded border" />
                </div>
              )}
              <Button variant="outline" size="sm" onClick={autoDetect}>Auto-detect</Button>
              <Button variant="ghost" size="sm" onClick={() => setRegions([])} disabled={regions.length === 0}>Clear regions</Button>
            </div>
            {regions.length > 0 && <p className="text-xs text-muted-foreground">{regions.length} region(s) selected. Empty selection = whole image.</p>}
            <div className="flex gap-2 flex-wrap">
              <Button size="sm" onClick={requestApply}>Pixelate</Button>
              <Button variant="outline" size="sm" onClick={download} disabled={!previewUrl}>Download</Button>
              <DownloadButton getText={async () => { await new Promise((r) => setTimeout(r, 0)); return ""; }} filename={buildPixelateFilename(inputName, opts.mode)} disabled={!previewUrl} mime="image/png" label="Download (shared)" />
            </div>
          </CardContent>
        </Card>
      )}

      {image && (
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground mb-2">Drag on the image to select regions to pixelate.</p>
            <div className="relative inline-block">
              <img src={image.src} alt="Source" className="max-w-full rounded-md border" />
              <canvas ref={overlayRef} onMouseDown={onMouseDown} onMouseMove={onMouseMove} onMouseUp={onMouseUp} onMouseLeave={onMouseUp}
                className="absolute inset-0 w-full h-full cursor-crosshair" />
            </div>
          </CardContent>
        </Card>
      )}

      {showConfirm && (
        <Card>
          <CardContent className="p-4 space-y-2">
            <p className="text-sm">{buildConfirmPrompt(regions, opts.mode)}</p>
            <div className="flex gap-2">
              <Button size="sm" onClick={confirmApply}>Yes, pixelate</Button>
              <Button variant="ghost" size="sm" onClick={() => setShowConfirm(false)}>Cancel</Button>
            </div>
          </CardContent>
        </Card>
      )}

      <canvas ref={canvasRef} className="hidden" />
      {previewUrl && (
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground mb-2">Preview</p>
            <img src={previewUrl} alt="Pixelated preview" className="max-w-full rounded-md border" />
          </CardContent>
        </Card>
      )}
      {error && <ErrorBanner message={error} />}
      <Card>
        <CardContent className="p-4">
          <p className="text-xs text-muted-foreground"><strong className="text-foreground">Privacy:</strong> pixelation runs locally via the Canvas API.</p>
        </CardContent>
      </Card>
    </div>
  );
}
