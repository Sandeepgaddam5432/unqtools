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
  DIRECTORIES,
  NICHE_PRESETS,
  COUNTRY_OPTIONS,
  PRIORITY_LABELS,
  CATEGORY_LABELS,
  parseInputs,
  generateCitations,
  filterCitations,
  computeSummaryStats,
  formatMinutes,
  renderText,
  renderCsv,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  type CitationInputs,
  type Priority,
  type DirectoryCategory,
  type HistoryEntry,
} from "./logic";
import { BookOpen, ExternalLink, History, Clock, Filter } from "lucide-react";

export default function CitationFinder() {
  const [businessName, setBusinessName] = useState("");
  const [niche, setNiche] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [country, setCountry] = useState("US");
  const [filterPriority, setFilterPriority] = useState<Priority | "">("");
  const [filterCategory, setFilterCategory] = useState<DirectoryCategory | "">("");
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  useEffect(() => {
    setHistory(loadHistory());
    if (typeof window !== "undefined" && window.location.hash) {
      const p = parseShareUrl(window.location.hash);
      let loaded = false;
      if (p.businessName) { setBusinessName(p.businessName); loaded = true; }
      if (p.niche) { setNiche(p.niche); loaded = true; }
      if (p.city) { setCity(p.city); loaded = true; }
      if (p.state) { setState(p.state); loaded = true; }
      if (p.country) { setCountry(p.country); loaded = true; }
      if (loaded) toast.info("Loaded from share link");
    }
  }, []);

  const inputs: CitationInputs = useMemo(
    () => parseInputs({ businessName, niche, city, state, country }),
    [businessName, niche, city, state, country],
  );

  const allCitations = useMemo(() => generateCitations(inputs), [inputs]);
  const filtered = useMemo(
    () => filterCitations(allCitations, { priority: filterPriority, category: filterCategory }),
    [allCitations, filterPriority, filterCategory],
  );
  const stats = useMemo(() => computeSummaryStats(allCitations), [allCitations]);
  const filteredStats = useMemo(() => computeSummaryStats(filtered), [filtered]);

  const text = useMemo(() => renderText(filtered, inputs), [filtered, inputs]);
  const csv = useMemo(() => renderCsv(filtered), [filtered]);

  const handleSaveHistory = useCallback(() => {
    if (allCitations.length > 0) {
      saveHistory({
        ts: Date.now(),
        businessName: inputs.businessName,
        niche: inputs.niche,
        city: inputs.city,
        country: inputs.country,
        totalCitations: allCitations.length,
        totalTimeMinutes: stats.totalTimeMinutes,
      });
      setHistory(loadHistory());
    }
  }, [allCitations, inputs, stats]);

  const handleClear = useCallback(() => {
    setBusinessName("");
    setNiche("");
    setCity("");
    setState("");
    setCountry("US");
    setFilterPriority("");
    setFilterCategory("");
    toast.info("Cleared");
  }, []);

  const handleClearHistory = useCallback(() => {
    clearHistory();
    setHistory([]);
    toast.success("History cleared");
  }, []);

  const priorityColor = (p: Priority) =>
    p === "high"
      ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
      : p === "medium"
        ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
        : "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-400";

  return (
    <div className="space-y-4 unq-animate-fade-in-up">
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="cf-biz">Business name</Label>
              <Input
                id="cf-biz"
                value={businessName}
                onChange={(e) => setBusinessName(e.target.value)}
                placeholder="Acme Plumbing Co."
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cf-niche">Niche</Label>
              <Input
                id="cf-niche"
                value={niche}
                onChange={(e) => setNiche(e.target.value)}
                placeholder="plumber, restaurant, lawyer…"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cf-city">City</Label>
              <Input
                id="cf-city"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder="Austin"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1.5">
                <Label htmlFor="cf-state">State / Region</Label>
                <Input
                  id="cf-state"
                  value={state}
                  onChange={(e) => setState(e.target.value)}
                  placeholder="TX"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="cf-country">Country</Label>
                <select
                  id="cf-country"
                  value={country}
                  onChange={(e) => setCountry(e.target.value)}
                  className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                >
                  {COUNTRY_OPTIONS.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>
          <div>
            <Label className="text-xs">Niche presets (click to add)</Label>
            <div className="flex flex-wrap gap-1 pt-1">
              {NICHE_PRESETS.map((n) => (
                <Button
                  key={n}
                  variant="ghost"
                  size="sm"
                  className="h-6 text-[11px]"
                  onClick={() => setNiche(n)}
                >{n}</Button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {allCitations.length > 0 ? (
        <>
          <Card>
            <CardContent className="p-4 space-y-2">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <BookOpen className="h-4 w-4" /> {allCitations.length} citation opportunities for {inputs.businessName || "your business"}
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                <Stat label="Total citations" value={stats.total} />
                <Stat label="High priority" value={stats.byPriority.high} highlight="bad" />
                <Stat label="Niche matches" value={stats.byCategory.niche} />
                <Stat label="Country matches" value={stats.byCategory.country} />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs pt-1">
                <div className="rounded border bg-background px-3 py-2 flex items-center gap-2">
                  <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-muted-foreground">Total submit time:</span>
                  <span className="font-mono font-semibold text-foreground">{formatMinutes(stats.totalTimeMinutes)}</span>
                </div>
                <div className="rounded border bg-background px-3 py-2 flex items-center gap-2">
                  <Filter className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-muted-foreground">General: {stats.byCategory.general}</span>
                  <span className="text-muted-foreground">·</span>
                  <span className="text-muted-foreground">Med: {stats.byPriority.medium}</span>
                  <span className="text-muted-foreground">·</span>
                  <span className="text-muted-foreground">Low: {stats.byPriority.low}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                  <BookOpen className="h-4 w-4" /> Citation sources ({filtered.length})
                </h3>
                <div className="flex flex-wrap gap-2">
                  <select
                    value={filterPriority}
                    onChange={(e) => setFilterPriority(e.target.value as Priority | "")}
                    className="h-8 text-xs rounded border bg-background px-2"
                  >
                    <option value="">All priorities</option>
                    {(Object.keys(PRIORITY_LABELS) as Priority[]).map((p) => (
                      <option key={p} value={p}>{PRIORITY_LABELS[p]}</option>
                    ))}
                  </select>
                  <select
                    value={filterCategory}
                    onChange={(e) => setFilterCategory(e.target.value as DirectoryCategory | "")}
                    className="h-8 text-xs rounded border bg-background px-2"
                  >
                    <option value="">All categories</option>
                    {(Object.keys(CATEGORY_LABELS) as DirectoryCategory[]).map((c) => (
                      <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="space-y-1 max-h-[500px] overflow-auto">
                {filtered.map((c) => (
                  <div key={c.id} className="rounded border bg-background px-3 py-2 text-xs space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${priorityColor(c.priority)}`}>
                        {PRIORITY_LABELS[c.priority]}
                      </span>
                      <Badge variant="outline" className="text-[10px]">{CATEGORY_LABELS[c.category]}</Badge>
                      <span className="font-semibold text-foreground">{c.name}</span>
                      <span className="text-muted-foreground text-[10px] ml-auto">{c.timeMinutes} min</span>
                    </div>
                    <a
                      href={c.submissionUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-mono text-[11px] text-primary hover:underline flex items-center gap-1 break-all"
                    >
                      {c.submissionUrl}
                      <ExternalLink className="h-3 w-3 flex-shrink-0" />
                    </a>
                    <div className="flex flex-wrap gap-1 text-[10px]">
                      {c.requiredFields.map((f) => (
                        <span key={f} className="px-1.5 py-0.5 rounded bg-muted text-muted-foreground">{f}</span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
              {filtered.length > 0 && (
                <div className="text-xs text-muted-foreground pt-1">
                  Showing {filtered.length} of {allCitations.length} · {formatMinutes(filteredStats.totalTimeMinutes)} to submit all filtered
                </div>
              )}
              <div className="flex flex-wrap gap-2 pt-2">
                <CopyButton
                  getText={() => { handleSaveHistory(); return text; }}
                  label="Copy report"
                />
                <DownloadButton
                  getText={() => { handleSaveHistory(); return text; }}
                  filename="citation-finder-report.txt"
                  mime="text/plain"
                  label="Download .txt"
                />
                <DownloadButton
                  getText={() => csv}
                  filename="citations.csv"
                  mime="text/csv"
                  label="Download CSV"
                />
                <ShareButton getUrl={() => { handleSaveHistory(); return buildShareUrl(inputs); }} />
                <ClearButton onClick={handleClear} />
              </div>
            </CardContent>
          </Card>
        </>
      ) : (
        <EmptyState
          title="Enter your business details to find citation sources"
          hint="Built-in database of 50+ directories (general, niche-specific, country-specific). Add a niche keyword to unlock niche directories."
          icon={<BookOpen className="h-8 w-8" />}
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
                  <Badge variant="outline" className="mr-2">{h.totalCitations} citations</Badge>
                  <Badge variant="outline" className="mr-2">{formatMinutes(h.totalTimeMinutes)}</Badge>
                  <span className="text-foreground font-medium">{h.businessName || "(no name)"}</span>
                  <span className="text-muted-foreground ml-2">{h.niche} · {h.city} · {h.country}</span>
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
            <strong className="text-foreground">Privacy:</strong> All citation matching runs locally against a built-in 50+ directory database. History is stored in localStorage on this device only.
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
