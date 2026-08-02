"use client";

/* ============================================================
   PIXEL ART MAKER — UI PART 1 of 4
   Imports, component state, autosave load/save effects, active
   layer/frame accessors, display + preview rendering, animation
   playback, and history helpers (commit/undo/redo) wired to the
   new diff-based HistoryState from the rebuilt engine.

   Assembly: concatenate PART-1 + PART-2 + PART-3 + PART-4, in
   that order, into the single real `ui.tsx`. Only this part
   carries the imports; later parts rely on shared module scope.
   ============================================================ */

import React, { useState, useCallback, useRef, useEffect, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { ErrorBanner } from "../../_shared";
import { toast } from "sonner";
import {
  Pencil,
  Eraser,
  PaintBucket,
  Paintbrush,
  Pipette,
  Square,
  Circle,
  Minus,
  Hand,
  Layers as LayersIcon,
  Palette as PaletteIcon,
  Plus,
  Trash2,
  Copy,
  ChevronUp,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Undo2,
  Redo2,
  Download,
  Upload,
  Play,
  Pause,
  Grid3x3,
  FlipHorizontal2,
  FlipVertical2,
  Settings2,
  Keyboard,
  Search as SearchIcon,
  Lock,
  Unlock,
  Eye,
  EyeOff,
  Sparkles,
  FlipHorizontal,
  FlipVertical,
  Move,
  Grid2x2,
  Stamp,
  Droplets,
  ArrowDownUp,
  Image as ImageIcon,
  FileJson,
  FileType2,
  Save,
  FolderOpen,
  X as XIcon,
  RotateCw,
  Crop,
  Wand2,
  Blend,
  CircleDot,
} from "lucide-react";
import palettesData from "./palettes.json";
import {
  createCanvas,
  cloneCanvas,
  addLayer,
  removeLayer,
  duplicateLayer,
  mergeLayerDown,
  flattenImage,
  reorderLayers,
  setLayerOpacity,
  setLayerVisible,
  setLayerLocked,
  renameLayer,
  addFrame,
  removeFrame,
  duplicateFrameAt,
  reverseFrames,
  setAllFrameDelays,
  reorderFrames,
  setFrameDelay,
  getPixel,
  getCompositePixel,
  setPixelInPlace,
  compositeFrameRgba,
  drawLine,
  drawRect,
  drawEllipse,
  floodFill,
  floodFillGlobal,
  applyMirrorX,
  applyMirrorY,
  applyPixelPerfect,
  bresenhamLine,
  selectRect,
  invertSelection,
  fillSelection,
  deleteSelectionPixels,
  copySelectionPixels,
  pasteSelectionPixels,
  moveSelectionPixels,
  type SelectionClip,
  PALETTE_TAGS,
  tagPaletteColor,
  untagPaletteColor,
  parseGplPalette,
  parsePalPalette,
  parseHexPalette,
  paletteSwap,
  beginPaletteSwap,
  commitPaletteSwap,
  cancelPaletteSwap,
  type PaletteSwapSession,
  applyTaggedMask,
  importSpriteSheet,
  exportAsepriteJson,
  serializeProject,
  deserializeProject,
  createHistory,
  pushHistory,
  undo as undoHistory,
  redo as redoHistory,
  type HistoryState,
  resizeCanvas,
  cropCanvas,
  flipCanvasHorizontal,
  flipCanvasVertical,
  rotateCanvas90,
  captureTile,
  transformTile,
  stampTile,
  ditherAt,
  type DitherPattern,
  patternBrush,
  gradientBrush,
  createSeededRandom,
  scatterBrush,
  colorReplaceBrush,
  hexToRgba,
  rgbaToHex,
  shadeColor,
  colorHarmony,
  autosaveProject,
  loadAutosave,
  clearAutosave,
  exportPng,
  exportGif,
  exportApng,
  exportSpriteSheet,
  exportSheetBundle,
  ExportCancelledError,
  type ExportOptions,
  type PixelCanvas,
  type Palette,
  type Tool,
  type Point,
  type Selection,
  type TileVariant,
  type ProjectFile,
  CANVAS_MAX_DIM,
} from "./logic";

const BUNDLED_PALETTES = palettesData as Palette[];

const RECENT_COLORS_MAX = 20;
const AUTOSAVE_DEBOUNCE_MS = 5000;
const HISTORY_MAX_ENTRIES = 50;

type ExportFormat = "png" | "gif" | "apng" | "sheet" | "bundle" | "project";

interface OnionSkinSettings {
  enabled: boolean;
  prevColor: string;
  nextColor: string;
  opacity: number;
  framesBack: number;
}

const DEFAULT_ONION: OnionSkinSettings = {
  enabled: false,
  prevColor: "#ff5555",
  nextColor: "#55ff55",
  opacity: 0.4,
  framesBack: 1,
};

// ===========================================================================
// Helper: trigger a browser download for bytes/Blob
// ===========================================================================
function downloadBytes(bytes: Uint8Array, filename: string, mimeType: string) {
  const blob = new Blob([bytes], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// ===========================================================================
// Main component
// ===========================================================================
export default function PixelArtMaker() {
  // ---- Project state ------------------------------------------------------
  const [canvas, setCanvas] = useState<PixelCanvas>(() => createCanvas(16, 16, BUNDLED_PALETTES[0]));
  const [history, setHistory] = useState<HistoryState>(() => createHistory(canvas, HISTORY_MAX_ENTRIES));
  const [loaded, setLoaded] = useState(false);

  // ---- Tool / brush state -------------------------------------------------
  const [tool, setTool] = useState<Tool>("pencil");
  const [brushSize, setBrushSize] = useState(1);
  const [mirrorX, setMirrorX] = useState(false);
  const [mirrorY, setMirrorY] = useState(false);
  const [showGrid, setShowGrid] = useState(true);
  const [pixelPerfect, setPixelPerfect] = useState(true);
  const [color, setColor] = useState("#000000");
  const [secondaryColor, setSecondaryColor] = useState("#ffffff");
  const [recentColors, setRecentColors] = useState<string[]>([]);

  // ---- Dither pattern selector (defect #5 fix: no longer hardcoded) -------
  const [ditherPattern, setDitherPattern] = useState<DitherPattern>("bayer2");
  const [ditherThreshold, setDitherThreshold] = useState(0.5);

  // ---- Scatter brush settings (feature: new brush) -------------------------
  const [scatterRadius, setScatterRadius] = useState(4);
  const [scatterDensity, setScatterDensity] = useState(0.3);
  const scatterSeedRef = useRef(1);

  // ---- Color-replace brush tolerance ---------------------------------------
  const [colorReplaceTolerance, setColorReplaceTolerance] = useState(600);

  // ---- View state ---------------------------------------------------------
  const [zoom, setZoom] = useState(16);
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const panStartRef = useRef<{ x: number; y: number; px: number; py: number } | null>(null);

  // ---- Drawing state ------------------------------------------------------
  const [isDrawing, setIsDrawing] = useState(false);
  const drawingStrokeRef = useRef<Point[]>([]);
  const drawingPreviewRef = useRef<{ type: "line" | "rect" | "ellipse"; start: Point; end: Point; filled: boolean } | null>(null);
  const lastDrawnPointRef = useRef<Point | null>(null);
  const [selection, setSelection] = useState<Selection | null>(null);
  const selectStartRef = useRef<Point | null>(null);
  const [selectionClip, setSelectionClip] = useState<SelectionClip | null>(null);

  // ---- Onion skin ---------------------------------------------------------
  const [onionSkin, setOnionSkin] = useState<OnionSkinSettings>(DEFAULT_ONION);

  // ---- Playback -----------------------------------------------------------
  const [playing, setPlaying] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1);
  const playTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ---- Tile-flip brush (defect #1 fix: real multi-pixel tile capture) -----
  const [tileVariant, setTileVariant] = useState<TileVariant>(0);

  // ---- UI panels ----------------------------------------------------------
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [showOnionPanel, setShowOnionPanel] = useState(false);
  const [showNewCanvas, setShowNewCanvas] = useState(false);
  const [showCanvasOps, setShowCanvasOps] = useState(false);
  const [newWidth, setNewWidth] = useState(16);
  const [newHeight, setNewHeight] = useState(16);
  const [resizeWidth, setResizeWidth] = useState(16);
  const [resizeHeight, setResizeHeight] = useState(16);
  const [activePaletteIdx, setActivePaletteIdx] = useState(0);

  // ---- Palette swap session (defect #4 fix: real cancel via snapshot) -----
  const [swapSession, setSwapSession] = useState<PaletteSwapSession | null>(null);

  // ---- Import -------------------------------------------------------------
  const [importSheetOpen, setImportSheetOpen] = useState(false);
  const [importFrameW, setImportFrameW] = useState(16);
  const [importFrameH, setImportFrameH] = useState(16);
  const importFileRef = useRef<HTMLInputElement>(null);
  const paletteFileRef = useRef<HTMLInputElement>(null);

  // ---- Export (defect #15 fix: progress + cancel) --------------------------
  const [exportBusy, setExportBusy] = useState<ExportFormat | null>(null);
  const [exportProgress, setExportProgress] = useState(0);
  const [exportScale, setExportScale] = useState(8);
  const exportAbortRef = useRef<AbortController | null>(null);

  // ---- Error --------------------------------------------------------------
  const [error, setError] = useState<string | null>(null);

  // ---- Refs ---------------------------------------------------------------
  const displayCanvasRef = useRef<HTMLCanvasElement>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const previewCanvasRef = useRef<HTMLCanvasElement>(null);

  // =========================================================================
  // Load autosave on mount (never applied without being loaded explicitly
  // here at startup — D10: drafts/history never silently override later edits)
  // =========================================================================
  useEffect(() => {
    let mounted = true;
    (async () => {
      const saved = await loadAutosave();
      if (saved && mounted) {
        setCanvas(saved);
        setHistory(createHistory(saved, HISTORY_MAX_ENTRIES));
        toast.info("Restored last project from autosave");
      }
      setLoaded(true);
    })();
    return () => {
      mounted = false;
    };
  }, []);

  // =========================================================================
  // Debounced autosave whenever canvas changes
  // =========================================================================
  useEffect(() => {
    if (!loaded) return;
    const id = setTimeout(() => {
      void autosaveProject(canvas);
    }, AUTOSAVE_DEBOUNCE_MS);
    return () => clearTimeout(id);
  }, [canvas, loaded]);

  // =========================================================================
  // Active layer / frame accessors
  // =========================================================================
  const activeLayer = useMemo(
    () => canvas.layers.find((l) => l.id === canvas.activeLayerId) ?? canvas.layers[0]!,
    [canvas],
  );
  const activeFrame = useMemo(
    () => canvas.frames.find((f) => f.id === canvas.activeFrameId) ?? canvas.frames[0]!,
    [canvas],
  );

  // =========================================================================
  // Render the active frame (composite of all visible layers + onion skin)
  // =========================================================================
  const renderDisplay = useCallback(() => {
    const display = displayCanvasRef.current;
    if (!display) return;
    const ctx = display.getContext("2d");
    if (!ctx) return;
    const dpr = typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;
    const displayW = canvas.width * zoom;
    const displayH = canvas.height * zoom;
    if (display.width !== displayW * dpr || display.height !== displayH * dpr) {
      display.width = displayW * dpr;
      display.height = displayH * dpr;
      display.style.width = `${displayW}px`;
      display.style.height = `${displayH}px`;
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.imageSmoothingEnabled = false;
    drawCheckerboard(ctx, displayW, displayH, Math.max(8, zoom));
    if (onionSkin.enabled) {
      const frameIdx = canvas.frames.findIndex((f) => f.id === canvas.activeFrameId);
      if (frameIdx >= 0) {
        for (let i = 1; i <= onionSkin.framesBack; i++) {
          const prev = canvas.frames[frameIdx - i];
          if (!prev) break;
          const rgba = compositeFrameRgba(canvas, prev.id);
          drawTinted(ctx, rgba, canvas.width, canvas.height, zoom, onionSkin.prevColor, onionSkin.opacity / i);
        }
        for (let i = 1; i <= onionSkin.framesBack; i++) {
          const next = canvas.frames[frameIdx + i];
          if (!next) break;
          const rgba = compositeFrameRgba(canvas, next.id);
          drawTinted(ctx, rgba, canvas.width, canvas.height, zoom, onionSkin.nextColor, onionSkin.opacity / i);
        }
      }
    }
    const rgba = compositeFrameRgba(canvas, canvas.activeFrameId);
    const src = document.createElement("canvas");
    src.width = canvas.width;
    src.height = canvas.height;
    const sctx = src.getContext("2d");
    if (sctx) {
      sctx.putImageData(new ImageData(new Uint8ClampedArray(rgba), canvas.width, canvas.height), 0, 0);
      ctx.drawImage(src, 0, 0, displayW, displayH);
    }
    if (selection) {
      const sx = Math.min(selection.x0, selection.x1);
      const sy = Math.min(selection.y0, selection.y1);
      const sw = Math.abs(selection.x1 - selection.x0) + 1;
      const sh = Math.abs(selection.y1 - selection.y0) + 1;
      ctx.strokeStyle = "#fff";
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 4]);
      ctx.strokeRect(sx * zoom + 0.5, sy * zoom + 0.5, sw * zoom - 1, sh * zoom - 1);
      ctx.setLineDash([]);
    }
    if (showGrid && zoom >= 4) {
      ctx.strokeStyle = "rgba(128,128,128,0.35)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let x = 0; x <= canvas.width; x++) {
        ctx.moveTo(x * zoom + 0.5, 0);
        ctx.lineTo(x * zoom + 0.5, displayH);
      }
      for (let y = 0; y <= canvas.height; y++) {
        ctx.moveTo(0, y * zoom + 0.5);
        ctx.lineTo(displayW, y * zoom + 0.5);
      }
      ctx.stroke();
    }
  }, [canvas, zoom, showGrid, onionSkin, selection]);

  useEffect(() => {
    renderDisplay();
  }, [renderDisplay]);

  // =========================================================================
  // Animation preview rendering
  // =========================================================================
  const renderPreview = useCallback(() => {
    const preview = previewCanvasRef.current;
    if (!preview) return;
    const ctx = preview.getContext("2d");
    if (!ctx) return;
    const size = Math.min(96, canvas.width * 4);
    const scale = Math.max(1, Math.floor(size / canvas.width));
    const w = canvas.width * scale;
    const h = canvas.height * scale;
    preview.width = w;
    preview.height = h;
    ctx.imageSmoothingEnabled = false;
    drawCheckerboard(ctx, w, h, Math.max(4, scale));
    const rgba = compositeFrameRgba(canvas, canvas.activeFrameId);
    const src = document.createElement("canvas");
    src.width = canvas.width;
    src.height = canvas.height;
    const sctx = src.getContext("2d");
    if (sctx) {
      sctx.putImageData(new ImageData(new Uint8ClampedArray(rgba), canvas.width, canvas.height), 0, 0);
      ctx.drawImage(src, 0, 0, w, h);
    }
  }, [canvas]);

  useEffect(() => {
    renderPreview();
  }, [renderPreview]);

  // =========================================================================
  // Animation playback
  // =========================================================================
  useEffect(() => {
    if (!playing) {
      if (playTimerRef.current) {
        clearTimeout(playTimerRef.current);
        playTimerRef.current = null;
      }
      return;
    }
    const tick = () => {
      setCanvas((cur) => {
        const idx = cur.frames.findIndex((f) => f.id === cur.activeFrameId);
        const nextIdx = (idx + 1) % cur.frames.length;
        return { ...cur, activeFrameId: cur.frames[nextIdx]!.id };
      });
      const delay = activeFrame.delay / playbackSpeed;
      playTimerRef.current = setTimeout(tick, delay);
    };
    playTimerRef.current = setTimeout(tick, activeFrame.delay / playbackSpeed);
    return () => {
      if (playTimerRef.current) clearTimeout(playTimerRef.current);
    };
  }, [playing, activeFrame, playbackSpeed]);

  // =========================================================================
  // History helpers — wired to the diff-based HistoryState (defects #13/#14
  // fix). `commit` captures the canvas value from closure as the "before"
  // state, matching how every call site already has it in scope.
  // =========================================================================
  const commit = useCallback(
    (next: PixelCanvas) => {
      setHistory((h) => pushHistory(h, canvas, next));
      setCanvas(next);
    },
    [canvas],
  );

  const handleUndo = useCallback(() => {
    const result = undoHistory(history);
    if (result) {
      setCanvas(result.canvas);
      setHistory(result.history);
    }
  }, [history]);

  const handleRedo = useCallback(() => {
    const result = redoHistory(history);
    if (result) {
      setCanvas(result.canvas);
      setHistory(result.history);
    }
  }, [history]);

  const canUndo = history.index > 0;
  const canRedo = history.index < history.entries.length;

  // =========================================================================
  // Color helpers
  // =========================================================================
  const addRecentColor = useCallback((hex: string) => {
    setRecentColors((prev) => {
      const filtered = prev.filter((c) => c.toLowerCase() !== hex.toLowerCase());
      return [hex, ...filtered].slice(0, RECENT_COLORS_MAX);
    });
  }, []);

  // =========================================================================
  // Pointer coordinate helper
  // =========================================================================
  const canvasCoordsFromEvent = useCallback(
    (e: React.PointerEvent): Point => {
      const display = displayCanvasRef.current!;
      const rect = display.getBoundingClientRect();
      const x = Math.floor((e.clientX - rect.left) / zoom);
      const y = Math.floor((e.clientY - rect.top) / zoom);
      return { x, y };
    },
    [zoom],
  );

/* === END OF UI PART 1 (component body continues in PART 2) === */

  const tileClipboardRef = useRef<{ width: number; height: number; pixels: Array<[number, number, number, number]> } | null>(null);

  const paintPoint = useCallback(
    (p: Point) => {
      const [r, g, b] = hexToRgba(tool === "eraser" ? "#000000" : color);
      const a = tool === "eraser" ? 0 : 255;
      const points = getSymmetryPoints(canvas, {
        size: brushSize,
        mirrorX,
        mirrorY,
        radialSymmetry: 1,
        pixelPerfect,
        ditherPattern,
        ditherThreshold,
        stampShape: "square",
      }, p.x, p.y);
      const offset = Math.floor((brushSize - 1) / 2);
      for (const pt of points) {
        for (let dy = 0; dy < brushSize; dy++) {
          for (let dx = 0; dx < brushSize; dx++) {
            setPixelInPlace(canvas, activeLayer.id, canvas.activeFrameId, pt.x - offset + dx, pt.y - offset + dy, [r, g, b, a]);
          }
        }
      }
    },
    [canvas, tool, color, brushSize, mirrorX, mirrorY, pixelPerfect, ditherPattern, ditherThreshold, activeLayer],
  );

  const paintStroke = useCallback(
    (from: Point, to: Point) => {
      const [r, g, b] = hexToRgba(color);
      const a = tool === "eraser" ? 0 : 255;
      const linePoints = bresenhamLine(from.x, from.y, to.x, to.y);
      const offset = Math.floor((brushSize - 1) / 2);
      for (const lp of linePoints) {
        const symPoints = getSymmetryPoints(canvas, {
          size: brushSize,
          mirrorX,
          mirrorY,
          radialSymmetry: 1,
          pixelPerfect,
          ditherPattern,
          ditherThreshold,
          stampShape: "square",
        }, lp.x, lp.y);
        for (const pt of symPoints) {
          for (let dy = 0; dy < brushSize; dy++) {
            for (let dx = 0; dx < brushSize; dx++) {
              setPixelInPlace(canvas, activeLayer.id, canvas.activeFrameId, pt.x - offset + dx, pt.y - offset + dy, [r, g, b, a]);
            }
          }
        }
      }
    },
    [canvas, tool, color, brushSize, mirrorX, mirrorY, pixelPerfect, ditherPattern, ditherThreshold, activeLayer],
  );

  const onPointerDownCanvas = useCallback(
    (e: React.PointerEvent) => {
      if (e.pointerType === "touch" && e.pressure === 0 && e.buttons === 0) return;
      e.preventDefault();
      (e.target as HTMLElement).setPointerCapture(e.pointerId);

      // Eyedropper: sample the visible composite, not just the active layer
      // (defect #9 fix).
      if (tool === "eyedropper") {
        const p = canvasCoordsFromEvent(e);
        const [r, g, b, a] = getCompositePixel(canvas, canvas.activeFrameId, p.x, p.y);
        if (a > 0) {
          const hex = rgbaToHex(r, g, b);
          setColor(hex);
          addRecentColor(hex);
          toast.success(`Picked ${hex}`);
        }
        return;
      }

      if (tool === "move" || e.button === 1 || e.shiftKey) {
        setIsPanning(true);
        panStartRef.current = { x: e.clientX, y: e.clientY, px: pan.x, py: pan.y };
        return;
      }

      if (tool === "select-rect") {
        const p = canvasCoordsFromEvent(e);
        selectStartRef.current = p;
        setSelection(selectRect(p.x, p.y, p.x, p.y));
        return;
      }

      const p = canvasCoordsFromEvent(e);
      setIsDrawing(true);
      lastDrawnPointRef.current = p;
      drawingStrokeRef.current = [p];

      if (tool === "tile-flip") {
        if (e.altKey) {
          const captured = captureTile(canvas, activeLayer.id, canvas.activeFrameId, p.x, p.y, brushSize, brushSize);
          tileClipboardRef.current = captured;
          toast.info(`Captured a ${brushSize}\u00d7${brushSize} tile — click elsewhere to stamp it (Alt+click to re-capture)`);
          setIsDrawing(false);
          return;
        }
        const source = tileClipboardRef.current ?? {
          width: 1,
          height: 1,
          pixels: [[...hexToRgba(color), 255].slice(0, 4) as [number, number, number, number]],
        };
        const transformed = transformTile(source, tileVariant);
        const stamped = stampTile(canvas, activeLayer.id, canvas.activeFrameId, transformed, p.x, p.y);
        commit(stamped);
        setIsDrawing(false);
        return;
      }

      if (tool === "pencil" || tool === "eraser") {
        paintPoint(p);
        setCanvas((c) => ({ ...c }));
      } else if (tool === "dither") {
        if (ditherAt(p.x, p.y, ditherPattern, ditherThreshold)) {
          paintPoint(p);
          setCanvas((c) => ({ ...c }));
        }
      } else if (tool === "pattern-brush") {
        const [r, g, b] = hexToRgba(color);
        const size = Math.max(2, brushSize + 1);
        const pattern: boolean[][] = Array.from({ length: size }, (_, y) => Array.from({ length: size }, (_, x) => (x + y) % 2 === 0));
        const next = patternBrush(canvas, activeLayer.id, canvas.activeFrameId, p.x, p.y, pattern, [r, g, b, 255]);
        commit(next);
      } else if (tool === "scatter-brush") {
        const [r, g, b] = hexToRgba(color);
        scatterSeedRef.current += 1;
        const next = scatterBrush(canvas, activeLayer.id, canvas.activeFrameId, p.x, p.y, scatterRadius, scatterDensity, [r, g, b, 255], scatterSeedRef.current);
        commit(next);
      } else if (tool === "color-replace") {
        const [r, g, b] = hexToRgba(color);
        const next = colorReplaceBrush(canvas, activeLayer.id, canvas.activeFrameId, p.x, p.y, p.x, p.y, [r, g, b, 255], colorReplaceTolerance, brushSize);
        commit(next);
      } else if (tool === "bucket" || tool === "bucket-global") {
        const [r, g, b] = hexToRgba(color);
        const next = tool === "bucket"
          ? floodFill(canvas, activeLayer.id, canvas.activeFrameId, p.x, p.y, [r, g, b, 255], 0, selection)
          : floodFillGlobal(canvas, activeLayer.id, canvas.activeFrameId, getPixel(canvas, activeLayer.id, canvas.activeFrameId, p.x, p.y) ?? [0, 0, 0, 0], [r, g, b, 255], 0, selection);
        commit(next);
        addRecentColor(color);
      } else if (tool === "line" || tool === "rect" || tool === "rect-filled" || tool === "ellipse" || tool === "ellipse-filled" || tool === "gradient-brush") {
        drawingPreviewRef.current = {
          type: tool === "line" || tool === "gradient-brush" ? "line" : tool.startsWith("rect") ? "rect" : "ellipse",
          start: p,
          end: p,
          filled: tool.endsWith("filled"),
        };
      }
    },
    [tool, canvas, activeLayer, canvasCoordsFromEvent, pan, color, brushSize, tileVariant, ditherPattern, ditherThreshold, scatterRadius, scatterDensity, colorReplaceTolerance, selection, paintPoint, commit, addRecentColor],
  );

  const onPointerMoveCanvas = useCallback(
    (e: React.PointerEvent) => {
      if (isPanning && panStartRef.current) {
        const dx = e.clientX - panStartRef.current.x;
        const dy = e.clientY - panStartRef.current.y;
        setPan({ x: panStartRef.current.px + dx, y: panStartRef.current.py + dy });
        return;
      }
      if (selection && selectStartRef.current && tool === "select-rect") {
        const p = canvasCoordsFromEvent(e);
        setSelection(selectRect(selectStartRef.current.x, selectStartRef.current.y, p.x, p.y));
        return;
      }
      if (!isDrawing) return;
      const p = canvasCoordsFromEvent(e);
      if (tool === "pencil" || tool === "eraser") {
        const last = lastDrawnPointRef.current;
        if (last) {
          paintStroke(last, p);
          drawingStrokeRef.current.push(p);
          lastDrawnPointRef.current = p;
        }
        setCanvas((c) => ({ ...c }));
      } else if (tool === "dither") {
        const last = lastDrawnPointRef.current;
        if (last && ditherAt(p.x, p.y, ditherPattern, ditherThreshold)) {
          paintStroke(last, p);
          lastDrawnPointRef.current = p;
        }
        setCanvas((c) => ({ ...c }));
      } else if (tool === "scatter-brush") {
        const last = lastDrawnPointRef.current;
        if (last && (Math.abs(p.x - last.x) >= 1 || Math.abs(p.y - last.y) >= 1)) {
          const [r, g, b] = hexToRgba(color);
          scatterSeedRef.current += 1;
          const next = scatterBrush(canvas, activeLayer.id, canvas.activeFrameId, p.x, p.y, scatterRadius, scatterDensity, [r, g, b, 255], scatterSeedRef.current);
          setCanvas(next);
          lastDrawnPointRef.current = p;
        }
      } else if (tool === "color-replace") {
        const last = lastDrawnPointRef.current;
        if (last) {
          const [r, g, b] = hexToRgba(color);
          const next = colorReplaceBrush(canvas, activeLayer.id, canvas.activeFrameId, last.x, last.y, p.x, p.y, [r, g, b, 255], colorReplaceTolerance, brushSize);
          setCanvas(next);
          lastDrawnPointRef.current = p;
        }
      } else if (drawingPreviewRef.current) {
        drawingPreviewRef.current.end = p;
        setCanvas((c) => ({ ...c }));
      }
    },
    [isPanning, isDrawing, pan, selection, tool, canvasCoordsFromEvent, paintStroke, ditherPattern, ditherThreshold, canvas, activeLayer, color, scatterRadius, scatterDensity, colorReplaceTolerance, brushSize],
  );

  const onPointerUpCanvas = useCallback(
    (e: React.PointerEvent) => {
      (e.target as HTMLElement).releasePointerCapture?.(e.pointerId);
      if (isPanning) {
        setIsPanning(false);
        panStartRef.current = null;
        return;
      }
      if (tool === "select-rect" && selectStartRef.current) {
        selectStartRef.current = null;
        return;
      }
      if (!isDrawing) return;
      setIsDrawing(false);
      lastDrawnPointRef.current = null;

      if (tool === "pencil" || tool === "eraser" || tool === "dither") {
        let stroke = drawingStrokeRef.current;
        if (pixelPerfect && tool === "pencil" && stroke.length > 2) {
          const corrected = applyPixelPerfect(stroke);
          for (let i = 1; i < corrected.length; i++) {
            paintStroke(corrected[i - 1]!, corrected[i]!);
          }
        }
        drawingStrokeRef.current = [];
        if (tool !== "eraser") addRecentColor(color);
        commit(cloneCanvas(canvas));
      } else if (tool === "scatter-brush" || tool === "color-replace") {
        commit(cloneCanvas(canvas));
      } else if (drawingPreviewRef.current) {
        const preview = drawingPreviewRef.current;
        let next = canvas;
        if (tool === "gradient-brush") {
          const [ar, ag, ab] = hexToRgba(color);
          const [br, bg, bb] = hexToRgba(secondaryColor);
          next = gradientBrush(canvas, activeLayer.id, canvas.activeFrameId, preview.start.x, preview.start.y, preview.end.x, preview.end.y, [ar, ag, ab, 255], [br, bg, bb, 255]);
        } else {
          const [r, g, b] = hexToRgba(color);
          if (preview.type === "line") {
            next = drawLine(canvas, activeLayer.id, canvas.activeFrameId, preview.start.x, preview.start.y, preview.end.x, preview.end.y, [r, g, b, 255], brushSize, selection);
          } else if (preview.type === "rect") {
            next = drawRect(canvas, activeLayer.id, canvas.activeFrameId, preview.start.x, preview.start.y, preview.end.x, preview.end.y, [r, g, b, 255], preview.filled, selection);
          } else if (preview.type === "ellipse") {
            next = drawEllipse(canvas, activeLayer.id, canvas.activeFrameId, preview.start.x, preview.start.y, preview.end.x, preview.end.y, [r, g, b, 255], preview.filled, selection);
          }
        }
        drawingPreviewRef.current = null;
        addRecentColor(color);
        commit(next);
      }
    },
    [isPanning, isDrawing, tool, pixelPerfect, canvas, activeLayer, color, secondaryColor, brushSize, selection, paintStroke, commit, addRecentColor],
  );

  // =========================================================================
  // Render the preview overlay for line/rect/ellipse/gradient during drag
  // =========================================================================
  useEffect(() => {
    if (!isDrawing || !drawingPreviewRef.current) return;
    const overlay = overlayCanvasRef.current;
    if (!overlay) return;
    const ctx = overlay.getContext("2d");
    if (!ctx) return;
    const dpr = window.devicePixelRatio || 1;
    const displayW = canvas.width * zoom;
    const displayH = canvas.height * zoom;
    overlay.width = displayW * dpr;
    overlay.height = displayH * dpr;
    overlay.style.width = `${displayW}px`;
    overlay.style.height = `${displayH}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, displayW, displayH);
    const preview = drawingPreviewRef.current;
    ctx.strokeStyle = color;
    ctx.fillStyle = color + "80";
    const sx = preview.start.x * zoom;
    const sy = preview.start.y * zoom;
    const ex = preview.end.x * zoom;
    const ey = preview.end.y * zoom;
    if (preview.type === "line") {
      ctx.lineWidth = Math.max(1, brushSize * zoom);
      ctx.beginPath();
      ctx.moveTo(sx + zoom / 2, sy + zoom / 2);
      ctx.lineTo(ex + zoom / 2, ey + zoom / 2);
      ctx.stroke();
    } else if (preview.type === "rect") {
      const x = Math.min(sx, ex);
      const y = Math.min(sy, ey);
      const w = Math.abs(ex - sx) + zoom;
      const h = Math.abs(ey - sy) + zoom;
      if (preview.filled) ctx.fillRect(x, y, w, h);
      else ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
    } else if (preview.type === "ellipse") {
      const cx = (sx + ex + zoom) / 2;
      const cy = (sy + ey + zoom) / 2;
      const rx = Math.abs(ex - sx + zoom) / 2;
      const ry = Math.abs(ey - sy + zoom) / 2;
      ctx.beginPath();
      ctx.ellipse(cx, cy, rx, ry, 0, 0, 2 * Math.PI);
      if (preview.filled) ctx.fill();
      else ctx.stroke();
    }
  }, [isDrawing, canvas, zoom, color, brushSize]);

  useEffect(() => {
    if (isDrawing) return;
    const overlay = overlayCanvasRef.current;
    if (!overlay) return;
    const ctx = overlay.getContext("2d");
    if (ctx) ctx.clearRect(0, 0, overlay.width, overlay.height);
  }, [isDrawing]);

  // =========================================================================
  // Selection action handlers (defect #3 fix wired into the UI)
  // =========================================================================
  const handleSelectionFill = useCallback(() => {
    if (!selection) return;
    const [r, g, b] = hexToRgba(color);
    commit(fillSelection(canvas, activeLayer.id, canvas.activeFrameId, selection, [r, g, b, 255]));
  }, [selection, color, canvas, activeLayer, commit]);

  const handleSelectionDelete = useCallback(() => {
    if (!selection) return;
    commit(deleteSelectionPixels(canvas, activeLayer.id, canvas.activeFrameId, selection));
  }, [selection, canvas, activeLayer, commit]);

  const handleSelectionInvert = useCallback(() => {
    if (!selection) return;
    setSelection(invertSelection(canvas, selection));
  }, [selection, canvas]);

  const handleSelectionCopy = useCallback(() => {
    if (!selection) return;
    setSelectionClip(copySelectionPixels(canvas, activeLayer.id, canvas.activeFrameId, selection));
    toast.success("Copied selection");
  }, [selection, canvas, activeLayer]);

  const handleSelectionPaste = useCallback(() => {
    if (!selectionClip) return;
    const atX = selection ? Math.round(selection.x0) : 0;
    const atY = selection ? Math.round(selection.y0) : 0;
    commit(pasteSelectionPixels(canvas, activeLayer.id, canvas.activeFrameId, selectionClip, atX, atY));
  }, [selectionClip, selection, canvas, activeLayer, commit]);

  const handleSelectionNudge = useCallback(
    (dx: number, dy: number) => {
      if (!selection) return;
      const result = moveSelectionPixels(canvas, activeLayer.id, canvas.activeFrameId, selection, dx, dy);
      commit(result.canvas);
      setSelection(result.selection);
    },
    [selection, canvas, activeLayer, commit],
  );

  const handleClearSelection = useCallback(() => setSelection(null), []);

  // =========================================================================
  // Keyboard shortcuts
  // =========================================================================
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)) return;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (e.shiftKey) handleRedo();
        else handleUndo();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "y") {
        e.preventDefault();
        handleRedo();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "c") {
        if (selection) {
          e.preventDefault();
          handleSelectionCopy();
        }
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "v") {
        if (selectionClip) {
          e.preventDefault();
          handleSelectionPaste();
        }
        return;
      }
      if ((e.key === "Delete" || e.key === "Backspace") && selection) {
        e.preventDefault();
        handleSelectionDelete();
        return;
      }
      switch (e.key.toLowerCase()) {
        case "b": setTool("pencil"); break;
        case "e": setTool("eraser"); break;
        case "g": setTool("bucket"); break;
        case "i": setTool("eyedropper"); break;
        case "l": setTool("line"); break;
        case "r": setTool("rect"); break;
        case "o": setTool("ellipse"); break;
        case "m": setTool("move"); break;
        case "s": setTool("select-rect"); break;
        case "x": {
          setColor(secondaryColor);
          setSecondaryColor(color);
          break;
        }
        case "[": setBrushSize((b) => Math.max(1, b - 1)); break;
        case "]": setBrushSize((b) => Math.min(16, b + 1)); break;
        case "+": case "=": setZoom((z) => Math.min(64, z * 2)); break;
        case "-": setZoom((z) => Math.max(1, Math.floor(z / 2))); break;
        case "arrowleft": {
          if (selection && e.altKey) { handleSelectionNudge(-1, 0); break; }
          const idx = canvas.frames.findIndex((f) => f.id === canvas.activeFrameId);
          if (idx > 0) setCanvas((c) => ({ ...c, activeFrameId: c.frames[idx - 1]!.id }));
          break;
        }
        case "arrowright": {
          if (selection && e.altKey) { handleSelectionNudge(1, 0); break; }
          const idx = canvas.frames.findIndex((f) => f.id === canvas.activeFrameId);
          if (idx < canvas.frames.length - 1) setCanvas((c) => ({ ...c, activeFrameId: c.frames[idx + 1]!.id }));
          break;
        }
        case "arrowup": if (selection && e.altKey) handleSelectionNudge(0, -1); break;
        case "arrowdown": if (selection && e.altKey) handleSelectionNudge(0, 1); break;
        case "escape": if (selection) setSelection(null); break;
        case " ": if (!isDrawing) { setTool("move"); } break;
        case "?": setShowShortcuts((s) => !s); break;
        default: break;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [canvas, color, secondaryColor, handleUndo, handleRedo, isDrawing, selection, selectionClip, handleSelectionCopy, handleSelectionPaste, handleSelectionDelete, handleSelectionNudge]);

  // =========================================================================
  // Layer operations (including new duplicate/merge/flatten — feature #12)
  // =========================================================================
  const handleAddLayer = () => commit(addLayer(canvas));
  const handleDuplicateLayer = (id: string) => commit(duplicateLayer(canvas, id));
  const handleMergeLayerDown = (id: string) => {
    try {
      commit(mergeLayerDown(canvas, id));
    } catch (e) {
      toast.error((e as Error).message);
    }
  };
  const handleFlattenImage = () => commit(flattenImage(canvas));
  const handleRemoveLayer = (id: string) => {
    try {
      commit(removeLayer(canvas, id));
    } catch (e) {
      toast.error((e as Error).message);
    }
  };
  const handleMoveLayer = (id: string, dir: -1 | 1) => {
    const idx = canvas.layers.findIndex((l) => l.id === id);
    const newIdx = idx + dir;
    if (newIdx < 0 || newIdx >= canvas.layers.length) return;
    const ids = canvas.layers.map((l) => l.id);
    [ids[idx], ids[newIdx]] = [ids[newIdx]!, ids[idx]!];
    commit(reorderLayers(canvas, ids));
  };
  const handleRenameLayer = (id: string, name: string) => {
    try {
      commit(renameLayer(canvas, id, name));
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  // =========================================================================
  // Frame operations
  // =========================================================================
  const handleAddFrame = () => commit(addFrame(canvas));
  const handleDuplicateFrame = (id: string) => {
    const idx = canvas.frames.findIndex((f) => f.id === id);
    commit(duplicateFrameAt(canvas, id, idx + 1));
  };
  const handleReverseFrames = () => commit(reverseFrames(canvas));
  const handleSetAllDelays = (delay: number) => commit(setAllFrameDelays(canvas, delay));
  const handleRemoveFrame = (id: string) => {
    try {
      commit(removeFrame(canvas, id));
    } catch (e) {
      toast.error((e as Error).message);
    }
  };
  const handleMoveFrame = (id: string, dir: -1 | 1) => {
    const idx = canvas.frames.findIndex((f) => f.id === id);
    const newIdx = idx + dir;
    if (newIdx < 0 || newIdx >= canvas.frames.length) return;
    const ids = canvas.frames.map((f) => f.id);
    [ids[idx], ids[newIdx]] = [ids[newIdx]!, ids[idx]!];
    commit(reorderFrames(canvas, ids));
  };

/* === END OF UI PART 2 (component body continues in PART 3) === */

  const handleNewCanvas = () => {
    if (newWidth < 1 || newHeight < 1 || newWidth > CANVAS_MAX_DIM || newHeight > CANVAS_MAX_DIM) {
      toast.error(`Dimensions must be 1-${CANVAS_MAX_DIM}`);
      return;
    }
    const fresh = createCanvas(newWidth, newHeight, BUNDLED_PALETTES[activePaletteIdx]);
    setCanvas(fresh);
    setHistory(createHistory(fresh, HISTORY_MAX_ENTRIES));
    setShowNewCanvas(false);
    setSelection(null);
    void clearAutosave();
    toast.success(`Created ${newWidth}x${newHeight} canvas`);
  };

  // =========================================================================
  // Whole-canvas resize / crop / flip / rotate (defects #10, #11 fix)
  // =========================================================================
  const handleResizeCanvas = () => {
    commit(resizeCanvas(canvas, resizeWidth, resizeHeight));
    toast.success(`Resized to ${resizeWidth}x${resizeHeight}`);
  };

  const handleCropToSelection = () => {
    if (!selection) {
      toast.error("Make a selection first");
      return;
    }
    commit(cropCanvas(canvas, selection.x0, selection.y0, selection.x1, selection.y1));
    setSelection(null);
    toast.success("Cropped to selection");
  };

  const handleFlipCanvasH = () => commit(flipCanvasHorizontal(canvas));
  const handleFlipCanvasV = () => commit(flipCanvasVertical(canvas));
  const handleRotateCanvas90 = () => {
    commit(rotateCanvas90(canvas));
    setResizeWidth(canvas.height);
    setResizeHeight(canvas.width);
  };

  // =========================================================================
  // Palette file import (.gpl / .pal / .hex / .txt)
  // =========================================================================
  const handlePaletteFile = async (file: File) => {
    const text = await file.text();
    const lower = file.name.toLowerCase();
    let result: Palette;
    if (lower.endsWith(".gpl")) result = parseGplPalette(text);
    else if (lower.endsWith(".pal")) result = parsePalPalette(text);
    else {
      result = parseHexPalette(text);
      if (result.colors.length === 0) result = parseGplPalette(text);
      if (result.colors.length === 0) result = parsePalPalette(text);
    }
    if (result.colors.length === 0) {
      toast.error("Could not find any valid colors in that file");
      return;
    }
    const next = cloneCanvas(canvas);
    next.palette = result;
    commit(next);
    toast.success(`Imported ${result.colors.length}-color palette "${result.name}"`);
  };

  // =========================================================================
  // Palette swap live preview (defect #4 fix: session-based, real Cancel)
  // =========================================================================
  const handlePaletteSwapPreview = (newPalette: Palette) => {
    const session = beginPaletteSwap(canvas, activeLayer.id, canvas.activeFrameId, canvas.palette, newPalette);
    setSwapSession(session);
    setCanvas(session.afterCanvas);
  };

  const handlePaletteSwapApply = () => {
    if (!swapSession) return;
    commit(commitPaletteSwap(swapSession));
    setSwapSession(null);
    toast.success("Palette swap applied");
  };

  const handlePaletteSwapCancel = () => {
    if (!swapSession) return;
    setCanvas(cancelPaletteSwap(swapSession));
    setSwapSession(null);
  };

  // =========================================================================
  // Palette color tag cycling (defect #8 fix: all 5 tags reachable, not just
  // "background") — right-click cycles background -> outline -> shadow ->
  // highlight -> skin -> untagged -> background...
  // =========================================================================
  const handleCyclePaletteTag = (colorIndex: number) => {
    const current = canvas.palette.tags?.[colorIndex];
    const next = cloneCanvas(canvas);
    if (!current) {
      next.palette = tagPaletteColor(next.palette, colorIndex, PALETTE_TAGS[0]!);
    } else {
      const idx = PALETTE_TAGS.indexOf(current);
      if (idx === PALETTE_TAGS.length - 1) {
        next.palette = untagPaletteColor(next.palette, colorIndex, current);
      } else {
        next.palette = tagPaletteColor(next.palette, colorIndex, PALETTE_TAGS[idx + 1]!);
      }
    }
    commit(next);
  };

  const handleApplyTaggedMask = (tag: (typeof PALETTE_TAGS)[number]) => {
    const mask = applyTaggedMask(canvas, activeLayer.id, canvas.activeFrameId, canvas.palette, tag);
    if (!mask.lassoPoints || mask.lassoPoints.length === 0) {
      toast.info(`No colors tagged "${tag}" yet — right-click a palette swatch to tag it`);
      return;
    }
    setSelection(mask);
    toast.success(`Selected ${mask.lassoPoints.length} "${tag}"-tagged pixels`);
  };

  const handleExtractPalette = () => {
    const extracted = extractPaletteFromCanvas(canvas, activeLayer.id, canvas.activeFrameId, "Extracted");
    const next = cloneCanvas(canvas);
    next.palette = extracted;
    commit(next);
    toast.success(`Extracted ${extracted.colors.length} colors in use`);
  };

  const handleSortPaletteByHue = () => {
    const next = cloneCanvas(canvas);
    next.palette = sortPaletteByHue(next.palette);
    commit(next);
  };

  // =========================================================================
  // Sprite sheet import (defect #6 fix: warns instead of silently dropping
  // remainder rows/cols that don't divide evenly by the frame size)
  // =========================================================================
  const handleImportSheet = async (file: File) => {
    try {
      const bitmap = await createImageBitmap(file);
      const c = document.createElement("canvas");
      c.width = bitmap.width;
      c.height = bitmap.height;
      const ctx = c.getContext("2d");
      if (!ctx) throw new Error("Canvas context unavailable");
      ctx.drawImage(bitmap, 0, 0);
      bitmap.close();
      const imageData = ctx.getImageData(0, 0, c.width, c.height);
      const result = importSpriteSheet(imageData.data, c.width, c.height, importFrameW, importFrameH);
      for (const warning of result.warnings) {
        toast.warning(warning);
      }
      if (result.canvas.frames.length === 0) {
        toast.error("No frames could be extracted — check the frame size");
        return;
      }
      result.canvas.palette = BUNDLED_PALETTES[activePaletteIdx]!;
      setCanvas(result.canvas);
      setHistory(createHistory(result.canvas, HISTORY_MAX_ENTRIES));
      setImportSheetOpen(false);
      setSelection(null);
      toast.success(`Imported ${result.canvas.frames.length} frames from sheet`);
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  // =========================================================================
  // Project save / open (uses the PART-1-shape ProjectFile via
  // serializeProject/deserializeProject)
  // =========================================================================
  const handleSaveProject = () => {
    const file: ProjectFile = serializeProject(canvas);
    downloadBlob(new Blob([JSON.stringify(file)], { type: "application/json" }), "pixel-art.pam.json");
    toast.success("Saved project file");
  };

  const handleOpenProject = async (file: File) => {
    try {
      const text = await file.text();
      const parsed = JSON.parse(text) as ProjectFile;
      if (parsed.version !== 1 || !parsed.canvas) {
        throw new Error("Not a recognized pixel-art-maker project file");
      }
      const restored = deserializeProject(parsed);
      setCanvas(restored);
      setHistory(createHistory(restored, HISTORY_MAX_ENTRIES));
      setSelection(null);
      toast.success("Opened project");
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  // =========================================================================
  // Exports (defect #15 fix: real progress reporting + cancellation via
  // AbortController, instead of a blocking call with no feedback)
  // =========================================================================
  const handleCancelExport = () => {
    exportAbortRef.current?.abort();
  };

  const handleExport = async (fmt: ExportFormat) => {
    setExportBusy(fmt);
    setExportProgress(0);
    setError(null);
    const controller = new AbortController();
    exportAbortRef.current = controller;
    const options: ExportOptions = { onProgress: setExportProgress, signal: controller.signal };
    try {
      if (fmt === "png") {
        const bytes = await exportPng(canvas, canvas.activeFrameId, exportScale, options);
        downloadBytes(bytes, `pixel-art-${canvas.activeFrameId}.png`, "image/png");
        toast.success("Exported PNG");
      } else if (fmt === "gif") {
        const bytes = await exportGif(canvas, exportScale, options);
        downloadBytes(bytes, "pixel-art.gif", "image/gif");
        toast.success("Exported GIF");
      } else if (fmt === "apng") {
        const bytes = await exportApng(canvas, exportScale, options);
        downloadBytes(bytes, "pixel-art.apng", "image/apng");
        toast.success("Exported APNG");
      } else if (fmt === "sheet") {
        const bytes = await exportSpriteSheet(canvas, exportScale, options);
        downloadBytes(bytes, "pixel-art-sheet.png", "image/png");
        toast.success("Exported sprite sheet");
      } else if (fmt === "bundle") {
        const bytes = await exportSheetBundle(canvas, exportScale, options);
        downloadBytes(bytes, "pixel-art-bundle.zip", "application/zip");
        toast.success("Exported bundle (frames + Aseprite JSON + palette)");
      } else if (fmt === "project") {
        handleSaveProject();
      }
    } catch (e) {
      if (e instanceof ExportCancelledError) {
        toast.info("Export cancelled");
      } else {
        setError((e as Error).message);
        toast.error((e as Error).message);
      }
    } finally {
      setExportBusy(null);
      setExportProgress(0);
      exportAbortRef.current = null;
    }
  };

/* === END OF UI PART 3 (component body + closing JSX render in PART 4) === */

  return (
    <div className="space-y-3">
      {/* ===== Top toolbar: tools / brush / symmetry / grid ===== */}
      <Card>
        <CardContent className="p-2 flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 flex-wrap" role="toolbar" aria-label="Drawing tools">
            <ToolButton active={tool === "pencil"} onClick={() => setTool("pencil")} title="Pencil (B)"><Pencil className="h-4 w-4" /></ToolButton>
            <ToolButton active={tool === "eraser"} onClick={() => setTool("eraser")} title="Eraser (E)"><Eraser className="h-4 w-4" /></ToolButton>
            <ToolButton active={tool === "bucket"} onClick={() => setTool("bucket")} title="Bucket fill (G)"><PaintBucket className="h-4 w-4" /></ToolButton>
            <ToolButton active={tool === "bucket-global"} onClick={() => setTool("bucket-global")} title="Global bucket fill"><Droplets className="h-4 w-4" /></ToolButton>
            <ToolButton active={tool === "line"} onClick={() => setTool("line")} title="Line (L)"><Minus className="h-4 w-4" /></ToolButton>
            <ToolButton active={tool === "rect"} onClick={() => setTool("rect")} title="Rectangle outline (R)"><Square className="h-4 w-4" /></ToolButton>
            <ToolButton active={tool === "rect-filled"} onClick={() => setTool("rect-filled")} title="Filled rectangle"><Grid2x2 className="h-4 w-4" /></ToolButton>
            <ToolButton active={tool === "ellipse"} onClick={() => setTool("ellipse")} title="Ellipse outline (O)"><Circle className="h-4 w-4" /></ToolButton>
            <ToolButton active={tool === "ellipse-filled"} onClick={() => setTool("ellipse-filled")} title="Filled ellipse"><Circle className="h-4 w-4 opacity-50" /></ToolButton>
            <ToolButton active={tool === "eyedropper"} onClick={() => setTool("eyedropper")} title="Eyedropper, samples the visible composite (I)"><Pipette className="h-4 w-4" /></ToolButton>
            <ToolButton active={tool === "select-rect"} onClick={() => setTool("select-rect")} title="Rectangle select (S)"><Copy className="h-4 w-4" /></ToolButton>
            <ToolButton active={tool === "move"} onClick={() => setTool("move")} title="Pan / move (M or Space)"><Move className="h-4 w-4" /></ToolButton>
            <ToolButton active={tool === "dither"} onClick={() => setTool("dither")} title="Dithering brush"><Sparkles className="h-4 w-4" /></ToolButton>
            <ToolButton active={tool === "tile-flip"} onClick={() => setTool("tile-flip")} title="Tile-flip brush: Alt+click to capture a tile, click to stamp it transformed"><Stamp className="h-4 w-4" /></ToolButton>
            <ToolButton active={tool === "pattern-brush"} onClick={() => setTool("pattern-brush")} title="Pattern brush"><Grid3x3 className="h-4 w-4" /></ToolButton>
            <ToolButton active={tool === "gradient-brush"} onClick={() => setTool("gradient-brush")} title="Gradient brush: drag from primary to secondary color"><Blend className="h-4 w-4" /></ToolButton>
            <ToolButton active={tool === "scatter-brush"} onClick={() => setTool("scatter-brush")} title="Scatter brush"><CircleDot className="h-4 w-4" /></ToolButton>
            <ToolButton active={tool === "color-replace"} onClick={() => setTool("color-replace")} title="Color-replace brush"><Wand2 className="h-4 w-4" /></ToolButton>
          </div>
          <div className="h-6 w-px bg-border mx-1" />
          <div className="flex items-center gap-1.5">
            <Label htmlFor="brush-size" className="text-xs text-muted-foreground">Brush</Label>
            <Input id="brush-size" type="number" min={1} max={16} value={brushSize} onChange={(e) => setBrushSize(Math.max(1, Math.min(16, Number(e.target.value) || 1)))} className="h-8 w-14" aria-label="Brush size" />
          </div>
          <div className="h-6 w-px bg-border mx-1" />
          <Toggle active={mirrorX} onClick={() => setMirrorX((v) => !v)} title="Mirror X"><FlipHorizontal2 className="h-4 w-4" /></Toggle>
          <Toggle active={mirrorY} onClick={() => setMirrorY((v) => !v)} title="Mirror Y"><FlipVertical2 className="h-4 w-4" /></Toggle>
          <Toggle active={showGrid} onClick={() => setShowGrid((v) => !v)} title="Grid"><Grid3x3 className="h-4 w-4" /></Toggle>
          <Toggle active={pixelPerfect} onClick={() => setPixelPerfect((v) => !v)} title="Pixel-perfect stroke"><Sparkles className="h-4 w-4" /></Toggle>
          <div className="h-6 w-px bg-border mx-1" />
          <Button variant="outline" size="sm" onClick={() => setShowOnionPanel((v) => !v)} className="gap-1.5">
            <LayersIcon className="h-3.5 w-3.5" /> Onion skin
          </Button>
          <Button variant="outline" size="sm" onClick={() => setShowCanvasOps((v) => !v)} className="gap-1.5">
            <Crop className="h-3.5 w-3.5" /> Canvas
          </Button>
          {tool === "tile-flip" && (
            <div className="flex items-center gap-1.5 ml-2">
              <Label className="text-xs text-muted-foreground">Variant</Label>
              <select aria-label="Tile variant" value={tileVariant} onChange={(e) => setTileVariant(Number(e.target.value) as TileVariant)} className="h-8 rounded-md border bg-background px-2 text-xs">
                <option value={0}>Identity</option>
                <option value={1}>Rotate 90°</option>
                <option value={2}>Rotate 180°</option>
                <option value={3}>Rotate 270°</option>
                <option value={4}>Flip H</option>
                <option value={5}>Flip V</option>
                <option value={6}>Transpose</option>
                <option value={7}>Anti-transpose</option>
              </select>
            </div>
          )}
          {tool === "dither" && (
            <div className="flex items-center gap-1.5 ml-2">
              <Label className="text-xs text-muted-foreground">Pattern</Label>
              <select aria-label="Dither pattern" value={ditherPattern} onChange={(e) => setDitherPattern(e.target.value as DitherPattern)} className="h-8 rounded-md border bg-background px-2 text-xs">
                <option value="checker">Checker</option>
                <option value="bayer2">Bayer 2×2</option>
                <option value="bayer4">Bayer 4×4</option>
              </select>
              <Label className="text-xs text-muted-foreground">Threshold</Label>
              <Slider value={[ditherThreshold * 100]} onValueChange={(v) => setDitherThreshold(v[0]! / 100)} min={5} max={95} step={5} className="w-24" />
            </div>
          )}
          {tool === "scatter-brush" && (
            <div className="flex items-center gap-1.5 ml-2">
              <Label className="text-xs text-muted-foreground">Radius</Label>
              <Input type="number" min={1} max={32} value={scatterRadius} onChange={(e) => setScatterRadius(Math.max(1, Number(e.target.value) || 1))} className="h-8 w-14" />
              <Label className="text-xs text-muted-foreground">Density</Label>
              <Slider value={[scatterDensity * 100]} onValueChange={(v) => setScatterDensity(v[0]! / 100)} min={5} max={100} step={5} className="w-24" />
            </div>
          )}
          {tool === "color-replace" && (
            <div className="flex items-center gap-1.5 ml-2">
              <Label className="text-xs text-muted-foreground">Tolerance</Label>
              <Slider value={[colorReplaceTolerance]} onValueChange={(v) => setColorReplaceTolerance(v[0]!)} min={0} max={800} step={20} className="w-24" />
            </div>
          )}
          <div className="ml-auto flex items-center gap-1.5">
            <Button variant="outline" size="sm" onClick={handleUndo} disabled={!canUndo} className="gap-1.5"><Undo2 className="h-3.5 w-3.5" /> Undo</Button>
            <Button variant="outline" size="sm" onClick={handleRedo} disabled={!canRedo} className="gap-1.5"><Redo2 className="h-3.5 w-3.5" /> Redo</Button>
            <Button variant="outline" size="sm" onClick={() => setShowShortcuts(true)} className="gap-1.5"><Keyboard className="h-3.5 w-3.5" /> ?</Button>
          </div>
        </CardContent>
      </Card>

      {/* ===== Canvas ops panel (defects #10/#11 fix: resize/crop/flip/rotate) ===== */}
      {showCanvasOps && (
        <Card>
          <CardContent className="p-3 flex flex-wrap items-end gap-3">
            <div>
              <Label className="text-xs text-muted-foreground">Resize width</Label>
              <Input type="number" min={1} max={CANVAS_MAX_DIM} value={resizeWidth} onChange={(e) => setResizeWidth(Number(e.target.value) || 1)} className="h-8 w-20" />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Resize height</Label>
              <Input type="number" min={1} max={CANVAS_MAX_DIM} value={resizeHeight} onChange={(e) => setResizeHeight(Number(e.target.value) || 1)} className="h-8 w-20" />
            </div>
            <Button size="sm" onClick={handleResizeCanvas} className="h-8">Resize (anchored top-left)</Button>
            <Button size="sm" variant="outline" onClick={handleCropToSelection} className="h-8 gap-1.5" disabled={!selection}><Crop className="h-3.5 w-3.5" /> Crop to selection</Button>
            <div className="h-8 w-px bg-border" />
            <Button size="sm" variant="outline" onClick={handleFlipCanvasH} className="h-8 gap-1.5"><FlipHorizontal className="h-3.5 w-3.5" /> Flip canvas H</Button>
            <Button size="sm" variant="outline" onClick={handleFlipCanvasV} className="h-8 gap-1.5"><FlipVertical className="h-3.5 w-3.5" /> Flip canvas V</Button>
            <Button size="sm" variant="outline" onClick={handleRotateCanvas90} className="h-8 gap-1.5"><RotateCw className="h-3.5 w-3.5" /> Rotate 90°</Button>
          </CardContent>
        </Card>
      )}

      {/* ===== Selection panel (defect #3 fix: real operations, not a no-op tool) ===== */}
      {selection && (
        <Card>
          <CardContent className="p-2 flex flex-wrap items-center gap-2">
            <span className="text-xs text-muted-foreground">Selection active</span>
            <Button size="sm" variant="outline" onClick={handleSelectionFill} className="h-7 text-xs">Fill</Button>
            <Button size="sm" variant="outline" onClick={handleSelectionDelete} className="h-7 text-xs">Delete</Button>
            <Button size="sm" variant="outline" onClick={handleSelectionInvert} className="h-7 text-xs">Invert</Button>
            <Button size="sm" variant="outline" onClick={handleSelectionCopy} className="h-7 text-xs">Copy</Button>
            <Button size="sm" variant="outline" onClick={handleSelectionPaste} disabled={!selectionClip} className="h-7 text-xs">Paste</Button>
            <div className="flex items-center gap-0.5">
              <Button size="icon" variant="ghost" onClick={() => handleSelectionNudge(-1, 0)} className="h-7 w-7" aria-label="Nudge left"><ChevronLeft className="h-3.5 w-3.5" /></Button>
              <Button size="icon" variant="ghost" onClick={() => handleSelectionNudge(1, 0)} className="h-7 w-7" aria-label="Nudge right"><ChevronRight className="h-3.5 w-3.5" /></Button>
              <Button size="icon" variant="ghost" onClick={() => handleSelectionNudge(0, -1)} className="h-7 w-7" aria-label="Nudge up"><ChevronUp className="h-3.5 w-3.5" /></Button>
              <Button size="icon" variant="ghost" onClick={() => handleSelectionNudge(0, 1)} className="h-7 w-7" aria-label="Nudge down"><ChevronDown className="h-3.5 w-3.5" /></Button>
            </div>
            <Button size="sm" variant="ghost" onClick={handleClearSelection} className="h-7 text-xs ml-auto">Clear (Esc)</Button>
          </CardContent>
        </Card>
      )}

      {/* ===== Main 3-column layout ===== */}
      <div className="grid grid-cols-1 lg:grid-cols-[220px_1fr_240px] gap-3">
        {/* ===== Left sidebar: layers + palette ===== */}
        <div className="space-y-3">
          {/* Layers panel */}
          <Card>
            <CardContent className="p-3">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-xs font-semibold uppercase text-muted-foreground flex items-center gap-1.5"><LayersIcon className="h-3.5 w-3.5" /> Layers</h3>
                <div className="flex items-center gap-0.5">
                  <Button variant="ghost" size="icon" onClick={handleAddLayer} title="Add layer" aria-label="Add layer" className="h-6 w-6"><Plus className="h-3.5 w-3.5" /></Button>
                  <Button variant="ghost" size="icon" onClick={handleFlattenImage} title="Flatten all layers" aria-label="Flatten all layers" className="h-6 w-6"><Blend className="h-3.5 w-3.5" /></Button>
                </div>
              </div>
              <div className="space-y-1 max-h-64 overflow-y-auto">
                {[...canvas.layers].reverse().map((layer) => (
                  <div
                    key={layer.id}
                    className={`flex items-center gap-1 rounded-md p-1.5 text-xs ${layer.id === canvas.activeLayerId ? "bg-accent" : "hover:bg-accent/50"}`}
                    onClick={() => setCanvas((c) => ({ ...c, activeLayerId: layer.id }))}
                  >
                    <button
                      type="button"
                      className="p-0.5 hover:bg-background rounded"
                      onClick={(e) => { e.stopPropagation(); commit(setLayerVisible(canvas, layer.id, !layer.visible)); }}
                      title={layer.visible ? "Hide" : "Show"}
                      aria-label={layer.visible ? "Hide layer" : "Show layer"}
                    >
                      {layer.visible ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
                    </button>
                    <button
                      type="button"
                      className="p-0.5 hover:bg-background rounded"
                      onClick={(e) => { e.stopPropagation(); commit(setLayerLocked(canvas, layer.id, !layer.locked)); }}
                      title={layer.locked ? "Unlock" : "Lock (now actually enforced)"}
                      aria-label={layer.locked ? "Unlock layer" : "Lock layer"}
                    >
                      {layer.locked ? <Lock className="h-3 w-3" /> : <Unlock className="h-3 w-3" />}
                    </button>
                    <span className="flex-1 truncate" title={layer.name}>{layer.name}</span>
                    <input
                      type="range"
                      min={0}
                      max={100}
                      value={Math.round(layer.opacity * 100)}
                      onChange={(e) => commit(setLayerOpacity(canvas, layer.id, Number(e.target.value) / 100))}
                      onClick={(e) => e.stopPropagation()}
                      className="w-10 h-1"
                      aria-label={`Opacity for ${layer.name}`}
                    />
                    <div className="flex items-center">
                      <button type="button" className="p-0.5 hover:bg-background rounded" onClick={(e) => { e.stopPropagation(); handleDuplicateLayer(layer.id); }} title="Duplicate" aria-label="Duplicate layer"><Copy className="h-3 w-3" /></button>
                      <button type="button" className="p-0.5 hover:bg-background rounded" onClick={(e) => { e.stopPropagation(); handleMergeLayerDown(layer.id); }} title="Merge down" aria-label="Merge layer down"><ChevronDown className="h-3 w-3" /></button>
                      <button type="button" className="p-0.5 hover:bg-background rounded" onClick={(e) => { e.stopPropagation(); handleMoveLayer(layer.id, 1); }} aria-label="Move up"><ChevronUp className="h-3 w-3" /></button>
                      <button type="button" className="p-0.5 hover:bg-background rounded" onClick={(e) => { e.stopPropagation(); handleRemoveLayer(layer.id); }} aria-label="Delete layer"><Trash2 className="h-3 w-3" /></button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Palette panel */}
          <Card>
            <CardContent className="p-3">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-xs font-semibold uppercase text-muted-foreground flex items-center gap-1.5"><PaletteIcon className="h-3.5 w-3.5" /> Palette</h3>
                <div className="flex items-center gap-0.5">
                  <Button variant="ghost" size="icon" onClick={handleExtractPalette} title="Extract colors in use" aria-label="Extract colors in use" className="h-6 w-6"><Wand2 className="h-3.5 w-3.5" /></Button>
                  <Button variant="ghost" size="icon" onClick={handleSortPaletteByHue} title="Sort by hue" aria-label="Sort palette by hue" className="h-6 w-6"><ArrowDownUp className="h-3.5 w-3.5" /></Button>
                  <Button variant="ghost" size="icon" onClick={() => paletteFileRef.current?.click()} title="Import .gpl/.pal/.hex" aria-label="Import palette file" className="h-6 w-6"><Upload className="h-3.5 w-3.5" /></Button>
                </div>
                <input ref={paletteFileRef} type="file" accept=".gpl,.pal,.hex,.txt" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) void handlePaletteFile(f); e.target.value = ""; }} />
              </div>
              <select
                aria-label="Bundled palettes"
                value={activePaletteIdx}
                onChange={(e) => {
                  const idx = Number(e.target.value);
                  setActivePaletteIdx(idx);
                  const next = cloneCanvas(canvas);
                  next.palette = BUNDLED_PALETTES[idx]!;
                  commit(next);
                }}
                className="w-full h-8 rounded-md border bg-background px-2 text-xs mb-2"
              >
                {BUNDLED_PALETTES.map((p, i) => (
                  <option key={p.name} value={i}>{p.name} ({p.colors.length})</option>
                ))}
              </select>
              <div className="grid grid-cols-8 gap-0.5 max-h-32 overflow-y-auto mb-2">
                {canvas.palette.colors.map((c, i) => {
                  const tag = canvas.palette.tags?.[i];
                  return (
                    <button
                      key={i}
                      type="button"
                      onClick={() => { setColor(c); addRecentColor(c); }}
                      onContextMenu={(e) => {
                        e.preventDefault();
                        handleCyclePaletteTag(i);
                      }}
                      title={`${c}${tag ? ` — tagged ${tag} (right-click to cycle tag)` : " (right-click to tag: background/outline/shadow/highlight/skin)"}`}
                      className="aspect-square rounded-sm border border-border hover:scale-110 transition-transform relative"
                      style={{ backgroundColor: c }}
                      aria-label={`Color ${c}${tag ? `, tagged ${tag}` : ""}`}
                    >
                      {tag && <span className="absolute inset-x-0 bottom-0 h-1 bg-white/80" />}
                    </button>
                  );
                })}
              </div>
              <div className="flex flex-wrap gap-1 mb-2">
                {PALETTE_TAGS.map((tag) => (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => handleApplyTaggedMask(tag)}
                    className="text-[10px] px-1.5 py-0.5 rounded border border-border hover:bg-accent"
                    title={`Select all pixels tagged "${tag}"`}
                  >
                    {tag}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-2 mb-2">
                <input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="h-8 w-8 rounded border bg-transparent cursor-pointer" aria-label="Primary color" />
                <input type="color" value={secondaryColor} onChange={(e) => setSecondaryColor(e.target.value)} className="h-8 w-8 rounded border bg-transparent cursor-pointer" aria-label="Secondary color" />
                <Button variant="outline" size="icon" onClick={() => { setColor(secondaryColor); setSecondaryColor(color); }} title="Swap colors (X)" aria-label="Swap colors" className="h-8 w-8"><ArrowDownUp className="h-3.5 w-3.5" /></Button>
                <Input type="text" value={color} onChange={(e) => setColor(e.target.value)} className="h-8 flex-1 text-xs font-mono" aria-label="Hex color" />
              </div>
              <div className="mb-2">
                <Label className="text-xs text-muted-foreground">Shading</Label>
                <div className="flex gap-0.5 mt-1">
                  {Object.entries(shadeColor(color)).map(([k, v]) => (
                    <button key={k} type="button" onClick={() => setColor(v)} title={`${k}: ${v}`} className="flex-1 h-6 rounded-sm border border-border hover:scale-105 transition-transform" style={{ backgroundColor: v }} aria-label={`Shade ${k}`} />
                  ))}
                </div>
              </div>
              <div className="mb-2">
                <Label className="text-xs text-muted-foreground">Harmony</Label>
                <div className="flex gap-0.5 mt-1">
                  {(() => {
                    const h = colorHarmony(color);
                    const swatches = [h.complementary, ...h.triadic, ...h.analogous];
                    return swatches.map((v, i) => (
                      <button key={i} type="button" onClick={() => setColor(v)} title={v} className="flex-1 h-6 rounded-sm border border-border hover:scale-105 transition-transform" style={{ backgroundColor: v }} aria-label={`Harmony color ${v}`} />
                    ));
                  })()}
                </div>
              </div>
              {recentColors.length > 0 && (
                <div className="mb-2">
                  <Label className="text-xs text-muted-foreground">Recent ({recentColors.length})</Label>
                  <div className="grid grid-cols-10 gap-0.5 mt-1">
                    {recentColors.map((c, i) => (
                      <button key={i} type="button" onClick={() => setColor(c)} title={c} className="aspect-square rounded-sm border border-border hover:scale-110 transition-transform" style={{ backgroundColor: c }} aria-label={`Recent color ${c}`} />
                    ))}
                  </div>
                </div>
              )}
              <div className="mt-2 border-t pt-2">
                <Label className="text-xs text-muted-foreground">Palette swap (live preview, defect #4 fix)</Label>
                <select
                  aria-label="Swap to palette"
                  value=""
                  onChange={(e) => {
                    const idx = Number(e.target.value);
                    if (BUNDLED_PALETTES[idx]) handlePaletteSwapPreview(BUNDLED_PALETTES[idx]!);
                  }}
                  className="w-full h-8 rounded-md border bg-background px-2 text-xs mt-1"
                >
                  <option value="">Pick palette to preview…</option>
                  {BUNDLED_PALETTES.map((p, i) => (
                    <option key={p.name} value={i}>{p.name}</option>
                  ))}
                </select>
                {swapSession && (
                  <div className="flex gap-1 mt-1">
                    <Button size="sm" onClick={handlePaletteSwapApply} className="h-7 text-xs">Apply</Button>
                    <Button size="sm" variant="outline" onClick={handlePaletteSwapCancel} className="h-7 text-xs">Cancel (restores exact prior state)</Button>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* ===== Center: zoomable canvas ===== */}
        <div className="space-y-2">
          <Card>
            <CardContent className="p-2">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span>{canvas.width} × {canvas.height}px</span>
                  <span>·</span>
                  <span>Zoom {zoom}×</span>
                  <span>·</span>
                  <span>Frame {canvas.frames.findIndex((f) => f.id === canvas.activeFrameId) + 1}/{canvas.frames.length}</span>
                </div>
                <div className="flex items-center gap-1">
                  <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => setZoom((z) => Math.max(1, Math.floor(z / 2)))} aria-label="Zoom out"><Minus className="h-3.5 w-3.5" /></Button>
                  <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => setZoom((z) => Math.min(64, z * 2))} aria-label="Zoom in"><Plus className="h-3.5 w-3.5" /></Button>
                  <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => { setZoom(16); setPan({ x: 0, y: 0 }); }}>Reset</Button>
                </div>
              </div>
              <div
                ref={containerRef}
                className="relative overflow-auto rounded-md border bg-muted/30 h-[480px] flex items-start justify-center"
                style={{ cursor: tool === "move" || isPanning ? "grab" : "crosshair" }}
              >
                <div style={{ transform: `translate(${pan.x}px, ${pan.y}px)`, transformOrigin: "center" }} className="relative">
                  <canvas
                    ref={displayCanvasRef}
                    onPointerDown={onPointerDownCanvas}
                    onPointerMove={onPointerMoveCanvas}
                    onPointerUp={onPointerUpCanvas}
                    onPointerCancel={onPointerUpCanvas}
                    className="block"
                    style={{ imageRendering: "pixelated", touchAction: "none" }}
                  />
                  <canvas
                    ref={overlayCanvasRef}
                    className="absolute inset-0 pointer-events-none"
                    style={{ imageRendering: "pixelated" }}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
          {/* Export toolbar (defect #15 fix: progress + cancel) */}
          <Card>
            <CardContent className="p-2 flex flex-wrap items-center gap-2">
              <Label className="text-xs text-muted-foreground">Scale</Label>
              <Input type="number" min={1} max={32} value={exportScale} onChange={(e) => setExportScale(Math.max(1, Math.min(32, Number(e.target.value) || 1)))} className="h-8 w-14" aria-label="Export scale" />
              <div className="flex-1" />
              {exportBusy ? (
                <div className="flex items-center gap-2">
                  <div className="w-32 h-2 rounded-full bg-muted overflow-hidden">
                    <div className="h-full bg-primary transition-all" style={{ width: `${Math.round(exportProgress * 100)}%` }} />
                  </div>
                  <span className="text-xs text-muted-foreground">{Math.round(exportProgress * 100)}%</span>
                  <Button size="sm" variant="outline" onClick={handleCancelExport} className="gap-1.5"><XIcon className="h-3.5 w-3.5" /> Cancel</Button>
                </div>
              ) : (
                <>
                  <Button size="sm" onClick={() => handleExport("png")} className="gap-1.5">
                    <ImageIcon className="h-3.5 w-3.5" /> PNG
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => handleExport("gif")} className="gap-1.5">
                    <ImageIcon className="h-3.5 w-3.5" /> GIF
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => handleExport("apng")} className="gap-1.5">
                    <ImageIcon className="h-3.5 w-3.5" /> APNG
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => handleExport("sheet")} className="gap-1.5">
                    <FileType2 className="h-3.5 w-3.5" /> Sheet PNG
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => handleExport("bundle")} className="gap-1.5">
                    <FileJson className="h-3.5 w-3.5" /> Bundle ZIP
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => handleExport("project")} className="gap-1.5">
                    <Save className="h-3.5 w-3.5" /> Project
                  </Button>
                </>
              )}
            </CardContent>
          </Card>
        </div>

        {/* ===== Right sidebar: frames timeline + preview ===== */}
        <div className="space-y-3">
          <Card>
            <CardContent className="p-3">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-xs font-semibold uppercase text-muted-foreground">Animation</h3>
                <div className="flex items-center gap-1">
                  <Button variant="outline" size="icon" className="h-6 w-6" onClick={() => setPlaying((p) => !p)} aria-label={playing ? "Pause" : "Play"}>
                    {playing ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
                  </Button>
                  <Button variant="ghost" size="icon" className="h-6 w-6" onClick={handleAddFrame} aria-label="Add frame"><Plus className="h-3.5 w-3.5" /></Button>
                  <Button variant="ghost" size="icon" className="h-6 w-6" onClick={handleReverseFrames} title="Reverse frame order" aria-label="Reverse frame order"><ArrowDownUp className="h-3.5 w-3.5" /></Button>
                </div>
              </div>
              <div className="flex flex-col items-center gap-1 mb-2">
                <canvas ref={previewCanvasRef} className="border border-border rounded" style={{ imageRendering: "pixelated" }} />
                <span className="text-xs text-muted-foreground">Live preview</span>
              </div>
              <div className="mb-2">
                <Label className="text-xs text-muted-foreground">Speed: {playbackSpeed}×</Label>
                <div className="grid grid-cols-5 gap-0.5 mt-1">
                  {[0.25, 0.5, 1, 2, 4].map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setPlaybackSpeed(s)}
                      className={`text-xs rounded py-1 border ${playbackSpeed === s ? "bg-primary text-primary-foreground border-primary" : "border-border hover:bg-accent"}`}
                      aria-pressed={playbackSpeed === s}
                    >
                      {s}×
                    </button>
                  ))}
                </div>
              </div>
              <div className="mb-2 flex items-center gap-1">
                <Input
                  type="number"
                  min={10}
                  placeholder="All delays (ms)"
                  className="h-7 text-xs"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      const v = Number((e.target as HTMLInputElement).value);
                      if (v > 0) handleSetAllDelays(v);
                    }
                  }}
                />
              </div>
              <div className="space-y-1 max-h-72 overflow-y-auto">
                {canvas.frames.map((f, i) => (
                  <div
                    key={f.id}
                    className={`flex items-center gap-1 rounded-md p-1 text-xs ${f.id === canvas.activeFrameId ? "bg-accent" : "hover:bg-accent/50"}`}
                    onClick={() => setCanvas((c) => ({ ...c, activeFrameId: f.id }))}
                  >
                    <span className="w-5 text-right text-muted-foreground">{i + 1}</span>
                    <input
                      type="number"
                      value={f.delay}
                      onChange={(e) => commit(setFrameDelay(canvas, f.id, Number(e.target.value) || 100))}
                      onClick={(e) => e.stopPropagation()}
                      className="w-12 h-6 rounded border bg-background px-1 text-xs"
                      aria-label={`Frame ${i + 1} delay`}
                    />
                    <span className="text-muted-foreground">ms</span>
                    <div className="flex-1" />
                    <button type="button" className="p-0.5 hover:bg-background rounded" onClick={(e) => { e.stopPropagation(); handleDuplicateFrame(f.id); }} title="Duplicate at this position" aria-label="Duplicate frame"><Copy className="h-3 w-3" /></button>
                    <button type="button" className="p-0.5 hover:bg-background rounded" onClick={(e) => { e.stopPropagation(); handleMoveFrame(f.id, -1); }} aria-label="Move frame left"><ChevronLeft className="h-3 w-3" /></button>
                    <button type="button" className="p-0.5 hover:bg-background rounded" onClick={(e) => { e.stopPropagation(); handleMoveFrame(f.id, 1); }} aria-label="Move frame right"><ChevronRight className="h-3 w-3" /></button>
                    <button type="button" className="p-0.5 hover:bg-background rounded" onClick={(e) => { e.stopPropagation(); handleRemoveFrame(f.id); }} aria-label="Delete frame"><Trash2 className="h-3 w-3" /></button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {showOnionPanel && (
            <Card>
              <CardContent className="p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-semibold uppercase text-muted-foreground">Onion Skin</h3>
                  <Switch checked={onionSkin.enabled} onCheckedChange={(v) => setOnionSkin((s) => ({ ...s, enabled: v }))} aria-label="Enable onion skin" />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Opacity: {Math.round(onionSkin.opacity * 100)}%</Label>
                  <Slider value={[onionSkin.opacity * 100]} onValueChange={(v) => setOnionSkin((s) => ({ ...s, opacity: v[0]! / 100 }))} min={5} max={100} step={5} />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Frames back/forward: {onionSkin.framesBack}</Label>
                  <Slider value={[onionSkin.framesBack]} onValueChange={(v) => setOnionSkin((s) => ({ ...s, framesBack: v[0]! }))} min={1} max={5} step={1} />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label className="text-xs text-muted-foreground">Prev tint</Label>
                    <input type="color" value={onionSkin.prevColor} onChange={(e) => setOnionSkin((s) => ({ ...s, prevColor: e.target.value }))} className="h-8 w-full rounded border bg-transparent" aria-label="Previous frame tint" />
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Next tint</Label>
                    <input type="color" value={onionSkin.nextColor} onChange={(e) => setOnionSkin((s) => ({ ...s, nextColor: e.target.value }))} className="h-8 w-full rounded border bg-transparent" aria-label="Next frame tint" />
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* ===== Bottom toolbar: new / import / autosave note ===== */}
      <Card>
        <CardContent className="p-2 flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setShowNewCanvas((v) => !v)} className="gap-1.5">
            <Plus className="h-3.5 w-3.5" /> New
          </Button>
          <Button variant="outline" size="sm" onClick={() => setImportSheetOpen((v) => !v)} className="gap-1.5">
            <Upload className="h-3.5 w-3.5" /> Import sheet
          </Button>
          <Button variant="outline" size="sm" onClick={() => { const inp = document.createElement("input"); inp.type = "file"; inp.accept = ".json,application/json"; inp.onchange = () => { const f = inp.files?.[0]; if (f) void handleOpenProject(f); }; inp.click(); }} className="gap-1.5">
            <FolderOpen className="h-3.5 w-3.5" /> Open project
          </Button>
          <div className="flex-1" />
          <Badge variant="secondary" className="text-xs gap-1"><Save className="h-3 w-3" /> Autosaves every 5s</Badge>
        </CardContent>
      </Card>

      {/* ===== New canvas dialog ===== */}
      {showNewCanvas && (
        <Card>
          <CardContent className="p-3 flex flex-wrap items-end gap-3">
            <div>
              <Label htmlFor="new-w" className="text-xs text-muted-foreground">Width</Label>
              <Input id="new-w" type="number" min={1} max={CANVAS_MAX_DIM} value={newWidth} onChange={(e) => setNewWidth(Number(e.target.value) || 1)} className="h-8 w-20" />
            </div>
            <div>
              <Label htmlFor="new-h" className="text-xs text-muted-foreground">Height</Label>
              <Input id="new-h" type="number" min={1} max={CANVAS_MAX_DIM} value={newHeight} onChange={(e) => setNewHeight(Number(e.target.value) || 1)} className="h-8 w-20" />
            </div>
            <div className="flex gap-1">
              {[8, 16, 32, 64].map((s) => (
                <Button key={s} variant="outline" size="sm" className="h-8" onClick={() => { setNewWidth(s); setNewHeight(s); }}>{s}²</Button>
              ))}
            </div>
            <Button size="sm" onClick={handleNewCanvas} className="h-8">Create</Button>
            <Button variant="ghost" size="sm" onClick={() => setShowNewCanvas(false)} className="h-8">Cancel</Button>
          </CardContent>
        </Card>
      )}

      {/* ===== Import sheet dialog (defect #6 fix: warns on remainder rows/cols) ===== */}
      {importSheetOpen && (
        <Card>
          <CardContent className="p-3 flex flex-wrap items-end gap-3">
            <div>
              <Label htmlFor="imp-fw" className="text-xs text-muted-foreground">Frame width</Label>
              <Input id="imp-fw" type="number" min={1} value={importFrameW} onChange={(e) => setImportFrameW(Number(e.target.value) || 1)} className="h-8 w-20" />
            </div>
            <div>
              <Label htmlFor="imp-fh" className="text-xs text-muted-foreground">Frame height</Label>
              <Input id="imp-fh" type="number" min={1} value={importFrameH} onChange={(e) => setImportFrameH(Number(e.target.value) || 1)} className="h-8 w-20" />
            </div>
            <Button size="sm" onClick={() => importFileRef.current?.click()} className="h-8 gap-1.5">
              <Upload className="h-3.5 w-3.5" /> Choose sheet image
            </Button>
            <input ref={importFileRef} type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) void handleImportSheet(f); e.target.value = ""; }} />
            <Button variant="ghost" size="sm" onClick={() => setImportSheetOpen(false)} className="h-8">Cancel</Button>
          </CardContent>
        </Card>
      )}

      {/* ===== Error ===== */}
      {error && <ErrorBanner message={error} />}

      {/* ===== Shortcut overlay ===== */}
      {showShortcuts && <ShortcutOverlay onClose={() => setShowShortcuts(false)} />}

      {/* ===== Privacy note ===== */}
      <Card>
        <CardContent className="p-3">
          <p className="text-xs text-muted-foreground">
            <strong className="text-foreground">Privacy:</strong> every brush stroke, animation frame, and export runs locally in your browser.
            No images leave your device. Project files autosave to IndexedDB every 5 seconds. GIF/APNG/ZIP encoders (gifenc, UPNG,
            JSZip) lazy-load only when you export, keeping the initial bundle small. Exports report real progress and can be
            cancelled mid-way.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

// ===========================================================================
// Sub-components
// ===========================================================================

function ToolButton({ active, onClick, title, children }: { active: boolean; onClick: () => void; title: string; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      aria-label={title}
      aria-pressed={active}
      className={`h-8 w-8 rounded-md border flex items-center justify-center transition-colors ${active ? "bg-primary text-primary-foreground border-primary" : "border-border hover:bg-accent"}`}
    >
      {children}
    </button>
  );
}

function Toggle({ active, onClick, title, children }: { active: boolean; onClick: () => void; title: string; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      aria-label={title}
      aria-pressed={active}
      className={`h-8 w-8 rounded-md border flex items-center justify-center transition-colors ${active ? "bg-primary text-primary-foreground border-primary" : "border-border hover:bg-accent"}`}
    >
      {children}
    </button>
  );
}

function ShortcutOverlay({ onClose }: { onClose: () => void }) {
  const sections: { title: string; shortcuts: { key: string; desc: string }[] }[] = [
    {
      title: "Tools",
      shortcuts: [
        { key: "B", desc: "Pencil" },
        { key: "E", desc: "Eraser" },
        { key: "G", desc: "Bucket fill" },
        { key: "I", desc: "Eyedropper (samples visible composite)" },
        { key: "L", desc: "Line" },
        { key: "R", desc: "Rectangle outline" },
        { key: "O", desc: "Ellipse outline" },
        { key: "M", desc: "Pan / move" },
        { key: "S", desc: "Rectangle select" },
        { key: "X", desc: "Swap primary/secondary colors" },
        { key: "[ / ]", desc: "Decrease / increase brush size" },
        { key: "+ / -", desc: "Zoom in / out" },
        { key: "Alt + click (tile-flip)", desc: "Capture a multi-pixel tile" },
      ],
    },
    {
      title: "Selection",
      shortcuts: [
        { key: "Delete / Backspace", desc: "Clear selection pixels" },
        { key: "Ctrl/Cmd + C", desc: "Copy selection" },
        { key: "Ctrl/Cmd + V", desc: "Paste at selection" },
        { key: "Alt + Arrow keys", desc: "Nudge selection pixels by 1px" },
        { key: "Escape", desc: "Clear selection" },
      ],
    },
    {
      title: "Navigation",
      shortcuts: [
        { key: "Space", desc: "Hold to pan (or use Move tool)" },
        { key: "Shift + drag", desc: "Pan with any tool" },
        { key: "?", desc: "Toggle this shortcut overlay" },
        { key: "Ctrl/Cmd + Z", desc: "Undo" },
        { key: "Ctrl/Cmd + Shift + Z", desc: "Redo" },
        { key: "Ctrl/Cmd + Y", desc: "Redo" },
        { key: "\u2190 / \u2192", desc: "Previous / next frame" },
      ],
    },
  ];
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose} role="dialog" aria-modal="true" aria-label="Keyboard shortcuts">
      <div className="bg-background rounded-lg border shadow-lg max-w-2xl w-full max-h-[80vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-sm font-semibold flex items-center gap-1.5"><Keyboard className="h-4 w-4" /> Keyboard Shortcuts</h2>
          <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close"><XIcon className="h-4 w-4" /></Button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4">
          {sections.map((s) => (
            <div key={s.title}>
              <h3 className="text-xs font-semibold uppercase text-muted-foreground mb-2">{s.title}</h3>
              <dl className="space-y-1">
                {s.shortcuts.map((sc) => (
                  <div key={sc.key} className="flex items-center justify-between text-xs gap-2">
                    <dt className="font-mono bg-muted px-1.5 py-0.5 rounded whitespace-nowrap">{sc.key}</dt>
                    <dd className="text-muted-foreground text-right">{sc.desc}</dd>
                  </div>
                ))}
              </dl>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ===========================================================================
// Canvas helpers
// ===========================================================================

function drawCheckerboard(ctx: CanvasRenderingContext2D, w: number, h: number, cell: number) {
  const c1 = "#e0e0e0";
  const c2 = "#c0c0c0";
  for (let y = 0; y < h; y += cell) {
    for (let x = 0; x < w; x += cell) {
      ctx.fillStyle = ((Math.floor(x / cell) + Math.floor(y / cell)) % 2 === 0) ? c1 : c2;
      ctx.fillRect(x, y, cell, cell);
    }
  }
}

function drawTinted(
  ctx: CanvasRenderingContext2D,
  rgba: Uint8Array,
  width: number,
  height: number,
  scale: number,
  tint: string,
  opacity: number,
) {
  const [tr, tg, tb] = hexToRgba(tint);
  const src = document.createElement("canvas");
  src.width = width;
  src.height = height;
  const sctx = src.getContext("2d");
  if (!sctx) return;
  const imgData = sctx.createImageData(width, height);
  for (let i = 0; i < rgba.length; i += 4) {
    const a = rgba[i + 3]! / 255;
    imgData.data[i] = tr;
    imgData.data[i + 1] = tg;
    imgData.data[i + 2] = tb;
    imgData.data[i + 3] = Math.round(a * opacity * 255);
  }
  sctx.putImageData(imgData, 0, 0);
  const prevAlpha = ctx.globalAlpha;
  ctx.globalAlpha = 1;
  ctx.drawImage(src, 0, 0, width * scale, height * scale);
  ctx.globalAlpha = prevAlpha;
}
