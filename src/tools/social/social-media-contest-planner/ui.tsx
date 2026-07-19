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
  PLATFORMS,
  CONTEST_TYPES,
  AGE_RESTRICTIONS,
  ENTRY_METHODS,
  PLATFORM_LABELS,
  CONTEST_TYPE_LABELS,
  AGE_LABELS,
  ENTRY_METHOD_LABELS,
  PLATFORM_PRESETS,
  CONTEST_TYPE_PRESETS,
  buildContest,
  renderText,
  renderHtml,
  renderMarkdown,
  renderCsv,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  type Platform,
  type ContestType,
  type AgeRestriction,
  type EntryMethod,
  type HistoryEntry,
} from "./logic";
import { Trophy, History, Calendar, Tag, Gift, CheckCircle2, AlertTriangle, Info, Megaphone, ShieldCheck } from "lucide-react";

const DEFAULT_INPUT = {
  contestName: "",
  platform: "instagram" as Platform,
  contestType: "like-comment-follow" as ContestType,
  prize: "",
  prizeValue: 0,
  startDate: "",
  endDate: "",
  minFollowers: 0,
  ageRestriction: "none" as AgeRestriction,
  geographicRestriction: "",
  entryMethods: [] as EntryMethod[],
};

export default function SocialMediaContestPlanner() {
  const [input, setInput] = useState(DEFAULT_INPUT);
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  useEffect(() => {
    setHistory(loadHistory());
    if (typeof window !== "undefined" && window.location.hash) {
      const p = parseShareUrl(window.location.hash);
      if (Object.keys(p).length > 0) {
        setInput((prev) => ({ ...prev, ...p, entryMethods: p.entryMethods ?? prev.entryMethods }));
        toast.info("Loaded from share link");
      }
    }
  }, []);

  const contest = useMemo(() => buildContest(input), [input]);
  const hasInput = input.contestName.trim().length > 0 || input.entryMethods.length > 0 || input.prize.trim().length > 0;

  const text = useMemo(() => renderText(contest), [contest]);
  const html = useMemo(() => renderHtml(contest), [contest]);
  const md = useMemo(() => renderMarkdown(contest), [contest]);
  const csv = useMemo(() => renderCsv(contest), [contest]);

  const handleSaveHistory = useCallback(() => {
    if (hasInput) {
      saveHistory({
        ts: Date.now(),
        contestName: input.contestName,
        platform: input.platform,
        contestType: input.contestType,
        prize: input.prize,
        prizeValue: input.prizeValue,
        startDate: input.startDate,
        endDate: input.endDate,
      });
      setHistory(loadHistory());
    }
  }, [input, hasInput]);

  const updateField = useCallback(<K extends keyof typeof input>(key: K, value: (typeof input)[K]) => {
    setInput((prev) => ({ ...prev, [key]: value }));
  }, []);

  const toggleMethod = (m: EntryMethod) => {
    setInput((prev) => ({
      ...prev,
      entryMethods: prev.entryMethods.includes(m)
        ? prev.entryMethods.filter((x) => x !== m)
        : [...prev.entryMethods, m],
    }));
  };

  const applyPlatformPreset = (p: Platform) => {
    setInput((prev) => ({ ...prev, platform: p, entryMethods: PLATFORM_PRESETS[p] }));
    toast.info(`Loaded ${PLATFORM_LABELS[p]} preset`);
  };

  const applyTypePreset = (t: ContestType) => {
    setInput((prev) => ({ ...prev, contestType: t, entryMethods: CONTEST_TYPE_PRESETS[t] }));
    toast.info(`Loaded ${CONTEST_TYPE_LABELS[t]} preset`);
  };

  const handleClear = useCallback(() => {
    setInput(DEFAULT_INPUT);
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
          <div className="grid sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="cp-name">Contest name</Label>
              <Input
                id="cp-name"
                value={input.contestName}
                onChange={(e) => updateField("contestName", e.target.value)}
                placeholder="Summer Photo Contest"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cp-prize">Prize</Label>
              <Input
                id="cp-prize"
                value={input.prize}
                onChange={(e) => updateField("prize", e.target.value)}
                placeholder="$100 gift card"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cp-value">Prize value (USD)</Label>
              <Input
                id="cp-value"
                type="number"
                min={0}
                value={input.prizeValue}
                onChange={(e) => updateField("prizeValue", Math.max(0, Number(e.target.value) || 0))}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cp-platform">Platform</Label>
              <select
                id="cp-platform"
                value={input.platform}
                onChange={(e) => updateField("platform", e.target.value as Platform)}
                className="h-9 w-full rounded border bg-background px-2 text-sm"
              >
                {PLATFORMS.map((p) => (
                  <option key={p} value={p}>{PLATFORM_LABELS[p]}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cp-type">Contest type</Label>
              <select
                id="cp-type"
                value={input.contestType}
                onChange={(e) => updateField("contestType", e.target.value as ContestType)}
                className="h-9 w-full rounded border bg-background px-2 text-sm"
              >
                {CONTEST_TYPES.map((t) => (
                  <option key={t} value={t}>{CONTEST_TYPE_LABELS[t]}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cp-age">Age restriction</Label>
              <select
                id="cp-age"
                value={input.ageRestriction}
                onChange={(e) => updateField("ageRestriction", e.target.value as AgeRestriction)}
                className="h-9 w-full rounded border bg-background px-2 text-sm"
              >
                {AGE_RESTRICTIONS.map((a) => (
                  <option key={a} value={a}>{AGE_LABELS[a]}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cp-start">Start date</Label>
              <Input
                id="cp-start"
                type="date"
                value={input.startDate}
                onChange={(e) => updateField("startDate", e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cp-end">End date</Label>
              <Input
                id="cp-end"
                type="date"
                value={input.endDate}
                onChange={(e) => updateField("endDate", e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cp-minf">Min followers (0 = none)</Label>
              <Input
                id="cp-minf"
                type="number"
                min={0}
                value={input.minFollowers}
                onChange={(e) => updateField("minFollowers", Math.max(0, Number(e.target.value) || 0))}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cp-geo">Geographic restriction</Label>
              <Input
                id="cp-geo"
                value={input.geographicRestriction}
                onChange={(e) => updateField("geographicRestriction", e.target.value)}
                placeholder="US only / Worldwide excluding Quebec"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Quick presets</Label>
            <div className="flex flex-wrap gap-1">
              {PLATFORMS.map((p) => (
                <Button
                  key={p}
                  variant="ghost"
                  size="sm"
                  className="h-6 text-[11px]"
                  onClick={() => applyPlatformPreset(p)}
                >+ {PLATFORM_LABELS[p]}</Button>
              ))}
              <span className="mx-1 text-muted-foreground">·</span>
              {CONTEST_TYPES.map((t) => (
                <Button
                  key={t}
                  variant="ghost"
                  size="sm"
                  className="h-6 text-[11px]"
                  onClick={() => applyTypePreset(t)}
                >+ {CONTEST_TYPE_LABELS[t]}</Button>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Entry methods</Label>
            <div className="flex flex-wrap gap-2 pt-1">
              {ENTRY_METHODS.map((m) => (
                <label key={m} className="flex items-center gap-1.5 text-xs cursor-pointer">
                  <input
                    type="checkbox"
                    checked={input.entryMethods.includes(m)}
                    onChange={() => toggleMethod(m)}
                  />
                  {ENTRY_METHOD_LABELS[m]}
                </label>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {hasInput ? (
        <>
          <Card>
            <CardContent className="p-4 space-y-2">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <Trophy className="h-4 w-4" /> Contest brief
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                <Stat label="Duration" value={contest.duration.valid ? `${contest.duration.days} day(s)` : "Invalid"} highlight={contest.duration.valid ? "good" : "bad"} />
                <Stat label="Prize value" value={`$${contest.summary.prizeValue}`} />
                <Stat label="Entry methods" value={contest.summary.entryMethodsCount} />
                <Stat label="Compliance flags" value={contest.summary.complianceIssues} highlight={contest.summary.complianceIssues > 0 ? "bad" : "good"} />
              </div>
              <div className="rounded border bg-background px-3 py-2 text-xs">
                <div className="flex items-center gap-1.5 mb-1">
                  <Tag className="h-3 w-3" /> Hashtag
                  <Badge variant="secondary" className="text-[10px]">{contest.hashtag.hashtag || "—"}</Badge>
                  {!contest.hashtag.valid && contest.hashtag.hashtag && (
                    <Badge variant="outline" className="text-[10px] text-amber-600">too long</Badge>
                  )}
                </div>
                <div className="text-[10px] text-muted-foreground">
                  Variants: {contest.hashtag.variants.join(", ") || "—"}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 space-y-3">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <Gift className="h-4 w-4" /> Prize & entry mechanics
              </h3>
              <div className="rounded border bg-background px-3 py-2 text-xs">
                <div className="font-medium text-foreground mb-1">{contest.prize.title || "Prize"}</div>
                <div className="text-muted-foreground">{contest.prize.description}</div>
              </div>
              <div className="rounded border bg-background px-3 py-2 text-xs space-y-1">
                <div className="font-medium text-foreground mb-1">How to enter (max {contest.mechanics.maxEntries} entries)</div>
                {contest.mechanics.steps.map((s, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <CheckCircle2 className="h-3 w-3 text-emerald-500" />
                    <span>{s}</span>
                  </div>
                ))}
                <div className="pt-1 text-[10px] text-muted-foreground">Bonus:</div>
                {contest.mechanics.bonusEntries.map((b, i) => (
                  <div key={i} className="text-[10px] text-muted-foreground">• {b}</div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 space-y-2">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <ShieldCheck className="h-4 w-4" /> Eligibility
              </h3>
              <div className="space-y-1">
                {contest.eligibility.checks.map((c, i) => (
                  <div key={i} className="flex items-start gap-2 text-xs">
                    {c.ok ? (
                      <CheckCircle2 className="h-3 w-3 mt-0.5 text-emerald-500 flex-shrink-0" />
                    ) : (
                      <AlertTriangle className="h-3 w-3 mt-0.5 text-amber-500 flex-shrink-0" />
                    )}
                    <div>
                      <span className="font-medium text-foreground">{c.label}:</span>{" "}
                      <span className="text-muted-foreground">{c.detail}</span>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 space-y-2">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <Megaphone className="h-4 w-4" /> Winner selection methods
              </h3>
              <div className="space-y-1">
                {contest.winnerMethods.map((m) => (
                  <div key={m.id} className="rounded border bg-background px-3 py-2 text-xs">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-foreground">{m.label}</span>
                      {m.recommended && <Badge variant="secondary" className="text-[10px]">recommended</Badge>}
                    </div>
                    <div className="text-muted-foreground text-[11px] mt-0.5">{m.description}</div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 space-y-2">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <Calendar className="h-4 w-4" /> Promotion schedule
              </h3>
              {contest.schedule.length === 0 ? (
                <p className="text-xs text-muted-foreground">Enter valid start/end dates to generate a schedule.</p>
              ) : (
                <div className="space-y-1">
                  {contest.schedule.map((s, i) => (
                    <div key={i} className="rounded border bg-background px-3 py-2 text-xs">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-[10px]">Day {s.day}</Badge>
                        <Badge variant="secondary" className="text-[10px]">{s.date}</Badge>
                        <span className="font-medium text-foreground">{s.title}</span>
                      </div>
                      <div className="text-muted-foreground text-[11px] mt-0.5">{s.description}</div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 space-y-2">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <AlertTriangle className="h-4 w-4" /> Compliance
              </h3>
              {contest.compliance.length === 0 ? (
                <p className="text-xs text-emerald-600">No compliance issues detected.</p>
              ) : (
                <div className="space-y-1">
                  {contest.compliance.map((c, i) => (
                    <div
                      key={i}
                      className={`rounded border px-3 py-2 text-xs ${
                        c.level === "warning"
                          ? "border-amber-500/30 bg-amber-500/5 text-amber-700 dark:text-amber-300"
                          : "border-blue-500/30 bg-blue-500/5 text-blue-700 dark:text-blue-300"
                      }`}
                    >
                      <div className="flex items-center gap-1.5 font-medium">
                        {c.level === "warning" ? <AlertTriangle className="h-3 w-3" /> : <Info className="h-3 w-3" />}
                        {c.level.toUpperCase()}
                      </div>
                      <div className="mt-0.5">{c.message}</div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 space-y-2">
              <h3 className="text-sm font-semibold text-foreground">Official rules</h3>
              <pre className="text-[11px] font-mono whitespace-pre-wrap rounded border bg-muted/40 p-3 max-h-[400px] overflow-auto">
                {contest.rules.fullText}
              </pre>
              <div className="flex flex-wrap gap-2 pt-2">
                <CopyButton getText={() => { handleSaveHistory(); return text; }} label="Copy brief" />
                <DownloadButton getText={() => { handleSaveHistory(); return text; }} filename="contest-brief.txt" mime="text/plain" label="Download .txt" />
                <DownloadButton getText={() => html} filename="contest-rules.html" mime="text/html" label="Download HTML" />
                <DownloadButton getText={() => md} filename="contest-announcement.md" mime="text/markdown" label="Download MD" />
                <DownloadButton getText={() => csv} filename="contest-summary.csv" mime="text/csv" label="Download CSV" />
                <ShareButton getUrl={() => { handleSaveHistory(); return buildShareUrl(input); }} />
                <ClearButton onClick={handleClear} />
              </div>
            </CardContent>
          </Card>
        </>
      ) : (
        <EmptyState
          title="Fill in contest details to generate the brief"
          hint="Enter a contest name, dates, and entry methods. The tool generates official rules, entry mechanics, hashtag, disclaimers, promotion schedule, and compliance checks."
          icon={<Trophy className="h-8 w-8" />}
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
                    setInput({
                      ...DEFAULT_INPUT,
                      contestName: h.contestName,
                      platform: h.platform,
                      contestType: h.contestType,
                      prize: h.prize,
                      prizeValue: h.prizeValue,
                      startDate: h.startDate,
                      endDate: h.endDate,
                    });
                    toast.info("Loaded from history");
                  }}
                  className="w-full text-left rounded border bg-background px-3 py-2 text-xs hover:bg-muted/40"
                >
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-[10px]">{PLATFORM_LABELS[h.platform]}</Badge>
                    <Badge variant="outline" className="text-[10px]">{CONTEST_TYPE_LABELS[h.contestType]}</Badge>
                    <span className="font-medium text-foreground">{h.contestName || "Untitled"}</span>
                  </div>
                  <div className="text-[10px] text-muted-foreground mt-0.5">
                    {h.startDate || "—"} → {h.endDate || "—"} · ${h.prizeValue} · {new Date(h.ts).toLocaleString()}
                  </div>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-3">
          <p className="text-xs text-muted-foreground">
            <strong className="text-foreground">Privacy:</strong> All rule generation, hashtag creation, and rendering runs locally. History is stored in localStorage on this device only.
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
    ? "text-amber-600 dark:text-amber-400"
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
