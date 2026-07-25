"use client";

import React, { useState, useCallback, useRef, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ErrorBanner, CopyButton, DownloadButton } from "../../_shared";
import {
  computeGrid, suggestGrid, generateTiles, tilesToCsv,
  countEdgeTiles, totalTileArea, tileName, fmt,
  type NamingConvention,
} from "./logic";
import { toast } from "sonner";

export default function ImageTileMaker() {
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [cols, setCols] = useState("3");
  const [rows, setRows] = useState("3");
  const [overlap, setOverlap] = useState("0");
  const [prefix, setPrefix] = useState("tile");
  const [ext, setExt] = useState("png");
  const [convention, setConvention] = useState<NamingConvention>("index");
  const [tileUrls, setTileUrls] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const grid = useMemo(() => {
    if (!image) return null;
    return computeGrid(image.naturalWidth, image.naturalHeight, Number(cols), Number(rows));
  }, [image, cols, rows]);

  const tileSpecs = useMemo(() => {
    if (!image) return [];
    const tiles = generateTiles(
      image.naturalWidth, image.naturalHeight,
      Number(cols), Number(rows), prefix, ext, Number(overlap), convention,
    );
    return "error" in tiles ? [] : tiles;
  }, [image, cols, rows, prefix, ext, overlap, convention]);

  const onFile = useCallback((file: File | undefined) => {
    if (!file || !file.type.startsWith("image/")) { setError("Please choose an image file"); return; }
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => { setImage(img); setTileUrls([]); setError(null); };
    img.onerror = () => setError("Could not load image");
    img.src = url;
  }, []);

  const autoSuggest = useCallback(() => {
    if (!image) return;
    const s = suggestGrid(image.naturalWidth, image.naturalHeight, Number(cols) * Number(rows));
    if (!("error" in s)) { setCols(String(s.cols)); setRows(String(s.rows)); }
  }, [image, cols, rows]);

  const split = useCallback(() => {
    if (!image || !canvasRef.current || !grid || "error" in grid) return;
    setError(null);
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const out: string[] = [];
    for (const spec of tileSpecs) {
      canvas.width = spec.width;
      canvas.height = spec.height;
      ctx.clearRect(0, 0, spec.width, spec.height);
      ctx.drawImage(image, spec.x, spec.y, spec.width, spec.height, 0, 0, spec.width, spec.height);
      out.push(canvas.toDataURL("image/png"));
    }
    setTileUrls(out);
    toast.success(`Generated ${out.length} tiles`);
  }, [image, grid, tileSpecs]);

  const downloadAll = useCallback(() => {
    tileSpecs.forEach((spec, i) => {
      const url = tileUrls[i];
      if (!url) return;
      const a = document.createElement("a");
      a.href = url; a.download = spec.name; a.click();
    });
    toast.success(`Downloaded ${tileUrls.length} tiles`);
  }, [tileUrls, tileSpecs]);

  const csv = useMemo(() => tileSpecs.length ? tilesToCsv(tileSpecs) : "", [tileSpecs]);

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4 space-y-3">
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => onFile(e.target.files?.[0])} />
          <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()}>Choose image</Button>
          {image && <p className="text-xs text-muted-foreground">{image.naturalWidth}×{image.naturalHeight}px</p>}
          <div className="flex flex-wrap items-end gap-3">
            <div><Label className="text-xs text-muted-foreground">Columns</Label><Input type="number" min={1} max={50} value={cols} onChange={(e) => setCols(e.target.value)} className="w-20" /></div>
            <div><Label className="text-xs text-muted-foreground">Rows</Label><Input type="number" min={1} max={50} value={rows} onChange={(e) => setRows(e.target.value)} className="w-20" /></div>
            <div><Label className="text-xs text-muted-foreground">Overlap (px)</Label><Input type="number" min={0} value={overlap} onChange={(e) => setOverlap(e.target.value)} className="w-20" /></div>
            <Button size="sm" variant="ghost" onClick={autoSuggest} disabled={!image}>Auto-suggest</Button>
          </div>
          <div className="flex flex-wrap items-end gap-3">
            <div><Label className="text-xs text-muted-foreground">Prefix</Label><Input value={prefix} onChange={(e) => setPrefix(e.target.value)} className="w-24" /></div>
            <div><Label className="text-xs text-muted-foreground">Extension</Label>
              <select value={ext} onChange={(e) => setExt(e.target.value)} className="h-9 rounded-md border bg-background px-3 text-sm">
                <option value="png">png</option><option value="jpg">jpg</option><option value="webp">webp</option>
              </select>
            </div>
            <div><Label className="text-xs text-muted-foreground">Naming</Label>
              <select value={convention} onChange={(e) => setConvention(e.target.value as NamingConvention)} className="h-9 rounded-md border bg-background px-3 text-sm">
                <option value="index">index (tile-01)</option><option value="row-col">row-col (r1-c1)</option><option value="xy">xy (x100-y50)</option>
              </select>
            </div>
            <Button size="sm" onClick={split} disabled={!image}>Split into tiles</Button>
            <Button variant="outline" size="sm" onClick={downloadAll} disabled={tileUrls.length === 0}>Download all ({tileUrls.length})</Button>
            {csv && <CopyButton getText={() => csv} label="Copy CSV" />}
            {csv && <DownloadButton getText={() => csv} filename="tile-specs.csv" mime="text/csv" />}
          </div>
          {grid && !("error" in grid) && (
            <div className="flex flex-wrap gap-2 text-xs">
              <Badge variant="secondary">{grid.tileWidth}×{grid.tileHeight}px each · {grid.total} tiles</Badge>
              <Badge variant="outline">Edge: {countEdgeTiles(tileSpecs)} · Area: {fmt(totalTileArea(tileSpecs), 0)}px²</Badge>
            </div>
          )}
        </CardContent>
      </Card>

      {error && <ErrorBanner message={error} />}
      <canvas ref={canvasRef} className="hidden" />
      {tileUrls.length > 0 && (
        <Card><CardContent className="p-4">
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
            {tileUrls.map((url, i) => (
              <a key={i} href={url} download={tileSpecs[i]?.name}>
                <img src={url} alt={`Tile ${i + 1}`} className="w-full rounded-md border hover:opacity-80" />
                <p className="text-xs text-center text-muted-foreground mt-1">#{i + 1}</p>
              </a>
            ))}
          </div>
        </CardContent></Card>
      )}
      <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground"><strong className="text-foreground">Privacy:</strong> all splitting runs locally via the Canvas API.</p></CardContent></Card>
    </div>
  );
}
