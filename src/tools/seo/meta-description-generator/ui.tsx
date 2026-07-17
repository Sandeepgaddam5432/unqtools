"use client";

import React, { useState, useMemo, useCallback, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CopyButton, DownloadButton, EmptyState, ShareButton, ClearButton } from "../../_shared";
import { toast } from "sonner";
import {
  computeStats,
  buildDescriptionTag,
  estimateCtr,
  generateSuggestions,
  compareAB,
  buildSerpPreview,
  renderCsv,
  buildShareUrl,
  parseShareUrl,
  loadHistory,
  saveHistory,
  clearHistory,
  type HistoryEntry,
} from "./logic";
import { History, FileText, GitCompare, Search } from "lucide-react";

export default function MetaDescriptionGenerator() {
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [keyword, setKeyword] = useState("");
  const [brand, setBrand] = useState("");
  const [versionA, setVersionA] = useState("");
  const [versionB, setVersionB] = useState("");
  const [activeVersion, setActiveVersion] = useState<"A" | "B">("A");
  const [previewUrl, setPreviewUrl] = useState("https://example.com/page");
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  useEffect(() => {
    setHistory(loadHistory());
    if (typeof window !== "undefined" && window.location.hash) {
      const parsed = parseShareUrl(window.location.hash);
      if (parsed.title || parsed.versionA) {
        setTitle(parsed.title);
        setContent(parsed.content);
        setKeyword(parsed.keyword);
        setBrand(parsed.brand);
        setVersionA(parsed.versionA);
        setVersionB(parsed.versionB);
        toast.info("Loaded from share link");
      }
    }
  }, []);

  const suggestions = useMemo(
    () => generateSuggestions({ title, content, keyword, brand }),
    [title, content, keyword, brand],
  );

  const activeText = activeVersion === "A" ? versionA : versionB;
  const activeStats = useMemo(() => computeStats(activeText), [activeText]);
  const activeCtr = useMemo(() => estimateCtr(activeText, keyword), [activeText, keyword]);
  const tag = useMemo(() => buildDescriptionTag(activeText), [activeText]);
  const serpPreview = useMemo(
    () => buildSerpPreview(activeText, title || "Sample Page Title", previewUrl),
    [activeText, title, previewUrl],
  );

  const comparison = useMemo(
    () => (versionA && versionB ? compareAB(versionA, versionB, keyword) : null),
    [versionA, versionB, keyword],
  );

  const csv = useMemo(
    () => renderCsv(suggestions),
    [suggestions],
  );

  const handleSaveHistory = useCallback(() => {
    if (activeText.trim()) {
      saveHistory({
        ts: Date.now(),
        title,
        description: activeText,
        keyword,
      });
      setHistory(loadHistory());
    }
  }, [activeText, title, keyword]);

  const handleClear = useCallback(() => {
    setVersionA("");
    setVersionB("");
    setTitle("");
    setContent("");
    setKeyword("");
    setBrand("");
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
            <Label htmlFor="md-title">Page title (for SERP preview)</Label>
            <Input
              id="md-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="10 Best SEO Tools of 2026"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="md-content">Page content (used for auto suggestions)</Label>
            <Textarea
              id="md-content"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Paste your page content here. We'll extract sentences to draft descriptions."
              className="min-h-[100px] resize-y text-sm"
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="md-keyword">Target keyword</Label>
              <Input
                id="md-keyword"
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                placeholder="SEO tools"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="md-brand">Brand name (optional)</Label>
              <Input
                id="md-brand"
                value={brand}
                onChange={(e) => setBrand(e.target.value)}
                placeholder="UnQTools"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {suggestions.length > 0 && (
        <Card>
          <CardContent className="p-4 space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <FileText className="h-4 w-4" /> Template suggestions
              </h3>
              <DownloadButton
                getText={() => csv}
                filename="descriptions.csv"
                mime="text/csv"
                label="CSV"
              />
            </div>
            <div className="space-y-1">
              {suggestions.map((s) => (
                <div
                  key={s.template}
                  className="rounded border bg-background p-2 text-xs space-y-1"
                >
                  <div className="flex items-center justify-between">
                    <Badge variant="outline" className="text-xs">{s.template}</Badge>
                    <span className={s.stats.isOver ? "text-red-600" : s.stats.isWarn ? "text-amber-600" : "text-muted-foreground"}>
                      {s.stats.charCount}/160 · {s.stats.pixelWidth}px
                    </span>
                  </div>
                  <div className="text-foreground">{s.text}</div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-6 text-xs"
                      onClick={() => {
                        setVersionA(s.text);
                        setActiveVersion("A");
                        toast.success("Loaded into version A");
                      }}
                    >
                      → A
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-6 text-xs"
                      onClick={() => {
                        setVersionB(s.text);
                        setActiveVersion("B");
                        toast.success("Loaded into version B");
                      }}
                    >
                      → B
                    </Button>
                  </div>
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
              <GitCompare className="h-4 w-4" /> A/B versions
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
              <Label htmlFor="md-a">Version A</Label>
              <Textarea
                id="md-a"
                value={versionA}
                onChange={(e) => setVersionA(e.target.value)}
                placeholder="Type your first description…"
                className="min-h-[80px] resize-y text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="md-b">Version B</Label>
              <Textarea
                id="md-b"
                value={versionB}
                onChange={(e) => setVersionB(e.target.value)}
                placeholder="Type your second description…"
                className="min-h-[80px] resize-y text-sm"
              />
            </div>
          </div>

          {activeText && (
            <div className="space-y-2">
              <div className="flex flex-wrap gap-2">
                <Badge variant={activeStats.isOver ? "destructive" : activeStats.isWarn ? "default" : "outline"}>
                  {activeStats.charCount}/160 chars
                </Badge>
                <Badge variant={activeStats.pixelTruncated ? "destructive" : "outline"}>
                  {activeStats.pixelWidth}px
                </Badge>
                <Badge variant="outline">{activeStats.wordCount} words</Badge>
                <Badge variant="outline">CTR ~{activeCtr}</Badge>
                <Badge variant={activeStats.isOver ? "destructive" : "outline"}>
                  {activeStats.isOver ? "Over limit" : activeStats.isWarn ? "Near limit" : "Within limit"}
                </Badge>
              </div>
              {comparison && (
                <div className="rounded border bg-muted/30 p-2 text-xs space-y-1">
                  <div className="font-medium text-foreground">
                    Winner: {comparison.winner === "tie" ? "Tie" : `Version ${comparison.winner}`}
                  </div>
                  {comparison.reasons.map((r, i) => (
                    <div key={i} className="text-muted-foreground">• {r}</div>
                  ))}
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {activeText && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <h3 className="text-sm font-semibold text-foreground">SERP preview</h3>
            <div className="space-y-1.5">
              <Label htmlFor="md-url" className="text-xs text-muted-foreground">URL for preview</Label>
              <Input
                id="md-url"
                value={previewUrl}
                onChange={(e) => setPreviewUrl(e.target.value)}
                className="text-xs"
              />
            </div>
            <div className="rounded-md border bg-background p-3 max-w-xl">
              <div className="text-xs text-emerald-700 dark:text-emerald-500 truncate">{serpPreview.breadcrumb}</div>
              <div className="text-lg text-blue-700 dark:text-blue-400 leading-snug mt-0.5">{serpPreview.title}</div>
              <div className="text-sm text-muted-foreground mt-0.5">{serpPreview.truncatedDescription}</div>
            </div>
            <div className="flex flex-wrap gap-2">
              <CopyButton
                getText={() => {
                  handleSaveHistory();
                  return activeText;
                }}
                label="Copy description"
              />
              <CopyButton getText={() => tag} label="Copy meta tag" />
              <ShareButton
                getUrl={() => {
                  handleSaveHistory();
                  return buildShareUrl({ title, content, keyword, brand, versionA, versionB });
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
          title="Generate meta descriptions"
          hint="Fill in the inputs above to get template suggestions, or type your own in version A/B fields."
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
                <button
                  key={i}
                  onClick={() => {
                    setTitle(h.title);
                    setKeyword(h.keyword);
                    setVersionA(h.description);
                    setActiveVersion("A");
                    toast.info("Loaded from history");
                  }}
                  className="block w-full text-left rounded border bg-background px-3 py-2 text-xs hover:bg-muted/50 transition-colors cursor-pointer"
                >
                  <div className="text-foreground">{h.description}</div>
                  <div className="text-muted-foreground mt-0.5 truncate">{h.title} · kw: {h.keyword || "—"}</div>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-3">
          <p className="text-xs text-muted-foreground">
            <strong className="text-foreground">Privacy:</strong> description generation runs locally. History is stored in localStorage on this device only.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
