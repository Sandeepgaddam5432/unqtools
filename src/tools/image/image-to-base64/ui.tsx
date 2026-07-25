"use client";

import React, { useState, useCallback, useRef, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ErrorBanner, CopyButton, DownloadButton } from "../../_shared";
import {
  detectMime,
  buildBase64Result,
  formatOutput,
  formatSize,
  overhead,
  sizeWarning,
  resizeTarget,
  OUTPUT_PRESETS,
  type ImageMime,
  type OutputPreset,
} from "./logic";
import { toast } from "sonner";

export default function ImageToBase64() {
  const [result, setResult] = useState<ReturnType<typeof buildBase64Result> | null>(null);
  const [fileName, setFileName] = useState("image");
  const [preset, setPreset] = useState<OutputPreset>("data-uri");
  const [resizeW, setResizeW] = useState("");
  const [resizeH, setResizeH] = useState("");
  const [quality, setQuality] = useState(0.9);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const onFile = useCallback(async (file: File | undefined) => {
    if (!file) return;
    const detected = detectMime(file.name) || (file.type as ImageMime) || "image/png";
    if (!detected.startsWith("image/")) {
      setError("Please choose an image file.");
      return;
    }
    setError(null);
    setFileName(file.name.replace(/\.[^.]+$/, ""));

    const maxW = resizeW.trim() ? Number(resizeW) : undefined;
    const maxH = resizeH.trim() ? Number(resizeH) : undefined;

    if ((maxW || maxH) && detected !== "image/svg+xml") {
      // Resize via canvas
      const img = new Image();
      const url = URL.createObjectURL(file);
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error("Could not load image"));
        img.src = url;
      });
      const target = resizeTarget(img.naturalWidth, img.naturalHeight, maxW, maxH);
      const canvas = document.createElement("canvas");
      canvas.width = target.width;
      canvas.height = target.height;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Canvas not available");
      ctx.drawImage(img, 0, 0, target.width, target.height);
      URL.revokeObjectURL(url);
      const outMime = detected === "image/svg+xml" ? "image/png" : detected;
      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, outMime, outMime === "image/png" ? undefined : quality),
      );
      if (!blob) throw new Error("Conversion failed");
      const buf = new Uint8Array(await blob.arrayBuffer());
      let bin = "";
      for (let i = 0; i < buf.length; i++) bin += String.fromCharCode(buf[i]!);
      const raw = btoa(bin);
      setResult(buildBase64Result(raw, outMime));
    } else {
      // Direct encode
      const buf = new Uint8Array(await file.arrayBuffer());
      let bin = "";
      for (let i = 0; i < buf.length; i++) bin += String.fromCharCode(buf[i]!);
      const raw = btoa(bin);
      setResult(buildBase64Result(raw, detected));
    }
    toast.success("Encoded to Base64");
  }, [resizeW, resizeH, quality]);

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

  const output = result ? formatOutput(result, preset, fileName) : "";
  const warning = result ? sizeWarning(result.sizeBytes) : null;
  const ov = result ? overhead(result.encodedBytes, result.sizeBytes) : 0;

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
            <p className="text-xs text-muted-foreground mt-2">or drag-drop, or paste (Ctrl+V) · SVG is kept as text, no re-encode</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4 space-y-3">
          <Label className="text-xs text-muted-foreground">Pre-encode resize (optional)</Label>
          <div className="flex flex-wrap gap-2 items-end">
            <div>
              <Label className="text-xs text-muted-foreground">Max width</Label>
              <Input type="number" value={resizeW} onChange={(e) => setResizeW(e.target.value)} placeholder="auto" className="w-28" />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Max height</Label>
              <Input type="number" value={resizeH} onChange={(e) => setResizeH(e.target.value)} placeholder="auto" className="w-28" />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Quality: {Math.round(quality * 100)}%</Label>
              <Input type="range" min={10} max={100} value={Math.round(quality * 100)} onChange={(e) => setQuality(Number(e.target.value) / 100)} className="w-32" />
            </div>
          </div>
          <p className="text-xs text-muted-foreground">Resize is applied before encoding to shrink the output string. Aspect ratio is preserved.</p>
        </CardContent>
      </Card>

      {result && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <Badge variant="outline">MIME: {result.mime}</Badge>
              <Badge variant="outline">Decoded: {formatSize(result.sizeBytes)}</Badge>
              <Badge variant="outline">Encoded: {formatSize(result.encodedBytes)}</Badge>
              <Badge variant="outline">Overhead: +{ov}%</Badge>
              <Badge variant="outline">Est. gzip: {formatSize(result.gzipBytes)}</Badge>
            </div>
            {warning && (
              <p className="text-xs text-yellow-700 dark:text-yellow-400">{warning}</p>
            )}

            <div>
              <Label className="text-xs text-muted-foreground">Output format</Label>
              <div className="flex flex-wrap gap-2 mt-1">
                {OUTPUT_PRESETS.map((p) => (
                  <Button key={p.id} size="sm" variant={preset === p.id ? "default" : "outline"} onClick={() => setPreset(p.id)} title={p.description}>
                    {p.label}
                  </Button>
                ))}
              </div>
            </div>

            <div className="flex gap-2 items-end">
              <textarea
                readOnly
                value={output}
                aria-label="Base64 output"
                className="flex-1 h-48 rounded-md border bg-muted/30 p-2 font-mono text-xs resize-y"
              />
            </div>

            <div className="flex flex-wrap gap-2">
              <CopyButton getText={() => output} label="Copy output" />
              <DownloadButton
                getText={() => output}
                filename={`${fileName}.${preset === "json" ? "json" : preset === "css" ? "css" : preset === "markdown" ? "md" : "txt"}`}
                label="Download"
                mime="text/plain"
              />
            </div>

            {result.mime.startsWith("image/") && (
              <div>
                <p className="text-xs text-muted-foreground mb-1">Preview</p>
                <img src={result.dataUrl} alt="Encoded preview" className="max-w-full max-h-48 rounded-md border" />
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {error && <ErrorBanner message={error} />}
      <Card>
        <CardContent className="p-4">
          <p className="text-xs text-muted-foreground">
            <strong className="text-foreground">Privacy:</strong> encoding runs locally via FileReader. Your files never leave the browser. Note: Base64 inflates size by ~33%.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
