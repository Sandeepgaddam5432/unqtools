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
  CLASSIFICATION_LABELS,
  CLASSIFICATION_COLORS,
  CLASSIFICATION_ORDER,
  parseCsv,
  classifyRecords,
  summarizeCoverage,
  findDuplicateCanonicalGroups,
  detectCanonicalChains,
  findMissingCanonicals,
  generateRecommendations,
  filterByClassification,
  renderTextReport,
  renderCsv,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  type ClassificationFilter,
  type HistoryEntry,
} from "./logic";
import { History, ShieldCheck, AlertTriangle, Link2, Lightbulb, ListChecks } from "lucide-react";

const SAMPLE_CSV = `url,canonical,noindex,robots_blocked,status_code
https://example.com/page1,https://example.com/page1,no,no,200
https://example.com/page2,https://example.com/page1,no,no,200
https://example.com/page3,,yes,no,200
https://example.com/page4,,no,yes,200
https://example.com/page5,https://example.com/page1,no,no,200
https://example.com/page6,https://example.com/page6,no,no,200
https://example.com/page7,https://example.com/missing,no,no,404`;

const SEVERITY_COLORS: Record<string, string> = {
  high: "text-red-600 dark:text-red-400",
  medium: "text-amber-600 dark:text-amber-400",
  low: "text-blue-600 dark:text-blue-400",
};

export default function IndexCoverageReporter() {
  const [csvText, setCsvText] = useState("");
  const [filter, setFilter] = useState<ClassificationFilter>("all");
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  useEffect(() => {
    setHistory(loadHistory());
    if (typeof window !== "undefined" && window.location.hash) {
      const shared = parseShareUrl(window.location.hash);
      if (shared.length > 0) {
        // Reconstruct CSV from shared records
        const csv = shared
          .map((r) =>
            [r.url, r.canonical, r.noindex ? "yes" : "no", r.robotsBlocked ? "yes" : "no", r.statusCode].join(","),
          )
          .join("\n");
        setCsvText(csv);
        toast.info(`Loaded ${shared.length} records from share link`);
      }
    }
  }, []);

  const parsed = useMemo(() => parseCsv(csvText), [csvText]);
  const classified = useMemo(() => classifyRecords(parsed.records), [parsed]);
  const summary = useMemo(() => summarizeCoverage(classified), [classified]);
  const dupGroups = useMemo(() => findDuplicateCanonicalGroups(parsed.records), [parsed]);
  const chains = useMemo(() => detectCanonicalChains(parsed.records), [parsed]);
  const missing = useMemo(() => findMissingCanonicals(parsed.records), [parsed]);
  const recommendations = useMemo(
    () => generateRecommendations(classified, chains, dupGroups, missing),
    [classified, chains, dupGroups, missing],
  );
  const filtered = useMemo(
    () => filterByClassification(classified, filter),
    [classified, filter],
  );
  const reportText = useMemo(
    () => renderTextReport(classified, summary, chains, dupGroups, missing, recommendations),
    [classified, summary, chains, dupGroups, missing, recommendations],
  );
  const reportCsv = useMemo(() => renderCsv(classified), [classified]);

  const handleSaveHistory = useCallback(() => {
    if (summary.total > 0) {
      saveHistory({
        ts: Date.now(),
        total: summary.total,
        indexable: summary.indexable,
        blocked: summary.noindex + summary.robotsBlocked + summary.errorStatus,
        recommendations: recommendations.length,
      });
      setHistory(loadHistory());
    }
  }, [summary, recommendations]);

  const handleLoadSample = useCallback(() => {
    setCsvText(SAMPLE_CSV);
    toast.info("Loaded sample CSV");
  }, []);

  const handleClear = useCallback(() => {
    setCsvText("");
    setFilter("all");
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
          <div className="flex items-center justify-between">
            <Label htmlFor="icr-csv">Paste URL metadata CSV</Label>
            <Button variant="ghost" size="sm" onClick={handleLoadSample}>Load sample</Button>
          </div>
          <Textarea
            id="icr-csv"
            value={csvText}
            onChange={(e) => setCsvText(e.target.value)}
            placeholder={"url,canonical,noindex,robots_blocked,status_code\nhttps://example.com/page1,https://example.com/page1,no,no,200"}
            className="min-h-[160px] resize-y font-mono text-[11px]"
          />
          <p className="text-[11px] text-muted-foreground">
            Columns: <code>url</code>, <code>canonical</code> (empty = missing), <code>noindex</code> (yes/no),{" "}
            <code>robots_blocked</code> (yes/no), <code>status_code</code>. Header row optional. Status code 2xx assumed if blank.
          </p>
        </CardContent>
      </Card>

      {classified.length > 0 ? (
        <>
          <Card>
            <CardContent className="p-4 space-y-3">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <ShieldCheck className="h-4 w-4" /> Coverage summary
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-2 text-xs">
                <Stat label="Total URLs" value={summary.total} />
                <Stat label="Indexable" value={`${summary.indexable} (${summary.indexablePercent}%)`} highlight="good" />
                <Stat label="Blocked / errors" value={`${summary.noindex + summary.robotsBlocked + summary.errorStatus} (${summary.blockedPercent}%)`} highlight="bad" />
                <Stat label="Canonicalized" value={summary.canonicalized} />
                <Stat label="Dup canonicals" value={summary.duplicateCanonical} highlight="bad" />
                <Stat label="Missing canonical" value={summary.missingCanonicalCount} highlight="bad" />
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">By classification</div>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 text-xs">
                  {CLASSIFICATION_ORDER.map((c) => {
                    const count = c === "indexable" ? summary.indexable
                      : c === "canonicalized" ? summary.canonicalized
                      : c === "noindex" ? summary.noindex
                      : c === "robots_blocked" ? summary.robotsBlocked
                      : c === "error_status" ? summary.errorStatus
                      : summary.duplicateCanonical;
                    return (
                      <button
                        key={c}
                        onClick={() => setFilter(filter === c ? "all" : c)}
                        className={`text-left rounded border bg-background px-2 py-1.5 transition-colors ${
                          filter === c ? "border-primary" : "hover:border-foreground/40"
                        }`}
                      >
                        <div className="text-[10px] text-muted-foreground">{CLASSIFICATION_LABELS[c]}</div>
                        <div className={`text-sm font-semibold ${CLASSIFICATION_COLORS[c]}`}>{count}</div>
                      </button>
                    );
                  })}
                </div>
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">Canonical stats</div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                  <Stat label="Self-canonical" value={summary.selfCanonicalCount} />
                  <Stat label="Non-self canonical" value={summary.nonSelfCanonicalCount} />
                  <Stat label="Unique targets" value={summary.uniqueCanonicalTargets} />
                  <Stat label="Chains / dup groups" value={`${summary.chainCount} / ${summary.duplicateGroups}`} highlight={summary.chainCount > 0 ? "bad" : undefined} />
                </div>
              </div>
            </CardContent>
          </Card>

          {(dupGroups.length > 0 || chains.length > 0 || missing.length > 0) && (
            <Card>
              <CardContent className="p-4 space-y-3">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                  <Link2 className="h-4 w-4" /> Canonical issues
                </h3>
                {dupGroups.length > 0 && (
                  <div className="space-y-1">
                    <div className="text-[11px] text-muted-foreground">
                      Duplicate canonical groups ({dupGroups.length}) — multiple URLs canonicalize to the same target:
                    </div>
                    {dupGroups.slice(0, 5).map((g, i) => (
                      <div key={i} className="rounded border bg-background px-3 py-2 text-xs">
                        <div className="font-mono text-foreground">→ {g.target}</div>
                        <div className="text-muted-foreground mt-1">
                          {g.sources.length} sources: {g.sources.slice(0, 5).join(", ")}
                          {g.sources.length > 5 ? ` +${g.sources.length - 5} more` : ""}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                {chains.length > 0 && (
                  <div className="space-y-1">
                    <div className="text-[11px] text-muted-foreground">
                      Canonical chains ({chains.length}) — should be flattened:
                    </div>
                    {chains.slice(0, 5).map((c, i) => (
                      <div key={i} className="rounded border bg-background px-3 py-2 text-xs">
                        <span className="font-mono text-foreground">{c.steps.join(" → ")}</span>
                        {c.cyclic && <Badge variant="destructive" className="ml-2 text-[10px]">CYCLIC</Badge>}
                      </div>
                    ))}
                  </div>
                )}
                {missing.length > 0 && (
                  <div className="space-y-1">
                    <div className="text-[11px] text-muted-foreground">
                      Missing canonicals ({missing.length}) — add self-canonical tags:
                    </div>
                    <div className="space-y-0.5 max-h-[120px] overflow-auto">
                      {missing.slice(0, 20).map((r, i) => (
                        <div key={i} className="text-xs font-mono text-foreground">· {r.url}</div>
                      ))}
                      {missing.length > 20 && (
                        <div className="text-[10px] text-muted-foreground">+{missing.length - 20} more</div>
                      )}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {recommendations.length > 0 && (
            <Card>
              <CardContent className="p-4 space-y-2">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                  <Lightbulb className="h-4 w-4" /> Recommendations ({recommendations.length})
                </h3>
                <div className="space-y-1 max-h-[200px] overflow-auto">
                  {recommendations.map((r, i) => (
                    <div key={i} className="rounded border bg-background px-3 py-2 text-xs">
                      <Badge
                        variant="outline"
                        className={`mr-2 text-[10px] uppercase ${SEVERITY_COLORS[r.severity] ?? ""}`}
                      >
                        {r.severity}
                      </Badge>
                      <span className="text-foreground">{r.message}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardContent className="p-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                  <ListChecks className="h-4 w-4" /> URL classifications ({filtered.length})
                </h3>
                <select
                  value={filter}
                  onChange={(e) => setFilter(e.target.value as ClassificationFilter)}
                  className="h-8 text-xs rounded border bg-background px-2"
                >
                  <option value="all">All classifications</option>
                  {CLASSIFICATION_ORDER.map((c) => (
                    <option key={c} value={c}>{CLASSIFICATION_LABELS[c]}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1 max-h-[400px] overflow-auto">
                {filtered.map((r, i) => (
                  <div key={i} className="rounded border bg-background px-3 py-2 text-xs">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className={`text-[10px] ${CLASSIFICATION_COLORS[r.classification]}`}>
                        {CLASSIFICATION_LABELS[r.classification]}
                      </Badge>
                      <span className="font-mono text-foreground truncate flex-1">{r.url}</span>
                      <Badge variant="secondary" className="text-[10px]">{r.statusCode}</Badge>
                    </div>
                    <div className="text-[11px] text-muted-foreground mt-1">{r.reason}</div>
                    {r.canonical && (
                      <div className="text-[11px] font-mono text-muted-foreground mt-0.5">
                        canonical: {r.canonical}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 space-y-3">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <AlertTriangle className="h-4 w-4" /> Errors & report
              </h3>
              {parsed.errors.length > 0 && (
                <div className="space-y-1">
                  <div className="text-[11px] text-amber-600 dark:text-amber-400">
                    {parsed.errors.length} parse error(s):
                  </div>
                  <div className="max-h-[100px] overflow-auto">
                    {parsed.errors.slice(0, 10).map((e, i) => (
                      <div key={i} className="text-[11px] font-mono text-foreground">
                        Line {e.line}: {e.message}
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <pre className="rounded border bg-muted/40 p-3 text-[11px] font-mono whitespace-pre-wrap max-h-[400px] overflow-auto">
                {reportText}
              </pre>
              <div className="flex flex-wrap gap-2">
                <CopyButton getText={() => { handleSaveHistory(); return reportText; }} label="Copy report" />
                <DownloadButton
                  getText={() => { handleSaveHistory(); return reportText; }}
                  filename="index-coverage-report.txt"
                  mime="text/plain"
                  label="Download .txt"
                />
                <DownloadButton
                  getText={() => reportCsv}
                  filename="index-coverage-records.csv"
                  mime="text/csv"
                  label="Download CSV"
                />
                <ShareButton getUrl={() => { handleSaveHistory(); return buildShareUrl(parsed.records); }} />
                <ClearButton onClick={handleClear} />
              </div>
            </CardContent>
          </Card>
        </>
      ) : (
        <EmptyState
          title="Paste URL metadata CSV to audit index coverage"
          hint="Columns: url, canonical, noindex (yes/no), robots_blocked (yes/no), status_code. Click 'Load sample' to see an example."
          icon={<ShieldCheck className="h-8 w-8" />}
        />
      )}

      {history.length > 0 && (
        <Card>
          <CardContent className="p-4 space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <History className="h-4 w-4" /> Recent reports ({history.length})
              </h3>
              <Button variant="ghost" size="sm" onClick={handleClearHistory}>Clear</Button>
            </div>
            <div className="space-y-1">
              {history.slice(0, 5).map((h, i) => (
                <div key={i} className="rounded border bg-background px-3 py-2 text-xs">
                  <Badge variant="outline" className="mr-2">{h.total} URLs</Badge>
                  <Badge variant="outline" className="mr-2">{h.indexable} indexable</Badge>
                  <Badge variant="outline" className="mr-2">{h.blocked} blocked</Badge>
                  <Badge variant="outline">{h.recommendations} recs</Badge>
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
            <strong className="text-foreground">Privacy:</strong> CSV parsing and classification run 100% in your browser. History is stored in localStorage on this device only. URL metadata never leaves the page.
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
