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
  auditImages,
  renderCsv,
  renderReport,
  generateAccessibilityIssues,
  generateSeoIssues,
  buildShareUrl,
  parseShareUrl,
  loadHistory,
  saveHistory,
  clearHistory,
  type HistoryEntry,
  type AltIssueType,
} from "./logic";
import { History, Image as ImageIcon, CheckCircle2, AlertTriangle, XCircle, Accessibility } from "lucide-react";

const ISSUE_COLORS: Record<AltIssueType, string> = {
  "missing-alt": "text-red-600 dark:text-red-400",
  "empty-alt": "text-amber-600 dark:text-amber-400",
  "too-long": "text-amber-600 dark:text-amber-400",
  "too-short": "text-amber-600 dark:text-amber-400",
  "non-descriptive": "text-amber-600 dark:text-amber-400",
  "good": "text-emerald-600 dark:text-emerald-400",
};

const ISSUE_ICONS: Record<AltIssueType, typeof CheckCircle2> = {
  "missing-alt": XCircle,
  "empty-alt": AlertTriangle,
  "too-long": AlertTriangle,
  "too-short": AlertTriangle,
  "non-descriptive": AlertTriangle,
  "good": CheckCircle2,
};

export default function ImageSeoAltTextAuditor() {
  const [html, setHtml] = useState("");
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  useEffect(() => {
    setHistory(loadHistory());
    if (typeof window !== "undefined" && window.location.hash) {
      const parsed = parseShareUrl(window.location.hash);
      if (parsed.html !== undefined) {
        setHtml(parsed.html);
        toast.info("Loaded from share link");
      }
    }
  }, []);

  const result = useMemo(() => auditImages(html), [html]);
  const a11yIssues = useMemo(() => generateAccessibilityIssues(result), [result]);
  const seoIssues = useMemo(() => generateSeoIssues(result), [result]);
  const csv = useMemo(() => renderCsv(result), [result]);
  const report = useMemo(() => renderReport(result), [result]);

  const handleSaveHistory = useCallback(() => {
    if (result.stats.totalImages > 0) {
      saveHistory({
        ts: Date.now(),
        imageCount: result.stats.totalImages,
        issueCount: result.stats.totalImages - result.stats.good,
        goodCount: result.stats.good,
      });
      setHistory(loadHistory());
    }
  }, [result]);

  const handleClear = useCallback(() => {
    setHtml("");
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
        <CardContent className="p-4 space-y-2">
          <Label htmlFor="isata-html">Paste your HTML</Label>
          <Textarea
            id="isata-html"
            value={html}
            onChange={(e) => setHtml(e.target.value)}
            placeholder={'<img src="photo.jpg" alt="A red sports car">\n<img src="logo.png" alt="">\n<img src="missing.jpg">'}
            className="min-h-[180px] font-mono text-xs resize-y"
          />
        </CardContent>
      </Card>

      {result.stats.totalImages > 0 ? (
        <>
          <Card>
            <CardContent className="p-4 space-y-3">
              <h3 className="text-sm font-semibold text-foreground">Stats</h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                <div className="rounded-md border bg-background/50 p-2">
                  <div className="text-xs text-muted-foreground">Total images</div>
                  <div className="text-lg font-semibold">{result.stats.totalImages}</div>
                </div>
                <div className="rounded-md border bg-emerald-500/5 p-2">
                  <div className="text-xs text-muted-foreground">Good alt</div>
                  <div className="text-lg font-semibold text-emerald-600 dark:text-emerald-400">
                    {result.stats.good}
                  </div>
                </div>
                <div className="rounded-md border bg-red-500/5 p-2">
                  <div className="text-xs text-muted-foreground">Missing alt</div>
                  <div className="text-lg font-semibold text-red-600 dark:text-red-400">
                    {result.stats.missingAlt}
                  </div>
                </div>
                <div className="rounded-md border bg-amber-500/5 p-2">
                  <div className="text-xs text-muted-foreground">Empty (decorative)</div>
                  <div className="text-lg font-semibold text-amber-600 dark:text-amber-400">
                    {result.stats.emptyAlt}
                  </div>
                </div>
                <div className="rounded-md border bg-amber-500/5 p-2">
                  <div className="text-xs text-muted-foreground">Too short</div>
                  <div className="text-lg font-semibold text-amber-600 dark:text-amber-400">
                    {result.stats.tooShort}
                  </div>
                </div>
                <div className="rounded-md border bg-amber-500/5 p-2">
                  <div className="text-xs text-muted-foreground">Too long</div>
                  <div className="text-lg font-semibold text-amber-600 dark:text-amber-400">
                    {result.stats.tooLong}
                  </div>
                </div>
                <div className="rounded-md border bg-amber-500/5 p-2">
                  <div className="text-xs text-muted-foreground">Non-descriptive</div>
                  <div className="text-lg font-semibold text-amber-600 dark:text-amber-400">
                    {result.stats.nonDescriptive}
                  </div>
                </div>
                <div className="rounded-md border bg-background/50 p-2">
                  <div className="text-xs text-muted-foreground">Alt length (min/avg/max)</div>
                  <div className="text-sm font-semibold">
                    {result.stats.altLengthMin} / {result.stats.altLengthAvg} / {result.stats.altLengthMax}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {(a11yIssues.length > 0 || seoIssues.length > 0) && (
            <div className="grid gap-3 sm:grid-cols-2">
              {a11yIssues.length > 0 && (
                <Card className="border-amber-500/30">
                  <CardContent className="p-4 space-y-2">
                    <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                      <Accessibility className="h-4 w-4" /> Accessibility (WCAG 2.1)
                    </h3>
                    <div className="space-y-1">
                      {a11yIssues.map((issue, i) => (
                        <div key={i} className="text-xs text-amber-700 dark:text-amber-400 flex items-start gap-1">
                          <AlertTriangle className="h-3 w-3 flex-shrink-0 mt-0.5" />
                          <span>{issue}</span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
              {seoIssues.length > 0 && (
                <Card className="border-amber-500/30">
                  <CardContent className="p-4 space-y-2">
                    <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                      <ImageIcon className="h-4 w-4" /> SEO issues
                    </h3>
                    <div className="space-y-1">
                      {seoIssues.map((issue, i) => (
                        <div key={i} className="text-xs text-amber-700 dark:text-amber-400 flex items-start gap-1">
                          <AlertTriangle className="h-3 w-3 flex-shrink-0 mt-0.5" />
                          <span>{issue}</span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          )}

          <Card>
            <CardContent className="p-4 space-y-2">
              <h3 className="text-sm font-semibold text-foreground">Image audit ({result.issues.length})</h3>
              <div className="space-y-2 max-h-[400px] overflow-y-auto">
                {result.issues.map((issue, i) => {
                  const Icon = ISSUE_ICONS[issue.type];
                  return (
                    <div
                      key={i}
                      className={`rounded-md border p-2 text-xs space-y-1 ${
                        issue.type === "good"
                          ? "border-emerald-500/30 bg-emerald-500/5"
                          : "border-amber-500/30 bg-amber-500/5"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <Icon className={`h-4 w-4 flex-shrink-0 ${ISSUE_COLORS[issue.type]}`} />
                        <Badge variant="outline" className="text-xs">{issue.type}</Badge>
                        <code className="text-muted-foreground truncate flex-1">{issue.image.src || "(no src)"}</code>
                      </div>
                      <p className={`pl-6 ${ISSUE_COLORS[issue.type]}`}>{issue.message}</p>
                      {issue.image.alt !== null && issue.image.alt !== "" && (
                        <p className="pl-6 text-muted-foreground">Alt: <code>{issue.image.alt}</code></p>
                      )}
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          <div className="flex flex-wrap gap-2">
            <CopyButton getText={() => { handleSaveHistory(); return report; }} label="Copy report" />
            <DownloadButton
              getText={() => csv}
              filename="image-alt-audit.csv"
              label="Download CSV"
            />
            <ShareButton getUrl={() => { handleSaveHistory(); return buildShareUrl(html); }} />
            <ClearButton onClick={handleClear} />
          </div>
        </>
      ) : (
        <EmptyState
          title="Paste HTML to audit image alt text"
          hint="We'll extract every <img> tag, classify alt text quality (missing / empty / too short / too long / non-descriptive / good), and flag SEO + accessibility issues."
          icon={<ImageIcon className="h-8 w-8" />}
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
                <div key={i} className="rounded border bg-background px-3 py-2 text-xs flex items-center justify-between">
                  <div>
                    <Badge variant="outline" className="mr-2">{h.imageCount} images</Badge>
                    <span className="text-emerald-600 dark:text-emerald-400">{h.goodCount} good</span>
                    <span className="mx-1">·</span>
                    <span className="text-amber-600 dark:text-amber-400">{h.issueCount} issues</span>
                  </div>
                  <span className="text-muted-foreground/70">{new Date(h.ts).toLocaleString()}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-3">
          <p className="text-xs text-muted-foreground">
            <strong className="text-foreground">Privacy:</strong> All HTML
            parsing and analysis runs locally. History is stored in localStorage
            on this device only.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
