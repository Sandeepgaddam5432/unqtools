"use client";

import React, { useState, useCallback, useRef, useEffect, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DownloadButton,
  ErrorBanner,
} from "../../_shared";
import { toast } from "sonner";
import {
  ImagePlus,
  Images,
  Layers,
  Sparkles,
  Trash2,
  Eye,
  Download,
  Film,
  Database,
  Highlighter,
  BarChart3,
  Info,
  Settings2,
} from "lucide-react";
import {
  buildLibraryFromTiles,
  assembleTileLibrary,
  computeMosaicLayout,
  matchTilesToCells,
  computeRenderStats,
  tileUsageHistogram,
  computePrintDimensions,
  applyMask,
  exportTileMapManifest,
  generateStarterTileData,
  isHeic,
  decodeHeic,
  renderMosaicPreview,
  renderMosaicFullRes,
  applyBlend,
  applyGrout,
  THUMB_SIZE,
  type RGB,
  type Lab,
  type ImageLike,
  type TileData,
  type TileLibrary,
  type Cell,
  type MatchResult,
  type MatchMode,
  type MosaicOptions,
  type PaperSize,
  type Region,
  type RenderStats,
} from "./logic";
import { openDB, type IDBPDatabase } from "idb";

// ---------------------------------------------------------------------------
// IndexedDB cache helpers
// ---------------------------------------------------------------------------

interface CachedTile {
  id: string;
  filename: string;
  avgColor: RGB;
  labColor: Lab;
  edgeScore: number;
  weight: number;
  thumbBlob: Blob;
}

const DB_NAME = "unqtools-mosaic";
const STORE_NAME = "tiles";
const META_STORE = "meta";

async function getDb(): Promise<IDBPDatabase> {
  return openDB(DB_NAME, 1, {
    upgrade(db) {
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains(META_STORE)) {
        db.createObjectStore(META_STORE);
      }
    },
  });
}

async function cacheTiles(tiles: TileData[]): Promise<void> {
  try {
    const db = await getDb();
    const tx = db.transaction(STORE_NAME, "readwrite");
    for (const t of tiles) {
      const thumb = t.thumb as Blob | ImageBitmap | null;
      let thumbBlob: Blob | null = null;
      if (thumb instanceof Blob) {
        thumbBlob = thumb;
      } else if (thumb && "width" in thumb) {
        // ImageBitmap — convert to blob via canvas
        const c = document.createElement("canvas");
        c.width = THUMB_SIZE;
        c.height = THUMB_SIZE;
        const ctx = c.getContext("2d");
        if (ctx) {
          ctx.drawImage(thumb as ImageBitmap, 0, 0, THUMB_SIZE, THUMB_SIZE);
          thumbBlob = await new Promise<Blob | null>((res) =>
            c.toBlob((b) => res(b), "image/png"),
          );
        }
      }
      if (!thumbBlob) continue;
      const entry: CachedTile = {
        id: t.id,
        filename: t.filename ?? t.id,
        avgColor: t.avgColor,
        labColor: t.labColor,
        edgeScore: t.edgeScore,
        weight: t.weight,
        thumbBlob,
      };
      await tx.store.put(entry);
    }
    await tx.done;
    await db.put(META_STORE, tiles.length, "count");
  } catch (e) {
    console.warn("cacheTiles failed", e);
  }
}

async function loadCachedTiles(): Promise<TileData[]> {
  try {
    const db = await getDb();
    const all = (await db.getAll(STORE_NAME)) as CachedTile[];
    const tiles: TileData[] = [];
    for (const c of all) {
      const bitmap = await createImageBitmap(c.thumbBlob);
      tiles.push({
        id: c.id,
        source: bitmap,
        thumb: bitmap,
        avgColor: c.avgColor,
        labColor: c.labColor,
        edgeScore: c.edgeScore,
        weight: c.weight,
        filename: c.filename,
      });
    }
    return tiles;
  } catch (e) {
    console.warn("loadCachedTiles failed", e);
    return [];
  }
}

async function clearCache(): Promise<void> {
  try {
    const db = await getDb();
    await db.clear(STORE_NAME);
    await db.clear(META_STORE);
  } catch (e) {
    console.warn("clearCache failed", e);
  }
}

async function getCachedCount(): Promise<number> {
  try {
    const db = await getDb();
    const c = (await db.get(META_STORE, "count")) as number | undefined;
    return c ?? 0;
  } catch {
    return 0;
  }
}

// ---------------------------------------------------------------------------
// Thumbnail generation (main thread; createImageBitmap is non-blocking)
// ---------------------------------------------------------------------------

async function makeThumb(
  file: File,
): Promise<{ thumb: ImageBitmap; imageData: ImageLike; source: ImageBitmap }> {
  let bitmap: ImageBitmap;
  if (isHeic(file)) {
    bitmap = await decodeHeic(file);
  } else {
    bitmap = await createImageBitmap(file);
  }
  // Downscale to THUMB_SIZE x THUMB_SIZE (crop-to-fill for square thumb)
  const srcW = bitmap.width;
  const srcH = bitmap.height;
  const side = Math.min(srcW, srcH);
  const sx = (srcW - side) / 2;
  const sy = (srcH - side) / 2;
  const canvas =
    typeof OffscreenCanvas !== "undefined"
      ? new OffscreenCanvas(THUMB_SIZE, THUMB_SIZE)
      : document.createElement("canvas");
  canvas.width = THUMB_SIZE;
  canvas.height = THUMB_SIZE;
  const ctx = (canvas as OffscreenCanvas).getContext("2d")!;
  ctx.drawImage(bitmap, sx, sy, side, side, 0, 0, THUMB_SIZE, THUMB_SIZE);
  // Extract pixel data for color analysis
  const imageData = ctx.getImageData(0, 0, THUMB_SIZE, THUMB_SIZE);
  const thumbBitmap = await createImageBitmap(canvas as OffscreenCanvas);
  return {
    thumb: thumbBitmap,
    imageData: {
      width: imageData.width,
      height: imageData.height,
      data: imageData.data,
    },
    source: bitmap,
  };
}

async function makeStarterThumb(color: RGB): Promise<{
  thumb: ImageBitmap;
  imageData: ImageLike;
  source: ImageBitmap;
}> {
  const canvas =
    typeof OffscreenCanvas !== "undefined"
      ? new OffscreenCanvas(THUMB_SIZE, THUMB_SIZE)
      : document.createElement("canvas");
  canvas.width = THUMB_SIZE;
  canvas.height = THUMB_SIZE;
  const ctx = (canvas as OffscreenCanvas).getContext("2d")!;
  ctx.fillStyle = `rgb(${color.r},${color.g},${color.b})`;
  ctx.fillRect(0, 0, THUMB_SIZE, THUMB_SIZE);
  const imageData = ctx.getImageData(0, 0, THUMB_SIZE, THUMB_SIZE);
  const thumbBitmap = await createImageBitmap(canvas as OffscreenCanvas);
  return {
    thumb: thumbBitmap,
    imageData: {
      width: imageData.width,
      height: imageData.height,
      data: imageData.data,
    },
    source: thumbBitmap,
  };
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

type PreviewMode = "original" | "mosaic" | "blend";

interface MainImage {
  bitmap: ImageBitmap;
  imageData: ImageLike;
  width: number;
  height: number;
  name: string;
}

export default function PhotoMosaicGenerator() {
  // --- main image + tile library ---
  const [mainImage, setMainImage] = useState<MainImage | null>(null);
  const [library, setLibrary] = useState<TileLibrary | null>(null);
  const [tileWeights, setTileWeights] = useState<Map<string, number>>(new Map());

  // --- options ---
  const [tilesAcross, setTilesAcross] = useState(32);
  const [tileAspect, setTileAspect] = useState(1);
  const [blendPercent, setBlendPercent] = useState(0);
  const [tintStrength, setTintStrength] = useState(0);
  const [groutSpacing, setGroutSpacing] = useState(0);
  const [groutColor, setGroutColor] = useState<RGB>({ r: 0, g: 0, b: 0 });
  const [matchMode, setMatchMode] = useState<MatchMode>("lab");
  const [allowRotation, setAllowRotation] = useState(false);
  const [minDistance, setMinDistance] = useState(1);
  const [fitMode, setFitMode] = useState<"crop" | "letterbox">("crop");

  // --- print calc ---
  const [paperSize, setPaperSize] = useState<PaperSize>("A4");
  const [dpi, setDpi] = useState(300);

  // --- async state ---
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number; label: string } | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);
  const [cachedCount, setCachedCount] = useState(0);

  // --- preview / render ---
  const [previewMode, setPreviewMode] = useState<PreviewMode>("mosaic");
  const [matches, setMatches] = useState<MatchResult[]>([]);
  const [cells, setCells] = useState<Cell[]>([]);
  const [stats, setStats] = useState<RenderStats | null>(null);
  const [fullResCanvas, setFullResCanvas] = useState<HTMLCanvasElement | null>(null);

  // --- mask regions ---
  const [maskRegions, setMaskRegions] = useState<Region[]>([]);
  const [maskMode, setMaskMode] = useState(false);
  const maskDragRef = useRef<{ x0: number; y0: number } | null>(null);

  // --- per-tile inspection ---
  const [inspectedTile, setInspectedTile] = useState<{
    cellIndex: number;
    tile: TileData;
    score: number;
    alternatives: string[];
  } | null>(null);

  const previewCanvasRef = useRef<HTMLCanvasElement>(null);
  const mainImageInputRef = useRef<HTMLInputElement>(null);
  const tileInputRef = useRef<HTMLInputElement>(null);

  // -------------------------------------------------------------------
  // Initial: load cached count
  // -------------------------------------------------------------------
  useEffect(() => {
    getCachedCount().then(setCachedCount);
  }, []);

  // -------------------------------------------------------------------
  // Load main image
  // -------------------------------------------------------------------
  const onMainImage = useCallback(async (file: File) => {
    setBusy(true);
    setError(null);
    try {
      const bitmap = isHeic(file) ? await decodeHeic(file) : await createImageBitmap(file);
      const canvas =
        typeof OffscreenCanvas !== "undefined"
          ? new OffscreenCanvas(bitmap.width, bitmap.height)
          : document.createElement("canvas");
      canvas.width = bitmap.width;
      canvas.height = bitmap.height;
      const ctx = (canvas as OffscreenCanvas).getContext("2d")!;
      ctx.drawImage(bitmap, 0, 0);
      const imgData = ctx.getImageData(0, 0, bitmap.width, bitmap.height);
      setMainImage({
        bitmap,
        imageData: {
          width: imgData.width,
          height: imgData.height,
          data: imgData.data,
        },
        width: bitmap.width,
        height: bitmap.height,
        name: file.name,
      });
      toast.success("Main image loaded");
    } catch (e) {
      setError(`Could not load main image: ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  }, []);

  // -------------------------------------------------------------------
  // Load tile library (drag-drop many files)
  // -------------------------------------------------------------------
  const onTileFiles = useCallback(
    async (files: FileList | File[]) => {
      const list = Array.from(files).filter(
        (f) => f.type.startsWith("image/") || isHeic(f),
      );
      if (list.length === 0) {
        toast.error("No image files found");
        return;
      }
      setBusy(true);
      setError(null);
      setProgress({ done: 0, total: list.length, label: `Analyzing ${list.length} photos…` });
      try {
        const decoded: Array<{
          id: string;
          filename: string;
          thumb: ImageBitmap;
          source: ImageBitmap;
          imageData: ImageLike;
          weight: number;
        }> = [];
        for (let i = 0; i < list.length; i++) {
          const f = list[i]!;
          try {
            const { thumb, imageData, source } = await makeThumb(f);
            decoded.push({
              id: `${f.name}-${i}`,
              filename: f.name,
              thumb,
              source,
              imageData,
              weight: tileWeights.get(`${f.name}-${i}`) ?? 1,
            });
          } catch (e) {
            console.warn(`Skipping ${f.name}`, e);
          }
          setProgress({ done: i + 1, total: list.length, label: `Analyzing ${list.length} photos…` });
          // Yield to UI every 8 tiles
          if (i % 8 === 0) await new Promise((r) => setTimeout(r, 0));
        }
        const lib = assembleTileLibrary(decoded);
        lib.source = "user";
        setLibrary(lib);
        await cacheTiles(lib.tiles);
        const count = await getCachedCount();
        setCachedCount(count);
        toast.success(`Indexed ${lib.tiles.length} tiles`);
      } catch (e) {
        setError(`Tile indexing failed: ${(e as Error).message}`);
      } finally {
        setBusy(false);
        setProgress(null);
      }
    },
    [tileWeights],
  );

  // -------------------------------------------------------------------
  // Reuse cached tile library
  // -------------------------------------------------------------------
  const loadCachedLibrary = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const tiles = await loadCachedTiles();
      if (tiles.length === 0) {
        toast.error("No cached tiles found");
        return;
      }
      const lib = buildLibraryFromTiles(tiles, "cache");
      setLibrary(lib);
      toast.success(`Reusing ${tiles.length} tiles from cache`);
    } catch (e) {
      setError(`Cache load failed: ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  }, []);

  // -------------------------------------------------------------------
  // Use starter tile set
  // -------------------------------------------------------------------
  const generateStarterTiles = useCallback(async (count = 64) => {
    setBusy(true);
    setError(null);
    try {
      const data = generateStarterTileData(count);
      const decoded: Array<{
        id: string;
        filename: string;
        thumb: ImageBitmap;
        source: ImageBitmap;
        imageData: ImageLike;
        weight: number;
      }> = [];
      for (const d of data) {
        const { thumb, imageData, source } = await makeStarterThumb(d.avgColor);
        decoded.push({
          id: d.id,
          filename: d.filename ?? d.id,
          thumb,
          source,
          imageData,
          weight: 1,
        });
      }
      const lib = assembleTileLibrary(decoded);
      lib.source = "starter";
      setLibrary(lib);
      toast.success(`Generated ${count} starter tiles`);
    } catch (e) {
      setError(`Starter tile generation failed: ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  }, []);

  // -------------------------------------------------------------------
  // Build mosaic (compute layout + match tiles) — re-run on option change
  // -------------------------------------------------------------------
  const opts: MosaicOptions = useMemo(
    () => ({
      tilesAcross,
      tileAspect,
      blendPercent,
      tintStrength,
      groutSpacing,
      groutColor,
      matchMode,
      allowRotation,
      minDistance,
      fitMode,
      dpi,
      paperSize,
    }),
    [
      tilesAcross,
      tileAspect,
      blendPercent,
      tintStrength,
      groutSpacing,
      groutColor,
      matchMode,
      allowRotation,
      minDistance,
      fitMode,
      dpi,
      paperSize,
    ],
  );

  useEffect(() => {
    if (!mainImage || !library) {
      setMatches([]);
      setCells([]);
      setStats(null);
      return;
    }
    try {
      const { cells: layoutCells } = computeMosaicLayout(mainImage.imageData, {
        tilesAcross,
        tileAspect,
      });
      // Apply mask
      const { important, normal } = applyMask(layoutCells, maskRegions);
      const tagged = [...normal, ...important.map((c) => ({ ...c, important: true }))];
      // Match normal cells with user minDistance; important cells with 0 (best match)
      const normalMatches = matchTilesToCells(normal, library, {
        matchMode,
        minDistance,
        allowRotation,
      });
      const importantMatches = matchTilesToCells(important, library, {
        matchMode,
        minDistance: 0,
        allowRotation,
      });
      // Merge back in cell-index order
      const normalByIdx = new Map(normalMatches.map((m) => [m.cellIndex, m]));
      const importantByIdx = new Map(importantMatches.map((m) => [m.cellIndex, m]));
      const merged: MatchResult[] = [];
      for (let i = 0; i < tagged.length; i++) {
        const m = normalByIdx.get(i) ?? importantByIdx.get(i);
        if (m) merged.push(m);
      }
      // Re-index cellIndex against the tagged array position
      const reordered = merged.map((m, idx) => ({ ...m, cellIndex: idx }));
      setCells(tagged);
      setMatches(reordered);
      setStats(computeRenderStats(reordered, tagged.length));
    } catch (e) {
      setError(`Mosaic build failed: ${(e as Error).message}`);
    }
  }, [
    mainImage,
    library,
    tilesAcross,
    tileAspect,
    matchMode,
    allowRotation,
    minDistance,
    maskRegions,
  ]);

  // -------------------------------------------------------------------
  // Render preview canvas
  // -------------------------------------------------------------------
  useEffect(() => {
    const canvas = previewCanvasRef.current;
    if (!canvas || !mainImage) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Preview scale: cap longest side at 800px
    const maxSide = 800;
    const scale = Math.min(1, maxSide / Math.max(mainImage.width, mainImage.height));
    canvas.width = Math.round(mainImage.width * scale);
    canvas.height = Math.round(mainImage.height * scale);

    if (previewMode === "original" || !library || matches.length === 0) {
      ctx.drawImage(mainImage.bitmap, 0, 0, canvas.width, canvas.height);
      // Draw mask regions overlay
      drawMaskOverlay(ctx, maskRegions, scale);
      return;
    }

    // Mosaic or blend
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    if (groutSpacing > 0) {
      applyGrout(ctx, canvas.width, canvas.height, groutSpacing * scale, groutColor);
    }
    // Scale cells to preview
    const scaledCells: Cell[] = cells.map((c) => ({ ...c }));
    void renderMosaicPreview(
      ctx,
      scaledCells,
      matches,
      library,
      { tintStrength, groutSpacing, groutColor, fitMode },
      scale,
    ).then((res) => {
      if (!res.ok) setError(res.error);
      if (previewMode === "blend" && blendPercent > 0) {
        void applyBlend(ctx, mainImage.imageData, blendPercent).then((r) => {
          if (!r.ok) setError(r.error);
        });
      }
      drawMaskOverlay(ctx, maskRegions, scale);
    });
  }, [
    mainImage,
    library,
    matches,
    cells,
    previewMode,
    blendPercent,
    tintStrength,
    groutSpacing,
    groutColor,
    fitMode,
    maskRegions,
  ]);

  // -------------------------------------------------------------------
  // Per-tile click inspection
  // -------------------------------------------------------------------
  const onCanvasClick = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      if (!library || matches.length === 0 || cells.length === 0) return;
      const canvas = previewCanvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * canvas.width;
      const y = ((e.clientY - rect.top) / rect.height) * canvas.height;
      // Find cell at (x, y). cells are in main-image pixel coords; canvas is scaled.
      const scaleX = canvas.width / mainImage!.width;
      const scaleY = canvas.height / mainImage!.height;
      const mx = x / scaleX;
      const my = y / scaleY;
      const idx = cells.findIndex((c) => mx >= c.x && mx < c.x + c.w && my >= c.y && my < c.y + c.h);
      if (idx < 0) return;
      const m = matches[idx];
      if (!m) return;
      const tile = library.tiles.find((t) => t.id === m.tileId);
      if (!tile) return;
      setInspectedTile({
        cellIndex: idx,
        tile,
        score: m.score,
        alternatives: m.alternatives,
      });
    },
    [library, matches, cells, mainImage],
  );

  // -------------------------------------------------------------------
  // Mask region drawing
  // -------------------------------------------------------------------
  const onCanvasMouseDown = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      if (!maskMode || !mainImage) return;
      const canvas = previewCanvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const scaleX = mainImage.width / rect.width;
      const scaleY = mainImage.height / rect.height;
      maskDragRef.current = {
        x0: (e.clientX - rect.left) * scaleX,
        y0: (e.clientY - rect.top) * scaleY,
      };
    },
    [maskMode, mainImage],
  );

  const onCanvasMouseUp = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      if (!maskMode || !mainImage || !maskDragRef.current) return;
      const canvas = previewCanvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const scaleX = mainImage.width / rect.width;
      const scaleY = mainImage.height / rect.height;
      const x1 = (e.clientX - rect.left) * scaleX;
      const y1 = (e.clientY - rect.top) * scaleY;
      const x0 = maskDragRef.current.x0;
      const y0 = maskDragRef.current.y0;
      maskDragRef.current = null;
      const region: Region = {
        x: Math.min(x0, x1),
        y: Math.min(y0, y1),
        w: Math.abs(x1 - x0),
        h: Math.abs(y1 - y0),
      };
      if (region.w < 5 || region.h < 5) return;
      setMaskRegions((prev) => [...prev, region]);
    },
    [maskMode, mainImage],
  );

  // -------------------------------------------------------------------
  // Render full-res
  // -------------------------------------------------------------------
  const renderFullRes = useCallback(async () => {
    if (!mainImage || !library || matches.length === 0) {
      toast.error("Load a main image and tile library first");
      return;
    }
    setBusy(true);
    setError(null);
    setProgress({ done: 0, total: matches.length, label: "Rendering full-resolution…" });
    const startTime = performance.now();
    try {
      const canvas = document.createElement("canvas");
      canvas.width = mainImage.width;
      canvas.height = mainImage.height;
      const ctx = canvas.getContext("2d")!;
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      if (groutSpacing > 0) {
        applyGrout(ctx, canvas.width, canvas.height, groutSpacing, groutColor);
      }
      const res = await renderMosaicFullRes(
        ctx,
        cells,
        matches,
        library,
        { tintStrength, groutSpacing, groutColor, fitMode },
        (done, total) => setProgress({ done, total, label: "Rendering full-resolution…" }),
      );
      if (!res.ok) {
        setError(res.error);
        return;
      }
      if (blendPercent > 0) {
        const blendRes = await applyBlend(ctx, mainImage.imageData, blendPercent);
        if (!blendRes.ok) setError(blendRes.error);
      }
      setFullResCanvas(canvas);
      const elapsed = performance.now() - startTime;
      setStats((s) => (s ? { ...s, etaMs: elapsed } : s));
      toast.success(`Full-res render complete (${Math.round(elapsed)} ms)`);
    } catch (e) {
      setError(`Full-res render failed: ${(e as Error).message}`);
    } finally {
      setBusy(false);
      setProgress(null);
    }
  }, [mainImage, library, matches, cells, groutSpacing, groutColor, tintStrength, fitMode, blendPercent]);

  // -------------------------------------------------------------------
  // Export PNG / JPG
  // -------------------------------------------------------------------
  const exportImage = useCallback(
    async (format: "image/png" | "image/jpeg") => {
      const canvas = fullResCanvas ?? previewCanvasRef.current;
      if (!canvas) {
        toast.error("Render the mosaic first");
        return;
      }
      const blob = await new Promise<Blob | null>((res) =>
        canvas.toBlob((b) => res(b), format, 0.92),
      );
      if (!blob) {
        toast.error("Export failed");
        return;
      }
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `mosaic.${format === "image/png" ? "png" : "jpg"}`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      toast.success(`Exported ${format === "image/png" ? "PNG" : "JPG"}`);
    },
    [fullResCanvas],
  );

  // -------------------------------------------------------------------
  // Export CSV manifest
  // -------------------------------------------------------------------
  const exportManifest = useCallback(() => {
    if (matches.length === 0) {
      toast.error("Build a mosaic first");
      return;
    }
    return exportTileMapManifest(matches, cells, opts);
  }, [matches, cells, opts]);

  // -------------------------------------------------------------------
  // Reveal animation export (MediaRecorder)
  // -------------------------------------------------------------------
  const exportRevealAnimation = useCallback(async () => {
    if (!mainImage || !library || matches.length === 0) {
      toast.error("Build a mosaic first");
      return;
    }
    if (typeof MediaRecorder === "undefined") {
      toast.error("MediaRecorder not supported in this browser");
      return;
    }
    setBusy(true);
    setError(null);
    setProgress({ done: 0, total: matches.length, label: "Recording reveal animation…" });
    try {
      const maxSide = 720;
      const scale = Math.min(1, maxSide / Math.max(mainImage.width, mainImage.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(mainImage.width * scale);
      canvas.height = Math.round(mainImage.height * scale);
      const ctx = canvas.getContext("2d")!;
      ctx.fillStyle = "#1f1f1f";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      const stream = canvas.captureStream(30);
      const mimeType = MediaRecorder.isTypeSupported("video/webm;codecs=vp9")
        ? "video/webm;codecs=vp9"
        : "video/webm";
      const recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 2_500_000 });
      const chunks: Blob[] = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };
      const done = new Promise<Blob>((resolve) => {
        recorder.onstop = () => resolve(new Blob(chunks, { type: "video/webm" }));
      });
      recorder.start();

      const tileMap = new Map(library.tiles.map((t) => [t.id, t]));
      // Draw tiles in row-major order, ~12 per frame for ~2s total
      const batchSize = Math.max(1, Math.ceil(matches.length / 60));
      for (let i = 0; i < matches.length; i += batchSize) {
        const batch = matches.slice(i, i + batchSize);
        for (const m of batch) {
          const cell = cells[m.cellIndex];
          if (!cell) continue;
          const tile = tileMap.get(m.tileId);
          if (!tile) continue;
          const thumb = tile.thumb as ImageBitmap | null;
          if (!thumb) continue;
          const x = cell.x * scale;
          const y = cell.y * scale;
          const w = cell.w * scale;
          const h = cell.h * scale;
          // Flip-in animation: simulate by drawing scaled from 0.2 -> 1.0
          ctx.save();
          ctx.translate(x + w / 2, y + h / 2);
          const t = 0.2 + 0.8 * 1; // simple: just draw at full
          ctx.scale(t, t);
          if (m.rotation) ctx.rotate((m.rotation * Math.PI) / 180);
          ctx.drawImage(thumb, -w / 2, -h / 2, w, h);
          ctx.restore();
        }
        setProgress({ done: Math.min(i + batchSize, matches.length), total: matches.length, label: "Recording reveal animation…" });
        await new Promise((r) => setTimeout(r, 33)); // ~30fps
      }
      // Hold final frame
      await new Promise((r) => setTimeout(r, 500));
      recorder.stop();
      const blob = await done;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "mosaic-reveal.webm";
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      toast.success("Reveal animation exported (WebM)");
    } catch (e) {
      setError(`Reveal animation failed: ${(e as Error).message}`);
    } finally {
      setBusy(false);
      setProgress(null);
    }
  }, [mainImage, library, matches, cells]);

  // -------------------------------------------------------------------
  // Clear all
  // -------------------------------------------------------------------
  const clearAll = useCallback(() => {
    setMainImage(null);
    setLibrary(null);
    setMatches([]);
    setCells([]);
    setStats(null);
    setFullResCanvas(null);
    setMaskRegions([]);
    setError(null);
  }, []);

  // -------------------------------------------------------------------
  // Set tile weight
  // -------------------------------------------------------------------
  const setTileWeight = useCallback(
    (id: string, weight: number) => {
      setTileWeights((prev) => {
        const next = new Map(prev);
        next.set(id, weight);
        return next;
      });
      setLibrary((prev) => {
        if (!prev) return prev;
        const tiles = prev.tiles.map((t) =>
          t.id === id ? { ...t, weight } : t,
        );
        return buildLibraryFromTiles(tiles, prev.source);
      });
    },
    [],
  );

  // -------------------------------------------------------------------
  // Derived: print dimensions
  // -------------------------------------------------------------------
  const printDims = useMemo(() => computePrintDimensions(dpi, paperSize), [dpi, paperSize]);
  const histogram = useMemo(() => tileUsageHistogram(matches), [matches]);

  // -------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------
  return (
    <div className="space-y-4">
      {/* ----- Main image drop zone ----- */}
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center gap-2">
            <ImagePlus className="h-4 w-4" aria-hidden="true" />
            <h3 className="text-sm font-medium">Main image</h3>
            {mainImage && (
              <Badge variant="secondary" className="text-xs">
                {mainImage.width}×{mainImage.height}
              </Badge>
            )}
          </div>
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              const f = e.dataTransfer.files[0];
              if (f) onMainImage(f);
            }}
            className="rounded-lg border-2 border-dashed border-border p-6 text-center"
          >
            <input
              ref={mainImageInputRef}
              type="file"
              aria-label="Choose main image"
              accept="image/*,.heic,.heif"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) onMainImage(f);
              }}
            />
            {mainImage ? (
              <div className="flex items-center justify-center gap-3">
                <img
                  src={URL.createObjectURL(mainImage.bitmap as unknown as Blob)}
                  alt={mainImage.name}
                  className="h-16 w-16 rounded object-cover"
                />
                <div className="text-left">
                  <p className="text-sm font-medium truncate max-w-[200px]">{mainImage.name}</p>
                  <Button variant="outline" size="sm" onClick={() => mainImageInputRef.current?.click()} className="mt-1">
                    Replace
                  </Button>
                </div>
              </div>
            ) : (
              <>
                <p className="text-sm text-muted-foreground mb-2">
                  Drop the main image here (the picture you want to recreate)
                </p>
                <Button variant="outline" size="sm" onClick={() => mainImageInputRef.current?.click()}>
                  Choose image
                </Button>
              </>
            )}
          </div>
        </CardContent>
      </Card>

      {/* ----- Tile library drop zone ----- */}
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2">
              <Images className="h-4 w-4" aria-hidden="true" />
              <h3 className="text-sm font-medium">Tile library</h3>
              {library && (
                <Badge variant="secondary" className="text-xs">
                  {library.tiles.length} tiles · {library.source}
                </Badge>
              )}
            </div>
            <div className="flex gap-2 flex-wrap">
              <Button
                variant="outline"
                size="sm"
                onClick={() => generateStarterTiles(64)}
                disabled={busy}
                className="gap-1.5"
              >
                <Sparkles className="h-3.5 w-3.5" />
                Use starter tiles
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={loadCachedLibrary}
                disabled={busy || cachedCount === 0}
                className="gap-1.5"
              >
                <Database className="h-3.5 w-3.5" />
                Reuse cache{cachedCount > 0 ? ` (${cachedCount})` : ""}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={async () => {
                  await clearCache();
                  setCachedCount(0);
                  toast.success("Cache cleared");
                }}
                disabled={cachedCount === 0}
                className="gap-1.5"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Clear cache
              </Button>
            </div>
          </div>
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              void onTileFiles(e.dataTransfer.files);
            }}
            className="rounded-lg border-2 border-dashed border-border p-6 text-center"
          >
            <input
              ref={tileInputRef}
              type="file"
              aria-label="Choose tile images"
              accept="image/*,.heic,.heif"
              multiple
              className="hidden"
              onChange={(e) => {
                if (e.target.files) void onTileFiles(e.target.files);
              }}
            />
            <p className="text-sm text-muted-foreground mb-2">
              Drop hundreds of tile photos here, or click to browse
            </p>
            <Button variant="outline" size="sm" onClick={() => tileInputRef.current?.click()}>
              Choose tile images
            </Button>
          </div>
          {cachedCount > 0 && !library && (
            <p className="text-xs text-muted-foreground flex items-center gap-1.5">
              <Database className="h-3 w-3" aria-hidden="true" />
              Reusing {cachedCount} tiles from last session is available.
            </p>
          )}
        </CardContent>
      </Card>

      {/* ----- Options panel ----- */}
      <Card>
        <CardContent className="p-4 space-y-4">
          <div className="flex items-center gap-2">
            <Settings2 className="h-4 w-4" aria-hidden="true" />
            <h3 className="text-sm font-medium">Options</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Density */}
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-muted-foreground">
                Density (tiles across): {tilesAcross}
              </Label>
              <Slider
                aria-label="Tiles across"
                value={[tilesAcross]}
                onValueChange={(v) => setTilesAcross(v[0]!)}
                min={4}
                max={128}
                step={1}
              />
            </div>
            {/* Tile aspect */}
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-muted-foreground">
                Tile aspect (w/h): {tileAspect.toFixed(2)}
              </Label>
              <Slider
                aria-label="Tile aspect ratio"
                value={[Math.round(tileAspect * 100)]}
                onValueChange={(v) => setTileAspect((v[0]! / 100))}
                min={50}
                max={200}
                step={5}
              />
            </div>
            {/* Tint strength */}
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-muted-foreground">
                Tint strength: {tintStrength}%
              </Label>
              <Slider
                aria-label="Tint strength"
                value={[tintStrength]}
                onValueChange={(v) => setTintStrength(v[0]!)}
                min={0}
                max={100}
                step={5}
              />
            </div>
            {/* Blend percent */}
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-muted-foreground">
                Blend (mosaic ↔ original): {blendPercent}%
              </Label>
              <Slider
                aria-label="Blend percent"
                value={[blendPercent]}
                onValueChange={(v) => setBlendPercent(v[0]!)}
                min={0}
                max={100}
                step={5}
              />
            </div>
            {/* Grout spacing */}
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-muted-foreground">
                Grout spacing: {groutSpacing}px
              </Label>
              <Slider
                aria-label="Grout spacing"
                value={[groutSpacing]}
                onValueChange={(v) => setGroutSpacing(v[0]!)}
                min={0}
                max={20}
                step={1}
              />
            </div>
            {/* Grout color */}
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-muted-foreground" htmlFor="grout-color">
                Grout color
              </Label>
              <Input
                id="grout-color"
                type="color"
                aria-label="Grout color"
                value={`#${[groutColor.r, groutColor.g, groutColor.b]
                  .map((c) => c.toString(16).padStart(2, "0"))
                  .join("")}`}
                onChange={(e) => {
                  const hex = e.target.value;
                  setGroutColor({
                    r: parseInt(hex.slice(1, 3), 16),
                    g: parseInt(hex.slice(3, 5), 16),
                    b: parseInt(hex.slice(5, 7), 16),
                  });
                }}
                className="h-9 p-1"
              />
            </div>
            {/* Min distance */}
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-muted-foreground">
                Min repeat distance: {minDistance}
              </Label>
              <Slider
                aria-label="Minimum repeat distance"
                value={[minDistance]}
                onValueChange={(v) => setMinDistance(v[0]!)}
                min={0}
                max={10}
                step={1}
              />
            </div>
            {/* Match mode */}
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-muted-foreground">Match mode</Label>
              <Select value={matchMode} onValueChange={(v) => setMatchMode(v as MatchMode)}>
                <SelectTrigger aria-label="Match mode">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="rgb">Average RGB (fast)</SelectItem>
                  <SelectItem value="lab">Perceptual Lab (recommended)</SelectItem>
                  <SelectItem value="edge">Edge-aware</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {/* Fit mode */}
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-muted-foreground">Tile fit</Label>
              <Select value={fitMode} onValueChange={(v) => setFitMode(v as "crop" | "letterbox")}>
                <SelectTrigger aria-label="Tile fit mode">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="crop">Crop to fill</SelectItem>
                  <SelectItem value="letterbox">Letterbox</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {/* Allow rotation */}
            <div className="flex items-center gap-2">
              <Switch
                checked={allowRotation}
                onCheckedChange={setAllowRotation}
                id="allow-rotation"
              />
              <Label htmlFor="allow-rotation" className="text-sm cursor-pointer">
                Allow tile rotation
              </Label>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ----- Progress bar ----- */}
      {progress && (
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-muted-foreground">{progress.label}</span>
              <span className="text-xs text-muted-foreground">
                {progress.done}/{progress.total}
              </span>
            </div>
            <div
              role="progressbar"
              aria-valuenow={progress.done}
              aria-valuemax={progress.total}
              aria-valuemin={0}
              className="h-2 w-full rounded-full bg-muted overflow-hidden"
            >
              <div
                className="h-full bg-primary transition-all"
                style={{ width: `${(progress.done / progress.total) * 100}%` }}
              />
            </div>
          </CardContent>
        </Card>
      )}

      {/* ----- Preview + comparison ----- */}
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2">
              <Eye className="h-4 w-4" aria-hidden="true" />
              <h3 className="text-sm font-medium">Preview</h3>
            </div>
            <div className="flex gap-1" role="radiogroup" aria-label="Preview mode">
              {(["original", "mosaic", "blend"] as PreviewMode[]).map((m) => (
                <Button
                  key={m}
                  variant={previewMode === m ? "default" : "outline"}
                  size="sm"
                  role="radio"
                  aria-checked={previewMode === m}
                  onClick={() => setPreviewMode(m)}
                >
                  {m === "original" ? "Original" : m === "mosaic" ? "Mosaic" : "Blend"}
                </Button>
              ))}
            </div>
          </div>
          <div className="rounded-lg border bg-muted/30 overflow-hidden flex items-center justify-center min-h-[200px]">
            {mainImage ? (
              <canvas
                ref={previewCanvasRef}
                onClick={onCanvasClick}
                onMouseDown={onCanvasMouseDown}
                onMouseUp={onCanvasMouseUp}
                className="max-w-full h-auto cursor-crosshair"
                style={{
                  cursor: maskMode ? "crosshair" : library && matches.length > 0 ? "pointer" : "default",
                }}
                aria-label="Mosaic preview canvas. Click a tile to inspect; in mask mode, drag to mark important regions."
              />
            ) : (
              <p className="text-sm text-muted-foreground p-8">
                Load a main image to see the preview.
              </p>
            )}
          </div>
          <div className="flex gap-2 flex-wrap">
            <Button onClick={renderFullRes} disabled={busy || !library || matches.length === 0} className="gap-1.5">
              <Layers className="h-3.5 w-3.5" />
              Render full-res
            </Button>
            <Button
              variant={maskMode ? "default" : "outline"}
              size="sm"
              onClick={() => setMaskMode((m) => !m)}
              className="gap-1.5"
            >
              <Highlighter className="h-3.5 w-3.5" />
              {maskMode ? "Drawing mask…" : "Mask regions"}
            </Button>
            {maskRegions.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setMaskRegions([])}
                className="gap-1.5"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Clear masks ({maskRegions.length})
              </Button>
            )}
          </div>
          {maskMode && (
            <p className="text-xs text-muted-foreground">
              Click and drag on the preview to mark important regions. Best-matching tiles will be used there.
            </p>
          )}
        </CardContent>
      </Card>

      {/* ----- Stats dashboard ----- */}
      {stats && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4" aria-hidden="true" />
              <h3 className="text-sm font-medium">Render stats</h3>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
              <Stat label="Total cells" value={stats.totalCells.toLocaleString()} />
              <Stat label="Unique tiles" value={stats.uniqueTiles.toLocaleString()} />
              <Stat
                label="Repetition ratio"
                value={`${(stats.repetitionRatio * 100).toFixed(1)}%`}
              />
              <Stat
                label="Avg match score"
                value={stats.averageScore.toFixed(2)}
              />
              <Stat
                label="Most used"
                value={stats.mostUsedTileId ? `${stats.mostUsedTileId} ×${stats.mostUsedCount}` : "—"}
              />
              <Stat
                label="Least used"
                value={stats.leastUsedTileId ? `${stats.leastUsedTileId} ×${stats.leastUsedCount}` : "—"}
              />
              <Stat
                label="Render time"
                value={stats.etaMs > 0 ? `${(stats.etaMs / 1000).toFixed(2)}s` : "—"}
              />
              <Stat
                label="Library source"
                value={library?.source ?? "—"}
              />
            </div>
          </CardContent>
        </Card>
      )}

      {/* ----- Tile-usage histogram ----- */}
      {histogram.size > 0 && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4" aria-hidden="true" />
              <h3 className="text-sm font-medium">Tile-usage histogram</h3>
              <Badge variant="secondary" className="text-xs">
                {histogram.size} unique tiles
              </Badge>
            </div>
            <HistogramView histogram={histogram} library={library} />
          </CardContent>
        </Card>
      )}

      {/* ----- Custom tile weighting ----- */}
      {library && library.tiles.length > 0 && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Settings2 className="h-4 w-4" aria-hidden="true" />
              <h3 className="text-sm font-medium">Custom tile weighting</h3>
            </div>
            <p className="text-xs text-muted-foreground">
              Higher weight = appears more often. Default is 1.
            </p>
            <TileWeightPanel library={library} onWeight={setTileWeight} />
          </CardContent>
        </Card>
      )}

      {/* ----- Print-resolution calculator ----- */}
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center gap-2">
            <Info className="h-4 w-4" aria-hidden="true" />
            <h3 className="text-sm font-medium">Print-resolution calculator</h3>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 items-end">
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-muted-foreground">Paper size</Label>
              <Select value={paperSize} onValueChange={(v) => setPaperSize(v as PaperSize)}>
                <SelectTrigger aria-label="Paper size">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="A4">A4 (210×297mm)</SelectItem>
                  <SelectItem value="A3">A3 (297×420mm)</SelectItem>
                  <SelectItem value="Letter">Letter (8.5×11in)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-muted-foreground">DPI</Label>
              <Select value={String(dpi)} onValueChange={(v) => setDpi(Number(v))}>
                <SelectTrigger aria-label="DPI">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="72">72 (screen)</SelectItem>
                  <SelectItem value="150">150 (draft print)</SelectItem>
                  <SelectItem value="300">300 (standard print)</SelectItem>
                  <SelectItem value="600">600 (fine art)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Stat label="Pixel dimensions" value={`${printDims.widthPx}×${printDims.heightPx}`} />
            <Stat
              label="Megapixels"
              value={`${((printDims.widthPx * printDims.heightPx) / 1_000_000).toFixed(1)} MP`}
            />
          </div>
        </CardContent>
      </Card>

      {/* ----- Export buttons ----- */}
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center gap-2">
            <Download className="h-4 w-4" aria-hidden="true" />
            <h3 className="text-sm font-medium">Export</h3>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => exportImage("image/png")} disabled={!library || matches.length === 0} className="gap-1.5">
              <Download className="h-3.5 w-3.5" />
              PNG (lossless)
            </Button>
            <Button onClick={() => exportImage("image/jpeg")} disabled={!library || matches.length === 0} variant="outline" className="gap-1.5">
              <Download className="h-3.5 w-3.5" />
              JPG (smaller)
            </Button>
            <DownloadButton
              getText={() => exportManifest() ?? ""}
              filename="mosaic-tilemap.csv"
              label="CSV manifest"
              mime="text/csv"
              disabled={matches.length === 0}
            />
            <Button
              onClick={exportRevealAnimation}
              disabled={!library || matches.length === 0 || busy}
              variant="outline"
              className="gap-1.5"
            >
              <Film className="h-3.5 w-3.5" />
              Reveal animation (WebM)
            </Button>
          </div>
        </CardContent>
      </Card>

      {error && <ErrorBanner message={error} />}

      {/* ----- Privacy ----- */}
      <Card>
        <CardContent className="p-4">
          <p className="text-xs text-muted-foreground flex items-start gap-2">
            <Info className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" aria-hidden="true" />
            <span>
              <strong className="text-foreground">Privacy:</strong> all tile indexing, color matching, and rendering run locally in your browser via Web Workers, Canvas, and IndexedDB. Your main image and tile photos never leave your device. HEIC files are decoded locally via heic2any, lazy-loaded only when needed.
            </span>
          </p>
        </CardContent>
      </Card>

      {/* ----- Per-tile inspection modal ----- */}
      <Dialog open={!!inspectedTile} onOpenChange={(o) => !o && setInspectedTile(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Tile inspection</DialogTitle>
            <DialogDescription>
              Cell #{inspectedTile?.cellIndex} — matched tile details
            </DialogDescription>
          </DialogHeader>
          {inspectedTile && (
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <TileThumb tile={inspectedTile.tile} size={96} />
                <div className="text-sm space-y-1">
                  <p className="font-medium truncate">{inspectedTile.tile.filename ?? inspectedTile.tile.id}</p>
                  <p className="text-xs text-muted-foreground">
                    ID: <code className="text-xs">{inspectedTile.tile.id}</code>
                  </p>
                  <p className="text-xs">
                    Match score: <span className="font-mono">{inspectedTile.score.toFixed(3)}</span>
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Avg color: RGB({inspectedTile.tile.avgColor.r}, {inspectedTile.tile.avgColor.g}, {inspectedTile.tile.avgColor.b})
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Weight: {inspectedTile.tile.weight}× · Edge: {inspectedTile.tile.edgeScore.toFixed(1)}
                  </p>
                </div>
              </div>
              {inspectedTile.alternatives.length > 0 && (
                <div>
                  <p className="text-xs text-muted-foreground mb-1.5">Alternatives:</p>
                  <div className="flex gap-2 flex-wrap">
                    {inspectedTile.alternatives.map((id) => {
                      const alt = library?.tiles.find((t) => t.id === id);
                      if (!alt) return null;
                      return (
                        <div key={id} className="flex flex-col items-center gap-1">
                          <TileThumb tile={alt} size={48} />
                          <span className="text-[10px] text-muted-foreground truncate max-w-[60px]">
                            {id}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ----- Clear all ----- */}
      <div className="flex justify-end">
        <Button variant="ghost" size="sm" onClick={clearAll} className="gap-1.5">
          <Trash2 className="h-3.5 w-3.5" />
          Clear all
        </Button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Small sub-components
// ---------------------------------------------------------------------------

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border p-2">
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="text-sm font-mono mt-0.5 truncate">{value}</p>
    </div>
  );
}

function TileThumb({ tile, size = 48 }: { tile: TileData; size?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    c.width = size;
    c.height = size;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    const thumb = tile.thumb as ImageBitmap | null;
    if (thumb) {
      ctx.drawImage(thumb, 0, 0, size, size);
    } else {
      ctx.fillStyle = `rgb(${tile.avgColor.r},${tile.avgColor.g},${tile.avgColor.b})`;
      ctx.fillRect(0, 0, size, size);
    }
  }, [tile, size]);
  return (
    <canvas
      ref={ref}
      className="rounded border"
      style={{ width: size, height: size }}
      aria-label={`Tile ${tile.id} thumbnail`}
    />
  );
}

function HistogramView({
  histogram,
  library,
}: {
  histogram: Map<string, number>;
  library: TileLibrary | null;
}) {
  const entries = useMemo(() => Array.from(histogram.entries()), [histogram]);
  const max = entries.length > 0 ? entries[0]![1] : 1;
  return (
    <div className="space-y-1 max-h-48 overflow-y-auto">
      {entries.slice(0, 50).map(([id, count]) => {
        const tile = library?.tiles.find((t) => t.id === id);
        return (
          <div key={id} className="flex items-center gap-2 text-xs">
            <span className="w-32 truncate font-mono text-muted-foreground">{id}</span>
            <div className="flex-1 h-4 rounded bg-muted overflow-hidden">
              <div
                className="h-full bg-primary"
                style={{ width: `${(count / max) * 100}%` }}
              />
            </div>
            <span className="w-8 text-right font-mono">{count}</span>
            {tile && (
              <div
                className="w-4 h-4 rounded border flex-shrink-0"
                style={{
                  backgroundColor: `rgb(${tile.avgColor.r},${tile.avgColor.g},${tile.avgColor.b})`,
                }}
                aria-hidden="true"
              />
            )}
          </div>
        );
      })}
      {entries.length > 50 && (
        <p className="text-xs text-muted-foreground">
          …and {entries.length - 50} more
        </p>
      )}
    </div>
  );
}

function TileWeightPanel({
  library,
  onWeight,
}: {
  library: TileLibrary;
  onWeight: (id: string, weight: number) => void;
}) {
  const [page, setPage] = useState(0);
  const pageSize = 24;
  const start = page * pageSize;
  const slice = library.tiles.slice(start, start + pageSize);
  const totalPages = Math.ceil(library.tiles.length / pageSize);
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        {slice.map((tile) => (
          <div key={tile.id} className="flex items-center gap-2 rounded border p-2">
            <TileThumb tile={tile} size={32} />
            <div className="flex-1 min-w-0">
              <p className="text-[10px] truncate text-muted-foreground">{tile.id}</p>
              <select
                aria-label={`Weight for ${tile.id}`}
                value={tile.weight}
                onChange={(e) => onWeight(tile.id, Number(e.target.value))}
                className="w-full text-xs rounded border bg-background px-1 py-0.5"
              >
                <option value={0.5}>0.5×</option>
                <option value={1}>1× (default)</option>
                <option value={2}>2×</option>
                <option value={3}>3×</option>
                <option value={5}>5×</option>
              </select>
            </div>
          </div>
        ))}
      </div>
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            disabled={page === 0}
          >
            Prev
          </Button>
          <span className="text-xs text-muted-foreground">
            Page {page + 1} of {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
            disabled={page >= totalPages - 1}
          >
            Next
          </Button>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function drawMaskOverlay(
  ctx: CanvasRenderingContext2D,
  regions: Region[],
  scale: number,
) {
  if (regions.length === 0) return;
  ctx.save();
  ctx.strokeStyle = "rgba(255, 200, 0, 0.9)";
  ctx.fillStyle = "rgba(255, 200, 0, 0.2)";
  ctx.lineWidth = 2;
  for (const r of regions) {
    ctx.fillRect(r.x * scale, r.y * scale, r.w * scale, r.h * scale);
    ctx.strokeRect(r.x * scale, r.y * scale, r.w * scale, r.h * scale);
  }
  ctx.restore();
}
