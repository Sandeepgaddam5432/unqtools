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
  PLATFORM_LABELS,
  QUERY_TYPE_LABELS,
  DEFAULT_NEGATIVE_KEYWORDS,
  parseList,
  generateAllQueries,
  filterByType,
  computeStats,
  renderText,
  renderCsv,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  type QueryType,
  type MonitorInput,
  type HistoryEntry,
} from "./logic";
import { Radio, ExternalLink, History } from "lucide-react";

export default function BrandMentionMonitor() {
  const [brandName, setBrandName] = useState("");
  const [aliasesText, setAliasesText] = useState("");
  const [foundersText, setFoundersText] = useState("");
  const [competitorsText, setCompetitorsText] = useState("");
  const [nichesText, setNichesText] = useState("");
  const [negativesText, setNegativesText] = useState(DEFAULT_NEGATIVE_KEYWORDS.join(", "));
  const [filterType, setFilterType] = useState<QueryType | "all">("all");
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  useEffect(() => {
    setHistory(loadHistory());
    if (typeof window !== "undefined" && window.location.hash) {
      const p = parseShareUrl(window.location.hash);
      if (p.brandName) setBrandName(p.brandName);
      if (p.brandAliases?.length) setAliasesText(p.brandAliases.join(", "));
      if (p.founderNames?.length) setFoundersText(p.founderNames.join(", "));
      if (p.competitorNames?.length) setCompetitorsText(p.competitorNames.join(", "));
      if (p.nicheKeywords?.length) setNichesText(p.nicheKeywords.join(", "));
      if (p.negativeKeywords?.length) setNegativesText(p.negativeKeywords.join(", "));
      if (p.brandName) toast.info("Loaded from share link");
    }
  }, []);

  const input: MonitorInput = useMemo(
    () => ({
      brandName: brandName.trim(),
      brandAliases: parseList(aliasesText),
      founderNames: parseList(foundersText),
      competitorNames: parseList(competitorsText),
      nicheKeywords: parseList(nichesText),
      negativeKeywords: parseList(negativesText),
    }),
    [brandName, aliasesText, foundersText, competitorsText, nichesText, negativesText],
  );

  const allQueries = useMemo(() => generateAllQueries(input), [input]);
  const filteredQueries = useMemo(
    () => filterByType(allQueries, filterType),
    [allQueries, filterType],
  );
  const stats = useMemo(() => computeStats(allQueries), [allQueries]);
  const text = useMemo(() => renderText(filteredQueries), [filteredQueries]);
  const csv = useMemo(() => renderCsv(filteredQueries), [filteredQueries]);

  const handleSaveHistory = useCallback(() => {
    if (allQueries.length > 0) {
      saveHistory({
        ts: Date.now(),
        brandName: input.brandName,
        aliasCount: input.brandAliases?.length ?? 0,
        competitorCount: input.competitorNames?.length ?? 0,
        nicheCount: input.nicheKeywords?.length ?? 0,
        founderCount: input.founderNames?.length ?? 0,
        totalQueries: allQueries.length,
      });
      setHistory(loadHistory());
    }
  }, [allQueries, input]);

  const handleClear = useCallback(() => {
    setBrandName("");
    setAliasesText("");
    setFoundersText("");
    setCompetitorsText("");
    setNichesText("");
    setNegativesText(DEFAULT_NEGATIVE_KEYWORDS.join(", "));
    setFilterType("all");
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
            <Label htmlFor="bmm-brand">Brand name *</Label>
            <Input
              id="bmm-brand"
              value={brandName}
              onChange={(e) => setBrandName(e.target.value)}
              placeholder="UnQTools"
            />
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="bmm-aliases">Brand aliases (comma-separated)</Label>
              <Input
                id="bmm-aliases"
                value={aliasesText}
                onChange={(e) => setAliasesText(e.target.value)}
                placeholder="UnQ Tools, unq-tools"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="bmm-founders">Founder names (comma-separated)</Label>
              <Input
                id="bmm-founders"
                value={foundersText}
                onChange={(e) => setFoundersText(e.target.value)}
                placeholder="Sandeep Gaddam"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="bmm-competitors">Competitor names (comma-separated)</Label>
              <Input
                id="bmm-competitors"
                value={competitorsText}
                onChange={(e) => setCompetitorsText(e.target.value)}
                placeholder="SmallPDF, iLovePDF"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="bmm-niches">Niche keywords (comma-separated)</Label>
              <Input
                id="bmm-niches"
                value={nichesText}
                onChange={(e) => setNichesText(e.target.value)}
                placeholder="pdf tools, online utilities"
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="bmm-negatives">Negative keywords (for Google Alerts)</Label>
            <Input
              id="bmm-negatives"
              value={negativesText}
              onChange={(e) => setNegativesText(e.target.value)}
              placeholder="coupon, review, scam"
            />
          </div>
        </CardContent>
      </Card>

      {allQueries.length > 0 ? (
        <>
          <Card>
            <CardContent className="p-4 space-y-2">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <Radio className="h-4 w-4" /> {allQueries.length} queries generated
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                <Stat label="Total queries" value={stats.total} />
                <Stat label="Unique subjects" value={stats.uniqueSubjects} />
                <Stat label="Platforms" value={Object.keys(stats.byPlatform).length} />
                <Stat label="Query types" value={Object.keys(stats.byType).filter((k) => stats.byType[k as QueryType] > 0).length} />
              </div>
              <div className="space-y-1 pt-2">
                <div className="text-xs font-medium text-foreground">By type</div>
                <div className="flex flex-wrap gap-1.5">
                  {(Object.keys(QUERY_TYPE_LABELS) as QueryType[]).map((t) => (
                    <Badge
                      key={t}
                      variant={stats.byType[t] > 0 ? "secondary" : "outline"}
                      className="text-[10px]"
                    >
                      {QUERY_TYPE_LABELS[t]}: {stats.byType[t]}
                    </Badge>
                  ))}
                </div>
              </div>
              <div className="space-y-1 pt-1">
                <div className="text-xs font-medium text-foreground">By platform</div>
                <div className="flex flex-wrap gap-1.5">
                  {Object.entries(stats.byPlatform).map(([p, count]) => (
                    <Badge key={p} variant="outline" className="text-[10px]">
                      {PLATFORM_LABELS[p as QueryType extends never ? never : keyof typeof PLATFORM_LABELS]}: {count}
                    </Badge>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                  <Radio className="h-4 w-4" /> Queries ({filteredQueries.length})
                </h3>
                <select
                  value={filterType}
                  onChange={(e) => setFilterType(e.target.value as QueryType | "all")}
                  className="h-8 text-xs rounded border bg-background px-2"
                >
                  <option value="all">All types</option>
                  {(Object.keys(QUERY_TYPE_LABELS) as QueryType[]).map((t) => (
                    <option key={t} value={t}>{QUERY_TYPE_LABELS[t]}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1 max-h-[500px] overflow-auto">
                {filteredQueries.map((q, i) => (
                  <div key={i} className="rounded border bg-background px-3 py-1.5 text-xs">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge variant="outline" className="text-[10px]">{QUERY_TYPE_LABELS[q.queryType]}</Badge>
                      <Badge variant="secondary" className="text-[10px]">{PLATFORM_LABELS[q.platform]}</Badge>
                      <span className="font-mono font-medium text-foreground">{q.subject}</span>
                    </div>
                    <div className="font-mono text-[10px] text-muted-foreground truncate">{q.query}</div>
                    <a
                      href={q.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-1 inline-flex items-center gap-1 text-primary hover:underline text-[10px] break-all"
                    >
                      {q.url}
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
                  filename="brand-mention-queries.txt"
                  mime="text/plain"
                  label="Download .txt"
                />
                <DownloadButton
                  getText={() => csv}
                  filename="brand-mention-queries.csv"
                  mime="text/csv"
                  label="Download CSV"
                />
                <ShareButton getUrl={() => { handleSaveHistory(); return buildShareUrl(input); }} />
                <ClearButton onClick={handleClear} />
              </div>
            </CardContent>
          </Card>
        </>
      ) : (
        <EmptyState
          title="Enter a brand name to generate monitoring queries"
          hint="We'll generate Google Alerts queries + social/news search URLs for your brand, aliases, founders, competitors, niche keywords, and backlink opportunities."
          icon={<Radio className="h-8 w-8" />}
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
                  <Badge variant="outline" className="mr-2">{h.totalQueries} queries</Badge>
                  {h.aliasCount > 0 && <Badge variant="outline" className="mr-2">{h.aliasCount} aliases</Badge>}
                  {h.competitorCount > 0 && <Badge variant="outline" className="mr-2">{h.competitorCount} competitors</Badge>}
                  {h.nicheCount > 0 && <Badge variant="outline" className="mr-2">{h.nicheCount} niches</Badge>}
                  {h.founderCount > 0 && <Badge variant="outline" className="mr-2">{h.founderCount} founders</Badge>}
                  <span className="text-foreground font-medium ml-1">{h.brandName}</span>
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
            <strong className="text-foreground">Privacy:</strong> All query generation runs locally. The generated URLs open external sites when clicked but the tool itself makes no network requests. History is stored in localStorage on this device only.
          </p>
        </CardContent>
      </Card>
    </div>
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
