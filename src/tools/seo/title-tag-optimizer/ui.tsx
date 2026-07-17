"use client";

import React, { useState, useMemo, useCallback, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CopyButton, EmptyState, ShareButton, ClearButton } from "../../_shared";
import { toast } from "sonner";
import {
  analyzeTitle,
  buildTitleTag,
  generateSuggestions,
  compareTitles,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  type HistoryEntry,
} from "./logic";
import { History, Type as TypeIcon, GitCompare, Lightbulb } from "lucide-react";

const CATEGORY_STYLES: Record<string, string> = {
  emotional: "bg-pink-500/10 text-pink-700 dark:text-pink-400",
  urgency: "bg-orange-500/10 text-orange-700 dark:text-orange-400",
  value: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
  trust: "bg-blue-500/10 text-blue-700 dark:text-blue-400",
  curiosity: "bg-purple-500/10 text-purple-700 dark:text-purple-400",
};

export default function TitleTagOptimizer() {
  const [title, setTitle] = useState("");
  const [keyword, setKeyword] = useState("");
  const [versionA, setVersionA] = useState("");
  const [versionB, setVersionB] = useState("");
  const [activeVersion, setActiveVersion] = useState<"A" | "B">("A");
  const [previewUrl, setPreviewUrl] = useState("https://example.com/page");
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  useEffect(() => {
    setHistory(loadHistory());
    if (typeof window !== "undefined" && window.location.hash) {
      const p = parseShareUrl(window.location.hash);
      if (p.title || p.versionA) {
        setTitle(p.title);
        setKeyword(p.keyword);
        setVersionA(p.versionA);
        setVersionB(p.versionB);
        setPreviewUrl(p.url || "https://example.com/page");
        toast.info("Loaded from share link");
      }
    }
  }, []);

  const activeText = activeVersion === "A" ? versionA : title;
  const analysis = useMemo(() => analyzeTitle(activeText, keyword), [activeText, keyword]);
  const tag = useMemo(() => buildTitleTag(activeText), [activeText]);
  const suggestions = useMemo(() => generateSuggestions(title, keyword), [title, keyword]);
  const comparison = useMemo(
    () => (versionA && versionB ? compareTitles(versionA, versionB, keyword) : null),
    [versionA, versionB, keyword],
  );

  const handleSaveHistory = useCallback(() => {
    if (activeText.trim()) {
      saveHistory({
        ts: Date.now(),
        title: activeText,
        keyword,
        ctrScore: analysis.ctrScore,
      });
      setHistory(loadHistory());
    }
  }, [activeText, keyword, analysis.ctrScore]);

  const handleClear = useCallback(() => {
    setTitle("");
    setKeyword("");
    setVersionA("");
    setVersionB("");
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
          <h3 className="text-sm font-semibold text-foreground">Inputs</h3>
          <div className="space-y-1.5">
            <Label htmlFor="tt-title">Title tag</Label>
            <Input
              id="tt-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Best 10 SEO Tools of 2026 — Free Comparison"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="tt-keyword">Target keyword</Label>
            <Input
              id="tt-keyword"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              placeholder="SEO tools"
            />
          </div>
        </CardContent>
      </Card>

      {suggestions.length > 0 && (
        <Card>
          <CardContent className="p-4 space-y-2">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
              <Lightbulb className="h-4 w-4" /> Suggestions
            </h3>
            <div className="space-y-1">
              {suggestions.map((s, i) => (
                <div
                  key={i}
                  className="flex items-center gap-2 rounded border bg-background px-3 py-1.5 text-xs"
                >
                  <div className="flex-1 text-foreground">{s}</div>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-6 text-xs"
                    onClick={() => {
                      setTitle(s);
                      toast.success("Loaded into title");
                    }}
                  >
                    Use
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
              <GitCompare className="h-4 w-4" /> A/B compare
            </h3>
            <div className="flex gap-1">
              <Button
                size="sm"
                variant={activeVersion === "A" ? "default" : "outline"}
                onClick={() => setActiveVersion("A")}
              >
                A
              </Button>
              <Button
                size="sm"
                variant={activeVersion === "B" ? "default" : "outline"}
                onClick={() => setActiveVersion("B")}
              >
                B
              </Button>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="tt-a">Version A</Label>
              <Input
                id="tt-a"
                value={versionA}
                onChange={(e) => setVersionA(e.target.value)}
                placeholder="Type a competing title…"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="tt-b">Version B</Label>
              <Input
                id="tt-b"
                value={versionB}
                onChange={(e) => setVersionB(e.target.value)}
                placeholder="Type another competing title…"
              />
            </div>
          </div>
          {comparison && (
            <div className="rounded border bg-muted/30 p-2 text-xs">
              <div className="font-medium text-foreground">
                Winner: {comparison.winner === "tie" ? "Tie" : `Version ${comparison.winner}`}
              </div>
              <div className="text-muted-foreground mt-0.5">
                A CTR: {comparison.a.ctrScore} · B CTR: {comparison.b.ctrScore}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {activeText && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <h3 className="text-sm font-semibold text-foreground">Analysis</h3>
            <div className="flex flex-wrap gap-2">
              <Badge variant={analysis.stats.isOver ? "destructive" : analysis.stats.isWarn ? "default" : "outline"}>
                {analysis.stats.charCount}/60 chars
              </Badge>
              <Badge variant={analysis.stats.pixelTruncated ? "destructive" : "outline"}>
                {analysis.stats.pixelWidth}px / 580px
              </Badge>
              <Badge variant="outline">CTR ~{analysis.ctrScore}</Badge>
              {analysis.keywordPresent && (
                <Badge variant={analysis.keywordNearFront ? "default" : "outline"}>
                  kw{analysis.keywordNearFront ? " at front" : ` @ word ${analysis.keywordPosition}`}
                </Badge>
              )}
              {analysis.hasDigits && <Badge variant="outline">digits</Badge>}
              {analysis.isQuestion && <Badge variant="outline">question</Badge>}
              {analysis.hasBrackets && <Badge variant="outline">brackets</Badge>}
              {analysis.hasCTA && <Badge variant="outline">CTA</Badge>}
              {analysis.isAllCaps && <Badge variant="destructive">ALL CAPS</Badge>}
            </div>
            {analysis.powerWords.length > 0 && (
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Power words</Label>
                <div className="flex flex-wrap gap-1.5">
                  {analysis.powerWords.map((p, i) => (
                    <span
                      key={i}
                      className={`rounded px-2 py-0.5 text-xs ${CATEGORY_STYLES[p.category] || "bg-muted"}`}
                    >
                      {p.word} · {p.category}
                    </span>
                  ))}
                </div>
              </div>
            )}
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Recommendations</Label>
              <ul className="text-xs space-y-0.5 list-disc list-inside">
                {analysis.recommendations.map((r, i) => (
                  <li key={i} className="text-foreground">{r}</li>
                ))}
              </ul>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="tt-url" className="text-xs text-muted-foreground">URL for SERP preview</Label>
              <Input
                id="tt-url"
                value={previewUrl}
                onChange={(e) => setPreviewUrl(e.target.value)}
                className="text-xs"
              />
            </div>
            <div className="rounded-md border bg-background p-3 max-w-xl">
              <div className="text-xs text-emerald-700 dark:text-emerald-500 truncate">
                {previewUrl.replace(/^https?:\/\//, "").replace(/\//g, " › ")}
              </div>
              <div className="text-lg text-blue-700 dark:text-blue-400 leading-snug mt-0.5">{activeText}</div>
              <div className="text-sm text-muted-foreground mt-0.5">
                {analysis.stats.pixelTruncated ? activeText.slice(0, 55) + "…" : "Meta description appears here in the snippet…"}
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <CopyButton
                getText={() => {
                  handleSaveHistory();
                  return activeText;
                }}
                label="Copy title"
              />
              <CopyButton getText={() => tag} label="Copy tag" />
              <ShareButton
                getUrl={() => {
                  handleSaveHistory();
                  return buildShareUrl({
                    title,
                    keyword,
                    versionA,
                    versionB,
                    url: previewUrl,
                  });
                }}
              />
              <ClearButton onClick={handleClear} />
            </div>
            <pre className="overflow-auto whitespace-pre-wrap rounded-md border bg-muted/30 p-3 font-mono text-xs break-all">
              {tag}
            </pre>
          </CardContent>
        </Card>
      )}

      {!activeText && (
        <EmptyState
          title="Enter a title to optimize"
          hint="Analyze length, pixel width, keyword position, power words, and CTR potential."
          icon={<TypeIcon className="h-8 w-8" />}
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
                <button
                  key={i}
                  onClick={() => {
                    setTitle(h.title);
                    setKeyword(h.keyword);
                    toast.info("Loaded from history");
                  }}
                  className="block w-full text-left rounded border bg-background px-3 py-2 text-xs hover:bg-muted/50 transition-colors cursor-pointer"
                >
                  <div className="text-foreground">{h.title}</div>
                  <div className="text-muted-foreground mt-0.5">kw: {h.keyword || "—"} · CTR ~{h.ctrScore}</div>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-3">
          <p className="text-xs text-muted-foreground">
            <strong className="text-foreground">Privacy:</strong> title analysis runs locally. History is stored in localStorage on this device only.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
