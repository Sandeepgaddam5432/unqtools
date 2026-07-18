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
  FOOTPRINTS,
  NICHE_PRESETS,
  CATEGORY_LABELS,
  parseNiches,
  generateForNiches,
  computeStats,
  renderText,
  renderCsv,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  type FootprintCategory,
  type HistoryEntry,
} from "./logic";
import { History, PenTool, ExternalLink, Search } from "lucide-react";

export default function GuestPostFinder() {
  const [nichesText, setNichesText] = useState("");
  const [selectedCats, setSelectedCats] = useState<FootprintCategory[]>([]);
  const [filterCat, setFilterCat] = useState<FootprintCategory | "">("");
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  useEffect(() => {
    setHistory(loadHistory());
    if (typeof window !== "undefined" && window.location.hash) {
      const p = parseShareUrl(window.location.hash);
      if (p.niches) setNichesText(p.niches);
      if (p.categories.length > 0) setSelectedCats(p.categories);
      if (p.niches || p.categories.length > 0) toast.info("Loaded from share link");
    }
  }, []);

  const niches = useMemo(() => parseNiches(nichesText), [nichesText]);
  const queries = useMemo(
    () => generateForNiches(niches, selectedCats.length > 0 ? selectedCats : undefined),
    [niches, selectedCats],
  );
  const filteredQueries = useMemo(
    () => filterCat ? queries.filter((q) => q.category === filterCat) : queries,
    [queries, filterCat],
  );
  const stats = useMemo(() => computeStats(queries), [queries]);
  const text = useMemo(() => renderText(filteredQueries), [filteredQueries]);
  const csv = useMemo(() => renderCsv(filteredQueries), [filteredQueries]);

  const handleSaveHistory = useCallback(() => {
    if (queries.length > 0) {
      saveHistory({
        ts: Date.now(),
        niches,
        totalQueries: queries.length,
      });
      setHistory(loadHistory());
    }
  }, [queries, niches]);

  const toggleCat = (cat: FootprintCategory) => {
    setSelectedCats((prev) =>
      prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat],
    );
  };

  const handleClear = useCallback(() => {
    setNichesText("");
    setSelectedCats([]);
    setFilterCat("");
    toast.info("Cleared");
  }, []);

  const handleClearHistory = useCallback(() => {
    clearHistory();
    setHistory([]);
    toast.success("History cleared");
  }, []);

  return (
    <div className="space-y-4 unq-animate-fade-in-up">
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="gpf-niches">Niche keywords (one per line or comma-separated)</Label>
            <Textarea
              id="gpf-niches"
              value={nichesText}
              onChange={(e) => setNichesText(e.target.value)}
              placeholder={"seo\nfitness\ntravel"}
              className="min-h-[80px] resize-y font-mono text-xs"
            />
            <div className="flex flex-wrap gap-1">
              {NICHE_PRESETS.map((n) => (
                <Button
                  key={n}
                  variant="ghost"
                  size="sm"
                  className="h-6 text-[11px]"
                  onClick={() => setNichesText((prev) => (prev ? `${prev}\n${n}` : n))}
                >+ {n}</Button>
              ))}
            </div>
          </div>
          <div>
            <Label className="text-xs">Footprint categories (optional — leave empty for all)</Label>
            <div className="flex flex-wrap gap-2 pt-1">
              {(Object.keys(CATEGORY_LABELS) as FootprintCategory[]).map((c) => (
                <label key={c} className="flex items-center gap-1.5 text-xs cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selectedCats.includes(c)}
                    onChange={() => toggleCat(c)}
                  />
                  {CATEGORY_LABELS[c]}
                </label>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {queries.length > 0 ? (
        <>
          <Card>
            <CardContent className="p-4 space-y-2">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <Search className="h-4 w-4" /> {queries.length} queries across {niches.length} niche(s)
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                <Stat label="Total queries" value={queries.length} />
                <Stat label="Niches" value={niches.length} />
                <Stat label="Footprints" value={FOOTPRINTS.length} />
                <Stat label="Categories" value={Object.keys(CATEGORY_LABELS).length} />
              </div>
              {stats.length > 0 && (
                <div className="space-y-1 pt-2">
                  {stats.map((s) => (
                    <div key={s.niche} className="rounded border bg-background px-3 py-1.5 text-xs">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-medium text-foreground">{s.niche}</span>
                        <Badge variant="secondary" className="text-[10px]">{s.queryCount} queries</Badge>
                      </div>
                      <div className="flex flex-wrap gap-1.5 mt-1 text-[10px]">
                        {(Object.keys(CATEGORY_LABELS) as FootprintCategory[]).map((c) => (
                          <Badge key={c} variant="outline" className="text-[10px]">
                            {CATEGORY_LABELS[c]}: {s.byCategory[c]}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                  <PenTool className="h-4 w-4" /> Queries ({filteredQueries.length})
                </h3>
                <select
                  value={filterCat}
                  onChange={(e) => setFilterCat(e.target.value as FootprintCategory | "")}
                  className="h-8 text-xs rounded border bg-background px-2"
                >
                  <option value="">All categories</option>
                  {(Object.keys(CATEGORY_LABELS) as FootprintCategory[]).map((c) => (
                    <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1 max-h-[500px] overflow-auto">
                {filteredQueries.map((q, i) => (
                  <div key={i} className="flex items-center gap-2 rounded border bg-background px-3 py-1.5 text-xs">
                    <Badge variant="outline" className="text-[10px]">{CATEGORY_LABELS[q.category]}</Badge>
                    <span className="font-mono text-muted-foreground text-[10px] w-12 truncate">{q.niche}</span>
                    <a
                      href={q.googleUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1 font-mono text-foreground truncate hover:text-primary hover:underline flex items-center gap-1"
                    >
                      {q.query}
                      <ExternalLink className="h-3 w-3 flex-shrink-0" />
                    </a>
                  </div>
                ))}
              </div>
              <div className="flex flex-wrap gap-2 pt-2">
                <CopyButton
                  getText={() => { handleSaveHistory(); return text; }}
                  label="Copy all queries"
                />
                <DownloadButton
                  getText={() => { handleSaveHistory(); return text; }}
                  filename="guest-post-queries.txt"
                  mime="text/plain"
                  label="Download .txt"
                />
                <DownloadButton
                  getText={() => csv}
                  filename="guest-post-queries.csv"
                  mime="text/csv"
                  label="Download CSV"
                />
                <ShareButton getUrl={() => { handleSaveHistory(); return buildShareUrl(nichesText, selectedCats); }} />
                <ClearButton onClick={handleClear} />
              </div>
            </CardContent>
          </Card>
        </>
      ) : (
        <EmptyState
          title="Enter niche keywords to find guest post sites"
          hint="One per line or comma-separated. Each query opens a Google search with proven guest-post footprints. Click a preset niche to add it."
          icon={<PenTool className="h-8 w-8" />}
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
                  <Badge variant="outline" className="mr-2">{h.niches.length} niches</Badge>
                  <Badge variant="outline" className="mr-2">{h.totalQueries} queries</Badge>
                  <span className="text-muted-foreground">{h.niches.join(", ")}</span>
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
            <strong className="text-foreground">Privacy:</strong> All query generation runs locally. History is stored in localStorage on this device only.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function Stat({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string | number;
  highlight?: "bad" | "good";
}) {
  const color = highlight === "bad"
    ? "text-red-600 dark:text-red-400"
    : highlight === "good"
      ? "text-emerald-600 dark:text-emerald-400"
      : "text-foreground";
  return (
    <div className="rounded border bg-background px-3 py-2">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className={`text-base font-semibold ${color}`}>{value}</div>
    </div>
  );
}
