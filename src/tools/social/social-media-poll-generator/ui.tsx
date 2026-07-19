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
  PLATFORM_CONSTRAINTS,
  PLATFORM_LABELS,
  POLL_TYPE_LABELS,
  DURATION_LABELS,
  DURATION_HOURS,
  TONE_LABELS,
  TONE_DESCRIPTIONS,
  normalizeTopic,
  generatePoll,
  generatePollVariations,
  computeSummaryStats,
  renderText,
  renderCsv,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  type Platform,
  type PollType,
  type PollDuration,
  type Tone,
  type PollInput,
  type HistoryEntry,
} from "./logic";
import { Vote, History, AlertTriangle, CheckCircle2, Lightbulb, Clock, Hash, TrendingUp } from "lucide-react";

const PLATFORMS = Object.keys(PLATFORM_LABELS) as Platform[];
const POLL_TYPES = Object.keys(POLL_TYPE_LABELS) as PollType[];
const DURATIONS = Object.keys(DURATION_LABELS) as PollDuration[];
const TONES = Object.keys(TONE_LABELS) as Tone[];

export default function SocialMediaPollGenerator() {
  const [topic, setTopic] = useState("");
  const [platform, setPlatform] = useState<Platform>("twitter");
  const [pollType, setPollType] = useState<PollType>("this-or-that");
  const [optionCount, setOptionCount] = useState<number>(2);
  const [duration, setDuration] = useState<PollDuration>("24-hours");
  const [tone, setTone] = useState<Tone>("serious");
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [showVariations, setShowVariations] = useState(false);

  useEffect(() => {
    setHistory(loadHistory());
    if (typeof window !== "undefined" && window.location.hash) {
      const { input, hasAny } = parseShareUrl(window.location.hash);
      if (hasAny) {
        if (input.topic !== undefined) setTopic(input.topic);
        if (input.platform) setPlatform(input.platform);
        if (input.pollType) setPollType(input.pollType);
        if (input.optionCount !== undefined) setOptionCount(input.optionCount);
        if (input.duration) setDuration(input.duration);
        if (input.tone) setTone(input.tone);
        toast.info("Loaded from share link");
      }
    }
  }, []);

  // When platform changes, clamp optionCount to platform's allowed range
  useEffect(() => {
    const c = PLATFORM_CONSTRAINTS[platform];
    setOptionCount((prev) => {
      const clamped = Math.max(c.minOptions, Math.min(c.maxOptions, prev));
      return clamped;
    });
  }, [platform]);

  // When pollType changes, adjust default optionCount
  useEffect(() => {
    setOptionCount((prev) => {
      if (pollType === "this-or-that") return 2;
      if (pollType === "yes-no-maybe") return 3;
      if (pollType === "rating-scale" || pollType === "opinion-scale") return 5;
      // multiple-choice — keep existing if valid, else 4
      const c = PLATFORM_CONSTRAINTS[platform];
      if (prev >= c.minOptions && prev <= c.maxOptions) return prev;
      return Math.min(4, c.maxOptions);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pollType]);

  const input: PollInput = useMemo(
    () => ({
      topic: normalizeTopic(topic),
      platform,
      pollType,
      optionCount,
      duration,
      tone,
    }),
    [topic, platform, pollType, optionCount, duration, tone],
  );

  const poll = useMemo(() => generatePoll(input), [input]);
  const stats = useMemo(() => computeSummaryStats(poll), [poll]);
  const variations = useMemo(
    () => (showVariations ? generatePollVariations(input) : []),
    [showVariations, input],
  );
  const text = useMemo(() => renderText(poll), [poll]);
  const csv = useMemo(() => renderCsv(poll), [poll]);

  const constraint = PLATFORM_CONSTRAINTS[platform];

  const handleSaveHistory = useCallback(() => {
    saveHistory({
      ts: Date.now(),
      topic: input.topic,
      platform: input.platform,
      pollType: input.pollType,
      predictedEngagement: poll.predictedEngagement,
    });
    setHistory(loadHistory());
  }, [input, poll]);

  const handleClear = useCallback(() => {
    setTopic("");
    setPlatform("twitter");
    setPollType("this-or-that");
    setOptionCount(2);
    setDuration("24-hours");
    setTone("serious");
    setShowVariations(false);
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
            <Label htmlFor="smpg-topic">Poll topic</Label>
            <Textarea
              id="smpg-topic"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder={"e.g. remote work, AI in marketing, coffee vs tea…"}
              className="min-h-[60px] resize-y text-sm"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Platform</Label>
              <select
                value={platform}
                onChange={(e) => setPlatform(e.target.value as Platform)}
                className="h-9 w-full text-sm rounded border bg-background px-2"
              >
                {PLATFORMS.map((p) => (
                  <option key={p} value={p}>{PLATFORM_LABELS[p]}</option>
                ))}
              </select>
              <p className="text-[10px] text-muted-foreground">{constraint.note}</p>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Poll type</Label>
              <select
                value={pollType}
                onChange={(e) => setPollType(e.target.value as PollType)}
                className="h-9 w-full text-sm rounded border bg-background px-2"
              >
                {POLL_TYPES.map((t) => (
                  <option key={t} value={t}>{POLL_TYPE_LABELS[t]}</option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Option count</Label>
              <Input
                type="number"
                min={constraint.minOptions}
                max={constraint.maxOptions}
                value={optionCount}
                onChange={(e) => setOptionCount(parseInt(e.target.value, 10) || constraint.minOptions)}
                className="h-9 text-sm"
              />
              <p className="text-[10px] text-muted-foreground">
                {constraint.minOptions}–{constraint.maxOptions} allowed on {PLATFORM_LABELS[platform]}
              </p>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Poll duration</Label>
              <select
                value={duration}
                onChange={(e) => setDuration(e.target.value as PollDuration)}
                className="h-9 w-full text-sm rounded border bg-background px-2"
              >
                {DURATIONS.map((d) => {
                  const hours = DURATION_HOURS[d];
                  const overLimit = hours > constraint.maxDurationHours;
                  return (
                    <option key={d} value={d} disabled={overLimit}>
                      {DURATION_LABELS[d]}{overLimit ? " (not allowed)" : ""}
                    </option>
                  );
                })}
              </select>
              <p className="text-[10px] text-muted-foreground">
                Max {constraint.maxDurationHours}h on {PLATFORM_LABELS[platform]}
              </p>
            </div>

            <div className="space-y-1.5 sm:col-span-2">
              <Label className="text-xs">Tone</Label>
              <select
                value={tone}
                onChange={(e) => setTone(e.target.value as Tone)}
                className="h-9 w-full text-sm rounded border bg-background px-2"
              >
                {TONES.map((t) => (
                  <option key={t} value={t}>
                    {TONE_LABELS[t]} — {TONE_DESCRIPTIONS[t]}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Feasibility banner */}
      {!poll.feasibility.ok ? (
        <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
          <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5" />
          <div className="space-y-1">
            <div className="font-medium">Feasibility issues:</div>
            <ul className="list-disc list-inside text-xs">
              {poll.feasibility.errors.map((e, i) => <li key={i}>{e}</li>)}
            </ul>
          </div>
        </div>
      ) : (
        poll.feasibility.warnings.length > 0 && (
          <div className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-700 dark:text-amber-300">
            <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5" />
            <div className="space-y-1">
              <div className="font-medium">Heads up:</div>
              <ul className="list-disc list-inside text-xs">
                {poll.feasibility.warnings.map((w, i) => <li key={i}>{w}</li>)}
              </ul>
            </div>
          </div>
        )
      )}

      {/* Summary stats */}
      <Card>
        <CardContent className="p-4 space-y-2">
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
            <TrendingUp className="h-4 w-4" /> Poll Summary
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
            <Stat label="Options" value={stats.totalOptions} />
            <Stat label="Avg chars" value={stats.avgCharCount} />
            <Stat label="Duration" value={stats.durationLabel} />
            <Stat
              label="Predicted engagement"
              value={`${stats.predictedEngagement}/100`}
              highlight={stats.predictedEngagement >= 75 ? "good" : stats.predictedEngagement < 50 ? "bad" : undefined}
            />
            <Stat
              label="Balance score"
              value={`${stats.balanceScore}/100`}
              highlight={stats.balanceScore >= 80 ? "good" : stats.balanceScore < 50 ? "bad" : undefined}
            />
            <Stat label="Max char count" value={stats.maxCharCount} />
            <Stat label="Min char count" value={stats.minCharCount} />
            <Stat
              label="Over limit"
              value={stats.overLimitCount}
              highlight={stats.overLimitCount > 0 ? "bad" : "good"}
            />
          </div>
        </CardContent>
      </Card>

      {/* Generated poll */}
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
              <Vote className="h-4 w-4" /> Generated Poll
            </h3>
            <Badge variant="secondary" className="text-[10px]">
              {PLATFORM_LABELS[platform]} · {POLL_TYPE_LABELS[pollType]}
            </Badge>
          </div>

          {poll.caption && (
            <div className="rounded border bg-background px-3 py-2 text-xs">
              <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-0.5">Caption</div>
              <div className="text-foreground">{poll.caption}</div>
            </div>
          )}

          <div className="rounded border bg-background px-3 py-2 text-xs">
            <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-0.5">Question</div>
            <div className="text-foreground font-medium">{poll.question}</div>
          </div>

          <div className="space-y-1">
            <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Options</div>
            {poll.options.map((o, i) => (
              <div key={i} className="flex items-center gap-2 rounded border bg-background px-3 py-1.5 text-xs">
                <Badge variant="outline" className="text-[10px] w-6 justify-center">
                  {String.fromCharCode(65 + i)}
                </Badge>
                <span className="flex-1 text-foreground">{o.text}</span>
                <span className="text-[10px] text-muted-foreground">{o.charCount} chars</span>
                {o.overLimit ? (
                  <Badge variant="destructive" className="text-[10px]">OVER LIMIT</Badge>
                ) : (
                  <CheckCircle2 className="h-3 w-3 text-emerald-500" />
                )}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
            <div className="rounded border bg-background px-3 py-2 text-xs">
              <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-0.5 flex items-center gap-1">
                <Clock className="h-3 w-3" /> Best time to post
              </div>
              <div className="text-foreground">{poll.bestTimeToPost}</div>
            </div>
            <div className="rounded border bg-background px-3 py-2 text-xs">
              <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-0.5 flex items-center gap-1">
                <Hash className="h-3 w-3" /> Hashtags
              </div>
              <div className="text-foreground flex flex-wrap gap-1">
                {poll.hashtags.map((h) => (
                  <span key={h} className="text-primary">{h}</span>
                ))}
              </div>
            </div>
          </div>

          <div className="rounded border bg-background px-3 py-2 text-xs">
            <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1 flex items-center gap-1">
              <Lightbulb className="h-3 w-3" /> Follow-up content ideas
            </div>
            <ul className="list-disc list-inside text-foreground space-y-0.5">
              {poll.followUpSuggestions.map((s, i) => <li key={i}>{s}</li>)}
            </ul>
          </div>

          <div className="flex flex-wrap gap-2 pt-2">
            <CopyButton
              getText={() => { handleSaveHistory(); return text; }}
              label="Copy poll"
            />
            <DownloadButton
              getText={() => { handleSaveHistory(); return text; }}
              filename="social-media-poll.txt"
              mime="text/plain"
              label="Download .txt"
            />
            <DownloadButton
              getText={() => csv}
              filename="social-media-poll.csv"
              mime="text/csv"
              label="Download CSV"
            />
            <ShareButton
              getUrl={() => { handleSaveHistory(); return buildShareUrl(input); }}
            />
            <ClearButton onClick={handleClear} />
          </div>
        </CardContent>
      </Card>

      {/* Variations toggle */}
      <Card>
        <CardContent className="p-4 space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
              <Lightbulb className="h-4 w-4" /> Poll Variations (3 angles)
            </h3>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowVariations((v) => !v)}
            >
              {showVariations ? "Hide" : "Show"}
            </Button>
          </div>
          {showVariations && (
            <div className="space-y-2">
              {variations.map((v, i) => (
                <div key={i} className="rounded border bg-background px-3 py-2 text-xs space-y-1">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-[10px]">V{i + 1}</Badge>
                    <span className="font-medium text-foreground">{v.question}</span>
                    <Badge variant="secondary" className="text-[10px] ml-auto">
                      {v.predictedEngagement}/100
                    </Badge>
                  </div>
                  <div className="text-[10px] text-muted-foreground">
                    {v.options.map((o) => o.text).join(" · ")}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* History */}
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
                  <Badge variant="outline" className="mr-2">{PLATFORM_LABELS[h.platform]}</Badge>
                  <Badge variant="outline" className="mr-2">{POLL_TYPE_LABELS[h.pollType]}</Badge>
                  <span className="text-foreground">{h.topic || "(no topic)"}</span>
                  <span className="text-muted-foreground ml-2">· {h.predictedEngagement}/100</span>
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
            <strong className="text-foreground">Privacy:</strong> All poll generation runs locally in your browser. History is stored in localStorage on this device only. Shareable URLs encode inputs in the URL hash and never touch our server.
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
