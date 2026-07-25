"use client";

import React, { useState, useCallback, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { ErrorBanner, DownloadButton } from "../../_shared";
import {
  computeOutputSize,
  parseHex,
  rgbToHex,
  padToSquare,
  padToAspect,
  buildBorderFilename,
  validateBorderOptions,
  defaultOptions,
  ASPECT_PRESETS,
  PRESET_THIN,
  PRESET_POLAROID,
  PRESET_FRAME,
  type BorderOptions,
  type BorderStyle,
  type AspectPreset,
} from "./logic";
import { toast } from "sonner";

export default function ImageBorderAdder() {
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [inputName, setInputName] = useState("image.png");
  const [format, setFormat] = useState("image/png");
  const [opts, setOpts] = useState<BorderOptions>(PRESET_FRAME);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const update = <K extends keyof BorderOptions>(key: K, value: BorderOptions[K]) =>
    setOpts((p) => ({ ...p, [key]: value }));
  const updateSide = (k: "top" | "right" | "bottom" | "left", v: number) =>
    setOpts((p) => ({ ...p, sides: { ...p.sides, [k]: v } }));

  const onFile = useCallback((file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) { setError("Please choose an image file"); return; }
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => { setImage(img); setInputName(file.name); setError(null); setPreviewUrl(null); };
    img.onerror = () => setError("Could not load image");
    img.src = url;
  }, []);

  const apply = useCallback(() => {
    if (!image || !canvasRef.current) return;
    const v = validateBorderOptions(opts);
    if ("error" in v) { setError(v.error); return; }
    setError(null);
    const canvas = canvasRef.current;
    const { width, height } = computeOutputSize(image.naturalWidth, image.naturalHeight, opts);
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    // Background fill
    ctx.fillStyle = rgbToHex(opts.bgColor);
    ctx.fillRect(0, 0, width, height);
    // Drop shadow (simulated with a rect)
    if (opts.shadow.enabled) {
      ctx.save();
      ctx.shadowOffsetX = opts.shadow.offsetX;
      ctx.shadowOffsetY = opts.shadow.offsetY;
      ctx.shadowBlur = opts.shadow.blur;
      ctx.shadowColor = rgbToHex(opts.shadow.color);
      ctx.fillStyle = rgbToHex(opts.color);
      ctx.fillRect(opts.sides.left, opts.sides.top, image.naturalWidth, image.naturalHeight);
      ctx.restore();
    }
    // Border fill
    if (opts.style === "gradient") {
      const grad = ctx.createLinearGradient(
        0, 0,
        Math.cos(opts.gradientAngle * Math.PI / 180) * width,
        Math.sin(opts.gradientAngle * Math.PI / 180) * height,
      );
      grad.addColorStop(0, rgbToHex(opts.color));
      grad.addColorStop(1, rgbToHex(opts.gradientTo));
      ctx.fillStyle = grad;
    } else {
      ctx.fillStyle = rgbToHex(opts.color);
    }
    // Top
    ctx.fillRect(0, 0, width, opts.sides.top);
    // Bottom
    ctx.fillRect(0, height - opts.sides.bottom, width, opts.sides.bottom);
    // Left
    ctx.fillRect(0, opts.sides.top, opts.sides.left, height - opts.sides.top - opts.sides.bottom);
    // Right
    ctx.fillRect(width - opts.sides.right, opts.sides.top, opts.sides.right, height - opts.sides.top - opts.sides.bottom);
    // Image
    ctx.drawImage(image, opts.sides.left, opts.sides.top);
    // Inner border
    if (opts.inner.enabled && opts.inner.width > 0) {
      ctx.strokeStyle = rgbToHex(opts.inner.color);
      ctx.lineWidth = opts.inner.width * 2;
      ctx.strokeRect(opts.sides.left, opts.sides.top, image.naturalWidth, image.naturalHeight);
    }
    canvas.toBlob((blob) => {
      if (!blob) return;
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      setPreviewUrl(URL.createObjectURL(blob));
    }, format, format === "image/png" ? undefined : 0.92);
  }, [image, opts, format, previewUrl]);

  const padSquare = useCallback(() => {
    if (!image) return;
    const { opts: padded } = padToSquare(image.naturalWidth, image.naturalHeight, opts.bgColor);
    setOpts(padded);
    toast.success("Padded to square");
  }, [image, opts.bgColor]);

  const padAspect = useCallback((a: AspectPreset) => {
    if (!image) return;
    const { opts: padded } = padToAspect(image.naturalWidth, image.naturalHeight, a, opts.bgColor);
    setOpts(padded);
    toast.success(`Padded to ${a}`);
  }, [image, opts.bgColor]);

  const download = useCallback(() => {
    if (!canvasRef.current) return;
    canvasRef.current.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = buildBorderFilename(inputName, format); a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      toast.success("Image downloaded");
    }, format, format === "image/png" ? undefined : 0.92);
  }, [inputName, format]);

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
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={() => setOpts(PRESET_THIN)}>Thin</Button>
              <Button variant="outline" size="sm" onClick={() => setOpts(PRESET_POLAROID)}>Polaroid</Button>
              <Button variant="outline" size="sm" onClick={() => setOpts(PRESET_FRAME)}>Frame</Button>
              <Button variant="outline" size="sm" onClick={padSquare}>Pad to square</Button>
              <select onChange={(e) => padAspect(e.target.value as AspectPreset)} className="h-9 rounded-md border bg-background px-3 text-sm" defaultValue="">
                <option value="" disabled>Pad to aspect…</option>
                {ASPECT_PRESETS.map((a) => <option key={a.value} value={a.value}>{a.label}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div><Label className="text-xs text-muted-foreground">Top: {opts.sides.top}px</Label><Slider value={[opts.sides.top]} onValueChange={(v) => updateSide("top", v[0]!)} min={0} max={500} step={1} /></div>
              <div><Label className="text-xs text-muted-foreground">Right: {opts.sides.right}px</Label><Slider value={[opts.sides.right]} onValueChange={(v) => updateSide("right", v[0]!)} min={0} max={500} step={1} /></div>
              <div><Label className="text-xs text-muted-foreground">Bottom: {opts.sides.bottom}px</Label><Slider value={[opts.sides.bottom]} onValueChange={(v) => updateSide("bottom", v[0]!)} min={0} max={500} step={1} /></div>
              <div><Label className="text-xs text-muted-foreground">Left: {opts.sides.left}px</Label><Slider value={[opts.sides.left]} onValueChange={(v) => updateSide("left", v[0]!)} min={0} max={500} step={1} /></div>
            </div>
            <div className="flex flex-wrap items-end gap-3">
              <div>
                <Label className="text-xs text-muted-foreground">Style</Label>
                <select value={opts.style} onChange={(e) => update("style", e.target.value as BorderStyle)} className="h-9 rounded-md border bg-background px-3 text-sm">
                  <option value="solid">Solid</option>
                  <option value="gradient">Gradient</option>
                  <option value="mirror">Mirror</option>
                </select>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Border color</Label>
                <input type="color" value={rgbToHex(opts.color)} onChange={(e) => update("color", parseHex(e.target.value) || opts.color)} className="block h-9 w-16 rounded border" />
              </div>
              {opts.style === "gradient" && <>
                <div>
                  <Label className="text-xs text-muted-foreground">Gradient to</Label>
                  <input type="color" value={rgbToHex(opts.gradientTo)} onChange={(e) => update("gradientTo", parseHex(e.target.value) || opts.gradientTo)} className="block h-9 w-16 rounded border" />
                </div>
                <div className="w-32">
                  <Label className="text-xs text-muted-foreground">Angle: {opts.gradientAngle}°</Label>
                  <Slider value={[opts.gradientAngle]} onValueChange={(v) => update("gradientAngle", v[0]!)} min={0} max={360} step={15} />
                </div>
              </>}
              <div>
                <Label className="text-xs text-muted-foreground">BG color</Label>
                <input type="color" value={rgbToHex(opts.bgColor)} onChange={(e) => update("bgColor", parseHex(e.target.value) || opts.bgColor)} className="block h-9 w-16 rounded border" />
              </div>
            </div>
            <div className="border-t pt-3 space-y-2">
              <div className="flex items-center gap-2">
                <Switch checked={opts.inner.enabled} onCheckedChange={(v) => update("inner", { ...opts.inner, enabled: v })} id="inner" />
                <Label htmlFor="inner" className="text-sm cursor-pointer">Inner border</Label>
              </div>
              {opts.inner.enabled && (
                <div className="flex flex-wrap gap-3">
                  <div className="w-32"><Label className="text-xs text-muted-foreground">Width: {opts.inner.width}px</Label><Slider value={[opts.inner.width]} onValueChange={(v) => update("inner", { ...opts.inner, width: v[0]! })} min={1} max={100} step={1} /></div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Color</Label>
                    <input type="color" value={rgbToHex(opts.inner.color)} onChange={(e) => update("inner", { ...opts.inner, color: parseHex(e.target.value) || opts.inner.color })} className="block h-9 w-16 rounded border" />
                  </div>
                </div>
              )}
              <div className="flex items-center gap-2">
                <Switch checked={opts.shadow.enabled} onCheckedChange={(v) => update("shadow", { ...opts.shadow, enabled: v })} id="shadow" />
                <Label htmlFor="shadow" className="text-sm cursor-pointer">Drop shadow</Label>
              </div>
              {opts.shadow.enabled && (
                <div className="flex flex-wrap gap-3">
                  <div className="w-24"><Label className="text-xs text-muted-foreground">Offset X</Label><Input type="number" value={opts.shadow.offsetX} onChange={(e) => update("shadow", { ...opts.shadow, offsetX: Number(e.target.value) })} /></div>
                  <div className="w-24"><Label className="text-xs text-muted-foreground">Offset Y</Label><Input type="number" value={opts.shadow.offsetY} onChange={(e) => update("shadow", { ...opts.shadow, offsetY: Number(e.target.value) })} /></div>
                  <div className="w-24"><Label className="text-xs text-muted-foreground">Blur</Label><Input type="number" value={opts.shadow.blur} onChange={(e) => update("shadow", { ...opts.shadow, blur: Number(e.target.value) })} /></div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Color</Label>
                    <input type="color" value={rgbToHex(opts.shadow.color)} onChange={(e) => update("shadow", { ...opts.shadow, color: parseHex(e.target.value) || opts.shadow.color })} className="block h-9 w-16 rounded border" />
                  </div>
                </div>
              )}
            </div>
            <div className="flex flex-wrap items-end gap-3">
              <div>
                <Label className="text-xs text-muted-foreground">Format</Label>
                <select value={format} onChange={(e) => setFormat(e.target.value)} className="h-9 rounded-md border bg-background px-3 text-sm">
                  <option value="image/png">PNG</option>
                  <option value="image/jpeg">JPEG</option>
                  <option value="image/webp">WebP</option>
                </select>
              </div>
            </div>
            <div className="flex gap-2 flex-wrap">
              <Button size="sm" onClick={apply}>Add border</Button>
              <Button variant="outline" size="sm" onClick={download} disabled={!previewUrl}>Download</Button>
              <DownloadButton getText={async () => { await new Promise((r) => setTimeout(r, 0)); return ""; }} filename={buildBorderFilename(inputName, format)} disabled={!previewUrl} mime="image/png" label="Download (shared)" />
            </div>
          </CardContent>
        </Card>
      )}

      <canvas ref={canvasRef} className="hidden" />
      {previewUrl && (
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground mb-2">Preview</p>
            <img src={previewUrl} alt="Bordered preview" className="max-w-full rounded-md border" />
          </CardContent>
        </Card>
      )}
      {error && <ErrorBanner message={error} />}
      <Card>
        <CardContent className="p-4">
          <p className="text-xs text-muted-foreground"><strong className="text-foreground">Privacy:</strong> border rendering runs locally via the Canvas API.</p>
        </CardContent>
      </Card>
    </div>
  );
}
