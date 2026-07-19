"use client";

import React, { useState, useMemo, useCallback, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  CopyButton,
  DownloadButton,
  EmptyState,
  ShareButton,
  ClearButton,
} from "../../_shared";
import { toast } from "sonner";
import {
  STATUS_FILTERS,
  STATUS_FILTER_LABELS,
  STATUS_LABELS,
  SORT_OPTIONS,
  SORT_LABELS,
  GENRE_PRESETS,
  parseBooks,
  calcProgress,
  progressBar,
  filterByStatus,
  searchBooks,
  sortBooks,
  computeStats,
  calcGoalProgress,
  estimateReadingTime,
  estimateTotalReadingTime,
  recommendBooks,
  renderText,
  renderCsv,
  loadHistory,
  saveHistory,
  clearHistory,
  loadGoal,
  saveGoal,
  buildShareUrl,
  parseShareUrl,
  SAMPLE_BOOKS,
  type StatusFilter,
  type SortBy,
  type Book,
  type HistoryEntry,
} from "./logic";
import { Library, History, Search, Sparkles, Clock, Target, Star } from "lucide-react";

export default function ReadingListTracker() {
  const [booksText, setBooksText] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [sortBy, setSortBy] = useState<SortBy>("title");
  const [searchQuery, setSearchQuery] = useState("");
  const [goal, setGoal] = useState(0);
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  useEffect(() => {
    setHistory(loadHistory());
    setGoal(loadGoal());
    if (typeof window !== "undefined" && window.location.hash) {
      const p = parseShareUrl(window.location.hash);
      if (p.books) setBooksText(p.books);
      if (p.statusFilter !== "all") setStatusFilter(p.statusFilter);
      if (p.sortBy !== "title") setSortBy(p.sortBy);
      if (p.goal > 0) setGoal(p.goal);
      if (p.books || p.statusFilter !== "all" || p.sortBy !== "title" || p.goal > 0) {
        toast.info("Loaded from share link");
      }
    }
  }, []);

  const books = useMemo(() => parseBooks(booksText), [booksText]);
  const filtered = useMemo(() => {
    let list = filterByStatus(books, statusFilter);
    list = searchBooks(list, searchQuery);
    return sortBooks(list, sortBy);
  }, [books, statusFilter, searchQuery, sortBy]);

  const stats = useMemo(() => computeStats(books), [books]);
  const goalProgress = useMemo(() => calcGoalProgress(books, goal), [books, goal]);
  const totalTime = useMemo(() => estimateTotalReadingTime(books), [books]);
  const recommendations = useMemo(() => recommendBooks(books, 3), [books]);

  const textOut = useMemo(() => renderText(filtered), [filtered]);
  const csvOut = useMemo(() => renderCsv(filtered), [filtered]);

  const handleSaveHistory = useCallback(() => {
    if (books.length > 0) {
      saveHistory({
        ts: Date.now(),
        bookCount: books.length,
        finishedCount: stats.finishedCount,
        avgRating: stats.avgRating,
        sampleTitle: books[0].title,
      });
      setHistory(loadHistory());
    }
  }, [books, stats]);

  const handleSaveGoal = useCallback((value: number) => {
    setGoal(value);
    saveGoal(value);
  }, []);

  const handleClear = useCallback(() => {
    setBooksText("");
    setStatusFilter("all");
    setSortBy("title");
    setSearchQuery("");
    toast.info("Cleared inputs");
  }, []);

  const handleClearHistory = useCallback(() => {
    clearHistory();
    setHistory([]);
    toast.success("History cleared");
  }, []);

  const handleShare = useCallback(() => {
    handleSaveHistory();
    return buildShareUrl(booksText, statusFilter, sortBy, goal);
  }, [booksText, statusFilter, sortBy, goal, handleSaveHistory]);

  return (
    <div className="space-y-4 unq-animate-fade-in-up">
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="rlt-books" className="text-xs">
              Books (one per line, pipe-separated:{" "}
              <span className="font-mono">title | author | total_pages | current_page | status | rating | notes | genre</span>)
            </Label>
            <Textarea
              id="rlt-books"
              value={booksText}
              onChange={(e) => setBooksText(e.target.value)}
              placeholder={SAMPLE_BOOKS}
              className="min-h-[140px] resize-y font-mono text-xs"
            />
            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                className="h-6 text-[11px]"
                onClick={() => setBooksText(SAMPLE_BOOKS)}
              >
                Load sample
              </Button>
              <ClearButton onClick={handleClear} label="Clear" />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1">
              <Label htmlFor="rlt-status" className="text-xs">Filter by status</Label>
              <select
                id="rlt-status"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
                className="h-8 text-xs w-full rounded border bg-background px-2"
              >
                {STATUS_FILTERS.map((s) => <option key={s} value={s}>{STATUS_FILTER_LABELS[s]}</option>)}
              </select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="rlt-sort" className="text-xs">Sort by</Label>
              <select
                id="rlt-sort"
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as SortBy)}
                className="h-8 text-xs w-full rounded border bg-background px-2"
              >
                {SORT_OPTIONS.map((s) => <option key={s} value={s}>{SORT_LABELS[s]}</option>)}
              </select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="rlt-search" className="text-xs">Search (title, author, genre, notes)</Label>
              <div className="relative">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
                <Input
                  id="rlt-search"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search books…"
                  className="h-8 text-xs pl-7"
                />
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 pt-1">
            <Label htmlFor="rlt-goal" className="text-xs flex items-center gap-1">
              <Target className="h-3 w-3" /> Yearly goal:
            </Label>
            <Input
              id="rlt-goal"
              type="number"
              min={0}
              value={goal === 0 ? "" : goal}
              onChange={(e) => handleSaveGoal(parseInt(e.target.value, 10) || 0)}
              placeholder="0"
              className="h-8 w-20 text-xs"
            />
            <span className="text-xs text-muted-foreground">books/year</span>
            {goal > 0 && (
              <Badge variant={goalProgress.onTrack ? "default" : "secondary"} className="text-[10px]">
                {goalProgress.finished}/{goal} ({goalProgress.percent}%)
              </Badge>
            )}
          </div>
        </CardContent>
      </Card>

      {books.length > 0 ? (
        <>
          <Card>
            <CardContent className="p-4 space-y-3">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <Library className="h-4 w-4" /> Reading stats ({books.length} books)
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                <Stat label="Total books" value={stats.total} />
                <Stat label="Finished" value={stats.finishedCount} />
                <Stat label="Reading" value={stats.readingCount} />
                <Stat label="Avg rating" value={stats.avgRating > 0 ? `${stats.avgRating}★` : "—"} />
                <Stat label="Pages read" value={stats.totalPagesRead.toLocaleString()} />
                <Stat label="Total pages" value={stats.totalPages.toLocaleString()} />
                <Stat label="To-read" value={stats.byStatus["to-read"]} />
                <Stat label="Abandoned" value={stats.byStatus.abandoned} />
              </div>
              {goal > 0 && (
                <div className="rounded border bg-background px-3 py-2 text-xs space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      <Target className="h-3 w-3" /> Yearly goal progress
                    </span>
                    <Badge variant={goalProgress.onTrack ? "default" : "outline"} className="text-[10px]">
                      {goalProgress.percent}%
                    </Badge>
                  </div>
                  <div className="font-mono text-[10px] text-muted-foreground">{progressBar(goalProgress.percent, 30)}</div>
                  <div className="text-[10px] text-muted-foreground">
                    {goalProgress.finished} of {goal} books finished · {goalProgress.remaining} to go
                  </div>
                </div>
              )}
              <div className="rounded border bg-background px-3 py-2 text-xs">
                <Clock className="h-3 w-3 inline mr-1.5" />
                Estimated remaining reading time:{" "}
                <span className="font-mono font-medium text-foreground">{totalTime.displayString}</span>
                <span className="text-muted-foreground ml-1">(at 250 wpm)</span>
              </div>
            </CardContent>
          </Card>

          {recommendations.length > 0 && (
            <Card>
              <CardContent className="p-4 space-y-2">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                  <Sparkles className="h-4 w-4" /> Recommended next reads
                </h3>
                <div className="space-y-1">
                  {recommendations.map((r, i) => (
                    <div key={r.book.id} className="rounded border bg-background px-3 py-2 text-xs">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-[10px]">#{i + 1}</Badge>
                        <span className="font-medium text-foreground">{r.book.title}</span>
                        {r.book.author && <span className="text-muted-foreground">by {r.book.author}</span>}
                        {r.book.genre && <Badge variant="secondary" className="text-[10px]">{r.book.genre}</Badge>}
                      </div>
                      <div className="text-[10px] text-muted-foreground mt-0.5">{r.reason}</div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                  <Library className="h-4 w-4" /> Books ({filtered.length}{filtered.length !== books.length ? ` of ${books.length}` : ""})
                </h3>
              </div>

              {filtered.length > 0 ? (
                <div className="space-y-1 max-h-[600px] overflow-auto">
                  {filtered.map((b: Book) => {
                    const progress = calcProgress(b);
                    const time = estimateReadingTime(b);
                    return (
                      <div key={b.id} className="rounded border bg-background px-3 py-2 text-xs space-y-1">
                        <div className="flex items-start gap-2">
                          <StatusBadge status={b.status} />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="font-medium text-foreground truncate">{b.title}</span>
                              {b.author && <span className="text-muted-foreground text-[11px]">by {b.author}</span>}
                              {b.genre && <Badge variant="secondary" className="text-[10px]">{b.genre}</Badge>}
                            </div>
                            {b.totalPages > 0 && (
                              <div className="mt-1 flex items-center gap-2 text-[10px] text-muted-foreground">
                                <span className="font-mono">{b.currentPage}/{b.totalPages}p ({progress}%)</span>
                                <span className="font-mono">{progressBar(progress, 12)}</span>
                                {(b.status === "to-read" || b.status === "reading") && time.minutes > 0 && (
                                  <span className="flex items-center gap-0.5">
                                    <Clock className="h-2.5 w-2.5" /> {time.displayString} left
                                  </span>
                                )}
                              </div>
                            )}
                            {b.rating > 0 && (
                              <div className="text-[10px] text-amber-500 mt-0.5">
                                {"★".repeat(b.rating)}{"☆".repeat(5 - b.rating)}
                              </div>
                            )}
                            {b.notes && (
                              <div className="text-[10px] text-muted-foreground mt-0.5 italic">{b.notes}</div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">No books match current filters.</p>
              )}

              <div className="flex flex-wrap gap-2 pt-2">
                <CopyButton
                  getText={() => { handleSaveHistory(); return textOut; }}
                  label="Copy list"
                />
                <DownloadButton
                  getText={() => { handleSaveHistory(); return textOut; }}
                  filename="reading-list.txt"
                  mime="text/plain"
                  label="Download .txt"
                />
                <DownloadButton
                  getText={() => csvOut}
                  filename="reading-list.csv"
                  mime="text/csv"
                  label="Download CSV"
                />
                <ShareButton getUrl={handleShare} />
              </div>
            </CardContent>
          </Card>
        </>
      ) : (
        <EmptyState
          title="Track your reading list"
          hint="Add books in pipe-separated format (or click 'Load sample'). One per line: title | author | total_pages | current_page | status | rating | notes | genre. Filter, sort, search, set goals, and get recommendations."
          icon={<Library className="h-8 w-8" />}
        />
      )}

      {history.length > 0 && (
        <Card>
          <CardContent className="p-4 space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <History className="h-4 w-4" /> Recent ({history.length})
              </h3>
              <Button variant="ghost" size="sm" onClick={handleClearHistory}>Clear</Button>
            </div>
            <div className="space-y-1">
              {history.slice(0, 5).map((h, i) => (
                <div key={i} className="rounded border bg-background px-3 py-2 text-xs">
                  <Badge variant="outline" className="mr-2 text-[10px]">{h.bookCount} books</Badge>
                  <Badge variant="outline" className="mr-2 text-[10px]">{h.finishedCount} finished</Badge>
                  {h.avgRating > 0 && (
                    <Badge variant="outline" className="mr-2 text-[10px]">{h.avgRating}★ avg</Badge>
                  )}
                  <span className="font-mono text-muted-foreground">{h.sampleTitle}</span>
                  <span className="text-muted-foreground ml-2">· {new Date(h.ts).toLocaleString()}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-3">
          <p className="text-xs text-muted-foreground">
            <strong className="text-foreground">Privacy:</strong> All book parsing, stats, and recommendations run locally. History and goal are stored in localStorage on this device only.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function StatusBadge({ status }: { status: Book["status"] }) {
  const variantMap: Record<Book["status"], "default" | "secondary" | "outline" | "destructive"> = {
    "to-read": "outline",
    reading: "default",
    finished: "secondary",
    abandoned: "destructive",
  };
  return (
    <Badge variant={variantMap[status]} className="text-[10px] flex-shrink-0">
      {STATUS_LABELS[status]}
    </Badge>
  );
}

function Stat({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) {
  return (
    <div className="rounded border bg-background px-3 py-2">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="text-base font-semibold text-foreground">{value}</div>
    </div>
  );
}
