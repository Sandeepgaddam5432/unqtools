"use client";

import React, { useState, useCallback, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { ErrorBanner, CopyButton, DownloadButton } from "../../_shared";
import {
  validateDuotone,
  applyDuotone,
  paletteToCss,
  PRESETS,
  findPreset,
  DEFAULT_OPTIONS,
  type DuotoneOptions,
} from "./logic";
import { toast } from "sonner";

const hexToRgb = (hex: string): [number, number, number] => {
  const m = hex.replace("#", "");
  return [parseInt(m.slice(0, 2), 16), parseInt(m.slice(2, 4), 16), parseInt(m.slice(4, 6), 16)];
};
const rgbToHex = (rgb: [number, number, number]) =>
  "#" + rgb.map((c) => c.toString(16).padStart(2, "0")).join("");

export default function ImageDuotoneMaker() {
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [fileName, setFileName] = useState("duotone.png");
  const [opts, setOpts] = useState<DuotoneOptions>(DEFAULT_OPTIONS);
  const [shadowHex, setShadowHex] = useState(rgbToHex(DEFAULT_OPTIONS.shadow));
  const [highlightHex, setHighlightHex] = useState(rgbToHex(DEFAULT_OPTIONS.highlight));
  const [midtoneHex, setMidtoneHex] = useState("#646464");
  const [useMidtone, setUseMidtone] = useState(false);
  const [format, setFormat] = useState<"image/png" | "image/jpeg" | "image/webp">("image/png");
  const [quality, setQuality] = useState(0.9);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const onFile = useCallback((file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("Please choose an image file");
      return;
    }
    const img = new Image();
    img.onload = () => {
      setImage(img);
      setFileName(file.name.replace(/\.[^.]+$/, "") + "-duotone.png");
      setError(null);
    };
    img.onerror = () => setError("Could not load image");
    img.src = URL.createObjectURL(file);
  }, []);

  const buildOpts = useCallback((): DuotoneOptions => {
    return {
      ...opts,
      shadow: hexToRgb(shadowHex),
      highlight: hexToRgb(highlightHex),
      midtone: useMidtone ? hexToRgb(midtoneHex) : null,
    };
  }, [opts, shadowHex, highlightHex, midtoneHex, useMidtone]);

  const apply = useCallback(() => {
    if (!image || !canvasRef.current) return;
    const finalOpts = buildOpts();
    const v = validateDuotone(finalOpts);
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
    const src = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const px = src.data;
    for (let i = 0; i < px.length; i += 4) {
      const out = applyDuotone([px[i]!, px[i + 1]!, px[i + 2]!, px[i + 3]!], v);
      px[i] = out[0]; px[i + 1] = out[1]; px[i + 2] = out[2];
    }
    ctx.putImageData(src, 0, 0);
    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        if (previewUrl) URL.revokeObjectURL(previewUrl);
        setPreviewUrl(URL.createObjectURL(blob));
      },
      format,
      format === "image/png" ? undefined : quality,
    );
  }, [image, buildOpts, format, quality, previewUrl]);

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

  const applyPreset = useCallback((id: string) => {
    const p = findPreset(id);
    if (p) {
      setOpts(p.options);
      setShadowHex(rgbToHex(p.options.shadow));
      setHighlightHex(rgbToHex(p.options.highlight));
      if (p.options.midtone) {
        setMidtoneHex(rgbToHex(p.options.midtone));
        setUseMidtone(true);
      } else {
        setUseMidtone(false);
      }
      toast.success(`Preset: ${p.label}`);
    }
  }, []);

  const css = paletteToCss(buildOpts());

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4 space-y-3">
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => onFile(e.target.files?.[0])}
          />
          <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()}>Choose image</Button>
        </CardContent>
      </Card>
      {image && (
        <Card>
          <CardContent className="p-4 space-y-4">
            <div className="flex flex-wrap gap-4">
              <div className="flex items-center gap-2">
                <Label className="text-xs text-muted-foreground">Shadow</Label>
                <input
                  type="color"
                  value={shadowHex}
                  onChange={(e) => setShadowHex(e.target.value)}
                  className="h-8 w-12 rounded border"
                />
              </div>
              <div className="flex items-center gap-2">
                <Label className="text-xs text-muted-foreground">Highlight</Label>
                <input
                  type="color"
                  value={highlightHex}
                  onChange={(e) => setHighlightHex(e.target.value)}
                  className="h-8 w-12 rounded border"
                />
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={useMidtone}
                  onChange={(e) => setUseMidtone(e.target.checked)}
                />
                <span>Tri-tone</span>
              </label>
              {useMidtone && (
                <div className="flex items-center gap-2">
                  <Label className="text-xs text-muted-foreground">Midtone</Label>
                  <input
                    type="color"
                    value={midtoneHex}
                    onChange={(e) => setMidtoneHex(e.target.value)}
                    className="h-8 w-12 rounded border"
                  />
                </div>
              )}
            </div>

            <div>
              <Label className="text-xs text-muted-foreground">Contrast: {opts.contrast.toFixed(2)}</Label>
              <input
                type="range"
                min={50}
                max={200}
                value={Math.round(opts.contrast * 100)}
                onChange={(e) => setOpts({ ...opts, contrast: Number(e.target.value) / 100 })}
                className="w-full"
              />
            </div>

            <div>
              <Label className="text-xs text-muted-foreground">Intensity: {Math.round(opts.intensity * 100)}%</Label>
              <input
                type="range"
                min={0}
                max={100}
                value={Math.round(opts.intensity * 100)}
                onChange={(e) => setOpts({ ...opts, intensity: Number(e.target.value) / 100 })}
                className="w-full"
              />
            </div>

            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={opts.invert}
                onChange={(e) => setOpts({ ...opts, invert: e.target.checked })}
              />
              <span>Invert mapping</span>
            </label>

            <div>
              <Label className="text-xs text-muted-foreground">Presets</Label>
              <div className="flex flex-wrap gap-1.5 mt-1">
                {PRESETS.map((p) => (
                  <Button key={p.id} variant="outline" size="sm" onClick={() => applyPreset(p.id)}>
                    {p.label}
                  </Button>
                ))}
              </div>
            </div>

            <div>
              <Label className="text-xs text-muted-foreground">Palette preview</Label>
              <div
                className="h-8 w-full rounded border mt-1"
                style={{ background: css }}
              />
            </div>

            <div>
              <Label className="text-xs text-muted-foreground">Format</Label>
              <select
                value={format}
                onChange={(e) => setFormat(e.target.value as typeof format)}
                className="h-9 rounded-md border bg-background px-3 text-sm"
              >
                <option value="image/png">PNG</option>
                <option value="image/jpeg">JPEG</option>
                <option value="image/webp">WebP</option>
              </select>
            </div>
            {format !== "image/png" && (
              <div>
                <Label className="text-xs text-muted-foreground">Quality: {Math.round(quality * 100)}%</Label>
                <input
                  type="range"
                  min={10}
                  max={100}
                  value={Math.round(quality * 100)}
                  onChange={(e) => setQuality(Number(e.target.value) / 100)}
                  className="w-32"
                />
              </div>
            )}

            <div className="flex flex-wrap gap-2">
              <Button size="sm" onClick={apply}>Apply duotone</Button>
              <Button variant="outline" size="sm" onClick={download} disabled={!previewUrl}>Download</Button>
              <CopyButton getText={() => css} label="Copy CSS" disabled={!previewUrl} />
              <CopyButton
                getText={() => JSON.stringify(buildOpts())}
                label="Copy settings JSON"
                disabled={!previewUrl}
              />
            </div>
          </CardContent>
        </Card>
      )}
      <canvas ref={canvasRef} className="hidden" />
      {previewUrl && (
        <Card><CardContent className="p-4">
          <p className="text-xs text-muted-foreground mb-2">Preview</p>
          <img src={previewUrl} alt="Duotone preview" className="max-w-full rounded-md border" />
        </CardContent></Card>
      )}
      {error && <ErrorBanner message={error} />}
      <Card><CardContent className="p-4">
        <p className="text-xs text-muted-foreground">
          <strong className="text-foreground">Privacy:</strong> duotone runs locally via the Canvas API.
        </p>
      </CardContent></Card>
    </div>
  );
}
