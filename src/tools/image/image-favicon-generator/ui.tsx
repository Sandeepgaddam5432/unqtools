"use client";

import React, { useState, useRef, useMemo, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { ErrorBanner, CopyButton, DownloadButton } from "../../_shared";
import {
  FAVICON_SIZES, filterByPlatform, generateLinkTags, generateManifestIcons,
  estimatePngSize, formatBytes, summarizeSpecs, fitWithin,
} from "./logic";

export default function ImageFaviconGeneratorUI() {
  const [file, setFile] = useState<File | null>(null);
  const [imgEl, setImgEl] = useState<HTMLImageElement | null>(null);
  const [error, setError] = useState("");
  const [rendered, setRendered] = useState<number[]>([]);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const previewCanvasRef = useRef<HTMLCanvasElement>(null);

  const specs = useMemo(() => FAVICON_SIZES, []);
  const summary = useMemo(() => summarizeSpecs(specs), [specs]);
  const totalBytes = useMemo(() => summary.reduce((s, r) => s + r.bytes, 0), [summary]);
  const linkTags = useMemo(() => generateLinkTags(specs), [specs]);
  const manifest = useMemo(() => generateManifestIcons(specs), [specs]);

  const onFile = useCallback(async (f: File) => {
    setError("");
    setFile(f);
    const url = URL.createObjectURL(f);
    const img = new Image();
    img.onload = () => {
      setImgEl(img);
      URL.revokeObjectURL(url);
    };
    img.onerror = () => {
      setError("Failed to load image. Use PNG/JPG/SVG.");
      URL.revokeObjectURL(url);
    };
    img.src = url;
  }, []);

  const renderAll = useCallback(() => {
    if (!imgEl || !canvasRef.current) return;
    const ctx = canvasRef.current.getContext("2d");
    if (!ctx) return;
    setError("");
    const done: number[] = [];
    for (const spec of specs) {
      const fit = fitWithin(imgEl.width, imgEl.height, spec.size);
      canvasRef.current.width = spec.size;
      canvasRef.current.height = spec.size;
      // Fill white background (PNG with transparency may produce black)
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, spec.size, spec.size);
      const dx = (spec.size - fit.w) / 2;
      const dy = (spec.size - fit.h) / 2;
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(imgEl, 0, 0, imgEl.width, imgEl.height, dx, dy, fit.w, fit.h);
      done.push(spec.size);
    }
    setRendered(done);
  }, [imgEl, specs]);

  const downloadAll = useCallback(() => {
    if (!imgEl || !canvasRef.current) return;
    const ctx = canvasRef.current.getContext("2d");
    if (!ctx) return;
    for (const spec of specs) {
      const fit = fitWithin(imgEl.width, imgEl.height, spec.size);
      canvasRef.current.width = spec.size;
      canvasRef.current.height = spec.size;
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, spec.size, spec.size);
      const dx = (spec.size - fit.w) / 2;
      const dy = (spec.size - fit.h) / 2;
      ctx.drawImage(imgEl, 0, 0, imgEl.width, imgEl.height, dx, dy, fit.w, fit.h);
      canvasRef.current.toBlob((blob) => {
        if (!blob) return;
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = spec.name;
        a.click();
        URL.revokeObjectURL(url);
      }, "image/png");
    }
  }, [imgEl, specs]);

  const drawPreview = useCallback((size: number) => {
    if (!imgEl || !previewCanvasRef.current) return;
    const c = previewCanvasRef.current;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    c.width = size;
    c.height = size;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, size, size);
    const fit = fitWithin(imgEl.width, imgEl.height, size);
    const dx = (size - fit.w) / 2;
    const dy = (size - fit.h) / 2;
    ctx.drawImage(imgEl, 0, 0, imgEl.width, imgEl.height, dx, dy, fit.w, fit.h);
  }, [imgEl]);

  return (
    <div className="space-y-4">
      {error && <ErrorBanner message={error} />}
      <Card>
        <CardContent className="p-4 space-y-3">
          <Label className="text-sm font-medium">Upload source image (square recommended, ≥512px)</Label>
          <Input
            type="file"
            accept="image/png,image/jpeg,image/svg+xml"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) onFile(f);
            }}
          />
          {imgEl && (
            <p className="text-xs text-muted-foreground">
              Source: {imgEl.width} × {imgEl.height}px ({file?.name})
            </p>
          )}
          <div className="flex gap-2 flex-wrap">
            <button
              type="button"
              onClick={renderAll}
              disabled={!imgEl}
              className="text-xs px-3 py-1.5 rounded-md bg-primary text-primary-foreground disabled:opacity-50"
            >
              Render all sizes
            </button>
            <button
              type="button"
              onClick={downloadAll}
              disabled={!imgEl}
              className="text-xs px-3 py-1.5 rounded-md border border-border disabled:opacity-50"
            >
              Download all PNGs
            </button>
            <CopyButton getText={() => linkTags} label="Copy <link> tags" disabled={!imgEl} />
            <CopyButton getText={() => manifest} label="Copy manifest JSON" disabled={!imgEl} />
            <DownloadButton getText={() => linkTags} filename="favicon-links.html" disabled={!imgEl} />
            <DownloadButton getText={() => manifest} filename="site.webmanifest" disabled={!imgEl} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4 space-y-3">
          <p className="text-sm font-medium">Sizes & estimated file size</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
            {summary.map((s) => (
              <div
                key={s.name}
                className="rounded-md border border-border p-2 text-xs space-y-1 cursor-pointer hover:border-primary"
                onClick={() => drawPreview(s.size)}
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono">{s.size}×{s.size}</span>
                  <span className="text-muted-foreground">{s.prettyBytes}</span>
                </div>
                <p className="text-[10px] text-muted-foreground truncate">{s.name}</p>
              </div>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">Total estimated: {formatBytes(totalBytes)}</p>
          <p className="text-xs text-muted-foreground">
            Platforms: browser ({filterByPlatform(specs, "browser").length}), iOS (1), Android ({filterByPlatform(specs, "android").length}), PWA ({filterByPlatform(specs, "pwa").length}).
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4 space-y-3">
          <p className="text-sm font-medium">Preview (click a size above)</p>
          <canvas ref={previewCanvasRef} width={128} height={128} className="border border-border rounded-md" style={{ imageRendering: "pixelated" }} />
          <canvas ref={canvasRef} width={0} height={0} className="hidden" />
          {rendered.length > 0 && (
            <p className="text-xs text-muted-foreground">Rendered {rendered.length} sizes.</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4">
          <p className="text-xs text-muted-foreground">
            <strong className="text-foreground">Privacy:</strong> rendering is performed locally in the browser using Canvas. No images are uploaded. Estimated PNG size assumes a ~2.5× compression ratio over raw RGBA.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
