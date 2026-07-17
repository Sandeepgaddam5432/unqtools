"use client";

import React, { useState, useMemo, useCallback, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  CopyButton,
  DownloadButton,
  EmptyState,
  ShareButton,
} from "../../_shared";
import { toast } from "sonner";
import {
  analyze,
  renderCsv,
  renderReport,
  GOOGLE_BUSINESS_PROFILE_URL,
  buildShareUrl,
  parseShareUrl,
  loadHistory,
  saveHistory,
  clearHistory,
  type Nap,
  type Citation,
  type FieldKey,
  type HistoryEntry,
} from "./logic";
import { History, MapPin, Plus, X, CheckCircle2, XCircle, ExternalLink } from "lucide-react";

const FIELD_KEYS: FieldKey[] = ["name", "address", "phone"];

export default function NapCitationConsistencyChecker() {
  const [master, setMaster] = useState<Nap>({ name: "", address: "", phone: "" });
  const [citations, setCitations] = useState<Citation[]>([
    { source: "", nap: { name: "", address: "", phone: "" } },
  ]);
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  useEffect(() => {
    setHistory(loadHistory());
    if (typeof window !== "undefined" && window.location.hash) {
      const parsed = parseShareUrl(window.location.hash);
      if (parsed.master) {
        setMaster(parsed.master);
        if (parsed.citations && parsed.citations.length > 0) {
          setCitations(parsed.citations);
        }
        toast.info("Loaded from share link");
      }
    }
  }, []);

  const result = useMemo(() => analyze(master, citations.filter((c) => c.source.trim())), [master, citations]);
  const csv = useMemo(() => renderCsv(result), [result]);
  const report = useMemo(() => renderReport(master, result), [master, result]);

  const updateMaster = useCallback(<K extends keyof Nap>(key: K, val: string) => {
    setMaster((prev) => ({ ...prev, [key]: val }));
  }, []);

  const updateCitation = useCallback((i: number, key: "source" | keyof Nap, val: string) => {
    setCitations((prev) => prev.map((c, idx) => {
      if (idx !== i) return c;
      if (key === "source") return { ...c, source: val };
      return { ...c, nap: { ...c.nap, [key]: val } };
    }));
  }, []);

  const addCitation = useCallback(() => {
    setCitations((prev) => [...prev, { source: "", nap: { name: "", address: "", phone: "" } }]);
  }, []);

  const removeCitation = useCallback((i: number) => {
    setCitations((prev) => prev.filter((_, idx) => idx !== i));
  }, []);

  const handleSaveHistory = useCallback(() => {
    if (result.stats.totalCitations > 0) {
      saveHistory({
        ts: Date.now(),
        citationCount: result.stats.totalCitations,
        consistencyPct: result.stats.consistencyPercentage,
        issueCount: result.stats.totalIssues,
      });
      setHistory(loadHistory());
    }
  }, [result]);

  const handleClearHistory = useCallback(() => {
    clearHistory();
    setHistory([]);
    toast.success("History cleared");
  }, []);

  const consistencyColor = (pct: number): string => {
    if (pct === 100) return "text-emerald-600 dark:text-emerald-400";
    if (pct >= 80) return "text-emerald-600 dark:text-emerald-400";
    if (pct >= 50) return "text-amber-600 dark:text-amber-400";
    return "text-red-600 dark:text-red-400";
  };

  return (
    <div className="space-y-4 unq-animate-fade-in-up">
      <Card>
        <CardContent className="p-4 space-y-3">
          <h3 className="text-sm font-semibold text-foreground">Master NAP (your canonical business info)</h3>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label htmlFor="nap-master-name">Business name *</Label>
              <Input
                id="nap-master-name"
                value={master.name}
                onChange={(e) => updateMaster("name", e.target.value)}
                placeholder="Joe's Coffee Shop"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="nap-master-address">Address *</Label>
              <Input
                id="nap-master-address"
                value={master.address}
                onChange={(e) => updateMaster("address", e.target.value)}
                placeholder="123 Main Street, Springfield, IL 62701"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="nap-master-phone">Phone *</Label>
              <Input
                id="nap-master-phone"
                value={master.phone}
                onChange={(e) => updateMaster("phone", e.target.value)}
                placeholder="(217) 555-1234"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-foreground">Citations ({citations.length})</h3>
            <Button size="sm" variant="outline" onClick={addCitation} className="gap-1.5">
              <Plus className="h-3.5 w-3.5" /> Add citation
            </Button>
          </div>
          <div className="space-y-2">
            {citations.map((c, i) => (
              <div key={i} className="rounded-md border p-3 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <Input
                    value={c.source}
                    onChange={(e) => updateCitation(i, "source", e.target.value)}
                    placeholder="Source (e.g. Google, Yelp, Facebook)"
                    className="text-sm font-medium"
                  />
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => removeCitation(i)}
                    aria-label="Remove citation"
                    disabled={citations.length === 1}
                  >
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </div>
                <div className="grid gap-2 sm:grid-cols-3">
                  <Input
                    value={c.nap.name}
                    onChange={(e) => updateCitation(i, "name", e.target.value)}
                    placeholder="Name"
                    className="text-xs"
                  />
                  <Input
                    value={c.nap.address}
                    onChange={(e) => updateCitation(i, "address", e.target.value)}
                    placeholder="Address"
                    className="text-xs"
                  />
                  <Input
                    value={c.nap.phone}
                    onChange={(e) => updateCitation(i, "phone", e.target.value)}
                    placeholder="Phone"
                    className="text-xs"
                  />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {result.stats.totalCitations > 0 && master.name.trim() ? (
        <>
          <Card>
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-foreground">Consistency summary</h3>
                <div className="text-right">
                  <div className="text-xs text-muted-foreground">Consistency</div>
                  <div className={`text-2xl font-bold ${consistencyColor(result.stats.consistencyPercentage)}`}>
                    {result.stats.consistencyPercentage.toFixed(1)}%
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                <div className="rounded-md border bg-background/50 p-2">
                  <div className="text-xs text-muted-foreground">Total citations</div>
                  <div className="text-lg font-semibold">{result.stats.totalCitations}</div>
                </div>
                <div className="rounded-md border bg-emerald-500/5 p-2">
                  <div className="text-xs text-muted-foreground">Fully consistent</div>
                  <div className="text-lg font-semibold text-emerald-600 dark:text-emerald-400">
                    {result.stats.fullyConsistent}
                  </div>
                </div>
                <div className="rounded-md border bg-amber-500/5 p-2">
                  <div className="text-xs text-muted-foreground">Partially consistent</div>
                  <div className="text-lg font-semibold text-amber-600 dark:text-amber-400">
                    {result.stats.partiallyConsistent}
                  </div>
                </div>
                <div className="rounded-md border bg-background/50 p-2">
                  <div className="text-xs text-muted-foreground">Total issues</div>
                  <div className="text-lg font-semibold">{result.stats.totalIssues}</div>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2 text-xs">
                {FIELD_KEYS.map((f) => (
                  <div key={f} className="rounded border px-2 py-1 flex items-center justify-between">
                    <span className="text-muted-foreground capitalize">{f} mismatches</span>
                    <Badge variant="outline">{result.stats.issuesByField[f]}</Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {result.recommendations.length > 0 && (
            <Card>
              <CardContent className="p-4 space-y-2">
                <h3 className="text-sm font-semibold text-foreground">Recommendations</h3>
                <ul className="space-y-1 text-xs text-muted-foreground list-disc list-inside">
                  {result.recommendations.map((r, i) => (
                    <li key={i}>{r}</li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardContent className="p-4 space-y-2">
              <h3 className="text-sm font-semibold text-foreground">Per-citation comparison</h3>
              <div className="space-y-2">
                {result.comparisons.map((c, i) => (
                  <div
                    key={i}
                    className={`rounded-md border p-3 space-y-2 ${
                      c.allMatch
                        ? "border-emerald-500/30 bg-emerald-500/5"
                        : "border-amber-500/30 bg-amber-500/5"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">{c.source}</span>
                      {c.allMatch ? (
                        <Badge variant="outline" className="text-emerald-700 dark:text-emerald-400">
                          <CheckCircle2 className="h-3 w-3 mr-1" /> Consistent
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-amber-700 dark:text-amber-400">
                          <XCircle className="h-3 w-3 mr-1" /> {c.mismatchCount} mismatch(es)
                        </Badge>
                      )}
                    </div>
                    <div className="grid gap-1 text-xs">
                      {FIELD_KEYS.map((f) => {
                        const field = c.fields[f];
                        return (
                          <div
                            key={f}
                            className={`flex items-start gap-2 ${field.match ? "" : "text-amber-700 dark:text-amber-400"}`}
                          >
                            {field.match ? (
                              <CheckCircle2 className="h-3 w-3 flex-shrink-0 mt-0.5 text-emerald-500" />
                            ) : (
                              <XCircle className="h-3 w-3 flex-shrink-0 mt-0.5" />
                            )}
                            <span className="font-medium capitalize w-16 flex-shrink-0">{f}:</span>
                            <span className="text-muted-foreground">{field.citation || "(empty)"}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <div className="flex flex-wrap gap-2">
            <CopyButton getText={() => { handleSaveHistory(); return report; }} label="Copy report" />
            <DownloadButton getText={() => report} filename="nap-consistency-report.md" label="Download .md" />
            <DownloadButton
              getText={() => csv}
              filename="nap-consistency.csv"
              label="Download CSV"
            />
            <ShareButton getUrl={() => { handleSaveHistory(); return buildShareUrl({ master, citations }); }} />
          </div>
        </>
      ) : (
        <EmptyState
          title="Enter your master NAP and citation sources"
          hint="Fill in your canonical business NAP above, then add citation entries for each directory. We'll normalize formatting and flag inconsistencies field-by-field."
          icon={<MapPin className="h-8 w-8" />}
        />
      )}

      <Card>
        <CardContent className="p-4 space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-foreground">Most important citations to fix</h3>
            <a
              href={GOOGLE_BUSINESS_PROFILE_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
            >
              Google Business Profile <ExternalLink className="h-3 w-3" />
            </a>
          </div>
          <ol className="text-xs text-muted-foreground space-y-1 list-decimal list-inside">
            <li>Google Business Profile (most important for local pack)</li>
            <li>Apple Maps, Bing Places, Yelp, Facebook</li>
            <li>Yellow Pages, Foursquare, TripAdvisor</li>
            <li>Industry-specific directories (Chamber of Commerce, associations)</li>
            <li>Aggregator submissions (DataAxle, Neustar/Localeze, Foursquare)</li>
          </ol>
        </CardContent>
      </Card>

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
                    <Badge variant="outline" className="mr-2">{h.citationCount} citations</Badge>
                    <span className={`font-semibold ${consistencyColor(h.consistencyPct)}`}>
                      {h.consistencyPct.toFixed(0)}%
                    </span>
                    <span className="mx-1">·</span>
                    <span className="text-muted-foreground">{h.issueCount} issues</span>
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
            <strong className="text-foreground">Privacy:</strong> All
            comparison and analysis runs locally. We don't fetch your
            citations — you enter them. History is stored in localStorage on
            this device only.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
