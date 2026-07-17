"use client";

import React, { useState, useMemo, useCallback, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
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
  analyze,
  renderCsv,
  generateCloudData,
  buildShareUrl,
  parseShareUrl,
  loadHistory,
  saveHistory,
  clearHistory,
  type KeywordHit,
  type HistoryEntry,
} from "./logic";
import { History, Search, AlertTriangle } from "lucide-react";

function KeywordTable({ hits, title }: { hits: KeywordHit[]; title: string }) {
  if (hits.length === 0) {
    return (
      <div className="text-xs text-muted-foreground py-2">No {title.toLowerCase()} found.</div>
    );
  }
  const maxCount = Math.max(...hits.map((h) => h.count));
  return (
    <div className="space-y-1">
      {hits.map((h, i) => {
        const pct = (h.count / maxCount) * 100;
        const overStuff = h.density > 3;
        return (
          <div
            key={i}
            className="flex items-center gap-2 rounded border bg-background px-3 py-1.5 text-xs"
          >
            <div className="w-6 text-muted-foreground">{i + 1}.</div>
            <div className="flex-1 font-medium truncate">{h.phrase}</div>
            <div className="w-24 h-3 bg-muted rounded overflow-hidden flex-shrink-0">
              <div
                className={`h-full ${overStuff ? "bg-red-500/70" : "bg-primary/60"}`}
                style={{ width: `${pct}%` }}
                aria-hidden="true"
              />
            </div>
            <div className={`w-20 text-right ${overStuff ? "text-red-600 dark:text-red-400 font-medium" : "text-muted-foreground"}`}>
              {h.count}× · {h.density.toFixed(2)}%
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function KeywordDensityAnalyzer() {
  const [text, setText] = useState("");
  const [excludeStopWords, setExcludeStopWords] = useState(true);
  const [customExclude, setCustomExclude] = useState("");
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  useEffect(() => {
    setHistory(loadHistory());
    if (typeof window !== "undefined" && window.location.hash) {
      const parsed = parseShareUrl(window.location.hash);
      if (parsed.text) {
        setText(parsed.text);
        toast.info("Loaded from share link");
      }
    }
  }, []);

  const customExcludeList = useMemo(
    () =>
      customExclude
        .split(/[,\n]+/)
        .map((s) => s.trim())
        .filter(Boolean),
    [customExclude],
  );

  const analysis = useMemo(
    () => analyze(text, { excludeStopWords, customExclude: customExcludeList }),
    [text, excludeStopWords, customExcludeList],
  );

  const cloudData = useMemo(() => generateCloudData(analysis.oneWord), [analysis.oneWord]);
  const csvOutput = useMemo(() => renderCsv(analysis), [analysis]);

  const handleSaveHistory = useCallback(() => {
    if (text.trim()) {
      saveHistory({
        ts: Date.now(),
        wordCount: analysis.totalWords,
        uniqueWords: analysis.uniqueWords,
        stuffingWarnings: analysis.stuffingWarnings.length,
        snippet: text.slice(0, 100),
      });
      setHistory(loadHistory());
    }
  }, [text, analysis.totalWords, analysis.uniqueWords, analysis.stuffingWarnings.length]);

  const handleClear = useCallback(() => {
    setText("");
    setCustomExclude("");
    toast.info("Text cleared");
  }, []);

  const handleClearHistory = useCallback(() => {
    clearHistory();
    setHistory([]);
    toast.success("History cleared");
  }, []);

  const maxCloudValue = cloudData.length > 0 ? Math.max(...cloudData.map((c) => c.value)) : 1;

  return (
    <div className="space-y-4 unq-animate-fade-in-up">
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <Label htmlFor="kda-text">Paste your content</Label>
            <div className="flex gap-2">
              <ShareButton getUrl={() => { handleSaveHistory(); return buildShareUrl(text); }} />
              <ClearButton onClick={handleClear} />
            </div>
          </div>
          <Textarea
            id="kda-text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Paste your article, blog post, or any text. Density is computed in real time."
            className="min-h-[200px] resize-y"
          />
          <div className="flex flex-wrap gap-2 text-xs">
            <Badge variant="outline">{analysis.totalWords} total words</Badge>
            <Badge variant="outline">{analysis.uniqueWords} unique words</Badge>
            <Badge variant="outline">
              {analysis.totalWords > 0
                ? `${((analysis.uniqueWords / analysis.totalWords) * 100).toFixed(0)}% unique`
                : "0% unique"}
            </Badge>
            {analysis.stuffingWarnings.length > 0 && (
              <Badge variant="destructive" className="gap-1">
                <AlertTriangle className="h-3 w-3" /> {analysis.stuffingWarnings.length} stuffing warnings
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Switch
              id="kda-stop"
              checked={excludeStopWords}
              onCheckedChange={setExcludeStopWords}
            />
            <Label htmlFor="kda-stop" className="text-xs cursor-pointer">
              Exclude stop words (the, a, is, …)
            </Label>
          </div>
          <div>
            <Label htmlFor="kda-exclude" className="text-xs">
              Custom exclude words (comma-separated)
            </Label>
            <Input
              id="kda-exclude"
              value={customExclude}
              onChange={(e) => setCustomExclude(e.target.value)}
              placeholder="example, sample, test"
              className="mt-1 text-xs"
            />
          </div>
        </CardContent>
      </Card>

      {analysis.stuffingWarnings.length > 0 && (
        <div className="rounded-md border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-700 dark:text-amber-400 space-y-1">
          {analysis.stuffingWarnings.map((w, i) => (
            <div key={i}>• {w}</div>
          ))}
        </div>
      )}

      {text.trim() ? (
        <>
          {cloudData.length > 0 && (
            <Card>
              <CardContent className="p-4 space-y-2">
                <h3 className="text-sm font-semibold text-foreground">Keyword cloud</h3>
                <div className="flex flex-wrap gap-2 items-baseline">
                  {cloudData.slice(0, 30).map((c, i) => {
                    const sizePct = c.value / maxCloudValue;
                    const fontSize = 0.85 + sizePct * 1.4; // 0.85rem to 2.25rem
                    return (
                      <span
                        key={i}
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
              <h3 className="text-sm font-semibold text-foreground">
                Top 20 single-word keywords
              </h3>
              <KeywordTable hits={analysis.oneWord} title="single-word keywords" />
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 space-y-3">
              <h3 className="text-sm font-semibold text-foreground">
                Top 20 two-word phrases
              </h3>
              <KeywordTable hits={analysis.twoWord} title="two-word phrases" />
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 space-y-3">
              <h3 className="text-sm font-semibold text-foreground">
                Top 20 three-word phrases
              </h3>
              <KeywordTable hits={analysis.threeWord} title="three-word phrases" />
            </CardContent>
          </Card>

          <div className="flex flex-wrap gap-2">
            <CopyButton getText={() => { handleSaveHistory(); return csvOutput; }} label="Copy CSV" />
            <DownloadButton
              getText={() => csvOutput}
              filename="keyword-density.csv"
              mime="text/csv"
              label="Download CSV"
            />
          </div>
        </>
      ) : (
        <EmptyState
          title="Paste text to analyze keyword density"
          hint="Real-time analysis of 1-word, 2-word, and 3-word phrases. Stop-word filtering, custom excludes, and stuffing warnings included."
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
              <Button variant="ghost" size="sm" onClick={handleClearHistory}>
                Clear
              </Button>
            </div>
            <div className="space-y-1">
              {history.slice(0, 5).map((h, i) => (
                <div key={i} className="rounded border bg-background px-3 py-2 text-xs">
                  <Badge variant="outline" className="mr-2">{h.wordCount} words</Badge>
                  <Badge variant="outline" className="mr-2">{h.uniqueWords} unique</Badge>
                  {h.stuffingWarnings > 0 && (
                    <Badge variant="destructive" className="mr-2">{h.stuffingWarnings} warnings</Badge>
                  )}
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
            <strong className="text-foreground">Privacy:</strong> Density
            analysis runs locally. History is stored in localStorage on this
            device only.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
