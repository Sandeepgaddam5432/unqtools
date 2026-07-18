"use client";

import React, { useState, useMemo, useCallback, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  CopyButton,
  DownloadButton,
  EmptyState,
  ShareButton,
  ClearButton,
} from "../../_shared";
import { toast } from "sonner";
import {
  parseSeeds,
  generate,
  sortKeywords,
  renderCsv,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  difficultyCategory,
  type ModifierOptions,
  type SortField,
  type SortDir,
  type HistoryEntry,
} from "./logic";
import { History, Search, ArrowDownUp, TrendingUp, TrendingDown } from "lucide-react";

const DIFF_COLORS: Record<string, string> = {
  Easy: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30",
  Medium: "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30",
  Hard: "bg-orange-500/15 text-orange-700 dark:text-orange-400 border-orange-500/30",
  "Very Hard": "bg-red-500/15 text-red-700 dark:text-red-400 border-red-500/30",
};

export default function KeywordResearchExplorer() {
  const [seedsText, setSeedsText] = useState("");
  const [synonyms, setSynonyms] = useState(true);
  const [related, setRelated] = useState(true);
  const [questions, setQuestions] = useState(true);
  const [comparisons, setComparisons] = useState(true);
  const [intent, setIntent] = useState(true);
  const [sortField, setSortField] = useState<SortField>("volume");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  useEffect(() => {
    setHistory(loadHistory());
    if (typeof window !== "undefined" && window.location.hash) {
      const p = parseShareUrl(window.location.hash);
      if (p.seeds) {
        setSeedsText(p.seeds);
        setSynonyms(!!p.options.synonyms);
        setRelated(!!p.options.related);
        setQuestions(!!p.options.questions);
        setComparisons(!!p.options.comparisons);
        setIntent(!!p.options.intent);
        toast.info("Loaded from share link");
      }
    }
  }, []);

  const options: ModifierOptions = useMemo(
    () => ({ synonyms, related, questions, comparisons, intent }),
    [synonyms, related, questions, comparisons, intent],
  );

  const seeds = useMemo(() => parseSeeds(seedsText), [seedsText]);
  const result = useMemo(() => generate(seeds, options), [seeds, options]);
  const sorted = useMemo(
    () => sortKeywords(result.keywords, sortField, sortDir),
    [result.keywords, sortField, sortDir],
  );
  const csv = useMemo(() => renderCsv(result), [result]);

  const handleSaveHistory = useCallback(() => {
    if (result.total > 0) {
      saveHistory({ ts: Date.now(), seedCount: seeds.length, total: result.total, options });
      setHistory(loadHistory());
    }
  }, [result.total, seeds.length, options]);

  const handleClear = useCallback(() => {
    setSeedsText("");
    toast.info("Form cleared");
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
            <Label htmlFor="kre-seeds">Seed keywords (one per line or comma-separated)</Label>
            <Textarea
              id="kre-seeds"
              value={seedsText}
              onChange={(e) => setSeedsText(e.target.value)}
              placeholder={"SEO\ncontent marketing\nemail automation"}
              className="min-h-[100px] resize-y font-mono text-xs"
            />
          </div>
          <div className="flex flex-wrap gap-4">
            <Toggle id="kre-syn" checked={synonyms} onChange={setSynonyms} label="Synonyms" />
            <Toggle id="kre-rel" checked={related} onChange={setRelated} label="Related" />
            <Toggle id="kre-q" checked={questions} onChange={setQuestions} label="Questions (7 Ws)" />
            <Toggle id="kre-c" checked={comparisons} onChange={setComparisons} label="Comparisons" />
            <Toggle id="kre-i" checked={intent} onChange={setIntent} label="Intent" />
          </div>
        </CardContent>
      </Card>

      {result.total > 0 ? (
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <Search className="h-4 w-4" /> {result.total} suggestions
              </h3>
              <div className="flex flex-wrap gap-2">
                {Object.entries(result.byCategory).map(([cat, count]) => (
                  <Badge key={cat} variant="outline">{cat}: {count}</Badge>
                ))}
                {result.duplicatesRemoved > 0 && (
                  <Badge variant="secondary">{result.duplicatesRemoved} dupes removed</Badge>
                )}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="text-muted-foreground flex items-center gap-1">
                <ArrowDownUp className="h-3 w-3" /> Sort:
              </span>
              {(["volume", "difficulty", "keyword", "category"] as SortField[]).map((f) => (
                <Button
                  key={f}
                  size="sm"
                  variant={sortField === f ? "default" : "outline"}
                  onClick={() => setSortField(f)}
                  className="h-7 text-xs"
                >
                  {f}
                </Button>
              ))}
              <Button
                size="sm"
                variant="outline"
                onClick={() => setSortDir((d) => (d === "asc" ? "desc" : "asc"))}
                className="h-7 text-xs gap-1"
              >
                {sortDir === "desc" ? <TrendingDown className="h-3 w-3" /> : <TrendingUp className="h-3 w-3" />}
                {sortDir}
              </Button>
            </div>

            <div className="space-y-1 max-h-[500px] overflow-auto">
              {sorted.map((k, i) => {
                const cat = difficultyCategory(k.difficulty);
                return (
                  <div
                    key={i}
                    className="flex items-center gap-2 rounded border bg-background px-3 py-1.5 text-xs"
                  >
                    <div className="flex-1 font-mono text-foreground truncate">{k.keyword}</div>
                    <Badge variant="outline" className="text-xs">{k.category}</Badge>
                    <Badge variant="secondary" className="text-xs">vol: {k.volume}</Badge>
                    <span className={`text-xs rounded border px-1.5 py-0.5 ${DIFF_COLORS[cat]}`}>
                      {k.difficulty} · {cat}
                    </span>
                  </div>
                );
              })}
            </div>

            <div className="flex flex-wrap gap-2 pt-2">
              <CopyButton
                getText={() => {
                  handleSaveHistory();
                  return sorted.map((k) => k.keyword).join("\n");
                }}
                label="Copy list"
              />
              <DownloadButton
                getText={() => {
                  handleSaveHistory();
                  return csv;
                }}
                filename="keyword-research.csv"
                mime="text/csv"
                label="Download CSV"
              />
              <ShareButton
                getUrl={() => {
                  handleSaveHistory();
                  return buildShareUrl({ seeds: seedsText, options });
                }}
              />
              <ClearButton onClick={handleClear} />
            </div>
          </CardContent>
        </Card>
      ) : (
        <EmptyState
          title="Enter seed keywords to explore"
          hint="Generates synonyms, related terms, questions, comparisons, and intent variants with algorithmic volume & difficulty."
          icon={<Search className="h-8 w-8" />}
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
                  <Badge variant="outline" className="mr-2">{h.seedCount} seeds</Badge>
                  <Badge variant="outline" className="mr-2">{h.total} keywords</Badge>
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
            <strong className="text-foreground">Privacy:</strong> Keyword
            generation runs locally. Volume &amp; difficulty are algorithmic
            estimates — not live API data. History is stored in localStorage on
            this device only.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function Toggle({
  id,
  checked,
  onChange,
  label,
}: {
  id: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <div className="flex items-center gap-2">
      <Switch id={id} checked={checked} onCheckedChange={onChange} />
      <Label htmlFor={id} className="text-sm cursor-pointer">{label}</Label>
    </div>
  );
}
