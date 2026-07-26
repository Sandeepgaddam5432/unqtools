"use client";

import React, { useState, useCallback, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ErrorBanner, CopyButton, DownloadButton } from "../../_shared";
import {
  ASPECT_PRESETS, clampDimension, parseHex, toHex, autoTextColor,
  makeRng, patternPixel, autoFontSize, validateOptions, applyAspect,
  dimensionLabel, buildFilename, type PatternType, type OutputFormat, type AspectPreset,
} from "./logic";
import { toast } from "sonner";

export default function ImagePlaceholderGen() {
  const [width, setWidth] = useState(600);
  const [height, setHeight] = useState(400);
  const [bgHex, setBgHex] = useState("#3366cc");
  const [pattern, setPattern] = useState<PatternType>("solid");
  const [secondaryHex, setSecondaryHex] = useState("#ffffff");
  const [text, setText] = useState("Placeholder");
  const [textHex, setTextHex] = useState("#ffffff");
  const [fontSize, setFontSize] = useState(24);
  const [format, setFormat] = useState<OutputFormat>("image/png");
  const [seed, setSeed] = useState(42);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const generate = useCallback(() => {
    const opts = { width, height, bgHex, pattern, secondaryHex, text, textHex, fontSize, format, seed };
    const v = validateOptions(opts);
    if ("error" in v) { setError(v.error); return; }
    setError(null);
    const canvas = canvasRef.current;
    if (!canvas) return;
    const cw = clampDimension(width);
    const ch = clampDimension(height);
    canvas.width = cw;
    canvas.height = ch;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const bg = parseHex(bgHex)!;
    const sec = parseHex(secondaryHex)!;
    const rng = makeRng(seed);
    const img = ctx.createImageData(cw, ch);
    for (let y = 0; y < ch; y++) {
      for (let x = 0; x < cw; x++) {
        const p = patternPixel(x, y, cw, ch, pattern, bg, sec, rng);
        const i = (y * cw + x) * 4;
        img.data[i] = p.r; img.data[i + 1] = p.g; img.data[i + 2] = p.b; img.data[i + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
    if (text) {
      const tx = parseHex(textHex);
      const tc = tx ? `${toHex(tx.r, tx.g, tx.b)}` : autoTextColor(bg.r, bg.g, bg.b);
      ctx.fillStyle = tc;
      ctx.font = `bold ${fontSize}px sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(text, cw / 2, ch / 2);
    }
    canvas.toBlob((blob) => {
      if (!blob) return;
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      setPreviewUrl(URL.createObjectURL(blob));
      toast.success(`Generated ${dimensionLabel(cw, ch)} placeholder`);
    }, format);
  }, [width, height, bgHex, pattern, secondaryHex, text, textHex, fontSize, format, seed, previewUrl]);

  const download = useCallback(() => {
    if (!canvasRef.current) return;
    canvasRef.current.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = buildFilename(clampDimension(width), clampDimension(height), format); a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      toast.success("Image downloaded");
    }, format);
  }, [width, height, format]);

  const applyPreset = (preset: AspectPreset) => {
    const d = applyAspect(preset, 1080);
    setWidth(d.width);
    setHeight(d.height);
  };

  const autoFs = () => setFontSize(autoFontSize(width, height, text));
  const cssVar = `--placeholder-bg: ${bgHex}; --placeholder-fg: ${textHex};`;

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex flex-wrap gap-2">
            {ASPECT_PRESETS.map((p) => (
              <Button key={p.label} size="sm" variant="outline" onClick={() => applyPreset(p.label)}>{p.label}</Button>
            ))}
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div><Label className="text-xs text-muted-foreground">Width</Label><Input type="number" min={1} max={4000} value={width} onChange={(e) => setWidth(Number(e.target.value))} /></div>
            <div><Label className="text-xs text-muted-foreground">Height</Label><Input type="number" min={1} max={4000} value={height} onChange={(e) => setHeight(Number(e.target.value))} /></div>
            <div><Label className="text-xs text-muted-foreground">BG color</Label><Input value={bgHex} onChange={(e) => setBgHex(e.target.value)} /></div>
            <div><Label className="text-xs text-muted-foreground">Secondary</Label><Input value={secondaryHex} onChange={(e) => setSecondaryHex(e.target.value)} /></div>
          </div>
          <div className="flex flex-wrap gap-2 items-end">
            <div><Label className="text-xs text-muted-foreground">Pattern</Label>
              <select value={pattern} onChange={(e) => setPattern(e.target.value as PatternType)} className="h-9 rounded-md border bg-background px-3 text-sm">
                <option value="solid">Solid</option><option value="gradient">Gradient</option><option value="checkerboard">Checkerboard</option><option value="noise">Noise</option>
              </select>
            </div>
            <div><Label className="text-xs text-muted-foreground">Format</Label>
              <select value={format} onChange={(e) => setFormat(e.target.value as OutputFormat)} className="h-9 rounded-md border bg-background px-3 text-sm">
                <option value="image/png">PNG</option><option value="image/jpeg">JPEG</option><option value="image/webp">WebP</option>
              </select>
            </div>
            <div><Label className="text-xs text-muted-foreground">Seed</Label><Input type="number" value={seed} onChange={(e) => setSeed(Number(e.target.value))} className="w-24" /></div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div><Label className="text-xs text-muted-foreground">Text</Label><Input value={text} onChange={(e) => setText(e.target.value)} /></div>
            <div><Label className="text-xs text-muted-foreground">Text color</Label><Input value={textHex} onChange={(e) => setTextHex(e.target.value)} /></div>
            <div><Label className="text-xs text-muted-foreground">Font size: {fontSize}</Label><Input type="number" value={fontSize} onChange={(e) => setFontSize(Number(e.target.value))} /></div>
            <div className="flex items-end"><Button variant="ghost" size="sm" onClick={autoFs}>Auto-fit</Button></div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" onClick={generate}>Generate</Button>
            <Button variant="outline" size="sm" onClick={download} disabled={!previewUrl}>Download</Button>
            <CopyButton getText={() => cssVar} label="Copy CSS vars" />
            <Button variant="ghost" size="sm" onClick={() => { setBgHex("#" + Math.floor(Math.random() * 0xffffff).toString(16).padStart(6, "0")); }}>Random color</Button>
          </div>
          <Badge variant="outline">{dimensionLabel(clampDimension(width), clampDimension(height))}</Badge>
        </CardContent>
      </Card>
      <canvas ref={canvasRef} className="hidden" />
      {previewUrl && (
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground mb-2">Preview</p>
            <img src={previewUrl} alt="Placeholder preview" className="max-w-full rounded-md border" />
          </CardContent>
        </Card>
      )}
      {error && <ErrorBanner message={error} />}
      <DownloadButton getText={() => cssVar} filename="placeholder-vars.css" mime="text/css" label="Download CSS" />
      <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground"><strong className="text-foreground">Privacy:</strong> all generation runs locally via the Canvas API.</p></CardContent></Card>
    </div>
  );
}
