"use client";

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
} from "lucide-react";
import palettesData from "./palettes.json";
import {
  createCanvas,
  cloneCanvas,
  addLayer,
  removeLayer,
  reorderLayers,
  setLayerOpacity,
  setLayerVisible,
  setLayerLocked,
  addFrame,
  removeFrame,
  reorderFrames,
  setFrameDelay,
  setPixel,
  setPixelInPlace,
  getPixel,
  drawLine,
  drawRect,
  drawEllipse,
  floodFill,
  floodFillGlobal,
  applyMirrorX,
  applyMirrorY,
  applyPixelPerfect,
  bresenhamLine,
  compositeFrameRgba,
  parseGplPalette,
  parsePalPalette,
  parseHexPalette,
  paletteSwap,
  applyTaggedMask,
  importSpriteSheet,
  exportAsepriteJson,
  serializeProject,
  deserializeProject,
  pushHistory,
  undo as undoHistory,
  redo as redoHistory,
  stampTile,
  ditherAt,
  hexToRgba,
  rgbaToHex,
  shadeColor,
  nearestPaletteIndex,
  autosaveProject,
  loadAutosave,
  clearAutosave,
  exportPng,
  exportGif,
  exportApng,
  exportSheetBundle,
  type PixelCanvas,
  type Palette,
  type Tool,
  type Point,
  type Selection,
  type TileVariant,
} from "./logic";

const BUNDLED_PALETTES = palettesData as Palette[];

const CANVAS_MAX_DIM = 1024;
const RECENT_COLORS_MAX = 20;
const AUTOSAVE_DEBOUNCE_MS = 5000;

type ExportFormat = "png" | "gif" | "apng" | "sheet" | "project";

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
// Helper: trigger a browser download for a Blob
// ===========================================================================
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
  const [history, setHistory] = useState(() => pushHistory({ stack: [], index: -1 }, canvas));
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

  // ---- Onion skin ---------------------------------------------------------
  const [onionSkin, setOnionSkin] = useState<OnionSkinSettings>(DEFAULT_ONION);

  // ---- Playback -----------------------------------------------------------
  const [playing, setPlaying] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1);
  const playTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ---- Tile-flip brush ----------------------------------------------------
  const [tileVariant, setTileVariant] = useState<TileVariant>(0);

  // ---- UI panels ----------------------------------------------------------
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [showOnionPanel, setShowOnionPanel] = useState(false);
  const [showNewCanvas, setShowNewCanvas] = useState(false);
  const [newWidth, setNewWidth] = useState(16);
  const [newHeight, setNewHeight] = useState(16);
  const [activePaletteIdx, setActivePaletteIdx] = useState(0);
  const [paletteSwapPreview, setPaletteSwapPreview] = useState<Palette | null>(null);

  // ---- Import -------------------------------------------------------------
  const [importSheetOpen, setImportSheetOpen] = useState(false);
  const [importFrameW, setImportFrameW] = useState(16);
  const [importFrameH, setImportFrameH] = useState(16);
  const importFileRef = useRef<HTMLInputElement>(null);
  const paletteFileRef = useRef<HTMLInputElement>(null);

  // ---- Export -------------------------------------------------------------
  const [exportBusy, setExportBusy] = useState<ExportFormat | null>(null);
  const [exportScale, setExportScale] = useState(8);
  const [exportCols, setExportCols] = useState(4);
  const [exportRows, setExportRows] = useState(2);

  // ---- Error --------------------------------------------------------------
  const [error, setError] = useState<string | null>(null);

  // ---- Refs ---------------------------------------------------------------
  const displayCanvasRef = useRef<HTMLCanvasElement>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const previewCanvasRef = useRef<HTMLCanvasElement>(null);

  // =========================================================================
  // Load autosave on mount
  // =========================================================================
  useEffect(() => {
    let mounted = true;
    (async () => {
      const saved = await loadAutosave();
      if (saved && mounted) {
        setCanvas(saved);
        setHistory(pushHistory({ stack: [], index: -1 }, saved));
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
    // Render at device pixels (CSS pixels × devicePixelRatio).
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
    // Checkerboard background for transparency.
    drawCheckerboard(ctx, displayW, displayH, Math.max(8, zoom));
    // Onion skin (previous frames).
    if (onionSkin.enabled) {
      const frameIdx = canvas.frames.findIndex((f) => f.id === canvas.activeFrameId);
      if (frameIdx >= 0) {
        for (let i = 1; i <= onionSkin.framesBack; i++) {
          const prev = canvas.frames[frameIdx - i];
          if (!prev) break;
          const rgba = compositeFrameRgba(canvas, prev.id);
          const tint = onionSkin.prevColor;
          drawTinted(ctx, rgba, canvas.width, canvas.height, zoom, tint, onionSkin.opacity / i);
        }
        for (let i = 1; i <= onionSkin.framesBack; i++) {
          const next = canvas.frames[frameIdx + i];
          if (!next) break;
          const rgba = compositeFrameRgba(canvas, next.id);
          const tint = onionSkin.nextColor;
          drawTinted(ctx, rgba, canvas.width, canvas.height, zoom, tint, onionSkin.opacity / i);
        }
      }
    }
    // Composite the active frame.
    const rgba = compositeFrameRgba(canvas, canvas.activeFrameId);
    const src = document.createElement("canvas");
    src.width = canvas.width;
    src.height = canvas.height;
    const sctx = src.getContext("2d");
    if (sctx) {
      sctx.putImageData(new ImageData(new Uint8ClampedArray(rgba), canvas.width, canvas.height), 0, 0);
      ctx.drawImage(src, 0, 0, displayW, displayH);
    }
    // Selection rectangle.
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
    // Grid overlay.
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
    const scale = Math.floor(size / canvas.width);
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
  // History helpers
  // =========================================================================
  const commit = useCallback(
    (next: PixelCanvas) => {
      setCanvas(next);
      setHistory((h) => pushHistory(h, next));
      // Track recent colors.
      if (next.palette !== canvas.palette) {
        // palette changed — no recent color update
      }
    },
    [canvas],
  );

  const handleUndo = useCallback(() => {
    const { canvas: prev, history: next } = undoHistory(history);
    if (prev) {
      setCanvas(prev);
      setHistory(next);
    }
  }, [history]);

  const handleRedo = useCallback(() => {
    const { canvas: fwd, history: next } = redoHistory(history);
    if (fwd) {
      setCanvas(fwd);
      setHistory(next);
    }
  }, [history]);

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
  // Pointer handling for the canvas
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

  const paintPoint = useCallback(
    (p: Point) => {
      // Mutate canvas in-place via setPixelInPlace.
      const [r, g, b, a] = hexToRgba(tool === "eraser" ? "#000000" : color);
      const actualA = tool === "eraser" ? 0 : 255;
      let points: Point[] = [{ x: p.x, y: p.y }];
      if (mirrorX) points = applyMirrorX(canvas, points);
      if (mirrorY) points = applyMirrorY(canvas, points);
      // Brush size > 1 → paint a square around the point.
      const offset = Math.floor((brushSize - 1) / 2);
      for (const pt of points) {
        for (let dy = 0; dy < brushSize; dy++) {
          for (let dx = 0; dx < brushSize; dx++) {
            setPixelInPlace(canvas, activeLayer.id, canvas.activeFrameId, pt.x - offset + dx, pt.y - offset + dy, [r, g, b, actualA]);
          }
        }
      }
    },
    [canvas, tool, color, brushSize, mirrorX, mirrorY, activeLayer],
  );

  const paintStroke = useCallback(
    (from: Point, to: Point) => {
      let points = bresenhamLine(from.x, from.y, to.x, to.y);
      if (mirrorX) points = applyMirrorX(canvas, points);
      if (mirrorY) points = applyMirrorY(canvas, points);
      const [r, g, b] = hexToRgba(color);
      const a = tool === "eraser" ? 0 : 255;
      const offset = Math.floor((brushSize - 1) / 2);
      for (const pt of points) {
        for (let dy = 0; dy < brushSize; dy++) {
          for (let dx = 0; dx < brushSize; dx++) {
            setPixelInPlace(canvas, activeLayer.id, canvas.activeFrameId, pt.x - offset + dx, pt.y - offset + dy, [r, g, b, a]);
          }
        }
      }
    },
    [canvas, tool, color, brushSize, mirrorX, mirrorY, activeLayer],
  );

  const onPointerDownCanvas = useCallback(
    (e: React.PointerEvent) => {
      // Palm rejection: ignore touch with no pressure if not from a stylus.
      if (e.pointerType === "touch" && e.pressure === 0 && e.buttons === 0) return;
      e.preventDefault();
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
      // Eyedropper: pick color and switch back to pencil.
      if (tool === "eyedropper") {
        const p = canvasCoordsFromEvent(e);
        const [r, g, b, a] = getPixel(canvas, activeLayer.id, canvas.activeFrameId, p.x, p.y);
        if (a > 0) {
          const hex = rgbaToHex(r, g, b);
          setColor(hex);
          addRecentColor(hex);
          toast.success(`Picked ${hex}`);
        }
        return;
      }
      // Pan tool or space-pan.
      if (tool === "move" || e.button === 1 || e.shiftKey) {
        setIsPanning(true);
        panStartRef.current = { x: e.clientX, y: e.clientY, px: pan.x, py: pan.y };
        return;
      }
      // Selection tool.
      if (tool === "select-rect") {
        const p = canvasCoordsFromEvent(e);
        selectStartRef.current = p;
        setSelection({ x0: p.x, y0: p.y, x1: p.x, y1: p.y });
        return;
      }
      const p = canvasCoordsFromEvent(e);
      setIsDrawing(true);
      lastDrawnPointRef.current = p;
      drawingStrokeRef.current = [p];
      if (tool === "pencil" || tool === "eraser" || tool === "dither" || tool === "tile-flip") {
        if (tool === "dither" && !ditherAt(p.x, p.y, "bayer2", 0.5)) return;
        if (tool === "tile-flip") {
          // Stamp a 1x1 colored tile with the chosen variant.
          const tile: [number, number, number, number][][] = [
            [[...hexToRgba(color).slice(0, 3) as [number, number, number], 255]],
          ];
          const stamped = stampTile(canvas, activeLayer.id, canvas.activeFrameId, tile, p.x, p.y, tileVariant);
          commit(stamped);
          return;
        }
        paintPoint(p);
        // Trigger re-render.
        setCanvas((c) => ({ ...c }));
      } else if (tool === "bucket" || tool === "bucket-global") {
        const [r, g, b] = hexToRgba(color);
        const next = tool === "bucket"
          ? floodFill(canvas, activeLayer.id, canvas.activeFrameId, p.x, p.y, [r, g, b, 255])
          : floodFillGlobal(canvas, activeLayer.id, canvas.activeFrameId, p.x, p.y, [r, g, b, 255]);
        commit(next);
        addRecentColor(color);
      } else if (tool === "line" || tool === "rect" || tool === "rect-filled" || tool === "ellipse" || tool === "ellipse-filled") {
        drawingPreviewRef.current = {
          type: tool === "line" ? "line" : tool.startsWith("rect") ? "rect" : "ellipse",
          start: p,
          end: p,
          filled: tool.endsWith("filled"),
        };
      }
    },
    [tool, canvas, activeLayer, canvasCoordsFromEvent, pan, color, brushSize, mirrorX, mirrorY, tileVariant, paintPoint, commit, addRecentColor],
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
        setSelection({ ...selection, x1: p.x, y1: p.y });
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
        if (last && ditherAt(p.x, p.y, "bayer2", 0.5)) {
          paintStroke(last, p);
          lastDrawnPointRef.current = p;
        }
        setCanvas((c) => ({ ...c }));
      } else if (drawingPreviewRef.current) {
        drawingPreviewRef.current.end = p;
        setCanvas((c) => ({ ...c }));
      }
    },
    [isPanning, isDrawing, pan, selection, tool, canvasCoordsFromEvent, paintStroke],
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
      // Finalize the stroke — apply pixel-perfect then commit to history.
      if (tool === "pencil" || tool === "eraser" || tool === "dither") {
        let stroke = drawingStrokeRef.current;
        if (pixelPerfect && tool === "pencil" && stroke.length > 2) {
          // Re-draw with pixel-perfect correction.
          // First, clear the in-progress stroke by re-compositing from a snapshot taken
          // before the stroke began. Simplest approach: walk the corrected stroke and
          // paint each pixel. Since we painted in-place during the stroke, we may have
          // extra pixels; the corrected stroke is a subset, so just paint it again (no
          // harm done). For the rare case of removed pixels, we accept the imperfection.
          const corrected = applyPixelPerfect(stroke);
          // Already-painted pixels remain. Re-paint to ensure continuity.
          for (let i = 1; i < corrected.length; i++) {
            paintStroke(corrected[i - 1]!, corrected[i]!);
          }
        }
        drawingStrokeRef.current = [];
        if (tool !== "eraser") addRecentColor(color);
        commit(cloneCanvas(canvas));
      } else if (drawingPreviewRef.current) {
        const preview = drawingPreviewRef.current;
        const [r, g, b] = hexToRgba(color);
        let next = canvas;
        if (preview.type === "line") {
          next = drawLine(canvas, activeLayer.id, canvas.activeFrameId, preview.start.x, preview.start.y, preview.end.x, preview.end.y, [r, g, b, 255]);
        } else if (preview.type === "rect") {
          next = drawRect(canvas, activeLayer.id, canvas.activeFrameId, preview.start.x, preview.start.y, preview.end.x, preview.end.y, [r, g, b, 255], preview.filled);
        } else if (preview.type === "ellipse") {
          next = drawEllipse(canvas, activeLayer.id, canvas.activeFrameId, preview.start.x, preview.start.y, preview.end.x, preview.end.y, [r, g, b, 255], preview.filled);
        }
        // Apply mirror symmetry for shape tools.
        if (mirrorX || mirrorY) {
          const cx2 = (canvas.width - 1) / 2;
          const cy2 = (canvas.height - 1) / 2;
          const mirrorStart = { x: mirrorX ? Math.round(2 * cx2 - preview.start.x) : preview.start.x, y: mirrorY ? Math.round(2 * cy2 - preview.start.y) : preview.start.y };
          const mirrorEnd = { x: mirrorX ? Math.round(2 * cx2 - preview.end.x) : preview.end.x, y: mirrorY ? Math.round(2 * cy2 - preview.end.y) : preview.end.y };
          if (preview.type === "line") {
            next = drawLine(next, activeLayer.id, canvas.activeFrameId, mirrorStart.x, mirrorStart.y, mirrorEnd.x, mirrorEnd.y, [r, g, b, 255]);
          } else if (preview.type === "rect") {
            next = drawRect(next, activeLayer.id, canvas.activeFrameId, mirrorStart.x, mirrorStart.y, mirrorEnd.x, mirrorEnd.y, [r, g, b, 255], preview.filled);
          } else if (preview.type === "ellipse") {
            next = drawEllipse(next, activeLayer.id, canvas.activeFrameId, mirrorStart.x, mirrorStart.y, mirrorEnd.x, mirrorEnd.y, [r, g, b, 255], preview.filled);
          }
        }
        drawingPreviewRef.current = null;
        addRecentColor(color);
        commit(next);
      }
    },
    [isPanning, isDrawing, tool, pixelPerfect, canvas, activeLayer, color, mirrorX, mirrorY, paintStroke, commit, addRecentColor],
  );

  // =========================================================================
  // Render the preview overlay for line/rect/ellipse during drag
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
    ctx.fillStyle = color + "80"; // 50% alpha
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

  // Clear overlay when not drawing.
  useEffect(() => {
    if (isDrawing) return;
    const overlay = overlayCanvasRef.current;
    if (!overlay) return;
    const ctx = overlay.getContext("2d");
    if (ctx) ctx.clearRect(0, 0, overlay.width, overlay.height);
  }, [isDrawing]);

  // =========================================================================
  // Keyboard shortcuts
  // =========================================================================
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // Ignore when typing in inputs.
      const target = e.target as HTMLElement;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)) return;
      // Ctrl/Cmd modifiers → undo/redo.
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
          const idx = canvas.frames.findIndex((f) => f.id === canvas.activeFrameId);
          if (idx > 0) setCanvas((c) => ({ ...c, activeFrameId: c.frames[idx - 1]!.id }));
          break;
        }
        case "arrowright": {
          const idx = canvas.frames.findIndex((f) => f.id === canvas.activeFrameId);
          if (idx < canvas.frames.length - 1) setCanvas((c) => ({ ...c, activeFrameId: c.frames[idx + 1]!.id }));
          break;
        }
        case " ": if (!isDrawing) { setTool("move"); } break;
        case "?": setShowShortcuts((s) => !s); break;
        default: break;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [canvas, color, secondaryColor, handleUndo, handleRedo, isDrawing]);

  // =========================================================================
  // Layer / frame operations
  // =========================================================================
  const handleAddLayer = () => commit(addLayer(canvas));
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
  const handleAddFrame = () => commit(addFrame(canvas));
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

  // =========================================================================
  // New canvas / clear
  // =========================================================================
  const handleNewCanvas = () => {
    if (newWidth < 1 || newHeight < 1 || newWidth > CANVAS_MAX_DIM || newHeight > CANVAS_MAX_DIM) {
      toast.error(`Dimensions must be 1-${CANVAS_MAX_DIM}`);
      return;
    }
    const fresh = createCanvas(newWidth, newHeight, BUNDLED_PALETTES[activePaletteIdx]);
    setCanvas(fresh);
    setHistory(pushHistory({ stack: [], index: -1 }, fresh));
    setShowNewCanvas(false);
    void clearAutosave();
    toast.success(`Created ${newWidth}x${newHeight} canvas`);
  };

  // =========================================================================
  // Palette import
  // =========================================================================
  const handlePaletteFile = async (file: File) => {
    const text = await file.text();
    const lower = file.name.toLowerCase();
    let result;
    if (lower.endsWith(".gpl")) result = parseGplPalette(text);
    else if (lower.endsWith(".pal")) result = parsePalPalette(text);
    else if (lower.endsWith(".hex") || lower.endsWith(".txt")) result = parseHexPalette(text);
    else {
      // Try all three.
      result = parseHexPalette(text);
      if (!result.ok) result = parseGplPalette(text);
      if (!result.ok) result = parsePalPalette(text);
    }
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    const next = cloneCanvas(canvas);
    next.palette = result.output;
    commit(next);
    toast.success(`Imported ${result.output.colors.length}-color palette "${result.output.name}"`);
  };

  // =========================================================================
  // Sprite sheet import
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
      const result = importSpriteSheet(
        { width: c.width, height: c.height, data: new Uint8Array(imageData.data.buffer) },
        importFrameW,
        importFrameH,
        BUNDLED_PALETTES[activePaletteIdx],
      );
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setCanvas(result.output);
      setHistory(pushHistory({ stack: [], index: -1 }, result.output));
      setImportSheetOpen(false);
      toast.success(`Imported ${result.output.frames.length} frames from sheet`);
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  // =========================================================================
  // Project save / open
  // =========================================================================
  const handleSaveProject = () => {
    const json = serializeProject(canvas);
    downloadBlob(new Blob([json], { type: "application/json" }), "pixel-art.pam.json");
    toast.success("Saved project file");
  };
  const handleOpenProject = async (file: File) => {
    const text = await file.text();
    const result = deserializeProject(text);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    setCanvas(result.output);
    setHistory(pushHistory({ stack: [], index: -1 }, result.output));
    toast.success("Opened project");
  };

  // =========================================================================
  // Exports
  // =========================================================================
  const handleExport = async (fmt: ExportFormat) => {
    setExportBusy(fmt);
    setError(null);
    try {
      if (fmt === "png") {
        const result = await exportPng(canvas, canvas.activeFrameId, exportScale);
        if (!result.ok) throw new Error(result.error);
        downloadBlob(result.output, `pixel-art-${canvas.activeFrameId}.png`);
        toast.success("Exported PNG");
      } else if (fmt === "gif") {
        const result = await exportGif(canvas, { loop: true, dispose: true });
        if (!result.ok) throw new Error(result.error);
        downloadBlob(result.output, "pixel-art.gif");
        toast.success("Exported GIF");
      } else if (fmt === "apng") {
        const result = await exportApng(canvas, { cnum: 0 });
        if (!result.ok) throw new Error(result.error);
        downloadBlob(result.output, "pixel-art.apng");
        toast.success("Exported APNG");
      } else if (fmt === "sheet") {
        const result = await exportSheetBundle(canvas, exportCols, exportRows, exportScale);
        if (!result.ok) throw new Error(result.error);
        downloadBlob(result.output, "pixel-art-sheet.zip");
        toast.success("Exported sprite sheet bundle (PNG + Aseprite JSON + project)");
      } else if (fmt === "project") {
        handleSaveProject();
      }
    } catch (e) {
      setError((e as Error).message);
      toast.error((e as Error).message);
    } finally {
      setExportBusy(null);
    }
  };

  // =========================================================================
  // Palette swap live preview
  // =========================================================================
  useEffect(() => {
    if (!paletteSwapPreview) return;
    // Live preview: swap colors in-place but don't commit until user confirms.
    const swapped = paletteSwap(canvas, paletteSwapPreview);
    setCanvas(swapped);
  }, [paletteSwapPreview]);

  const handlePaletteSwapApply = () => {
    if (paletteSwapPreview) {
      commit(cloneCanvas(canvas));
      setPaletteSwapPreview(null);
      toast.success("Palette swap applied");
    }
  };

  const handlePaletteSwapCancel = () => {
    // Revert by re-swapping with the original palette.
    if (paletteSwapPreview) {
      // Restore from the last history entry.
      handleUndo();
      setPaletteSwapPreview(null);
    }
  };

  // =========================================================================
  // Render
  // =========================================================================
  return (
    <div className="space-y-3">
      {/* ===== Top toolbar: tools / brush / symmetry / grid ===== */}
      <Card>
        <CardContent className="p-2 flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1" role="toolbar" aria-label="Drawing tools">
            <ToolButton active={tool === "pencil"} onClick={() => setTool("pencil")} title="Pencil (B)"><Pencil className="h-4 w-4" /></ToolButton>
            <ToolButton active={tool === "eraser"} onClick={() => setTool("eraser")} title="Eraser (E)"><Eraser className="h-4 w-4" /></ToolButton>
            <ToolButton active={tool === "bucket"} onClick={() => setTool("bucket")} title="Bucket fill (G)"><PaintBucket className="h-4 w-4" /></ToolButton>
            <ToolButton active={tool === "bucket-global"} onClick={() => setTool("bucket-global")} title="Global bucket fill"><Droplets className="h-4 w-4" /></ToolButton>
            <ToolButton active={tool === "line"} onClick={() => setTool("line")} title="Line (L)"><Minus className="h-4 w-4" /></ToolButton>
            <ToolButton active={tool === "rect"} onClick={() => setTool("rect")} title="Rectangle outline (R)"><Square className="h-4 w-4" /></ToolButton>
            <ToolButton active={tool === "rect-filled"} onClick={() => setTool("rect-filled")} title="Filled rectangle"><Grid2x2 className="h-4 w-4" /></ToolButton>
            <ToolButton active={tool === "ellipse"} onClick={() => setTool("ellipse")} title="Ellipse outline (O)"><Circle className="h-4 w-4" /></ToolButton>
            <ToolButton active={tool === "ellipse-filled"} onClick={() => setTool("ellipse-filled")} title="Filled ellipse"><Circle className="h-4 w-4 opacity-50" /></ToolButton>
            <ToolButton active={tool === "eyedropper"} onClick={() => setTool("eyedropper")} title="Eyedropper (I)"><Pipette className="h-4 w-4" /></ToolButton>
            <ToolButton active={tool === "select-rect"} onClick={() => setTool("select-rect")} title="Rectangle select (S)"><Copy className="h-4 w-4" /></ToolButton>
            <ToolButton active={tool === "move"} onClick={() => setTool("move")} title="Pan / move (M or Space)"><Move className="h-4 w-4" /></ToolButton>
            <ToolButton active={tool === "dither"} onClick={() => setTool("dither")} title="Dithering brush"><Sparkles className="h-4 w-4" /></ToolButton>
            <ToolButton active={tool === "tile-flip"} onClick={() => setTool("tile-flip")} title="Tile-flip brush"><Stamp className="h-4 w-4" /></ToolButton>
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
          {tool === "tile-flip" && (
            <div className="flex items-center gap-1.5 ml-2">
              <Label className="text-xs text-muted-foreground">Tile variant</Label>
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
          <div className="ml-auto flex items-center gap-1.5">
            <Button variant="outline" size="sm" onClick={handleUndo} disabled={history.index <= 0} className="gap-1.5"><Undo2 className="h-3.5 w-3.5" /> Undo</Button>
            <Button variant="outline" size="sm" onClick={handleRedo} disabled={history.index >= history.stack.length - 1} className="gap-1.5"><Redo2 className="h-3.5 w-3.5" /> Redo</Button>
            <Button variant="outline" size="sm" onClick={() => setShowShortcuts(true)} className="gap-1.5"><Keyboard className="h-3.5 w-3.5" /> ?</Button>
          </div>
        </CardContent>
      </Card>

      {/* ===== Main 3-column layout ===== */}
      <div className="grid grid-cols-1 lg:grid-cols-[220px_1fr_240px] gap-3">
        {/* ===== Left sidebar: layers + palette ===== */}
        <div className="space-y-3">
          {/* Layers panel */}
          <Card>
            <CardContent className="p-3">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-xs font-semibold uppercase text-muted-foreground flex items-center gap-1.5"><LayersIcon className="h-3.5 w-3.5" /> Layers</h3>
                <Button variant="ghost" size="icon" onClick={handleAddLayer} title="Add layer" aria-label="Add layer" className="h-6 w-6"><Plus className="h-3.5 w-3.5" /></Button>
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
                      title={layer.locked ? "Unlock" : "Lock"}
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
                      className="w-12 h-1"
                      aria-label={`Opacity for ${layer.name}`}
                    />
                    <div className="flex items-center">
                      <button type="button" className="p-0.5 hover:bg-background rounded" onClick={(e) => { e.stopPropagation(); handleMoveLayer(layer.id, 1); }} aria-label="Move up"><ChevronUp className="h-3 w-3" /></button>
                      <button type="button" className="p-0.5 hover:bg-background rounded" onClick={(e) => { e.stopPropagation(); handleMoveLayer(layer.id, -1); }} aria-label="Move down"><ChevronDown className="h-3 w-3" /></button>
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
                <Button variant="ghost" size="icon" onClick={() => paletteFileRef.current?.click()} title="Import .gpl/.pal/.hex" aria-label="Import palette file" className="h-6 w-6"><Upload className="h-3.5 w-3.5" /></Button>
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
                        const next = cloneCanvas(canvas);
                        if (!next.palette.tags) next.palette.tags = {};
                        const cur = next.palette.tags[i];
                        if (cur === "background") delete next.palette.tags[i];
                        else next.palette.tags[i] = "background";
                        commit(next);
                        toast.success(cur === "background" ? "Untagged color" : "Tagged as background (transparent on mask)");
                      }}
                      title={`${c}${tag ? ` — tagged ${tag} (right-click to toggle)` : " (right-click to tag as background)"}`}
                      className="aspect-square rounded-sm border border-border hover:scale-110 transition-transform"
                      style={{ backgroundColor: c }}
                      aria-label={`Color ${c}${tag ? `, tagged ${tag}` : ""}`}
                    />
                  );
                })}
              </div>
              {/* Current color picker + secondary */}
              <div className="flex items-center gap-2 mb-2">
                <input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="h-8 w-8 rounded border bg-transparent cursor-pointer" aria-label="Primary color" />
                <input type="color" value={secondaryColor} onChange={(e) => setSecondaryColor(e.target.value)} className="h-8 w-8 rounded border bg-transparent cursor-pointer" aria-label="Secondary color" />
                <Button variant="outline" size="icon" onClick={() => { setColor(secondaryColor); setSecondaryColor(color); }} title="Swap colors (X)" aria-label="Swap colors" className="h-8 w-8"><ArrowDownUp className="h-3.5 w-3.5" /></Button>
                <Input type="text" value={color} onChange={(e) => setColor(e.target.value)} className="h-8 flex-1 text-xs font-mono" aria-label="Hex color" />
              </div>
              {/* Shading helper */}
              <div className="mb-2">
                <Label className="text-xs text-muted-foreground">Shading</Label>
                <div className="flex gap-0.5 mt-1">
                  {Object.entries(shadeColor(color)).map(([k, v]) => (
                    <button key={k} type="button" onClick={() => setColor(v)} title={`${k}: ${v}`} className="flex-1 h-6 rounded-sm border border-border hover:scale-105 transition-transform" style={{ backgroundColor: v }} aria-label={`Shade ${k}`} />
                  ))}
                </div>
              </div>
              {/* Recent colors */}
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
              {/* Palette swap live preview */}
              <div className="mt-2 border-t pt-2">
                <Label className="text-xs text-muted-foreground">Palette swap (live)</Label>
                <select
                  aria-label="Swap to palette"
                  value=""
                  onChange={(e) => {
                    const idx = Number(e.target.value);
                    if (BUNDLED_PALETTES[idx]) setPaletteSwapPreview(BUNDLED_PALETTES[idx]!);
                  }}
                  className="w-full h-8 rounded-md border bg-background px-2 text-xs mt-1"
                >
                  <option value="">Pick palette to preview…</option>
                  {BUNDLED_PALETTES.map((p, i) => (
                    <option key={p.name} value={i}>{p.name}</option>
                  ))}
                </select>
                {paletteSwapPreview && (
                  <div className="flex gap-1 mt-1">
                    <Button size="sm" onClick={handlePaletteSwapApply} className="h-7 text-xs">Apply</Button>
                    <Button size="sm" variant="outline" onClick={handlePaletteSwapCancel} className="h-7 text-xs">Cancel</Button>
                  </div>
                )}
                <Button variant="outline" size="sm" onClick={() => commit(applyTaggedMask(canvas))} className="w-full mt-2 h-7 text-xs gap-1">
                  <Sparkles className="h-3 w-3" /> Apply tagged mask
                </Button>
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
                style={{ cursor: tool === "move" || isPanning ? "grab" : tool === "eyedropper" ? "crosshair" : "crosshair" }}
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
          {/* Export toolbar */}
          <Card>
            <CardContent className="p-2 flex flex-wrap items-center gap-2">
              <Label className="text-xs text-muted-foreground">Scale</Label>
              <Input type="number" min={1} max={32} value={exportScale} onChange={(e) => setExportScale(Math.max(1, Math.min(32, Number(e.target.value) || 1)))} className="h-8 w-14" aria-label="Export scale" />
              <Label className="text-xs text-muted-foreground">Sheet cols×rows</Label>
              <Input type="number" min={1} max={32} value={exportCols} onChange={(e) => setExportCols(Math.max(1, Number(e.target.value) || 1))} className="h-8 w-12" aria-label="Sheet columns" />
              <span className="text-xs">×</span>
              <Input type="number" min={1} max={32} value={exportRows} onChange={(e) => setExportRows(Math.max(1, Number(e.target.value) || 1))} className="h-8 w-12" aria-label="Sheet rows" />
              <div className="flex-1" />
              <Button size="sm" onClick={() => handleExport("png")} disabled={exportBusy !== null} className="gap-1.5">
                <ImageIcon className="h-3.5 w-3.5" /> {exportBusy === "png" ? "…" : "PNG"}
              </Button>
              <Button size="sm" variant="outline" onClick={() => handleExport("gif")} disabled={exportBusy !== null} className="gap-1.5">
                <ImageIcon className="h-3.5 w-3.5" /> {exportBusy === "gif" ? "…" : "GIF"}
              </Button>
              <Button size="sm" variant="outline" onClick={() => handleExport("apng")} disabled={exportBusy !== null} className="gap-1.5">
                <ImageIcon className="h-3.5 w-3.5" /> {exportBusy === "apng" ? "…" : "APNG"}
              </Button>
              <Button size="sm" variant="outline" onClick={() => handleExport("sheet")} disabled={exportBusy !== null} className="gap-1.5">
                <FileJson className="h-3.5 w-3.5" /> {exportBusy === "sheet" ? "…" : "Sheet + JSON"}
              </Button>
              <Button size="sm" variant="outline" onClick={() => handleExport("project")} disabled={exportBusy !== null} className="gap-1.5">
                <Save className="h-3.5 w-3.5" /> Project
              </Button>
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
                </div>
              </div>
              {/* Live preview */}
              <div className="flex flex-col items-center gap-1 mb-2">
                <canvas ref={previewCanvasRef} className="border border-border rounded" style={{ imageRendering: "pixelated" }} />
                <span className="text-xs text-muted-foreground">Live preview</span>
              </div>
              {/* Playback speed */}
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
              {/* Frame list */}
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
                    <button type="button" className="p-0.5 hover:bg-background rounded" onClick={(e) => { e.stopPropagation(); handleMoveFrame(f.id, -1); }} aria-label="Move frame left"><ChevronLeft className="h-3 w-3" /></button>
                    <button type="button" className="p-0.5 hover:bg-background rounded" onClick={(e) => { e.stopPropagation(); handleMoveFrame(f.id, 1); }} aria-label="Move frame right"><ChevronRight className="h-3 w-3" /></button>
                    <button type="button" className="p-0.5 hover:bg-background rounded" onClick={(e) => { e.stopPropagation(); handleRemoveFrame(f.id); }} aria-label="Delete frame"><Trash2 className="h-3 w-3" /></button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Onion skin config */}
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

      {/* ===== Import sheet dialog ===== */}
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
            No images leave your device. Project files autosave to IndexedDB every 5 seconds. GIF/APNG encoders (gifenc + UPNG) lazy-load
            only when you export, keeping the initial bundle small.
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
        { key: "I", desc: "Eyedropper" },
        { key: "L", desc: "Line" },
        { key: "R", desc: "Rectangle outline" },
        { key: "O", desc: "Ellipse outline" },
        { key: "M", desc: "Pan / move" },
        { key: "S", desc: "Rectangle select" },
        { key: "X", desc: "Swap primary/secondary colors" },
        { key: "[ / ]", desc: "Decrease / increase brush size" },
        { key: "+ / -", desc: "Zoom in / out" },
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
      ],
    },
    {
      title: "Timeline",
      shortcuts: [
        { key: "← / →", desc: "Previous / next frame" },
        { key: "Play button", desc: "Play / pause animation" },
        { key: "Onion skin", desc: "Show prev/next frames tinted" },
      ],
    },
  ];
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose} role="dialog" aria-modal="true" aria-label="Keyboard shortcuts">
      <div className="bg-background rounded-lg border shadow-lg max-w-2xl w-full max-h-[80vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-sm font-semibold flex items-center gap-1.5"><Keyboard className="h-4 w-4" /> Keyboard Shortcuts</h2>
          <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close"><Trash2 className="h-4 w-4" /></Button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4">
          {sections.map((s) => (
            <div key={s.title}>
              <h3 className="text-xs font-semibold uppercase text-muted-foreground mb-2">{s.title}</h3>
              <dl className="space-y-1">
                {s.shortcuts.map((sc) => (
                  <div key={sc.key} className="flex items-center justify-between text-xs">
                    <dt className="font-mono bg-muted px-1.5 py-0.5 rounded">{sc.key}</dt>
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
