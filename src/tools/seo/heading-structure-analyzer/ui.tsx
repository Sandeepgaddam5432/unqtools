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
  renderMarkdownOutline,
  renderNumberedOutline,
  buildShareUrl,
  parseShareUrl,
  loadHistory,
  saveHistory,
  clearHistory,
  type HeadingNode,
  type HistoryEntry,
} from "./logic";
import {
  History,
  Heading as HeadingIcon,
  AlertCircle,
  AlertTriangle,
  XCircle,
} from "lucide-react";

function HeadingTree({ nodes, depth = 0 }: { nodes: HeadingNode[]; depth?: number }) {
  if (nodes.length === 0) return null;
  return (
    <ul className={depth === 0 ? "" : "ml-4 border-l border-border pl-3"}>
      {nodes.map((n, i) => (
        <li key={i} className="my-1">
          <div className="flex items-start gap-2 text-sm">
            <Badge
              variant={n.level === 1 ? "default" : "outline"}
              className="text-xs flex-shrink-0"
            >
              H{n.level}
            </Badge>
            <span
              className={
                n.level === 1
                  ? "font-semibold text-foreground"
                  : n.level === 2
                    ? "font-medium text-foreground"
                    : "text-foreground"
              }
            >
              {n.text || (
                <em className="text-red-600 dark:text-red-400">(empty)</em>
              )}
            </span>
          </div>
          {n.children.length > 0 && (
            <HeadingTree nodes={n.children} depth={depth + 1} />
          )}
        </li>
      ))}
    </ul>
  );
}

export default function HeadingStructureAnalyzer() {
  const [html, setHtml] = useState("");
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  useEffect(() => {
    setHistory(loadHistory());
    if (typeof window !== "undefined" && window.location.hash) {
      const parsed = parseShareUrl(window.location.hash);
      if (parsed.html) {
        setHtml(parsed.html);
        toast.info("Loaded from share link");
      }
    }
  }, []);

  const analysis = useMemo(() => analyze(html), [html]);
  const { tree, counts, issues, wordsPerHeading } = analysis;
  const markdownOutline = useMemo(() => renderMarkdownOutline(tree), [tree]);
  const numberedOutline = useMemo(() => renderNumberedOutline(tree), [tree]);

  const handleSaveHistory = useCallback(() => {
    if (html.trim()) {
      saveHistory({
        ts: Date.now(),
        totalHeadings: counts.total,
        issueCount: issues.length,
        snippet: html.slice(0, 100),
      });
      setHistory(loadHistory());
    }
  }, [html, counts.total, issues.length]);

  const handleClear = useCallback(() => {
    setHtml("");
    toast.info("HTML cleared");
  }, []);

  const handleClearHistory = useCallback(() => {
    clearHistory();
    setHistory([]);
    toast.success("History cleared");
  }, []);

  const errorCount = issues.filter((i) => i.level === "error").length;
  const warningCount = issues.filter((i) => i.level === "warning").length;

  return (
    <div className="space-y-4 unq-animate-fade-in-up">
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <Label htmlFor="hsa-html">Paste HTML</Label>
            <div className="flex gap-2">
              <ShareButton getUrl={() => { handleSaveHistory(); return buildShareUrl(html); }} />
              <ClearButton onClick={handleClear} />
            </div>
          </div>
          <Textarea
            id="hsa-html"
            value={html}
            onChange={(e) => setHtml(e.target.value)}
            placeholder={"<h1>Page title</h1>\n<h2>Section</h2>\n<h3>Subsection</h3>"}
            className="min-h-[200px] font-mono text-xs resize-y"
          />
          <div className="flex flex-wrap gap-2">
            <Badge variant="outline">H1: {counts.h1}</Badge>
            <Badge variant="outline">H2: {counts.h2}</Badge>
            <Badge variant="outline">H3: {counts.h3}</Badge>
            <Badge variant="outline">H4: {counts.h4}</Badge>
            <Badge variant="outline">H5: {counts.h5}</Badge>
            <Badge variant="outline">H6: {counts.h6}</Badge>
            <Badge variant="outline">Total: {counts.total}</Badge>
          </div>
        </CardContent>
      </Card>

      {html.trim() ? (
        <>
          {issues.length > 0 && (
            <Card>
              <CardContent className="p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                    <AlertCircle className="h-4 w-4" /> Issues ({issues.length})
                  </h3>
                  <div className="flex gap-2 text-xs">
                    {errorCount > 0 && (
                      <Badge variant="destructive" className="gap-1">
                        <XCircle className="h-3 w-3" /> {errorCount} errors
                      </Badge>
                    )}
                    {warningCount > 0 && (
                      <Badge
                        variant="outline"
                        className="border-amber-500/30 text-amber-700 dark:text-amber-400 gap-1"
                      >
                        <AlertTriangle className="h-3 w-3" /> {warningCount} warnings
                      </Badge>
                    )}
                  </div>
                </div>
                <div className="space-y-1.5">
                  {issues.map((issue, i) => (
                    <div
                      key={i}
                      className={`flex items-start gap-2 text-xs rounded border p-2 ${
                        issue.level === "error"
                          ? "border-destructive/30 bg-destructive/5 text-destructive"
                          : "border-amber-500/30 bg-amber-500/5 text-amber-700 dark:text-amber-400"
                      }`}
                    >
                      {issue.level === "error" ? (
                        <XCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                      ) : (
                        <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                      )}
                      <div>{issue.message}</div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {tree.length > 0 && (
            <Card>
              <CardContent className="p-4 space-y-3">
                <h3 className="text-sm font-semibold text-foreground">Heading outline</h3>
                <HeadingTree nodes={tree} />
              </CardContent>
            </Card>
          )}

          {tree.length > 0 && (
            <Card>
              <CardContent className="p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-foreground">
                    Markdown outline
                  </h3>
                  <CopyButton getText={() => markdownOutline} label="Copy" />
                </div>
                <pre className="overflow-auto whitespace-pre-wrap rounded-md border bg-muted/30 p-3 font-mono text-xs max-h-[300px]">
                  {markdownOutline}
                </pre>
              </CardContent>
            </Card>
          )}

          {tree.length > 0 && (
            <Card>
              <CardContent className="p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-foreground">
                    Numbered outline
                  </h3>
                  <CopyButton getText={() => numberedOutline} label="Copy" />
                </div>
                <pre className="overflow-auto whitespace-pre-wrap rounded-md border bg-muted/30 p-3 font-mono text-xs max-h-[300px]">
                  {numberedOutline}
                </pre>
              </CardContent>
            </Card>
          )}

          {wordsPerHeading.length > 0 && (
            <Card>
              <CardContent className="p-4 space-y-2">
                <h3 className="text-sm font-semibold text-foreground">
                  Words per heading
                </h3>
                <div className="flex flex-wrap gap-1.5">
                  {wordsPerHeading.map((n, i) => (
                    <Badge key={i} variant="outline" className="text-xs">
                      #{i + 1}: {n}w
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          <div className="flex flex-wrap gap-2">
            <DownloadButton
              getText={() => markdownOutline}
              filename="heading-outline.md"
              label="Download outline (.md)"
            />
          </div>
        </>
      ) : (
        <EmptyState
          title="Paste HTML to analyze heading structure"
          hint="We extract H1-H6, build a tree, and detect SEO issues like multiple H1s, skipped levels, and empty headings."
          icon={<HeadingIcon className="h-8 w-8" />}
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
                <div
                  key={i}
                  className="rounded border bg-background px-3 py-2 text-xs"
                >
                  <Badge variant="outline" className="mr-2">{h.totalHeadings} headings</Badge>
                  <Badge variant="outline" className="mr-2">{h.issueCount} issues</Badge>
                  <span className="text-muted-foreground">
                    {new Date(h.ts).toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-3">
          <p className="text-xs text-muted-foreground">
            <strong className="text-foreground">Privacy:</strong> Heading
            extraction runs locally with regex. History is stored in localStorage
            on this device only.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
