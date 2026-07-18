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
  LOCALE_PRESETS,
  SUPPORTED_LANGUAGES,
  parseLocales,
  parseModifiers,
  generateAllReports,
  flattenVariants,
  filterByLocale,
  computeStats,
  renderText,
  renderCsv,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  type LocaleReport,
  type HistoryEntry,
} from "./logic";
import { Languages, History, ExternalLink, AlertCircle } from "lucide-react";

export default function LocaleKeywordResearcher() {
  const [baseKeyword, setBaseKeyword] = useState("buy shoes");
  const [localesText, setLocalesText] = useState("en-US\nde-DE\nfr-FR\nja-JP");
  const [modifiersText, setModifiersText] = useState("online, near me, cheap, best");
  const [filterLocale, setFilterLocale] = useState("");
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  useEffect(() => {
    setHistory(loadHistory());
    if (typeof window !== "undefined" && window.location.hash) {
      const p = parseShareUrl(window.location.hash);
      if (p.baseKeyword) setBaseKeyword(p.baseKeyword);
      if (p.localesText) setLocalesText(p.localesText);
      if (p.modifiersText) setModifiersText(p.modifiersText);
      if (p.baseKeyword || p.localesText || p.modifiersText) toast.info("Loaded from share link");
    }
  }, []);

  const locales = useMemo(() => parseLocales(localesText), [localesText]);
  const modifiers = useMemo(() => parseModifiers(modifiersText), [modifiersText]);
  const reports = useMemo(
    () => generateAllReports(baseKeyword, locales, modifiers),
    [baseKeyword, locales, modifiers],
  );
  const allVariants = useMemo(() => flattenVariants(reports), [reports]);
  const filteredVariants = useMemo(
    () => filterByLocale(allVariants, filterLocale),
    [allVariants, filterLocale],
  );
  const stats = useMemo(() => computeStats(reports), [reports]);
  const text = useMemo(() => renderText(baseKeyword, reports), [baseKeyword, reports]);
  const csv = useMemo(() => renderCsv(reports), [reports]);

  const handleSaveHistory = useCallback(() => {
    if (reports.length > 0) {
      saveHistory({
        ts: Date.now(),
        baseKeyword,
        locales: locales.map((l) => l.locale),
        totalVariants: allVariants.length,
      });
      setHistory(loadHistory());
    }
  }, [reports, allVariants, baseKeyword, locales]);

  const handleClear = useCallback(() => {
    setBaseKeyword("");
    setLocalesText("");
    setModifiersText("");
    setFilterLocale("");
    toast.info("Cleared");
  }, []);

  const handleClearHistory = useCallback(() => {
    clearHistory();
    setHistory([]);
    toast.success("History cleared");
  }, []);

  const addLocalePreset = (locale: string) => {
    setLocalesText((prev) => {
      if (prev.includes(locale)) return prev;
      return prev ? `${prev}\n${locale}` : locale;
    });
  };

  return (
    <div className="space-y-4 unq-animate-fade-in-up">
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="lkr-base">Base keyword</Label>
            <Input
              id="lkr-base"
              value={baseKeyword}
              onChange={(e) => setBaseKeyword(e.target.value)}
              placeholder="buy shoes"
              className="font-mono text-xs"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="lkr-locales">Target locales (one per line as Language-Country)</Label>
            <Textarea
              id="lkr-locales"
              value={localesText}
              onChange={(e) => setLocalesText(e.target.value)}
              placeholder={"en-US\nde-DE\nfr-FR"}
              className="min-h-[100px] resize-y font-mono text-xs"
            />
            <div className="flex flex-wrap gap-1">
              {LOCALE_PRESETS.map((p) => (
                <Button
                  key={p.locale}
                  variant="ghost"
                  size="sm"
                  className="h-6 text-[11px]"
                  onClick={() => addLocalePreset(p.locale)}
                >+ {p.locale}</Button>
              ))}
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="lkr-mods">Modifiers (comma-separated)</Label>
            <Textarea
              id="lkr-mods"
              value={modifiersText}
              onChange={(e) => setModifiersText(e.target.value)}
              placeholder="online, near me, cheap, best"
              className="min-h-[60px] resize-y font-mono text-xs"
            />
          </div>
        </CardContent>
      </Card>

      {reports.length > 0 ? (
        <>
          <Card>
            <CardContent className="p-4 space-y-2">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <Languages className="h-4 w-4" /> {stats.totalLocales} locales · {stats.totalVariants} variants
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                <Stat label="Locales" value={stats.totalLocales} />
                <Stat label="Variants" value={stats.totalVariants} />
                <Stat
                  label="Untranslatable"
                  value={stats.totalUntranslatable}
                  highlight={stats.totalUntranslatable === 0 ? "good" : "bad"}
                />
                <Stat label="Currencies" value={stats.currencies.join(", ") || "—"} />
              </div>
              {stats.totalUntranslatable > 0 && (
                <div className="flex items-start gap-1.5 rounded border border-amber-200 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-900 px-3 py-1.5 text-xs">
                  <AlertCircle className="h-3.5 w-3.5 mt-0.5 text-amber-600 flex-shrink-0" />
                  <span className="text-amber-900 dark:text-amber-200">
                    Some words couldn't be translated — they'll appear in the original form. Add them to your keyword table manually if needed.
                  </span>
                </div>
              )}
            </CardContent>
          </Card>

          {reports.map((r) => (
            <Card key={r.locale.locale}>
              <CardContent className="p-4 space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="secondary" className="font-mono text-[10px]">{r.locale.locale}</Badge>
                  <span className="text-xs font-medium text-foreground">{r.locale.language}-{r.locale.country}</span>
                  <Badge variant="outline" className="text-[10px] ml-auto">{r.currency}</Badge>
                </div>
                <div className="text-xs">
                  <span className="text-muted-foreground">Translated base: </span>
                  <span className="font-mono font-medium text-foreground">{r.translatedBase}</span>
                </div>
                {r.untranslatableWords.length > 0 && (
                  <div className="flex items-center gap-1 text-[10px] text-amber-700 dark:text-amber-400">
                    <AlertCircle className="h-3 w-3" />
                    <span>Untranslatable: {r.untranslatableWords.join(", ")}</span>
                  </div>
                )}
                <div className="space-y-1">
                  {r.variants.map((v, i) => (
                    <div key={i} className="rounded border bg-background px-3 py-1.5 text-xs">
                      <div className="flex items-center gap-2">
                        {v.modifier ? (
                          <Badge variant="outline" className="text-[10px]">{v.modifier}</Badge>
                        ) : null}
                        <span className="font-mono font-medium text-foreground">{v.combinedKeyword}</span>
                      </div>
                      <a
                        href={v.googleUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 mt-1 text-[11px] text-primary hover:underline"
                      >
                        {v.googleUrl}
                        <ExternalLink className="h-3 w-3 flex-shrink-0" />
                      </a>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}

          <Card>
            <CardContent className="p-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                  <Languages className="h-4 w-4" /> All variants ({filteredVariants.length})
                </h3>
                <Input
                  value={filterLocale}
                  onChange={(e) => setFilterLocale(e.target.value)}
                  placeholder="Filter by locale..."
                  className="h-8 max-w-[200px] text-xs"
                />
              </div>
              <div className="space-y-1 max-h-[400px] overflow-auto">
                {filteredVariants.map((v, i) => (
                  <div key={i} className="flex items-center gap-2 rounded border bg-background px-3 py-1.5 text-xs">
                    <Badge variant="secondary" className="text-[10px] font-mono">{v.locale}</Badge>
                    <span className="font-mono text-foreground flex-1 truncate">{v.combinedKeyword}</span>
                    <a
                      href={v.googleUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:underline flex items-center gap-1 text-[10px] flex-shrink-0"
                    >
                      Google
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  </div>
                ))}
              </div>
              <div className="flex flex-wrap gap-2 pt-2">
                <CopyButton
                  getText={() => { handleSaveHistory(); return text; }}
                  label="Copy report"
                />
                <DownloadButton
                  getText={() => { handleSaveHistory(); return text; }}
                  filename="locale-keywords.txt"
                  mime="text/plain"
                  label="Download .txt"
                />
                <DownloadButton
                  getText={() => csv}
                  filename="locale-keywords.csv"
                  mime="text/csv"
                  label="Download CSV"
                />
                <ShareButton getUrl={() => { handleSaveHistory(); return buildShareUrl(baseKeyword, localesText, modifiersText); }} />
                <ClearButton onClick={handleClear} />
              </div>
            </CardContent>
          </Card>
        </>
      ) : (
        <EmptyState
          title="Enter a base keyword and target locales"
          hint="Add locales one per line as 'Language-Country' (e.g. 'de-DE'). The tool translates your base keyword across 10 languages using a 50+ word built-in table, applies locale spelling variants, attaches modifiers, and produces Google search URLs per locale."
          icon={<Languages className="h-8 w-8" />}
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
                  <Badge variant="outline" className="mr-2">{h.locales.length} locales</Badge>
                  <Badge variant="outline" className="mr-2">{h.totalVariants} variants</Badge>
                  <span className="font-mono text-muted-foreground">{h.baseKeyword}</span>
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
            <strong className="text-foreground">Privacy:</strong> All translation, combination, and URL generation runs locally. History is stored in localStorage on this device only.
          </p>
          <p className="text-[10px] text-muted-foreground mt-1">
            Supported languages: {SUPPORTED_LANGUAGES.join(", ")}
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
      <div className={`text-base font-semibold ${color} truncate`}>{value}</div>
    </div>
  );
}

// Suppress unused-import lint
export type _Unused = LocaleReport;
