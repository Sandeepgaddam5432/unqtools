"use client";

import React, { useState, useMemo, useCallback, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  CopyButton,
  DownloadButton,
  EmptyState,
  ShareButton,
  ClearButton,
} from "../../_shared";
import { toast } from "sonner";
import {
  parseBulk,
  classifyBulk,
  renderCsv,
  getPatternReference,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  type IntentType,
  type HistoryEntry,
} from "./logic";
import { History, Brain, BookOpen } from "lucide-react";

const INTENT_COLORS: Record<IntentType, string> = {
  informational: "bg-sky-500/15 text-sky-700 dark:text-sky-400 border-sky-500/30",
  navigational: "bg-violet-500/15 text-violet-700 dark:text-violet-400 border-violet-500/30",
  transactional: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30",
  commercial: "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30",
};

export default function SearchIntentClassifier() {
  const [bulkText, setBulkText] = useState("");
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [showReference, setShowReference] = useState(false);

  useEffect(() => {
    setHistory(loadHistory());
    if (typeof window !== "undefined" && window.location.hash) {
      const p = parseShareUrl(window.location.hash);
      if (p.keywords) {
        setBulkText(p.keywords);
        toast.info("Loaded from share link");
      }
    }
  }, []);

  const keywords = useMemo(() => parseBulk(bulkText), [bulkText]);
  const bulk = useMemo(() => classifyBulk(keywords), [keywords]);
  const csv = useMemo(() => renderCsv(bulk), [bulk]);
  const reference = useMemo(() => getPatternReference(), []);

  const handleSaveHistory = useCallback(() => {
    if (bulk.total > 0) {
      saveHistory({ ts: Date.now(), keywordCount: bulk.total, distribution: bulk.distribution });
      setHistory(loadHistory());
    }
  }, [bulk.total, bulk.distribution]);

  const handleClear = useCallback(() => {
    setBulkText("");
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
            <Label htmlFor="sic-bulk">Keywords (one per line or comma-separated)</Label>
            <Textarea
              id="sic-bulk"
              value={bulkText}
              onChange={(e) => setBulkText(e.target.value)}
              placeholder={"what is seo\nbuy nike shoes online\nahrefs login\nbest seo tools 2026"}
              className="min-h-[120px] resize-y font-mono text-xs"
            />
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowReference((v) => !v)}
            className="gap-1.5"
          >
            <BookOpen className="h-3.5 w-3.5" /> {showReference ? "Hide" : "Show"} pattern reference
          </Button>
        </CardContent>
      </Card>

      {showReference && (
        <Card>
          <CardContent className="p-4 space-y-2">
            <h3 className="text-sm font-semibold text-foreground">Intent pattern reference</h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
              {(Object.keys(INTENT_COLORS) as IntentType[]).map((intent) => (
                <div key={intent} className="space-y-1">
                  <div className={`rounded border px-2 py-1 font-medium ${INTENT_COLORS[intent]}`}>
                    {intent}
                  </div>
                  <ul className="space-y-0.5">
                    {reference.filter((r) => r.intent === intent).map((r, i) => (
                      <li key={i} className="text-muted-foreground">
                        <code className="text-foreground">{r.pattern}</code> <span className="text-[10px]">×{r.weight}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {bulk.total > 0 ? (
        <>
          <Card>
            <CardContent className="p-4 space-y-3">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <Brain className="h-4 w-4" /> Distribution
              </h3>
              <div className="flex flex-wrap gap-2 text-xs">
                <Badge variant="outline">{bulk.total} keywords</Badge>
                <Badge variant="outline">avg confidence: {bulk.averageConfidence}%</Badge>
                {(Object.keys(bulk.distribution) as IntentType[]).map((intent) =>
                  bulk.distribution[intent] > 0 ? (
                    <span key={intent} className={`rounded border px-2 py-0.5 ${INTENT_COLORS[intent]}`}>
                      {intent}: {bulk.distribution[intent]}
                    </span>
                  ) : null,
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 space-y-3">
              <h3 className="text-sm font-semibold text-foreground">Per-keyword classification</h3>
              <div className="space-y-2 max-h-[500px] overflow-auto">
                {bulk.results.map((r, i) => (
                  <div key={i} className="rounded border bg-background p-3 text-xs space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="font-mono text-foreground flex-1 min-w-0 truncate">{r.keyword}</div>
                      <span className={`rounded border px-2 py-0.5 ${INTENT_COLORS[r.primaryIntent]}`}>
                        {r.primaryIntent}
                      </span>
                      <Badge variant="secondary">{r.confidence}%</Badge>
                      {r.isMixed && <Badge variant="outline">mixed</Badge>}
                    </div>
                    {r.matchedPatterns.length > 0 && (
                      <div className="text-muted-foreground">
                        Matched: <code className="text-foreground">{r.matchedPatterns.join(", ")}</code>
                      </div>
                    )}
                    <div className="text-foreground italic">{r.contentRecommendation}</div>
                    <div className="text-muted-foreground text-[11px]">
                      <strong className="text-foreground">SERP features to target:</strong> {r.serpFeature}
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex flex-wrap gap-2 pt-2">
                <CopyButton
                  getText={() => {
                    handleSaveHistory();
                    return csv;
                  }}
                  label="Copy CSV"
                />
                <DownloadButton
                  getText={() => {
                    handleSaveHistory();
                    return csv;
                  }}
                  filename="search-intent.csv"
                  mime="text/csv"
                  label="Download CSV"
                />
                <ShareButton
                  getUrl={() => {
                    handleSaveHistory();
                    return buildShareUrl(bulkText);
                  }}
                />
                <ClearButton onClick={handleClear} />
              </div>
            </CardContent>
          </Card>
        </>
      ) : (
        <EmptyState
          title="Enter keywords to classify search intent"
          hint="Each keyword is classified as informational, transactional, navigational, or commercial based on word patterns."
          icon={<Brain className="h-8 w-8" />}
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
                  <Badge variant="outline" className="mr-2">{h.keywordCount} keywords</Badge>
                  {(Object.keys(h.distribution) as IntentType[]).map((intent) =>
                    h.distribution[intent] > 0 ? (
                      <Badge key={intent} variant="outline" className="mr-1">{intent}: {h.distribution[intent]}</Badge>
                    ) : null,
                  )}
                  <span className="text-muted-foreground ml-2">{new Date(h.ts).toLocaleString()}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-3">
          <p className="text-xs text-muted-foreground">
            <strong className="text-foreground">Privacy:</strong> Intent
            classification runs locally using word-pattern heuristics. History is
            stored in localStorage on this device only.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
