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
  STATUS_LABELS,
  PRIORITY_LABELS,
  generateAllQueries,
  buildProspect,
  dedupProspects,
  updateStatus,
  updatePriority,
  updateNotes,
  updateUrl,
  removeProspect,
  filterProspects,
  computeStats,
  renderCsv,
  loadHistory,
  saveHistory,
  clearHistory,
  loadProspects,
  saveProspects,
  clearProspects,
  buildShareUrl,
  parseShareUrl,
  type Prospect,
  type FootprintCategory,
  type OutreachStatus,
  type Priority,
  type HistoryEntry,
} from "./logic";
import { History, ListFilter, ExternalLink, Trash2, Trophy } from "lucide-react";

const CATEGORY_LABELS: Record<FootprintCategory, string> = {
  "guest-post": "Guest Post",
  "resource": "Resource Page",
  "broken-link": "Broken Link",
  "infographic": "Infographic",
  "podcast": "Podcast",
  "interview": "Interview",
};

const STATUS_COLORS: Record<OutreachStatus, string> = {
  pending: "bg-muted text-foreground",
  contacted: "bg-blue-500/15 text-blue-700 dark:text-blue-400",
  replied: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
  yes: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
  no: "bg-red-500/15 text-red-700 dark:text-red-400",
};

const PRIORITY_COLORS: Record<Priority, string> = {
  high: "bg-red-500/15 text-red-700 dark:text-red-400",
  medium: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
  low: "bg-muted text-foreground",
};

export default function LinkProspectingBuilder() {
  const [niche, setNiche] = useState("");
  const [selectedCats, setSelectedCats] = useState<FootprintCategory[]>(["guest-post", "resource"]);
  const [prospects, setProspects] = useState<Prospect[]>([]);
  const [filterStatus, setFilterStatus] = useState<OutreachStatus | "">("");
  const [filterCat, setFilterCat] = useState<FootprintCategory | "">("");
  const [filterQuery, setFilterQuery] = useState("");
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  useEffect(() => {
    setHistory(loadHistory());
    setProspects(loadProspects());
    if (typeof window !== "undefined" && window.location.hash) {
      const p = parseShareUrl(window.location.hash);
      if (p.niche) setNiche(p.niche);
      if (p.categories.length > 0) setSelectedCats(p.categories);
      if (p.niche || p.categories.length > 0) toast.info("Loaded from share link");
    }
  }, []);

  // Persist prospects
  useEffect(() => {
    saveProspects(prospects);
  }, [prospects]);

  const queries = useMemo(() => generateAllQueries(niche, selectedCats), [niche, selectedCats]);
  const filtered = useMemo(
    () => filterProspects(prospects, {
      status: filterStatus || undefined,
      category: filterCat || undefined,
      query: filterQuery || undefined,
    }),
    [prospects, filterStatus, filterCat, filterQuery],
  );
  const stats = useMemo(() => computeStats(prospects), [prospects]);
  const csv = useMemo(() => renderCsv(prospects), [prospects]);

  const handleGenerate = useCallback(() => {
    if (!niche.trim()) {
      toast.error("Enter a niche first");
      return;
    }
    if (selectedCats.length === 0) {
      toast.error("Pick at least one footprint category");
      return;
    }
    const newProspects = queries.map((q) => buildProspect(q));
    const { unique, removed } = dedupProspects([...prospects, ...newProspects]);
    setProspects(unique);
    saveHistory({
      ts: Date.now(),
      niche,
      totalProspects: unique.length,
      successRate: stats.successRate,
    });
    setHistory(loadHistory());
    toast.success(`Added ${newProspects.length} prospects (${removed} duplicates skipped)`);
  }, [niche, selectedCats, queries, prospects, stats.successRate]);

  const toggleCat = (cat: FootprintCategory) => {
    setSelectedCats((prev) =>
      prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat],
    );
  };

  const handleStatusChange = (id: string, status: OutreachStatus) => {
    setProspects((prev) => updateStatus(prev, id, status));
  };
  const handlePriorityChange = (id: string, priority: Priority) => {
    setProspects((prev) => updatePriority(prev, id, priority));
  };
  const handleNotesChange = (id: string, notes: string) => {
    setProspects((prev) => updateNotes(prev, id, notes));
  };
  const handleUrlChange = (id: string, url: string) => {
    setProspects((prev) => updateUrl(prev, id, url));
  };
  const handleRemove = (id: string) => {
    setProspects((prev) => removeProspect(prev, id));
    toast.info("Prospect removed");
  };

  const handleClearAll = useCallback(() => {
    setProspects([]);
    clearProspects();
    toast.info("All prospects cleared");
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
            <Label htmlFor="lpb-niche">Niche / topic</Label>
            <div className="flex gap-2">
              <Input
                id="lpb-niche"
                value={niche}
                onChange={(e) => setNiche(e.target.value)}
                placeholder="e.g. seo, fitness, travel"
                className="text-sm"
              />
              <Button size="sm" onClick={handleGenerate} disabled={!niche.trim() || selectedCats.length === 0} className="gap-1">
                <ListFilter className="h-3.5 w-3.5" /> Generate
              </Button>
            </div>
            <div className="flex flex-wrap gap-1">
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
          <div>
            <Label className="text-xs">Footprint categories</Label>
            <div className="flex flex-wrap gap-2 pt-1">
              {(Object.keys(FOOTPRINTS) as FootprintCategory[]).map((c) => (
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

      {prospects.length > 0 ? (
        <>
          <Card>
            <CardContent className="p-4 space-y-2">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <Trophy className="h-4 w-4" /> Pipeline stats
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                <Stat label="Total prospects" value={stats.total} />
                <Stat label="Success rate" value={`${stats.successRate}%`} highlight={stats.successRate > 0 ? "good" : undefined} />
                <Stat label="Contact rate" value={`${stats.contactRate}%`} />
                <Stat label="Yes count" value={stats.byStatus.yes} highlight="good" />
              </div>
              <div className="flex flex-wrap gap-2 pt-1">
                {(Object.keys(STATUS_LABELS) as OutreachStatus[]).map((s) => (
                  <Badge key={s} variant="outline" className={STATUS_COLORS[s]}>
                    {STATUS_LABELS[s]}: {stats.byStatus[s]}
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-sm font-semibold text-foreground">Prospects ({filtered.length})</h3>
                <div className="flex flex-wrap gap-2">
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
                  <select
                    value={filterStatus}
                    onChange={(e) => setFilterStatus(e.target.value as OutreachStatus | "")}
                    className="h-8 text-xs rounded border bg-background px-2"
                  >
                    <option value="">All statuses</option>
                    {(Object.keys(STATUS_LABELS) as OutreachStatus[]).map((s) => (
                      <option key={s} value={s}>{STATUS_LABELS[s]}</option>
                    ))}
                  </select>
                  <Input
                    placeholder="Filter…"
                    value={filterQuery}
                    onChange={(e) => setFilterQuery(e.target.value)}
                    className="h-8 w-32 text-xs"
                  />
                </div>
              </div>
              <div className="space-y-2 max-h-[600px] overflow-auto">
                {filtered.map((p) => (
                  <div key={p.id} className="rounded border bg-background px-3 py-2 text-xs space-y-1.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="outline" className="text-[10px]">{CATEGORY_LABELS[p.category]}</Badge>
                      <Badge variant="outline" className={`text-[10px] ${PRIORITY_COLORS[p.priority]}`}>
                        {PRIORITY_LABELS[p.priority]}
                      </Badge>
                      <a
                        href={`https://www.google.com/search?q=${encodeURIComponent(p.query)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex-1 font-mono text-foreground truncate hover:text-primary hover:underline flex items-center gap-1"
                      >
                        {p.query}
                        <ExternalLink className="h-3 w-3 flex-shrink-0" />
                      </a>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => handleRemove(p.id)}
                        title="Remove"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <select
                        value={p.status}
                        onChange={(e) => handleStatusChange(p.id, e.target.value as OutreachStatus)}
                        className={`h-6 text-[10px] rounded border px-1 ${STATUS_COLORS[p.status]}`}
                      >
                        {(Object.keys(STATUS_LABELS) as OutreachStatus[]).map((s) => (
                          <option key={s} value={s}>{STATUS_LABELS[s]}</option>
                        ))}
                      </select>
                      <select
                        value={p.priority}
                        onChange={(e) => handlePriorityChange(p.id, e.target.value as Priority)}
                        className="h-6 text-[10px] rounded border px-1"
                      >
                        {(Object.keys(PRIORITY_LABELS) as Priority[]).map((pr) => (
                          <option key={pr} value={pr}>{PRIORITY_LABELS[pr]}</option>
                        ))}
                      </select>
                      <input
                        type="text"
                        placeholder="Contact URL"
                        value={p.url ?? ""}
                        onChange={(e) => handleUrlChange(p.id, e.target.value)}
                        className="h-6 text-[10px] rounded border px-1 flex-1 min-w-[100px]"
                      />
                    </div>
                    <input
                      type="text"
                      placeholder="Notes…"
                      value={p.notes}
                      onChange={(e) => handleNotesChange(p.id, e.target.value)}
                      className="h-6 text-[10px] rounded border px-1 w-full"
                    />
                  </div>
                ))}
              </div>
              <div className="flex flex-wrap gap-2 pt-2">
                <CopyButton getText={() => csv} label="Copy CSV" />
                <DownloadButton getText={() => csv} filename="link-prospects.csv" mime="text/csv" label="Download CSV" />
                <ShareButton getUrl={() => buildShareUrl(niche, selectedCats)} />
                <ClearButton onClick={handleClearAll} label="Clear all prospects" />
              </div>
            </CardContent>
          </Card>
        </>
      ) : (
        <EmptyState
          title="Generate a prospecting list"
          hint="Enter a niche, pick footprint categories, and click Generate. Each prospect opens a Google search. Status and notes persist in localStorage."
          icon={<ListFilter className="h-8 w-8" />}
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
                  <Badge variant="outline" className="mr-2">{h.niche}</Badge>
                  <Badge variant="outline" className="mr-2">{h.totalProspects} prospects</Badge>
                  <Badge variant="outline" className="mr-2">{h.successRate}% success</Badge>
                  <span className="text-muted-foreground">{new Date(h.ts).toLocaleString()}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-3">
          <p className="text-xs text-muted-foreground">
            <strong className="text-foreground">Privacy:</strong> All prospect generation runs locally. Prospects + history are stored in localStorage on this device only.
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
