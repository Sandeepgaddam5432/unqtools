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
  RunButton,
} from "../../_shared";
import { toast } from "sonner";
import {
  RELEASE_TYPE_LABELS,
  TONE_LABELS,
  LENGTH_LABELS,
  ANGLE_LABELS,
  NEWSWORTHINESS_LABELS,
  SAMPLE_INPUTS,
  normalizeText,
  detectReleaseType,
  suggestTone,
  checkNewsworthiness,
  generateRelease,
  chooseHeadline,
  chooseSeoHeadline,
  updateQuote,
  computeStats,
  renderText,
  renderMarkdown,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  type ReleaseType,
  type Tone,
  type Length,
  type PressRelease,
  type ReleaseInputs,
  type HistoryEntry,
} from "./logic";
import {
  Newspaper, History, Sparkles, RefreshCw, AlertTriangle,
  CheckCircle2, Lightbulb,
} from "lucide-react";

const EMPTY_INPUTS: ReleaseInputs = {
  organization: "",
  what: "",
  when: "",
  where: "",
  why: "",
  who: "",
  contactName: "",
  contactEmail: "",
  contactPhone: "",
  boilerplate: "",
};

export default function AiPressReleaseDraftBuilder() {
  const [inputs, setInputs] = useState<ReleaseInputs>(EMPTY_INPUTS);
  const [releaseType, setReleaseType] = useState<ReleaseType>("product-launch");
  const [tone, setTone] = useState<Tone>("formal");
  const [length, setLength] = useState<Length>("standard");
  const [release, setRelease] = useState<PressRelease | null>(null);
  const [headlineIdx, setHeadlineIdx] = useState(0);
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  useEffect(() => {
    setHistory(loadHistory());
    if (typeof window !== "undefined" && window.location.hash) {
      const s = parseShareUrl(window.location.hash);
      if (s.organization || s.what) {
        setInputs((prev) => ({
          ...prev,
          organization: s.organization,
          what: s.what,
          when: s.when,
          where: s.where,
          why: s.why,
          who: s.who,
        }));
        setReleaseType(s.releaseType);
        setTone(s.tone);
        setLength(s.length);
        toast.info("Loaded from share link");
      }
    }
  }, []);

  const detectedType = useMemo(
    () => (inputs.what ? detectReleaseType(inputs.what) : null),
    [inputs.what],
  );

  const newsworthiness = useMemo(
    () => (release ? checkNewsworthiness(release.inputs, release.releaseType) : null),
    [release],
  );

  const stats = useMemo(
    () => (release ? computeStats(release) : null),
    [release],
  );

  const handleGenerate = useCallback(() => {
    if (!normalizeText(inputs.organization) || !normalizeText(inputs.what)) {
      toast.error("Enter an organization and announcement (what) first");
      return;
    }
    const r = generateRelease(inputs, releaseType, tone, length);
    setRelease(r);
    setHeadlineIdx(0);
    const nw = checkNewsworthiness(inputs, releaseType);
    saveHistory({
      ts: Date.now(),
      organization: inputs.organization,
      what: inputs.what,
      releaseType,
      tone,
      length,
      headline: r.chosenHeadline,
      wordCount: r.wordCount,
      newsworthiness: nw.totalScore,
    });
    setHistory(loadHistory());
    toast.success(
      `Generated ${RELEASE_TYPE_LABELS[releaseType]} release · ${r.wordCount} words · newsworthiness ${nw.totalScore}/${nw.maxScore}`,
    );
  }, [inputs, releaseType, tone, length]);

  const handleClear = useCallback(() => {
    setInputs(EMPTY_INPUTS);
    setRelease(null);
    setHeadlineIdx(0);
    toast.info("Cleared");
  }, []);

  const handleClearHistory = useCallback(() => {
    clearHistory();
    setHistory([]);
    toast.success("History cleared");
  }, []);

  const handleAutoDetect = useCallback(() => {
    if (!inputs.what) return;
    const detected = detectReleaseType(inputs.what);
    setReleaseType(detected);
    setTone(suggestTone(detected));
    toast.success(`Auto-detected: ${RELEASE_TYPE_LABELS[detected]}`);
  }, [inputs.what]);

  const cycleHeadline = useCallback(() => {
    if (!release || release.headlineVariants.length <= 1) return;
    const nextIdx = (headlineIdx + 1) % release.headlineVariants.length;
    setHeadlineIdx(nextIdx);
    setRelease((prev) => (prev ? chooseHeadline(prev, nextIdx) : prev));
  }, [release, headlineIdx]);

  const useSeoVariant = useCallback(() => {
    if (!release) return;
    setRelease((prev) => (prev ? chooseSeoHeadline(prev, headlineIdx) : prev));
    toast.success("Switched to SEO-tight headline");
  }, [release, headlineIdx]);

  const handleQuoteChange = useCallback((text: string) => {
    setRelease((prev) => (prev ? updateQuote(prev, text) : prev));
  }, []);

  const setField = useCallback((field: keyof ReleaseInputs, value: string) => {
    setInputs((prev) => ({ ...prev, [field]: value }));
  }, []);

  return (
    <div className="space-y-4 unq-animate-fade-in-up">
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="apr-org" className="text-xs">Organization *</Label>
              <Input
                id="apr-org"
                value={inputs.organization}
                onChange={(e) => setField("organization", e.target.value)}
                placeholder="Acme"
                className="h-9 text-xs"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="apr-who" className="text-xs">Spokesperson (Name, Title)</Label>
              <Input
                id="apr-who"
                value={inputs.who}
                onChange={(e) => setField("who", e.target.value)}
                placeholder="Jane Doe, CEO"
                className="h-9 text-xs"
              />
            </div>
          </div>

          <div className="space-y-1">
            <Label htmlFor="apr-what" className="text-xs">What is being announced? *</Label>
            <Textarea
              id="apr-what"
              value={inputs.what}
              onChange={(e) => setField("what", e.target.value)}
              placeholder="launches AI-powered inventory forecasting for mid-market retailers"
              className="min-h-[50px] resize-y text-xs"
            />
            {detectedType && detectedType !== releaseType && (
              <p className="text-[11px] text-muted-foreground flex items-center gap-1">
                <Lightbulb className="h-3 w-3" />
                Detected type:
                <button className="underline text-primary" onClick={handleAutoDetect}>
                  {RELEASE_TYPE_LABELS[detectedType]}
                </button>
              </p>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1">
              <Label htmlFor="apr-when" className="text-xs">When</Label>
              <Input
                id="apr-when"
                value={inputs.when}
                onChange={(e) => setField("when", e.target.value)}
                placeholder="today or October 14, 2025"
                className="h-9 text-xs"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="apr-where" className="text-xs">Where (city, state)</Label>
              <Input
                id="apr-where"
                value={inputs.where}
                onChange={(e) => setField("where", e.target.value)}
                placeholder="San Francisco, CA"
                className="h-9 text-xs"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="apr-why" className="text-xs">Why it matters</Label>
              <Input
                id="apr-why"
                value={inputs.why}
                onChange={(e) => setField("why", e.target.value)}
                placeholder="customers lose $120B to stockouts"
                className="h-9 text-xs"
              />
            </div>
          </div>

          <div className="space-y-1">
            <Label htmlFor="apr-boiler" className="text-xs">Boilerplate (About the organization)</Label>
            <Textarea
              id="apr-boiler"
              value={inputs.boilerplate}
              onChange={(e) => setField("boilerplate", e.target.value)}
              placeholder="Acme is the inventory intelligence platform..."
              className="min-h-[60px] resize-y text-xs"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
            <div className="space-y-1">
              <Label htmlFor="apr-cn" className="text-xs">Contact name</Label>
              <Input
                id="apr-cn"
                value={inputs.contactName}
                onChange={(e) => setField("contactName", e.target.value)}
                placeholder="Alex Smith"
                className="h-9 text-xs"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="apr-ce" className="text-xs">Contact email</Label>
              <Input
                id="apr-ce"
                value={inputs.contactEmail}
                onChange={(e) => setField("contactEmail", e.target.value)}
                placeholder="press@acme.com"
                className="h-9 text-xs"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="apr-cp" className="text-xs">Contact phone</Label>
              <Input
                id="apr-cp"
                value={inputs.contactPhone}
                onChange={(e) => setField("contactPhone", e.target.value)}
                placeholder="+1 415 555 0142"
                className="h-9 text-xs"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Release type</Label>
              <select
                value={releaseType}
                onChange={(e) => setReleaseType(e.target.value as ReleaseType)}
                className="h-9 w-full text-xs rounded border bg-background px-2"
              >
                {(Object.keys(RELEASE_TYPE_LABELS) as ReleaseType[]).map((t) => (
                  <option key={t} value={t}>{RELEASE_TYPE_LABELS[t]}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Tone</Label>
              <select
                value={tone}
                onChange={(e) => setTone(e.target.value as Tone)}
                className="h-9 w-full text-xs rounded border bg-background px-2"
              >
                {(Object.keys(TONE_LABELS) as Tone[]).map((t) => (
                  <option key={t} value={t}>{TONE_LABELS[t]}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Length</Label>
              <select
                value={length}
                onChange={(e) => setLength(e.target.value as Length)}
                className="h-9 w-full text-xs rounded border bg-background px-2"
              >
                {(Object.keys(LENGTH_LABELS) as Length[]).map((l) => (
                  <option key={l} value={l}>{LENGTH_LABELS[l]}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <RunButton onClick={handleGenerate} label="Generate release" />
            <ClearButton onClick={handleClear} />
            <ShareButton
              getUrl={() => buildShareUrl({
                organization: inputs.organization,
                what: inputs.what,
                when: inputs.when,
                where: inputs.where,
                why: inputs.why,
                who: inputs.who,
                releaseType,
                tone,
                length,
              })}
            />
            <div className="flex flex-wrap gap-1">
              {SAMPLE_INPUTS.slice(0, 3).map((s, i) => (
                <Button
                  key={i}
                  variant="ghost"
                  size="sm"
                  className="h-7 text-[11px]"
                  onClick={() => {
                    setInputs(s);
                    setReleaseType(detectReleaseType(s.what));
                    setTone(suggestTone(detectReleaseType(s.what)));
                  }}
                >Sample {i + 1}: {s.organization}</Button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {release && stats && newsworthiness ? (
        <>
          <Card>
            <CardContent className="p-4 space-y-2">
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-xs">
                <Stat label="Words" value={stats.wordCount} sub={`/ ${stats.targetWords}`} />
                <Stat label="Paragraphs" value={stats.paragraphCount} />
                <Stat label="Headline chars" value={stats.headlineChars} sub={stats.headlineSeoOk ? "✓ SEO" : "over 65"} />
                <Stat label="Type" value={stats.releaseTypeLabel.split(" ")[0]} />
                <Stat label="Newsworthiness" value={`${newsworthiness.totalScore}/${newsworthiness.maxScore}`} />
              </div>
            </CardContent>
          </Card>

          <NewsworthinessCard result={newsworthiness} />

          <Card>
            <CardContent className="p-4 space-y-3">
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <div className="text-xs uppercase tracking-wide text-muted-foreground">Headline</div>
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={cycleHeadline}
                      className="gap-1 text-[11px] h-6"
                      disabled={release.headlineVariants.length <= 1}
                    >
                      <RefreshCw className="h-3 w-3" />
                      {ANGLE_LABELS[release.headlineVariants[headlineIdx].angle].split(" ")[0]} ({headlineIdx + 1}/{release.headlineVariants.length})
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={useSeoVariant}
                      className="text-[11px] h-6"
                    >Use SEO variant</Button>
                  </div>
                </div>
                <p className="text-base font-semibold text-foreground border-l-2 border-primary pl-3">
                  {release.chosenHeadline}
                </p>
                <p className="text-xs italic text-muted-foreground">{release.subhead}</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 space-y-3">
              <div className="text-xs uppercase tracking-wide text-muted-foreground">Quote (editable)</div>
              <Textarea
                value={release.quote.text}
                onChange={(e) => handleQuoteChange(e.target.value)}
                className="min-h-[80px] resize-y text-sm italic"
              />
              <div className="flex items-center gap-2 text-xs">
                {release.quote.isPlaceholder ? (
                  <Badge variant="outline" className="text-[10px] gap-1 bg-amber-500/10 text-amber-700 dark:text-amber-300">
                    <AlertTriangle className="h-3 w-3" />
                    PLACEHOLDER — replace with an approved quote
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-[10px] gap-1 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300">
                    <CheckCircle2 className="h-3 w-3" />
                    Edited
                  </Badge>
                )}
                <span className="text-muted-foreground">— {release.quote.attribution}</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 space-y-2">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <Newspaper className="h-4 w-4" /> Release preview
              </h3>
              <pre className="text-xs font-mono whitespace-pre-wrap bg-muted/30 rounded p-3 max-h-[500px] overflow-auto">
{renderText(release)}
              </pre>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex flex-wrap gap-2">
                <CopyButton getText={() => renderText(release)} label="Copy release" />
                <DownloadButton
                  getText={() => renderMarkdown(release)}
                  filename="press-release.md"
                  mime="text/markdown"
                  label="Download .md"
                />
                <DownloadButton
                  getText={() => renderText(release)}
                  filename="press-release.txt"
                  mime="text/plain"
                  label="Download .txt"
                />
              </div>
            </CardContent>
          </Card>
        </>
      ) : (
        <EmptyState
          title="Fill in the 5 Ws and click Generate"
          hint="AP-style press release with FOR IMMEDIATE RELEASE, dateline, inverted-pyramid lede, body paragraphs, editable quote, boilerplate, contact, and ### end mark. Five headline angles + newsworthiness check."
          icon={<Sparkles className="h-8 w-8" />}
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
                <button
                  key={i}
                  onClick={() => {
                    setInputs((prev) => ({
                      ...prev,
                      organization: h.organization,
                      what: h.what,
                    }));
                    setReleaseType(h.releaseType);
                    setTone(h.tone);
                    setLength(h.length);
                  }}
                  className="block w-full text-left rounded border bg-background px-3 py-2 text-xs hover:bg-muted"
                >
                  <Badge variant="outline" className="mr-2 text-[10px]">
                    {RELEASE_TYPE_LABELS[h.releaseType].split(" ")[0]}
                  </Badge>
                  <Badge variant="outline" className="mr-2 text-[10px]">
                    {h.wordCount}w
                  </Badge>
                  <Badge variant="outline" className="mr-2 text-[10px]">
                    NW {h.newsworthiness}
                  </Badge>
                  <span className="text-muted-foreground">
                    {h.organization} — {h.what.slice(0, 60)}{h.what.length > 60 ? "…" : ""}
                  </span>
                  <span className="text-muted-foreground ml-2">
                    · {new Date(h.ts).toLocaleString()}
                  </span>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-3">
          <p className="text-xs text-muted-foreground">
            <strong className="text-foreground">Honesty:</strong> Quotes are
            editable placeholders — replace with an approved quote from a real
            person before publishing. The newsworthiness check is a heuristic,
            not a guarantee of coverage. All generation runs locally; embargoed
            news never leaves your device. Distribution is up to you.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function NewsworthinessCard({
  result,
}: {
  result: ReturnType<typeof checkNewsworthiness>;
}) {
  const verdictColor =
    result.verdict === "This is news"
      ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
      : result.verdict === "Borderline — strengthen the angle"
        ? "bg-amber-500/10 text-amber-700 dark:text-amber-300"
        : "bg-rose-500/10 text-rose-700 dark:text-rose-300";
  return (
    <Card>
      <CardContent className="p-4 space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-foreground">
            Newsworthiness check
          </h3>
          <Badge variant="outline" className={`text-[10px] ${verdictColor}`}>
            {result.verdict}
          </Badge>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {result.factors.map((f) => (
            <div key={f.factor} className="rounded border bg-background px-3 py-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-medium">{NEWSWORTHINESS_LABELS[f.factor]}</span>
                <span className="font-mono text-[10px] text-muted-foreground">
                  {"●".repeat(f.score)}
                  {"○".repeat(2 - f.score)}
                </span>
              </div>
              <p className="text-[11px] text-muted-foreground mt-0.5">{f.note}</p>
            </div>
          ))}
        </div>
        <p className="text-[11px] text-muted-foreground italic pt-1">
          {result.suggestion}
        </p>
      </CardContent>
    </Card>
  );
}

function Stat({
  label,
  value,
  sub,
}: {
  label: string;
  value: string | number;
  sub?: string;
}) {
  return (
    <div className="rounded border bg-background px-3 py-2">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="text-base font-semibold text-foreground">
        {value} {sub && <span className="text-[10px] text-muted-foreground font-normal">{sub}</span>}
      </div>
    </div>
  );
}
