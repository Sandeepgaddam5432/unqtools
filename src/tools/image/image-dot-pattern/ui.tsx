"use client";

import React, { useState, useCallback, useRef, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ErrorBanner, CopyButton, DownloadButton } from "../../_shared";
import {
  dotRadiusFromBrightness, cellCenter, validateDotOptions,
  generateCellGrid, cellCount, fmt,
  type PatternType,
} from "./logic";
import { toast } from "sonner";

export default function ImageDotPattern() {
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [fileName, setFileName] = useState("halftone.png");
  const [cellSize, setCellSize] = useState(8);
  const [maxRadius, setMaxRadius] = useState(0.5);
  const [angle, setAngle] = useState(45);
  const [fgColor, setFgColor] = useState("#000000");
  const [bgColor, setBgColor] = useState("#FFFFFF");
  const [pattern, setPattern] = useState<PatternType>("grid");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const fgGray = useMemo(() => {
    const m = /^#?([0-9a-f]{6})$/i.exec(fgColor.trim());
    if (!m) return 0;
    return Math.round(0.299 * parseInt(m[1]!.slice(0, 2), 16) + 0.587 * parseInt(m[1]!.slice(2, 4), 16) + 0.114 * parseInt(m[1]!.slice(4, 6), 16));
  }, [fgColor]);

  const bgGray = useMemo(() => {
    const m = /^#?([0-9a-f]{6})$/i.exec(bgColor.trim());
    if (!m) return 255;
    return Math.round(0.299 * parseInt(m[1]!.slice(0, 2), 16) + 0.587 * parseInt(m[1]!.slice(2, 4), 16) + 0.114 * parseInt(m[1]!.slice(4, 6), 16));
  }, [bgColor]);

  const cellCountVal = useMemo(() => image ? cellCount(image.naturalWidth, image.naturalHeight, cellSize) : 0, [image, cellSize]);

  const onFile = useCallback((file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) { setError("Please choose an image file"); return; }
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => { setImage(img); setFileName(file.name.replace(/\.[^.]+$/, "") + "-halftone.png"); setError(null); setPreviewUrl(null); };
    img.onerror = () => setError("Could not load image");
    img.src = url;
  }, []);

  const apply = useCallback(() => {
    if (!image || !canvasRef.current) return;
    const opts = { cellSize, maxRadius, fg: fgGray, bg: bgGray, angle, pattern };
    const v = validateDotOptions(opts);
    if ("error" in v) { setError(v.error); return; }
    setError(null);
    const canvas = canvasRef.current;
    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const tmp = document.createElement("canvas");
    tmp.width = canvas.width; tmp.height = canvas.height;
    const tctx = tmp.getContext("2d");
    if (!tctx) return;
    tctx.drawImage(image, 0, 0);
    const src = tctx.getImageData(0, 0, canvas.width, canvas.height).data;
    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = fgColor;
    const cells = generateCellGrid(canvas.width, canvas.height, opts);
    for (const cell of cells) {
      const center = cellCenter(cell.cx, cell.cy, opts);
      let sum = 0, count = 0;
      for (let dy = 0; dy < cellSize; dy++) {
        for (let dx = 0; dx < cellSize; dx++) {
          const px = Math.round(center.x - cellSize / 2 + dx);
          const py = Math.round(center.y - cellSize / 2 + dy);
          if (px < 0 || py < 0 || px >= canvas.width || py >= canvas.height) continue;
          const i = (py * canvas.width + px) * 4;
          sum += 0.299 * src[i]! + 0.587 * src[i + 1]! + 0.114 * src[i + 2]!;
          count++;
        }
      }
      if (count === 0) continue;
      const r = dotRadiusFromBrightness(sum / count, opts);
      if (r > 0.1) {
        ctx.beginPath();
        ctx.arc(center.x, center.y, r, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    canvas.toBlob((blob) => {
      if (!blob) return;
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      setPreviewUrl(URL.createObjectURL(blob));
      toast.success("Halftone applied");
    }, "image/png");
  }, [image, cellSize, maxRadius, angle, pattern, fgColor, bgColor, fgGray, bgGray, previewUrl]);

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

  const csv = `Field,Value\nCell size,${cellSize}\nMax radius,${maxRadius}\nAngle,${angle}\nPattern,${pattern}\nFG,${fgColor}\nBG,${bgColor}\nCells,${cellCountVal}`;

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
              {(["grid", "hex", "diagonal"] as PatternType[]).map((p) => (
                <Button key={p} size="sm" variant={pattern === p ? "default" : "outline"} onClick={() => setPattern(p)}>{p}</Button>
              ))}
            </div>
            <div><Label className="text-xs text-muted-foreground">Cell size: {cellSize}px</Label><input type="range" min={2} max={32} value={cellSize} onChange={(e) => setCellSize(Number(e.target.value))} className="w-full" /></div>
            <div><Label className="text-xs text-muted-foreground">Max dot radius: {Math.round(maxRadius * 100)}%</Label><input type="range" min={10} max={70} value={Math.round(maxRadius * 100)} onChange={(e) => setMaxRadius(Number(e.target.value) / 100)} className="w-full" /></div>
            <div><Label className="text-xs text-muted-foreground">Grid angle: {angle}°</Label><input type="range" min={0} max={90} value={angle} onChange={(e) => setAngle(Number(e.target.value))} className="w-full" /></div>
            <div className="flex gap-3 text-xs items-center">
              <span>Dot color:</span>
              <input type="color" value={fgColor} onChange={(e) => setFgColor(e.target.value)} className="h-9 w-12 rounded-md border bg-background" />
              <span>Background:</span>
              <input type="color" value={bgColor} onChange={(e) => setBgColor(e.target.value)} className="h-9 w-12 rounded-md border bg-background" />
            </div>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" onClick={apply}>Apply halftone</Button>
              <Button variant="outline" size="sm" onClick={download} disabled={!previewUrl}>Download</Button>
              <CopyButton getText={() => csv} label="Copy CSV" />
              <DownloadButton getText={() => csv} filename="dot-pattern.csv" mime="text/csv" />
              <Button size="sm" variant="ghost" onClick={() => { setCellSize(8); setMaxRadius(0.5); setAngle(45); setFgColor("#000000"); setBgColor("#FFFFFF"); setPattern("grid"); }}>Reset</Button>
            </div>
            <div className="flex flex-wrap gap-2 text-xs">
              <Badge variant="outline">{image.naturalWidth}×{image.naturalHeight}px</Badge>
              <Badge variant="outline">{fmt(cellCountVal, 0)} cells</Badge>
              <Badge variant="outline">Pattern: {pattern}</Badge>
            </div>
          </CardContent>
        </Card>
      )}

      <canvas ref={canvasRef} className="hidden" />
      {previewUrl && (
        <Card><CardContent className="p-4">
          <p className="text-xs text-muted-foreground mb-2">Preview</p>
          <img src={previewUrl} alt="Halftone preview" className="max-w-full rounded-md border" />
        </CardContent></Card>
      )}
      {error && <ErrorBanner message={error} />}
      <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground"><strong className="text-foreground">Privacy:</strong> halftone rendering runs locally via the Canvas API.</p></CardContent></Card>
    </div>
  );
}
