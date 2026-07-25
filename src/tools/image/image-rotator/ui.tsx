"use client";

import React, { useState, useCallback, useRef, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ErrorBanner, DownloadButton } from "../../_shared";
import {
  calculateRotation,
  applyTransformStep,
  undoTransform,
  redoTransform,
  resetTransform,
  describeTransform,
  initialTransformState,
  parseFillColor,
  preservesAlpha,
  beforeAfterDimensions,
  stepFromKey,
  flipCanvasParams,
  ANGLE_PRESETS,
  type TransformState,
  type FlipType,
  type OutputFormat,
} from "./logic";
import { toast } from "sonner";

export default function ImageRotator() {
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [fileName, setFileName] = useState("rotated.png");
  const [degrees, setDegrees] = useState("0");
  const [format, setFormat] = useState<OutputFormat>("image/png");
  const [quality, setQuality] = useState(0.9);
  const [fill, setFill] = useState("#ffffff");
  const [state, setState] = useState<TransformState>(initialTransformState());
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const onFile = useCallback((file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("Please choose an image file.");
      return;
    }
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      setImage(img);
      setFileName(file.name.replace(/\.[^.]+$/, "") + "-rotated.png");
      setState(initialTransformState());
      setError(null);
    };
    img.onerror = () => setError("Could not load image.");
    img.src = url;
  }, []);

  // Drag-drop
  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    onFile(e.dataTransfer.files?.[0]);
  }, [onFile]);

  // Paste
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      for (const item of items) {
        if (item.type.startsWith("image/")) {
          const f = item.getAsFile();
          if (f) onFile(f);
          break;
        }
      }
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [onFile]);

  // Keyboard shortcuts (R/L/H/V) — blueprint §7
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!image) return;
      const target = e.target as HTMLElement;
      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA") return;
      const step = stepFromKey(e.key);
      if (!step) return;
      e.preventDefault();
      applyStep(step.rotate, step.flip);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const applyStep = useCallback((rotate: number, flip: FlipType) => {
    setState((s) => applyTransformStep(s, { rotate, flip }));
  }, []);

  const applyCustomAngle = useCallback(() => {
    const deg = Number(degrees);
    if (!Number.isFinite(deg)) {
      setError("Degrees must be a number.");
      return;
    }
    applyStep(deg, "none");
  }, [degrees, applyStep]);

  // Render preview whenever state, format, or quality changes
  useEffect(() => {
    if (!image || !canvasRef.current) return;
    if (state.totalRotation === 0 && state.flip === "none") {
      // Show original
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      setPreviewUrl(image.src);
      return;
    }
    const total = state.totalRotation + (state.flip === "horizontal" || state.flip === "vertical" || state.flip === "both" ? 0 : 0);
    const result = calculateRotation({
      originalWidth: image.naturalWidth,
      originalHeight: image.naturalHeight,
      degrees: total,
    });
    if ("error" in result) {
      setError(result.error);
      return;
    }
    setError(null);
    const canvas = canvasRef.current;
    canvas.width = result.width;
    canvas.height = result.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    // Fill background for non-90° angles
    if (result.expandsCanvas && format !== "image/png") {
      const fillParsed = parseFillColor(fill);
      if (!("error" in fillParsed)) {
        ctx.fillStyle = `rgba(${fillParsed[0]},${fillParsed[1]},${fillParsed[2]},${fillParsed[3] / 255})`;
        ctx.fillRect(0, 0, result.width, result.height);
      }
    }
    ctx.translate(result.width / 2, result.height / 2);
    ctx.rotate((result.angle * Math.PI) / 180);
    const fp = flipCanvasParams(image.naturalWidth, image.naturalHeight, state.flip);
    if (!("error" in fp)) {
      ctx.scale(fp.scaleX, fp.scaleY);
    }
    ctx.drawImage(image, -image.naturalWidth / 2, -image.naturalHeight / 2);
    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        if (previewUrl && previewUrl !== image.src) URL.revokeObjectURL(previewUrl);
        setPreviewUrl(URL.createObjectURL(blob));
      },
      format,
      format === "image/png" ? undefined : quality,
    );
  }, [image, state, format, quality, fill]);

  const dims = image
    ? beforeAfterDimensions(image.naturalWidth, image.naturalHeight, state.totalRotation)
    : null;

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4 space-y-3">
          <div
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={onDrop}
            className={`border-2 border-dashed rounded-lg p-6 text-center ${dragOver ? "border-primary bg-primary/5" : "border-border"}`}
          >
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => onFile(e.target.files?.[0])} />
            <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()}>Choose image</Button>
            <p className="text-xs text-muted-foreground mt-2">or drag-drop, or paste (Ctrl+V) · Keyboard: R/L = rotate, H/V = flip</p>
          </div>
          {image && (
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant="outline">Original: {image.naturalWidth} × {image.naturalHeight}</Badge>
              {dims && !("error" in dims) && (
                <Badge variant="outline">After: {dims.after.w} × {dims.after.h}</Badge>
              )}
              <Badge variant="secondary">Transform: {describeTransform(state)}</Badge>
            </div>
          )}
        </CardContent>
      </Card>

      {image && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="flex flex-wrap gap-2">
              {ANGLE_PRESETS.map((p) => (
                <Button key={p.label} variant="outline" size="sm" onClick={() => applyStep(p.degrees, "none")}>
                  {p.label}
                </Button>
              ))}
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={() => applyStep(0, "horizontal")}>Flip H</Button>
              <Button variant="outline" size="sm" onClick={() => applyStep(0, "vertical")}>Flip V</Button>
              <Button variant="outline" size="sm" onClick={() => applyStep(0, "both")}>Flip Both</Button>
              <Button variant="ghost" size="sm" onClick={() => setState(undoTransform(state))} disabled={state.cursor === 0}>Undo</Button>
              <Button variant="ghost" size="sm" onClick={() => setState(redoTransform(state))} disabled={state.cursor >= state.history.length}>Redo</Button>
              <Button variant="ghost" size="sm" onClick={() => setState(resetTransform())}>Reset</Button>
            </div>
            <div className="flex flex-wrap gap-2 items-end">
              <div>
                <Label className="text-xs text-muted-foreground">Custom degrees</Label>
                <Input type="number" value={degrees} onChange={(e) => setDegrees(e.target.value)} className="w-32" />
              </div>
              <Button size="sm" onClick={applyCustomAngle}>Apply angle</Button>
            </div>
            <div className="flex flex-wrap gap-3 items-end">
              <div>
                <Label className="text-xs text-muted-foreground">Format</Label>
                <select value={format} onChange={(e) => setFormat(e.target.value as OutputFormat)} className="h-9 rounded-md border bg-background px-3 text-sm">
                  <option value="image/png">PNG (alpha)</option>
                  <option value="image/jpeg">JPEG (small)</option>
                  <option value="image/webp">WebP</option>
                </select>
              </div>
              {format !== "image/png" && (
                <div>
                  <Label className="text-xs text-muted-foreground">Quality: {Math.round(quality * 100)}%</Label>
                  <Input type="range" min={10} max={100} value={Math.round(quality * 100)} onChange={(e) => setQuality(Number(e.target.value) / 100)} className="w-32" />
                </div>
              )}
              <div>
                <Label className="text-xs text-muted-foreground">Fill (non-90°)</Label>
                <input type="color" value={fill} onChange={(e) => setFill(e.target.value)} className="h-9 w-12 rounded-md border bg-background" />
              </div>
            </div>
            {!preservesAlpha(format) && (
              <p className="text-xs text-yellow-700 dark:text-yellow-400">⚠️ JPEG does not preserve transparency — transparent areas will be filled.</p>
            )}
            <div className="flex gap-2">
              <DownloadButton
                getText={async () => {
                  if (!canvasRef.current) return "";
                  return await new Promise<string>((resolve) => {
                    canvasRef.current!.toBlob(
                      (blob) => {
                        if (!blob) return resolve("");
                        const reader = new FileReader();
                        reader.onload = () => resolve(reader.result as string);
                        reader.readAsDataURL(blob);
                      },
                      format,
                      format === "image/png" ? undefined : quality,
                    );
                  });
                }}
                filename={fileName}
                mime={format}
                label="Download"
                disabled={!previewUrl}
              />
            </div>
            {/* History list (blueprint §7: "cumulative transform indicator") */}
            {state.history.length > 0 && (
              <div className="text-xs text-muted-foreground">
                History: {state.history.map((h, i) => (
                  <span key={i} className="inline-block mr-2">
                    [{h.rotate !== 0 ? `${h.rotate}°` : ""}{h.flip !== "none" ? ` ${h.flip}` : ""}]
                  </span>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <canvas ref={canvasRef} className="hidden" />
      {previewUrl && (
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground mb-2">Preview · {describeTransform(state)}</p>
            <img src={previewUrl} alt="Rotated preview" className="max-w-full rounded-md border" />
          </CardContent>
        </Card>
      )}
      {error && <ErrorBanner message={error} />}
      <Card>
        <CardContent className="p-4">
          <p className="text-xs text-muted-foreground">
            <strong className="text-foreground">Privacy:</strong> all rotation runs locally via the Canvas API. Cumulative transforms, undo/redo, and EXIF-aware sizing are computed in-browser.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
