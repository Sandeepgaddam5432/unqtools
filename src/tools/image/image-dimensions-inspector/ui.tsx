"use client";

import React, { useState, useCallback, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { ErrorBanner, CopyButton, DownloadButton } from "../../_shared";
import {
  detectFormat, inspectImage, formatReport, megapixels, aspectRatio, formatBytes,
} from "./logic";

export default function ImageDimensionsInspectorUI() {
  const [fileName, setFileName] = useState("");
  const [info, setInfo] = useState<ReturnType<typeof inspectImage> | null>(null);
  const [error, setError] = useState("");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const report = useMemo(() => (info ? formatReport(info) : ""), [info]);

  const onFile = useCallback(async (f: File) => {
    setError("");
    setFileName(f.name);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(URL.createObjectURL(f));
    const buf = new Uint8Array(await f.arrayBuffer());
    const detected = detectFormat(buf);
    if (detected === "unknown") {
      setError("Unrecognized image format. Supports PNG, JPEG, GIF, WebP, BMP, TIFF.");
      setInfo(null);
      return;
    }
    const inspected = inspectImage(buf);
    setInfo(inspected);
  }, [previewUrl]);

  return (
    <div className="space-y-4">
      {error && <ErrorBanner message={error} />}
      <Card>
        <CardContent className="p-4 space-y-3">
          <Label className="text-sm font-medium">Upload image</Label>
          <Input
            type="file"
            accept="image/*"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) onFile(f);
            }}
          />
          {previewUrl && (
            <img src={previewUrl} alt="preview" className="max-h-48 rounded-md border border-border" />
          )}
          <div className="flex gap-2 flex-wrap">
            <CopyButton getText={() => report} disabled={!info} />
            <DownloadButton getText={() => report} filename="image-info.txt" disabled={!info} />
          </div>
        </CardContent>
      </Card>

      {info && (
        <>
          <Card>
            <CardContent className="p-4 space-y-2">
              <p className="text-sm font-medium">{fileName || "Image"}</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                <Stat label="Format" value={info.format.toUpperCase()} />
                <Stat label="Dimensions" value={`${info.width}×${info.height}`} />
                <Stat label="Megapixels" value={`${megapixels(info.width, info.height)} MP`} />
                <Stat label="Aspect ratio" value={aspectRatio(info.width, info.height)} />
                <Stat label="Bit depth" value={`${info.bitDepth}-bit`} />
                <Stat label="Color type" value={info.colorType} />
                <Stat label="Alpha" value={info.hasAlpha ? "Yes" : "No"} />
                <Stat label="Animated" value={info.animated ? "Yes" : "No"} />
                <Stat label="Frames" value={String(info.frameCount)} />
                <Stat label="File size" value={formatBytes(info.sourceBytes)} />
                <Stat label="Pixels" value={(info.width * info.height).toLocaleString()} />
                <Stat label="Bytes/pixel" value={(info.sourceBytes / Math.max(1, info.width * info.height)).toFixed(2)} />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground whitespace-pre-wrap font-mono">{report}</p>
            </CardContent>
          </Card>
        </>
      )}

      <Card>
        <CardContent className="p-4">
          <p className="text-xs text-muted-foreground">
            <strong className="text-foreground">Privacy:</strong> file inspection happens locally. Magic-byte detection reads the first few hundred bytes. No uploads.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border p-2">
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="text-sm font-medium break-all">{value}</p>
    </div>
  );
}
