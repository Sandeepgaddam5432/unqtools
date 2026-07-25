"use client";

import React, { useState, useCallback, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ErrorBanner, CopyButton, DownloadButton } from "../../_shared";
import {
  IDENTITY_MATRIX,
  mixPixel,
  validateMatrix,
  isIdentity,
  meanDelta,
  findPreset,
  MATRIX_PRESETS,
  type MixMatrix,
  type OutputFormat,
} from "./logic";
import { toast } from "sonner";

const FIELDS = ["rr", "gr", "br", "rg", "gg", "bg", "rb", "gb", "bb"] as const;

export default function ImageChannelMixer() {
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [fileName, setFileName] = useState("mixed.png");
  const [matrix, setMatrix] = useState<MixMatrix>(IDENTITY_MATRIX);
  const [presetId, setPresetId] = useState("identity");
  const [format, setFormat] = useState<OutputFormat>("image/png");
  const [quality, setQuality] = useState(0.9);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [delta, setDelta] = useState<number | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const onFile = useCallback((file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) { setError("Please choose an image file"); return; }
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => { setImage(img); setFileName(file.name.replace(/\.[^.]+$/, "") + "-mixed.png"); setError(null); setPreviewUrl(null); setDelta(null); };
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
    const original = new Uint8ClampedArray(px);
    for (let i = 0; i < px.length; i += 4) {
      const out = mixPixel({ r: px[i]!, g: px[i + 1]!, b: px[i + 2]!, a: px[i + 3]! }, matrix);
      px[i] = out.r; px[i + 1] = out.g; px[i + 2] = out.b;
    }
    setDelta(meanDelta(original, px));
    ctx.putImageData(data, 0, 0);
    canvas.toBlob((blob) => {
      if (!blob) return;
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      setPreviewUrl(URL.createObjectURL(blob));
    }, format, format === "image/png" ? undefined : quality);
  }, [image, matrix, format, quality, previewUrl]);

  const download = useCallback(() => {
    if (!canvasRef.current) return;
    canvasRef.current.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = fileName; a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      toast.success("Image downloaded");
    }, format, format === "image/png" ? undefined : quality);
  }, [fileName, format, quality]);

  const updateField = (key: keyof MixMatrix, value: string) => {
    setMatrix({ ...matrix, [key]: Number(value) });
    setPresetId("custom");
  };

  const applyPreset = (id: string) => {
    const p = findPreset(id);
    if (p) {
      setMatrix(p.matrix);
      setPresetId(id);
      toast.success(`Preset: ${p.label}`);
    }
  };

  return (
    <div className="space-y-4">
      <Card><CardContent className="p-4 space-y-3">
        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => onFile(e.target.files?.[0])} />
        <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()}>Choose image</Button>
      </CardContent></Card>
      {image && (
        <Card><CardContent className="p-4 space-y-3">
          <div>
            <Label className="text-xs text-muted-foreground">Presets</Label>
            <div className="flex flex-wrap gap-1.5 mt-1">
              {MATRIX_PRESETS.map((p) => (
                <Button key={p.id} size="sm" variant={presetId === p.id ? "default" : "outline"} onClick={() => applyPreset(p.id)}>{p.label}</Button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2 text-xs">
            {FIELDS.map((k) => (
              <div key={k} className="flex flex-col gap-1">
                <Label className="text-muted-foreground">{k}</Label>
                <Input type="number" step="0.1" value={matrix[k]} onChange={(e) => updateField(k, e.target.value)} />
              </div>
            ))}
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Format</Label>
            <select value={format} onChange={(e) => setFormat(e.target.value as OutputFormat)} className="h-9 w-full rounded-md border bg-background px-3 text-sm">
              <option value="image/png">PNG</option>
              <option value="image/jpeg">JPEG</option>
              <option value="image/webp">WebP</option>
            </select>
          </div>
          {format !== "image/png" && (
            <div><Label className="text-xs text-muted-foreground">Quality: {Math.round(quality * 100)}%</Label><input type="range" min={10} max={100} value={Math.round(quality * 100)} onChange={(e) => setQuality(Number(e.target.value) / 100)} className="w-32" /></div>
          )}
          <div className="flex gap-2 flex-wrap">
            <Button size="sm" onClick={apply}>Mix channels</Button>
            <Button variant="outline" size="sm" onClick={download} disabled={!previewUrl}>Download</Button>
            <CopyButton getText={() => JSON.stringify(matrix)} label="Copy matrix" disabled={!previewUrl} />
            <DownloadButton getText={() => previewUrl ?? ""} filename={fileName} disabled={!previewUrl} mime={format} />
          </div>
          {delta !== null && <p className="text-xs text-muted-foreground">Mean pixel delta: {delta.toFixed(2)} {isIdentity(matrix) && "· identity"}</p>}
        </CardContent></Card>
      )}
      <canvas ref={canvasRef} className="hidden" />
      {previewUrl && (
        <Card><CardContent className="p-4">
          <p className="text-xs text-muted-foreground mb-2">Preview</p>
          <img src={previewUrl} alt="Channel mixed preview" className="max-w-full rounded-md border" />
        </CardContent></Card>
      )}
      {error && <ErrorBanner message={error} />}
      <Card><CardContent className="p-4">
        <p className="text-xs text-muted-foreground">
          <strong className="text-foreground">Privacy:</strong> channel mixing runs locally via the Canvas API.
        </p>
      </CardContent></Card>
    </div>
  );
}
