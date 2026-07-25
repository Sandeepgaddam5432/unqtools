"use client";

import React, { useState, useCallback, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ErrorBanner, CopyButton, DownloadButton } from "../../_shared";
import { rgbToHsl, rgbToHex, contrastText, type Rgb } from "./logic";

export default function ImageColorPickerTool() {
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [picked, setPicked] = useState<Rgb | null>(null);
  const [error, setError] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const onFile = useCallback((file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) { setError("Please choose an image file"); return; }
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => { setImage(img); setPicked(null); setError(null); };
    img.onerror = () => setError("Could not load image");
    img.src = url;
  }, []);

  const onCanvasClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!image || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const x = Math.floor((e.clientX - rect.left) * scaleX);
    const y = Math.floor((e.clientY - rect.top) * scaleY);
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const px = ctx.getImageData(x, y, 1, 1).data;
    setPicked({ r: px[0]!, g: px[1]!, b: px[2]! });
  }, [image]);

  const info = picked ? {
    hex: rgbToHex(picked),
    hsl: rgbToHsl(picked),
    text: contrastText(picked),
  } : null;

  const renderCanvas = useCallback(() => {
    if (!image || !canvasRef.current) return;
    const canvas = canvasRef.current;
    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(image, 0, 0);
  }, [image]);

  React.useEffect(() => { renderCanvas(); }, [renderCanvas]);

  return (
    <div className="space-y-4">
      <Card><CardContent className="p-4 space-y-3">
        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => onFile(e.target.files?.[0])} />
        <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()}>Choose image</Button>
      </CardContent></Card>
      {image && (
        <Card><CardContent className="p-4">
          <p className="text-xs text-muted-foreground mb-2">Click on the image to pick a color</p>
          <canvas ref={canvasRef} onClick={onCanvasClick} className="max-w-full rounded-md border cursor-crosshair" />
        </CardContent></Card>
      )}
      {picked && info && (
        <Card><CardContent className="p-4 space-y-3">
          <div className="flex items-center gap-3">
            <div className="w-16 h-16 rounded-md border" style={{ backgroundColor: info.hex }} />
            <div className="space-y-1">
              <p className="text-sm font-mono">HEX: {info.hex}</p>
              <p className="text-sm font-mono">RGB: rgb({picked.r}, {picked.g}, {picked.b})</p>
              <p className="text-sm font-mono">HSL: hsl({Math.round(info.hsl.h)}, {(info.hsl.s * 100).toFixed(0)}%, {(info.hsl.l * 100).toFixed(0)}%)</p>
            </div>
          </div>
          <div className="flex gap-2">
            <CopyButton getText={() => info.hex} label="Copy HEX" />
            <CopyButton getText={() => `rgb(${picked.r}, ${picked.g}, ${picked.b})`} label="Copy RGB" />
            <DownloadButton getText={() => `${info.hex}\nrgb(${picked.r}, ${picked.g}, ${picked.b})\nhsl(${Math.round(info.hsl.h)}, ${(info.hsl.s * 100).toFixed(1)}%, ${(info.hsl.l * 100).toFixed(1)}%)`} filename="color.txt" />
          </div>
        </CardContent></Card>
      )}
      {error && <ErrorBanner message={error} />}
      <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground"><strong className="text-foreground">Privacy:</strong> color picking runs locally via Canvas API.</p></CardContent></Card>
    </div>
  );
}
