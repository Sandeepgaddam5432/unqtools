"use client";

import React, { useState, useMemo, useCallback, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
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
  renderMarkdown,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  type HistoryEntry,
} from "./logic";
import { History, Users, FileText } from "lucide-react";

export default function SerpCompetitorAnalysis() {
  const [keyword, setKeyword] = useState("");
  const [primaryHtml, setPrimaryHtml] = useState("");
  const [comp1Html, setComp1Html] = useState("");
  const [comp2Html, setComp2Html] = useState("");
  const [comp3Html, setComp3Html] = useState("");
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  useEffect(() => {
    setHistory(loadHistory());
    if (typeof window !== "undefined" && window.location.hash) {
      const p = parseShareUrl(window.location.hash);
      if (p.keyword || p.competitors.length > 0) {
        setKeyword(p.keyword);
        setPrimaryHtml(p.competitors[0]?.html ?? "");
        setComp1Html(p.competitors[1]?.html ?? "");
        setComp2Html(p.competitors[2]?.html ?? "");
        setComp3Html(p.competitors[3]?.html ?? "");
        toast.info("Loaded from share link");
      }
    }
  }, []);

  const inputs = useMemo(
    () =>
      [
        { label: "Primary", html: primaryHtml },
        { label: "Competitor 1", html: comp1Html },
        { label: "Competitor 2", html: comp2Html },
        { label: "Competitor 3", html: comp3Html },
      ].filter((i) => i.html.trim()),
    [primaryHtml, comp1Html, comp2Html, comp3Html],
  );

  const result = useMemo(() => analyze(keyword, inputs), [keyword, inputs]);
  const markdown = useMemo(() => renderMarkdown(result), [result]);

  const handleSaveHistory = useCallback(() => {
    if (result.competitors.length > 0) {
      saveHistory({
        ts: Date.now(),
        keyword,
        competitorCount: result.competitors.length,
        averageWordCount: result.averageWordCount,
        gapCount: result.contentGaps.length,
      });
      setHistory(loadHistory());
    }
  }, [result.competitors.length, result.averageWordCount, result.contentGaps.length, keyword]);

  const handleClear = useCallback(() => {
    setKeyword("");
    setPrimaryHtml("");
    setComp1Html("");
    setComp2Html("");
    setComp3Html("");
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
            <Label htmlFor="sca-kw">Target keyword</Label>
            <Input
              id="sca-kw"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              placeholder="best seo tools"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="sca-primary">Primary (your HTML)</Label>
            <Textarea
              id="sca-primary"
              value={primaryHtml}
              onChange={(e) => setPrimaryHtml(e.target.value)}
              placeholder="<html>...paste your page source...</html>"
              className="min-h-[120px] resize-y font-mono text-xs"
            />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="sca-c1" className="text-xs">Competitor 1 HTML</Label>
              <Textarea
                id="sca-c1"
                value={comp1Html}
                onChange={(e) => setComp1Html(e.target.value)}
                placeholder="<html>...</html>"
                className="min-h-[100px] resize-y font-mono text-xs"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="sca-c2" className="text-xs">Competitor 2 HTML</Label>
              <Textarea
                id="sca-c2"
                value={comp2Html}
                onChange={(e) => setComp2Html(e.target.value)}
                placeholder="<html>...</html>"
                className="min-h-[100px] resize-y font-mono text-xs"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="sca-c3" className="text-xs">Competitor 3 HTML</Label>
              <Textarea
                id="sca-c3"
                value={comp3Html}
                onChange={(e) => setComp3Html(e.target.value)}
                placeholder="<html>...</html>"
                className="min-h-[100px] resize-y font-mono text-xs"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {result.competitors.length > 0 ? (
        <>
          <Card>
            <CardContent className="p-4 space-y-2">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <Users className="h-4 w-4" /> Summary
              </h3>
              <div className="flex flex-wrap gap-2 text-xs">
                <Badge variant="outline">{result.competitors.length} sources</Badge>
                <Badge variant="outline">avg words: {result.averageWordCount}</Badge>
                {result.contentGaps.length > 0 && (
                  <Badge variant="secondary">{result.contentGaps.length} content gaps</Badge>
                )}
                {result.sharedHeadings.length > 0 && (
                  <Badge variant="outline">{result.sharedHeadings.length} shared headings</Badge>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 space-y-3">
              <h3 className="text-sm font-semibold text-foreground">Stats comparison</h3>
              <div className="overflow-auto">
                <table className="text-xs w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-1.5 px-2">Source</th>
                      <th className="text-right py-1.5 px-2">Words</th>
                      <th className="text-right py-1.5 px-2">Keyword</th>
                      <th className="text-right py-1.5 px-2">Density</th>
                      <th className="text-right py-1.5 px-2">Headings</th>
                      <th className="text-right py-1.5 px-2">Links</th>
                      <th className="text-right py-1.5 px-2">Images</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.statsTable.map((s, i) => (
                      <tr key={i} className="border-b last:border-0">
                        <td className="py-1.5 px-2 font-medium">{s.label}</td>
                        <td className="text-right py-1.5 px-2">{s.wordCount}</td>
                        <td className="text-right py-1.5 px-2">{s.keywordCount}</td>
                        <td className="text-right py-1.5 px-2">{s.keywordDensity.toFixed(2)}%</td>
                        <td className="text-right py-1.5 px-2">{s.headings}</td>
                        <td className="text-right py-1.5 px-2">{s.links}</td>
                        <td className="text-right py-1.5 px-2">{s.images}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {result.contentGaps.length > 0 && (
            <Card>
              <CardContent className="p-4 space-y-2">
                <h3 className="text-sm font-semibold text-foreground">Content gaps</h3>
                <p className="text-xs text-muted-foreground">Headings present in competitors but missing from your primary content.</p>
                <div className="space-y-1 max-h-[200px] overflow-auto">
                  {result.contentGaps.map((g, i) => (
                    <div key={i} className="rounded border bg-background px-3 py-1.5 text-xs">
                      <div className="font-mono text-foreground">{g.text}</div>
                      <div className="text-muted-foreground text-[11px]">in: {g.competitorsWithIt.join(", ")}</div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardContent className="p-4 space-y-3">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <FileText className="h-4 w-4" /> Per-competitor headings
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {result.competitors.map((c, i) => (
                  <div key={i} className="rounded border bg-background p-3 text-xs space-y-1">
                    <div className="font-semibold">{c.label}</div>
                    <div className="text-muted-foreground">Title: {c.title || "(none)"}</div>
                    <div className="text-muted-foreground line-clamp-1">Meta: {c.metaDescription || "(none)"}</div>
                    <div className="font-medium mt-1">Headings ({c.headings.length}):</div>
                    <ul className="space-y-0.5">
                      {c.headings.slice(0, 10).map((h, j) => (
                        <li key={j} className="text-muted-foreground">
                          <code className="text-foreground">H{h.level}</code> {h.text}
                        </li>
                      ))}
                      {c.headings.length > 10 && <li className="text-muted-foreground italic">+ {c.headings.length - 10} more…</li>}
                    </ul>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <div className="flex flex-wrap gap-2">
            <CopyButton
              getText={() => {
                handleSaveHistory();
                return markdown;
              }}
              label="Copy Markdown report"
            />
            <DownloadButton
              getText={() => {
                handleSaveHistory();
                return markdown;
              }}
              filename="serp-competitor-analysis.md"
              mime="text/markdown"
              label="Download .md"
            />
            <ShareButton
              getUrl={() => {
                handleSaveHistory();
                return buildShareUrl({
                  keyword,
                  competitors: [
                    { label: "Primary", html: primaryHtml },
                    { label: "Competitor 1", html: comp1Html },
                    { label: "Competitor 2", html: comp2Html },
                    { label: "Competitor 3", html: comp3Html },
                  ],
                });
              }}
            />
            <ClearButton onClick={handleClear} />
          </div>
        </>
      ) : (
        <EmptyState
          title="Paste HTML to analyze SERP competitors"
          hint="Add a target keyword and paste the HTML source of your page and up to 3 competitors."
          icon={<Users className="h-8 w-8" />}
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
                  <Badge variant="outline" className="mr-2">{h.keyword || "(no kw)"}</Badge>
                  <Badge variant="outline" className="mr-2">{h.competitorCount} sources</Badge>
                  <Badge variant="outline" className="mr-2">avg {h.averageWordCount}w</Badge>
                  <Badge variant="outline" className="mr-2">{h.gapCount} gaps</Badge>
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
            <strong className="text-foreground">Privacy:</strong> HTML parsing
            runs locally — no network calls. History is stored in localStorage on
            this device only.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
