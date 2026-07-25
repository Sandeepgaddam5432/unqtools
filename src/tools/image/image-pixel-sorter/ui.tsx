"use client";

import React, { useState, useCallback, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { ErrorBanner, CopyButton, DownloadButton } from "../../_shared";
import {
  makeComparator,
  validatePixelSortOptions,
  sortWithThreshold,
  findPreset,
  SORT_PRESETS,
  type SortKey,
  type PixelSortOptions,
  type EdgeMode,
  type OutputFormat,
} from "./logic";
import { toast } from "sonner";

const KEYS: SortKey[] = ["brightness", "hue", "saturation", "red", "green", "blue"];
const EDGES: EdgeMode[] = ["clamp", "wrap", "mirror", "zero"];

export default function ImagePixelSorter() {
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [fileName, setFileName] = useState("sorted.png");
  const [opts, setOpts] = useState<PixelSortOptions>({
    key: "brightness", direction: "desc", axis: "row", threshold: 0, edge: "clamp", minLuma: 0, maxLuma: 255,
  });
  const [format, setFormat] = useState<OutputFormat>("image/png");
  const [quality, setQuality] = useState(0.9);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const onFile = useCallback((file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) { setError("Please choose an image file"); return; }
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => { setImage(img); setFileName(file.name.replace(/\.[^.]+$/, "") + "-sorted.png"); setError(null); setPreviewUrl(null); };
    img.onerror = () => setError("Could not load image");
    img.src = url;
  }, []);

  const apply = useCallback(() => {
    if (!image || !canvasRef.current) return;
    const v = validatePixelSortOptions(opts);
    if ("error" in v) { setError(v.error); return; }
    setError(null);
    const canvas = canvasRef.current;
    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(image, 0, 0);
    const data = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const px = data.data, w = canvas.width, h = canvas.height;
    const cmp = makeComparator(opts.key, opts.direction);
    if (opts.axis === "row") {
      for (let y = 0; y < h; y++) {
        const row: Array<[number, number, number]> = [];
        for (let x = 0; x < w; x++) {
          const i = (y * w + x) * 4;
          row.push([px[i]!, px[i + 1]!, px[i + 2]!]);
        }
        const sorted = sortWithThreshold(row, cmp, opts.minLuma, opts.maxLuma);
        for (let x = 0; x < w; x++) {
          const i = (y * w + x) * 4;
          px[i] = sorted[x]![0]; px[i + 1] = sorted[x]![1]; px[i + 2] = sorted[x]![2];
        }
      }
    } else {
      for (let x = 0; x < w; x++) {
        const col: Array<[number, number, number]> = [];
        for (let y = 0; y < h; y++) {
          const i = (y * w + x) * 4;
          col.push([px[i]!, px[i + 1]!, px[i + 2]!]);
        }
        const sorted = sortWithThreshold(col, cmp, opts.minLuma, opts.maxLuma);
        for (let y = 0; y < h; y++) {
          const i = (y * w + x) * 4;
          px[i] = sorted[y]![0]; px[i + 1] = sorted[y]![1]; px[i + 2] = sorted[y]![2];
        }
      }
    }
    ctx.putImageData(data, 0, 0);
    canvas.toBlob((blob) => {
      if (!blob) return;
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      setPreviewUrl(URL.createObjectURL(blob));
    }, format, format === "image/png" ? undefined : quality);
  }, [image, opts, format, quality, previewUrl]);

  const download = useCallback(() => {
    if (!canvasRef.current) return;
    canvasRef.current.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = fileName; a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      toast.success("Image downloaded");
    }, format, format === "image/png" ? undefined : quality);
  }, [fileName, format, quality]);

  const applyPreset = useCallback((id: string) => {
    const p = findPreset(id);
    if (p) {
      setOpts((o) => ({ ...o, ...p.options }));
      toast.success(`Preset: ${p.label}`);
    }
  }, []);

  return (
    <div className="space-y-4">
      <Card><CardContent className="p-4 space-y-3">
        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => onFile(e.target.files?.[0])} />
        <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()}>Choose image</Button>
      </CardContent></Card>
      {image && (
        <Card><CardContent className="p-4 space-y-3">
          <div>
            <Label className="text-xs text-muted-foreground">Sort key</Label>
            <div className="flex flex-wrap gap-1.5 mt-1">
              {KEYS.map((k) => (
                <Button key={k} size="sm" variant={opts.key === k ? "default" : "outline"} onClick={() => setOpts({ ...opts, key: k })}>{k}</Button>
              ))}
            </div>
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Presets</Label>
            <div className="flex flex-wrap gap-1.5 mt-1">
              {SORT_PRESETS.map((p) => (
                <Button key={p.id} variant="outline" size="sm" onClick={() => applyPreset(p.id)}>{p.label}</Button>
              ))}
            </div>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Button size="sm" variant={opts.direction === "asc" ? "default" : "outline"} onClick={() => setOpts({ ...opts, direction: "asc" })}>Ascending</Button>
            <Button size="sm" variant={opts.direction === "desc" ? "default" : "outline"} onClick={() => setOpts({ ...opts, direction: "desc" })}>Descending</Button>
            <Button size="sm" variant={opts.axis === "row" ? "default" : "outline"} onClick={() => setOpts({ ...opts, axis: "row" })}>Rows</Button>
            <Button size="sm" variant={opts.axis === "column" ? "default" : "outline"} onClick={() => setOpts({ ...opts, axis: "column" })}>Columns</Button>
          </div>
          <div><Label className="text-xs text-muted-foreground">Threshold: {opts.threshold}</Label><input type="range" min={0} max={255} value={opts.threshold} onChange={(e) => setOpts({ ...opts, threshold: Number(e.target.value) })} className="w-full" /></div>
          <div><Label className="text-xs text-muted-foreground">Min luma: {opts.minLuma}</Label><input type="range" min={0} max={255} value={opts.minLuma} onChange={(e) => setOpts({ ...opts, minLuma: Number(e.target.value) })} className="w-full" /></div>
          <div><Label className="text-xs text-muted-foreground">Max luma: {opts.maxLuma}</Label><input type="range" min={0} max={255} value={opts.maxLuma} onChange={(e) => setOpts({ ...opts, maxLuma: Number(e.target.value) })} className="w-full" /></div>
          <div>
            <Label className="text-xs text-muted-foreground">Edge mode</Label>
            <div className="flex gap-1.5 mt-1">
              {EDGES.map((e) => (
                <Button key={e} size="sm" variant={opts.edge === e ? "default" : "outline"} onClick={() => setOpts({ ...opts, edge: e })}>{e}</Button>
              ))}
            </div>
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Format</Label>
            <select value={format} onChange={(e) => setFormat(e.target.value as OutputFormat)} className="h-9 w-full rounded-md border bg-background px-3 text-sm">
              <option value="image/png">PNG</option>
              <option value="image/jpeg">JPEG</option>
              <option value="image/webp">WebP</option>
            </select>
          </div>
          {format !== "image/png" && (
            <div><Label className="text-xs text-muted-foreground">Quality: {Math.round(quality * 100)}%</Label><input type="range" min={10} max={100} value={Math.round(quality * 100)} onChange={(e) => setQuality(Number(e.target.value) / 100)} className="w-32" /></div>
          )}
          <div className="flex gap-2 flex-wrap">
            <Button size="sm" onClick={apply}>Sort pixels</Button>
            <Button variant="outline" size="sm" onClick={download} disabled={!previewUrl}>Download</Button>
            <CopyButton getText={() => JSON.stringify(opts)} label="Copy settings" disabled={!previewUrl} />
            <DownloadButton getText={() => previewUrl ?? ""} filename={fileName} disabled={!previewUrl} mime={format} />
          </div>
        </CardContent></Card>
      )}
      <canvas ref={canvasRef} className="hidden" />
      {previewUrl && (
        <Card><CardContent className="p-4">
          <p className="text-xs text-muted-foreground mb-2">Preview</p>
          <img src={previewUrl} alt="Sorted preview" className="max-w-full rounded-md border" />
        </CardContent></Card>
      )}
      {error && <ErrorBanner message={error} />}
      <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground"><strong className="text-foreground">Privacy:</strong> pixel sorting runs locally via Canvas API.</p></CardContent></Card>
    </div>
  );
}
