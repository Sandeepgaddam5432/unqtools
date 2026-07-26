"use client";

import React, { useState, useCallback, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ErrorBanner, CopyButton, DownloadButton } from "../../_shared";
import {
  COUNTRY_SPECS, getCountry, pixelsForSize, centeredCropRect,
  validatePhoto, buildFilename, eyeLineY,
} from "./logic";
import { toast } from "sonner";

export default function ImagePassportPhoto() {
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [country, setCountry] = useState("US");
  const [dpi, setDpi] = useState(300);
  const [headMm, setHeadMm] = useState("30");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [report, setReport] = useState<ReturnType<typeof validatePhoto> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const onFile = useCallback((file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) { setError("Please choose an image file"); return; }
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => { setImage(img); setError(null); };
    img.onerror = () => setError("Could not load image");
    img.src = url;
  }, []);

  const spec = getCountry(country)!;
  const targetW = pixelsForSize(spec.width, dpi);
  const targetH = pixelsForSize(spec.height, dpi);

  const applyCrop = useCallback(() => {
    if (!image || !canvasRef.current) return;
    const r = validatePhoto({
      srcWidth: image.naturalWidth,
      srcHeight: image.naturalHeight,
      headMm: headMm ? Number(headMm) : undefined,
      spec, dpi,
    });
    if (r.errors.length > 0) { setError(r.errors[0]!); return; }
    setError(null);
    setReport(r);
    const canvas = canvasRef.current;
    canvas.width = targetW;
    canvas.height = targetH;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(image, r.crop.x, r.crop.y, r.crop.width, r.crop.height, 0, 0, targetW, targetH);
    canvas.toBlob((blob) => {
      if (!blob) return;
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      setPreviewUrl(URL.createObjectURL(blob));
      toast.success(`Passport photo ready (${spec.code} ${spec.width}×${spec.height}mm)`);
    }, "image/png");
  }, [image, headMm, spec, dpi, targetW, targetH, previewUrl]);

  const download = useCallback(() => {
    if (!canvasRef.current) return;
    canvasRef.current.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = buildFilename(spec, dpi); a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      toast.success("Photo downloaded");
    }, "image/png");
  }, [spec, dpi]);

  const eyeY = eyeLineY(targetH, spec);
  const csv = report
    ? `Field,Value\nCountry,${spec.name}\nSize,${spec.width}x${spec.height}mm\nDPI,${dpi}\nPixels,${targetW}x${targetH}\nQuality,${report.qualityScore}\nPhotos per sheet,${report.layout.count}`
    : "";

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4 space-y-3">
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => onFile(e.target.files?.[0])} />
          <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()}>Choose image</Button>
          {image && <p className="text-xs text-muted-foreground">Source: {image.naturalWidth} × {image.naturalHeight}px</p>}
          <div className="flex flex-wrap gap-2">
            {COUNTRY_SPECS.map((c) => (
              <Button key={c.code} size="sm" variant={country === c.code ? "default" : "outline"} onClick={() => setCountry(c.code)}>
                {c.name}
              </Button>
            ))}
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <div>
              <Label className="text-xs text-muted-foreground">DPI</Label>
              <select value={dpi} onChange={(e) => setDpi(Number(e.target.value))} className="h-9 w-full rounded-md border bg-background px-3 text-sm">
                <option value={300}>300</option>
                <option value={600}>600</option>
                <option value={1200}>1200</option>
              </select>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Head size (mm)</Label>
              <Input type="number" value={headMm} onChange={(e) => setHeadMm(e.target.value)} />
            </div>
            <div className="flex items-end">
              <Badge variant="outline">{spec.width}×{spec.height}mm → {targetW}×{targetH}px</Badge>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" onClick={applyCrop} disabled={!image}>Generate passport photo</Button>
            <Button variant="outline" size="sm" onClick={download} disabled={!previewUrl}>Download</Button>
            {report && <CopyButton getText={() => csv} label="Copy CSV" />}
          </div>
        </CardContent>
      </Card>

      {report && (
        <Card>
          <CardContent className="p-4 space-y-2">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
              <div><p className="text-xs text-muted-foreground">Quality score</p><p className="font-bold">{report.qualityScore}/100</p></div>
              <div><p className="text-xs text-muted-foreground">Photos / 4×6 sheet</p><p className="font-bold">{report.layout.count}</p></div>
              <div><p className="text-xs text-muted-foreground">Eye line</p><p className="font-bold">{eyeY}px from top</p></div>
              <div><p className="text-xs text-muted-foreground">Background</p><p className="font-bold capitalize">{spec.background}</p></div>
            </div>
            {report.warnings.map((w, i) => (
              <p key={i} className="text-xs text-yellow-700 dark:text-yellow-400">⚠️ {w}</p>
            ))}
          </CardContent>
        </Card>
      )}

      <canvas ref={canvasRef} className="hidden" />
      {previewUrl && (
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground mb-2">Preview</p>
            <img src={previewUrl} alt="Passport photo preview" className="max-w-full rounded-md border" />
          </CardContent>
        </Card>
      )}
      {error && <ErrorBanner message={error} />}
      {report && (
        <DownloadButton getText={async () => csv} filename="passport-spec.csv" mime="text/csv" label="Download CSV" />
      )}
      <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground"><strong className="text-foreground">Privacy:</strong> all photo processing runs locally via the Canvas API.</p></CardContent></Card>
    </div>
  );
}
