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
  BOT_LABELS,
  parseLogs,
  summarize,
  filterEntries,
  renderTextReport,
  renderCsv,
  formatBytes,
  formatMicros,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  type LogFilter,
  type BotFamily,
  type HistoryEntry,
} from "./logic";
import { History, FileText, Bot, AlertTriangle, Activity, Cpu } from "lucide-react";

const SAMPLE_LOG = `66.249.66.1 - - [10/Jul/2025:13:55:36 +0000] "GET /blog/seo-guide HTTP/1.1" 200 8456 "-" "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)"
66.249.66.1 - - [10/Jul/2025:13:55:37 +0000] "GET /blog/seo-tips HTTP/1.1" 404 1230 "-" "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)"
66.249.66.2 - - [10/Jul/2025:13:55:38 +0000] "GET /blog/seo-guide HTTP/1.1" 200 8200 "-" "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)"
157.55.39.42 - - [10/Jul/2025:13:55:39 +0000] "GET / HTTP/1.1" 200 12450 "-" "Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)"
192.0.100.1 - - [10/Jul/2025:13:55:40 +0000] "GET /about HTTP/1.1" 301 - "-" "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"`;

const FILTER_OPTIONS: { value: LogFilter; label: string }[] = [
  { value: "all", label: "All traffic" },
  { value: "googlebot", label: "Googlebot only" },
  { value: "bots-only", label: "All bots" },
  { value: "bingbot", label: "Bingbot" },
  { value: "yandex", label: "YandexBot" },
  { value: "baidu", label: "Baiduspider" },
  { value: "duckduckgo", label: "DuckDuckBot" },
  { value: "ahrefs", label: "AhrefsBot" },
  { value: "semrush", label: "SemrushBot" },
  { value: "apple", label: "Applebot" },
];

export default function LogFileAnalyzer() {
  const [logText, setLogText] = useState("");
  const [filter, setFilter] = useState<LogFilter>("all");
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  useEffect(() => {
    setHistory(loadHistory());
    if (typeof window !== "undefined" && window.location.hash) {
      const parsed = parseShareUrl(window.location.hash);
      if (parsed) {
        toast.info(
          `Loaded shared summary: ${parsed.totalRequests} requests, ${parsed.googlebotHits} Googlebot hits`,
        );
      }
    }
  }, []);

  const parsed = useMemo(() => parseLogs(logText), [logText]);
  const allSummary = useMemo(() => summarize(parsed.entries, parsed.errors), [parsed]);
  const filteredEntries = useMemo(
    () => filterEntries(parsed.entries, filter),
    [parsed.entries, filter],
  );
  const filteredSummary = useMemo(
    () => summarize(filteredEntries, parsed.errors),
    [filteredEntries, parsed.errors],
  );
  const reportText = useMemo(
    () => renderTextReport(filteredSummary, filteredEntries, filter),
    [filteredSummary, filteredEntries, filter],
  );
  const reportCsv = useMemo(() => renderCsv(filteredSummary), [filteredSummary]);

  const handleSaveHistory = useCallback(() => {
    if (allSummary.totalRequests > 0) {
      saveHistory({
        ts: Date.now(),
        totalRequests: allSummary.totalRequests,
        googlebotHits: allSummary.googlebotHits,
        notFoundUrls: allSummary.googlebot404s,
        uniqueUrls: allSummary.uniqueUrls,
        botPercent: allSummary.botPercent,
      });
      setHistory(loadHistory());
    }
  }, [allSummary]);

  const handleLoadSample = useCallback(() => {
    setLogText(SAMPLE_LOG);
    toast.info("Loaded sample log");
  }, []);

  const handleClear = useCallback(() => {
    setLogText("");
    setFilter("all");
    toast.info("Cleared");
  }, []);

  const handleClearHistory = useCallback(() => {
    clearHistory();
    setHistory([]);
    toast.success("History cleared");
  }, []);

  const statusClasses = (["2xx", "3xx", "4xx", "5xx"] as const);
  const statusColors: Record<string, string> = {
    "2xx": "text-emerald-600 dark:text-emerald-400",
    "3xx": "text-blue-600 dark:text-blue-400",
    "4xx": "text-amber-600 dark:text-amber-400",
    "5xx": "text-red-600 dark:text-red-400",
  };

  return (
    <div className="space-y-4 unq-animate-fade-in-up">
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <Label htmlFor="lfa-log">Paste server log file contents (Apache/Nginx common or combined)</Label>
            <Button variant="ghost" size="sm" onClick={handleLoadSample}>Load sample</Button>
          </div>
          <Textarea
            id="lfa-log"
            value={logText}
            onChange={(e) => setLogText(e.target.value)}
            placeholder={"66.249.66.1 - - [10/Jul/2025:13:55:36 +0000] \"GET /blog/seo-guide HTTP/1.1\" 200 8456 \"-\" \"Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)\""}
            className="min-h-[160px] resize-y font-mono text-[11px]"
          />
          <p className="text-[11px] text-muted-foreground">
            Supports <code>common</code> and <code>combined</code> log format. Optional trailing{" "}
            <code>%D</code> microseconds field is parsed for response-time stats. Comment lines starting with{" "}
            <code>#</code> are skipped.
          </p>
        </CardContent>
      </Card>

      {parsed.entries.length > 0 ? (
        <>
          <Card>
            <CardContent className="p-4 space-y-3">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <Activity className="h-4 w-4" /> Summary stats
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-2 text-xs">
                <Stat label="Total requests" value={allSummary.totalRequests} />
                <Stat label="Googlebot hits" value={allSummary.googlebotHits} highlight="good" />
                <Stat label="All bot hits" value={`${allSummary.botHits} (${allSummary.botPercent}%)`} />
                <Stat label="Human / unknown" value={allSummary.humanHits} />
                <Stat label="Unique URLs" value={allSummary.uniqueUrls} />
                <Stat label="Googlebot 404s" value={allSummary.googlebot404s} highlight="bad" />
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">Status code distribution</div>
                <div className="grid grid-cols-5 gap-2 text-xs">
                  {statusClasses.map((c) => (
                    <div key={c} className="rounded border bg-background px-2 py-1.5">
                      <div className="text-[10px] text-muted-foreground">{c}</div>
                      <div className={`text-sm font-semibold ${statusColors[c]}`}>
                        {allSummary.statusDistribution[c]}
                      </div>
                    </div>
                  ))}
                  <div className="rounded border bg-background px-2 py-1.5">
                    <div className="text-[10px] text-muted-foreground">other</div>
                    <div className="text-sm font-semibold">{allSummary.statusDistribution.other}</div>
                  </div>
                </div>
              </div>
              {allSummary.responseTimes && (
                <div>
                  <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">
                    Response time ({allSummary.responseTimes.count} samples)
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                    <Stat label="Min" value={formatMicros(allSummary.responseTimes.min)} />
                    <Stat label="Max" value={formatMicros(allSummary.responseTimes.max)} />
                    <Stat label="Avg" value={formatMicros(allSummary.responseTimes.avg)} />
                    <Stat label="P95" value={formatMicros(allSummary.responseTimes.p95)} highlight="bad" />
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                  <Bot className="h-4 w-4" /> Bot hit counters ({allSummary.topBots.length})
                </h3>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
                {allSummary.topBots.map((b) => (
                  <div key={b.family} className="rounded border bg-background px-3 py-2 text-xs">
                    <div className="font-medium text-foreground">{BOT_LABELS[b.family]}</div>
                    <div className="text-[11px] text-muted-foreground">
                      {b.hits} hits · {b.percent}%
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                  <FileText className="h-4 w-4" /> Top crawled URLs (Googlebot)
                </h3>
                <select
                  value={filter}
                  onChange={(e) => setFilter(e.target.value as LogFilter)}
                  className="h-8 text-xs rounded border bg-background px-2"
                >
                  {FILTER_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1 max-h-[400px] overflow-auto">
                {filteredSummary.topCrawledUrls.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No URLs match this filter.</p>
                ) : (
                  filteredSummary.topCrawledUrls.map((u, i) => (
                    <div key={i} className="flex items-center gap-2 rounded border bg-background px-3 py-1.5 text-xs">
                      <Badge variant="secondary" className="text-[10px] font-mono">{u.hits}x</Badge>
                      <span className="font-mono text-foreground truncate flex-1">{u.url}</span>
                      <Badge
                        variant="outline"
                        className={`text-[10px] ${statusColors[`${
                          u.lastStatus >= 200 && u.lastStatus < 300 ? "2xx" :
                          u.lastStatus >= 300 && u.lastStatus < 400 ? "3xx" :
                          u.lastStatus >= 400 && u.lastStatus < 500 ? "4xx" :
                          u.lastStatus >= 500 && u.lastStatus < 600 ? "5xx" : "other"
                        }`] ?? ""}`}
                      >
                        {u.lastStatus}
                      </Badge>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>

          {filteredSummary.notFoundUrls.length > 0 && (
            <Card>
              <CardContent className="p-4 space-y-2">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                  <AlertTriangle className="h-4 w-4 text-amber-500" /> Googlebot-discovered 404s ({filteredSummary.googlebot404s})
                </h3>
                <div className="space-y-1 max-h-[200px] overflow-auto">
                  {filteredSummary.notFoundUrls.map((u, i) => (
                    <div key={i} className="flex items-center gap-2 rounded border bg-background px-3 py-1.5 text-xs">
                      <Badge variant="secondary" className="text-[10px] font-mono">{u.hits}x</Badge>
                      <span className="font-mono text-foreground truncate flex-1">{u.url}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardContent className="p-4 space-y-3">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <Cpu className="h-4 w-4" /> Text report ({filteredEntries.length} filtered entries)
              </h3>
              <pre className="rounded border bg-muted/40 p-3 text-[11px] font-mono whitespace-pre-wrap max-h-[400px] overflow-auto">
                {reportText}
              </pre>
              <div className="flex flex-wrap gap-2">
                <CopyButton getText={() => { handleSaveHistory(); return reportText; }} label="Copy report" />
                <DownloadButton
                  getText={() => { handleSaveHistory(); return reportText; }}
                  filename="log-analysis-report.txt"
                  mime="text/plain"
                  label="Download .txt"
                />
                <DownloadButton
                  getText={() => reportCsv}
                  filename="log-crawl-urls.csv"
                  mime="text/csv"
                  label="Download CSV"
                />
                <ShareButton getUrl={() => { handleSaveHistory(); return buildShareUrl(allSummary); }} />
                <ClearButton onClick={handleClear} />
              </div>
            </CardContent>
          </Card>
        </>
      ) : (
        <EmptyState
          title="Paste server logs to analyze Googlebot activity"
          hint="Apache/Nginx common or combined format. Click 'Load sample' to see an example. All parsing happens in your browser — no logs leave this device."
          icon={<FileText className="h-8 w-8" />}
        />
      )}

      {history.length > 0 && (
        <Card>
          <CardContent className="p-4 space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <History className="h-4 w-4" /> Recent analyses ({history.length})
              </h3>
              <Button variant="ghost" size="sm" onClick={handleClearHistory}>Clear</Button>
            </div>
            <div className="space-y-1">
              {history.slice(0, 5).map((h, i) => (
                <div key={i} className="rounded border bg-background px-3 py-2 text-xs">
                  <Badge variant="outline" className="mr-2">{h.totalRequests} reqs</Badge>
                  <Badge variant="outline" className="mr-2">{h.googlebotHits} Googlebot</Badge>
                  <Badge variant="outline" className="mr-2">{h.uniqueUrls} URLs</Badge>
                  <Badge variant="outline" className="mr-2">{h.notFoundUrls} 404s</Badge>
                  <Badge variant="outline">{h.botPercent}% bots</Badge>
                  <span className="text-muted-foreground ml-2">· {new Date(h.ts).toLocaleString()}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-3">
          <p className="text-xs text-muted-foreground">
            <strong className="text-foreground">Privacy:</strong> Log parsing runs 100% in your browser. History is stored in localStorage on this device only. Server logs can contain IPs and sensitive paths — never paste logs from production if you're concerned about confidentiality.
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
