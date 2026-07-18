"use client";

import React, { useState, useMemo, useCallback, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  CopyButton,
  DownloadButton,
  EmptyState,
  ShareButton,
  ClearButton,
  ErrorBanner,
} from "../../_shared";
import { toast } from "sonner";
import {
  parseAuto,
  analyze,
  renderCsv,
  DEFAULT_TOXIC_DA_THRESHOLD,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  type HistoryEntry,
} from "./logic";
import { History, Link2, AlertTriangle, Globe, Tag } from "lucide-react";

const SAMPLE = `url,anchor,source_domain,da,link_type
https://example.com/post1,best SEO tools,ahrefs.com,90,dofollow
https://example.com/post2,SEO guide,moz.com,85,dofollow
https://example.com/post3,click here,spammy-site.xyz,5,nofollow
https://example.com/post4,read more,blog.example.com,40,dofollow
https://example.com/post5,best SEO tools,semrush.com,88,dofollow
https://example.com/post6,visit,low-quality-blog.com,12,nofollow`;

export default function BacklinkProfileAnalyzer() {
  const [input, setInput] = useState("");
  const [format, setFormat] = useState<"csv" | "json" | "auto">("auto");
  const [toxicThreshold, setToxicThreshold] = useState(DEFAULT_TOXIC_DA_THRESHOLD);
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  useEffect(() => {
    setHistory(loadHistory());
    if (typeof window !== "undefined" && window.location.hash) {
      const p = parseShareUrl(window.location.hash);
      if (p.data) {
        setInput(p.data);
        setFormat(p.format);
        toast.info("Loaded from share link");
      }
    }
  }, []);

  const parsed = useMemo(() => parseAuto(input), [input]);
  const result = useMemo(
    () => analyze(parsed.backlinks, { toxicDaThreshold: toxicThreshold }),
    [parsed.backlinks, toxicThreshold],
  );
  const csv = useMemo(() => renderCsv(result), [result]);

  const handleSaveHistory = useCallback(() => {
    if (result.totalBacklinks > 0) {
      saveHistory({
        ts: Date.now(),
        totalBacklinks: result.totalBacklinks,
        uniqueDomains: result.uniqueDomains,
        averageDa: result.averageDa,
        totalToxic: result.totalToxic,
      });
      setHistory(loadHistory());
    }
  }, [result.totalBacklinks, result.uniqueDomains, result.averageDa, result.totalToxic]);

  const handleClear = useCallback(() => {
    setInput("");
    toast.info("Input cleared");
  }, []);

  const handleClearHistory = useCallback(() => {
    clearHistory();
    setHistory([]);
    toast.success("History cleared");
  }, []);

  const loadSample = useCallback(() => {
    setInput(SAMPLE);
    setFormat("csv");
    toast.info("Sample loaded");
  }, []);

  return (
    <div className="space-y-4 unq-animate-fade-in-up">
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <Label htmlFor="bpa-input">Backlink data (CSV or JSON)</Label>
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" onClick={loadSample}>Load sample</Button>
              <ShareButton
                getUrl={() => {
                  handleSaveHistory();
                  return buildShareUrl(input, format);
                }}
                disabled={!input.trim()}
              />
              <ClearButton onClick={handleClear} />
            </div>
          </div>
          <Textarea
            id="bpa-input"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={"CSV: url,anchor,source_domain,da,link_type\nor JSON array of objects"}
            className="min-h-[200px] resize-y font-mono text-xs"
          />
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex gap-1">
              {(["auto", "csv", "json"] as const).map((f) => (
                <Button
                  key={f}
                  size="sm"
                  variant={format === f ? "default" : "outline"}
                  onClick={() => setFormat(f)}
                >
                  {f}
                </Button>
              ))}
            </div>
            <div className="flex items-center gap-2 text-xs">
              <Label htmlFor="bpa-thresh" className="text-xs">Toxic DA threshold:</Label>
              <Input
                id="bpa-thresh"
                type="number"
                value={toxicThreshold}
                onChange={(e) => setToxicThreshold(parseInt(e.target.value, 10) || 0)}
                className="w-20 h-8 text-xs"
                min={0}
                max={100}
              />
            </div>
          </div>
          {parsed.errors.length > 0 && (
            <ErrorBanner message={`${parsed.errors.length} parse warning(s): ${parsed.errors.slice(0, 3).join("; ")}${parsed.errors.length > 3 ? "…" : ""}`} />
          )}
        </CardContent>
      </Card>

      {result.totalBacklinks > 0 ? (
        <>
          <Card>
            <CardContent className="p-4 space-y-2">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <Link2 className="h-4 w-4" /> Summary
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                <Stat label="Total backlinks" value={result.totalBacklinks} />
                <Stat label="Unique domains" value={result.uniqueDomains} />
                <Stat label="Average DA" value={result.averageDa} />
                <Stat
                  label="Toxic links"
                  value={result.totalToxic}
                  highlight={result.totalToxic > 0 ? "bad" : undefined}
                />
                <Stat label="Dofollow" value={`${result.dofollowCount} (${result.dofollowPercentage.toFixed(1)}%)`} />
                <Stat label="Nofollow" value={`${result.nofollowCount} (${result.nofollowPercentage.toFixed(1)}%)`} />
                <Stat label="DA low (<30)" value={result.daDistribution.low} />
                <Stat label="DA high (60+)" value={result.daDistribution.high} />
              </div>
            </CardContent>
          </Card>

          {result.totalToxic > 0 && (
            <Card>
              <CardContent className="p-4 space-y-2">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                  <AlertTriangle className="h-4 w-4 text-red-500" /> Toxic links ({result.totalToxic})
                </h3>
                <p className="text-xs text-muted-foreground">DA below {toxicThreshold} — consider reviewing and disavowing.</p>
                <div className="space-y-1 max-h-[200px] overflow-auto">
                  {result.toxicLinks.slice(0, 20).map((b, i) => (
                    <div key={i} className="rounded border bg-background px-3 py-1.5 text-xs">
                      <div className="flex items-center gap-2">
                        <Badge variant="destructive" className="text-[10px]">DA {b.da}</Badge>
                        <span className="font-mono text-foreground truncate flex-1">{b.url}</span>
                        <Badge variant="outline" className="text-[10px]">{b.linkType}</Badge>
                      </div>
                      <div className="text-muted-foreground text-[11px] truncate">anchor: {b.anchor || "(empty)"} · from: {b.sourceDomain}</div>
                    </div>
                  ))}
                  {result.toxicLinks.length > 20 && (
                    <div className="text-xs text-muted-foreground italic">+ {result.toxicLinks.length - 20} more in the CSV export</div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardContent className="p-4 space-y-2">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                  <Globe className="h-4 w-4" /> Top referring domains
                </h3>
                <div className="space-y-1 max-h-[300px] overflow-auto">
                  {result.topReferringDomains.map((t, i) => (
                    <div key={i} className="flex items-center gap-2 rounded border bg-background px-3 py-1.5 text-xs">
                      <div className="w-6 text-muted-foreground">{i + 1}.</div>
                      <div className="flex-1 font-mono text-foreground truncate">{t.key}</div>
                      <Badge variant="secondary" className="text-[10px]">{t.count}</Badge>
                      <div className="w-12 text-right text-muted-foreground text-[10px]">{t.percentage.toFixed(1)}%</div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4 space-y-2">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                  <Tag className="h-4 w-4" /> Top anchor texts
                </h3>
                <div className="space-y-1 max-h-[300px] overflow-auto">
                  {result.topAnchorTexts.map((t, i) => (
                    <div key={i} className="flex items-center gap-2 rounded border bg-background px-3 py-1.5 text-xs">
                      <div className="w-6 text-muted-foreground">{i + 1}.</div>
                      <div className="flex-1 font-mono text-foreground truncate">{t.key}</div>
                      <Badge variant="secondary" className="text-[10px]">{t.count}</Badge>
                      <div className="w-12 text-right text-muted-foreground text-[10px]">{t.percentage.toFixed(1)}%</div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="flex flex-wrap gap-2">
            <CopyButton
              getText={() => {
                handleSaveHistory();
                return csv;
              }}
              label="Copy report CSV"
            />
            <DownloadButton
              getText={() => {
                handleSaveHistory();
                return csv;
              }}
              filename="backlink-analysis.csv"
              mime="text/csv"
              label="Download CSV"
            />
          </div>
        </>
      ) : (
        <EmptyState
          title="Paste backlink data to analyze"
          hint="CSV (url,anchor,source_domain,da,link_type) or JSON array. Click 'Load sample' to try it out."
          icon={<Link2 className="h-8 w-8" />}
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
                  <Badge variant="outline" className="mr-2">{h.totalBacklinks} links</Badge>
                  <Badge variant="outline" className="mr-2">{h.uniqueDomains} domains</Badge>
                  <Badge variant="outline" className="mr-2">avg DA {h.averageDa}</Badge>
                  {h.totalToxic > 0 && <Badge variant="destructive" className="mr-2">{h.totalToxic} toxic</Badge>}
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
            <strong className="text-foreground">Privacy:</strong> All parsing
            and analysis runs locally. History is stored in localStorage on
            this device only.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function Stat({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string | number;
  highlight?: "bad" | "good";
}) {
  const color = highlight === "bad"
    ? "text-red-600 dark:text-red-400"
    : highlight === "good"
      ? "text-emerald-600 dark:text-emerald-400"
      : "text-foreground";
  return (
    <div className="rounded border bg-background px-3 py-2">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className={`text-base font-semibold ${color}`}>{value}</div>
    </div>
  );
}
