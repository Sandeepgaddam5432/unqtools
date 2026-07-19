"use client";

import React, { useState, useMemo, useCallback, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
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
  EMOJI_DB,
  CATEGORIES,
  CATEGORY_LABELS,
  SKIN_TONES,
  SKIN_TONE_LABELS,
  SKIN_TONE_SWATCH,
  TOP_EMOJIS,
  ZWJ_COMBINATIONS,
  searchEmojis,
  applySkinTone,
  findVariations,
  findRelated,
  computeStats,
  renderText,
  renderCsv,
  findCombinations,
  findByChar,
  loadRecent,
  saveRecent,
  clearRecent,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  type EmojiCategory,
  type SkinTone,
  type EmojiEntry,
  type HistoryEntry,
} from "./logic";
import { History, Smile, Search, Sparkles, Copy, X } from "lucide-react";

const EMOJI_PER_PAGE = 120;

export default function EmojiPickerKeyboard() {
  const [query, setQuery] = useState("");
  const [activeCat, setActiveCat] = useState<EmojiCategory | "all">("all");
  const [tone, setTone] = useState<SkinTone>("none");
  const [selected, setSelected] = useState<EmojiEntry | null>(null);
  const [visible, setVisible] = useState(EMOJI_PER_PAGE);
  const [recent, setRecent] = useState<string[]>([]);
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  useEffect(() => {
    setRecent(loadRecent());
    setHistory(loadHistory());
    if (typeof window !== "undefined" && window.location.hash) {
      const p = parseShareUrl(window.location.hash);
      if (p.query) setQuery(p.query);
      if (p.category) setActiveCat(p.category);
      if (p.tone !== "none") setTone(p.tone);
      if (p.query || p.category || p.tone !== "none") toast.info("Loaded from share link");
    }
  }, []);

  const results = useMemo(() => {
    const opts: { category?: EmojiCategory | ""; limit?: number } = {};
    if (activeCat !== "all") opts.category = activeCat;
    return searchEmojis(query, opts);
  }, [query, activeCat]);

  const visibleResults = useMemo(
    () => results.slice(0, visible),
    [results, visible],
  );

  const stats = useMemo(() => computeStats(results), [results]);
  const related = useMemo(() => (selected ? findRelated(selected, 12) : []), [selected]);
  const variations = useMemo(() => (selected ? findVariations(selected) : []), [selected]);
  const recentEntries = useMemo(
    () =>
      recent
        .map((c) => findByChar(c))
        .filter((x): x is EmojiEntry => Boolean(x)),
    [recent],
  );
  const topEntries = useMemo(
    () =>
      TOP_EMOJIS.slice(0, 30)
        .map((c) => findByChar(c))
        .filter((x): x is EmojiEntry => Boolean(x)),
    [],
  );
  const combos = useMemo(
    () => findCombinations(recent.slice(0, 20)),
    [recent],
  );

  const handleCopy = useCallback(
    (entry: EmojiEntry) => {
      const text = applySkinTone(entry, tone);
      try {
        navigator.clipboard.writeText(text);
        toast.success(`Copied ${text}`);
        const nextRecent = saveRecent(entry.char);
        setRecent(nextRecent);
        saveHistory({ ts: Date.now(), char: entry.char, name: entry.name });
        setHistory(loadHistory());
      } catch {
        toast.error("Could not copy to clipboard");
      }
    },
    [tone],
  );

  const handleCopyRaw = useCallback((text: string, label?: string) => {
    try {
      navigator.clipboard.writeText(text);
      toast.success(label ? `Copied ${label}` : "Copied");
    } catch {
      toast.error("Could not copy");
    }
  }, []);

  const handleClear = useCallback(() => {
    setQuery("");
    setActiveCat("all");
    setTone("none");
    setSelected(null);
    setVisible(EMOJI_PER_PAGE);
    toast.info("Cleared");
  }, []);

  const handleClearRecent = useCallback(() => {
    clearRecent();
    setRecent([]);
    toast.success("Recently used cleared");
  }, []);

  const handleClearHistory = useCallback(() => {
    clearHistory();
    setHistory([]);
    toast.success("History cleared");
  }, []);

  const handleCopyVariation = useCallback(
    (entry: EmojiEntry, t: SkinTone) => {
      const text = applySkinTone(entry, t);
      try {
        navigator.clipboard.writeText(text);
        toast.success(`Copied ${text}`);
        saveRecent(entry.char);
        setRecent(loadRecent());
        saveHistory({ ts: Date.now(), char: entry.char, name: entry.name });
        setHistory(loadHistory());
      } catch {
        toast.error("Could not copy");
      }
    },
    [],
  );

  // Reset visible when query/category changes
  useEffect(() => {
    setVisible(EMOJI_PER_PAGE);
  }, [query, activeCat]);

  return (
    <div className="space-y-4 unq-animate-fade-in-up">
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="epk-search">Search emojis by name or keyword</Label>
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                id="epk-search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="try: happy, heart, cat, fire…"
                className="pl-8 pr-8 text-sm"
              />
              {query && (
                <button
                  type="button"
                  onClick={() => setQuery("")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  aria-label="Clear search"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>

          <div className="space-y-1">
            <Label className="text-xs">Categories</Label>
            <div className="flex flex-wrap gap-1.5">
              <CatChip
                active={activeCat === "all"}
                onClick={() => setActiveCat("all")}
                label={`All (${EMOJI_DB.length})`}
              />
              {CATEGORIES.map((c) => (
                <CatChip
                  key={c}
                  active={activeCat === c}
                  onClick={() => setActiveCat(c)}
                  label={`${CATEGORY_LABELS[c]} (${stats.byCategory[c]})`}
                />
              ))}
            </div>
          </div>

          <div className="space-y-1">
            <Label className="text-xs">Skin tone (applies to human emojis)</Label>
            <div className="flex flex-wrap gap-1.5">
              {SKIN_TONES.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTone(t)}
                  className={`flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs ${
                    tone === t
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border bg-background hover:bg-muted"
                  }`}
                  title={SKIN_TONE_LABELS[t]}
                >
                  <span
                    className="h-3 w-3 rounded-full border"
                    style={{ background: SKIN_TONE_SWATCH[t] }}
                  />
                  {SKIN_TONE_LABELS[t]}
                </button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {results.length > 0 ? (
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <Smile className="h-4 w-4" /> {stats.total} emojis
                {activeCat !== "all" && ` in ${CATEGORY_LABELS[activeCat]}`}
              </h3>
              <div className="flex flex-wrap gap-2">
                <CopyButton
                  getText={() => visibleResults.map((e) => applySkinTone(e, tone)).join("")}
                  label="Copy all visible"
                />
                <DownloadButton
                  getText={() => renderText(visibleResults)}
                  filename="emojis.txt"
                  mime="text/plain"
                  label="Download .txt"
                />
                <DownloadButton
                  getText={() => renderCsv(visibleResults)}
                  filename="emojis.csv"
                  mime="text/csv"
                  label="Download CSV"
                />
                <ShareButton
                  getUrl={() => buildShareUrl(query, activeCat === "all" ? "" : activeCat, tone)}
                />
                <ClearButton onClick={handleClear} />
              </div>
            </div>

            <div className="grid grid-cols-6 sm:grid-cols-8 md:grid-cols-10 lg:grid-cols-12 gap-1 max-h-[500px] overflow-auto p-1">
              {visibleResults.map((entry, i) => {
                const char = applySkinTone(entry, tone);
                return (
                  <button
                    key={`${entry.char}-${i}`}
                    type="button"
                    onClick={() => handleCopy(entry)}
                    onMouseEnter={() => setSelected(entry)}
                    onFocus={() => setSelected(entry)}
                    title={`${entry.name} — click to copy`}
                    className={`flex aspect-square items-center justify-center rounded-md text-2xl hover:bg-primary/10 hover:scale-110 transition ${
                      selected?.char === entry.char ? "ring-2 ring-primary bg-primary/5" : ""
                    }`}
                  >
                    {char}
                  </button>
                );
              })}
            </div>

            {visible < results.length && (
              <Button
                variant="outline"
                size="sm"
                className="w-full"
                onClick={() => setVisible((v) => v + EMOJI_PER_PAGE)}
              >
                Show more ({results.length - visible} remaining)
              </Button>
            )}

            {selected && (
              <div className="rounded-md border bg-background p-3 text-xs space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-2xl">{applySkinTone(selected, tone)}</span>
                    <div>
                      <div className="font-semibold text-foreground">{selected.name}</div>
                      <div className="text-[10px] text-muted-foreground">
                        {CATEGORY_LABELS[selected.category]} ·{" "}
                        {selected.skinToneSupport ? "skin tone supported" : "no skin tone"}
                      </div>
                    </div>
                  </div>
                  <Button
                    variant="default"
                    size="sm"
                    onClick={() => handleCopy(selected)}
                    className="gap-1"
                  >
                    <Copy className="h-3 w-3" /> Copy
                  </Button>
                </div>
                <div className="flex flex-wrap gap-1">
                  {selected.keywords.map((k) => (
                    <Badge key={k} variant="outline" className="text-[10px]">#{k}</Badge>
                  ))}
                </div>
                {variations.length > 1 && (
                  <div>
                    <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">
                      Variations
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {SKIN_TONES.map((t, i) => (
                        <button
                          key={t}
                          type="button"
                          onClick={() => handleCopyVariation(selected, t)}
                          title={`${SKIN_TONE_LABELS[t]} — click to copy`}
                          className="flex flex-col items-center gap-0.5 rounded-md border px-2 py-1 hover:bg-primary/10"
                        >
                          <span className="text-xl">{variations[i]}</span>
                          <span className="text-[9px] text-muted-foreground">{SKIN_TONE_LABELS[t]}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      ) : (
        <EmptyState
          title="No emojis match your search"
          hint="Try a different keyword or clear the category filter. The database has 900+ emojis across 9 categories."
          icon={<Smile className="h-8 w-8" />}
        />
      )}

      {related.length > 0 && selected && (
        <Card>
          <CardContent className="p-4 space-y-2">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
              <Sparkles className="h-4 w-4" /> Related to &quot;{selected.name}&quot;
            </h3>
            <div className="grid grid-cols-8 sm:grid-cols-12 gap-1">
              {related.map((entry, i) => (
                <button
                  key={`${entry.char}-${i}`}
                  type="button"
                  onClick={() => handleCopy(entry)}
                  onMouseEnter={() => setSelected(entry)}
                  title={`${entry.name} — click to copy`}
                  className="flex aspect-square items-center justify-center rounded-md text-2xl hover:bg-primary/10 hover:scale-110 transition"
                >
                  {applySkinTone(entry, tone)}
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {topEntries.length > 0 && recent.length === 0 && (
        <Card>
          <CardContent className="p-4 space-y-2">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
              <Sparkles className="h-4 w-4" /> Top 30 frequently used
            </h3>
            <div className="grid grid-cols-8 sm:grid-cols-12 gap-1">
              {topEntries.map((entry, i) => (
                <button
                  key={`${entry.char}-${i}`}
                  type="button"
                  onClick={() => handleCopy(entry)}
                  onMouseEnter={() => setSelected(entry)}
                  title={`${entry.name} — click to copy`}
                  className="flex aspect-square items-center justify-center rounded-md text-2xl hover:bg-primary/10 hover:scale-110 transition"
                >
                  {entry.char}
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {recentEntries.length > 0 && (
        <Card>
          <CardContent className="p-4 space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <History className="h-4 w-4" /> Recently used ({recentEntries.length}/50)
              </h3>
              <Button variant="ghost" size="sm" onClick={handleClearRecent}>Clear</Button>
            </div>
            <div className="grid grid-cols-8 sm:grid-cols-12 gap-1">
              {recentEntries.map((entry, i) => (
                <button
                  key={`${entry.char}-${i}`}
                  type="button"
                  onClick={() => handleCopy(entry)}
                  onMouseEnter={() => setSelected(entry)}
                  title={`${entry.name} — click to copy`}
                  className="flex aspect-square items-center justify-center rounded-md text-2xl hover:bg-primary/10 hover:scale-110 transition"
                >
                  {entry.char}
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {combos.length > 0 && (
        <Card>
          <CardContent className="p-4 space-y-2">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
              <Sparkles className="h-4 w-4" /> ZWJ combinations available from your recent emojis
            </h3>
            <div className="space-y-1">
              {combos.map((c) => (
                <button
                  key={c.name}
                  type="button"
                  onClick={() => handleCopyRaw(c.result, c.result)}
                  className="flex w-full items-center gap-2 rounded border bg-background px-3 py-2 text-xs hover:bg-muted"
                >
                  <span className="text-2xl">{c.result}</span>
                  <div className="flex-1 text-left">
                    <div className="font-medium text-foreground">{c.name}</div>
                    <div className="font-mono text-[10px] text-muted-foreground">
                      {c.components.join(" + ")} = {c.result}
                    </div>
                  </div>
                  <Copy className="h-3 w-3 text-muted-foreground" />
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {history.length > 0 && (
        <Card>
          <CardContent className="p-4 space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <History className="h-4 w-4" /> Copy history ({history.length}/20)
              </h3>
              <Button variant="ghost" size="sm" onClick={handleClearHistory}>Clear</Button>
            </div>
            <div className="space-y-1 max-h-[200px] overflow-auto">
              {history.slice(0, 10).map((h, i) => (
                <div
                  key={i}
                  className="flex items-center gap-2 rounded border bg-background px-3 py-1.5 text-xs"
                >
                  <span className="text-xl">{h.char}</span>
                  <span className="font-mono text-foreground flex-1 truncate">{h.name}</span>
                  <span className="text-[10px] text-muted-foreground">
                    {new Date(h.ts).toLocaleTimeString()}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-3">
          <p className="text-xs text-muted-foreground">
            <strong className="text-foreground">Privacy:</strong> All emoji search and copy runs locally in your browser. Recently used and copy history are stored in localStorage on this device only.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function CatChip({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-md border px-2.5 py-1 text-xs ${
        active
          ? "border-primary bg-primary text-primary-foreground"
          : "border-border bg-background hover:bg-muted"
      }`}
    >
      {label}
    </button>
  );
}
