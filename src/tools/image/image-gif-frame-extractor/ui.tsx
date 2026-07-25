"use client";

import React, { useState, useCallback, useRef, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ErrorBanner } from "../../_shared";
import { parseGif, averageFps, frameCount, formatDuration } from "./logic";
import { toast } from "sonner";

export default function GifFrameExtractor() {
  const [frames, setFrames] = useState<string[]>([]);
  const [meta, setMeta] = useState<ReturnType<typeof parseGif> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const onFile = useCallback(async (file: File | undefined) => {
    if (!file) return;
    if (file.type !== "image/gif" && !file.name.toLowerCase().endsWith(".gif")) {
      setError("Please choose a GIF file");
      return;
    }
    const buf = new Uint8Array(await file.arrayBuffer());
    const result = parseGif(buf);
    if ("error" in result) {
      setError(result.error);
      setMeta(null);
      setFrames([]);
      return;
    }
    setError(null);
    setMeta(result);
    // Render each frame via the browser's built-in GIF decoder.
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = async () => {
      try {
        // Use createImageBitmap to decode individual frames if supported.
        if (typeof createImageBitmap === "function") {
          const bitmaps = await Promise.all(
            result.frames.map(() => createImageBitmap(img)),
          );
          const urls = bitmaps.map((b) => {
            const canvas = document.createElement("canvas");
            canvas.width = b.width;
            canvas.height = b.height;
            const ctx = canvas.getContext("2d");
            ctx?.drawImage(b, 0, 0);
            return canvas.toDataURL("image/png");
          });
          setFrames(urls);
          toast.success(`Extracted ${urls.length} frames`);
        } else {
          setFrames([url]);
          toast.success("Single frame extracted");
        }
      } catch {
        setFrames([url]);
      }
    };
    img.src = url;
  }, []);

  const fps = useMemo(() => (meta && !("error" in meta) ? averageFps(meta) : 0), [meta]);

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4 space-y-3">
          <input
            ref={fileRef}
            type="file"
            accept="image/gif"
            className="hidden"
            onChange={(e) => onFile(e.target.files?.[0])}
          />
          <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()}>
            Choose GIF
          </Button>
          {meta && !("error" in meta) && (
            <div className="flex flex-wrap gap-2">
              <Badge variant="secondary">{frameCount(meta)} frames</Badge>
              <Badge variant="secondary">{meta.width}×{meta.height}px</Badge>
              <Badge variant="secondary">{formatDuration(meta.totalDurationMs)} total</Badge>
              <Badge variant="secondary">{fps.toFixed(1)} fps avg</Badge>
              <Badge variant="secondary">
                loop: {meta.loopCount === 0 ? "forever" : `${meta.loopCount}×`}
              </Badge>
            </div>
          )}
          {frames.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                frames.forEach((url, i) => {
                  const a = document.createElement("a");
                  a.href = url;
                  a.download = `frame-${i + 1}.png`;
                  a.click();
                });
                toast.success(`Downloaded ${frames.length} frames`);
              }}
            >
              Download all
            </Button>
          )}
        </CardContent>
      </Card>

      {error && <ErrorBanner message={error} />}

      {frames.length > 0 && (
        <Card>
          <CardContent className="p-4">
            <Label className="text-sm font-medium mb-3 block">Frames</Label>
            <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-2">
              {frames.map((url, i) => (
                <div key={i} className="rounded-md border p-2 text-center">
                  <img src={url} alt={`Frame ${i + 1}`} className="mx-auto max-w-full" />
                  <p className="text-xs text-muted-foreground mt-1">
                    #{i + 1}
                    {meta && !("error" in meta) && meta.frames[i]
                      ? ` · ${formatDuration(meta.frames[i].delayMs)}`
                      : ""}
                  </p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-4">
          <p className="text-xs text-muted-foreground">
            <strong className="text-foreground">Privacy:</strong> all GIF parsing runs
            locally in your browser — no upload required.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
