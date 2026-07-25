"use client";

import React, { useState, useCallback, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { ErrorBanner, CopyButton, DownloadButton } from "../../_shared";
import { makeComparator, validatePixelSortOptions, type SortKey } from "./logic";
import { toast } from "sonner";

export default function ImagePixelSorter() {
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [fileName, setFileName] = useState("sorted.png");
  const [key, setKey] = useState<SortKey>("brightness");
  const [direction, setDirection] = useState<"asc" | "desc">("desc");
  const [axis, setAxis] = useState<"row" | "column">("row");
  const [threshold, setThreshold] = useState(0);
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
    const v = validatePixelSortOptions({ key, direction, axis, threshold });
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
    const cmp = makeComparator(key, direction);
    if (axis === "row") {
      for (let y = 0; y < h; y++) {
        const row: Array<[number, number, number]> = [];
        for (let x = 0; x < w; x++) {
          const i = (y * w + x) * 4;
          row.push([px[i]!, px[i + 1]!, px[i + 2]!]);
        }
        row.sort(cmp);
        for (let x = 0; x < w; x++) {
          const i = (y * w + x) * 4;
          px[i] = row[x]![0]; px[i + 1] = row[x]![1]; px[i + 2] = row[x]![2];
        }
      }
    } else {
      for (let x = 0; x < w; x++) {
        const col: Array<[number, number, number]> = [];
        for (let y = 0; y < h; y++) {
          const i = (y * w + x) * 4;
          col.push([px[i]!, px[i + 1]!, px[i + 2]!]);
        }
        col.sort(cmp);
        for (let y = 0; y < h; y++) {
          const i = (y * w + x) * 4;
          px[i] = col[y]![0]; px[i + 1] = col[y]![1]; px[i + 2] = col[y]![2];
        }
      }
    }
    ctx.putImageData(data, 0, 0);
    canvas.toBlob((blob) => {
      if (!blob) return;
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      setPreviewUrl(URL.createObjectURL(blob));
    }, "image/png");
  }, [image, key, direction, axis, threshold, previewUrl]);

  const download = useCallback(() => {
    if (!canvasRef.current) return;
    canvasRef.current.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = fileName; a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      toast.success("Image downloaded");
    }, "image/png");
  }, [fileName]);

  return (
    <div className="space-y-4">
      <Card><CardContent className="p-4 space-y-3">
        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => onFile(e.target.files?.[0])} />
        <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()}>Choose image</Button>
      </CardContent></Card>
      {image && (
        <Card><CardContent className="p-4 space-y-3">
          <div className="flex flex-wrap gap-2">
            {(["brightness", "hue", "saturation", "red", "green", "blue"] as SortKey[]).map((k) => (
              <Button key={k} size="sm" variant={key === k ? "default" : "outline"} onClick={() => setKey(k)}>{k}</Button>
            ))}
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant={direction === "asc" ? "default" : "outline"} onClick={() => setDirection("asc")}>Ascending</Button>
            <Button size="sm" variant={direction === "desc" ? "default" : "outline"} onClick={() => setDirection("desc")}>Descending</Button>
            <Button size="sm" variant={axis === "row" ? "default" : "outline"} onClick={() => setAxis("row")}>Rows</Button>
            <Button size="sm" variant={axis === "column" ? "default" : "outline"} onClick={() => setAxis("column")}>Columns</Button>
          </div>
          <div><Label className="text-xs text-muted-foreground">Threshold: {threshold}</Label><input type="range" min={0} max={255} value={threshold} onChange={(e) => setThreshold(Number(e.target.value))} className="w-full" /></div>
          <div className="flex gap-2 flex-wrap">
            <Button size="sm" onClick={apply}>Sort pixels</Button>
            <Button variant="outline" size="sm" onClick={download} disabled={!previewUrl}>Download</Button>
            {previewUrl && <CopyButton getText={() => previewUrl} label="Copy URL" />}
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
