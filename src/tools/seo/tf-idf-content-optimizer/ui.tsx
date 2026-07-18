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
  analyze,
  renderCsv,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  type HistoryEntry,
} from "./logic";
import { History, BarChart3, AlertTriangle } from "lucide-react";

export default function TfIdfContentOptimizer() {
  const [primary, setPrimary] = useState("");
  const [comp1, setComp1] = useState("");
  const [comp2, setComp2] = useState("");
  const [comp3, setComp3] = useState("");
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  useEffect(() => {
    setHistory(loadHistory());
    if (typeof window !== "undefined" && window.location.hash) {
      const p = parseShareUrl(window.location.hash);
      if (p.primary) {
        setPrimary(p.primary);
        setComp1(p.competitors[0] ?? "");
        setComp2(p.competitors[1] ?? "");
        setComp3(p.competitors[2] ?? "");
        toast.info("Loaded from share link");
      }
    }
  }, []);

  const competitors = useMemo(
    () => [comp1, comp2, comp3].filter((c) => c.trim().length > 0),
    [comp1, comp2, comp3],
  );
  const result = useMemo(() => analyze(primary, competitors), [primary, competitors]);
  const csv = useMemo(() => renderCsv(result), [result]);

  const maxCloud = result.cloudData.length > 0 ? result.cloudData[0].value : 1;

  const handleSaveHistory = useCallback(() => {
    if (primary.trim()) {
      saveHistory({
        ts: Date.now(),
        totalWords: result.totalWords,
        uniqueTerms: result.uniqueTerms,
        contentScore: result.contentScore,
        competitorCount: competitors.length,
        snippet: primary.slice(0, 80),
      });
      setHistory(loadHistory());
    }
  }, [primary, result.totalWords, result.uniqueTerms, result.contentScore, competitors.length]);

  const handleClear = useCallback(() => {
    setPrimary("");
    setComp1("");
    setComp2("");
    setComp3("");
    toast.info("Form cleared");
  }, []);

  const handleClearHistory = useCallback(() => {
    clearHistory();
    setHistory([]);
    toast.success("History cleared");
  }, []);

  const scoreColor = result.contentScore >= 75
    ? "text-emerald-600 dark:text-emerald-400"
    : result.contentScore >= 50
      ? "text-amber-600 dark:text-amber-400"
      : "text-red-600 dark:text-red-400";

  return (
    <div className="space-y-4 unq-animate-fade-in-up">
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="tfidf-primary">Your content</Label>
            <Textarea
              id="tfidf-primary"
              value={primary}
              onChange={(e) => setPrimary(e.target.value)}
              placeholder="Paste your article or blog post..."
              className="min-h-[150px] resize-y text-xs"
            />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="tfidf-c1" className="text-xs">Competitor 1</Label>
              <Textarea
                id="tfidf-c1"
                value={comp1}
                onChange={(e) => setComp1(e.target.value)}
                placeholder="Paste competitor content..."
                className="min-h-[100px] resize-y text-xs"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="tfidf-c2" className="text-xs">Competitor 2</Label>
              <Textarea
                id="tfidf-c2"
                value={comp2}
                onChange={(e) => setComp2(e.target.value)}
                placeholder="Paste competitor content..."
                className="min-h-[100px] resize-y text-xs"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="tfidf-c3" className="text-xs">Competitor 3</Label>
              <Textarea
                id="tfidf-c3"
                value={comp3}
                onChange={(e) => setComp3(e.target.value)}
                placeholder="Paste competitor content..."
                className="min-h-[100px] resize-y text-xs"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {primary.trim() ? (
        <>
          <Card>
            <CardContent className="p-4 space-y-2">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <BarChart3 className="h-4 w-4" /> Summary
              </h3>
              <div className="flex flex-wrap gap-2 text-xs">
                <Badge variant="outline">{result.totalWords} words (filtered)</Badge>
                <Badge variant="outline">{result.uniqueTerms} unique terms</Badge>
                <Badge variant="outline">{competitors.length} competitors</Badge>
                <Badge variant="outline" className={scoreColor}>
                  content score: {result.contentScore}/100
                </Badge>
                {result.missingTerms.length > 0 && (
                  <Badge variant="secondary">{result.missingTerms.length} missing terms</Badge>
                )}
                {result.overOptimized.length > 0 && (
                  <Badge variant="destructive" className="gap-1">
                    <AlertTriangle className="h-3 w-3" /> {result.overOptimized.length} over-optimized
                  </Badge>
                )}
              </div>
            </CardContent>
          </Card>

          {result.overOptimized.length > 0 && (
            <div className="rounded-md border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-700 dark:text-amber-400 space-y-1">
              <div className="font-medium">Over-optimization warnings</div>
              {result.overOptimized.slice(0, 5).map((o, i) => (
                <div key={i} className="text-xs">
                  • <code className="text-foreground">{o.term}</code> — your TF {(o.yourTf * 100).toFixed(1)}% vs competitor avg {(o.competitorAvgTf * 100).toFixed(1)}% ({(o.yourTf / o.competitorAvgTf).toFixed(1)}× higher)
                </div>
              ))}
            </div>
          )}

          {result.missingTerms.length > 0 && (
            <Card>
              <CardContent className="p-4 space-y-2">
                <h3 className="text-sm font-semibold text-foreground">
                  Missing terms (in competitors, not in yours)
                </h3>
                <div className="flex flex-wrap gap-1.5">
                  {result.missingTerms.map((t) => (
                    <span key={t} className="rounded border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-xs text-amber-700 dark:text-amber-400">
                      {t}
                    </span>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {result.cloudData.length > 0 && (
            <Card>
              <CardContent className="p-4 space-y-2">
                <h3 className="text-sm font-semibold text-foreground">Word cloud (top terms)</h3>
                <div className="flex flex-wrap gap-2 items-baseline">
                  {result.cloudData.slice(0, 30).map((c) => {
                    const sizePct = c.value / maxCloud;
                    const fontSize = 0.8 + sizePct * 1.5;
                    return (
                      <span
                        key={c.text}
                        className="font-medium text-foreground"
                        style={{ fontSize: `${fontSize}rem` }}
                      >
                        {c.text}
                      </span>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardContent className="p-4 space-y-3">
              <h3 className="text-sm font-semibold text-foreground">Top terms by TF-IDF</h3>
              <div className="space-y-1 max-h-[400px] overflow-auto">
                {result.topTerms.map((t, i) => (
                  <div key={i} className="flex items-center gap-2 rounded border bg-background px-3 py-1.5 text-xs">
                    <div className="w-6 text-muted-foreground">{i + 1}.</div>
                    <div className="flex-1 font-mono text-foreground">{t.term}</div>
                    <Badge variant="outline" className="text-xs">{t.count}× in primary</Badge>
                    <Badge variant="secondary" className="text-xs">{t.competitorCount}/{competitors.length} comps</Badge>
                    <div className="w-20 text-right text-muted-foreground text-xs">tfidf {t.tfidf.toFixed(3)}</div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <div className="flex flex-wrap gap-2">
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
              filename="tfidf-analysis.csv"
              mime="text/csv"
              label="Download CSV"
            />
            <ShareButton
              getUrl={() => {
                handleSaveHistory();
                return buildShareUrl({ primary, competitors: [comp1, comp2, comp3] });
              }}
            />
            <ClearButton onClick={handleClear} />
          </div>
        </>
      ) : (
        <EmptyState
          title="Paste your content to analyze with TF-IDF"
          hint="Optionally add up to 3 competitor documents to find missing terms and over-optimization."
          icon={<BarChart3 className="h-8 w-8" />}
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
                  <Badge variant="outline" className="mr-2">{h.totalWords} words</Badge>
                  <Badge variant="outline" className="mr-2">{h.uniqueTerms} terms</Badge>
                  <Badge variant="outline" className="mr-2">score {h.contentScore}</Badge>
                  <Badge variant="outline" className="mr-2">{h.competitorCount} comps</Badge>
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
            <strong className="text-foreground">Privacy:</strong> TF-IDF
            computation runs locally. Stop words are filtered. History is stored
            in localStorage on this device only.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
