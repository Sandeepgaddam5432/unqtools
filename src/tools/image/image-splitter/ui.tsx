"use client";

import React, { useState, useCallback, useRef, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ErrorBanner } from "../../_shared";
import { splitImage, tileFileName } from "./logic";
import { toast } from "sonner";

export default function ImageSplitter() {
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [rows, setRows] = useState(2);
  const [cols, setCols] = useState(2);
  const [tiles, setTiles] = useState<{ url: string; row: number; col: number }[]>([]);
  const [error, setError] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const result = useMemo(() => {
    if (!image) return null;
    return splitImage({
      sourceWidth: image.naturalWidth,
      sourceHeight: image.naturalHeight,
      rows,
      cols,
    });
  }, [image, rows, cols]);

  const onFile = useCallback((file: File | undefined) => {
    if (!file || !file.type.startsWith("image/")) {
      setError("Please choose an image file");
      return;
    }
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      setImage(img);
      setTiles([]);
      setError(null);
    };
    img.onerror = () => setError("Could not load image");
    img.src = url;
  }, []);

  const split = useCallback(() => {
    if (!image || !canvasRef.current || !result) return;
    if ("error" in result) {
      setError(result.error);
      return;
    }
    setError(null);
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const out: { url: string; row: number; col: number }[] = [];
    for (const tile of result.tiles) {
      canvas.width = tile.width;
      canvas.height = tile.height;
      ctx.clearRect(0, 0, tile.width, tile.height);
      ctx.drawImage(
        image,
        tile.x,
        tile.y,
        tile.width,
        tile.height,
        0,
        0,
        tile.width,
        tile.height,
      );
      out.push({ url: canvas.toDataURL("image/png"), row: tile.row, col: tile.col });
    }
    setTiles(out);
    toast.success(`Split into ${out.length} pieces`);
  }, [image, result]);

  const downloadAll = useCallback(() => {
    tiles.forEach((t) => {
      const a = document.createElement("a");
      a.href = t.url;
      a.download = tileFileName("piece", t.row, t.col);
      a.click();
    });
    toast.success(`Downloaded ${tiles.length} pieces`);
  }, [tiles]);

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4 space-y-3">
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => onFile(e.target.files?.[0])}
          />
          <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()}>
            Choose image
          </Button>
          {image && (
            <p className="text-xs text-muted-foreground">
              {image.naturalWidth}×{image.naturalHeight}px
            </p>
          )}
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <Label className="text-xs text-muted-foreground">Rows</Label>
              <Input
                type="number"
                min={1}
                max={20}
                value={rows}
                onChange={(e) => setRows(Math.max(1, Number(e.target.value) || 1))}
                className="w-24"
              />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Cols</Label>
              <Input
                type="number"
                min={1}
                max={20}
                value={cols}
                onChange={(e) => setCols(Math.max(1, Number(e.target.value) || 1))}
                className="w-24"
              />
            </div>
            <Button size="sm" onClick={split} disabled={!image}>
              Split
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={downloadAll}
              disabled={tiles.length === 0}
            >
              Download all ({tiles.length})
            </Button>
          </div>
          {result && !("error" in result) && (
            <Badge variant="secondary">
              {result.tileWidth}×{result.tileHeight}px · {result.total} pieces
            </Badge>
          )}
        </CardContent>
      </Card>

      {error && <ErrorBanner message={error} />}
      <canvas ref={canvasRef} className="hidden" />
      {tiles.length > 0 && (
        <Card>
          <CardContent className="p-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-2">
              {tiles.map((t, i) => (
                <a key={i} href={t.url} download={tileFileName("piece", t.row, t.col)}>
                  <img
                    src={t.url}
                    alt={`Piece ${i + 1}`}
                    className="w-full rounded-md border hover:opacity-80"
                  />
                  <p className="text-xs text-center text-muted-foreground mt-1">
                    r{t.row + 1} c{t.col + 1}
                  </p>
                </a>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
      <Card>
        <CardContent className="p-4">
          <p className="text-xs text-muted-foreground">
            <strong className="text-foreground">Privacy:</strong> all splitting runs locally
            via the Canvas API.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
