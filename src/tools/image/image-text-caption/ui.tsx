"use client";

import React, { useState, useRef, useCallback, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ErrorBanner, DownloadButton } from "../../_shared";
import {
  computeCaptionLayout,
  hexToRgba,
  contrastColor,
  CAPTION_PRESETS,
  validateOptions,
  toCssTextShadow,
  type CaptionOptions,
  type CaptionPosition,
} from "./logic";

const POSITIONS: CaptionPosition[] = [
  "top-left", "top-center", "top-right",
  "middle-left", "middle-center", "middle-right",
  "bottom-left", "bottom-center", "bottom-right",
];

export default function ImageTextCaptionUI() {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [opts, setOpts] = useState<CaptionOptions>({
    text: "Your caption here",
    position: "bottom-center",
    fontSize: 36,
    fontFamily: "sans-serif",
    fontWeight: "bold",
    fontStyle: "normal",
    color: "#ffffff",
    align: "center",
    outlineColor: "#000000",
    outlineWidth: 2,
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
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    ctx.drawImage(img, 0, 0);
    const layout = computeCaptionLayout(canvas.width, canvas.height, opts);
    // Background
    if (opts.backgroundColor) {
      ctx.fillStyle = hexToRgba(opts.backgroundColor, opts.backgroundOpacity ?? 1);
      ctx.fillRect(layout.renderPos.x, layout.renderPos.y, layout.box.width, layout.box.height);
    }
    // Text
    ctx.font = `${opts.fontStyle === "italic" ? "italic " : ""}${opts.fontWeight === "bold" ? "bold " : ""}${opts.fontSize}px ${opts.fontFamily}`;
    ctx.textBaseline = "top";
    ctx.fillStyle = opts.color;
    if (opts.outlineWidth && opts.outlineColor) {
      ctx.strokeStyle = opts.outlineColor;
      ctx.lineWidth = opts.outlineWidth;
    }
    if (opts.shadowBlur && opts.shadowColor) {
      ctx.shadowColor = opts.shadowColor;
      ctx.shadowBlur = opts.shadowBlur;
    }
    const padding = opts.padding ?? 8;
    const lineHeight = opts.fontSize * (opts.lineHeight ?? 1.2);
    for (let i = 0; i < layout.lines.length; i++) {
      const line = layout.lines[i];
      let x = layout.renderPos.x + padding;
      const y = layout.renderPos.y + padding + i * lineHeight;
      const lineW = ctx.measureText(line).width;
      if (opts.align === "center") x = layout.renderPos.x + (layout.box.width - lineW) / 2;
      else if (opts.align === "right") x = layout.renderPos.x + layout.box.width - lineW - padding;
      if (opts.outlineWidth && opts.outlineColor) ctx.strokeText(line, x, y);
      ctx.fillText(line, x, y);
    }
    ctx.shadowBlur = 0;
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
    canvasRef.current?.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "captioned.png";
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
              {CAPTION_PRESETS.map((p) => (
                <Button key={p.name} size="sm" variant="outline" onClick={() => setOpts({ ...opts, ...p.options } as CaptionOptions)}>
                  {p.name}
                </Button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-3">
              <Label className="text-xs text-muted-foreground">Caption text</Label>
              <Input value={opts.text} onChange={(e) => setOpts({ ...opts, text: e.target.value })} />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Position (9-grid)</Label>
              <select
                value={opts.position}
                onChange={(e) => setOpts({ ...opts, position: e.target.value as CaptionPosition })}
                className="w-full h-9 rounded-md border bg-background px-2 text-sm"
              >
                {POSITIONS.map((p) => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Font size</Label>
              <Input type="number" value={opts.fontSize} onChange={(e) => setOpts({ ...opts, fontSize: Number(e.target.value) })} />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Font family</Label>
              <select
                value={opts.fontFamily}
                onChange={(e) => setOpts({ ...opts, fontFamily: e.target.value })}
                className="w-full h-9 rounded-md border bg-background px-2 text-sm"
              >
                <option value="sans-serif">Sans-serif</option>
                <option value="serif">Serif</option>
                <option value="monospace">Monospace</option>
                <option value="Impact">Impact</option>
                <option value="cursive">Cursive</option>
              </select>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Color</Label>
              <input type="color" value={opts.color.startsWith("#") ? opts.color : "#ffffff"} onChange={(e) => setOpts({ ...opts, color: e.target.value })} className="w-full h-9 rounded border" />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Outline width</Label>
              <Input type="number" value={opts.outlineWidth ?? 0} onChange={(e) => setOpts({ ...opts, outlineWidth: Number(e.target.value) })} />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Outline color</Label>
              <input type="color" value={opts.outlineColor ?? "#000000"} onChange={(e) => setOpts({ ...opts, outlineColor: e.target.value })} className="w-full h-9 rounded border" />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Background</Label>
              <input type="color" value={opts.backgroundColor ?? "#000000"} onChange={(e) => setOpts({ ...opts, backgroundColor: e.target.value })} className="w-full h-9 rounded border" />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Bg opacity (0-1)</Label>
              <Input type="number" step="0.1" value={opts.backgroundOpacity ?? 1} onChange={(e) => setOpts({ ...opts, backgroundOpacity: Number(e.target.value) })} />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Align</Label>
              <select
                value={opts.align}
                onChange={(e) => setOpts({ ...opts, align: e.target.value as "left" | "center" | "right" })}
                className="w-full h-9 rounded-md border bg-background px-2 text-sm"
              >
                <option value="left">Left</option>
                <option value="center">Center</option>
                <option value="right">Right</option>
              </select>
            </div>
            <div className="flex gap-3">
              <label className="flex items-center gap-1 text-xs text-muted-foreground">
                <input type="checkbox" checked={opts.fontWeight === "bold"} onChange={(e) => setOpts({ ...opts, fontWeight: e.target.checked ? "bold" : "normal" })} />
                Bold
              </label>
              <label className="flex items-center gap-1 text-xs text-muted-foreground">
                <input type="checkbox" checked={opts.fontStyle === "italic"} onChange={(e) => setOpts({ ...opts, fontStyle: e.target.checked ? "italic" : "normal" })} />
                Italic
              </label>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">CSS preview: <span style={{ color: opts.color, textShadow: toCssTextShadow(opts) }}>{opts.text}</span></p>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center gap-2">
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
            <strong className="text-foreground">Privacy:</strong> 100% local. 9-grid positioning, multi-line wrapping, outline + shadow effects, background box with opacity.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
