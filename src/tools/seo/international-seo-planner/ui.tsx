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
} from "../../_shared";
import { toast } from "sonner";
import {
  COUNTRY_PRESETS,
  STRATEGY_COMPARISON,
  parseCountries,
  parseLanguageMapping,
  buildPlans,
  generateHreflangTags,
  validateHreflang,
  filterPlans,
  computeStats,
  renderText,
  renderCsv,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  type UrlStructure,
  type CountryPlan,
  type HistoryEntry,
} from "./logic";
import { Globe, History, ExternalLink, AlertCircle, CheckCircle2, Table2 } from "lucide-react";

const STRATEGY_LABELS: Record<UrlStructure, string> = {
  cctld: "ccTLD (example.fr)",
  subdomain: "Subdomain (fr.example.com)",
  subdirectory: "Subdirectory (example.com/fr/)",
};

export default function InternationalSeoPlanner() {
  const [mainDomain, setMainDomain] = useState("example.com");
  const [countriesText, setCountriesText] = useState(
    "United States:US\nUnited Kingdom:GB\nGermany:DE\nFrance:FR",
  );
  const [strategy, setStrategy] = useState<UrlStructure>("subdirectory");
  const [languagesText, setLanguagesText] = useState("US:en, GB:en, DE:de, FR:fr");
  const [filterQuery, setFilterQuery] = useState("");
  const [showComparison, setShowComparison] = useState(false);
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  useEffect(() => {
    setHistory(loadHistory());
    if (typeof window !== "undefined" && window.location.hash) {
      const p = parseShareUrl(window.location.hash);
      if (p.mainDomain) setMainDomain(p.mainDomain);
      if (p.countriesText) setCountriesText(p.countriesText);
      if (p.languagesText) setLanguagesText(p.languagesText);
      if (p.strategy) setStrategy(p.strategy);
      if (p.mainDomain || p.countriesText || p.languagesText) toast.info("Loaded from share link");
    }
  }, []);

  const countries = useMemo(() => parseCountries(countriesText), [countriesText]);
  const languages = useMemo(() => parseLanguageMapping(languagesText), [languagesText]);
  const plans = useMemo(
    () => buildPlans(mainDomain, countries, languages, strategy),
    [mainDomain, countries, languages, strategy],
  );
  const filteredPlans = useMemo(
    () => filterPlans(plans, filterQuery),
    [plans, filterQuery],
  );
  const tags = useMemo(() => generateHreflangTags(plans, mainDomain), [plans, mainDomain]);
  const issues = useMemo(() => validateHreflang(plans), [plans]);
  const stats = useMemo(() => computeStats(plans, tags, issues), [plans, tags, issues]);
  const text = useMemo(
    () => renderText(plans, tags, issues, mainDomain, strategy),
    [plans, tags, issues, mainDomain, strategy],
  );
  const csv = useMemo(() => renderCsv(plans), [plans]);

  const handleSaveHistory = useCallback(() => {
    if (plans.length > 0) {
      saveHistory({
        ts: Date.now(),
        mainDomain,
        strategy,
        totalCountries: plans.length,
        totalTags: tags.length,
        issues: issues.length,
      });
      setHistory(loadHistory());
    }
  }, [plans, tags, issues, mainDomain, strategy]);

  const handleClear = useCallback(() => {
    setMainDomain("");
    setCountriesText("");
    setLanguagesText("");
    setFilterQuery("");
    toast.info("Cleared");
  }, []);

  const handleClearHistory = useCallback(() => {
    clearHistory();
    setHistory([]);
    toast.success("History cleared");
  }, []);

  const addCountryPreset = (code: string, name: string) => {
    setCountriesText((prev) => {
      const line = `${name}:${code}`;
      if (prev.includes(line)) return prev;
      return prev ? `${prev}\n${line}` : line;
    });
  };

  return (
    <div className="space-y-4 unq-animate-fade-in-up">
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="isp-domain">Main domain</Label>
              <Input
                id="isp-domain"
                value={mainDomain}
                onChange={(e) => setMainDomain(e.target.value)}
                placeholder="example.com"
                className="font-mono text-xs"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="isp-strategy">URL structure</Label>
              <select
                id="isp-strategy"
                value={strategy}
                onChange={(e) => setStrategy(e.target.value as UrlStructure)}
                className="h-9 w-full text-xs rounded border bg-background px-2"
              >
                {(Object.keys(STRATEGY_LABELS) as UrlStructure[]).map((s) => (
                  <option key={s} value={s}>{STRATEGY_LABELS[s]}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="isp-countries">Target countries (one per line as Country:Code)</Label>
            <Textarea
              id="isp-countries"
              value={countriesText}
              onChange={(e) => setCountriesText(e.target.value)}
              placeholder={"United States:US\nGermany:DE"}
              className="min-h-[100px] resize-y font-mono text-xs"
            />
            <div className="flex flex-wrap gap-1">
              {COUNTRY_PRESETS.slice(0, 12).map((c) => (
                <Button
                  key={c.code}
                  variant="ghost"
                  size="sm"
                  className="h-6 text-[11px]"
                  onClick={() => addCountryPreset(c.code, c.name)}
                >+ {c.name} ({c.code})</Button>
              ))}
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="isp-langs">Language per country (CSV: CountryCode:LanguageCode)</Label>
            <Textarea
              id="isp-langs"
              value={languagesText}
              onChange={(e) => setLanguagesText(e.target.value)}
              placeholder="US:en, GB:en, DE:de, FR:fr"
              className="min-h-[60px] resize-y font-mono text-xs"
            />
          </div>
        </CardContent>
      </Card>

      {plans.length > 0 ? (
        <>
          <Card>
            <CardContent className="p-4 space-y-2">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <Globe className="h-4 w-4" /> {stats.totalCountries} countries · {stats.totalHreflangTags} hreflang tags
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                <Stat label="Countries" value={stats.totalCountries} />
                <Stat label="Hreflang tags" value={stats.totalHreflangTags} />
                <Stat
                  label="Issues"
                  value={stats.validationIssues}
                  highlight={stats.validationIssues === 0 ? "good" : "bad"}
                />
                <Stat
                  label="Status"
                  value={stats.validationIssues === 0 ? "OK" : "Check"}
                  highlight={stats.validationIssues === 0 ? "good" : "bad"}
                />
              </div>
              {issues.length > 0 && (
                <div className="space-y-1 pt-2">
                  {issues.slice(0, 6).map((i, idx) => (
                    <div key={idx} className="flex items-start gap-1.5 rounded border border-amber-200 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-900 px-3 py-1.5 text-xs">
                      <AlertCircle className="h-3.5 w-3.5 mt-0.5 text-amber-600 flex-shrink-0" />
                      <span className="font-mono text-[10px] text-amber-700 dark:text-amber-400">[{i.type}]</span>
                      <span className="text-amber-900 dark:text-amber-200">{i.message}</span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                  <Globe className="h-4 w-4" /> Country plans ({filteredPlans.length})
                </h3>
                <Input
                  value={filterQuery}
                  onChange={(e) => setFilterQuery(e.target.value)}
                  placeholder="Filter by country..."
                  className="h-8 max-w-[200px] text-xs"
                />
              </div>
              <div className="space-y-1 max-h-[400px] overflow-auto">
                {filteredPlans.map((p, i) => (
                  <div key={i} className="rounded border bg-background px-3 py-2 text-xs space-y-1">
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className="text-[10px] font-mono">{p.country.code}</Badge>
                      <span className="font-medium text-foreground">{p.country.name}</span>
                      <Badge variant="outline" className="text-[10px] font-mono ml-auto">{p.hreflang}</Badge>
                    </div>
                    <a
                      href={p.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 font-mono text-[11px] text-primary hover:underline"
                    >
                      {p.url}
                      <ExternalLink className="h-3 w-3 flex-shrink-0" />
                    </a>
                    <code className="block text-[10px] text-muted-foreground bg-muted/50 px-2 py-1 rounded break-all">
                      {p.hreflangTag}
                    </code>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 space-y-2">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <CheckCircle2 className="h-4 w-4" /> Hreflang tags ({tags.length})
              </h3>
              <div className="space-y-1 max-h-[200px] overflow-auto">
                {tags.map((t, i) => (
                  <code key={i} className="block text-[10px] font-mono text-muted-foreground bg-muted/50 px-2 py-1 rounded break-all">
                    {t.hreflang === "x-default"
                      ? `<link rel="alternate" hreflang="x-default" href="${t.url}" />`
                      : `<link rel="alternate" hreflang="${t.hreflang}" href="${t.url}" />`}
                  </code>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                  <Table2 className="h-4 w-4" /> Actions
                </h3>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowComparison((s) => !s)}
                >
                  {showComparison ? "Hide" : "Show"} strategy comparison
                </Button>
              </div>
              {showComparison && (
                <div className="space-y-2">
                  {STRATEGY_COMPARISON.map((row) => (
                    <div key={row.strategy} className="rounded border bg-background px-3 py-2 text-xs space-y-1">
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary" className="text-[10px] font-mono">{row.strategy}</Badge>
                        <span className="font-mono text-[11px] text-muted-foreground">{row.example}</span>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-1">
                        <div>
                          <div className="text-[10px] uppercase tracking-wide text-emerald-600">Pros</div>
                          <ul className="text-[11px] list-disc pl-4 space-y-0.5">
                            {row.pros.map((p, i) => <li key={i}>{p}</li>)}
                          </ul>
                        </div>
                        <div>
                          <div className="text-[10px] uppercase tracking-wide text-red-600">Cons</div>
                          <ul className="text-[11px] list-disc pl-4 space-y-0.5">
                            {row.cons.map((c, i) => <li key={i}>{c}</li>)}
                          </ul>
                        </div>
                      </div>
                      <p className="text-[11px] italic text-muted-foreground pt-1">{row.seoImpact}</p>
                    </div>
                  ))}
                </div>
              )}
              <div className="flex flex-wrap gap-2">
                <CopyButton
                  getText={() => { handleSaveHistory(); return text; }}
                  label="Copy report"
                />
                <DownloadButton
                  getText={() => { handleSaveHistory(); return text; }}
                  filename="international-seo-plan.txt"
                  mime="text/plain"
                  label="Download .txt"
                />
                <DownloadButton
                  getText={() => csv}
                  filename="international-seo-plan.csv"
                  mime="text/csv"
                  label="Download CSV"
                />
                <ShareButton getUrl={() => { handleSaveHistory(); return buildShareUrl(mainDomain, countriesText, strategy, languagesText); }} />
                <ClearButton onClick={handleClear} />
              </div>
            </CardContent>
          </Card>
        </>
      ) : (
        <EmptyState
          title="Enter target countries to generate hreflang + URLs"
          hint="Add countries one per line as 'Country:Code' (e.g. 'Germany:DE'). Pick a URL structure and map each country to its language. The planner generates per-country URLs, hreflang tags, x-default, and a validation report."
          icon={<Globe className="h-8 w-8" />}
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
                  <Badge variant="outline" className="mr-2 font-mono">{h.strategy}</Badge>
                  <Badge variant="outline" className="mr-2">{h.totalCountries} countries</Badge>
                  <Badge variant="outline" className="mr-2">{h.totalTags} tags</Badge>
                  <Badge variant={h.issues === 0 ? "secondary" : "destructive"} className="mr-2">{h.issues} issues</Badge>
                  <span className="font-mono text-muted-foreground">{h.mainDomain}</span>
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
            <strong className="text-foreground">Privacy:</strong> All planning, generation, and validation runs locally in your browser. History is stored in localStorage on this device only.
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

// Suppress unused-import lint
export type _Unused = CountryPlan;
