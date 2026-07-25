"use client";

import React, { useState, useCallback, useRef, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ErrorBanner, CopyButton, DownloadButton } from "../../_shared";
import {
  sepiaPixel,
  tintPixel,
  vignetteFactor,
  validateSepiaOptions,
  cssFilter,
  preservesAlpha,
  isIdentity,
  presetList,
  VINTAGE_PRESETS,
  type VintagePreset,
  type OutputFormat,
  type RgbPixel,
} from "./logic";
import { toast } from "sonner";

export default function ImageSepiaFilter() {
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [fileName, setFileName] = useState("sepia.png");
  const [strength, setStrength] = useState(1);
  const [preset, setPreset] = useState<VintagePreset>("classic");
  const [tintStrength, setTintStrength] = useState(0);
  const [tint, setTint] = useState<RgbPixel>({ r: 200, g: 100, b: 50, a: 255 });
  const [vignette, setVignette] = useState(0);
  const [format, setFormat] = useState<OutputFormat>("image/png");
  const [quality, setQuality] = useState(0.9);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const onFile = useCallback((file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("Please choose an image file.");
      return;
    }
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      setImage(img);
      setFileName(file.name.replace(/\.[^.]+$/, "") + "-sepia.png");
      setError(null);
    };
    img.onerror = () => setError("Could not load image.");
    img.src = url;
  }, []);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    onFile(e.dataTransfer.files?.[0]);
  }, [onFile]);

  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      for (const item of items) {
        if (item.type.startsWith("image/")) {
          const f = item.getAsFile();
          if (f) onFile(f);
          break;
        }
      }
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [onFile]);

  const apply = useCallback(() => {
    if (!image || !canvasRef.current) return;
    const v = validateSepiaOptions({ strength });
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
    const cx = canvas.width / 2;
    const cy = canvas.height / 2;
    const maxDist = Math.sqrt(cx * cx + cy * cy);
    for (let y = 0; y < canvas.height; y++) {
      for (let x = 0; x < canvas.width; x++) {
        const i = (y * canvas.width + x) * 4;
        let p: RgbPixel = { r: px[i]!, g: px[i + 1]!, b: px[i + 2]!, a: px[i + 3]! };
        if (strength > 0) {
          p = sepiaPixel(p, strength, preset);
        }
        if (tintStrength > 0) {
          p = tintPixel(p, tint, tintStrength);
        }
        if (vignette > 0) {
          const dx = x - cx;
          const dy = y - cy;
          const r = Math.sqrt(dx * dx + dy * dy) / maxDist;
          const f = vignetteFactor(r, vignette);
          p = { r: Math.round(p.r * f), g: Math.round(p.g * f), b: Math.round(p.b * f), a: p.a };
        }
        px[i] = p.r;
        px[i + 1] = p.g;
        px[i + 2] = p.b;
      }
    }
    ctx.putImageData(data, 0, 0);
    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        if (previewUrl) URL.revokeObjectURL(previewUrl);
        setPreviewUrl(URL.createObjectURL(blob));
        toast.success("Sepia applied");
      },
      format,
      format === "image/png" ? undefined : quality,
    );
  }, [image, strength, preset, tintStrength, tint, vignette, format, quality, previewUrl]);

  // Live preview
  useEffect(() => {
    if (!image) return;
    const t = setTimeout(() => apply(), 100);
    return () => clearTimeout(t);
  }, [image, apply]);

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

  const cssString = cssFilter({ strength }, preset);

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4 space-y-3">
          <div
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={onDrop}
            className={`border-2 border-dashed rounded-lg p-6 text-center ${dragOver ? "border-primary bg-primary/5" : "border-border"}`}
          >
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => onFile(e.target.files?.[0])} />
            <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()}>Choose image</Button>
            <p className="text-xs text-muted-foreground mt-2">or drag-drop, or paste (Ctrl+V)</p>
          </div>
          {image && (
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant="outline">{image.naturalWidth} × {image.naturalHeight}</Badge>
              <Badge variant="secondary">{VINTAGE_PRESETS[preset].label}</Badge>
            </div>
          )}
        </CardContent>
      </Card>

      {image && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <Label className="text-xs text-muted-foreground">Vintage preset</Label>
            <div className="flex flex-wrap gap-2">
              {presetList().map((p) => (
                <Button key={p.id} size="sm" variant={preset === p.id ? "default" : "outline"} onClick={() => setPreset(p.id)} title={p.description}>
                  {p.label}
                </Button>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">{VINTAGE_PRESETS[preset].description}</p>

            <div>
              <Label className="text-xs text-muted-foreground">Strength: {Math.round(strength * 100)}%</Label>
              <input type="range" min={0} max={100} value={Math.round(strength * 100)} onChange={(e) => setStrength(Number(e.target.value) / 100)} className="w-full" />
            </div>

            <div>
              <Label className="text-xs text-muted-foreground">Tint: {Math.round(tintStrength * 100)}%</Label>
              <div className="flex items-center gap-2">
                <input type="color" value={`#${[tint.r, tint.g, tint.b].map((v) => v.toString(16).padStart(2, "0")).join("")}`} onChange={(e) => {
                  const hex = e.target.value;
                  setTint({ r: parseInt(hex.slice(1, 3), 16), g: parseInt(hex.slice(3, 5), 16), b: parseInt(hex.slice(5, 7), 16), a: 255 });
                }} />
                <input type="range" min={0} max={100} value={Math.round(tintStrength * 100)} onChange={(e) => setTintStrength(Number(e.target.value) / 100)} className="flex-1" />
              </div>
            </div>

            <div>
              <Label className="text-xs text-muted-foreground">Vignette: {Math.round(vignette * 100)}%</Label>
              <input type="range" min={0} max={100} value={Math.round(vignette * 100)} onChange={(e) => setVignette(Number(e.target.value) / 100)} className="w-full" />
            </div>

            <div className="flex flex-wrap gap-3 items-end pt-2">
              <div>
                <Label className="text-xs text-muted-foreground">Format</Label>
                <select value={format} onChange={(e) => setFormat(e.target.value as OutputFormat)} className="h-9 rounded-md border bg-background px-3 text-sm">
                  <option value="image/png">PNG (alpha)</option>
                  <option value="image/jpeg">JPEG (small)</option>
                  <option value="image/webp">WebP</option>
                </select>
              </div>
              {format !== "image/png" && (
                <div>
                  <Label className="text-xs text-muted-foreground">Quality: {Math.round(quality * 100)}%</Label>
                  <Input type="range" min={10} max={100} value={Math.round(quality * 100)} onChange={(e) => setQuality(Number(e.target.value) / 100)} className="w-32" />
                </div>
              )}
            </div>
            {!preservesAlpha(format) && (
              <p className="text-xs text-yellow-700 dark:text-yellow-400">⚠️ JPEG does not preserve transparency.</p>
            )}
            <div className="flex flex-wrap gap-2">
              <Button size="sm" onClick={apply}>Apply</Button>
              <Button variant="outline" size="sm" onClick={() => { setStrength(1); setPreset("classic"); setTintStrength(0); setVignette(0); }}>Reset</Button>
              <CopyButton getText={() => cssString} label="Copy CSS filter" />
              <DownloadButton
                getText={async () => {
                  if (!canvasRef.current) return "";
                  return await new Promise<string>((resolve) => {
                    canvasRef.current!.toBlob(
                      (blob) => {
                        if (!blob) return resolve("");
                        const reader = new FileReader();
                        reader.onload = () => resolve(reader.result as string);
                        reader.readAsDataURL(blob);
                      },
                      format,
                      format === "image/png" ? undefined : quality,
                    );
                  });
                }}
                filename={fileName}
                mime={format}
                label="Download"
                disabled={!previewUrl}
              />
            </div>
          </CardContent>
        </Card>
      )}

      <canvas ref={canvasRef} className="hidden" />
      {previewUrl && (
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground mb-2">Preview</p>
            <img src={previewUrl} alt="Sepia preview" className="max-w-full rounded-md border" />
          </CardContent>
        </Card>
      )}
      {error && <ErrorBanner message={error} />}
      <Card>
        <CardContent className="p-4">
          <p className="text-xs text-muted-foreground">
            <strong className="text-foreground">Privacy:</strong> sepia conversion runs locally via the Canvas API. Vintage presets, tint, vignette, and CSS export — all in-browser.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
