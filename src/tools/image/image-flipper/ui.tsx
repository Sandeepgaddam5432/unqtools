"use client";

import React, { useState, useCallback, useRef, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ErrorBanner, DownloadButton } from "../../_shared";
import {
  calculateFlip,
  applyFlipStep,
  undoFlip,
  redoFlip,
  resetFlip,
  describeFlip,
  initialFlipState,
  preservesAlpha,
  beforeAfterFlipDimensions,
  flipStepFromKey,
  flipSuffix,
  type FlipState,
  type FlipType,
  type OutputFormat,
} from "./logic";
import { toast } from "sonner";

export default function ImageFlipper() {
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [fileName, setFileName] = useState("flipped.png");
  const [format, setFormat] = useState<OutputFormat>("image/png");
  const [quality, setQuality] = useState(0.9);
  const [state, setState] = useState<FlipState>(initialFlipState());
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
      setFileName(file.name.replace(/\.[^.]+$/, "") + "-flipped.png");
      setState(initialFlipState());
      setError(null);
    };
    img.onerror = () => setError("Could not load image.");
    img.src = url;
  }, []);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    onFile(e.dataTransfer.files?.[0]);
  }, [onFile]);

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

  // Keyboard shortcuts H/V/B
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!image) return;
      const target = e.target as HTMLElement;
      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA") return;
      const step = flipStepFromKey(e.key);
      if (!step) return;
      e.preventDefault();
      setState((s) => applyFlipStep(s, step));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  // Render preview whenever state/format/quality changes
  useEffect(() => {
    if (!image || !canvasRef.current) return;
    if (state.flip === "none") {
      if (previewUrl && previewUrl !== image.src) URL.revokeObjectURL(previewUrl);
      setPreviewUrl(image.src);
      return;
    }
    const result = calculateFlip(image.naturalWidth, image.naturalHeight, state.flip);
    if ("error" in result) {
      setError(result.error);
      return;
    }
    setError(null);
    const canvas = canvasRef.current;
    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.save();
    ctx.translate(result.translateX, result.translateY);
    ctx.scale(result.scaleX, result.scaleY);
    ctx.drawImage(image, 0, 0);
    ctx.restore();
    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        if (previewUrl && previewUrl !== image.src) URL.revokeObjectURL(previewUrl);
        setPreviewUrl(URL.createObjectURL(blob));
      },
      format,
      format === "image/png" ? undefined : quality,
    );
  }, [image, state, format, quality]);

  const dims = image ? beforeAfterFlipDimensions(image.naturalWidth, image.naturalHeight) : null;

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
            <p className="text-xs text-muted-foreground mt-2">or drag-drop, or paste · Keyboard: H = horizontal, V = vertical, B = both</p>
          </div>
          {image && (
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant="outline">{image.naturalWidth} × {image.naturalHeight}</Badge>
              {dims && !("error" in dims) && (
                <Badge variant="outline">After: {dims.after.w} × {dims.after.h}</Badge>
              )}
              <Badge variant="secondary">{describeFlip(state)}</Badge>
            </div>
          )}
        </CardContent>
      </Card>

      {image && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={() => setState((s) => applyFlipStep(s, { flip: "horizontal" }))}>Flip Horizontal ↔</Button>
              <Button variant="outline" size="sm" onClick={() => setState((s) => applyFlipStep(s, { flip: "vertical" }))}>Flip Vertical ↕</Button>
              <Button variant="outline" size="sm" onClick={() => setState((s) => applyFlipStep(s, { flip: "both" }))}>Flip Both ↔↕</Button>
              <Button variant="ghost" size="sm" onClick={() => setState(undoFlip(state))} disabled={state.cursor === 0}>Undo</Button>
              <Button variant="ghost" size="sm" onClick={() => setState(redoFlip(state))} disabled={state.cursor >= state.history.length}>Redo</Button>
              <Button variant="ghost" size="sm" onClick={() => setState(resetFlip())}>Reset</Button>
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
                filename={fileName.replace(/-flipped\./, `${flipSuffix(state.flip)}.`)}
                mime={format}
                label="Download"
                disabled={!previewUrl}
              />
            </div>
            {state.history.length > 0 && (
              <div className="text-xs text-muted-foreground">
                History: {state.history.map((h, i) => (
                  <span key={i} className="inline-block mr-2">[{h.flip}]</span>
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
            <p className="text-xs text-muted-foreground mb-2">Preview · {describeFlip(state)}</p>
            <img src={previewUrl} alt="Flipped preview" className="max-w-full rounded-md border" />
          </CardContent>
        </Card>
      )}
      {error && <ErrorBanner message={error} />}
      <Card>
        <CardContent className="p-4">
          <p className="text-xs text-muted-foreground">
            <strong className="text-foreground">Privacy:</strong> all flipping runs locally via the Canvas API. Cumulative transforms and undo/redo are computed in-browser.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
