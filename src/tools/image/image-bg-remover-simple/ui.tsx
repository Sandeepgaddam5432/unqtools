"use client";

import React, { useState, useCallback, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { ErrorBanner, CopyButton, DownloadButton } from "../../_shared";
import {
  sampleCornerColors,
  computeAlpha,
  floodFillMask,
  isBackgroundMulti,
  validateBgRemoveOptions,
  validateImageBounds,
  PRESETS,
  findPreset,
  DEFAULT_OPTIONS,
  type BgRemoveOptions,
  type Rgb,
} from "./logic";
import { toast } from "sonner";

const hexToRgb = (hex: string): [number, number, number] => {
  const m = hex.replace("#", "");
  return [parseInt(m.slice(0, 2), 16), parseInt(m.slice(2, 4), 16), parseInt(m.slice(4, 6), 16)];
};
const rgbToHex = (rgb: [number, number, number]) =>
  "#" + rgb.map((c) => c.toString(16).padStart(2, "0")).join("");

export default function ImageBgRemoverSimple() {
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [fileName, setFileName] = useState("no-bg.png");
  const [opts, setOpts] = useState<BgRemoveOptions>(DEFAULT_OPTIONS);
  const [replaceHex, setReplaceHex] = useState("#ffffff");
  const [useReplace, setUseReplace] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [removedCount, setRemovedCount] = useState<number | null>(null);
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
      setFileName(file.name.replace(/\.[^.]+$/, "") + "-no-bg.png");
      setError(null);
      setPreviewUrl(null);
      setRemovedCount(null);
    };
    img.onerror = () => setError("Could not load image");
    img.src = url;
  }, []);

  const apply = useCallback(() => {
    if (!image || !canvasRef.current) return;
    const finalOpts: BgRemoveOptions = {
      ...opts,
      replaceColor: useReplace ? hexToRgb(replaceHex) : null,
    };
    const v = validateBgRemoveOptions(finalOpts);
    if ("error" in v) {
      setError(v.error);
      return;
    }
    const b = validateImageBounds(image.naturalWidth, image.naturalHeight);
    if ("error" in b) {
      setError(b.error);
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
      const data = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const px = data.data;
      const w = canvas.width;
      const h = canvas.height;
      // Sample 4 corners.
      const bgs: Rgb[] = sampleCornerColors(px, w, h, opts.sampleSize);
      // Flood fill mask if enabled
      let mask: Uint8Array | null = null;
      if (opts.floodFill) {
        mask = floodFillMask(px, w, h, bgs, opts.threshold);
      }
      let removed = 0;
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          const i = (y * w + x) * 4;
          const pixel: Rgb = { r: px[i]!, g: px[i + 1]!, b: px[i + 2]! };
          const isBg = mask ? mask[y * w + x] === 1 : isBackgroundMulti(pixel, bgs, opts.threshold);
          if (opts.invert) {
            // Keep only matching
            if (!isBg) {
              px[i + 3] = 0;
              removed++;
            } else if (finalOpts.replaceColor) {
              const [r, g, b] = finalOpts.replaceColor;
              px[i] = r; px[i + 1] = g; px[i + 2] = b;
            }
          } else {
            if (isBg) {
              if (finalOpts.replaceColor) {
                const [r, g, b] = finalOpts.replaceColor;
                px[i] = r; px[i + 1] = g; px[i + 2] = b;
              } else {
                px[i + 3] = 0;
              }
              removed++;
            } else if (opts.feather > 0) {
              const alpha = computeAlpha(pixel, bgs, opts.threshold, opts.feather);
              if (finalOpts.replaceColor) {
                if (alpha < 255) {
                  const [r, g, b] = finalOpts.replaceColor;
                  const t = 1 - alpha / 255;
                  px[i] = px[i]! + (r - px[i]!) * t;
                  px[i + 1] = px[i + 1]! + (g - px[i + 1]!) * t;
                  px[i + 2] = px[i + 2]! + (b - px[i + 2]!) * t;
                }
              } else {
                px[i + 3] = alpha;
              }
            }
          }
        }
      }
      setRemovedCount(removed);
      ctx.putImageData(data, 0, 0);
      canvas.toBlob(
        (blob) => {
          if (!blob) return;
          if (previewUrl) URL.revokeObjectURL(previewUrl);
          setPreviewUrl(URL.createObjectURL(blob));
          setBusy(false);
        },
        "image/png",
      );
    } catch {
      setError("Background removal failed — image may be too large");
      setBusy(false);
    }
  }, [image, opts, useReplace, replaceHex, previewUrl]);

  const download = useCallback(() => {
    if (!canvasRef.current) return;
    canvasRef.current.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = fileName;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      toast.success("Image downloaded");
    }, "image/png");
  }, [fileName]);

  const applyPreset = useCallback((id: string) => {
    const p = findPreset(id);
    if (p) {
      setOpts(p.options);
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
          <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()}>
            Choose image
          </Button>
          <p className="text-xs text-muted-foreground">
            Best for images with a solid background color (e.g. product photos on plain backdrop).
          </p>
        </CardContent>
      </Card>

      {image && (
        <Card>
          <CardContent className="p-4 space-y-4">
            <div>
              <Label className="text-xs text-muted-foreground">Color threshold: {opts.threshold}</Label>
              <input
                type="range"
                min={0}
                max={200}
                value={opts.threshold}
                onChange={(e) => setOpts({ ...opts, threshold: Number(e.target.value) })}
                className="w-full"
              />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Corner sample size: {opts.sampleSize}px</Label>
              <input
                type="range"
                min={1}
                max={20}
                value={opts.sampleSize}
                onChange={(e) => setOpts({ ...opts, sampleSize: Number(e.target.value) })}
                className="w-full"
              />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Edge feather: {opts.feather}px</Label>
              <input
                type="range"
                min={0}
                max={30}
                value={opts.feather}
                onChange={(e) => setOpts({ ...opts, feather: Number(e.target.value) })}
                className="w-full"
              />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={opts.floodFill}
                onChange={(e) => setOpts({ ...opts, floodFill: e.target.checked })}
              />
              <span>Flood fill from corners (recommended)</span>
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={opts.invert}
                onChange={(e) => setOpts({ ...opts, invert: e.target.checked })}
              />
              <span>Invert (keep only background-colored)</span>
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={useReplace}
                onChange={(e) => setUseReplace(e.target.checked)}
              />
              <span>Replace background with color</span>
            </label>
            {useReplace && (
              <div className="flex items-center gap-2">
                <Label className="text-xs text-muted-foreground">Replacement color</Label>
                <input
                  type="color"
                  value={replaceHex}
                  onChange={(e) => setReplaceHex(e.target.value)}
                  className="h-8 w-12 rounded border"
                />
              </div>
            )}

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

            <div className="flex flex-wrap gap-2">
              <Button size="sm" onClick={apply} disabled={busy}>
                {busy ? "Removing…" : "Remove background"}
              </Button>
              <Button variant="outline" size="sm" onClick={download} disabled={!previewUrl}>
                Download
              </Button>
              <CopyButton
                getText={() => JSON.stringify(opts)}
                label="Copy settings JSON"
                disabled={!previewUrl}
              />
            </div>
            {removedCount !== null && (
              <p className="text-xs text-muted-foreground">
                Removed/replaced {removedCount.toLocaleString()} pixels
              </p>
            )}
          </CardContent>
        </Card>
      )}

      <canvas ref={canvasRef} className="hidden" />
      {previewUrl && (
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground mb-2">Preview (checkerboard = transparency)</p>
            <div
              style={{
                backgroundImage:
                  "linear-gradient(45deg, #ccc 25%, transparent 25%), linear-gradient(-45deg, #ccc 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #ccc 75%), linear-gradient(-45deg, transparent 75%, #ccc 75%)",
                backgroundSize: "16px 16px",
                backgroundPosition: "0 0, 0 8px, 8px -8px, -8px 0",
              }}
            >
              <img src={previewUrl} alt="Background removed preview" className="max-w-full" />
            </div>
          </CardContent>
        </Card>
      )}
      {error && <ErrorBanner message={error} />}
      <Card>
        <CardContent className="p-4">
          <p className="text-xs text-muted-foreground">
            <strong className="text-foreground">Privacy:</strong> background removal runs locally via the Canvas API.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
