"use client";
import React, { useState, useCallback, useMemo, useEffect, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ErrorBanner, EmptyState, ShareButton, CopyButton } from "../../_shared";
import { toast } from "sonner";
import {
  parseFb2, isFb2Xml, searchBook, readingProgress, formatBytes,
  loadHistory, saveToHistory, clearHistory,
  loadBookmarks, saveBookmark, getBookmark,
  buildShareUrl,
  type Fb2Book, type SearchResult, type Fb2HistoryEntry,
} from "./logic";
import {
  Upload, Book, BookOpen, ChevronLeft, ChevronRight, Search,
  History, X, Bookmark, BookmarkCheck, Type, Sun, Moon, Copy,
} from "lucide-react";

type FontSize = "sm" | "md" | "lg" | "xl" | "2xl";
type Theme = "light" | "dark";

const FONT_SIZE_CLASSES: Record<FontSize, string> = {
  sm: "text-sm",
  md: "text-base",
  lg: "text-lg",
  xl: "text-xl",
  "2xl": "text-2xl",
};

const FONT_SIZE_PX: Record<FontSize, string> = {
  sm: "14px",
  md: "16px",
  lg: "18px",
  xl: "20px",
  "2xl": "24px",
};

export default function Fb2Reader() {
  const [book, setBook] = useState<Fb2Book | null>(null);
  const [currentChapter, setCurrentChapter] = useState(0);
  const [fontSize, setFontSize] = useState<FontSize>("md");
  const [theme, setTheme] = useState<Theme>("light");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [showSearch, setShowSearch] = useState(false);
  const [showChapterList, setShowChapterList] = useState(true);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<Fb2HistoryEntry[]>(() => loadHistory());
  const [showHistory, setShowHistory] = useState(false);
  const [hasBookmark, setHasBookmark] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFiles = useCallback(async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    const file = fileList[0]!;
    setError(null);
    setWorking(true);
    try {
      const text = await file.text();
      if (!isFb2Xml(text)) {
        setError(`${file.name}: not a valid FB2 file (missing <FictionBook> root element).`);
        setBook(null);
        return;
      }
      const parsed = parseFb2(text, file.name, file.size);
      setBook(parsed);
      setCurrentChapter(0);
      setHistory(saveToHistory({
        fileName: file.name,
        title: parsed.metadata.title,
        author: parsed.metadata.authors.map((a) => a.fullName).join(", ") || "(unknown)",
        chapterCount: parsed.chapters.length,
        fileSize: file.size,
        openedAt: new Date().toISOString(),
      }));
      const bm = getBookmark(file.name);
      if (bm) {
        setHasBookmark(true);
        setCurrentChapter(Math.min(bm.chapterIndex, parsed.chapters.length - 1));
        toast.info(`Resumed at chapter ${bm.chapterIndex + 1}: ${parsed.chapters[bm.chapterIndex]?.title ?? ""}`);
      } else {
        setHasBookmark(false);
      }
      toast.success(`Loaded ${parsed.metadata.title}`);
    } catch (e) {
      setError(`${file.name}: ${(e as Error).message}`);
      setBook(null);
    } finally {
      setWorking(false);
    }
  }, []);

  const doSearch = useCallback(() => {
    if (!book) return;
    const results = searchBook(book, searchQuery);
    setSearchResults(results);
    if (results.length > 0) {
      toast.success(`Found ${results.length} match${results.length === 1 ? "" : "es"}`);
    } else if (searchQuery.trim()) {
      toast.info("No matches found");
    }
  }, [book, searchQuery]);

  const goToChapter = useCallback((idx: number) => {
    if (!book) return;
    setCurrentChapter(Math.max(0, Math.min(idx, book.chapters.length - 1)));
  }, [book]);

  const bookmarkChapter = useCallback(() => {
    if (!book) return;
    saveBookmark({
      fileName: book.fileName,
      title: book.metadata.title,
      author: book.metadata.authors.map((a) => a.fullName).join(", "),
      chapterIndex: currentChapter,
      totalChapters: book.chapters.length,
      savedAt: new Date().toISOString(),
    });
    setHasBookmark(true);
    toast.success(`Bookmarked chapter ${currentChapter + 1}`);
  }, [book, currentChapter]);

  // Keyboard navigation
  useEffect(() => {
    if (!book) return;
    const handler = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName === "INPUT" || (e.target as HTMLElement)?.tagName === "TEXTAREA") return;
      if (e.key === "ArrowLeft") goToChapter(currentChapter - 1);
      if (e.key === "ArrowRight") goToChapter(currentChapter + 1);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [book, currentChapter, goToChapter]);

  const progress = book ? readingProgress(currentChapter, book.chapters.length) : 0;
  const currentChapterData = book?.chapters[currentChapter];

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4">
          <input
            type="file"
            accept=".fb2,.xml,text/xml,application/xml"
            onChange={(e) => handleFiles(e.target.files)}
            className="hidden"
            id="fb2-input"
            aria-label="Choose an .fb2 file"
            ref={fileInputRef}
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => { e.preventDefault(); handleFiles(e.dataTransfer.files); }}
            className="w-full rounded-xl border-2 border-dashed border-border p-8 text-center hover:border-primary/50 hover:bg-primary/5 transition-colors cursor-pointer"
          >
            <Upload className="mx-auto mb-2 h-8 w-8 text-muted-foreground" />
            <p className="text-sm font-medium">Drop an .fb2 file here or click to browse</p>
            <p className="mt-1 text-xs text-muted-foreground">Pure-JS FB2 XML parser · chapter navigation · bookmarks · search · dark mode</p>
          </button>
        </CardContent>
      </Card>

      {working && (
        <Card>
          <CardContent className="p-4 text-sm text-muted-foreground">
            Parsing FB2 book...
          </CardContent>
        </Card>
      )}

      {book && currentChapterData && (
        <>
          <Card>
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="min-w-0">
                  <h2 className="text-lg font-semibold truncate">{book.metadata.title}</h2>
                  <p className="text-xs text-muted-foreground truncate">
                    {book.metadata.authors.map((a) => a.fullName).join(", ") || "(unknown author)"}
                    {book.metadata.lang && ` · ${book.metadata.lang}`}
                    {book.metadata.genres.length > 0 && ` · ${book.metadata.genres.join(", ")}`}
                    {" · "}{formatBytes(book.fileSize)}
                  </p>
                </div>
                <div className="flex gap-1 flex-shrink-0">
                  <button
                    type="button"
                    onClick={() => setFontSize((s) => s === "sm" ? "sm" : ({ "2xl": "xl", xl: "lg", lg: "md", md: "sm" }[s] as FontSize))}
                    className="p-1.5 rounded-md hover:bg-accent cursor-pointer"
                    aria-label="Decrease font size"
                    title="Smaller text"
                  >
                    <Type className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setFontSize((s) => ({ sm: "md", md: "lg", lg: "xl", xl: "2xl", "2xl": "2xl" }[s] as FontSize))}
                    className="p-1.5 rounded-md hover:bg-accent cursor-pointer"
                    aria-label="Increase font size"
                    title="Larger text"
                  >
                    <span className="text-xs font-bold">A+</span>
                  </button>
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
                    onClick={bookmarkChapter}
                    className="p-1.5 rounded-md hover:bg-accent cursor-pointer"
                    aria-label="Bookmark chapter"
                    title="Bookmark this chapter"
                  >
                    {hasBookmark ? <BookmarkCheck className="h-3.5 w-3.5 text-emerald-600" /> : <Bookmark className="h-3.5 w-3.5" />}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowChapterList(!showChapterList)}
                    className="p-1.5 rounded-md hover:bg-accent cursor-pointer"
                    aria-label="Toggle chapter list"
                    title="Chapter list"
                  >
                    <BookOpen className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowSearch(!showSearch)}
                    className="p-1.5 rounded-md hover:bg-accent cursor-pointer"
                    aria-label="Toggle search"
                    title="Search within book"
                  >
                    <Search className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>

              {/* Reading progress bar */}
              <div className="flex items-center gap-2">
                <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full bg-primary transition-all"
                    style={{ width: `${progress}%` }}
                  />
                </div>
                <span className="text-[10px] text-muted-foreground flex-shrink-0">{progress}%</span>
              </div>

              {/* Search bar */}
              {showSearch && (
                <div className="flex gap-2">
                  <Input
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") doSearch(); }}
                    placeholder="Search within book..."
                    className="h-8"
                    aria-label="Search query"
                  />
                  <button
                    type="button"
                    onClick={doSearch}
                    className="px-3 h-8 rounded-md bg-primary text-primary-foreground text-xs cursor-pointer"
                  >
                    Search
                  </button>
                </div>
              )}

              {searchResults.length > 0 && (
                <div className="max-h-[150px] overflow-y-auto rounded-md border p-2 space-y-1">
                  {searchResults.slice(0, 20).map((r, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => { goToChapter(r.chapterIndex); setShowSearch(false); }}
                      className="block w-full text-left text-xs p-1 rounded hover:bg-accent cursor-pointer"
                    >
                      <span className="font-semibold">{r.chapterTitle}:</span>
                      <span className="text-muted-foreground ml-1">{r.snippet}</span>
                    </button>
                  ))}
                  {searchResults.length > 20 && (
                    <p className="text-[10px] text-muted-foreground text-center">+{searchResults.length - 20} more</p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 lg:grid-cols-[200px_1fr] gap-4">
            {showChapterList && (
              <Card className="h-fit">
                <CardContent className="p-3">
                  <Label className="text-xs font-semibold mb-2 block">Chapters ({book.chapters.length})</Label>
                  <div className="max-h-[500px] overflow-y-auto space-y-0.5">
                    {book.chapters.map((ch, i) => (
                      <button
                        key={ch.id}
                        type="button"
                        onClick={() => goToChapter(i)}
                        className={`block w-full text-left text-xs px-2 py-1 rounded cursor-pointer ${
                          i === currentChapter
                            ? "bg-primary text-primary-foreground font-medium"
                            : "hover:bg-accent"
                        }`}
                        style={{ paddingLeft: `${ch.level * 12 + 8}px` }}
                      >
                        <span className="text-[10px] opacity-70">{i + 1}.</span> {ch.title}
                      </button>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                  <h3 className="text-sm font-semibold">{currentChapterData.title}</h3>
                  <div className="flex items-center gap-1">
                    <CopyButton
                      getText={() => currentChapterData.text}
                      label="Copy"
                      size="sm"
                    />
                    <button
                      type="button"
                      onClick={() => goToChapter(currentChapter - 1)}
                      disabled={currentChapter === 0}
                      className="p-1.5 rounded-md hover:bg-accent cursor-pointer disabled:opacity-30"
                      aria-label="Previous chapter"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </button>
                    <span className="text-xs text-muted-foreground">{currentChapter + 1} / {book.chapters.length}</span>
                    <button
                      type="button"
                      onClick={() => goToChapter(currentChapter + 1)}
                      disabled={currentChapter === book.chapters.length - 1}
                      className="p-1.5 rounded-md hover:bg-accent cursor-pointer disabled:opacity-30"
                      aria-label="Next chapter"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  </div>
                </div>
                <div
                  className={`fb2-content ${FONT_SIZE_CLASSES[fontSize]} ${theme === "dark" ? "fb2-dark" : ""}`}
                  style={{
                    ["--fb2-font-size" as string]: FONT_SIZE_PX[fontSize],
                  }}
                >
                  <div
                    dangerouslySetInnerHTML={{ __html: currentChapterData.html }}
                    style={{
                      lineHeight: 1.7,
                      fontFamily: "Georgia, 'Times New Roman', serif",
                      background: theme === "dark" ? "#1a1a1a" : "inherit",
                      color: theme === "dark" ? "#e5e5e5" : "inherit",
                      padding: theme === "dark" ? "1rem" : "0",
                      borderRadius: theme === "dark" ? "0.5rem" : "0",
                    }}
                  />
                </div>
              </CardContent>
            </Card>
          </div>
        </>
      )}

      {error && <ErrorBanner message={error} />}

      {!book && !error && !working && (
        <EmptyState
          title="Read FictionBook 2.0 ebooks"
          hint="Pure-JS FB2 XML parser using DOMParser. Chapter navigation, search, bookmarks, font size + theme adjustment, reading progress. For .fb2.zip files, extract first with the ZIP Extractor tool."
          icon={<Book className="h-8 w-8" />}
        />
      )}

      <Card>
        <CardContent className="p-4 space-y-2">
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={() => setShowHistory(!showHistory)}
              className="text-xs text-muted-foreground hover:text-foreground cursor-pointer inline-flex items-center gap-1"
            >
              <History className="h-3 w-3" /> History ({history.length})
            </button>
            {book && (
              <ShareButton getUrl={() => buildShareUrl({ fontSize, theme })} label="Share reader settings" size="sm" />
            )}
          </div>
          {showHistory && (
            <>
              {history.length === 0 ? (
                <p className="text-xs text-muted-foreground">No history yet.</p>
              ) : (
                <div className="space-y-1 max-h-[200px] overflow-y-auto">
                  {history.map((h, i) => (
                    <div key={i} className="text-xs py-1 border-b border-border/40 last:border-0">
                      <p className="font-medium truncate">{h.title}</p>
                      <p className="text-[10px] text-muted-foreground">
                        {h.author} · {h.chapterCount} chapters · {formatBytes(h.fileSize)} · {new Date(h.openedAt).toLocaleString()}
                      </p>
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={() => { clearHistory(); setHistory([]); }}
                    className="text-[10px] text-red-600 hover:underline cursor-pointer"
                  >
                    Clear history
                  </button>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4">
          <p className="text-xs text-muted-foreground">
            <strong className="text-foreground">Privacy:</strong> the FB2 XML is parsed entirely in your browser using DOMParser. Book contents never leave your device. Only book titles + chapter indices are saved to localStorage for the resume feature.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
