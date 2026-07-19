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
  PLATFORM_PRESETS,
  TONE_PRESETS,
  LENGTH_PRESETS,
  PLATFORM_LABELS,
  PLATFORM_CHAR_LIMITS,
  BEST_PRACTICE_TIPS,
  normalizeComment,
  analyzeSentiment,
  detectEscalation,
  highlightKeywords,
  getResponseTimeSuggestion,
  getBestPracticeTips,
  generateResponses,
  scoreResponseQuality,
  renderText,
  renderCsv,
  computeSummaryStats,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  type Sentiment,
  type Tone,
  type Platform,
  type ResponseLength,
  type ResponseInput,
  type HistoryEntry,
} from "./logic";
import {
  History,
  MessageCircleReply,
  AlertTriangle,
  Clock,
  Lightbulb,
  CheckCircle2,
} from "lucide-react";

const SENTIMENT_OPTIONS: Array<Sentiment | "auto"> = [
  "auto", "positive", "neutral", "negative", "mixed",
];

export default function SocialMediaCommentResponder() {
  const [comment, setComment] = useState("");
  const [sentiment, setSentiment] = useState<Sentiment | "auto">("auto");
  const [tone, setTone] = useState<Tone>("professional");
  const [platform, setPlatform] = useState<Platform>("twitter");
  const [length, setLength] = useState<ResponseLength>("short");
  const [includeEmoji, setIncludeEmoji] = useState(false);
  const [includeCTA, setIncludeCTA] = useState(false);
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  useEffect(() => {
    setHistory(loadHistory());
    if (typeof window !== "undefined" && window.location.hash) {
      const p = parseShareUrl(window.location.hash);
      if (p.originalComment !== undefined) setComment(p.originalComment);
      if (p.commentSentiment) setSentiment(p.commentSentiment);
      if (p.responseTone) setTone(p.responseTone);
      if (p.platform) setPlatform(p.platform);
      if (p.responseLength) setLength(p.responseLength);
      if (p.includeEmoji !== undefined) setIncludeEmoji(p.includeEmoji);
      if (p.includeCTA !== undefined) setIncludeCTA(p.includeCTA);
      if (p.originalComment || p.responseTone) toast.info("Loaded from share link");
    }
  }, []);

  const input: ResponseInput = useMemo(
    () => ({
      originalComment: comment,
      commentSentiment: sentiment,
      responseTone: tone,
      platform,
      responseLength: length,
      includeEmoji,
      includeCTA,
    }),
    [comment, sentiment, tone, platform, length, includeEmoji, includeCTA],
  );

  const variations = useMemo(() => generateResponses(input), [input]);
  const detectedSentiment = useMemo<Sentiment>(
    () => (sentiment === "auto" ? analyzeSentiment(comment) : sentiment),
    [sentiment, comment],
  );
  const escalation = useMemo(() => detectEscalation(comment), [comment]);
  const highlight = useMemo(() => highlightKeywords(comment), [comment]);
  const scores = useMemo(
    () => variations.map((v) => scoreResponseQuality(v, input)),
    [variations, input],
  );
  const stats = useMemo(
    () => computeSummaryStats(variations, scores, escalation.escalated ? 1 : 0),
    [variations, scores, escalation],
  );
  const text = useMemo(() => renderText(variations), [variations]);
  const csv = useMemo(() => renderCsv(variations), [variations]);

  const handleSaveHistory = useCallback(() => {
    if (variations.length > 0) {
      saveHistory({
        ts: Date.now(),
        comment: comment.slice(0, 200),
        sentiment: detectedSentiment,
        tone,
        platform,
        length,
        variationCount: variations.length,
      });
      setHistory(loadHistory());
    }
  }, [variations, comment, detectedSentiment, tone, platform, length]);

  const handleClear = useCallback(() => {
    setComment("");
    setSentiment("auto");
    setTone("professional");
    setPlatform("twitter");
    setLength("short");
    setIncludeEmoji(false);
    setIncludeCTA(false);
    toast.info("Cleared");
  }, []);

  const handleClearHistory = useCallback(() => {
    clearHistory();
    setHistory([]);
    toast.success("History cleared");
  }, []);

  const hasComment = normalizeComment(comment).length > 0;

  return (
    <div className="space-y-4 unq-animate-fade-in-up">
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="smcr-comment">Original comment</Label>
            <Textarea
              id="smcr-comment"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder={"Paste the social media comment you want to respond to…"}
              className="min-h-[100px] resize-y text-sm"
            />
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Field label="Sentiment">
              <select
                value={sentiment}
                onChange={(e) => setSentiment(e.target.value as Sentiment | "auto")}
                className="h-9 w-full text-xs rounded border bg-background px-2"
              >
                {SENTIMENT_OPTIONS.map((s) => (
                  <option key={s} value={s}>
                    {s === "auto" ? "Auto-detect" : s.charAt(0).toUpperCase() + s.slice(1)}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Tone">
              <select
                value={tone}
                onChange={(e) => setTone(e.target.value as Tone)}
                className="h-9 w-full text-xs rounded border bg-background px-2"
              >
                {TONE_PRESETS.map((t) => (
                  <option key={t.tone} value={t.tone}>{t.label}</option>
                ))}
              </select>
            </Field>
            <Field label="Platform">
              <select
                value={platform}
                onChange={(e) => setPlatform(e.target.value as Platform)}
                className="h-9 w-full text-xs rounded border bg-background px-2"
              >
                {PLATFORM_PRESETS.map((p) => (
                  <option key={p.platform} value={p.platform}>{p.label}</option>
                ))}
              </select>
            </Field>
            <Field label="Length">
              <select
                value={length}
                onChange={(e) => setLength(e.target.value as ResponseLength)}
                className="h-9 w-full text-xs rounded border bg-background px-2"
              >
                {LENGTH_PRESETS.map((l) => (
                  <option key={l.length} value={l.length}>{l.label}</option>
                ))}
              </select>
            </Field>
          </div>
          <div className="flex flex-wrap gap-4 text-xs">
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input
                type="checkbox"
                checked={includeEmoji}
                onChange={(e) => setIncludeEmoji(e.target.checked)}
              />
              Include emoji (sentiment-aware)
            </label>
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input
                type="checkbox"
                checked={includeCTA}
                onChange={(e) => setIncludeCTA(e.target.checked)}
              />
              Include CTA (per platform)
            </label>
          </div>
        </CardContent>
      </Card>

      {hasComment ? (
        <>
          {/* Meta info card */}
          <Card>
            <CardContent className="p-4 space-y-3 text-xs">
              <div className="flex flex-wrap gap-2">
                <Badge variant="secondary">
                  Sentiment: <span className="ml-1 font-mono">{detectedSentiment}</span>
                </Badge>
                <Badge variant="outline">
                  <Clock className="h-3 w-3 mr-1" />
                  {getResponseTimeSuggestion(platform)}
                </Badge>
                <Badge variant="outline">
                  {PLATFORM_LABELS[platform]} limit: {PLATFORM_CHAR_LIMITS[platform]} chars
                </Badge>
                {escalation.escalated && (
                  <Badge variant="destructive">
                    <AlertTriangle className="h-3 w-3 mr-1" />
                    Escalation: {escalation.reason}
                  </Badge>
                )}
              </div>

              {escalation.escalated && (
                <div className="rounded border border-destructive/30 bg-destructive/10 p-2 text-destructive">
                  <strong>⚠️ Escalation detected.</strong> Matched:{" "}
                  {escalation.matchedKeywords.join(", ")}. Consider routing to a human
                  moderator before responding.
                </div>
              )}

              {highlight.found.length > 0 && (
                <div className="rounded border bg-background p-2">
                  <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">
                    Original comment (sensitive words marked)
                  </div>
                  <p className="whitespace-pre-wrap break-words">
                    {renderHighlighted(highlight.highlighted)}
                  </p>
                </div>
              )}

              <div className="rounded border bg-background p-2">
                <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1 flex items-center gap-1">
                  <Lightbulb className="h-3 w-3" /> Best practice tips for{" "}
                  {detectedSentiment} comments
                </div>
                <ul className="list-disc pl-5 space-y-0.5">
                  {getBestPracticeTips(detectedSentiment).map((tip, i) => (
                    <li key={i}>{tip}</li>
                  ))}
                </ul>
              </div>
            </CardContent>
          </Card>

          {/* Variations card */}
          <Card>
            <CardContent className="p-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                  <MessageCircleReply className="h-4 w-4" /> {variations.length} response
                  variations
                </h3>
                <div className="flex flex-wrap gap-2">
                  <CopyButton
                    getText={() => { handleSaveHistory(); return text; }}
                    label="Copy all"
                  />
                  <DownloadButton
                    getText={() => { handleSaveHistory(); return text; }}
                    filename="social-responses.txt"
                    mime="text/plain"
                    label="Download .txt"
                  />
                  <DownloadButton
                    getText={() => csv}
                    filename="social-responses.csv"
                    mime="text/csv"
                    label="Download CSV"
                  />
                  <ShareButton
                    getUrl={() => { handleSaveHistory(); return buildShareUrl(input); }}
                  />
                  <ClearButton onClick={handleClear} />
                </div>
              </div>
              <div className="space-y-2">
                {variations.map((v, i) => {
                  const score = scores[i];
                  const overLimit = v.charCount > PLATFORM_CHAR_LIMITS[platform];
                  return (
                    <div key={i} className="rounded border bg-background p-3 space-y-2">
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge variant="outline" className="text-[10px]">
                            Variation {v.index + 1}
                          </Badge>
                          <Badge variant="secondary" className="text-[10px]">
                            {v.charCount} chars
                          </Badge>
                          {v.truncated && (
                            <Badge variant="destructive" className="text-[10px]">
                              truncated
                            </Badge>
                          )}
                          {!v.truncated && !overLimit && (
                            <Badge
                              variant="outline"
                              className="text-[10px] text-emerald-600 dark:text-emerald-400"
                            >
                              <CheckCircle2 className="h-3 w-3 mr-0.5" />
                              fits {PLATFORM_LABELS[platform]}
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-2 text-[10px]">
                          <span className="text-muted-foreground">
                            Quality:{" "}
                            <strong className={scoreColor(score.total)}>
                              {score.total}/100
                            </strong>
                          </span>
                          <CopyButton
                            getText={() => v.text}
                            label=""
                            size="icon-sm"
                          />
                        </div>
                      </div>
                      <p className="text-sm whitespace-pre-wrap break-words">{v.text}</p>
                    </div>
                  );
                })}
              </div>

              {/* Summary stats */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                <Stat label="Variations" value={stats.totalVariations} />
                <Stat label="Avg chars" value={stats.avgCharCount} />
                <Stat
                  label="Avg quality"
                  value={`${stats.avgQualityScore}/100`}
                  highlight={stats.avgQualityScore >= 70 ? "good" : undefined}
                />
                <Stat
                  label="Escalations"
                  value={stats.escalatedCount}
                  highlight={stats.escalatedCount > 0 ? "bad" : undefined}
                />
              </div>
            </CardContent>
          </Card>
        </>
      ) : (
        <EmptyState
          title="Paste a comment to generate responses"
          hint="Enter the social media comment you want to respond to. The tool analyzes sentiment, suggests a response time, flags escalations, and generates 3 ready-to-use replies tailored to your chosen tone and platform."
          icon={<MessageCircleReply className="h-8 w-8" />}
        />
      )}

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
                <div key={i} className="rounded border bg-background px-3 py-2 text-xs">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant="outline" className="text-[10px]">{h.sentiment}</Badge>
                    <Badge variant="outline" className="text-[10px]">{h.tone}</Badge>
                    <Badge variant="outline" className="text-[10px]">{h.platform}</Badge>
                    <Badge variant="outline" className="text-[10px]">{h.length}</Badge>
                  </div>
                  <p className="mt-1 text-muted-foreground truncate">&ldquo;{h.comment}&rdquo;</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    {new Date(h.ts).toLocaleString()}
                  </p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-3">
          <p className="text-xs text-muted-foreground">
            <strong className="text-foreground">Privacy:</strong> All sentiment analysis and
            response generation run locally. History is stored in localStorage on this device
            only. Shareable URLs encode inputs in the hash and never touch our server.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">
        {label}
      </Label>
      {children}
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
  const color =
    highlight === "bad"
      ? "text-red-600 dark:text-red-400"
      : highlight === "good"
        ? "text-emerald-600 dark:text-emerald-400"
        : "text-foreground";
  return (
    <div className="rounded border bg-background px-3 py-2">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      <div className={`text-base font-semibold ${color}`}>{value}</div>
    </div>
  );
}

function scoreColor(score: number): string {
  if (score >= 80) return "text-emerald-600 dark:text-emerald-400";
  if (score >= 60) return "text-yellow-600 dark:text-yellow-400";
  return "text-red-600 dark:text-red-400";
}

function renderHighlighted(text: string): React.ReactNode {
  const parts = text.split(/(\[\[[^\]]+\]\])/g);
  return parts.map((p, i) => {
    if (/^\[\[.+\]\]$/.test(p)) {
      return (
        <mark
          key={i}
          className="bg-red-200 dark:bg-red-900 dark:text-red-100 rounded px-0.5"
        >
          {p.slice(2, -2)}
        </mark>
      );
    }
    return <React.Fragment key={i}>{p}</React.Fragment>;
  });
}
