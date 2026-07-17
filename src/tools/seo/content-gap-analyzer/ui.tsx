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
  analyzeGap,
  renderCsv,
  renderMarkdown,
  buildVisualDiff,
  buildShareUrl,
  parseShareUrl,
  loadHistory,
  saveHistory,
  clearHistory,
  type CompetitorContent,
  type HistoryEntry,
} from "./logic";
import { History, GitCompare, Plus, X } from "lucide-react";

export default function ContentGapAnalyzer() {
  const [yourText, setYourText] = useState("");
  const [competitors, setCompetitors] = useState<CompetitorContent[]>([
    { label: "Competitor 1", text: "" },
  ]);
  const [excludeStopWords, setExcludeStopWords] = useState(true);
  const [customExclude, setCustomExclude] = useState("");
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  useEffect(() => {
    setHistory(loadHistory());
    if (typeof window !== "undefined" && window.location.hash) {
      const parsed = parseShareUrl(window.location.hash);
      if (parsed.yours !== undefined) {
        setYourText(parsed.yours);
        if (parsed.competitors.length > 0) {
          setCompetitors(parsed.competitors);
        }
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

  const validCompetitors = useMemo(
    () => competitors.filter((c) => c.text.trim().length > 0),
    [competitors],
  );

  const analysis = useMemo(
    () => analyzeGap(yourText, validCompetitors, { excludeStopWords, customExclude: customExcludeList }),
    [yourText, validCompetitors, excludeStopWords, customExcludeList],
  );

  const visualDiff = useMemo(() => buildVisualDiff(analysis), [analysis]);
  const csvOutput = useMemo(() => renderCsv(analysis), [analysis]);
  const markdownOutput = useMemo(
    () => renderMarkdown(yourText, validCompetitors, analysis),
    [yourText, validCompetitors, analysis],
  );

  const addCompetitor = useCallback(() => {
    if (competitors.length >= 3) {
      toast.error("Maximum 3 competitors supported");
      return;
    }
    setCompetitors((prev) => [
      ...prev,
      { label: `Competitor ${prev.length + 1}`, text: "" },
    ]);
  }, [competitors.length]);

  const removeCompetitor = useCallback((i: number) => {
    setCompetitors((prev) => prev.filter((_, idx) => idx !== i));
  }, []);

  const updateCompetitor = useCallback(
    (i: number, key: keyof CompetitorContent, val: string) => {
      setCompetitors((prev) =>
        prev.map((c, idx) => (idx === i ? { ...c, [key]: val } : c)),
      );
    },
    [],
  );

  const handleSaveHistory = useCallback(() => {
    if (yourText.trim()) {
      saveHistory({
        ts: Date.now(),
        yourWordCount: analysis.yourWordCount,
        competitorCount: validCompetitors.length,
        gapCount: analysis.gaps.length,
        uniqueCount: analysis.unique.length,
        snippet: yourText.slice(0, 100),
      });
      setHistory(loadHistory());
    }
  }, [yourText, analysis.yourWordCount, analysis.gaps.length, analysis.unique.length, validCompetitors.length]);

  const handleClear = useCallback(() => {
    setYourText("");
    setCompetitors([{ label: "Competitor 1", text: "" }]);
    setCustomExclude("");
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
          <Label htmlFor="cga-yours">Your content</Label>
          <Textarea
            id="cga-yours"
            value={yourText}
            onChange={(e) => setYourText(e.target.value)}
            placeholder="Paste your article, blog post, or page content here."
            className="min-h-[150px] resize-y"
          />
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-foreground">
              Competitors ({competitors.length}/3)
            </h3>
            <Button
              size="sm"
              variant="outline"
              onClick={addCompetitor}
              disabled={competitors.length >= 3}
              className="gap-1.5"
            >
              <Plus className="h-3.5 w-3.5" /> Add competitor
            </Button>
          </div>
          {competitors.map((c, i) => (
            <div key={i} className="rounded-md border p-3 space-y-2">
              <div className="flex items-center gap-2">
                <Input
                  value={c.label}
                  onChange={(e) => updateCompetitor(i, "label", e.target.value)}
                  placeholder={`Competitor ${i + 1} name`}
                  className="text-sm"
                />
                {competitors.length > 1 && (
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => removeCompetitor(i)}
                    aria-label="Remove competitor"
                  >
                    <X className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
              <Textarea
                value={c.text}
                onChange={(e) => updateCompetitor(i, "text", e.target.value)}
                placeholder={`Paste ${c.label}'s content here.`}
                className="min-h-[100px] resize-y text-xs"
              />
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center gap-2">
            <Switch
              id="cga-stop"
              checked={excludeStopWords}
              onCheckedChange={setExcludeStopWords}
            />
            <Label htmlFor="cga-stop" className="text-xs cursor-pointer">
              Exclude stop words
            </Label>
          </div>
          <div>
            <Label htmlFor="cga-exclude" className="text-xs">
              Custom exclude words (comma-separated)
            </Label>
            <Input
              id="cga-exclude"
              value={customExclude}
              onChange={(e) => setCustomExclude(e.target.value)}
              placeholder="example, sample"
              className="mt-1 text-xs"
            />
          </div>
        </CardContent>
      </Card>

      {yourText.trim() && validCompetitors.length > 0 ? (
        <>
          <Card>
            <CardContent className="p-4 space-y-3">
              <h3 className="text-sm font-semibold text-foreground">Summary</h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                <div className="rounded-md border bg-background/50 p-2">
                  <div className="text-xs text-muted-foreground">Your words</div>
                  <div className="text-lg font-semibold">{analysis.yourWordCount}</div>
                </div>
                <div className="rounded-md border bg-background/50 p-2">
                  <div className="text-xs text-muted-foreground">Overlap</div>
                  <div className="text-lg font-semibold">{visualDiff.overlapPct.toFixed(1)}%</div>
                </div>
                <div className="rounded-md border bg-background/50 p-2">
                  <div className="text-xs text-muted-foreground">Gap keywords</div>
                  <div className="text-lg font-semibold text-amber-600 dark:text-amber-400">{visualDiff.gaps}</div>
                </div>
                <div className="rounded-md border bg-background/50 p-2">
                  <div className="text-xs text-muted-foreground">Unique to you</div>
                  <div className="text-lg font-semibold text-emerald-600 dark:text-emerald-400">{visualDiff.unique}</div>
                </div>
              </div>
              <div className="text-xs text-muted-foreground">
                Total unique words across all content: {analysis.totalUniqueAcrossAll}
              </div>
            </CardContent>
          </Card>

          {analysis.gaps.length > 0 && (
            <Card>
              <CardContent className="p-4 space-y-2">
                <h3 className="text-sm font-semibold text-foreground">
                  Gap keywords — top {Math.min(20, analysis.gaps.length)}
                </h3>
                <div className="text-xs text-muted-foreground">
                  Keywords your competitors cover but you don't. Higher priority = more competitors mention it.
                </div>
                <div className="space-y-1">
                  {analysis.gaps.slice(0, 20).map((g, i) => (
                    <div
                      key={i}
                      className="flex items-center gap-2 rounded border bg-background px-3 py-1.5 text-xs"
                    >
                      <div className="w-6 text-muted-foreground">{i + 1}.</div>
                      <div className="flex-1 font-medium">{g.word}</div>
                      <Badge variant="outline" className="text-xs">
                        {g.totalCompetitorCount}× in competitors
                      </Badge>
                      <Badge
                        variant={g.priority >= 75 ? "destructive" : g.priority >= 50 ? "default" : "outline"}
                        className="text-xs"
                      >
                        P{g.priority}
                      </Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {analysis.unique.length > 0 && (
            <Card>
              <CardContent className="p-4 space-y-2">
                <h3 className="text-sm font-semibold text-foreground">
                  Unique to your content — top {Math.min(20, analysis.unique.length)}
                </h3>
                <div className="text-xs text-muted-foreground">
                  Keywords only you cover — your competitive differentiators.
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {analysis.unique.slice(0, 30).map((u, i) => (
                    <Badge key={i} variant="secondary" className="text-xs">
                      {u.word} ({u.count}×)
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {analysis.shared.length > 0 && (
            <Card>
              <CardContent className="p-4 space-y-2">
                <h3 className="text-sm font-semibold text-foreground">
                  Shared keywords — top {Math.min(20, analysis.shared.length)}
                </h3>
                <div className="text-xs text-muted-foreground">
                  Keywords both you and competitors cover.
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {analysis.shared.slice(0, 30).map((s, i) => (
                    <Badge key={i} variant="outline" className="text-xs">
                      {s.word} ({s.count}×)
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          <div className="flex flex-wrap gap-2">
            <CopyButton getText={() => { handleSaveHistory(); return csvOutput; }} label="Copy CSV" />
            <DownloadButton
              getText={() => csvOutput}
              filename="content-gap.csv"
              mime="text/csv"
              label="Download CSV"
            />
            <CopyButton getText={() => markdownOutput} label="Copy .md" />
            <DownloadButton
              getText={() => markdownOutput}
              filename="content-gap-report.md"
              label="Download .md"
            />
            <ShareButton getUrl={() => { handleSaveHistory(); return buildShareUrl(yourText, validCompetitors); }} />
            <ClearButton onClick={handleClear} />
          </div>
        </>
      ) : (
        <EmptyState
          title="Add your content and at least one competitor"
          hint="The tool finds keywords competitors cover that you don't (gaps), and keywords only you cover (unique). Up to 3 competitors."
          icon={<GitCompare className="h-8 w-8" />}
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
                  <Badge variant="outline" className="mr-2">{h.yourWordCount} words</Badge>
                  <Badge variant="outline" className="mr-2">{h.competitorCount} competitors</Badge>
                  <Badge variant="outline" className="mr-2">{h.gapCount} gaps</Badge>
                  <Badge variant="outline" className="mr-2">{h.uniqueCount} unique</Badge>
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
            <strong className="text-foreground">Privacy:</strong> All gap
            analysis runs locally. Your content and competitor content never
            leave your browser. History is stored in localStorage on this
            device only.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
