"use client";

import React, { useState, useCallback, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { ErrorBanner, CopyButton, DownloadButton } from "../../_shared";
import { makeRng, validateGlitchParams, luma, datamoshBlocks, channelShiftOffsets, sortByBrightness, type GlitchMode } from "./logic";
import { toast } from "sonner";

export default function ImageGlitchArt() {
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [fileName, setFileName] = useState("glitch.png");
  const [mode, setMode] = useState<GlitchMode>("channel-shift");
  const [intensity, setIntensity] = useState(50);
  const [shift, setShift] = useState(20);
  const [seed, setSeed] = useState(42);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const onFile = useCallback((file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) { setError("Please choose an image file"); return; }
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => { setImage(img); setFileName(file.name.replace(/\.[^.]+$/, "") + "-glitch.png"); setError(null); setPreviewUrl(null); };
    img.onerror = () => setError("Could not load image");
    img.src = url;
  }, []);

  const apply = useCallback(() => {
    if (!image || !canvasRef.current) return;
    const v = validateGlitchParams({ mode, intensity, shift, seed });
    if ("error" in v) { setError(v.error); return; }
    setError(null);
    const canvas = canvasRef.current;
    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(image, 0, 0);
    const data = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const px = data.data, w = canvas.width, h = canvas.height;
    const rng = makeRng(seed);
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
    } else {
      // pixel-sort per row by luma
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
          if (luma(r, g, b) > threshold) { px[i] = r; px[i + 1] = g; px[i + 2] = b; }
        }
      }
    }
    ctx.putImageData(data, 0, 0);
    canvas.toBlob((blob) => {
      if (!blob) return;
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      setPreviewUrl(URL.createObjectURL(blob));
    }, "image/png");
  }, [image, mode, intensity, shift, seed, previewUrl]);

  const download = useCallback(() => {
    if (!canvasRef.current) return;
    canvasRef.current.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = fileName; a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      toast.success("Image downloaded");
    }, "image/png");
  }, [fileName]);

  return (
    <div className="space-y-4">
      <Card><CardContent className="p-4 space-y-3">
        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => onFile(e.target.files?.[0])} />
        <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()}>Choose image</Button>
      </CardContent></Card>
      {image && (
        <Card><CardContent className="p-4 space-y-3">
          <div className="flex gap-2">
            {(["pixel-sort", "channel-shift", "datamosh"] as GlitchMode[]).map((m) => (
              <Button key={m} size="sm" variant={mode === m ? "default" : "outline"} onClick={() => setMode(m)}>{m}</Button>
            ))}
          </div>
          <div><Label className="text-xs text-muted-foreground">Intensity: {intensity}</Label><input type="range" min={0} max={100} value={intensity} onChange={(e) => setIntensity(Number(e.target.value))} className="w-full" /></div>
          <div><Label className="text-xs text-muted-foreground">Shift: {shift}</Label><input type="range" min={0} max={100} value={shift} onChange={(e) => setShift(Number(e.target.value))} className="w-full" /></div>
          <div><Label className="text-xs text-muted-foreground">Seed: {seed}</Label><input type="number" value={seed} onChange={(e) => setSeed(Number(e.target.value))} className="w-full rounded-md border px-2 py-1 text-sm" /></div>
          <div className="flex gap-2 flex-wrap">
            <Button size="sm" onClick={apply}>Glitch</Button>
            <Button variant="outline" size="sm" onClick={download} disabled={!previewUrl}>Download</Button>
            {previewUrl && <CopyButton getText={() => previewUrl} label="Copy URL" />}
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
      <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground"><strong className="text-foreground">Privacy:</strong> glitch effects run locally via Canvas API.</p></CardContent></Card>
    </div>
  );
}
