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
  POST_TYPES,
  TONES,
  POST_TYPE_LABELS,
  TONE_LABELS,
  POST_TYPE_CONFIGS,
  TONE_PRESETS,
  MAX_CHARS,
  OPTIMAL_CHARS,
  formatPost,
  generateVariations,
  computeStats,
  topBestTimes,
  renderText,
  renderHtml,
  renderMarkdown,
  renderCsv,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  type PostType,
  type Tone,
  type PostInput,
  type HistoryEntry,
} from "./logic";
import { History, Linkedin, Clock, Hash, ListChecks, Gauge } from "lucide-react";

export default function LinkedinPostFormatter() {
  const [rawContent, setRawContent] = useState("");
  const [postType, setPostType] = useState<PostType>("text-post");
  const [includeHeadline, setIncludeHeadline] = useState(true);
  const [includeBullets, setIncludeBullets] = useState(true);
  const [includeCTA, setIncludeCTA] = useState(true);
  const [includeHashtags, setIncludeHashtags] = useState(true);
  const [tone, setTone] = useState<Tone>("thought-leader");
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  useEffect(() => {
    setHistory(loadHistory());
    if (typeof window !== "undefined" && window.location.hash) {
      const p = parseShareUrl(window.location.hash);
      if (p.rawContent) setRawContent(p.rawContent);
      setPostType(p.postType);
      setTone(p.tone);
      setIncludeHeadline(p.includeHeadline);
      setIncludeBullets(p.includeBullets);
      setIncludeCTA(p.includeCTA);
      setIncludeHashtags(p.includeHashtags);
      if (p.rawContent) toast.info("Loaded from share link");
    }
  }, []);

  const input: PostInput = useMemo(
    () => ({
      rawContent,
      postType,
      includeHeadline,
      includeBullets,
      includeCTA,
      includeHashtags,
      tone,
    }),
    [rawContent, postType, includeHeadline, includeBullets, includeCTA, includeHashtags, tone],
  );

  const variations = useMemo(() => {
    if (!rawContent.trim()) return [];
    return generateVariations(input);
  }, [input, rawContent]);

  const stats = useMemo(() => computeStats(variations), [variations]);
  const textReport = useMemo(() => renderText(variations), [variations]);
  const htmlReport = useMemo(() => renderHtml(variations), [variations]);
  const mdReport = useMemo(() => renderMarkdown(variations), [variations]);
  const csvReport = useMemo(() => renderCsv(variations), [variations]);
  const bestTimes = useMemo(() => topBestTimes(), []);

  const handleSaveHistory = useCallback(() => {
    if (variations.length > 0) {
      const first = variations[0];
      saveHistory({
        ts: Date.now(),
        postType,
        tone,
        charCount: first.charCount,
        preview: first.headline.slice(0, 80) || first.formattedText.slice(0, 80),
      });
      setHistory(loadHistory());
    }
  }, [variations, postType, tone]);

  const handleClear = useCallback(() => {
    setRawContent("");
    setPostType("text-post");
    setIncludeHeadline(true);
    setIncludeBullets(true);
    setIncludeCTA(true);
    setIncludeHashtags(true);
    setTone("thought-leader");
    toast.info("Cleared");
  }, []);

  const handleClearHistory = useCallback(() => {
    clearHistory();
    setHistory([]);
    toast.success("History cleared");
  }, []);

  const charStatus = (count: number): "good" | "warn" | "bad" => {
    if (count > MAX_CHARS) return "bad";
    if (count > OPTIMAL_CHARS) return "warn";
    return "good";
  };

  return (
    <div className="space-y-4 unq-animate-fade-in-up">
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="lipf-content">Raw content / unformatted thoughts</Label>
            <Textarea
              id="lipf-content"
              value={rawContent}
              onChange={(e) => setRawContent(e.target.value)}
              placeholder={"Paste your raw thoughts here. The formatter will extract a bold hook, format bullets, add line breaks, generate a CTA, and append hashtags.\n\nExample:\nI built a $1M app in 30 days.\nFirst lesson: focus matters.\nSecond lesson: ship fast."}
              className="min-h-[160px] resize-y text-sm"
            />
            <div className="text-[11px] text-muted-foreground">
              {rawContent.length} chars (max 3000, optimal ~1300)
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Post type</Label>
              <select
                value={postType}
                onChange={(e) => setPostType(e.target.value as PostType)}
                className="h-9 w-full text-sm rounded border bg-background px-2"
              >
                {POST_TYPES.map((t) => (
                  <option key={t} value={t}>{POST_TYPE_LABELS[t]}</option>
                ))}
              </select>
              <div className="text-[10px] text-muted-foreground">
                Structure: {POST_TYPE_CONFIGS[postType].structure}
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Tone</Label>
              <select
                value={tone}
                onChange={(e) => setTone(e.target.value as Tone)}
                className="h-9 w-full text-sm rounded border bg-background px-2"
              >
                {TONES.map((t) => (
                  <option key={t} value={t}>{TONE_LABELS[t]}</option>
                ))}
              </select>
              <div className="text-[10px] text-muted-foreground">
                Signoff: {TONE_PRESETS[tone].signoff}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-4 pt-1">
            <label className="flex items-center gap-1.5 text-xs cursor-pointer">
              <input type="checkbox" checked={includeHeadline} onChange={(e) => setIncludeHeadline(e.target.checked)} />
              Bold hook (headline)
            </label>
            <label className="flex items-center gap-1.5 text-xs cursor-pointer">
              <input type="checkbox" checked={includeBullets} onChange={(e) => setIncludeBullets(e.target.checked)} />
              Bullets
            </label>
            <label className="flex items-center gap-1.5 text-xs cursor-pointer">
              <input type="checkbox" checked={includeCTA} onChange={(e) => setIncludeCTA(e.target.checked)} />
              CTA
            </label>
            <label className="flex items-center gap-1.5 text-xs cursor-pointer">
              <input type="checkbox" checked={includeHashtags} onChange={(e) => setIncludeHashtags(e.target.checked)} />
              Hashtags
            </label>
          </div>
        </CardContent>
      </Card>

      {variations.length > 0 ? (
        <>
          <Card>
            <CardContent className="p-4 space-y-2">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <Gauge className="h-4 w-4" /> {stats.totalVariations} variations · avg {stats.avgCharCount} chars · avg hook score {stats.avgHookScore}/100
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                <Stat label="Avg chars" value={stats.avgCharCount} highlight={stats.avgCharCount > MAX_CHARS ? "bad" : stats.avgCharCount > OPTIMAL_CHARS ? "warn" : "good"} />
                <Stat label="Avg words" value={stats.avgWordCount} />
                <Stat label="Avg read" value={`${stats.avgReadingTime} min`} />
                <Stat label="Within limit" value={`${stats.withinLimitCount}/${stats.totalVariations}`} />
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                <Stat label="Within optimal" value={`${stats.withinOptimalCount}/${stats.totalVariations}`} />
                <Stat label="Total hashtags" value={stats.totalHashtags} />
                <Stat label="Avg hook score" value={`${stats.avgHookScore}/100`} />
                <Stat label="Best time" value={bestTimes[0] ? `${bestTimes[0].day} ${bestTimes[0].hour}` : "—"} />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 space-y-3">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <Linkedin className="h-4 w-4" /> Formatted variations
              </h3>
              <div className="space-y-3">
                {variations.map((p, i) => {
                  const status = charStatus(p.charCount);
                  const statusColor = status === "bad"
                    ? "text-red-600 dark:text-red-400"
                    : status === "warn"
                      ? "text-amber-600 dark:text-amber-400"
                      : "text-emerald-600 dark:text-emerald-400";
                  return (
                    <div key={i} className="rounded border bg-background p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Badge variant="secondary" className="text-[10px]">Variation {i + 1}</Badge>
                          <Badge variant="outline" className="text-[10px]">{POST_TYPE_LABELS[p.postType]}</Badge>
                          <Badge variant="outline" className="text-[10px]">{TONE_LABELS[p.tone]}</Badge>
                        </div>
                        <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                          <span className={statusColor}>{p.charCount}/{MAX_CHARS}</span>
                          <span>· {p.wordCount} words</span>
                          <span>· {p.readingTimeMin} min</span>
                          <span>· hook {p.hookScore}/100</span>
                        </div>
                      </div>
                      {p.validationIssues.length > 0 && (
                        <div className="rounded bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 px-2 py-1 text-[11px] text-amber-800 dark:text-amber-300">
                          {p.validationIssues.map((iss, k) => (
                            <div key={k}>⚠ {iss}</div>
                          ))}
                        </div>
                      )}
                      <pre className="whitespace-pre-wrap font-sans text-xs leading-relaxed text-foreground">
                        {p.formattedText}
                      </pre>
                      <div className="flex flex-wrap gap-1.5 pt-1">
                        {p.hashtags.map((h) => (
                          <Badge key={h} variant="outline" className="text-[10px] text-primary">#{h}</Badge>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="flex flex-wrap gap-2 pt-2">
                <CopyButton
                  getText={() => { handleSaveHistory(); return variations[0].formattedText; }}
                  label="Copy variation 1"
                />
                <CopyButton
                  getText={() => { handleSaveHistory(); return textReport; }}
                  label="Copy text report"
                />
                <DownloadButton
                  getText={() => { handleSaveHistory(); return variations[0].formattedText; }}
                  filename="linkedin-post.txt"
                  mime="text/plain"
                  label="Download .txt"
                />
                <DownloadButton
                  getText={() => htmlReport}
                  filename="linkedin-post.html"
                  mime="text/html"
                  label="Download HTML"
                />
                <DownloadButton
                  getText={() => mdReport}
                  filename="linkedin-post.md"
                  mime="text/markdown"
                  label="Download MD"
                />
                <DownloadButton
                  getText={() => csvReport}
                  filename="linkedin-post.csv"
                  mime="text/csv"
                  label="Download CSV"
                />
                <ShareButton getUrl={() => { handleSaveHistory(); return buildShareUrl(input); }} />
                <ClearButton onClick={handleClear} />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 space-y-2">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <Clock className="h-4 w-4" /> Best time to post (LinkedIn B2B)
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {bestTimes.map((t, i) => (
                  <div key={i} className="rounded border bg-background px-3 py-2 text-xs">
                    <div className="font-medium text-foreground">{t.day}</div>
                    <div className="text-muted-foreground">{t.hour}</div>
                    <Badge
                      variant={t.engagement === "high" ? "default" : "secondary"}
                      className="text-[10px] mt-1"
                    >
                      {t.engagement} engagement
                    </Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </>
      ) : (
        <EmptyState
          title="Paste your raw thoughts to format a LinkedIn post"
          hint="The tool extracts a bold hook, formats bullets, adds line breaks LinkedIn's algorithm prefers, generates a CTA per post type, and appends 3-5 professional hashtags. Three variations are generated with different hooks."
          icon={<Linkedin className="h-8 w-8" />}
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
                  <Badge variant="outline" className="mr-2">{POST_TYPE_LABELS[h.postType]}</Badge>
                  <Badge variant="outline" className="mr-2">{TONE_LABELS[h.tone]}</Badge>
                  <Badge variant="outline" className="mr-2">{h.charCount} chars</Badge>
                  <span className="text-muted-foreground">{h.preview}</span>
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
            <strong className="text-foreground">Privacy:</strong> All formatting runs locally in your browser. Your raw content never leaves this device. History is stored in localStorage on this device only.
          </p>
          <div className="flex flex-wrap gap-2 mt-2 text-[10px] text-muted-foreground">
            <span className="flex items-center gap-1"><Hash className="h-3 w-3" /> 5 post types</span>
            <span className="flex items-center gap-1"><ListChecks className="h-3 w-3" /> 5 tones</span>
            <span className="flex items-center gap-1"><Gauge className="h-3 w-3" /> Hook strength scorer</span>
            <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> Best time suggestions</span>
          </div>
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
  highlight?: "good" | "warn" | "bad";
}) {
  const color = highlight === "bad"
    ? "text-red-600 dark:text-red-400"
    : highlight === "warn"
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
