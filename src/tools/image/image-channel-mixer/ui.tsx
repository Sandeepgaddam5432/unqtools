"use client";

import React, { useState, useCallback, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ErrorBanner } from "../../_shared";
import { IDENTITY_MATRIX, SWAP_RB_MATRIX, grayscaleMatrix, sepiaMatrix, mixPixel, validateMatrix, type MixMatrix } from "./logic";
import { toast } from "sonner";

const PRESETS: { name: string; matrix: MixMatrix }[] = [
  { name: "Identity", matrix: IDENTITY_MATRIX },
  { name: "Swap R/B", matrix: SWAP_RB_MATRIX },
  { name: "Grayscale", matrix: grayscaleMatrix() },
  { name: "Sepia", matrix: sepiaMatrix() },
];

export default function ImageChannelMixer() {
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [fileName, setFileName] = useState("mixed.png");
  const [matrix, setMatrix] = useState<MixMatrix>(IDENTITY_MATRIX);
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
      setFileName(file.name.replace(/\.[^.]+$/, "") + "-mixed.png");
      setError(null);
      setPreviewUrl(null);
    };
    img.onerror = () => setError("Could not load image");
    img.src = url;
  }, []);

  const apply = useCallback(() => {
    if (!image || !canvasRef.current) return;
    const v = validateMatrix(matrix);
    if ("error" in v) { setError(v.error); return; }
    setError(null);
    const canvas = canvasRef.current;
    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(image, 0, 0);
    const data = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const px = data.data;
    const m = matrix;
    for (let i = 0; i < px.length; i += 4) {
      const r = px[i]!, g = px[i + 1]!, b = px[i + 2]!;
      px[i] = Math.max(0, Math.min(255, Math.round(m.rr * r + m.gr * g + m.br * b)));
      px[i + 1] = Math.max(0, Math.min(255, Math.round(m.rg * r + m.gg * g + m.bg * b)));
      px[i + 2] = Math.max(0, Math.min(255, Math.round(m.rb * r + m.gb * g + m.bb * b)));
    }
    ctx.putImageData(data, 0, 0);
    canvas.toBlob((blob) => {
      if (!blob) return;
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      setPreviewUrl(URL.createObjectURL(blob));
    }, "image/png");
  }, [image, matrix, previewUrl]);

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

  const updateField = (key: keyof MixMatrix, value: string) => {
    setMatrix({ ...matrix, [key]: Number(value) });
  };

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
              {PRESETS.map((p) => (
                <Button key={p.name} size="sm" variant="outline" onClick={() => setMatrix(p.matrix)}>{p.name}</Button>
              ))}
            </div>
            <div className="grid grid-cols-3 gap-3 text-xs">
              {(["rr","gr","br","rg","gg","bg","rb","gb","bb"] as const).map((k) => (
                <div key={k} className="flex flex-col gap-1">
                  <Label className="text-muted-foreground">{k}</Label>
                  <Input type="number" step="0.1" value={matrix[k]} onChange={(e) => updateField(k, e.target.value)} />
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <Button size="sm" onClick={apply}>Mix channels</Button>
              <Button variant="outline" size="sm" onClick={download} disabled={!previewUrl}>Download</Button>
            </div>
          </CardContent>
        </Card>
      )}

      <canvas ref={canvasRef} className="hidden" />
      {previewUrl && (
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground mb-2">Preview</p>
            <img src={previewUrl} alt="Channel mixed preview" className="max-w-full rounded-md border" />
          </CardContent>
        </Card>
      )}
      {error && <ErrorBanner message={error} />}
      <Card>
        <CardContent className="p-4">
          <p className="text-xs text-muted-foreground">
            <strong className="text-foreground">Privacy:</strong> channel mixing runs locally via the Canvas API.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
