"use client";

import React, { useState, useCallback, useRef, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { ErrorBanner, CopyButton, DownloadButton } from "../../_shared";
import {
  rgbToHsl, rgbToHsv, rgbToCmyk, rgbToHex, rgbToCssString, hslToCssString, hsvToString, cmykToString,
  contrastRatio, wcagGrade, contrastText, averageColor, pixelAt, computeLoupeRegion, detectEyeDropperSupport,
  addToHistory, paletteToCssVars, paletteToJson, complementary, analogous,
  buildPaletteFilename, buildColorFilename, type Rgb,
} from "./logic";
import { toast } from "sonner";

export default function ImageColorPickerTool() {
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [picked, setPicked] = useState<Rgb | null>(null);
  const [history, setHistory] = useState<Rgb[]>([]);
  const [sampleSize, setSampleSize] = useState(1);
  const [loupePos, setLoupePos] = useState<{ x: number; y: number } | null>(null);
  const [loupeColors, setLoupeColors] = useState<Rgb[]>([]);
  const [error, setError] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const loupeCanvasRef = useRef<HTMLCanvasElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const onFile = useCallback((file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) { setError("Please choose an image file"); return; }
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => { setImage(img); setPicked(null); setHistory([]); setError(null); setLoupePos(null); };
    img.onerror = () => setError("Could not load image");
    img.src = url;
  }, []);

  const renderCanvas = useCallback(() => {
    if (!image || !canvasRef.current) return;
    const canvas = canvasRef.current;
    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(image, 0, 0);
  }, [image]);

  useEffect(() => { renderCanvas(); }, [renderCanvas]);

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
    const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
    const color = sampleSize > 1
      ? averageColor(data, canvas.width, canvas.height, x, y, sampleSize)
      : pixelAt(data, canvas.width, x, y);
    setPicked(color);
    setHistory((h) => addToHistory(h, color));
  }, [image, sampleSize]);

  const onCanvasMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!image || !canvasRef.current || !loupeCanvasRef.current) return;
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const x = Math.floor((e.clientX - rect.left) * scaleX);
    const y = Math.floor((e.clientY - rect.top) * scaleY);
    setLoupePos({ x, y });
    // Render loupe
    const loupe = loupeCanvasRef.current;
    const loupeSize = 144;
    const zoom = 8;
    loupe.width = loupeSize;
    loupe.height = loupeSize;
    const lctx = loupe.getContext("2d");
    if (!lctx) return;
    lctx.imageSmoothingEnabled = false;
    const region = computeLoupeRegion(x, y, canvas.width, canvas.height, loupeSize, zoom);
    lctx.fillStyle = "#000";
    lctx.fillRect(0, 0, loupeSize, loupeSize);
    lctx.drawImage(canvas, region.sx, region.sy, region.sw, region.sh, 0, 0, loupeSize, loupeSize);
    // Center crosshair
    lctx.strokeStyle = "rgba(255,255,255,0.8)";
    lctx.lineWidth = 1;
    lctx.beginPath();
    lctx.moveTo(loupeSize / 2, 0); lctx.lineTo(loupeSize / 2, loupeSize);
    lctx.moveTo(0, loupeSize / 2); lctx.lineTo(loupeSize, loupeSize / 2);
    lctx.stroke();
    // Sample a small grid for hover info
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
    const colors: Rgb[] = [];
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const px = Math.max(0, Math.min(canvas.width - 1, x + dx));
        const py = Math.max(0, Math.min(canvas.height - 1, y + dy));
        colors.push(pixelAt(data, canvas.width, px, py));
      }
    }
    setLoupeColors(colors);
  }, [image]);

  const useEyeDropper = useCallback(async () => {
    if (!detectEyeDropperSupport()) {
      toast.error("EyeDropper API not supported in this browser");
      return;
    }
    try {
      const EyeDropper = (window as unknown as { EyeDropper: new () => { open: () => Promise<{ sRGBHex: string }> } }).EyeDropper;
      const dropper = new EyeDropper();
      const result = await dropper.open();
      const hex = result.sRGBHex;
      const r = parseInt(hex.slice(1, 3), 16);
      const g = parseInt(hex.slice(3, 5), 16);
      const b = parseInt(hex.slice(5, 7), 16);
      const color = { r, g, b };
      setPicked(color);
      setHistory((h) => addToHistory(h, color));
      toast.success(`Picked ${hex}`);
    } catch {
      toast.error("EyeDropper canceled");
    }
  }, []);

  const info = picked ? {
    hex: rgbToHex(picked),
    rgb: rgbToCssString(picked),
    hsl: rgbToHsl(picked),
    hsv: rgbToHsv(picked),
    cmyk: rgbToCmyk(picked),
    text: contrastText(picked),
  } : null;

  const contrastWithWhite = picked ? contrastRatio(picked, { r: 255, g: 255, b: 255 }) : 0;
  const contrastWithBlack = picked ? contrastRatio(picked, { r: 0, g: 0, b: 0 }) : 0;

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4 space-y-3">
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => onFile(e.target.files?.[0])} />
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()}>Choose image</Button>
            <Button variant="outline" size="sm" onClick={useEyeDropper}>Use system EyeDropper</Button>
          </div>
        </CardContent>
      </Card>

      {image && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="flex flex-wrap items-end gap-3">
              <div className="w-40">
                <Label className="text-xs text-muted-foreground">Sample size: {sampleSize}×{sampleSize}</Label>
                <Slider value={[sampleSize]} onValueChange={(v) => setSampleSize(v[0]!)} min={1} max={11} step={2} />
              </div>
            </div>
            <div className="flex flex-wrap gap-4">
              <div className="relative">
                <canvas ref={canvasRef} onClick={onCanvasClick} onMouseMove={onCanvasMove} className="max-w-full max-h-[500px] rounded-md border cursor-crosshair" />
              </div>
              {loupePos && (
                <div className="flex flex-col gap-2">
                  <canvas ref={loupeCanvasRef} className="rounded-md border" style={{ width: 144, height: 144 }} />
                  <p className="text-xs text-muted-foreground">Pixel: ({loupePos.x}, {loupePos.y})</p>
                  <div className="grid grid-cols-3 gap-0.5 w-36">
                    {loupeColors.map((c, i) => (
                      <div key={i} className="aspect-square rounded-sm border" style={{ backgroundColor: rgbToHex(c) }} title={rgbToHex(c)} />
                    ))}
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {picked && info && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center gap-3">
              <div className="w-20 h-20 rounded-md border flex items-center justify-center" style={{ backgroundColor: info.hex, color: info.text }}>
                <span className="text-xs font-mono">Aa</span>
              </div>
              <div className="space-y-1 flex-1">
                <p className="text-sm font-mono">HEX: {info.hex}</p>
                <p className="text-sm font-mono">RGB: {info.rgb}</p>
                <p className="text-sm font-mono">HSL: {hslToCssString(info.hsl)}</p>
                <p className="text-sm font-mono">HSV: {hsvToString(info.hsv)}</p>
                <p className="text-sm font-mono">CMYK: {cmykToString(info.cmyk)}</p>
              </div>
            </div>
            <div className="border-t pt-3">
              <p className="text-xs font-medium mb-2">WCAG Contrast</p>
              <div className="flex gap-3">
                <div className="flex-1 rounded border p-2 text-center" style={{ backgroundColor: "#fff", color: "#000" }}>
                  <p className="text-xs">vs white</p>
                  <p className="text-lg font-bold">{contrastWithWhite.toFixed(2)}</p>
                  <p className="text-xs">{wcagGrade(contrastWithWhite)}</p>
                </div>
                <div className="flex-1 rounded border p-2 text-center" style={{ backgroundColor: "#000", color: "#fff" }}>
                  <p className="text-xs">vs black</p>
                  <p className="text-lg font-bold">{contrastWithBlack.toFixed(2)}</p>
                  <p className="text-xs">{wcagGrade(contrastWithBlack)}</p>
                </div>
              </div>
            </div>
            <div className="border-t pt-3">
              <p className="text-xs font-medium mb-2">Color harmonies</p>
              <div className="flex gap-2">
                <div className="text-center">
                  <div className="w-12 h-12 rounded border" style={{ backgroundColor: info.hex }} />
                  <p className="text-[10px] mt-1">Picked</p>
                </div>
                <div className="text-center">
                  <div className="w-12 h-12 rounded border" style={{ backgroundColor: rgbToHex(complementary(picked)) }} />
                  <p className="text-[10px] mt-1">Complement</p>
                </div>
                <div className="text-center">
                  <div className="w-12 h-12 rounded border" style={{ backgroundColor: rgbToHex(analogous(picked).left) }} />
                  <p className="text-[10px] mt-1">Analog −</p>
                </div>
                <div className="text-center">
                  <div className="w-12 h-12 rounded border" style={{ backgroundColor: rgbToHex(analogous(picked).right) }} />
                  <p className="text-[10px] mt-1">Analog +</p>
                </div>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <CopyButton getText={() => info.hex} label="HEX" />
              <CopyButton getText={() => info.rgb} label="RGB" />
              <CopyButton getText={() => hslToCssString(info.hsl)} label="HSL" />
              <CopyButton getText={() => hsvToString(info.hsv)} label="HSV" />
              <CopyButton getText={() => cmykToString(info.cmyk)} label="CMYK" />
              <DownloadButton getText={() => `${info.hex}\n${info.rgb}\n${hslToCssString(info.hsl)}\n${hsvToString(info.hsv)}\n${cmykToString(info.cmyk)}`} filename={buildColorFilename(picked)} />
            </div>
          </CardContent>
        </Card>
      )}

      {history.length > 0 && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium">Picked history ({history.length})</p>
              <div className="flex gap-2">
                <CopyButton getText={() => paletteToCssVars(history)} label="Copy CSS vars" />
                <CopyButton getText={() => paletteToJson(history)} label="Copy JSON" />
                <DownloadButton getText={() => paletteToCssVars(history)} filename={buildPaletteFilename("css")} />
                <DownloadButton getText={() => paletteToJson(history)} filename={buildPaletteFilename("json")} />
                <Button variant="ghost" size="sm" onClick={() => setHistory([])}>Clear</Button>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {history.map((c, i) => (
                <button key={i} onClick={() => setPicked(c)} className="relative w-12 h-12 rounded border" style={{ backgroundColor: rgbToHex(c) }} title={`${rgbToHex(c)} (click to load)`} />
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {error && <ErrorBanner message={error} />}
      <Card>
        <CardContent className="p-4">
          <p className="text-xs text-muted-foreground"><strong className="text-foreground">Privacy:</strong> color picking runs locally via Canvas API.</p>
        </CardContent>
      </Card>
    </div>
  );
}
