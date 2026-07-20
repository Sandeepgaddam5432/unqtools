"use client";

import React, { useState, useMemo, useCallback, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
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
  parseDateTime,
  isValidDate,
  calculateAge,
  computeMilestones,
  calculateAgeGap,
  renderAgeText,
  renderMilestonesCsv,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  type Feb29Policy,
  type HistoryEntry,
} from "./logic";
import {
  History, Cake, Sparkles, Heart, ArrowLeftRight, CalendarClock, Trophy,
} from "lucide-react";

type Tab = "age" | "milestones" | "gap";

export default function AgeCalculator() {
  const today = new Date();
  const todayStr = `${today.getUTCFullYear()}-${String(today.getUTCMonth() + 1).padStart(2, "0")}-${String(today.getUTCDate()).padStart(2, "0")}`;

  const [tab, setTab] = useState<Tab>("age");
  const [birth, setBirth] = useState<string>("2000-01-15");
  const [birthTime, setBirthTime] = useState<string>("");
  const [reference, setReference] = useState<string>(todayStr);
  const [referenceTime, setReferenceTime] = useState<string>("");
  const [feb29Policy, setFeb29Policy] = useState<Feb29Policy>("feb28");
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  // Gap tab
  const [gapA, setGapA] = useState<string>("2000-01-01");
  const [gapB, setGapB] = useState<string>("2001-01-01");

  useEffect(() => {
    setHistory(loadHistory());
    if (typeof window !== "undefined" && window.location.hash) {
      const p = parseShareUrl(window.location.hash);
      if (p) {
        if (p.birth) setBirth(p.birth);
        if (p.birthTime) setBirthTime(p.birthTime);
        if (p.reference) setReference(p.reference);
        if (p.referenceTime) setReferenceTime(p.referenceTime);
        setFeb29Policy(p.feb29Policy);
        if (p.gapA) setGapA(p.gapA);
        if (p.gapB) setGapB(p.gapB);
        toast.info("Loaded from share link");
      }
    }
  }, []);

  const birthMs = useMemo(() => {
    const dt = birthTime ? `${birth}T${birthTime}:00` : birth;
    return parseDateTime(dt);
  }, [birth, birthTime]);

  const referenceMs = useMemo(() => {
    const dt = referenceTime ? `${reference}T${referenceTime}:00` : reference;
    return parseDateTime(dt);
  }, [reference, referenceTime]);

  const ageResult = useMemo(() => {
    if (Number.isNaN(birthMs) || Number.isNaN(referenceMs)) return null;
    return calculateAge(birthMs, referenceMs, feb29Policy);
  }, [birthMs, referenceMs, feb29Policy]);

  const milestones = useMemo(() => {
    if (Number.isNaN(birthMs)) return [];
    return computeMilestones(birthMs, referenceMs);
  }, [birthMs, referenceMs]);

  const gapResult = useMemo(() => {
    const aMs = parseDateTime(gapA);
    const bMs = parseDateTime(gapB);
    if (Number.isNaN(aMs) || Number.isNaN(bMs)) return null;
    return calculateAgeGap(aMs, bMs);
  }, [gapA, gapB]);

  const handleSaveHistory = useCallback(() => {
    if (ageResult && !ageResult.warning) {
      saveHistory({
        ts: Date.now(),
        birth,
        reference,
        ageSummary: ageResult.summary,
      });
      setHistory(loadHistory());
    }
  }, [ageResult, birth, reference]);

  const handleClear = useCallback(() => {
    setBirth("2000-01-15");
    setBirthTime("");
    setReference(todayStr);
    setReferenceTime("");
    setFeb29Policy("feb28");
    setGapA("2000-01-01");
    setGapB("2001-01-01");
    toast.info("Cleared inputs");
  }, [todayStr]);

  const handleClearHistory = useCallback(() => {
    clearHistory();
    setHistory([]);
    toast.success("History cleared");
  }, []);

  const handleSwapGap = useCallback(() => {
    setGapA(gapB);
    setGapB(gapA);
  }, [gapA, gapB]);

  const birthValid = isValidDate(birthTime ? `${birth}T${birthTime}:00` : birth);
  const referenceValid = isValidDate(referenceTime ? `${reference}T${referenceTime}:00` : reference);

  return (
    <div className="space-y-4 unq-animate-fade-in-up">
      <Card>
        <CardContent className="p-3">
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant={tab === "age" ? "default" : "outline"}
              onClick={() => setTab("age")}
              className="gap-1.5"
            >
              <Cake className="h-3.5 w-3.5" /> Age
            </Button>
            <Button
              size="sm"
              variant={tab === "milestones" ? "default" : "outline"}
              onClick={() => setTab("milestones")}
              className="gap-1.5"
            >
              <Trophy className="h-3.5 w-3.5" /> Milestones
            </Button>
            <Button
              size="sm"
              variant={tab === "gap" ? "default" : "outline"}
              onClick={() => setTab("gap")}
              className="gap-1.5"
            >
              <ArrowLeftRight className="h-3.5 w-3.5" /> Age Gap
            </Button>
          </div>
        </CardContent>
      </Card>

      {tab !== "gap" && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="age-birth" className="text-xs">Birth date</Label>
                <Input
                  id="age-birth"
                  type="date"
                  value={birth}
                  onChange={(e) => setBirth(e.target.value)}
                  className="text-xs h-8"
                />
                <Input
                  type="time"
                  value={birthTime}
                  onChange={(e) => setBirthTime(e.target.value)}
                  className="text-xs h-8"
                  placeholder="optional time"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="age-ref" className="text-xs">"Today" / reference date (defaults to today)</Label>
                <Input
                  id="age-ref"
                  type="date"
                  value={reference}
                  onChange={(e) => setReference(e.target.value)}
                  className="text-xs h-8"
                />
                <Input
                  type="time"
                  value={referenceTime}
                  onChange={(e) => setReferenceTime(e.target.value)}
                  className="text-xs h-8"
                  placeholder="optional time"
                />
              </div>
            </div>
            <div>
              <Label className="text-xs">Feb-29 birthday policy (for leap-day births in non-leap years)</Label>
              <div className="flex gap-2 pt-1">
                <Button
                  variant={feb29Policy === "feb28" ? "default" : "outline"}
                  size="sm"
                  className="flex-1"
                  onClick={() => setFeb29Policy("feb28")}
                >
                  Observe on Feb 28
                </Button>
                <Button
                  variant={feb29Policy === "mar1" ? "default" : "outline"}
                  size="sm"
                  className="flex-1"
                  onClick={() => setFeb29Policy("mar1")}
                >
                  Observe on Mar 1
                </Button>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <ClearButton onClick={handleClear} />
            </div>
          </CardContent>
        </Card>
      )}

      {tab === "age" && (
        !birthValid || !referenceValid ? (
          <EmptyState
            title="Enter a valid birth date and reference date"
            hint="Both dates must be valid YYYY-MM-DD. Optional time fields let you compute exact age to the second."
            icon={<Cake className="h-8 w-8" />}
          />
        ) : ageResult ? (
          <Card>
            <CardContent className="p-4 space-y-3">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <Cake className="h-4 w-4" /> {ageResult.summary}
              </h3>
              {ageResult.warning && (
                <div className="rounded border border-amber-400/40 bg-amber-50 dark:bg-amber-950/30 p-2 text-[11px] text-amber-700 dark:text-amber-300">
                  {ageResult.warning}
                </div>
              )}
              <div className="grid grid-cols-3 gap-2 text-xs">
                <Stat label="Years" value={ageResult.years} highlight="good" />
                <Stat label="Months" value={ageResult.months} />
                <Stat label="Days" value={ageResult.days} />
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
                <Stat label="Total months" value={ageResult.totalMonths.toLocaleString()} />
                <Stat label="Total weeks" value={ageResult.totalWeeks.toLocaleString(undefined, { maximumFractionDigits: 1 })} />
                <Stat label="Total days" value={ageResult.totalDays.toLocaleString()} />
                <Stat label="Total hours" value={ageResult.totalHours.toLocaleString()} />
                <Stat label="Total minutes" value={ageResult.totalMinutes.toLocaleString()} />
                <Stat label="Total seconds" value={ageResult.totalSeconds.toLocaleString()} />
              </div>
              <div className="rounded border bg-background p-3 text-xs">
                <div className="flex items-center gap-1.5 mb-1">
                  <CalendarClock className="h-3.5 w-3.5" />
                  <span className="text-muted-foreground">Next birthday:</span>
                  <span className="font-medium text-foreground">{ageResult.nextBirthdayDate}</span>
                  <span className="text-muted-foreground">({ageResult.nextBirthdayWeekday})</span>
                </div>
                <div className="text-muted-foreground">
                  In <span className="font-medium text-foreground">{ageResult.daysUntilNextBirthday} day(s)</span>
                  {ageResult.isLeapObservance && (
                    <Badge variant="outline" className="ml-2 text-[10px]">Feb-29 observance</Badge>
                  )}
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                <div className="rounded border bg-background p-3">
                  <div className="flex items-center gap-1.5">
                    <Sparkles className="h-3.5 w-3.5" />
                    <span className="text-muted-foreground">Zodiac sign:</span>
                    <span className="font-medium text-foreground">{ageResult.zodiac}</span>
                  </div>
                </div>
                <div className="rounded border bg-background p-3">
                  <div className="flex items-center gap-1.5">
                    <Heart className="h-3.5 w-3.5" />
                    <span className="text-muted-foreground">Chinese zodiac:</span>
                    <span className="font-medium text-foreground">{ageResult.chineseZodiac} ({ageResult.chineseElement})</span>
                  </div>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <CopyButton
                  getText={() => { handleSaveHistory(); return renderAgeText(ageResult); }}
                  label="Copy full summary"
                />
                <CopyButton
                  getText={() => { handleSaveHistory(); return ageResult.summary; }}
                  label="Copy age"
                />
                <ShareButton
                  getUrl={() => {
                    handleSaveHistory();
                    return buildShareUrl({
                      birth, birthTime, reference, referenceTime, feb29Policy,
                      gapA, gapB,
                    });
                  }}
                />
              </div>
            </CardContent>
          </Card>
        ) : null
      )}

      {tab === "milestones" && (
        !birthValid ? (
          <EmptyState
            title="Enter a valid birth date"
            hint="We'll compute upcoming milestones like 1,000 days, 10,000 days, 1 billion seconds, and milestone birthdays."
            icon={<Trophy className="h-8 w-8" />}
          />
        ) : milestones.length > 0 ? (
          <Card>
            <CardContent className="p-4 space-y-3">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <Trophy className="h-4 w-4" /> Milestones ({milestones.length})
              </h3>
              <div className="rounded border bg-background overflow-auto max-h-[500px]">
                <table className="w-full text-xs">
                  <thead className="bg-muted/30 sticky top-0">
                    <tr>
                      <th className="text-left p-2">Milestone</th>
                      <th className="text-left p-2">Date</th>
                      <th className="text-center p-2">Status</th>
                      <th className="text-right p-2">Days from now</th>
                    </tr>
                  </thead>
                  <tbody>
                    {milestones.map((m, i) => (
                      <tr key={i} className="border-t">
                        <td className="p-2 font-medium">{m.label}</td>
                        <td className="p-2 font-mono">{m.date}</td>
                        <td className="p-2 text-center">
                          {m.passed ? (
                            <Badge variant="outline" className="text-[10px]">passed</Badge>
                          ) : (
                            <Badge variant="secondary" className="text-[10px]">upcoming</Badge>
                          )}
                        </td>
                        <td className="p-2 text-right font-mono">
                          {m.daysFromNow > 0 ? `+${m.daysFromNow}` : m.daysFromNow}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="flex flex-wrap gap-2">
                <CopyButton
                  getText={() => { handleSaveHistory(); return renderMilestonesCsv(milestones); }}
                  label="Copy CSV"
                />
                <DownloadButton
                  getText={() => { handleSaveHistory(); return renderMilestonesCsv(milestones); }}
                  filename="age-milestones.csv"
                  mime="text/csv"
                  label="Download CSV"
                />
                <ShareButton
                  getUrl={() => buildShareUrl({
                    birth, birthTime, reference, referenceTime, feb29Policy, gapA, gapB,
                  })}
                />
              </div>
            </CardContent>
          </Card>
        ) : null
      )}

      {tab === "gap" && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="gap-a" className="text-xs">Person A birth date</Label>
                <Input
                  id="gap-a"
                  type="date"
                  value={gapA}
                  onChange={(e) => setGapA(e.target.value)}
                  className="text-xs h-8"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="gap-b" className="text-xs">Person B birth date</Label>
                <Input
                  id="gap-b"
                  type="date"
                  value={gapB}
                  onChange={(e) => setGapB(e.target.value)}
                  className="text-xs h-8"
                />
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={handleSwapGap} className="gap-1.5">
                <ArrowLeftRight className="h-3.5 w-3.5" /> Swap A ↔ B
              </Button>
              <ClearButton onClick={handleClear} />
            </div>
            {!isValidDate(gapA) || !isValidDate(gapB) ? (
              <EmptyState
                title="Enter two valid birth dates"
                hint="We'll compute the age gap in calendar years/months/days using the same borrow logic as the age calculator."
                icon={<ArrowLeftRight className="h-8 w-8" />}
              />
            ) : gapResult ? (
              <div className="space-y-2">
                <div className="rounded border bg-background p-3">
                  <p className="text-sm font-medium text-foreground">{gapResult.summary}</p>
                </div>
                <div className="grid grid-cols-3 gap-2 text-xs">
                  <Stat label="Years" value={gapResult.years} />
                  <Stat label="Months" value={gapResult.months} />
                  <Stat label="Days" value={gapResult.days} />
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <Stat label="Total days" value={gapResult.totalDays.toLocaleString()} />
                  <Stat
                    label="Older"
                    value={gapResult.older === "a" ? "A" : gapResult.older === "b" ? "B" : "Same"}
                  />
                </div>
                <div className="flex flex-wrap gap-2">
                  <CopyButton getText={() => gapResult.summary} label="Copy gap summary" />
                  <ShareButton
                    getUrl={() => buildShareUrl({
                      birth, birthTime, reference, referenceTime, feb29Policy, gapA, gapB,
                    })}
                  />
                </div>
              </div>
            ) : null}
          </CardContent>
        </Card>
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
                <div key={i} className="rounded border bg-background px-3 py-1.5 text-xs">
                  <span className="font-mono text-muted-foreground">{h.birth} → {h.reference}</span>
                  <span className="text-muted-foreground ml-2">· {h.ageSummary}</span>
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
            <strong className="text-foreground">Privacy:</strong> All age math runs locally. The shareable URL is fragment-encoded (never sent to server). History is stored in localStorage on this device only.
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
      <div className={`text-sm font-semibold ${color}`}>{value}</div>
    </div>
  );
}
