"use client";

import React, { useState, useCallback, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ErrorBanner } from "../../_shared";
import {
  extractImagesFromPdf,
  formatBytes,
  buildImageManifest,
  buildZipFilename,
  type ExtractedImage,
  type ExtractionResult,
} from "./logic";

export default function PDFtoImagesPNGJPG() {
  const [file, setFile] = useState<File | null>(null);
  const [extracting, setExtracting] = useState(false);
  const [result, setResult] = useState<ExtractionResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [minDimension, setMinDimension] = useState(1);
  const [maxImages, setMaxImages] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (!selected) return;
    setFile(selected);
    setResult(null);
    setError(null);
  }, []);

  const handleExtract = useCallback(async () => {
    if (!file) {
      setError("Please select a PDF file first.");
      return;
    }
    setExtracting(true);
    setError(null);
    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      const res = await extractImagesFromPdf(bytes, {
        outputFormat: "original",
        minDimension,
        maxImages,
        filenameTemplate: "pdf-image-{page}-{index}.{format}",
      });
      setResult(res);
      if (res.images.length === 0 && res.warnings.length > 0) {
        setError(res.warnings[0]);
      }
    } catch (e) {
      setError(`Extraction failed: ${(e as Error).message}`);
    } finally {
      setExtracting(false);
    }
  }, [file, minDimension, maxImages]);

  const handleDownloadImage = useCallback((img: ExtractedImage) => {
    const blob = new Blob([img.bytes as BlobPart], { type: img.mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = img.filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }, []);

  const handleDownloadAll = useCallback(async () => {
    if (!result || result.images.length === 0) return;
    // Lazy-load JSZip
    const JSZip = (await import("jszip")).default;
    const zip = new JSZip();
    result.images.forEach((img) => {
      zip.file(img.filename, img.bytes);
    });
    zip.file("manifest.csv", buildImageManifest(result.images));
    const blob = await zip.generateAsync({ type: "blob" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = buildZipFilename(file?.name);
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }, [result, file]);

  const clear = useCallback(() => {
    setFile(null);
    setResult(null);
    setError(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, []);

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4 space-y-4">
          <div>
            <Label className="text-sm font-medium">PDF File</Label>
            <Input
              ref={fileInputRef}
              type="file"
              accept="application/pdf,.pdf"
              onChange={handleFileSelect}
              className="mt-1"
            />
            {file && (
              <p className="text-xs text-muted-foreground mt-1">
                {file.name} ({formatBytes(file.size)})
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-xs text-muted-foreground">Min image dimension (px)</Label>
              <Input
                type="number"
                min={1}
                value={minDimension}
                onChange={(e) => setMinDimension(Number(e.target.value) || 1)}
                className="mt-1"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Filters out tiny decorative images below this size.
              </p>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Max images (0 = no limit)</Label>
              <Input
                type="number"
                min={0}
                value={maxImages}
                onChange={(e) => setMaxImages(Number(e.target.value) || 0)}
                className="mt-1"
              />
            </div>
          </div>

          <div className="flex gap-2">
            <Button onClick={handleExtract} disabled={!file || extracting}>
              {extracting ? "Extracting…" : "Extract Images"}
            </Button>
            <Button variant="ghost" onClick={clear} disabled={!file && !result}>
              Clear
            </Button>
          </div>
        </CardContent>
      </Card>

      {error && <ErrorBanner message={error} />}

      {result && (
        <>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex gap-4 text-sm">
                  <span><strong>{result.totalImages}</strong> images extracted</span>
                  <span className="text-muted-foreground">|</span>
                  <span><strong>{result.totalPages}</strong> pages scanned</span>
                  {result.skipped > 0 && (
                    <>
                      <span className="text-muted-foreground">|</span>
                      <span className="text-muted-foreground">{result.skipped} skipped</span>
                    </>
                  )}
                </div>
                {result.images.length > 0 && (
                  <Button variant="outline" size="sm" onClick={handleDownloadAll}>
                    Download All (ZIP)
                  </Button>
                )}
              </div>
              {result.warnings.length > 0 && (
                <details className="mt-3">
                  <summary className="text-xs text-muted-foreground cursor-pointer">
                    {result.warnings.length} warning(s)
                  </summary>
                  <ul className="mt-2 space-y-1 text-xs text-muted-foreground list-disc pl-4">
                    {result.warnings.map((w, i) => (
                      <li key={i}>{w}</li>
                    ))}
                  </ul>
                </details>
              )}
            </CardContent>
          </Card>

          {result.images.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Extracted Images</CardTitle>
              </CardHeader>
              <CardContent className="p-4">
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                  {result.images.map((img, i) => (
                    <div key={i} className="rounded-md border p-2 space-y-2">
                      <div className="aspect-square bg-muted/30 rounded flex items-center justify-center overflow-hidden">
                        {img.format === "jpeg" || img.format === "png" || img.format === "gif" ? (
                          <img
                            src={URL.createObjectURL(new Blob([img.bytes as BlobPart], { type: img.mimeType }))}
                            alt={img.filename}
                            className="max-w-full max-h-full object-contain"
                            onLoad={(e) => {
                              // Revoke after load to avoid memory leak
                              const img = e.target as HTMLImageElement;
                              setTimeout(() => URL.revokeObjectURL(img.src), 5000);
                            }}
                          />
                        ) : (
                          <div className="text-xs text-muted-foreground text-center p-2">
                            {img.format.toUpperCase()}<br />
                            (raw bytes)
                          </div>
                        )}
                      </div>
                      <div className="space-y-1">
                        <p className="text-xs font-medium truncate">{img.filename}</p>
                        <p className="text-xs text-muted-foreground">
                          {img.width}×{img.height} · {formatBytes(img.bytes.length)}
                        </p>
                        <p className="text-xs text-muted-foreground">Page {img.pageNumber}</p>
                        <Button
                          size="sm"
                          variant="outline"
                          className="w-full"
                          onClick={() => handleDownloadImage(img)}
                        >
                          Download
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {result.images.length === 0 && !error && (
            <Card>
              <CardContent className="p-8 text-center text-muted-foreground">
                <p className="text-sm">No images found in this PDF.</p>
                <p className="text-xs mt-2">
                  This tool extracts images <em>embedded</em> in the PDF. If the PDF contains
                  only vector graphics or text, there are no images to extract.
                  Rasterizing pages to images is not supported (would require pdf.js).
                </p>
              </CardContent>
            </Card>
          )}
        </>
      )}

      <Card>
        <CardContent className="p-4">
          <p className="text-xs text-muted-foreground">
            <strong className="text-foreground">Privacy:</strong> All processing happens 100% in your browser. The PDF file never leaves your device. Nothing is uploaded, tracked, or stored remotely.
          </p>
          <p className="text-xs text-muted-foreground mt-2">
            <strong className="text-foreground">Note:</strong> This tool extracts images already embedded in the PDF (JPEG, PNG, etc.). It does not rasterize pages — for that, a different tool with pdf.js would be needed.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
