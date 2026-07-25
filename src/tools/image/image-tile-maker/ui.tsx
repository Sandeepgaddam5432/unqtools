"use client";

import React, { useState, useCallback, useRef, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ErrorBanner } from "../../_shared";
import { computeGrid, tileOffset, tileName } from "./logic";
import { toast } from "sonner";

export default function ImageTileMaker() {
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [cols, setCols] = useState(3);
  const [rows, setRows] = useState(3);
  const [tiles, setTiles] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const grid = useMemo(() => {
    if (!image) return null;
    return computeGrid(image.naturalWidth, image.naturalHeight, cols, rows);
  }, [image, cols, rows]);

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
    if (!image || !canvasRef.current) return;
    if (!grid || "error" in grid) {
      setError(grid && "error" in grid ? grid.error : "Invalid grid");
      return;
    }
    setError(null);
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const out: string[] = [];
    for (let i = 0; i < grid.total; i++) {
      const off = tileOffset(i, grid.cols, grid.tileWidth, grid.tileHeight);
      if ("error" in off) continue;
      canvas.width = grid.tileWidth;
      canvas.height = grid.tileHeight;
      ctx.clearRect(0, 0, grid.tileWidth, grid.tileHeight);
      ctx.drawImage(
        image,
        off.x,
        off.y,
        grid.tileWidth,
        grid.tileHeight,
        0,
        0,
        grid.tileWidth,
        grid.tileHeight,
      );
      const url = canvas.toDataURL("image/png");
      out.push(url);
    }
    setTiles(out);
    toast.success(`Generated ${out.length} tiles`);
  }, [image, grid]);

  const downloadAll = useCallback(() => {
    tiles.forEach((url, i) => {
      const a = document.createElement("a");
      a.href = url;
      a.download = tileName("image", i, tiles.length);
      a.click();
    });
    toast.success(`Downloaded ${tiles.length} tiles`);
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
              <Label className="text-xs text-muted-foreground">Columns</Label>
              <Input
                type="number"
                min={1}
                max={20}
                value={cols}
                onChange={(e) => setCols(Math.max(1, Number(e.target.value) || 1))}
                className="w-24"
              />
            </div>
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
            <Button size="sm" onClick={split} disabled={!image}>
              Split into tiles
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
          {grid && !("error" in grid) && (
            <Badge variant="secondary">
              {grid.tileWidth}×{grid.tileHeight}px each · {grid.total} tiles
            </Badge>
          )}
        </CardContent>
      </Card>

      {error && <ErrorBanner message={error} />}
      <canvas ref={canvasRef} className="hidden" />
      {tiles.length > 0 && (
        <Card>
          <CardContent className="p-4">
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
              {tiles.map((url, i) => (
                <a key={i} href={url} download={tileName("image", i, tiles.length)}>
                  <img
                    src={url}
                    alt={`Tile ${i + 1}`}
                    className="w-full rounded-md border hover:opacity-80"
                  />
                  <p className="text-xs text-center text-muted-foreground mt-1">#{i + 1}</p>
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
