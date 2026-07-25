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
  applyToRgba,
  uniformRadii,
  buildCheckerboardCss,
  validateRoundedOptions,
  buildRoundedFilename,
  dimensionsForPreset,
  DEFAULT_OPTIONS,
  PRESET_SUBTLE,
  PRESET_ROUNDED,
  PRESET_CIRCLE,
  PRESET_SQUIRCLE,
  type RoundedOptions,
  type ShapeMode,
  type CornerRadii,
} from "./logic";
import { toast } from "sonner";

export default function ImageRoundCorners() {
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [inputName, setInputName] = useState("image.png");
  const [opts, setOpts] = useState<RoundedOptions>(PRESET_ROUNDED);
  const [showCheckerboard, setShowCheckerboard] = useState(true);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const update = <K extends keyof RoundedOptions>(key: K, value: RoundedOptions[K]) =>
    setOpts((p) => ({ ...p, [key]: value }));
  const updateRadii = (k: keyof CornerRadii, v: number) =>
    setOpts((p) => ({ ...p, radii: { ...p.radii, [k]: v } }));

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
    const v = validateRoundedOptions(opts, image.naturalWidth, image.naturalHeight);
    if ("error" in v) { setError(v.error); return; }
    setError(null);
    const canvas = canvasRef.current;
    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(image, 0, 0);
    const data = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const result = applyToRgba(data.data, canvas.width, canvas.height, opts);
    data.data.set(result);
    ctx.putImageData(data, 0, 0);
    canvas.toBlob((blob) => {
      if (!blob) return;
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      setPreviewUrl(URL.createObjectURL(blob));
    }, "image/png");
  }, [image, opts, previewUrl]);

  const applyPresetSize = useCallback((preset: "avatar-256" | "avatar-512" | "app-icon-180" | "app-icon-1024") => {
    if (!image || !canvasRef.current) return;
    const { width, height } = dimensionsForPreset(preset);
    const canvas = canvasRef.current;
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(image, 0, 0, width, height);
    const data = ctx.getImageData(0, 0, width, height);
    const result = applyToRgba(data.data, width, height, opts);
    data.data.set(result);
    ctx.putImageData(data, 0, 0);
    canvas.toBlob((blob) => {
      if (!blob) return;
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      setPreviewUrl(URL.createObjectURL(blob));
      toast.success(`Exported ${preset}`);
    }, "image/png");
  }, [image, opts, previewUrl]);

  const download = useCallback(() => {
    if (!canvasRef.current) return;
    canvasRef.current.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = buildRoundedFilename(inputName, opts.shape, "image/png"); a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      toast.success("Image downloaded");
    }, "image/png");
  }, [inputName, opts.shape]);

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
              <Button variant="outline" size="sm" onClick={() => setOpts(PRESET_SUBTLE)}>Subtle</Button>
              <Button variant="outline" size="sm" onClick={() => setOpts(PRESET_ROUNDED)}>Rounded</Button>
              <Button variant="outline" size="sm" onClick={() => setOpts(PRESET_CIRCLE)}>Circle</Button>
              <Button variant="outline" size="sm" onClick={() => setOpts(PRESET_SQUIRCLE)}>Squircle</Button>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Shape</Label>
              <select value={opts.shape} onChange={(e) => update("shape", e.target.value as ShapeMode)} className="h-9 rounded-md border bg-background px-3 text-sm w-full">
                <option value="rounded">Rounded (per-corner)</option>
                <option value="squircle">Squircle (iOS)</option>
                <option value="circle">Circle</option>
              </select>
            </div>
            {opts.shape === "rounded" && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div><Label className="text-xs text-muted-foreground">Top-left: {opts.radii.topLeft}px</Label><Slider value={[opts.radii.topLeft]} onValueChange={(v) => updateRadii("topLeft", v[0]!)} min={0} max={200} step={1} /></div>
                <div><Label className="text-xs text-muted-foreground">Top-right: {opts.radii.topRight}px</Label><Slider value={[opts.radii.topRight]} onValueChange={(v) => updateRadii("topRight", v[0]!)} min={0} max={200} step={1} /></div>
                <div><Label className="text-xs text-muted-foreground">Bottom-right: {opts.radii.bottomRight}px</Label><Slider value={[opts.radii.bottomRight]} onValueChange={(v) => updateRadii("bottomRight", v[0]!)} min={0} max={200} step={1} /></div>
                <div><Label className="text-xs text-muted-foreground">Bottom-left: {opts.radii.bottomLeft}px</Label><Slider value={[opts.radii.bottomLeft]} onValueChange={(v) => updateRadii("bottomLeft", v[0]!)} min={0} max={200} step={1} /></div>
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div><Label className="text-xs text-muted-foreground">Feather (AA): {opts.feather}</Label><Slider value={[opts.feather]} onValueChange={(v) => update("feather", v[0]!)} min={0} max={100} step={1} /></div>
              <div><Label className="text-xs text-muted-foreground">Padding: {opts.padding}px</Label><Slider value={[opts.padding]} onValueChange={(v) => update("padding", v[0]!)} min={0} max={200} step={1} /></div>
            </div>
            <div className="border-t pt-3 space-y-2">
              <div className="flex items-center gap-2">
                <Switch checked={opts.border.enabled} onCheckedChange={(v) => update("border", { ...opts.border, enabled: v })} id="border" />
                <Label htmlFor="border" className="text-sm cursor-pointer">Inset border</Label>
              </div>
              {opts.border.enabled && (
                <div className="flex flex-wrap gap-3">
                  <div className="w-32"><Label className="text-xs text-muted-foreground">Width: {opts.border.width}px</Label><Slider value={[opts.border.width]} onValueChange={(v) => update("border", { ...opts.border, width: v[0]! })} min={1} max={50} step={1} /></div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Color</Label>
                    <input type="color" value={`#${[opts.border.color.r, opts.border.color.g, opts.border.color.b].map((v) => v.toString(16).padStart(2, "0")).join("")}`}
                      onChange={(e) => {
                        const h = e.target.value.replace("#", "");
                        update("border", { ...opts.border, color: { r: parseInt(h.slice(0, 2), 16), g: parseInt(h.slice(2, 4), 16), b: parseInt(h.slice(4, 6), 16), a: 255 } });
                      }} className="block h-9 w-16 rounded border" />
                  </div>
                </div>
              )}
              <div className="flex items-center gap-2">
                <Switch checked={opts.background.enabled} onCheckedChange={(v) => update("background", { ...opts.background, enabled: v })} id="bg" />
                <Label htmlFor="bg" className="text-sm cursor-pointer">Background fill (off = transparent)</Label>
              </div>
              {opts.background.enabled && (
                <div>
                  <Label className="text-xs text-muted-foreground">BG color</Label>
                  <input type="color" value={`#${[opts.background.color.r, opts.background.color.g, opts.background.color.b].map((v) => v.toString(16).padStart(2, "0")).join("")}`}
                    onChange={(e) => {
                      const h = e.target.value.replace("#", "");
                      update("background", { ...opts.background, color: { r: parseInt(h.slice(0, 2), 16), g: parseInt(h.slice(2, 4), 16), b: parseInt(h.slice(4, 6), 16), a: 255 } });
                    }} className="block h-9 w-16 rounded border" />
                </div>
              )}
              <div className="flex items-center gap-2">
                <Switch checked={showCheckerboard} onCheckedChange={setShowCheckerboard} id="cb" />
                <Label htmlFor="cb" className="text-sm cursor-pointer">Checkerboard preview</Label>
              </div>
            </div>
            <div className="flex flex-wrap items-end gap-2">
              <Button size="sm" onClick={apply}>Round corners</Button>
              <Button variant="outline" size="sm" onClick={download} disabled={!previewUrl}>Download PNG</Button>
              <DownloadButton getText={async () => { await new Promise((r) => setTimeout(r, 0)); return ""; }} filename={buildRoundedFilename(inputName, opts.shape, "image/png")} disabled={!previewUrl} mime="image/png" label="Download (shared)" />
              <Button variant="ghost" size="sm" onClick={() => applyPresetSize("avatar-256")}>256² avatar</Button>
              <Button variant="ghost" size="sm" onClick={() => applyPresetSize("avatar-512")}>512² avatar</Button>
              <Button variant="ghost" size="sm" onClick={() => applyPresetSize("app-icon-1024")}>1024² app icon</Button>
            </div>
          </CardContent>
        </Card>
      )}

      <canvas ref={canvasRef} className="hidden" />
      {previewUrl && (
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground mb-2">Preview</p>
            <img src={previewUrl} alt="Rounded preview" className="max-w-full rounded-md border" style={showCheckerboard && !opts.background.enabled ? { backgroundImage: buildCheckerboardCss() } : undefined} />
          </CardContent>
        </Card>
      )}
      {error && <ErrorBanner message={error} />}
      <Card>
        <CardContent className="p-4">
          <p className="text-xs text-muted-foreground"><strong className="text-foreground">Privacy:</strong> corner rounding runs locally via the Canvas API.</p>
        </CardContent>
      </Card>
    </div>
  );
}
