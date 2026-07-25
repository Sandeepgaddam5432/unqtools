"use client";

import React, { useState, useCallback, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { ErrorBanner, CopyButton, DownloadButton } from "../../_shared";
import {
  computePlacement,
  computeTilePlacements,
  validateOptions,
  buildFontString,
  buildWatermarkFilename,
  serializePreset,
  parsePreset,
  DEFAULT_WATERMARK_OPTIONS,
  POSITIONS,
  BLEND_MODES,
  FONT_OPTIONS,
  type WatermarkPosition,
  type BlendMode,
  type WatermarkOptions,
} from "./logic";
import { toast } from "sonner";

export default function ImageWatermarkAdder() {
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [inputName, setInputName] = useState("image.png");
  const [format, setFormat] = useState("image/png");
  const [opts, setOpts] = useState<WatermarkOptions>(DEFAULT_WATERMARK_OPTIONS);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [presetName, setPresetName] = useState("My preset");
  const [error, setError] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const update = <K extends keyof WatermarkOptions>(key: K, value: WatermarkOptions[K]) =>
    setOpts((p) => ({ ...p, [key]: value }));

  const onFile = useCallback((file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) { setError("Please choose an image file"); return; }
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => { setImage(img); setInputName(file.name); setError(null); setPreviewUrl(null); };
    img.onerror = () => setError("Could not load image");
    img.src = url;
  }, []);

  const render = useCallback(() => {
    if (!image || !canvasRef.current) return;
    const v = validateOptions(opts);
    if ("error" in v) { setError(v.error); return; }
    setError(null);
    const canvas = canvasRef.current;
    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(image, 0, 0);
    const placements = opts.tile
      ? computeTilePlacements(canvas.width, canvas.height, opts.tileSpacing, opts.diagonal)
      : [computePlacement(canvas.width, canvas.height, opts.position, opts.padding)];
    ctx.globalCompositeOperation = opts.blendMode === "normal" ? "source-over" : (opts.blendMode as GlobalCompositeOperation);
    ctx.font = buildFontString(opts.fontFamily, opts.fontSize);
    for (const p of placements) {
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rotationRad + (opts.rotation * Math.PI) / 180);
      ctx.textAlign = p.align;
      ctx.textBaseline = "middle";
      ctx.globalAlpha = opts.opacity;
      if (opts.shadow.enabled) {
        ctx.shadowOffsetX = opts.shadow.offsetX;
        ctx.shadowOffsetY = opts.shadow.offsetY;
        ctx.shadowBlur = opts.shadow.blur;
        ctx.shadowColor = opts.shadow.color;
      }
      if (opts.outline.enabled) {
        ctx.strokeStyle = opts.outline.color;
        ctx.lineWidth = opts.outline.width;
        ctx.strokeText(opts.text, 0, 0);
      }
      ctx.fillStyle = opts.color;
      ctx.fillText(opts.text, 0, 0);
      ctx.restore();
    }
    canvas.toBlob((blob) => {
      if (!blob) return;
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      setPreviewUrl(URL.createObjectURL(blob));
    }, format, format === "image/png" ? undefined : 0.92);
  }, [image, opts, format, previewUrl]);

  const download = useCallback(() => {
    if (!canvasRef.current) return;
    canvasRef.current.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = buildWatermarkFilename(inputName, format); a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      toast.success("Image downloaded");
    }, format, format === "image/png" ? undefined : 0.92);
  }, [inputName, format]);

  const savePreset = useCallback(() => {
    try {
      localStorage.setItem(`wm-preset-${presetName}`, serializePreset(presetName, opts));
      toast.success(`Saved preset "${presetName}"`);
    } catch {
      toast.error("Could not save preset");
    }
  }, [presetName, opts]);

  const loadPreset = useCallback(() => {
    try {
      const json = localStorage.getItem(`wm-preset-${presetName}`);
      if (!json) { toast.error("Preset not found"); return; }
      const p = parsePreset(json);
      if (!p) { toast.error("Invalid preset"); return; }
      setOpts(p.options);
      toast.success(`Loaded preset "${p.name}"`);
    } catch {
      toast.error("Could not load preset");
    }
  }, [presetName]);

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
            <div>
              <Label className="text-xs text-muted-foreground">Watermark text</Label>
              <Input value={opts.text} onChange={(e) => update("text", e.target.value)} />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label className="text-xs text-muted-foreground">Position (9-grid)</Label>
                <select value={opts.position} onChange={(e) => update("position", e.target.value as WatermarkPosition)} className="h-9 rounded-md border bg-background px-3 text-sm w-full">
                  {POSITIONS.map((p) => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Font family</Label>
                <select value={opts.fontFamily} onChange={(e) => update("fontFamily", e.target.value)} className="h-9 rounded-md border bg-background px-3 text-sm w-full">
                  {FONT_OPTIONS.map((f) => <option key={f} value={f}>{f}</option>)}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div>
                <Label className="text-xs text-muted-foreground">Opacity: {Math.round(opts.opacity * 100)}%</Label>
                <Slider value={[opts.opacity * 100]} onValueChange={(v) => update("opacity", v[0]! / 100)} min={0} max={100} step={5} />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Font size: {opts.fontSize}px</Label>
                <Input type="number" value={opts.fontSize} onChange={(e) => update("fontSize", Number(e.target.value))} />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Rotation: {opts.rotation}°</Label>
                <Input type="number" value={opts.rotation} onChange={(e) => update("rotation", Number(e.target.value))} />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Padding: {opts.padding}px</Label>
                <Input type="number" value={opts.padding} onChange={(e) => update("padding", Number(e.target.value))} />
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-4">
              <div>
                <Label className="text-xs text-muted-foreground">Color</Label>
                <input type="color" value={opts.color} onChange={(e) => update("color", e.target.value)} className="block h-9 w-16 rounded border" />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Blend mode</Label>
                <select value={opts.blendMode} onChange={(e) => update("blendMode", e.target.value as BlendMode)} className="h-9 rounded-md border bg-background px-3 text-sm">
                  {BLEND_MODES.map((m) => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Format</Label>
                <select value={format} onChange={(e) => setFormat(e.target.value)} className="h-9 rounded-md border bg-background px-3 text-sm">
                  <option value="image/png">PNG</option>
                  <option value="image/jpeg">JPEG</option>
                  <option value="image/webp">WebP</option>
                </select>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-2">
                <Switch checked={opts.tile} onCheckedChange={(v) => update("tile", v)} id="tile" />
                <Label htmlFor="tile" className="text-sm cursor-pointer">Tile</Label>
              </div>
              {opts.tile && <>
                <div>
                  <Label className="text-xs text-muted-foreground">Tile spacing: {opts.tileSpacing}px</Label>
                  <Input type="number" value={opts.tileSpacing} onChange={(e) => update("tileSpacing", Number(e.target.value))} className="w-28" />
                </div>
                <div className="flex items-center gap-2">
                  <Switch checked={opts.diagonal} onCheckedChange={(v) => update("diagonal", v)} id="diag" />
                  <Label htmlFor="diag" className="text-sm cursor-pointer">Diagonal</Label>
                </div>
              </>}
            </div>
            <div className="border-t pt-3 space-y-2">
              <div className="flex items-center gap-2">
                <Switch checked={opts.shadow.enabled} onCheckedChange={(v) => update("shadow", { ...opts.shadow, enabled: v })} id="shadow" />
                <Label htmlFor="shadow" className="text-sm cursor-pointer">Drop shadow</Label>
              </div>
              {opts.shadow.enabled && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <Input type="number" placeholder="Offset X" value={opts.shadow.offsetX} onChange={(e) => update("shadow", { ...opts.shadow, offsetX: Number(e.target.value) })} />
                  <Input type="number" placeholder="Offset Y" value={opts.shadow.offsetY} onChange={(e) => update("shadow", { ...opts.shadow, offsetY: Number(e.target.value) })} />
                  <Input type="number" placeholder="Blur" value={opts.shadow.blur} onChange={(e) => update("shadow", { ...opts.shadow, blur: Number(e.target.value) })} />
                  <input type="color" value={opts.shadow.color} onChange={(e) => update("shadow", { ...opts.shadow, color: e.target.value })} className="h-9 w-full rounded border" />
                </div>
              )}
              <div className="flex items-center gap-2">
                <Switch checked={opts.outline.enabled} onCheckedChange={(v) => update("outline", { ...opts.outline, enabled: v })} id="outline" />
                <Label htmlFor="outline" className="text-sm cursor-pointer">Outline</Label>
              </div>
              {opts.outline.enabled && (
                <div className="grid grid-cols-2 gap-2">
                  <Input type="number" placeholder="Width" value={opts.outline.width} onChange={(e) => update("outline", { ...opts.outline, width: Number(e.target.value) })} />
                  <input type="color" value={opts.outline.color} onChange={(e) => update("outline", { ...opts.outline, color: e.target.value })} className="h-9 w-full rounded border" />
                </div>
              )}
            </div>
            <div className="flex gap-2 flex-wrap">
              <Button size="sm" onClick={render}>Apply watermark</Button>
              <Button variant="outline" size="sm" onClick={download} disabled={!previewUrl}>Download</Button>
              <DownloadButton getText={async () => { await new Promise((r) => setTimeout(r, 0)); return ""; }} filename={buildWatermarkFilename(inputName, format)} disabled={!previewUrl} mime="image/png" label="Download (shared)" />
            </div>
            <div className="flex gap-2 items-end">
              <div>
                <Label className="text-xs text-muted-foreground">Preset name</Label>
                <Input value={presetName} onChange={(e) => setPresetName(e.target.value)} className="w-40" />
              </div>
              <Button variant="outline" size="sm" onClick={savePreset}>Save preset</Button>
              <Button variant="outline" size="sm" onClick={loadPreset}>Load preset</Button>
              <CopyButton getText={() => serializePreset(presetName, opts)} label="Copy JSON" />
            </div>
          </CardContent>
        </Card>
      )}

      <canvas ref={canvasRef} className="hidden" />
      {previewUrl && (
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground mb-2">Preview</p>
            <img src={previewUrl} alt="Watermarked preview" className="max-w-full rounded-md border" />
          </CardContent>
        </Card>
      )}
      {error && <ErrorBanner message={error} />}
      <Card>
        <CardContent className="p-4">
          <p className="text-xs text-muted-foreground">
            <strong className="text-foreground">Privacy:</strong> watermarking runs locally via the Canvas API.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
