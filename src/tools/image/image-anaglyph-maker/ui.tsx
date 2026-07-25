"use client";

import React, { useState, useCallback, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { ErrorBanner, CopyButton, DownloadButton } from "../../_shared";
import {
  combinePixels,
  validateDimensions,
  validateAnaglyphOptions,
  shiftedX,
  ANAGLYPH_MODES,
  PRESETS,
  findPreset,
  DEFAULT_OPTIONS,
  type AnaglyphOptions,
  type AnaglyphMode,
} from "./logic";
import { toast } from "sonner";

export default function ImageAnaglyphMaker() {
  const [leftImg, setLeftImg] = useState<HTMLImageElement | null>(null);
  const [rightImg, setRightImg] = useState<HTMLImageElement | null>(null);
  const [opts, setOpts] = useState<AnaglyphOptions>(DEFAULT_OPTIONS);
  const [format, setFormat] = useState<"image/png" | "image/jpeg" | "image/webp">("image/png");
  const [quality, setQuality] = useState(0.9);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const leftFileRef = useRef<HTMLInputElement>(null);
  const rightFileRef = useRef<HTMLInputElement>(null);

  const loadImage = useCallback(
    (file: File | undefined, setter: (img: HTMLImageElement) => void) => {
      if (!file || !file.type.startsWith("image/")) {
        setError("Please choose image files");
        return;
      }
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        setter(img);
        setError(null);
      };
      img.onerror = () => setError("Could not load image");
      img.src = url;
    },
    [],
  );

  const combine = useCallback(() => {
    if (!leftImg || !rightImg || !canvasRef.current) return;
    const dim = validateDimensions(
      leftImg.naturalWidth,
      leftImg.naturalHeight,
      rightImg.naturalWidth,
      rightImg.naturalHeight,
    );
    if ("error" in dim) {
      setError(dim.error);
      return;
    }
    const v = validateAnaglyphOptions(opts);
    if ("error" in v) {
      setError(v.error);
      return;
    }
    setError(null);
    const canvas = canvasRef.current;
    canvas.width = dim.width;
    canvas.height = dim.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.drawImage(leftImg, 0, 0);
    const leftData = ctx.getImageData(0, 0, dim.width, dim.height);
    ctx.clearRect(0, 0, dim.width, dim.height);
    ctx.drawImage(rightImg, 0, 0);
    const rightData = ctx.getImageData(0, 0, dim.width, dim.height);

    const out = ctx.createImageData(dim.width, dim.height);
    for (let y = 0; y < dim.height; y++) {
      for (let x = 0; x < dim.width; x++) {
        const li = (y * dim.width + x) * 4;
        // Right image is sampled with parallax shift
        const rx = shiftedX(x, opts.parallax, dim.width);
        const ri = (y * dim.width + rx) * 4;
        const px = combinePixels(
          { r: leftData.data[li]!, g: leftData.data[li + 1]!, b: leftData.data[li + 2]!, a: leftData.data[li + 3]! },
          { r: rightData.data[ri]!, g: rightData.data[ri + 1]!, b: rightData.data[ri + 2]!, a: rightData.data[ri + 3]! },
          opts,
        );
        out.data[li] = px.r;
        out.data[li + 1] = px.g;
        out.data[li + 2] = px.b;
        out.data[li + 3] = px.a;
      }
    }
    ctx.putImageData(out, 0, 0);
    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        if (previewUrl) URL.revokeObjectURL(previewUrl);
        setPreviewUrl(URL.createObjectURL(blob));
        toast.success("Anaglyph generated");
      },
      format,
      format === "image/png" ? undefined : quality,
    );
  }, [leftImg, rightImg, opts, format, quality, previewUrl]);

  const download = useCallback(() => {
    if (!canvasRef.current) return;
    canvasRef.current.toBlob(
      (blob) => {
        if (!blob) return;
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "anaglyph-3d.png";
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      },
      format,
      format === "image/png" ? undefined : quality,
    );
  }, [format, quality]);

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
        <CardContent className="p-4 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <input
                ref={leftFileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => loadImage(e.target.files?.[0], setLeftImg)}
              />
              <Button variant="outline" size="sm" onClick={() => leftFileRef.current?.click()}>
                Left image
              </Button>
              {leftImg && (
                <p className="text-xs text-muted-foreground mt-1">
                  {leftImg.naturalWidth}×{leftImg.naturalHeight}px
                </p>
              )}
            </div>
            <div>
              <input
                ref={rightFileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => loadImage(e.target.files?.[0], setRightImg)}
              />
              <Button variant="outline" size="sm" onClick={() => rightFileRef.current?.click()}>
                Right image
              </Button>
              {rightImg && (
                <p className="text-xs text-muted-foreground mt-1">
                  {rightImg.naturalWidth}×{rightImg.naturalHeight}px
                </p>
              )}
            </div>
          </div>

          <div>
            <Label className="text-xs text-muted-foreground">Color mode</Label>
            <select
              className="h-9 rounded-md border bg-background px-3 text-sm"
              value={opts.mode}
              onChange={(e) => setOpts({ ...opts, mode: e.target.value as AnaglyphMode })}
            >
              {ANAGLYPH_MODES.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <Label className="text-xs text-muted-foreground">Parallax shift: {opts.parallax}px</Label>
            <input
              type="range"
              min={-50}
              max={50}
              value={opts.parallax}
              onChange={(e) => setOpts({ ...opts, parallax: Number(e.target.value) })}
              className="w-full"
            />
          </div>

          <div>
            <Label className="text-xs text-muted-foreground">Depth/strength: {opts.depth.toFixed(2)}</Label>
            <input
              type="range"
              min={0}
              max={200}
              value={Math.round(opts.depth * 100)}
              onChange={(e) => setOpts({ ...opts, depth: Number(e.target.value) / 100 })}
              className="w-full"
            />
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

          <div className="flex flex-wrap gap-2 items-center">
            <Button size="sm" onClick={combine} disabled={!leftImg || !rightImg}>
              Generate anaglyph
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
        </CardContent>
      </Card>

      {error && <ErrorBanner message={error} />}
      <canvas ref={canvasRef} className="hidden" />
      {previewUrl && (
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground mb-2">
              Preview (use red-cyan 3D glasses)
            </p>
            <img
              src={previewUrl}
              alt="Anaglyph preview"
              className="max-w-full rounded-md border"
            />
          </CardContent>
        </Card>
      )}
      <Card>
        <CardContent className="p-4">
          <p className="text-xs text-muted-foreground">
            <strong className="text-foreground">Privacy:</strong> all processing runs
            locally via the Canvas API.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
