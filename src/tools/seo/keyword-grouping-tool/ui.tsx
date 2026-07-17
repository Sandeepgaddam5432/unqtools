"use client";

import React, { useState, useMemo, useCallback, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { CopyButton, DownloadButton, EmptyState, ShareButton, ClearButton } from "../../_shared";
import { toast } from "sonner";
import {
  group,
  renderCsv,
  renderJson,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  type GroupingOptions,
  type HistoryEntry,
  type Intent,
} from "./logic";
import { History, Layers, FolderTree } from "lucide-react";

const INTENT_STYLES: Record<Intent, string> = {
  informational: "bg-blue-500/10 text-blue-700 dark:text-blue-400",
  transactional: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
  navigational: "bg-purple-500/10 text-purple-700 dark:text-purple-400",
  other: "bg-muted text-muted-foreground",
};

export default function KeywordGroupingTool() {
  const [keywordsText, setKeywordsText] = useState("");
  const [strategy, setStrategy] = useState<"common-word" | "intent">("common-word");
  const [minClusterSize, setMinClusterSize] = useState(2);
  const [removeStopWords, setRemoveStopWords] = useState(true);
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  useEffect(() => {
    setHistory(loadHistory());
    if (typeof window !== "undefined" && window.location.hash) {
      const p = parseShareUrl(window.location.hash);
      if (p.keywords) {
        setKeywordsText(p.keywords);
        setStrategy(p.options.strategy);
        setMinClusterSize(p.options.minClusterSize);
        setRemoveStopWords(p.options.removeStopWords);
        toast.info("Loaded from share link");
      }
    }
  }, []);

  const options: GroupingOptions = useMemo(
    () => ({ strategy, minClusterSize, removeStopWords }),
    [strategy, minClusterSize, removeStopWords],
  );

  const result = useMemo(() => {
    const kws = keywordsText
      .split(/[\n,]+/)
      .map((s) => s.trim())
      .filter(Boolean);
    return group(kws, options);
  }, [keywordsText, options]);

  const csv = useMemo(() => renderCsv(result), [result]);
  const json = useMemo(() => renderJson(result), [result]);

  const handleSaveHistory = useCallback(() => {
    if (result.totalKeywords > 0) {
      saveHistory({
        ts: Date.now(),
        totalKeywords: result.totalKeywords,
        clusterCount: result.clusters.length,
        strategy,
      });
      setHistory(loadHistory());
    }
  }, [result, strategy]);

  const handleClear = useCallback(() => {
    setKeywordsText("");
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
            <Label htmlFor="kg-keywords">Keywords (one per line or comma-separated)</Label>
            <Textarea
              id="kg-keywords"
              value={keywordsText}
              onChange={(e) => setKeywordsText(e.target.value)}
              placeholder={"how to do seo\nbest seo tools\nbuy seo software\nahrefs login"}
              className="min-h-[140px] resize-y font-mono text-xs"
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label htmlFor="kg-strategy">Strategy</Label>
              <select
                id="kg-strategy"
                value={strategy}
                onChange={(e) => setStrategy(e.target.value as "common-word" | "intent")}
                className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="common-word">Common word (topic)</option>
                <option value="intent">Intent classification</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="kg-min">Min cluster size: {minClusterSize}</Label>
              <input
                id="kg-min"
                type="range"
                min={1}
                max={10}
                step={1}
                value={minClusterSize}
                onChange={(e) => setMinClusterSize(parseInt(e.target.value, 10))}
                className="w-full cursor-pointer"
              />
            </div>
            <div className="flex items-center gap-2 pt-6">
              <Switch id="kg-stop" checked={removeStopWords} onCheckedChange={setRemoveStopWords} />
              <Label htmlFor="kg-stop" className="text-sm cursor-pointer">Skip stop words as head</Label>
            </div>
          </div>
        </CardContent>
      </Card>

      {result.totalKeywords > 0 ? (
        <>
          <Card>
            <CardContent className="p-4 space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                  <Layers className="h-4 w-4" /> {result.clusters.length} clusters · {result.totalKeywords} keywords
                </h3>
                <div className="flex flex-wrap gap-2">
                  <Badge variant="outline">info: {result.intentCounts.informational}</Badge>
                  <Badge variant="outline">trans: {result.intentCounts.transactional}</Badge>
                  <Badge variant="outline">nav: {result.intentCounts.navigational}</Badge>
                  <Badge variant="outline">other: {result.intentCounts.other}</Badge>
                  {result.duplicatesRemoved > 0 && (
                    <Badge variant="secondary">{result.duplicatesRemoved} dupes</Badge>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="space-y-2">
            {result.clusters.map((c, i) => (
              <Card key={i}>
                <CardContent className="p-3 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <FolderTree className="h-4 w-4 text-muted-foreground" />
                      <span className="font-mono text-sm font-semibold text-foreground">{c.name}</span>
                      <Badge variant="outline">{c.count}</Badge>
                    </div>
                    <span className={`rounded px-2 py-0.5 text-xs ${INTENT_STYLES[c.intent]}`}>{c.intent}</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {c.keywords.map((k, j) => (
                      <span key={j} className="rounded border bg-background px-2 py-0.5 text-xs font-mono">
                        {k}
                      </span>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="flex flex-wrap gap-2">
            <CopyButton
              getText={() => {
                handleSaveHistory();
                return csv;
              }}
              label="Copy CSV"
            />
            <CopyButton getText={() => json} label="Copy JSON" />
            <DownloadButton getText={() => csv} filename="keyword-groups.csv" mime="text/csv" label="CSV" />
            <DownloadButton getText={() => json} filename="keyword-groups.json" mime="application/json" label="JSON" />
            <ShareButton
              getUrl={() => {
                handleSaveHistory();
                return buildShareUrl({ keywords: keywordsText, options });
              }}
            />
            <ClearButton onClick={handleClear} />
          </div>
        </>
      ) : (
        <EmptyState
          title="Paste keywords to group them"
          hint="Group by common head term or by intent (informational / transactional / navigational)."
          icon={<Layers className="h-8 w-8" />}
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
                  <Badge variant="outline" className="mr-2">{h.totalKeywords} kws</Badge>
                  <Badge variant="outline" className="mr-2">{h.clusterCount} clusters</Badge>
                  <Badge variant="outline" className="mr-2">{h.strategy}</Badge>
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
            <strong className="text-foreground">Privacy:</strong> keyword grouping runs locally. History is stored in localStorage on this device only.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
