"use client";

import React, { useState, useCallback, useRef, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ErrorBanner } from "../../_shared";
import {
  computeLayout,
  applyAlignment,
  summarize,
  type StitchDirection,
  type AlignOption,
} from "./logic";
import { toast } from "sonner";

export default function ImageStitcher() {
  const [images, setImages] = useState<HTMLImageElement[]>([]);
  const [direction, setDirection] = useState<StitchDirection>("horizontal");
  const [align, setAlign] = useState<AlignOption>("start");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const sizes = useMemo(
    () => images.map((i) => ({ width: i.naturalWidth, height: i.naturalHeight })),
    [images],
  );

  const summary = useMemo(
    () => (images.length ? summarize(sizes, direction) : ""),
    [sizes, direction, images.length],
  );

  const onFiles = useCallback((files: FileList | null) => {
    if (!files || files.length === 0) return;
    const loaded: HTMLImageElement[] = [];
    let pending = files.length;
    Array.from(files).forEach((file) => {
      if (!file.type.startsWith("image/")) {
        pending--;
        return;
      }
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        loaded.push(img);
        pending--;
        if (pending === 0) {
          setImages((prev) => [...prev, ...loaded]);
          setError(null);
        }
      };
      img.onerror = () => {
        pending--;
      };
      img.src = url;
    });
  }, []);

  const stitch = useCallback(() => {
    if (images.length === 0 || !canvasRef.current) return;
    const layout = computeLayout(sizes, direction);
    if ("error" in layout) {
      setError(layout.error);
      return;
    }
    const aligned = applyAlignment(layout, direction, align);
    setError(null);
    const canvas = canvasRef.current;
    canvas.width = aligned.width;
    canvas.height = aligned.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, aligned.width, aligned.height);
    images.forEach((img, i) => {
      const pos = aligned.positions[i];
      ctx.drawImage(img, 0, 0, img.naturalWidth, img.naturalHeight, pos.x, pos.y, pos.width, pos.height);
    });
    canvas.toBlob((blob) => {
      if (!blob) return;
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      setPreviewUrl(URL.createObjectURL(blob));
      toast.success("Stitch complete");
    }, "image/png");
  }, [images, sizes, direction, align, previewUrl]);

  const download = useCallback(() => {
    if (!canvasRef.current) return;
    canvasRef.current.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "stitched.png";
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    }, "image/png");
  }, []);

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4 space-y-3">
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(e) => onFiles(e.target.files)}
          />
          <div className="flex flex-wrap items-end gap-3">
            <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()}>
              Add images
            </Button>
            <div>
              <Label className="text-xs text-muted-foreground">Direction</Label>
              <select
                className="h-9 rounded-md border bg-background px-3 text-sm"
                value={direction}
                onChange={(e) => setDirection(e.target.value as StitchDirection)}
              >
                <option value="horizontal">Horizontal</option>
                <option value="vertical">Vertical</option>
              </select>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Align</Label>
              <select
                className="h-9 rounded-md border bg-background px-3 text-sm"
                value={align}
                onChange={(e) => setAlign(e.target.value as AlignOption)}
              >
                <option value="start">Start</option>
                <option value="center">Center</option>
                <option value="end">End</option>
              </select>
            </div>
            <Button size="sm" onClick={stitch} disabled={images.length === 0}>
              Stitch ({images.length})
            </Button>
            <Button variant="outline" size="sm" onClick={download} disabled={!previewUrl}>
              Download
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setImages([]);
                setPreviewUrl(null);
              }}
              disabled={images.length === 0}
            >
              Clear
            </Button>
          </div>
          {summary && <Badge variant="secondary">{summary}</Badge>}
        </CardContent>
      </Card>

      {error && <ErrorBanner message={error} />}
      <canvas ref={canvasRef} className="hidden" />
      {previewUrl && (
        <Card>
          <CardContent className="p-4">
            <img src={previewUrl} alt="Stitched" className="max-w-full rounded-md border" />
          </CardContent>
        </Card>
      )}
      <Card>
        <CardContent className="p-4">
          <p className="text-xs text-muted-foreground">
            <strong className="text-foreground">Privacy:</strong> all stitching runs locally
            via the Canvas API.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
