"use client";

import React, { useState, useRef, useCallback, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ErrorBanner, DownloadButton } from "../../_shared";
import {
  computeGeometry,
  FRAME_PRESETS,
  BORDER_COLORS,
  validateOptions,
  type FrameOptions,
  type FrameType,
} from "./logic";

export default function ImageFrameMakerUI() {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [opts, setOpts] = useState<FrameOptions>({
    type: "classic",
    borderWidth: 20,
    borderColor: "#000000",
  });
  const [error, setError] = useState("");
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);

  const errs = validateOptions(opts);

  const render = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!ctx || !imageRef.current) return;
    const img = imageRef.current;
    const geom = computeGeometry(img.naturalWidth, img.naturalHeight, opts);
  }, [opts]);

  useEffect(() => {
    if (imageRef.current) render();
  }, [render]);

  const onFile = useCallback((file: File) => {
    setError("");
    const url = URL.createObjectURL(file);
    setImageUrl(url);
    const img = new Image();
    img.onload = () => {
      imageRef.current = img;
      setTimeout(render, 50);
    };
    img.src = url;
  }, [render]);

  const downloadPng = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "framed.png";
      a.click();
      URL.revokeObjectURL(url);
    });
  };

  return (
    <div className="space-y-4">
      {error && <ErrorBanner message={error} />}
      {errs.length > 0 && <ErrorBanner message={errs.join("; ")} />}

      <Card>
        <CardContent className="p-4 space-y-3">
          <Label className="text-sm font-medium">Upload image</Label>
          <Input type="file" accept="image/*" onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); }} />
          <div>
            <Label className="text-xs text-muted-foreground">Presets</Label>
            <div className="flex flex-wrap gap-2 mt-1">
              {FRAME_PRESETS.map((p) => (
                <Button
                  key={p.name}
                  size="sm"
                  variant={opts.type === p.options.type ? "default" : "outline"}
                  onClick={() => setOpts({ ...p.options })}
                >
                  {p.name}
                </Button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div>
              <Label className="text-xs text-muted-foreground">Frame type</Label>
              <select
                value={opts.type}
                onChange={(e) => setOpts({ ...opts, type: e.target.value as FrameType })}
                className="w-full h-9 rounded-md border bg-background px-2 text-sm"
              >
                <option value="classic">Classic</option>
                <option value="polaroid">Polaroid</option>
                <option value="film">Film strip</option>
                <option value="rounded">Rounded</option>
                <option value="vignette">Vignette</option>
                <option value="shadow">Drop shadow</option>
                <option value="gradient">Gradient</option>
                <option value="double">Double line</option>
              </select>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Border width (px)</Label>
              <Input type="number" value={opts.borderWidth} onChange={(e) => setOpts({ ...opts, borderWidth: Number(e.target.value) })} />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Border color</Label>
              <input type="color" value={opts.borderColor.startsWith("#") ? opts.borderColor : "#000000"} onChange={(e) => setOpts({ ...opts, borderColor: e.target.value })} className="w-full h-9 rounded border" />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Mat width (px)</Label>
              <Input type="number" value={opts.matWidth ?? 0} onChange={(e) => setOpts({ ...opts, matWidth: Number(e.target.value) })} />
            </div>
            {(opts.type === "rounded") && (
              <div>
                <Label className="text-xs text-muted-foreground">Corner radius</Label>
                <Input type="number" value={opts.radius ?? 20} onChange={(e) => setOpts({ ...opts, radius: Number(e.target.value) })} />
              </div>
            )}
            {(opts.type === "polaroid") && (
              <>
                <div>
                  <Label className="text-xs text-muted-foreground">Caption</Label>
                  <Input value={opts.caption ?? ""} onChange={(e) => setOpts({ ...opts, caption: e.target.value })} />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Caption size</Label>
                  <Input type="number" value={opts.captionSize ?? 18} onChange={(e) => setOpts({ ...opts, captionSize: Number(e.target.value) })} />
                </div>
              </>
            )}
            {(opts.type === "film") && (
              <div>
                <Label className="text-xs text-muted-foreground">Perforation count</Label>
                <Input type="number" value={opts.filmHoleCount ?? 12} onChange={(e) => setOpts({ ...opts, filmHoleCount: Number(e.target.value) })} />
              </div>
            )}
            {(opts.type === "gradient") && (
              <>
                <div>
                  <Label className="text-xs text-muted-foreground">Gradient from</Label>
                  <input type="color" value={opts.gradientFrom ?? "#ff6b6b"} onChange={(e) => setOpts({ ...opts, gradientFrom: e.target.value })} className="w-full h-9 rounded border" />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Gradient to</Label>
                  <input type="color" value={opts.gradientTo ?? "#4ecdc4"} onChange={(e) => setOpts({ ...opts, gradientTo: e.target.value })} className="w-full h-9 rounded border" />
                </div>
              </>
            )}
            {(opts.type === "shadow") && (
              <div>
                <Label className="text-xs text-muted-foreground">Shadow blur</Label>
                <Input type="number" value={opts.shadowBlur ?? 20} onChange={(e) => setOpts({ ...opts, shadowBlur: Number(e.target.value) })} />
              </div>
            )}
            {(opts.matWidth ?? 0) > 0 && (
              <div>
                <Label className="text-xs text-muted-foreground">Mat color</Label>
                <input type="color" value={opts.matColor ?? "#f5f0e8"} onChange={(e) => setOpts({ ...opts, matColor: e.target.value })} className="w-full h-9 rounded border" />
              </div>
            )}
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Quick colors</Label>
            <div className="flex flex-wrap gap-1 mt-1">
              {BORDER_COLORS.map((c) => (
                <button key={c} onClick={() => setOpts({ ...opts, borderColor: c })} className="w-6 h-6 rounded border" style={{ backgroundColor: c }} aria-label={`Color ${c}`} />
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-medium">Preview</p>
            <Button size="sm" variant="outline" onClick={render} disabled={!imageUrl}>Re-render</Button>
            <Button size="sm" onClick={downloadPng} disabled={!imageUrl}>Download PNG</Button>
          </div>
          <canvas ref={canvasRef} className="w-full rounded-md border bg-muted/30 max-h-[70vh] object-contain" />
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4">
          <p className="text-xs text-muted-foreground">
            <strong className="text-foreground">Privacy:</strong> 100% local rendering. 8 frame types (classic, polaroid, film, rounded, vignette, shadow, gradient, double) with matting support.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
