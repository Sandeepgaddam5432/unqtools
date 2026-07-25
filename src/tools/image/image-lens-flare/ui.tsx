"use client";

import React, { useState, useCallback, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { ErrorBanner, CopyButton, DownloadButton } from "../../_shared";
import {
  validateFlare,
  falloff,
  blendFlare,
  ghostPositions,
  starRayIntensity,
  haloIntensity,
  flareContribution,
  PRESETS,
  findPreset,
  DEFAULT_OPTIONS,
  type FlareOptions,
} from "./logic";
import { toast } from "sonner";

const hexToRgb = (hex: string): [number, number, number] => {
  const m = hex.replace("#", "");
  return [parseInt(m.slice(0, 2), 16), parseInt(m.slice(2, 4), 16), parseInt(m.slice(4, 6), 16)];
};
const rgbToHex = (rgb: [number, number, number]) =>
  "#" + rgb.map((c) => c.toString(16).padStart(2, "0")).join("");

export default function ImageLensFlare() {
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [fileName, setFileName] = useState("lens-flare.png");
  const [opts, setOpts] = useState<FlareOptions>(DEFAULT_OPTIONS);
  const [colorHex, setColorHex] = useState(rgbToHex(DEFAULT_OPTIONS.color));
  const [format, setFormat] = useState<"image/png" | "image/jpeg" | "image/webp">("image/png");
  const [quality, setQuality] = useState(0.9);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [meanIntensity, setMeanIntensity] = useState<number | null>(null);
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
      setFileName(file.name.replace(/\.[^.]+$/, "") + "-flare.png");
      setError(null);
      setMeanIntensity(null);
    };
    img.onerror = () => setError("Could not load image");
    img.src = URL.createObjectURL(file);
  }, []);

  const apply = useCallback(() => {
    if (!image || !canvasRef.current) return;
    const finalOpts = { ...opts, color: hexToRgb(colorHex) };
    const v = validateFlare(finalOpts);
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
    const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const px = imgData.data;
    const ghosts = ghostPositions(v.fx, v.fy, v.ghosts);
    let intensitySum = 0;
    let pixelCount = 0;
    for (let y = 0; y < canvas.height; y++) {
      for (let x = 0; x < canvas.width; x++) {
        const i = (y * canvas.width + x) * 4;
        const nx = x / canvas.width;
        const ny = y / canvas.height;
        const amt = flareContribution(nx, ny, v);
        intensitySum += amt;
        pixelCount++;
        let blended: [number, number, number, number] = [px[i]!, px[i + 1]!, px[i + 2]!, px[i + 3]!];
        if (amt > 0.005) blended = blendFlare(blended, v.color, amt);
        px[i] = blended[0]; px[i + 1] = blended[1]; px[i + 2] = blended[2];
      }
    }
    setMeanIntensity(pixelCount === 0 ? 0 : intensitySum / pixelCount);
    ctx.putImageData(imgData, 0, 0);
    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        if (previewUrl) URL.revokeObjectURL(previewUrl);
        setPreviewUrl(URL.createObjectURL(blob));
      },
      format,
      format === "image/png" ? undefined : quality,
    );
  }, [image, opts, colorHex, format, quality, previewUrl]);

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
      setColorHex(rgbToHex(p.options.color));
      toast.success(`Preset: ${p.label}`);
    }
  }, []);

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
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs text-muted-foreground">Flare X: {Math.round(opts.fx * 100)}%</Label>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={Math.round(opts.fx * 100)}
                  onChange={(e) => setOpts({ ...opts, fx: Number(e.target.value) / 100 })}
                  className="w-full"
                />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Flare Y: {Math.round(opts.fy * 100)}%</Label>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={Math.round(opts.fy * 100)}
                  onChange={(e) => setOpts({ ...opts, fy: Number(e.target.value) / 100 })}
                  className="w-full"
                />
              </div>
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

            <div className="flex items-center gap-2">
              <Label className="text-xs text-muted-foreground">Color</Label>
              <input
                type="color"
                value={colorHex}
                onChange={(e) => setColorHex(e.target.value)}
                className="h-8 w-12 rounded border"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs text-muted-foreground">Star rays: {opts.rays}</Label>
                <input
                  type="range"
                  min={0}
                  max={16}
                  value={opts.rays}
                  onChange={(e) => setOpts({ ...opts, rays: Number(e.target.value) })}
                  className="w-full"
                />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Ray length: {Math.round(opts.rayLength * 100)}%</Label>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={Math.round(opts.rayLength * 100)}
                  onChange={(e) => setOpts({ ...opts, rayLength: Number(e.target.value) / 100 })}
                  className="w-full"
                />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Halo radius: {Math.round(opts.haloRadius * 100)}%</Label>
                <input
                  type="range"
                  min={0}
                  max={50}
                  value={Math.round(opts.haloRadius * 100)}
                  onChange={(e) => setOpts({ ...opts, haloRadius: Number(e.target.value) / 100 })}
                  className="w-full"
                />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Ghosts: {opts.ghosts}</Label>
                <input
                  type="range"
                  min={0}
                  max={8}
                  value={opts.ghosts}
                  onChange={(e) => setOpts({ ...opts, ghosts: Number(e.target.value) })}
                  className="w-full"
                />
              </div>
            </div>

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
              <Button size="sm" onClick={apply}>Apply flare</Button>
              <Button variant="outline" size="sm" onClick={download} disabled={!previewUrl}>Download</Button>
              <CopyButton
                getText={() => JSON.stringify(opts)}
                label="Copy settings JSON"
                disabled={!previewUrl}
              />
            </div>

            {meanIntensity !== null && (
              <p className="text-xs text-muted-foreground">
                Mean flare intensity: {(meanIntensity * 100).toFixed(2)}%
              </p>
            )}
          </CardContent>
        </Card>
      )}

      <canvas ref={canvasRef} className="hidden" />
      {previewUrl && (
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground mb-2">Preview</p>
            <img src={previewUrl} alt="Lens flare preview" className="max-w-full rounded-md border" />
          </CardContent>
        </Card>
      )}
      {error && <ErrorBanner message={error} />}
      <Card>
        <CardContent className="p-4">
          <p className="text-xs text-muted-foreground">
            <strong className="text-foreground">Privacy:</strong> lens flare runs locally via the Canvas API.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
