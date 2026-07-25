"use client";

import React, { useState, useCallback, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { ErrorBanner, CopyButton, DownloadButton } from "../../_shared";
import {
  swirlMap,
  inBounds,
  applyColorShift,
  generateStars,
  applyStar,
  validateSwirlOptions,
  PRESETS,
  findPreset,
  DEFAULT_OPTIONS,
  type SwirlOptions,
} from "./logic";
import { toast } from "sonner";

export default function ImageStarryNight() {
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [fileName, setFileName] = useState("starry-night.png");
  const [opts, setOpts] = useState<SwirlOptions>(DEFAULT_OPTIONS);
  const [angleDeg, setAngleDeg] = useState(180);
  const [format, setFormat] = useState<"image/png" | "image/jpeg" | "image/webp">("image/png");
  const [quality, setQuality] = useState(0.9);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [starCount, setStarCount] = useState<number | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const onFile = useCallback((file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("Please choose an image file");
      return;
    }
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      setImage(img);
      setFileName(file.name.replace(/\.[^.]+$/, "") + "-starry.png");
      setError(null);
      setPreviewUrl(null);
      setStarCount(null);
    };
    img.onerror = () => setError("Could not load image");
    img.src = url;
  }, []);

  const apply = useCallback(() => {
    if (!image || !canvasRef.current) return;
    const finalOpts = { ...opts, angle: (angleDeg * Math.PI) / 180 };
    const v = validateSwirlOptions(finalOpts);
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
    const out = ctx.createImageData(canvas.width, canvas.height);
    const sp = src.data;
    const op = out.data;
    const w = canvas.width;
    const h = canvas.height;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const m = swirlMap(x, y, finalOpts, w, h);
        const di = (y * w + x) * 4;
        if (inBounds(m, w, h)) {
          const sx = Math.max(0, Math.min(w - 1, Math.round(m.x)));
          const sy = Math.max(0, Math.min(h - 1, Math.round(m.y)));
          const si = (sy * w + sx) * 4;
          const shifted = applyColorShift(sp[si]!, sp[si + 1]!, sp[si + 2]!, finalOpts.colorShift);
          op[di] = shifted[0]; op[di + 1] = shifted[1]; op[di + 2] = shifted[2]; op[di + 3] = sp[si + 3]!;
        } else {
          op[di + 3] = 255;
        }
      }
    }
    // Apply stars
    const stars = generateStars(finalOpts.starDensity, w, h, 1);
    setStarCount(stars.length);
    for (const star of stars) {
      const px = Math.floor(star.x * w);
      const py = Math.floor(star.y * h);
      if (px < 0 || py < 0 || px >= w || py >= h) continue;
      const idx = (py * w + px) * 4;
      const result = applyStar([op[idx]!, op[idx + 1]!, op[idx + 2]!, op[idx + 3]!], finalOpts.starBrightness);
      op[idx] = result[0]; op[idx + 1] = result[1]; op[idx + 2] = result[2];
    }
    ctx.putImageData(out, 0, 0);
    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        if (previewUrl) URL.revokeObjectURL(previewUrl);
        setPreviewUrl(URL.createObjectURL(blob));
      },
      format,
      format === "image/png" ? undefined : quality,
    );
  }, [image, opts, angleDeg, format, quality, previewUrl]);

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
      setAngleDeg(Math.round((p.options.angle * 180) / Math.PI));
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
                <Label className="text-xs text-muted-foreground">Center X: {Math.round(opts.cx * 100)}%</Label>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={Math.round(opts.cx * 100)}
                  onChange={(e) => setOpts({ ...opts, cx: Number(e.target.value) / 100 })}
                  className="w-full"
                />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Center Y: {Math.round(opts.cy * 100)}%</Label>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={Math.round(opts.cy * 100)}
                  onChange={(e) => setOpts({ ...opts, cy: Number(e.target.value) / 100 })}
                  className="w-full"
                />
              </div>
            </div>

            <div>
              <Label className="text-xs text-muted-foreground">Swirl angle: {angleDeg}°</Label>
              <input
                type="range"
                min={0}
                max={720}
                value={angleDeg}
                onChange={(e) => setAngleDeg(Number(e.target.value))}
                className="w-full"
              />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Effect radius: {Math.round(opts.radius * 100)}%</Label>
              <input
                type="range"
                min={10}
                max={100}
                value={Math.round(opts.radius * 100)}
                onChange={(e) => setOpts({ ...opts, radius: Number(e.target.value) / 100 })}
                className="w-full"
              />
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label className="text-xs text-muted-foreground">Star density: {opts.starDensity}</Label>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={opts.starDensity}
                  onChange={(e) => setOpts({ ...opts, starDensity: Number(e.target.value) })}
                  className="w-full"
                />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Star brightness: {Math.round(opts.starBrightness * 100)}%</Label>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={Math.round(opts.starBrightness * 100)}
                  onChange={(e) => setOpts({ ...opts, starBrightness: Number(e.target.value) / 100 })}
                  className="w-full"
                />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Color shift: {opts.colorShift}°</Label>
                <input
                  type="range"
                  min={-360}
                  max={360}
                  value={opts.colorShift}
                  onChange={(e) => setOpts({ ...opts, colorShift: Number(e.target.value) })}
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
              <Button size="sm" onClick={apply}>Apply swirl</Button>
              <Button variant="outline" size="sm" onClick={download} disabled={!previewUrl}>Download</Button>
              <CopyButton
                getText={() => JSON.stringify({ ...opts, angleDeg })}
                label="Copy settings JSON"
                disabled={!previewUrl}
              />
            </div>
            {starCount !== null && (
              <p className="text-xs text-muted-foreground">Stars added: {starCount}</p>
            )}
          </CardContent>
        </Card>
      )}

      <canvas ref={canvasRef} className="hidden" />
      {previewUrl && (
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground mb-2">Preview</p>
            <img src={previewUrl} alt="Starry night preview" className="max-w-full rounded-md border" />
          </CardContent>
        </Card>
      )}
      {error && <ErrorBanner message={error} />}
      <Card>
        <CardContent className="p-4">
          <p className="text-xs text-muted-foreground">
            <strong className="text-foreground">Privacy:</strong> swirl rendering runs locally via the Canvas API.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
