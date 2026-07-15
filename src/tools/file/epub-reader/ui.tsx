"use client";
import React, { useState, useCallback, useEffect, useMemo, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { CopyButton, ErrorBanner, EmptyState, ShareButton } from "../../_shared";
import { toast } from "sonner";
import {
  parseEpub, searchBook, readingProgress, extractBody, sanitizeChapterHtml,
  loadBookmarks, saveBookmark, getBookmark, clearBookmarks,
  loadHistory, saveToHistory, clearHistory,
  formatBytes, buildShareUrl,
  type EpubBook, type SearchResult, type EpubBookmark, type EpubHistoryEntry,
} from "./logic";
import {
  Upload, Book, ChevronLeft, ChevronRight, Search, Bookmark as BookmarkIcon,
  History, Info, Type, Sun, Moon, List, X,
} from "lucide-react";

type FontSize = "sm" | "md" | "lg" | "xl" | "2xl";
type FontFamily = "serif" | "sans" | "mono";
type Theme = "light" | "dark";

const FONT_SIZE_PX: Record<FontSize, number> = { sm: 14, md: 16, lg: 18, xl: 20, "2xl": 24 };
const FONT_FAMILY_STACK: Record<FontFamily, string> = {
  serif: 'Georgia, "Times New Roman", serif',
  sans: 'system-ui, -apple-system, "Segoe UI", sans-serif',
  mono: '"Courier New", Consolas, monospace',
};

export default function EpubReader() {
  const [book, setBook] = useState<EpubBook | null>(null);
  const [currentChapter, setCurrentChapter] = useState(0);
  const [fontSize, setFontSize] = useState<FontSize>("md");
  const [fontFamily, setFontFamily] = useState<FontFamily>("serif");
  const [theme, setTheme] = useState<Theme>("light");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [showSearch, setShowSearch] = useState(false);
  const [showSidebar, setShowSidebar] = useState(false);
  const [showInfo, setShowInfo] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [working, setWorking] = useState(false);
  const [history, setHistory] = useState<EpubHistoryEntry[]>(() => loadHistory());
  const [bookmarks, setBookmarks] = useState<EpubBookmark[]>(() => loadBookmarks());
  const [showHistory, setShowHistory] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const progress = book ? readingProgress(currentChapter, book.chapters.length) : 0;

  const handleFile = useCallback(async (file: File | null | undefined) => {
    if (!file) return;
    setWorking(true);
    setError(null);
    try {
      const buf = new Uint8Array(await file.arrayBuffer());
      const parsed = await parseEpub(buf, file.name, file.size);
      setBook(parsed);
      // Resume from bookmark
      const mark = getBookmark(file.name);
      setCurrentChapter(mark?.chapterIndex ?? 0);
      setHistory(saveToHistory({
        fileName: file.name,
        title: parsed.metadata.title,
        author: parsed.metadata.author,
        chapterCount: parsed.chapters.length,
        fileSize: file.size,
        openedAt: new Date().toISOString(),
      }));
      toast.success(`Loaded "${parsed.metadata.title}" — ${parsed.chapters.length} chapters`);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setWorking(false);
    }
  }, []);

  const onInput = useCallback((files: FileList | null) => {
    if (files && files.length > 0) handleFile(files[0]);
  }, [handleFile]);

  // Keyboard navigation
  useEffect(() => {
    if (!book) return;
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA") return;
      if (e.key === "ArrowLeft") {
        setCurrentChapter((c) => Math.max(0, c - 1));
      } else if (e.key === "ArrowRight") {
        setCurrentChapter((c) => Math.min(book.chapters.length - 1, c + 1));
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [book]);

  const handleSearch = useCallback(() => {
    if (!book || !searchQuery.trim()) {
      setSearchResults([]);
      return;
    }
    const results = searchBook(book, searchQuery.trim());
    setSearchResults(results);
    if (results.length === 0) {
      toast.info("No matches found");
    } else {
      toast.success(`Found ${results.length} matches`);
    }
  }, [book, searchQuery]);

  const toggleBookmark = useCallback(() => {
    if (!book) return;
    saveBookmark({
      fileName: book.fileName,
      title: book.metadata.title,
      chapterIndex: currentChapter,
      totalChapters: book.chapters.length,
      savedAt: new Date().toISOString(),
    });
    setBookmarks(loadBookmarks());
    toast.success(`Bookmarked chapter ${currentChapter + 1}: ${book.chapters[currentChapter].title}`);
  }, [book, currentChapter]);

  const chapterHtml = useMemo(() => {
    if (!book) return "";
    const chapter = book.chapters[currentChapter];
    if (!chapter) return "";
    return sanitizeChapterHtml(extractBody(chapter.content));
  }, [book, currentChapter]);

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4">
          <input
            type="file"
            accept=".epub,application/epub+zip"
            onChange={(e) => onInput(e.target.files)}
            className="hidden"
            id="epub-input"
            aria-label="Choose an EPUB file"
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
            <p className="text-sm font-medium">Drop an EPUB file here or click to browse</p>
            <p className="mt-1 text-xs text-muted-foreground">EPUB 2 & 3 · chapters · TOC · search · 100% local</p>
          </button>
        </CardContent>
      </Card>

      {working && (
        <Card><CardContent className="p-4 text-center text-sm text-muted-foreground">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent mx-auto mb-2" />
          Parsing EPUB...
        </CardContent></Card>
      )}

      {error && <ErrorBanner message={error} />}

      {book && !working && (
        <>
          <Card>
            <CardContent className="p-3">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  <Book className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  <p className="text-xs font-medium truncate">{book.metadata.title}</p>
                  <Badge variant="outline" className="text-[10px]">{book.chapters.length} ch</Badge>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <button
                    type="button"
                    onClick={() => setShowSidebar(!showSidebar)}
                    className="p-1.5 rounded-md hover:bg-accent cursor-pointer"
                    aria-label="Toggle chapter list"
                    title="Chapter list"
                  >
                    <List className="h-3.5 w-3.5" />
                  </button>
                  <select
                    value={fontSize}
                    onChange={(e) => setFontSize(e.target.value as FontSize)}
                    className="h-7 rounded-md border border-input bg-background px-1 text-[10px] cursor-pointer"
                    aria-label="Font size"
                  >
                    <option value="sm">A-</option>
                    <option value="md">A</option>
                    <option value="lg">A+</option>
                    <option value="xl">A++</option>
                    <option value="2xl">A+++</option>
                  </select>
                  <select
                    value={fontFamily}
                    onChange={(e) => setFontFamily(e.target.value as FontFamily)}
                    className="h-7 rounded-md border border-input bg-background px-1 text-[10px] cursor-pointer"
                    aria-label="Font family"
                  >
                    <option value="serif">Serif</option>
                    <option value="sans">Sans</option>
                    <option value="mono">Mono</option>
                  </select>
                  <button
                    type="button"
                    onClick={() => setTheme(theme === "light" ? "dark" : "light")}
                    className="p-1.5 rounded-md hover:bg-accent cursor-pointer"
                    aria-label="Toggle theme"
                    title={theme === "light" ? "Dark mode" : "Light mode"}
                  >
                    {theme === "light" ? <Moon className="h-3.5 w-3.5" /> : <Sun className="h-3.5 w-3.5" />}
                  </button>
                  <button
                    type="button"
                    onClick={toggleBookmark}
                    className="p-1.5 rounded-md hover:bg-accent cursor-pointer"
                    aria-label="Bookmark chapter"
                    title="Bookmark chapter"
                  >
                    <BookmarkIcon className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowInfo(!showInfo)}
                    className="p-1.5 rounded-md hover:bg-accent cursor-pointer"
                    aria-label="Book info"
                    title="Book info"
                  >
                    <Info className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-4">
            {showSidebar && (
              <Card>
                <CardContent className="p-3">
                  <div className="flex items-center justify-between mb-2">
                    <Label className="text-xs font-semibold">Chapters</Label>
                    <button
                      type="button"
                      onClick={() => setShowSidebar(false)}
                      className="text-muted-foreground hover:text-foreground cursor-pointer"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <div className="max-h-[500px] overflow-y-auto space-y-0.5">
                    {book.chapters.map((ch, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => { setCurrentChapter(i); setShowSidebar(false); }}
                        className={`w-full text-left px-2 py-1 rounded-md text-xs cursor-pointer ${i === currentChapter ? "bg-primary text-primary-foreground" : "hover:bg-accent"}`}
                      >
                        <span className="text-[10px] opacity-60 mr-1">{i + 1}.</span>
                        <span className="truncate">{ch.title}</span>
                      </button>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            <Card>
              <CardContent className="p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => setCurrentChapter((c) => Math.max(0, c - 1))}
                    disabled={currentChapter === 0}
                    className="p-1.5 rounded-md hover:bg-accent disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                    aria-label="Previous chapter"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <p className="text-xs font-medium truncate flex-1 text-center">
                    Chapter {currentChapter + 1} of {book.chapters.length}: {book.chapters[currentChapter]?.title}
                  </p>
                  <button
                    type="button"
                    onClick={() => setCurrentChapter((c) => Math.min(book.chapters.length - 1, c + 1))}
                    disabled={currentChapter === book.chapters.length - 1}
                    className="p-1.5 rounded-md hover:bg-accent disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                    aria-label="Next chapter"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>

                <div
                  className={`rounded-md border p-4 max-h-[60vh] overflow-y-auto ${theme === "dark" ? "bg-zinc-900 text-zinc-100 border-zinc-800" : "bg-white text-zinc-900 border-zinc-200"}`}
                  style={{
                    fontSize: `${FONT_SIZE_PX[fontSize]}px`,
                    fontFamily: FONT_FAMILY_STACK[fontFamily],
                    lineHeight: 1.6,
                  }}
                  // Render chapter HTML. Scripts/handlers stripped via sanitizeChapterHtml.
                   
                  dangerouslySetInnerHTML={{ __html: chapterHtml }}
                />

                <div className="space-y-1">
                  <div className="h-1 w-full overflow-hidden rounded-full bg-muted">
                    <div className="h-full bg-primary transition-all" style={{ width: `${progress}%` }} />
                  </div>
                  <p className="text-[10px] text-muted-foreground text-center">{progress}% read · chapter {currentChapter + 1} / {book.chapters.length}</p>
                </div>

                <CopyButton
                  getText={() => {
                    const ch = book.chapters[currentChapter];
                    const text = ch.content.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
                    return text;
                  }}
                  label="Copy chapter text"
                  size="sm"
                />
              </CardContent>
            </Card>
          </div>

          {showInfo && (
            <Card>
              <CardContent className="p-4 space-y-2">
                <Label className="text-sm font-semibold">Book info</Label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  <InfoRow label="Title" value={book.metadata.title} />
                  <InfoRow label="Author" value={book.metadata.author} />
                  <InfoRow label="Language" value={book.metadata.language || "(none)"} />
                  <InfoRow label="Identifier" value={book.metadata.identifier || "(none)"} />
                  <InfoRow label="Publisher" value={book.metadata.publisher || "(none)"} />
                  <InfoRow label="Rights" value={book.metadata.rights || "(none)"} />
                  <InfoRow label="Chapter count" value={String(book.chapters.length)} />
                  <InfoRow label="File size" value={formatBytes(book.fileSize)} />
                  <InfoRow label="Filename" value={book.fileName} />
                </div>
                {book.metadata.description && (
                  <div>
                    <Label className="text-xs text-muted-foreground">Description</Label>
                    <p className="text-xs mt-1">{book.metadata.description}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          <Card>
            <CardContent className="p-4 space-y-2">
              <div className="flex items-center gap-2">
                <Search className="h-4 w-4 text-muted-foreground" />
                <Label className="text-sm font-semibold">Search within book</Label>
              </div>
              <div className="flex gap-2">
                <Input
                  placeholder="Search text..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") handleSearch(); }}
                  className="text-sm"
                  aria-label="Search query"
                />
                <button
                  type="button"
                  onClick={handleSearch}
                  className="px-3 h-9 rounded-md bg-primary text-primary-foreground text-xs hover:bg-primary/90 cursor-pointer"
                >
                  Search
                </button>
              </div>
              {searchResults.length > 0 && (
                <div className="space-y-1 max-h-[200px] overflow-y-auto">
                  {searchResults.slice(0, 30).map((r, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => { setCurrentChapter(r.chapterIndex); setShowSidebar(false); }}
                      className="w-full text-left p-2 rounded-md border hover:bg-accent cursor-pointer"
                    >
                      <p className="text-[10px] text-muted-foreground">Ch {r.chapterIndex + 1}: {r.chapterTitle}</p>
                      <p className="text-xs">{r.snippet}</p>
                    </button>
                  ))}
                  {searchResults.length > 30 && (
                    <p className="text-[10px] text-muted-foreground text-center">+ {searchResults.length - 30} more matches</p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {bookmarks.length > 0 && (
            <Card>
              <CardContent className="p-4 space-y-2">
                <Label className="text-sm font-semibold">Bookmarks ({bookmarks.length})</Label>
                <div className="space-y-1 max-h-[150px] overflow-y-auto">
                  {bookmarks.map((b, i) => (
                    <div key={i} className="grid grid-cols-[1fr_auto] gap-2 items-center text-xs py-1 border-b border-border/40 last:border-0">
                      <div className="min-w-0">
                        <p className="truncate font-medium">{b.title}</p>
                        <p className="text-[10px] text-muted-foreground">ch {b.chapterIndex + 1} / {b.totalChapters} · {new Date(b.savedAt).toLocaleString()}</p>
                      </div>
                      {book && b.fileName === book.fileName && (
                        <button
                          type="button"
                          onClick={() => setCurrentChapter(b.chapterIndex)}
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
                          <p className="font-medium truncate">{h.title}</p>
                          <p className="text-[10px] text-muted-foreground">{h.author} · {h.chapterCount} ch · {formatBytes(h.fileSize)} · {new Date(h.openedAt).toLocaleString()}</p>
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
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-[10px]">
                <Shortcut keys="← / →" desc="Prev / Next chapter" />
                <Shortcut keys="Click chapter" desc="Jump to chapter" />
                <Shortcut keys="Search box" desc="Find within book" />
              </div>
              <div className="flex flex-wrap gap-2 mt-2">
                <ShareButton getUrl={() => buildShareUrl(fontSize, fontFamily, theme)} label="Share reader settings" size="sm" />
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {!book && !error && !working && (
        <EmptyState
          title="Open an EPUB ebook"
          hint="Read EPUB 2 & 3 in your browser — chapters, TOC, search, bookmarks. 100% local."
          icon={<Type className="h-8 w-8" />}
        />
      )}

      <Card>
        <CardContent className="p-4">
          <p className="text-xs text-muted-foreground">
            <strong className="text-foreground">Privacy:</strong> your EPUB is parsed entirely in the browser. Chapter content never leaves your device. Only book titles + current chapter indices are saved to localStorage.
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
