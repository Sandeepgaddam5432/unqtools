"use client";

import React, { useState, useCallback, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ErrorBanner, CopyButton, DownloadButton } from "../../_shared";
import {
  formatBytes, formatDimensions, getCommonAspectRatios,
  getFaviconSizes, getFileExtension, getMimeType,
  type ImageInfo, type ProcessOptions,
} from "./logic";

export default function ImageSpriteSheetGenerator() {
  const [imageInfo, setImageInfo] = useState<ImageInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback(async (file: File) => {
    setError(null);
    try {
      const url = URL.createObjectURL(file);
      setPreviewUrl(url);

      // Get image dimensions
      const img = new Image();
      img.onload = () => {
        const info: ImageInfo = {
          width: img.naturalWidth,
          height: img.naturalHeight,
          format: file.type.split("/")[1] || "unknown",
          sizeBytes: file.size,
          aspectRatio: img.naturalWidth / img.naturalHeight,
          megapixels: (img.naturalWidth * img.naturalHeight) / 1000000,
        };
        setImageInfo(info);
      };
      img.onerror = () => {
        setError("Could not load image. Please try another file.");
        setImageInfo(null);
      };
      img.src = url;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load image");
      setImageInfo(null);
    }
  }, []);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, [handleFile]);

  const ratios = getCommonAspectRatios();
  const faviconSizes = getFaviconSizes();

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4 space-y-3">
          <div
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={onDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${dragOver ? "border-primary bg-primary/5" : "border-border"}`}
          >
            <p className="text-sm font-medium">{dragOver ? "Drop image here" : "Drag & drop an image or click to browse"}</p>
            <p className="text-xs text-muted-foreground mt-1">All processing happens in your browser — nothing is uploaded.</p>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleFile(f);
              }}
            />
          </div>
        </CardContent>
      </Card>

      {error && <ErrorBanner message={error} />}

      {previewUrl && (
        <Card>
          <CardHeader><CardTitle className="text-sm">Preview</CardTitle></CardHeader>
          <CardContent className="p-4">
            <img src={previewUrl} alt="Preview" className="max-w-full max-h-96 mx-auto rounded border" />
          </CardContent>
        </Card>
      )}

      {imageInfo && (
        <Card>
          <CardHeader><CardTitle className="text-sm">Image Information</CardTitle></CardHeader>
          <CardContent className="p-4 space-y-3">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Dimensions</div>
                <div className="font-mono">{formatDimensions(imageInfo.width, imageInfo.height)}</div>
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-wide text-muted-foreground">File size</div>
                <div className="font-mono">{formatBytes(imageInfo.sizeBytes)}</div>
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Format</div>
                <div className="font-mono">{imageInfo.format.toUpperCase()}</div>
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Megapixels</div>
                <div className="font-mono">{imageInfo.megapixels.toFixed(2)} MP</div>
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Aspect ratio</div>
                <div className="font-mono">{imageInfo.aspectRatio.toFixed(3)}</div>
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-wide text-muted-foreground">MIME type</div>
                <div className="font-mono">{getMimeType(imageInfo.format)}</div>
              </div>
            </div>
            <CopyButton getText={() => JSON.stringify(imageInfo, null, 2)} label="Copy info as JSON" />
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader><CardTitle className="text-sm">Common Aspect Ratios</CardTitle></CardHeader>
        <CardContent className="p-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
            {ratios.map((r) => (
              <div key={r.label} className="rounded border p-2">
                <div className="font-medium">{r.label}</div>
                <div className="text-muted-foreground font-mono">{formatDimensions(r.width, r.height)}</div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-sm">Favicon Sizes</CardTitle></CardHeader>
        <CardContent className="p-4">
          <div className="flex flex-wrap gap-2">
            {faviconSizes.map((s) => (
              <Badge key={s} variant="outline">{s}×{s}</Badge>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4">
          <p className="text-xs text-muted-foreground">
            <strong className="text-foreground">Privacy:</strong> All image processing happens 100% in your browser. Nothing is uploaded, tracked, or stored remotely. Works offline as a PWA.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
