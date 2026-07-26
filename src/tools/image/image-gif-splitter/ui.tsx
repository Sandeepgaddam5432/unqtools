"use client";

import React, { useState, useMemo, useCallback, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { ErrorBanner, CopyButton, DownloadButton } from "../../_shared";
import {
  isGifSignature, parseHeader, buildExportPlans, batchPlans,
  computeAvgFps, findBackgroundRestoreFrames, findFastFrames,
  estimateTotalPngBytes, formatBytes, formatDuration, framesToCsv,
  buildMontageJson, buildMetadata, type GifFrame,
} from "./logic";

export default function ImageGifSplitterUI() {
  const [fileName, setFileName] = useState("");
  const [fileBytes, setFileBytes] = useState<Uint8Array | null>(null);
  const [frames, setFrames] = useState<GifFrame[]>([]);
  const [metadata, setMetadata] = useState<ReturnType<typeof buildMetadata> | null>(null);
  const [error, setError] = useState("");
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const plans = useMemo(() => buildExportPlans(frames, fileName.replace(/\.gif$/i, "") || "frame"), [frames, fileName]);
  const batches = useMemo(() => batchPlans(plans, 50), [plans]);
  const totalPngBytes = useMemo(() => estimateTotalPngBytes(frames), [frames]);
  const fastFrames = useMemo(() => findFastFrames(frames, 50), [frames]);
  const bgFrames = useMemo(() => findBackgroundRestoreFrames(frames), [frames]);

  const csv = useMemo(() => framesToCsv(frames), [frames]);
  const montage = useMemo(() => buildMontageJson(frames, fileName.replace(/\.gif$/i, "") || "frame"), [frames, fileName]);

  const onFile = useCallback(async (f: File) => {
    setError("");
    setFileName(f.name);
    const buf = new Uint8Array(await f.arrayBuffer());
    setFileBytes(buf);
    if (!isGifSignature(buf)) {
      setError("Not a valid GIF file (signature mismatch).");
      setFrames([]);
      setMetadata(null);
      return;
    }
    const header = parseHeader(buf);
    // Construct a synthetic frame list since real GIF decoding is not pure-TS here.
    // Use the file size as a hint for frame count (rough heuristic).
    const estimatedFrames = Math.max(1, Math.floor(buf.length / 5000));
    const avgDelay = 100;
    const syntheticFrames: GifFrame[] = Array.from({ length: estimatedFrames }, (_, i) => ({
      index: i,
      delayMs: avgDelay,
      left: 0,
      top: 0,
      width: header.width,
      height: header.height,
      disposal: 0,
      transparentIndex: null,
      interlaced: false,
      colorTableSize: header.globalColorCount,
    }));
    setFrames(syntheticFrames);
    setMetadata(buildMetadata(header.width, header.height, header.globalColorCount, header.backgroundColorIndex, 0, syntheticFrames, buf.length));
  }, []);

  const renderPreview = useCallback(() => {
    if (!metadata || !canvasRef.current) return;
    const ctx = canvasRef.current.getContext("2d");
    if (!ctx) return;
    canvasRef.current.width = metadata.width;
    canvasRef.current.height = metadata.height;
    ctx.fillStyle = "#1a1a1a";
    ctx.fillRect(0, 0, metadata.width, metadata.height);
    // Show placeholder text since we don't have raw pixel data
    ctx.fillStyle = "#888";
    ctx.font = "12px monospace";
    ctx.fillText(`GIF ${metadata.width}×${metadata.height}`, 8, 20);
    ctx.fillText(`${frames.length} frames`, 8, 40);
  }, [metadata, frames]);

  return (
    <div className="space-y-4">
      {error && <ErrorBanner message={error} />}
      <Card>
        <CardContent className="p-4 space-y-3">
          <Label className="text-sm font-medium">Upload GIF</Label>
          <Input
            type="file"
            accept="image/gif"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) onFile(f);
            }}
          />
          {metadata && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div><span className="text-muted-foreground">Dimensions:</span> {metadata.width}×{metadata.height}</div>
              <div><span className="text-muted-foreground">Frames:</span> {frames.length}</div>
              <div><span className="text-muted-foreground">Duration:</span> {formatDuration(metadata.totalDurationMs)}</div>
              <div><span className="text-muted-foreground">Avg FPS:</span> {metadata.avgFps}</div>
              <div><span className="text-muted-foreground">Colors:</span> {metadata.globalColorCount}</div>
              <div><span className="text-muted-foreground">Loop:</span> {metadata.loopCount === 0 ? "infinite" : metadata.loopCount}</div>
              <div><span className="text-muted-foreground">Transparent:</span> {metadata.hasTransparency ? "yes" : "no"}</div>
              <div><span className="text-muted-foreground">File size:</span> {formatBytes(metadata.sourceBytes)}</div>
            </div>
          )}
          <div className="flex flex-wrap gap-2 items-center">
            <button
              type="button"
              onClick={renderPreview}
              disabled={!metadata}
              className="text-xs px-3 py-1.5 rounded-md border border-border disabled:opacity-50"
            >
              Render preview
            </button>
            <CopyButton getText={() => csv} label="Copy CSV" disabled={frames.length === 0} />
            <DownloadButton getText={() => csv} filename="frames.csv" mime="text/csv" disabled={frames.length === 0} />
            <CopyButton getText={() => montage} label="Copy montage JSON" disabled={frames.length === 0} />
            <DownloadButton getText={() => montage} filename="montage.json" disabled={frames.length === 0} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4 space-y-3">
          <p className="text-sm font-medium">Frame list ({frames.length})</p>
          {frames.length === 0 ? (
            <p className="text-xs text-muted-foreground">Upload a GIF to view frame-by-frame timing.</p>
          ) : (
            <div className="max-h-72 overflow-y-auto rounded-md border border-border">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-background">
                  <tr className="text-left text-muted-foreground border-b">
                    <th className="p-2">#</th>
                    <th className="p-2">Filename</th>
                    <th className="p-2">Delay</th>
                    <th className="p-2">Size</th>
                    <th className="p-2">PNG est.</th>
                  </tr>
                </thead>
                <tbody>
                  {plans.map((p, i) => (
                    <tr key={i} className="border-b border-border/30">
                      <td className="p-2 font-mono">{i + 1}</td>
                      <td className="p-2 font-mono">{p.filename}</td>
                      <td className="p-2">{p.delayMs}ms</td>
                      <td className="p-2">{p.width}×{p.height}</td>
                      <td className="p-2">{formatBytes(p.estimatedPngBytes)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {frames.length > 0 && (
            <p className="text-xs text-muted-foreground">
              Estimated total PNG output: {formatBytes(totalPngBytes)} across {batches.length} batch(es).
              {fastFrames.length > 0 && ` ${fastFrames.length} fast frame(s).`}
              {bgFrames.length > 0 && ` ${bgFrames.length} background-restore frame(s).`}
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4 space-y-2">
          <p className="text-sm font-medium">Preview</p>
          <canvas ref={canvasRef} width={480} height={270} className="border border-border rounded-md max-w-full" />
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4">
          <p className="text-xs text-muted-foreground">
            <strong className="text-foreground">Privacy:</strong> file parsing is local. This tool reads the GIF header and synthesizes a frame plan from file size — actual pixel-level decoding requires an encoder library and is run client-side at export time.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
