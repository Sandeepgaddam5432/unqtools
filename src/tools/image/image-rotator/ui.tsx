"use client";

import React, { useState, useCallback, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ErrorBanner } from "../../_shared";
import { calculateRotation } from "./logic";
import { toast } from "sonner";

export default function ImageRotator() {
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [fileName, setFileName] = useState("rotated.png");
  const [degrees, setDegrees] = useState("90");
  const [format, setFormat] = useState("image/png");
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
      setFileName(file.name.replace(/\.[^.]+$/, "") + "-rotated.png");
      setError(null);
    };
    img.onerror = () => setError("Could not load image");
    img.src = url;
  }, []);

  const applyRotation = useCallback(
    (deg: number) => {
      if (!image || !canvasRef.current) return;
      const result = calculateRotation({
        originalWidth: image.naturalWidth,
        originalHeight: image.naturalHeight,
        degrees: deg,
      });
      if ("error" in result) {
        setError(result.error);
        return;
      }
      setError(null);
      const canvas = canvasRef.current;
      canvas.width = result.width;
      canvas.height = result.height;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.translate(result.width / 2, result.height / 2);
      ctx.rotate((result.angle * Math.PI) / 180);
      ctx.drawImage(image, -image.naturalWidth / 2, -image.naturalHeight / 2);
      canvas.toBlob(
        (blob) => {
          if (!blob) return;
          if (previewUrl) URL.revokeObjectURL(previewUrl);
          setPreviewUrl(URL.createObjectURL(blob));
        },
        format,
        format === "image/png" ? undefined : quality,
      );
    },
    [image, format, quality, previewUrl],
  );

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
        </CardContent>
      </Card>

      {image && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="flex flex-wrap gap-2">
              {[90, 180, 270].map((d) => (
                <Button key={d} variant="outline" size="sm" onClick={() => applyRotation(d)}>
                  {d}° CW
                </Button>
              ))}
              <Button variant="outline" size="sm" onClick={() => applyRotation(-90)}>
                90° CCW
              </Button>
            </div>
            <div className="flex flex-wrap gap-2 items-end">
              <div>
                <Label className="text-xs text-muted-foreground">Custom degrees</Label>
                <Input type="number" value={degrees} onChange={(e) => setDegrees(e.target.value)} className="w-32" />
              </div>
              <Button size="sm" onClick={() => applyRotation(Number(degrees))}>
                Apply
              </Button>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Format</Label>
              <select
                value={format}
                onChange={(e) => setFormat(e.target.value)}
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
                <Input
                  type="range"
                  min={10}
                  max={100}
                  value={Math.round(quality * 100)}
                  onChange={(e) => setQuality(Number(e.target.value) / 100)}
                  className="w-32"
                />
              </div>
            )}
            <Button variant="outline" size="sm" onClick={download} disabled={!previewUrl}>
              Download
            </Button>
          </CardContent>
        </Card>
      )}

      <canvas ref={canvasRef} className="hidden" />
      {previewUrl && (
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground mb-2">Preview</p>
            <img src={previewUrl} alt="Rotated preview" className="max-w-full rounded-md border" />
          </CardContent>
        </Card>
      )}
      {error && <ErrorBanner message={error} />}
      <Card>
        <CardContent className="p-4">
          <p className="text-xs text-muted-foreground">
            <strong className="text-foreground">Privacy:</strong> all rotation runs locally via the Canvas API.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
