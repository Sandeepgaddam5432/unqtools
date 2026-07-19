"use client";

import React, { useState, useMemo, useCallback, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
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
  PIN_CATEGORIES,
  DESCRIPTION_LENGTHS,
  CTA_TYPES,
  CATEGORY_LABELS,
  LENGTH_LABELS,
  CTA_LABELS,
  MAX_CHARS,
  MAX_TITLE_CHARS,
  generateVariations,
  computeSummaryStats,
  renderTextAll,
  renderCsvAll,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  type PinCategory,
  type DescriptionLength,
  type CTAType,
  type PinterestInput,
  type HistoryEntry,
} from "./logic";
import {
  History, Pin, Hash, Type, Search, Sparkles, LayoutGrid, Award,
} from "lucide-react";

export default function PinterestPinDescriptionGenerator() {
  const [pinTopic, setPinTopic] = useState("");
  const [pinCategory, setPinCategory] = useState<PinCategory>("diy");
  const [targetKeywords, setTargetKeywords] = useState("");
  const [includeCTA, setIncludeCTA] = useState(true);
  const [includeHashtags, setIncludeHashtags] = useState(false);
  const [descriptionLength, setDescriptionLength] = useState<DescriptionLength>("medium");
  const [ctaType, setCtaType] = useState<CTAType>("save");
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  useEffect(() => {
    setHistory(loadHistory());
    if (typeof window !== "undefined" && window.location.hash) {
      const p = parseShareUrl(window.location.hash);
      if (p.pinTopic) setPinTopic(p.pinTopic);
      setPinCategory(p.pinCategory);
      if (p.targetKeywords) setTargetKeywords(p.targetKeywords);
      setIncludeCTA(p.includeCTA);
      setIncludeHashtags(p.includeHashtags);
      setDescriptionLength(p.descriptionLength);
      setCtaType(p.ctaType);
      if (p.pinTopic || p.targetKeywords) toast.info("Loaded from share link");
    }
  }, []);

  const input: PinterestInput = useMemo(
    () => ({
      pinTopic,
      pinCategory,
      targetKeywords,
      includeCTA,
      includeHashtags,
      descriptionLength,
      ctaType,
    }),
    [
      pinTopic, pinCategory, targetKeywords,
      includeCTA, includeHashtags, descriptionLength, ctaType,
    ],
  );

  const variations = useMemo(() => generateVariations(input), [input]);
  const stats = useMemo(() => computeSummaryStats(variations), [variations]);
  const text = useMemo(() => renderTextAll(variations), [variations]);
  const csv = useMemo(() => renderCsvAll(variations), [variations]);

  const handleSaveHistory = useCallback(() => {
    if (variations.length > 0) {
      const kwCount = variations[0].keywordCount;
      saveHistory({
        ts: Date.now(),
        pinTopic,
        pinCategory,
        descriptionLength,
        keywordCount: kwCount,
        variationCount: variations.length,
        seoScore: stats.avgSeoScore,
      });
      setHistory(loadHistory());
    }
  }, [variations, pinTopic, pinCategory, descriptionLength, stats.avgSeoScore]);

  const handleClear = useCallback(() => {
    setPinTopic("");
    setPinCategory("diy");
    setTargetKeywords("");
    setIncludeCTA(true);
    setIncludeHashtags(false);
    setDescriptionLength("medium");
    setCtaType("save");
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
          <div className="space-y-1.5">
            <Label htmlFor="pin-topic">Pin topic</Label>
            <Input
              id="pin-topic"
              value={pinTopic}
              onChange={(e) => setPinTopic(e.target.value)}
              placeholder="e.g. Easy 5-minute pasta recipe"
              className="text-sm"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pin-keywords">Target keywords (comma-separated)</Label>
            <Textarea
              id="pin-keywords"
              value={targetKeywords}
              onChange={(e) => setTargetKeywords(e.target.value)}
              placeholder={"pasta, italian, weeknight dinner"}
              className="min-h-[60px] resize-y font-mono text-xs"
            />
            <p className="text-[10px] text-muted-foreground">
              Main keyword is the first one — it will be placed in the first 100 characters.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Category</Label>
              <select
                value={pinCategory}
                onChange={(e) => setPinCategory(e.target.value as PinCategory)}
                className="h-9 w-full text-sm rounded border bg-background px-2"
              >
                {PIN_CATEGORIES.map((c) => (
                  <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Description length</Label>
              <select
                value={descriptionLength}
                onChange={(e) => setDescriptionLength(e.target.value as DescriptionLength)}
                className="h-9 w-full text-sm rounded border bg-background px-2"
              >
                {DESCRIPTION_LENGTHS.map((l) => (
                  <option key={l} value={l}>{LENGTH_LABELS[l]}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">CTA type</Label>
              <select
                value={ctaType}
                onChange={(e) => setCtaType(e.target.value as CTAType)}
                className="h-9 w-full text-sm rounded border bg-background px-2"
                disabled={!includeCTA}
              >
                {CTA_TYPES.map((t) => (
                  <option key={t} value={t}>{CTA_LABELS[t]}</option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-2 justify-end pb-1">
              <label className="flex items-center gap-1.5 text-xs cursor-pointer">
                <input
                  type="checkbox"
                  checked={includeCTA}
                  onChange={(e) => setIncludeCTA(e.target.checked)}
                />
                Include CTA
              </label>
              <label className="flex items-center gap-1.5 text-xs cursor-pointer">
                <input
                  type="checkbox"
                  checked={includeHashtags}
                  onChange={(e) => setIncludeHashtags(e.target.checked)}
                />
                Include hashtags (optional)
              </label>
            </div>
          </div>
        </CardContent>
      </Card>

      {variations.length > 0 ? (
        <>
          <Card>
            <CardContent className="p-4 space-y-2">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <Sparkles className="h-4 w-4" /> Summary
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                <Stat label="Variations" value={stats.totalVariations} />
                <Stat label="Avg chars" value={stats.avgChars} />
                <Stat label="Avg words" value={stats.avgWords} />
                <Stat label="Avg keywords" value={stats.avgKeywords} />
                <Stat label="Avg hashtags" value={stats.avgHashtags} />
                <Stat label="Within limit" value={`${stats.withinLimitCount}/${stats.totalVariations}`} highlight={stats.withinLimitCount === stats.totalVariations ? "good" : undefined} />
                <Stat label="Avg SEO score" value={`${stats.avgSeoScore}/100`} highlight={stats.avgSeoScore >= 70 ? "good" : stats.avgSeoScore < 50 ? "bad" : undefined} />
                <Stat label="Max chars" value={MAX_CHARS} />
              </div>
            </CardContent>
          </Card>

          {variations.map((pin) => (
            <Card key={pin.variation}>
              <CardContent className="p-4 space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                    <Pin className="h-4 w-4" /> Variation {pin.variation}
                  </h3>
                  <div className="flex items-center gap-1.5">
                    <Badge variant="outline" className={pin.withinLimit ? "text-emerald-600 dark:text-emerald-400 border-emerald-500/30" : "text-red-600 dark:text-red-400 border-red-500/30"}>
                      {pin.charCount} chars
                    </Badge>
                    <Badge variant="outline" className="text-[10px]">
                      <Award className="h-3 w-3 mr-1" /> {pin.seoScore}/100
                    </Badge>
                  </div>
                </div>

                <div className="space-y-1">
                  <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Pin title (max 100 chars)</div>
                  <div className="rounded border bg-background px-3 py-1.5 text-sm font-semibold text-foreground">
                    {pin.pinTitle}
                    <span className="ml-2 text-[10px] text-muted-foreground">
                      {Array.from(pin.pinTitle).length}/{MAX_TITLE_CHARS}
                    </span>
                  </div>
                </div>

                <div className="space-y-1">
                  <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Full description</div>
                  <div className="rounded border bg-background px-3 py-2 text-sm font-medium text-foreground whitespace-pre-wrap">
                    {pin.fullDescription}
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px]">
                  <Mini label="Opener" value={pin.opener} icon={<Sparkles className="h-3 w-3" />} />
                  <Mini label="CTA" value={pin.cta || "—"} icon={<Type className="h-3 w-3" />} />
                  <Mini label="Board name" value={pin.boardName} icon={<LayoutGrid className="h-3 w-3" />} />
                  <Mini label="Keywords" value={pin.keywords.join(", ") || "—"} icon={<Search className="h-3 w-3" />} />
                </div>

                {pin.hashtags.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {pin.hashtags.map((h) => (
                      <Badge key={h} variant="secondary" className="text-[10px]">#{h}</Badge>
                    ))}
                  </div>
                )}

                {pin.keywordDensities.length > 0 && (
                  <div className="pt-1">
                    <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1.5">
                      Keyword densities (1-3% optimal)
                    </div>
                    <div className="space-y-1">
                      {pin.keywordDensities.map((kd) => (
                        <div
                          key={kd.keyword}
                          className={`rounded border px-3 py-1 text-[11px] flex items-center justify-between ${
                            kd.optimal
                              ? "border-emerald-500/30 bg-emerald-500/5"
                              : kd.count === 0
                                ? "border-amber-500/30 bg-amber-500/5"
                                : "border-red-500/30 bg-red-500/5"
                          }`}
                        >
                          <span className="font-mono text-foreground">{kd.keyword}</span>
                          <span className="text-muted-foreground">
                            {kd.count}x · {kd.density}% {kd.optimal ? "✓" : kd.count === 0 ? "missing" : "high"}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {pin.longTailKeywords.length > 0 && (
                  <div className="pt-1">
                    <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">
                      Long-tail keyword suggestions
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {pin.longTailKeywords.map((k) => (
                        <Badge key={k} variant="outline" className="text-[10px]">{k}</Badge>
                      ))}
                    </div>
                  </div>
                )}

                <div className="text-[10px] text-muted-foreground pt-1 flex items-center gap-2">
                  <Hash className="h-3 w-3" />
                  Main keyword in first 100 chars: {pin.mainKeywordInFirst100 ? "✓ yes" : "✗ no"}
                </div>
              </CardContent>
            </Card>
          ))}

          <Card>
            <CardContent className="p-4 space-y-2">
              <h3 className="text-sm font-semibold text-foreground">Export &amp; share</h3>
              <div className="flex flex-wrap gap-2">
                <CopyButton
                  getText={() => { handleSaveHistory(); return text; }}
                  label="Copy all"
                />
                <DownloadButton
                  getText={() => { handleSaveHistory(); return text; }}
                  filename="pinterest-pin-descriptions.txt"
                  mime="text/plain"
                  label="Download .txt"
                />
                <DownloadButton
                  getText={() => csv}
                  filename="pinterest-pin-descriptions.csv"
                  mime="text/csv"
                  label="Download CSV"
                />
                <ShareButton getUrl={() => { handleSaveHistory(); return buildShareUrl(input); }} />
                <ClearButton onClick={handleClear} />
              </div>
            </CardContent>
          </Card>
        </>
      ) : (
        <EmptyState
          title="Enter a pin topic or keywords to generate descriptions"
          hint="Pick a category and description length to generate 3 SEO-optimized variations with keyword density analysis, pin title, and board name suggestions."
          icon={<Pin className="h-8 w-8" />}
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
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline" className="text-[10px]">{CATEGORY_LABELS[h.pinCategory]}</Badge>
                    <Badge variant="outline" className="text-[10px]">{h.descriptionLength}</Badge>
                    <Badge variant="outline" className="text-[10px]">{h.keywordCount} kw</Badge>
                    <Badge variant="outline" className="text-[10px]">
                      <Award className="h-3 w-3 mr-1" /> {h.seoScore}/100
                    </Badge>
                    <span className="text-muted-foreground">{h.pinTopic}</span>
                    <span className="text-muted-foreground ml-auto">{new Date(h.ts).toLocaleString()}</span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-3">
          <p className="text-xs text-muted-foreground">
            <strong className="text-foreground">Privacy:</strong> All description generation runs locally. No network calls. History is stored in localStorage on this device only.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function Mini({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="rounded border bg-background px-2 py-1.5">
      <div className="text-[9px] uppercase tracking-wide text-muted-foreground flex items-center gap-1">
        {icon} {label}
      </div>
      <div className="text-[11px] text-foreground line-clamp-2">{value}</div>
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
