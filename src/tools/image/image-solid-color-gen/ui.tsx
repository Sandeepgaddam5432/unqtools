"use client";

import React, { useState, useCallback, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ErrorBanner, CopyButton, DownloadButton } from "../../_shared";
import {
  parseHex, toHex, toRgbString, rgbToHsl, hslToRgb, rgbToHsv, hsvToRgb,
  complementary, analogous, addToHistory, toCssVar, paletteToJson, paletteToCss,
  randomColor, validateInput, clampDimension, buildFilename,
  type RGBA, type OutputFormat,
} from "./logic";
import { toast } from "sonner";

export default function ImageSolidColorGen() {
  const [hex, setHex] = useState("#3366cc");
  const [width, setWidth] = useState(600);
  const [height, setHeight] = useState(400);
  const [format, setFormat] = useState<OutputFormat>("image/png");
  const [alpha, setAlpha] = useState(1);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<RGBA[]>([]);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const color: RGBA | null = parseHex(hex);

  const generate = useCallback(() => {
    if (!color) { setError("Invalid color hex"); return; }
    const v = validateInput(width, height, format, alpha);
    if ("error" in v) { setError(v.error); return; }
    setError(null);
    const c = { ...color, a: alpha };
    setHistory((h) => addToHistory(h, c));
    const canvas = canvasRef.current;
    if (!canvas) return;
    const cw = clampDimension(width);
    const ch = clampDimension(height);
    canvas.width = cw;
    canvas.height = ch;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.fillStyle = toRgbString(c);
    ctx.fillRect(0, 0, cw, ch);
    canvas.toBlob((blob) => {
      if (!blob) return;
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      setPreviewUrl(URL.createObjectURL(blob));
      toast.success(`Generated ${toHex(c)} at ${cw}×${ch}`);
    }, format);
  }, [color, width, height, format, alpha, previewUrl]);

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

  const applyHsl = (h: number, s: number, l: number) => {
    const rgb = hslToRgb(h, s, l);
    setHex(toHex({ ...rgb, a: alpha }));
  };
  const applyHsv = (h: number, s: number, v: number) => {
    const rgb = hsvToRgb(h, s, v);
    setHex(toHex({ ...rgb, a: alpha }));
  };

  const hsl = color ? rgbToHsl(color.r, color.g, color.b) : null;
  const hsv = color ? rgbToHsv(color.r, color.g, color.b) : null;
  const comp = color ? complementary({ r: color.r, g: color.g, b: color.b }) : null;
  const ana = color ? analogous({ r: color.r, g: color.g, b: color.b }) : null;
  const cssVar = color ? toCssVar({ ...color, a: alpha }) : "";

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div><Label className="text-xs text-muted-foreground">Hex</Label><Input value={hex} onChange={(e) => setHex(e.target.value)} /></div>
            <div><Label className="text-xs text-muted-foreground">Width</Label><Input type="number" min={1} max={8000} value={width} onChange={(e) => setWidth(Number(e.target.value))} /></div>
            <div><Label className="text-xs text-muted-foreground">Height</Label><Input type="number" min={1} max={8000} value={height} onChange={(e) => setHeight(Number(e.target.value))} /></div>
            <div><Label className="text-xs text-muted-foreground">Format</Label>
              <select value={format} onChange={(e) => setFormat(e.target.value as OutputFormat)} className="h-9 w-full rounded-md border bg-background px-3 text-sm">
                <option value="image/png">PNG (alpha)</option>
                <option value="image/jpeg">JPEG</option>
                <option value="image/webp">WebP</option>
              </select>
            </div>
          </div>
          {format === "image/png" && (
            <div><Label className="text-xs text-muted-foreground">Alpha: {alpha.toFixed(2)}</Label>
              <Input type="range" min={0} max={100} value={Math.round(alpha * 100)} onChange={(e) => setAlpha(Number(e.target.value) / 100)} />
            </div>
          )}
          <div className="flex flex-wrap gap-2">
            <Button size="sm" onClick={generate}>Generate</Button>
            <Button variant="outline" size="sm" onClick={download} disabled={!previewUrl}>Download</Button>
            <Button variant="ghost" size="sm" onClick={() => setHex(toHex(randomColor()))}>Random</Button>
            {color && <CopyButton getText={() => toRgbString({ ...color, a: alpha })} label="Copy rgb()" />}
            {color && <CopyButton getText={() => cssVar} label="Copy CSS var" />}
          </div>
          {color && (
            <div className="flex flex-wrap gap-3 items-center">
              <div className="h-12 w-12 rounded border" style={{ background: toRgbString({ ...color, a: alpha }) }} />
              {hsl && <Badge variant="outline">HSL: {hsl.h}, {hsl.s}%, {hsl.l}%</Badge>}
              {hsv && <Badge variant="outline">HSV: {hsv.h}, {hsv.s}%, {hsv.v}%</Badge>}
              {comp && (
                <button className="h-8 w-8 rounded border" style={{ background: toRgbString({ ...comp, a: 1 }) }} title="Complementary" onClick={() => setHex(toHex({ ...comp, a: 1 }))} />
              )}
              {ana && ana.map((c, i) => (
                <button key={i} className="h-8 w-8 rounded border" style={{ background: toRgbString({ ...c, a: 1 }) }} title="Analogous" onClick={() => setHex(toHex({ ...c, a: 1 }))} />
              ))}
            </div>
          )}
          {hsl && (
            <div className="grid grid-cols-3 gap-2">
              <div><Label className="text-xs text-muted-foreground">H</Label><Input type="number" value={hsl.h} onChange={(e) => applyHsl(Number(e.target.value), hsl.s, hsl.l)} /></div>
              <div><Label className="text-xs text-muted-foreground">S</Label><Input type="number" value={hsl.s} onChange={(e) => applyHsl(hsl.h, Number(e.target.value), hsl.l)} /></div>
              <div><Label className="text-xs text-muted-foreground">L</Label><Input type="number" value={hsl.l} onChange={(e) => applyHsl(hsl.h, hsl.s, Number(e.target.value))} /></div>
            </div>
          )}
        </CardContent>
      </Card>

      {history.length > 0 && (
        <Card>
          <CardContent className="p-4 space-y-2">
            <p className="text-xs text-muted-foreground">History</p>
            <div className="flex flex-wrap gap-2">
              {history.map((c, i) => (
                <button key={i} className="h-8 w-8 rounded border" style={{ background: toRgbString(c) }} onClick={() => setHex(toHex(c))} title={toHex(c)} />
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <canvas ref={canvasRef} className="hidden" />
      {previewUrl && (
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground mb-2">Preview</p><img src={previewUrl} alt="Color preview" className="max-w-full rounded-md border" /></CardContent></Card>
      )}
      {error && <ErrorBanner message={error} />}
      {history.length > 0 && (
        <div className="flex flex-wrap gap-2">
          <DownloadButton getText={() => paletteToJson(history)} filename="palette.json" mime="application/json" label="Download JSON" />
          <DownloadButton getText={() => paletteToCss(history)} filename="palette.css" mime="text/css" label="Download CSS" />
        </div>
      )}
      <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground"><strong className="text-foreground">Privacy:</strong> all generation runs locally via the Canvas API.</p></CardContent></Card>
    </div>
  );
}
