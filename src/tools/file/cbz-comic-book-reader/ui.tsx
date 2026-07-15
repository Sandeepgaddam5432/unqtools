"use client";
import React, { useState, useCallback, useEffect, useRef, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { CopyButton, DownloadButton, ErrorBanner, EmptyState, ShareButton } from "../../_shared";
import { toast } from "sonner";
import {
  extractPages, buildInfo, buildNavigationState, nextPage, prevPage,
  readingProgress, pagesForMode, createZipFromPages,
  loadBookmarks, saveBookmark, getBookmark, clearBookmarks,
  loadHistory, saveToHistory, clearHistory,
  formatBytes, buildShareUrl, revokePages,
  type ExtractedPage, type ReadingMode, type FitMode, type CbzInfo, type Bookmark, type CbzHistoryEntry,
} from "./logic";
import {
  Upload, BookOpen, ChevronLeft, ChevronRight, ZoomIn, ZoomOut,
  Maximize, Bookmark as BookmarkIcon, History, Info, Download, Layers,
} from "lucide-react";

export default function CbzComicBookReader() {
  const [info, setInfo] = useState<CbzInfo | null>(null);
  const [currentPage, setCurrentPage] = useState(0);
  const [mode, setMode] = useState<ReadingMode>("single");
  const [fit, setFit] = useState<FitMode>("original");
  const [zoom, setZoom] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [working, setWorking] = useState(false);
  const [history, setHistory] = useState<CbzHistoryEntry[]>(() => loadHistory());
  const [bookmarks, setBookmarks] = useState<Bookmark[]>(() => loadBookmarks());
  const [showInfo, setShowInfo] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const nav = useMemo(
    () => info ? buildNavigationState(currentPage, info.pageCount) : null,
    [info, currentPage],
  );

  const progress = info ? readingProgress(currentPage, info.pageCount) : 0;

  const handleFile = useCallback(async (file: File | null | undefined) => {
    if (!file) return;
    setWorking(true);
    setError(null);
    try {
      const buf = new Uint8Array(await file.arrayBuffer());
      const pages = extractPages(buf);
      if (pages.length === 0) {
        throw new Error("No image pages found in CBZ. The file may use unsupported compression (only STORE is supported).");
      }
      if (info) revokePages(info.pages);
      const newInfo = buildInfo(file.name, file.size, pages);
      setInfo(newInfo);
      // Resume from bookmark if exists
      const mark = getBookmark(file.name);
      setCurrentPage(mark?.page ?? 0);
      setZoom(1);
      setHistory(saveToHistory({
        fileName: file.name,
        fileSize: file.size,
        pageCount: newInfo.pageCount,
        openedAt: new Date().toISOString(),
      }));
      toast.success(`Loaded ${file.name} — ${newInfo.pageCount} pages`);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setWorking(false);
    }
  }, [info]);

  const onInput = useCallback((files: FileList | null) => {
    if (files && files.length > 0) handleFile(files[0]);
  }, [handleFile]);

  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen?.();
    } else {
      document.exitFullscreen?.();
    }
  }, []);

  const toggleBookmark = useCallback(() => {
    if (!info) return;
    const existing = getBookmark(info.fileName);
    if (existing && existing.page === currentPage) {
      toast.info(`Bookmark stays at page ${existing.page + 1}`);
    } else {
      saveBookmark({
        fileName: info.fileName,
        page: currentPage,
        totalPages: info.pageCount,
        savedAt: new Date().toISOString(),
      });
      setBookmarks(loadBookmarks());
      toast.success(`Bookmarked page ${currentPage + 1}`);
    }
  }, [info, currentPage]);

  const jumpToPage = useCallback((page: number) => {
    if (!info) return;
    const target = Math.max(0, Math.min(page - 1, info.pageCount - 1));
    setCurrentPage(target);
  }, [info]);

  // Keyboard navigation
  useEffect(() => {
    if (!info) return;
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA") return;
      if (e.key === "ArrowLeft") {
        setCurrentPage((p) => prevPage(p, info.pageCount, mode));
      } else if (e.key === "ArrowRight" || (e.key === " " && !e.shiftKey)) {
        e.preventDefault();
        setCurrentPage((p) => nextPage(p, info.pageCount, mode));
      } else if (e.key === " " && e.shiftKey) {
        e.preventDefault();
        setCurrentPage((p) => prevPage(p, info.pageCount, mode));
      } else if (e.key === "Home") {
        setCurrentPage(0);
      } else if (e.key === "End") {
        setCurrentPage(info.pageCount - 1);
      } else if (e.key === "+" || e.key === "=") {
        setZoom((z) => Math.min(z + 0.25, 4));
      } else if (e.key === "-") {
        setZoom((z) => Math.max(z - 0.25, 0.25));
      } else if (e.key === "0") {
        setZoom(1);
      } else if (e.key.toLowerCase() === "f") {
        toggleFullscreen();
      } else if (e.key.toLowerCase() === "b") {
        toggleBookmark();
      } else if (e.key.toLowerCase() === "d") {
        setMode((m) => m === "double" ? "single" : "double");
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [info, mode, toggleFullscreen, toggleBookmark]);

  // Track fullscreen changes
  useEffect(() => {
    const onFsChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onFsChange);
    return () => document.removeEventListener("fullscreenchange", onFsChange);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (info) revokePages(info.pages);
    };
  }, [info]);

  const downloadAllPages = useCallback(async () => {
    if (!info) return;
    const blob = await createZipFromPages(info.pages);
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${info.fileName.replace(/\.cbz$/i, "")}-pages.zip`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    toast.success("Downloaded all pages as ZIP");
  }, [info]);

  const displayedPages = info ? pagesForMode(currentPage, info.pageCount, mode) : [];

  return (
    <div className="space-y-4" ref={containerRef}>
      <Card>
        <CardContent className="p-4">
          <input
            type="file"
            accept=".cbz,.zip,application/zip"
            onChange={(e) => onInput(e.target.files)}
            className="hidden"
            id="cbz-input"
            aria-label="Choose a CBZ file"
            ref={fileInputRef}
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => { e.preventDefault(); onInput(e.dataTransfer.files); }}
            className="w-full rounded-xl border-2 border-dashed border-border p-8 text-center hover:border-primary/50 hover:bg-primary/5 transition-colors cursor-pointer"
          >
            <Upload className="mx-auto mb-2 h-8 w-8 text-muted-foreground" />
            <p className="text-sm font-medium">Drop a CBZ file here or click to browse</p>
            <p className="mt-1 text-xs text-muted-foreground">JPEG · PNG · WebP · GIF · 100% local</p>
          </button>
        </CardContent>
      </Card>

      {working && (
        <Card><CardContent className="p-4 text-center text-sm text-muted-foreground">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent mx-auto mb-2" />
          Extracting pages...
        </CardContent></Card>
      )}

      {error && <ErrorBanner message={error} />}

      {info && nav && !working && (
        <>
          <Card>
            <CardContent className="p-3">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  <BookOpen className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  <p className="text-xs font-medium truncate">{info.fileName}</p>
                  <Badge variant="outline" className="text-[10px]">{info.pageCount} pages</Badge>
                  <Badge variant="outline" className="text-[10px]">{formatBytes(info.fileSize)}</Badge>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <button type="button" onClick={() => setMode("single")} className={`p-1.5 rounded-md cursor-pointer ${mode === "single" ? "bg-primary text-primary-foreground" : "hover:bg-accent"}`} aria-label="Single page" title="Single page">
                    <Layers className="h-3.5 w-3.5" />
                  </button>
                  <button type="button" onClick={() => setMode("double")} className={`px-2 py-1 text-[10px] rounded-md cursor-pointer ${mode === "double" ? "bg-primary text-primary-foreground" : "hover:bg-accent"}`} aria-label="Double page" title="Double page">
                    2x
                  </button>
                  <button type="button" onClick={() => setMode("scroll")} className={`px-2 py-1 text-[10px] rounded-md cursor-pointer ${mode === "scroll" ? "bg-primary text-primary-foreground" : "hover:bg-accent"}`} aria-label="Scroll mode" title="Scroll mode">
                    Scroll
                  </button>
                  <div className="w-px h-6 bg-border mx-1" />
                  <button type="button" onClick={() => setZoom((z) => Math.max(z - 0.25, 0.25))} className="p-1.5 rounded-md hover:bg-accent cursor-pointer" aria-label="Zoom out" title="Zoom out">
                    <ZoomOut className="h-3.5 w-3.5" />
                  </button>
                  <span className="text-[10px] font-mono w-10 text-center">{Math.round(zoom * 100)}%</span>
                  <button type="button" onClick={() => setZoom((z) => Math.min(z + 0.25, 4))} className="p-1.5 rounded-md hover:bg-accent cursor-pointer" aria-label="Zoom in" title="Zoom in">
                    <ZoomIn className="h-3.5 w-3.5" />
                  </button>
                  <button type="button" onClick={() => setZoom(1)} className="px-2 py-1 text-[10px] rounded-md hover:bg-accent cursor-pointer" title="Reset zoom">0</button>
                  <div className="w-px h-6 bg-border mx-1" />
                  <select
                    value={fit}
                    onChange={(e) => setFit(e.target.value as FitMode)}
                    className="h-7 rounded-md border border-input bg-background px-1 text-[10px] cursor-pointer"
                    aria-label="Fit mode"
                  >
                    <option value="original">Original</option>
                    <option value="width">Fit width</option>
                    <option value="height">Fit height</option>
                  </select>
                  <div className="w-px h-6 bg-border mx-1" />
                  <button type="button" onClick={toggleBookmark} className="p-1.5 rounded-md hover:bg-accent cursor-pointer" aria-label="Bookmark" title="Bookmark (B)">
                    <BookmarkIcon className="h-3.5 w-3.5" />
                  </button>
                  <button type="button" onClick={toggleFullscreen} className="p-1.5 rounded-md hover:bg-accent cursor-pointer" aria-label="Fullscreen" title="Fullscreen (F)">
                    <Maximize className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              {mode === "scroll" ? (
                <div className="max-h-[70vh] overflow-y-auto space-y-2">
                  {info.pages.map((p, i) => (
                     
                    <img key={i} src={p.url} alt={`Page ${i + 1}`} className="w-full rounded-md border" loading="lazy" />
                  ))}
                </div>
              ) : (
                <div className="flex items-center justify-center gap-2 min-h-[400px]">
                  <button
                    type="button"
                    onClick={() => setCurrentPage((p) => prevPage(p, info.pageCount, mode))}
                    disabled={!nav.canGoPrev}
                    className="p-2 rounded-md hover:bg-accent disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                    aria-label="Previous page"
                  >
                    <ChevronLeft className="h-6 w-6" />
                  </button>
                  <div className="flex gap-2 justify-center">
                    {displayedPages.map((idx) => (
                       
                      <img
                        key={idx}
                        src={info.pages[idx].url}
                        alt={`Page ${idx + 1}`}
                        className="rounded-md border max-w-full"
                        style={{
                          maxHeight: fit === "height" ? "70vh" : "70vh",
                          maxWidth: fit === "width" ? "100%" : "auto",
                          width: fit === "width" ? "100%" : "auto",
                          transform: `scale(${zoom})`,
                          transformOrigin: "center center",
                        }}
                      />
                    ))}
                  </div>
                  <button
                    type="button"
                    onClick={() => setCurrentPage((p) => nextPage(p, info.pageCount, mode))}
                    disabled={!nav.canGoNext}
                    className="p-2 rounded-md hover:bg-accent disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                    aria-label="Next page"
                  >
                    <ChevronRight className="h-6 w-6" />
                  </button>
                </div>
              )}

              <div className="mt-3 flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-2">
                  <Label className="text-xs text-muted-foreground">Page</Label>
                  <Input
                    type="number"
                    min={1}
                    max={info.pageCount}
                    value={currentPage + 1}
                    onChange={(e) => jumpToPage(Number(e.target.value))}
                    className="h-7 w-16 text-xs font-mono"
                    aria-label="Jump to page"
                  />
                  <span className="text-xs text-muted-foreground">/ {info.pageCount}</span>
                </div>
                <div className="flex-1 min-w-[100px] max-w-md mx-2">
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                    <div className="h-full bg-primary transition-all" style={{ width: `${progress}%` }} />
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-1 text-center">{progress}% read</p>
                </div>
                <div className="flex gap-1">
                  <button
                    type="button"
                    onClick={() => setShowInfo(!showInfo)}
                    className="p-1.5 rounded-md hover:bg-accent cursor-pointer"
                    aria-label="File info"
                    title="File info"
                  >
                    <Info className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={downloadAllPages}
                    className="p-1.5 rounded-md hover:bg-accent cursor-pointer"
                    aria-label="Download all pages"
                    title="Download all pages as ZIP"
                  >
                    <Download className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            </CardContent>
          </Card>

          {showInfo && (
            <Card>
              <CardContent className="p-4 space-y-2">
                <Label className="text-sm font-semibold">File info</Label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  <InfoRow label="Filename" value={info.fileName} />
                  <InfoRow label="File size" value={formatBytes(info.fileSize)} />
                  <InfoRow label="Page count" value={String(info.pageCount)} />
                  <InfoRow label="Image bytes" value={formatBytes(info.totalImageBytes)} />
                  <InfoRow label="Image types" value={Object.entries(info.imageTypes).map(([k, v]) => `${k}: ${v}`).join(", ")} />
                  <InfoRow label="Compression" value="STORE (no recompression)" />
                </div>
              </CardContent>
            </Card>
          )}

          {bookmarks.length > 0 && (
            <Card>
              <CardContent className="p-4 space-y-2">
                <Label className="text-sm font-semibold">Bookmarks ({bookmarks.length})</Label>
                <div className="space-y-1 max-h-[150px] overflow-y-auto">
                  {bookmarks.map((b, i) => (
                    <div key={i} className="grid grid-cols-[1fr_auto] gap-2 items-center text-xs py-1 border-b border-border/40 last:border-0">
                      <div className="min-w-0">
                        <p className="truncate font-medium">{b.fileName}</p>
                        <p className="text-[10px] text-muted-foreground">page {b.page + 1} / {b.totalPages} · {new Date(b.savedAt).toLocaleString()}</p>
                      </div>
                      {info && b.fileName === info.fileName && (
                        <button
                          type="button"
                          onClick={() => { setCurrentPage(b.page); toast.info(`Jumped to page ${b.page + 1}`); }}
                          className="text-[10px] text-primary hover:underline cursor-pointer"
                        >
                          Jump
                        </button>
                      )}
                    </div>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() => { clearBookmarks(); setBookmarks([]); toast.success("Cleared bookmarks"); }}
                  className="text-[10px] text-red-600 hover:underline cursor-pointer"
                >
                  Clear all
                </button>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardContent className="p-4 space-y-2">
              <button
                type="button"
                onClick={() => setShowHistory(!showHistory)}
                className="text-xs text-muted-foreground hover:text-foreground cursor-pointer inline-flex items-center gap-1"
              >
                <History className="h-3 w-3" /> History ({history.length})
              </button>
              {showHistory && (
                <>
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-semibold">Recently opened</Label>
                    {history.length > 0 && (
                      <button
                        type="button"
                        onClick={() => { clearHistory(); setHistory([]); }}
                        className="text-[10px] text-red-600 hover:underline cursor-pointer"
                      >
                        Clear
                      </button>
                    )}
                  </div>
                  {history.length === 0 ? (
                    <p className="text-xs text-muted-foreground">No history yet.</p>
                  ) : (
                    <div className="space-y-1 max-h-[200px] overflow-y-auto">
                      {history.map((h, i) => (
                        <div key={i} className="text-xs py-1 border-b border-border/40 last:border-0">
                          <p className="font-medium truncate">{h.fileName}</p>
                          <p className="text-[10px] text-muted-foreground">{h.pageCount} pages · {formatBytes(h.fileSize)} · {new Date(h.openedAt).toLocaleString()}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 space-y-2">
              <Label className="text-xs font-semibold">Keyboard shortcuts</Label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[10px]">
                <Shortcut keys="← / →" desc="Prev / Next page" />
                <Shortcut keys="Space" desc="Next page" />
                <Shortcut keys="Home / End" desc="First / Last page" />
                <Shortcut keys="+ / -" desc="Zoom in / out" />
                <Shortcut keys="0" desc="Reset zoom" />
                <Shortcut keys="F" desc="Fullscreen" />
                <Shortcut keys="B" desc="Bookmark" />
                <Shortcut keys="D" desc="Toggle double-page" />
              </div>
              <div className="flex flex-wrap gap-2 mt-2">
                <ShareButton getUrl={() => buildShareUrl(mode, fit)} label="Share reader settings" size="sm" />
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {!info && !error && !working && (
        <EmptyState
          title="Open a CBZ comic"
          hint="Read comics in your browser — extract pages, navigate, zoom, bookmark. 100% local."
          icon={<BookOpen className="h-8 w-8" />}
        />
      )}

      <Card>
        <CardContent className="p-4">
          <p className="text-xs text-muted-foreground">
            <strong className="text-foreground">Privacy:</strong> your CBZ is parsed entirely in the browser. Image pages never leave your device. Only book names + bookmark page numbers are saved to localStorage.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[120px_1fr] gap-2 items-baseline border-b border-border/40 py-1 last:border-0">
      <span className="text-[10px] text-muted-foreground">{label}</span>
      <span className="break-all font-mono text-[11px]">{value}</span>
    </div>
  );
}

function Shortcut({ keys, desc }: { keys: string; desc: string }) {
  return (
    <div className="rounded-md border p-1.5">
      <p className="font-mono font-semibold">{keys}</p>
      <p className="text-muted-foreground">{desc}</p>
    </div>
  );
}
