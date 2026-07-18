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
  BUSINESS_PRESETS,
  parseServices,
  scoreDescription,
  keywordDensity,
  generatePosts,
  suggestCategories,
  generatePhotoPlan,
  suggestQa,
  buildReport,
  renderText,
  renderCsv,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  type GbpInput,
  type HistoryEntry,
} from "./logic";
import { Store, History, FileSpreadsheet, Check, X, Lightbulb } from "lucide-react";

const EMPTY_INPUT: GbpInput = {
  businessName: "",
  primaryCategory: "",
  services: [],
  city: "",
  description: "",
  hours: "",
  website: "",
};

export default function GbpOptimizer() {
  const [businessName, setBusinessName] = useState("");
  const [primaryCategory, setPrimaryCategory] = useState("");
  const [servicesText, setServicesText] = useState("");
  const [city, setCity] = useState("");
  const [description, setDescription] = useState("");
  const [hours, setHours] = useState("");
  const [website, setWebsite] = useState("");
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  useEffect(() => {
    setHistory(loadHistory());
    if (typeof window !== "undefined" && window.location.hash) {
      const p = parseShareUrl(window.location.hash);
      let touched = false;
      if (p.businessName !== undefined) { setBusinessName(p.businessName); touched = true; }
      if (p.primaryCategory !== undefined) { setPrimaryCategory(p.primaryCategory); touched = true; }
      if (p.services !== undefined) {
        setServicesText(p.services.join("\n"));
        touched = true;
      }
      if (p.city !== undefined) { setCity(p.city); touched = true; }
      if (p.description !== undefined) { setDescription(p.description); touched = true; }
      if (p.hours !== undefined) { setHours(p.hours); touched = true; }
      if (p.website !== undefined) { setWebsite(p.website); touched = true; }
      if (touched) toast.info("Loaded from share link");
    }
  }, []);

  const services = useMemo(() => parseServices(servicesText), [servicesText]);

  const input: GbpInput = useMemo(
    () => ({
      businessName,
      primaryCategory,
      services,
      city,
      description,
      hours,
      website,
    }),
    [businessName, primaryCategory, services, city, description, hours, website],
  );

  const report = useMemo(() => buildReport(input), [input]);
  const text = useMemo(() => renderText(report), [report]);
  const csv = useMemo(() => renderCsv(report), [report]);

  const hasInput =
    businessName || primaryCategory || servicesText || city || description || hours || website;

  const handleSaveHistory = useCallback(() => {
    if (hasInput) {
      saveHistory({
        ts: Date.now(),
        businessName,
        primaryCategory,
        city,
        descriptionScore: report.score.total,
      });
      setHistory(loadHistory());
    }
  }, [hasInput, businessName, primaryCategory, city, report.score.total]);

  const handleClear = useCallback(() => {
    setBusinessName("");
    setPrimaryCategory("");
    setServicesText("");
    setCity("");
    setDescription("");
    setHours("");
    setWebsite("");
    toast.info("Cleared");
  }, []);

  const handleClearHistory = useCallback(() => {
    clearHistory();
    setHistory([]);
    toast.success("History cleared");
  }, []);

  const applyPreset = (presetId: string) => {
    const preset = BUSINESS_PRESETS.find((p) => p.id === presetId);
    if (!preset) return;
    setPrimaryCategory(preset.primaryCategory);
    setServicesText(preset.sampleServices.join("\n"));
    toast.info(`Applied preset: ${preset.label}`);
  };

  return (
    <div className="space-y-4 unq-animate-fade-in-up">
      <Card>
        <CardContent className="p-4 space-y-3">
          <div>
            <Label className="text-xs">Business type presets (auto-fills category + services)</Label>
            <div className="flex flex-wrap gap-1 pt-1">
              {BUSINESS_PRESETS.map((p) => (
                <Button
                  key={p.id}
                  variant="ghost"
                  size="sm"
                  className="h-7 text-[11px]"
                  onClick={() => applyPreset(p.id)}
                >+ {p.label}</Button>
              ))}
            </div>
          </div>
          <div className="grid md:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="gbp-name">Business name</Label>
              <Input
                id="gbp-name"
                value={businessName}
                onChange={(e) => setBusinessName(e.target.value)}
                placeholder="Austin Plumbing Pros"
                className="h-9 text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="gbp-cat">Primary category</Label>
              <Input
                id="gbp-cat"
                value={primaryCategory}
                onChange={(e) => setPrimaryCategory(e.target.value)}
                placeholder="Plumber"
                className="h-9 text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="gbp-city">City</Label>
              <Input
                id="gbp-city"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder="Austin, TX"
                className="h-9 text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="gbp-web">Website</Label>
              <Input
                id="gbp-web"
                value={website}
                onChange={(e) => setWebsite(e.target.value)}
                placeholder="https://example.com"
                className="h-9 text-sm"
              />
            </div>
            <div className="space-y-1.5 md:col-span-2">
              <Label htmlFor="gbp-services">Services (one per line)</Label>
              <Textarea
                id="gbp-services"
                value={servicesText}
                onChange={(e) => setServicesText(e.target.value)}
                placeholder={"Drain cleaning\nLeak repair\nWater heater installation"}
                className="min-h-[80px] resize-y font-mono text-xs"
              />
            </div>
            <div className="space-y-1.5 md:col-span-2">
              <Label htmlFor="gbp-hours">Hours</Label>
              <Input
                id="gbp-hours"
                value={hours}
                onChange={(e) => setHours(e.target.value)}
                placeholder="Mon-Fri 9-5, Sat 10-2"
                className="h-9 text-sm"
              />
            </div>
            <div className="space-y-1.5 md:col-span-2">
              <Label htmlFor="gbp-desc">
                Description (GBP "about" section) — {description.length} chars / {report.score.wordCount} words
              </Label>
              <Textarea
                id="gbp-desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder={"Write your GBP description here. Aim for 200-750 characters. Include your category keyword, city, a service mention, and a call-to-action."}
                className="min-h-[140px] resize-y text-sm"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {hasInput ? (
        <>
          <Card>
            <CardContent className="p-4 space-y-3">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <Store className="h-4 w-4" /> Description score
              </h3>
              <div className="flex items-baseline gap-2">
                <span className={`text-3xl font-bold ${report.score.total >= 75 ? "text-emerald-600 dark:text-emerald-400" : report.score.total >= 50 ? "text-amber-600 dark:text-amber-400" : "text-red-600 dark:text-red-400"}`}>
                  {report.score.total}
                </span>
                <span className="text-sm text-muted-foreground">/ 100</span>
              </div>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
                <ScoreComponent label="Length 200-750 chars" ok={report.score.components.lengthOk} points={30} />
                <ScoreComponent label="Has primary category" ok={report.score.components.hasCategory} points={20} />
                <ScoreComponent label="Has city name" ok={report.score.components.hasCity} points={20} />
                <ScoreComponent label="Has service keyword" ok={report.score.components.hasService} points={15} />
                <ScoreComponent label="Has call-to-action" ok={report.score.components.hasCta} points={15} />
              </div>
              {report.score.missing.length > 0 && (
                <div className="rounded border bg-amber-50 dark:bg-amber-950/30 px-3 py-2 text-xs">
                  <div className="flex items-center gap-1.5 text-amber-700 dark:text-amber-400 font-medium">
                    <Lightbulb className="h-3.5 w-3.5" /> Missing components
                  </div>
                  <div className="mt-1 text-muted-foreground">{report.score.missing.join(" · ")}</div>
                </div>
              )}
              {report.keywordDensity.length > 0 && (
                <div>
                  <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">Top keywords</h4>
                  <div className="flex flex-wrap gap-1.5">
                    {report.keywordDensity.map((k) => (
                      <Badge key={k.word} variant="outline" className="text-[10px]">
                        {k.word} ×{k.count} ({(k.density * 100).toFixed(0)}%)
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <div className="grid md:grid-cols-2 gap-4">
            <Card>
              <CardContent className="p-4 space-y-2">
                <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">GBP Post Templates</h4>
                {report.posts.map((p) => (
                  <div key={p.type} className="rounded border bg-background px-3 py-2 text-xs space-y-1">
                    <div className="flex items-center justify-between">
                      <Badge variant="secondary" className="text-[10px]">{p.title}</Badge>
                      <span className="text-[10px] text-muted-foreground">CTA: {p.cta} · {p.body.length} chars</span>
                    </div>
                    <p className="text-foreground">{p.body}</p>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4 space-y-2">
                <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Category Suggestions</h4>
                {report.categorySuggestions.length === 0 ? (
                  <p className="text-xs text-muted-foreground">Set a primary category to see suggestions.</p>
                ) : (
                  <div className="flex flex-wrap gap-1.5">
                    {report.categorySuggestions.map((c) => (
                      <Badge key={c} variant="outline" className="text-[10px]">{c}</Badge>
                    ))}
                  </div>
                )}
                <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground pt-2">Photo Plan</h4>
                <div className="space-y-1">
                  {report.photoPlan.map((p) => (
                    <div key={p.id} className="flex items-start gap-2 text-xs">
                      <Badge variant={p.required ? "default" : "outline"} className="text-[10px] mt-0.5">
                        {p.required ? "REQ" : "OPT"}
                      </Badge>
                      <div>
                        <span className="font-medium text-foreground">{p.label}</span>
                        <span className="text-muted-foreground ml-1">— {p.description}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardContent className="p-4 space-y-2">
              <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Q&A Suggestions</h4>
              <div className="space-y-1">
                {report.qaSuggestions.map((q, i) => (
                  <div key={i} className="rounded border bg-background px-3 py-1.5 text-xs">
                    <span className="text-muted-foreground mr-1.5">Q{i + 1}.</span>
                    <span className="text-foreground">{q}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 space-y-3">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <FileSpreadsheet className="h-4 w-4" /> Export
              </h3>
              <div className="flex flex-wrap gap-2">
                <CopyButton
                  getText={() => { handleSaveHistory(); return text; }}
                  label="Copy report"
                />
                <DownloadButton
                  getText={() => { handleSaveHistory(); return text; }}
                  filename="gbp-optimization-report.txt"
                  mime="text/plain"
                  label="Download .txt"
                />
                <DownloadButton
                  getText={() => csv}
                  filename="gbp-optimization.csv"
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
          title="Enter your Google Business Profile details to optimize"
          hint="Add your business name, primary category, services, city, and description. The tool scores your description, generates post templates, suggests categories, plans photos, and lists Q&A. Click a business-type preset to auto-fill the category and sample services."
          icon={<Store className="h-8 w-8" />}
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
                  <Badge variant="outline" className="mr-2">score {h.descriptionScore}</Badge>
                  <span className="font-medium text-foreground">{h.businessName || "(unnamed)"}</span>
                  <span className="text-muted-foreground ml-1">· {h.primaryCategory || "?"}</span>
                  <span className="text-muted-foreground ml-1">· {h.city || "?"}</span>
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
            <strong className="text-foreground">Privacy:</strong> All analysis, scoring, and template generation runs locally in your browser. History is stored in localStorage on this device only.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function ScoreComponent({
  label,
  ok,
  points,
}: {
  label: string;
  ok: boolean;
  points: number;
}) {
  return (
    <div className={`flex items-center gap-2 rounded border px-3 py-1.5 text-xs ${ok ? "bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-900" : "bg-background"}`}>
      {ok ? (
        <Check className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
      ) : (
        <X className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
      )}
      <span className="flex-1 text-foreground">{label}</span>
      <Badge variant={ok ? "default" : "outline"} className="text-[10px]">+{points}</Badge>
    </div>
  );
}
