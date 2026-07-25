"use client";

import React, { useState, useCallback, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { ErrorBanner, DownloadButton } from "../../_shared";
import {
  decodeInput,
  sniffMime,
  extensionForMime,
  suggestFilename,
  base64ToBytes,
  preservesAlpha,
  conversionFormats,
  formatSize,
  type OutputFormat,
} from "./logic";
import { toast } from "sonner";

export default function Base64ToImage() {
  const [input, setInput] = useState("");
  const [autoExtract, setAutoExtract] = useState(true);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [mime, setMime] = useState<string>("");
  const [sizeBytes, setSizeBytes] = useState(0);
  const [dimensions, setDimensions] = useState<{ w: number; h: number } | null>(null);
  const [fileName, setFileName] = useState("image.png");
  const [outFormat, setOutFormat] = useState<OutputFormat>("image/png");
  const [error, setError] = useState<string | null>(null);

  const onConvert = useCallback(() => {
    setError(null);
    const parsed = decodeInput(input, autoExtract);
    if ("error" in parsed) {
      setError(parsed.error);
      setPreviewUrl(null);
      setMime("");
      setSizeBytes(0);
      setDimensions(null);
      return;
    }
    // Build data URL for preview
    let url: string;
    let detectedMime = parsed.mime;
    if (parsed.source === "data-uri" && parsed.mime.startsWith("image/")) {
      url = `data:${parsed.mime};base64,${parsed.base64}`;
    } else {
      // Sniff from bytes
      try {
        const bytes = base64ToBytes(parsed.base64);
        const sniffed = sniffMime(bytes);
        if (sniffed) {
          detectedMime = sniffed;
          url = `data:${sniffed};base64,${parsed.base64}`;
        } else if (parsed.mime.startsWith("image/")) {
          url = `data:${parsed.mime};base64,${parsed.base64}`;
        } else {
          setError("Could not determine image format from bytes");
          setPreviewUrl(null);
          return;
        }
      } catch {
        setError("Invalid base64 payload");
        setPreviewUrl(null);
        return;
      }
    }
    setMime(detectedMime);
    setSizeBytes(parsed.sizeBytes);
    setPreviewUrl(url);
    const ext = extensionForMime(detectedMime);
    setFileName(suggestFilename("image", ext));
    // Load image to get dimensions
    const img = new Image();
    img.onload = () => setDimensions({ w: img.naturalWidth, h: img.naturalHeight });
    img.onerror = () => setDimensions(null);
    img.src = url;
    toast.success(`Decoded (${parsed.source}${parsed.repaired ? ", padding repaired" : ""})`);
  }, [input, autoExtract]);

  // Auto-decode on input change
  useEffect(() => {
    if (!input.trim()) {
      setPreviewUrl(null);
      setError(null);
      setMime("");
      setSizeBytes(0);
      setDimensions(null);
      return;
    }
    const t = setTimeout(() => onConvert(), 200);
    return () => clearTimeout(t);
  }, [input, autoExtract, onConvert]);

  const download = useCallback(async () => {
    if (!previewUrl) return;
    // If outFormat matches mime, download directly. Otherwise convert via canvas.
    if (mime === outFormat) {
      const a = document.createElement("a");
      a.href = previewUrl;
      a.download = fileName;
      a.click();
      toast.success("Image downloaded");
      return;
    }
    // Convert
    const img = new Image();
    img.src = previewUrl;
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error("Could not load image"));
    });
    const canvas = document.createElement("canvas");
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    // Fill white background for JPEG
    if (outFormat === "image/jpeg") {
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
    ctx.drawImage(img, 0, 0);
    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = fileName.replace(/\.[^.]+$/, "") + "." + extensionForMime(outFormat);
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
        toast.success("Image downloaded");
      },
      outFormat,
      outFormat === "image/png" ? undefined : 0.9,
    );
  }, [previewUrl, mime, outFormat, fileName]);

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <Label className="text-xs text-muted-foreground">Base64 input (data URI, raw, or wrapped in HTML/CSS/JSON/markdown)</Label>
            <div className="flex items-center gap-2">
              <Switch checked={autoExtract} onCheckedChange={setAutoExtract} id="auto" />
              <Label htmlFor="auto" className="text-xs cursor-pointer">Auto-extract from wrappers</Label>
            </div>
          </div>
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="data:image/png;base64,...  (or paste HTML/CSS/JSON/markdown containing an image)"
            aria-label="Base64 input"
            className="w-full h-40 rounded-md border bg-muted/30 p-2 font-mono text-xs resize-y"
          />
          <Button size="sm" onClick={onConvert} disabled={!input.trim()}>Decode</Button>
        </CardContent>
      </Card>

      {previewUrl && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <Badge variant="outline">MIME: {mime}</Badge>
              <Badge variant="outline">Size: {formatSize(sizeBytes)}</Badge>
              {dimensions && <Badge variant="outline">{dimensions.w} × {dimensions.h}px</Badge>}
            </div>

            <div>
              <Label className="text-xs text-muted-foreground mb-1 block">Download as</Label>
              <div className="flex flex-wrap gap-2 items-center">
                {conversionFormats().map((f) => (
                  <Button key={f.id} size="sm" variant={outFormat === f.id ? "default" : "outline"} onClick={() => setOutFormat(f.id)}>
                    {f.label.split(" ")[0]}
                  </Button>
                ))}
                <Button size="sm" variant="outline" onClick={download} disabled={!previewUrl}>Download</Button>
              </div>
            </div>
            {!preservesAlpha(outFormat) && mime === "image/png" && (
              <p className="text-xs text-yellow-700 dark:text-yellow-400">⚠️ Converting to JPEG will lose transparency — transparent areas become white.</p>
            )}

            <div>
              <p className="text-xs text-muted-foreground mb-2">Preview (checkerboard = transparency)</p>
              <div
                className="rounded-md border overflow-hidden inline-block"
                style={{
                  backgroundImage:
                    "linear-gradient(45deg, #ccc 25%, transparent 25%), linear-gradient(-45deg, #ccc 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #ccc 75%), linear-gradient(-45deg, transparent 75%, #ccc 75%)",
                  backgroundSize: "16px 16px",
                  backgroundPosition: "0 0, 0 8px, 8px -8px, -8px 0",
                }}
              >
                <img src={previewUrl} alt="Decoded image preview" className="max-w-full block" />
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {error && <ErrorBanner message={error} />}
      <Card>
        <CardContent className="p-4">
          <p className="text-xs text-muted-foreground">
            <strong className="text-foreground">Privacy:</strong> decoding runs locally. Your data never leaves the browser. Padding is auto-repaired and MIME is sniffed from magic bytes.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
