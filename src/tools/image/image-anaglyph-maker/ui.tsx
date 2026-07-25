"use client";

import React, { useState, useCallback, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { ErrorBanner } from "../../_shared";
import { combinePixels, validateDimensions, ANAGLYPH_MODES } from "./logic";
import { toast } from "sonner";

export default function ImageAnaglyphMaker() {
  const [leftImg, setLeftImg] = useState<HTMLImageElement | null>(null);
  const [rightImg, setRightImg] = useState<HTMLImageElement | null>(null);
  const [mode, setMode] = useState<(typeof ANAGLYPH_MODES)[number]["value"]>("red-cyan");
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
    for (let i = 0; i < leftData.data.length; i += 4) {
      const px = combinePixels(
        { r: leftData.data[i], g: leftData.data[i + 1], b: leftData.data[i + 2], a: leftData.data[i + 3] },
        { r: rightData.data[i], g: rightData.data[i + 1], b: rightData.data[i + 2], a: rightData.data[i + 3] },
        { mode },
      );
      out.data[i] = px.r;
      out.data[i + 1] = px.g;
      out.data[i + 2] = px.b;
      out.data[i + 3] = px.a;
    }
    ctx.putImageData(out, 0, 0);
    canvas.toBlob((blob) => {
      if (!blob) return;
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      setPreviewUrl(URL.createObjectURL(blob));
      toast.success("Anaglyph generated");
    }, "image/png");
  }, [leftImg, rightImg, mode, previewUrl]);

  const download = useCallback(() => {
    if (!canvasRef.current) return;
    canvasRef.current.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "anaglyph-3d.png";
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    }, "image/png");
  }, []);

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <input
                ref={leftFileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => loadImage(e.target.files?.[0], setLeftImg)}
              />
              <Button
                variant="outline"
                size="sm"
                onClick={() => leftFileRef.current?.click()}
              >
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
              <Button
                variant="outline"
                size="sm"
                onClick={() => rightFileRef.current?.click()}
              >
                Right image
              </Button>
              {rightImg && (
                <p className="text-xs text-muted-foreground mt-1">
                  {rightImg.naturalWidth}×{rightImg.naturalHeight}px
                </p>
              )}
            </div>
          </div>
          <div className="flex flex-wrap gap-2 items-end">
            <div>
              <Label className="text-xs text-muted-foreground">Color mode</Label>
              <select
                className="h-9 rounded-md border bg-background px-3 text-sm"
                value={mode}
                onChange={(e) => setMode(e.target.value as typeof mode)}
              >
                {ANAGLYPH_MODES.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </select>
            </div>
            <Button size="sm" onClick={combine} disabled={!leftImg || !rightImg}>
              Generate anaglyph
            </Button>
            <Button variant="outline" size="sm" onClick={download} disabled={!previewUrl}>
              Download
            </Button>
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
