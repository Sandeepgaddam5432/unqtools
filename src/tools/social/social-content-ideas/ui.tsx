"use client";

import React, { useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ErrorBanner, CopyButton, DownloadButton } from "../../_shared";
import {
  getAllFormats,
  expandKeyword,
  hookTemplates,
  hashtagIdeas,
  weeklyCalendar,
  generateIdeas,
  scoreIdea,
  validateKeyword,
  exportIdeasCSV,
  exportIdeasText,
  sortByVirality,
  groupByFormat,
  TRENDING_CATEGORIES,
} from "./logic";

export default function SocialContentIdeas() {
  const [keyword, setKeyword] = useState<string>("productivity");
  const [count, setCount] = useState<string>("10");
  const [sortBy, setSortBy] = useState<boolean>(true);
  const [error, setError] = useState<string>("");

  const warnings = useMemo(() => validateKeyword(keyword), [keyword]);
  const angles = useMemo(() => expandKeyword(keyword), [keyword]);
  const hooks = useMemo(() => hookTemplates(keyword), [keyword]);
  const tags = useMemo(() => hashtagIdeas(keyword), [keyword]);
  const calendar = useMemo(() => weeklyCalendar(keyword), [keyword]);
  const ideas = useMemo(() => {
    const list = generateIdeas(keyword, Number(count) || 10);
    return sortBy ? sortByVirality(list) : list;
  }, [keyword, count, sortBy]);
  const grouped = useMemo(() => groupByFormat(ideas), [ideas]);

  return (
    <div className="space-y-4">
      {error && <ErrorBanner message={error} />}

      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1 sm:col-span-2">
              <Label className="text-xs text-muted-foreground">Primary keyword / topic</Label>
              <input value={keyword} onChange={(e) => setKeyword(e.target.value)} className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-xs" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Number of ideas</Label>
              <input type="number" min={1} max={20} value={count} onChange={(e) => setCount(e.target.value)} className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-xs" />
            </div>
          </div>
          {warnings.length > 0 && (
            <ul className="text-xs text-amber-700 dark:text-amber-400 list-disc pl-4">
              {warnings.map((w, i) => <li key={i}>{w}</li>)}
            </ul>
          )}
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Trending categories (click to use)</Label>
            <div className="flex flex-wrap gap-1">
              {TRENDING_CATEGORIES.map((c) => (
                <button key={c} onClick={() => setKeyword(c)} className="px-2 py-0.5 text-[10px] rounded border border-border bg-muted/40 hover:bg-muted">
                  {c}
                </button>
              ))}
            </div>
          </div>
          <label className="flex items-center gap-1 text-xs">
            <input type="checkbox" checked={sortBy} onChange={(e) => setSortBy(e.target.checked)} /> Sort by virality score
          </label>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <h3 className="text-base font-semibold">{ideas.length} content ideas for "{keyword}"</h3>
            <div className="flex gap-2 flex-wrap">
              <CopyButton getText={() => exportIdeasText(ideas)} label="Copy text" />
              <DownloadButton getText={() => exportIdeasCSV(ideas)} filename={`content-ideas-${keyword}.csv`} mime="text/csv" label="CSV" />
              <DownloadButton getText={() => exportIdeasText(ideas)} filename={`content-ideas-${keyword}.txt`} label="TXT" />
            </div>
          </div>
          <div className="space-y-1.5">
            {ideas.map((idea) => (
              <div key={idea.id} className="rounded-md border border-border p-2 text-xs">
                <div className="flex items-center justify-between gap-2 mb-1">
                  <Badge variant="outline" className="text-[10px]">{idea.format.name}</Badge>
                  <span className="text-[10px] text-muted-foreground">reach: {idea.estimatedReach} · effort: {idea.format.effort}</span>
                  <Badge variant="outline" className={`text-[10px] ${scoreIdea(idea) > 60 ? "border-emerald-500/30 text-emerald-700" : scoreIdea(idea) > 40 ? "border-amber-500/30 text-amber-700" : "border-red-500/30 text-red-700"}`}>
                    {scoreIdea(idea)}/100
                  </Badge>
                </div>
                <p className="font-medium">{idea.angle}</p>
                <p className="text-muted-foreground mt-0.5">Hook: {idea.hook}</p>
                <div className="flex flex-wrap gap-1 mt-1">
                  {idea.hashtags.map((t) => (
                    <Badge key={t} variant="outline" className="text-[10px] font-mono">{t}</Badge>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4 space-y-3">
          <Label className="text-sm font-semibold">Content angles ({angles.length})</Label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1 text-xs">
            {angles.map((a, i) => (
              <div key={i} className="rounded border border-border/40 p-1.5">{a}</div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4 space-y-3">
          <Label className="text-sm font-semibold">Hooks &amp; hashtags</Label>
          <div className="space-y-1">
            {hooks.map((h, i) => (
              <div key={i} className="text-xs">
                <span className="text-muted-500">{i + 1}.</span> {h}
              </div>
            ))}
          </div>
          <div className="flex flex-wrap gap-1 pt-2">
            {tags.map((t) => (
              <Badge key={t} variant="outline" className="text-[10px] font-mono">{t}</Badge>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4 space-y-3">
          <Label className="text-sm font-semibold">Weekly calendar</Label>
          <div className="grid grid-cols-1 sm:grid-cols-7 gap-2">
            {calendar.map((c) => (
              <div key={c.day} className="rounded-md border border-border p-2 text-[10px]">
                <div className="font-medium">{c.day}</div>
                <div className="text-muted-500">{c.format.name}</div>
                <div className="mt-0.5">{c.idea}</div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4 space-y-3">
          <Label className="text-sm font-semibold">Grouped by format</Label>
          {Object.entries(grouped).map(([format, list]) => (
            <div key={format} className="text-xs">
              <span className="font-medium">{format}</span> ({list.length})
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
