"use client";

import React, { useState, useCallback, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { ErrorBanner, CopyButton, DownloadButton } from "../../_shared";
import {
  makeRng,
  validateGlitchParams,
  luma,
  datamoshBlocks,
  channelShiftOffsets,
  sortByBrightness,
  scanlineIntensity,
  vhsNoise,
  corruptByte,
  sliceDisplacements,
  PRESETS,
  findPreset,
  DEFAULT_PARAMS,
  type GlitchMode,
  type GlitchParams,
} from "./logic";
import { toast } from "sonner";

const ALL_MODES: GlitchMode[] = ["pixel-sort", "channel-shift", "datamosh", "scanlines", "vhs", "byte-corrupt"];

export default function ImageGlitchArt() {
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [fileName, setFileName] = useState("glitch.png");
  const [params, setParams] = useState<GlitchParams>(DEFAULT_PARAMS);
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
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      setImage(img);
      setFileName(file.name.replace(/\.[^.]+$/, "") + "-glitch.png");
      setError(null);
      setPreviewUrl(null);
    };
    img.onerror = () => setError("Could not load image");
    img.src = url;
  }, []);

  const applyEffect = useCallback(
    (px: Uint8ClampedArray, w: number, h: number, mode: GlitchMode, rng: () => number) => {
      const intensity = params.intensity;
      const shift = params.shift;
      if (mode === "channel-shift") {
        const off = channelShiftOffsets(shift, rng);
        const copy = new Uint8ClampedArray(px);
        for (let y = 0; y < h; y++) {
          for (let x = 0; x < w; x++) {
            const i = (y * w + x) * 4;
            const ri = (y * w + Math.max(0, Math.min(w - 1, x + off.r))) * 4;
            const gi = (y * w + Math.max(0, Math.min(w - 1, x + off.g))) * 4;
            const bi = (y * w + Math.max(0, Math.min(w - 1, x + off.b))) * 4;
            px[i] = copy[ri]!; px[i + 1] = copy[gi + 1]!; px[i + 2] = copy[bi + 2]!; px[i + 3] = copy[i + 3]!;
          }
        }
      } else if (mode === "datamosh") {
        const blocks = datamoshBlocks(h, intensity, rng);
        const copy = new Uint8ClampedArray(px);
        const displacements = sliceDisplacements(h, shift, intensity, rng);
        for (let y = 0; y < h; y++) {
          const dx = displacements[y] || 0;
          for (let x = 0; x < w; x++) {
            const sx = Math.max(0, Math.min(w - 1, x + dx));
            const di = (y * w + x) * 4;
            const si = (y * w + sx) * 4;
            px[di] = copy[si]!; px[di + 1] = copy[si + 1]!; px[di + 2] = copy[si + 2]!; px[di + 3] = copy[si + 3]!;
          }
        }
        // Also apply datamosh block shifts
        for (const b of blocks) {
          for (let y = b.y0; y < b.y1; y++) {
            const sy = Math.max(0, Math.min(h - 1, y + b.dy));
            for (let x = 0; x < w; x++) {
              const di = (y * w + x) * 4;
              const si = (sy * w + x) * 4;
              px[di] = copy[si]!; px[di + 1] = copy[si + 1]!; px[di + 2] = copy[si + 2]!; px[di + 3] = copy[si + 3]!;
            }
          }
        }
      } else if (mode === "pixel-sort") {
        const threshold = (intensity / 100) * 255;
        for (let y = 0; y < h; y++) {
          const row: Array<[number, number, number]> = [];
          for (let x = 0; x < w; x++) {
            const i = (y * w + x) * 4;
            row.push([px[i]!, px[i + 1]!, px[i + 2]!]);
          }
          row.sort(sortByBrightness);
          for (let x = 0; x < w; x++) {
            const i = (y * w + x) * 4;
            const [r, g, b] = row[x]!;
            if (luma(r, g, b) > threshold) {
              px[i] = r; px[i + 1] = g; px[i + 2] = b;
            }
          }
        }
      } else if (mode === "scanlines") {
        for (let y = 0; y < h; y++) {
          const f = scanlineIntensity(y, intensity);
          for (let x = 0; x < w; x++) {
            const i = (y * w + x) * 4;
            px[i] = px[i]! * f; px[i + 1] = px[i + 1]! * f; px[i + 2] = px[i + 2]! * f;
          }
        }
      } else if (mode === "vhs") {
        for (let y = 0; y < h; y++) {
          for (let x = 0; x < w; x++) {
            const i = (y * w + x) * 4;
            const n = rng();
            px[i] = vhsNoise(px[i]!, n, intensity);
            px[i + 1] = vhsNoise(px[i + 1]!, n, intensity);
            px[i + 2] = vhsNoise(px[i + 2]!, n, intensity);
          }
        }
      } else if (mode === "byte-corrupt") {
        for (let i = 0; i < px.length; i += 4) {
          px[i] = corruptByte(px[i]!, rng, intensity);
          px[i + 1] = corruptByte(px[i + 1]!, rng, intensity);
          px[i + 2] = corruptByte(px[i + 2]!, rng, intensity);
        }
      }
    },
    [params],
  );

  const apply = useCallback(() => {
    if (!image || !canvasRef.current) return;
    const v = validateGlitchParams(params);
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
    const w = canvas.width;
    const h = canvas.height;
    if (params.stack) {
      // Apply all effects sequentially
      for (const mode of ALL_MODES) {
        applyEffect(px, w, h, mode, makeRng(params.seed + mode.length));
      }
    } else {
      applyEffect(px, w, h, params.mode, makeRng(params.seed));
    }
    ctx.putImageData(data, 0, 0);
    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        if (previewUrl) URL.revokeObjectURL(previewUrl);
        setPreviewUrl(URL.createObjectURL(blob));
      },
      format,
      format === "image/png" ? undefined : quality,
    );
  }, [image, params, format, quality, previewUrl, applyEffect]);

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
      setParams(p.params);
      toast.success(`Preset: ${p.label}`);
    }
  }, []);

  return (
    <div className="space-y-4">
      <Card><CardContent className="p-4 space-y-3">
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => onFile(e.target.files?.[0])}
        />
        <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()}>Choose image</Button>
      </CardContent></Card>
      {image && (
        <Card><CardContent className="p-4 space-y-4">
          <div>
            <Label className="text-xs text-muted-foreground">Effect mode</Label>
            <div className="flex flex-wrap gap-1.5 mt-1">
              {ALL_MODES.map((m) => (
                <Button
                  key={m}
                  size="sm"
                  variant={params.mode === m ? "default" : "outline"}
                  onClick={() => setParams({ ...params, mode: m })}
                >
                  {m}
                </Button>
              ))}
            </div>
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Intensity: {params.intensity}</Label>
            <input
              type="range"
              min={0}
              max={100}
              value={params.intensity}
              onChange={(e) => setParams({ ...params, intensity: Number(e.target.value) })}
              className="w-full"
            />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Shift: {params.shift}</Label>
            <input
              type="range"
              min={0}
              max={100}
              value={params.shift}
              onChange={(e) => setParams({ ...params, shift: Number(e.target.value) })}
              className="w-full"
            />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Seed: {params.seed}</Label>
            <input
              type="number"
              value={params.seed}
              onChange={(e) => setParams({ ...params, seed: Number(e.target.value) })}
              className="w-full rounded-md border px-2 py-1 text-sm"
            />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={params.stack}
              onChange={(e) => setParams({ ...params, stack: e.target.checked })}
            />
            <span>Stack all effects</span>
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
          <div className="flex gap-2 flex-wrap">
            <Button size="sm" onClick={apply}>Glitch</Button>
            <Button variant="outline" size="sm" onClick={download} disabled={!previewUrl}>Download</Button>
            <CopyButton
              getText={() => JSON.stringify(params)}
              label="Copy settings JSON"
              disabled={!previewUrl}
            />
          </div>
        </CardContent></Card>
      )}
      <canvas ref={canvasRef} className="hidden" />
      {previewUrl && (
        <Card><CardContent className="p-4">
          <p className="text-xs text-muted-foreground mb-2">Preview</p>
          <img src={previewUrl} alt="Glitch preview" className="max-w-full rounded-md border" />
        </CardContent></Card>
      )}
      {error && <ErrorBanner message={error} />}
      <Card><CardContent className="p-4">
        <p className="text-xs text-muted-foreground">
          <strong className="text-foreground">Privacy:</strong> glitch effects run locally via Canvas API.
        </p>
      </CardContent></Card>
    </div>
  );
}
