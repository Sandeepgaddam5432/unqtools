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
  parsePages,
  analyze,
  exportHtml,
  exportMarkdown,
  exportCsv,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  type HistoryEntry,
} from "./logic";
import { History, Link2, Network, FileCode } from "lucide-react";

export default function InternalLinkingSuggester() {
  const [content, setContent] = useState("");
  const [pagesText, setPagesText] = useState("");
  const [minRelevance, setMinRelevance] = useState(30);
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  useEffect(() => {
    setHistory(loadHistory());
    if (typeof window !== "undefined" && window.location.hash) {
      const p = parseShareUrl(window.location.hash);
      if (p.content || p.pages) {
        setContent(p.content);
        setPagesText(p.pages);
        toast.info("Loaded from share link");
      }
    }
  }, []);

  const pages = useMemo(() => parsePages(pagesText), [pagesText]);
  const analysis = useMemo(
    () => analyze(content, pages, { minRelevance }),
    [content, pages, minRelevance],
  );
  const html = useMemo(() => exportHtml(analysis.suggestions), [analysis.suggestions]);
  const md = useMemo(() => exportMarkdown(analysis.suggestions), [analysis.suggestions]);
  const csv = useMemo(() => exportCsv(analysis.suggestions), [analysis.suggestions]);

  const handleSaveHistory = useCallback(() => {
    if (analysis.totalMatches > 0) {
      saveHistory({
        ts: Date.now(),
        totalPages: analysis.totalPages,
        matchedPages: analysis.matchedPages,
        totalMatches: analysis.totalMatches,
        snippet: content.slice(0, 100),
      });
      setHistory(loadHistory());
    }
  }, [analysis, content]);

  const handleClear = useCallback(() => {
    setContent("");
    setPagesText("");
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
            <Label htmlFor="il-content">Page content (paste the article text)</Label>
            <Textarea
              id="il-content"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Paste the full text of the page you want internal links for…"
              className="min-h-[160px] resize-y text-sm"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="il-pages">Other pages (one per line: URL,keyword1,keyword2,…)</Label>
            <Textarea
              id="il-pages"
              value={pagesText}
              onChange={(e) => setPagesText(e.target.value)}
              placeholder={"https://example.com/seo-guide,seo,seo guide\nhttps://example.com/marketing,marketing strategy"}
              className="min-h-[120px] resize-y font-mono text-xs"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="il-min">Min relevance: {minRelevance}</Label>
            <input
              id="il-min"
              type="range"
              min={0}
              max={100}
              step={5}
              value={minRelevance}
              onChange={(e) => setMinRelevance(parseInt(e.target.value, 10))}
              className="w-full cursor-pointer"
            />
          </div>
        </CardContent>
      </Card>

      {content && pages.length > 0 && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <Network className="h-4 w-4" /> Suggestions ({analysis.totalMatches})
              </h3>
              <div className="flex flex-wrap gap-2">
                <Badge variant="outline">{analysis.totalPages} pages</Badge>
                <Badge variant="outline">{analysis.matchedPages} matched</Badge>
                {analysis.deduped > 0 && (
                  <Badge variant="outline">{analysis.deduped} deduped</Badge>
                )}
              </div>
            </div>

            {analysis.suggestions.length > 0 ? (
              <div className="space-y-1 max-h-[320px] overflow-auto">
                {analysis.suggestions.map((s, i) => (
                  <div
                    key={i}
                    className="rounded border bg-background p-2 text-xs space-y-1"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="font-mono text-foreground truncate">{s.anchor}</div>
                      <Badge variant={s.relevance >= 80 ? "default" : s.relevance >= 60 ? "outline" : "secondary"}>
                        {s.relevance}%
                      </Badge>
                    </div>
                    <div className="text-muted-foreground truncate">→ {s.url}</div>
                    <div className="text-muted-foreground">
                      {s.count}× occurrences · first at {s.firstOccurrencePct}%
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">No suggestions matched the relevance threshold.</p>
            )}

            <div className="flex flex-wrap gap-2 pt-2">
              <CopyButton
                getText={() => {
                  handleSaveHistory();
                  return html;
                }}
                label="Copy HTML"
              />
              <CopyButton getText={() => md} label="Copy Markdown" />
              <DownloadButton getText={() => html} filename="internal-links.html" mime="text/html" label="HTML" />
              <DownloadButton getText={() => md} filename="internal-links.md" mime="text/markdown" label="MD" />
              <DownloadButton getText={() => csv} filename="internal-links.csv" mime="text/csv" label="CSV" />
              <ShareButton
                getUrl={() => {
                  handleSaveHistory();
                  return buildShareUrl({ content, pages: pagesText });
                }}
              />
              <ClearButton onClick={handleClear} />
            </div>
          </CardContent>
        </Card>
      )}

      {!content && (
        <EmptyState
          title="Paste content + pages to suggest internal links"
          hint="We'll find keyword matches, score relevance, and export as HTML or Markdown."
          icon={<Link2 className="h-8 w-8" />}
        />
      )}

      {analysis.suggestions.length > 0 && (
        <Card>
          <CardContent className="p-4 space-y-2">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
              <FileCode className="h-4 w-4" /> HTML output
            </h3>
            <pre className="overflow-auto whitespace-pre-wrap rounded-md border bg-muted/30 p-3 font-mono text-xs break-all">
              {html}
            </pre>
          </CardContent>
        </Card>
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
                  <Badge variant="outline" className="mr-2">{h.totalMatches} matches</Badge>
                  <Badge variant="outline" className="mr-2">{h.matchedPages}/{h.totalPages} pages</Badge>
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
            <strong className="text-foreground">Privacy:</strong> linking analysis runs locally. History is stored in localStorage on this device only.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
