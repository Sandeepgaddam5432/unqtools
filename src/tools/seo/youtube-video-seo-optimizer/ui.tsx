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
  VIDEO_CATEGORIES,
  CATEGORY_PRESETS,
  MAX_TITLE_LENGTH,
  MAX_DESCRIPTION_LENGTH,
  MAX_TAGS_CHARS,
  parseInputs,
  analyzeAll,
  renderText,
  renderCsv,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  type VideoCategory,
  type SeoInputs,
  type HistoryEntry,
} from "./logic";
import { Youtube, History, AlertCircle, CheckCircle2, Hash, ListVideo, Image as ImageIcon } from "lucide-react";

export default function YoutubeVideoSeoOptimizer() {
  const [form, setForm] = useState<SeoInputs>({
    videoTitle: "",
    videoDescription: "",
    tags: "",
    channelName: "",
    targetKeywords: "",
    videoCategory: "Education",
  });
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  useEffect(() => {
    setHistory(loadHistory());
    if (typeof window !== "undefined" && window.location.hash) {
      const p = parseShareUrl(window.location.hash);
      setForm((prev) => ({
        ...prev,
        videoTitle: p.videoTitle ?? prev.videoTitle,
        videoDescription: p.videoDescription ?? prev.videoDescription,
        tags: p.tags ?? prev.tags,
        channelName: p.channelName ?? prev.channelName,
        targetKeywords: p.targetKeywords ?? prev.targetKeywords,
        videoCategory: p.videoCategory ?? prev.videoCategory,
      }));
      if (Object.keys(p).length > 0) toast.info("Loaded from share link");
    }
  }, []);

  const inputs = useMemo(() => parseInputs(form), [form]);
  const result = useMemo(() => analyzeAll(inputs), [inputs]);
  const text = useMemo(() => renderText(result), [result]);
  const csv = useMemo(() => renderCsv(result), [result]);

  const hasInput = Boolean(inputs.videoTitle || inputs.videoDescription || inputs.tags);

  const handleSaveHistory = useCallback(() => {
    if (hasInput) {
      saveHistory({
        ts: Date.now(),
        videoTitle: inputs.videoTitle.slice(0, 60),
        category: inputs.videoCategory,
        totalScore: result.summary.total,
        titleScore: result.summary.titleScore,
        descriptionScore: result.summary.descriptionScore,
        tagsScore: result.summary.tagsScore,
        hashtagsScore: result.summary.hashtagsScore,
      });
      setHistory(loadHistory());
    }
  }, [hasInput, inputs, result]);

  const handleClear = useCallback(() => {
    setForm({
      videoTitle: "",
      videoDescription: "",
      tags: "",
      channelName: "",
      targetKeywords: "",
      videoCategory: "Education",
    });
    toast.info("Cleared");
  }, []);

  const handleClearHistory = useCallback(() => {
    clearHistory();
    setHistory([]);
    toast.success("History cleared");
  }, []);

  const applyCategoryPreset = useCallback((cat: VideoCategory) => {
    const preset = CATEGORY_PRESETS[cat];
    setForm((prev) => ({
      ...prev,
      videoCategory: cat,
      tags: prev.tags ? `${prev.tags}, ${preset.tags.join(", ")}` : preset.tags.join(", "),
    }));
    toast.info(`Applied ${cat} preset`);
  }, []);

  const scoreColor = (score: number, max: number) => {
    const pct = score / max;
    if (pct >= 0.8) return "text-emerald-600 dark:text-emerald-400";
    if (pct >= 0.5) return "text-amber-600 dark:text-amber-400";
    return "text-red-600 dark:text-red-400";
  };

  const totalColor = scoreColor(result.summary.total, 100);

  return (
    <div className="space-y-4 unq-animate-fade-in-up">
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="yt-title">Video title <span className="text-muted-foreground text-[11px]">(max 100 chars, 60-70 optimal)</span></Label>
              <span className={`text-[11px] font-mono ${form.videoTitle.length > MAX_TITLE_LENGTH ? "text-red-600" : form.videoTitle.length >= 60 && form.videoTitle.length <= 70 ? "text-emerald-600" : "text-muted-foreground"}`}>
                {form.videoTitle.length}/{MAX_TITLE_LENGTH}
              </span>
            </div>
            <Input
              id="yt-title"
              value={form.videoTitle}
              onChange={(e) => setForm((f) => ({ ...f, videoTitle: e.target.value }))}
              placeholder="How to Bake Chocolate Chip Cookies from Scratch"
              maxLength={MAX_TITLE_LENGTH + 30}
            />
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="yt-desc">Video description <span className="text-muted-foreground text-[11px]">(max 5000 chars, 250+ optimal)</span></Label>
              <span className={`text-[11px] font-mono ${form.videoDescription.length > MAX_DESCRIPTION_LENGTH ? "text-red-600" : form.videoDescription.length >= 250 ? "text-emerald-600" : "text-muted-foreground"}`}>
                {form.videoDescription.length}/{MAX_DESCRIPTION_LENGTH}
              </span>
            </div>
            <Textarea
              id="yt-desc"
              value={form.videoDescription}
              onChange={(e) => setForm((f) => ({ ...f, videoDescription: e.target.value }))}
              placeholder={"In this tutorial, we'll learn how to bake chocolate chip cookies from scratch.\n\n0:00 Intro\n1:30 Mixing dry ingredients\n3:00 Adding chocolate\n5:30 Baking\n\nFollow: https://instagram.com/me\n#baking #cookies #dessert"}
              className="min-h-[160px] resize-y font-mono text-xs"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="yt-tags">Tags <span className="text-muted-foreground text-[11px]">(comma-separated, max 500 chars total)</span></Label>
              <Textarea
                id="yt-tags"
                value={form.tags}
                onChange={(e) => setForm((f) => ({ ...f, tags: e.target.value }))}
                placeholder="chocolate chip cookies, baking, dessert, homemade cookies"
                className="min-h-[60px] resize-y font-mono text-xs"
              />
              <div className={`text-[11px] font-mono ${result.tags.totalChars > MAX_TAGS_CHARS ? "text-red-600" : "text-muted-foreground"}`}>
                {result.tags.totalChars}/{MAX_TAGS_CHARS} chars · {result.tags.tags.length} tags
              </div>
            </div>
            <div className="space-y-2">
              <div className="space-y-1.5">
                <Label htmlFor="yt-channel">Channel name</Label>
                <Input
                  id="yt-channel"
                  value={form.channelName}
                  onChange={(e) => setForm((f) => ({ ...f, channelName: e.target.value }))}
                  placeholder="Baking With Beth"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="yt-kw">Target keywords <span className="text-muted-foreground text-[11px]">(comma-separated)</span></Label>
                <Input
                  id="yt-kw"
                  value={form.targetKeywords}
                  onChange={(e) => setForm((f) => ({ ...f, targetKeywords: e.target.value }))}
                  placeholder="chocolate chip cookies, baking, dessert"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="yt-cat">Video category</Label>
                <select
                  id="yt-cat"
                  value={form.videoCategory}
                  onChange={(e) => setForm((f) => ({ ...f, videoCategory: e.target.value as VideoCategory }))}
                  className="w-full h-9 text-xs rounded border bg-background px-2"
                >
                  {VIDEO_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-1.5 pt-1">
            <span className="text-[11px] text-muted-foreground">Quick presets:</span>
            {VIDEO_CATEGORIES.map((c) => (
              <Button
                key={c}
                variant="ghost"
                size="sm"
                className="h-6 text-[11px]"
                onClick={() => applyCategoryPreset(c)}
              >+ {c}</Button>
            ))}
          </div>
        </CardContent>
      </Card>

      {hasInput ? (
        <>
          <Card>
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                  <Youtube className="h-4 w-4" /> SEO Score
                </h3>
                <div className={`text-2xl font-bold font-mono ${totalColor}`}>
                  {result.summary.total}<span className="text-sm text-muted-foreground">/100</span>
                </div>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                <ScoreStat label="Title" score={result.summary.titleScore} max={30} />
                <ScoreStat label="Description" score={result.summary.descriptionScore} max={30} />
                <ScoreStat label="Tags" score={result.summary.tagsScore} max={25} />
                <ScoreStat label="Hashtags" score={result.summary.hashtagsScore} max={15} />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 space-y-3">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <Youtube className="h-4 w-4" /> Title Analysis
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                <MicroStat label="Length" value={`${result.title.length} chars`} score={result.title.lengthScore} max={10} />
                <MicroStat label="Keyword placement" value={`${result.title.keywordPlacement}% front-loaded`} score={result.title.placementScore} max={10} />
                <MicroStat label="Clickbait penalty" value={`${result.title.clickbaitCount} triggers`} score={result.title.clickbaitScore} max={10} />
              </div>
              {result.title.clickbaitTriggers.length > 0 && (
                <div className="flex flex-wrap gap-1 items-center text-[11px]">
                  <AlertCircle className="h-3 w-3 text-amber-500" />
                  <span className="text-muted-foreground">Clickbait triggers:</span>
                  {result.title.clickbaitTriggers.map((t, i) => (
                    <Badge key={i} variant="outline" className="text-[10px] text-amber-600 dark:text-amber-400">{t}</Badge>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 space-y-3">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <ListVideo className="h-4 w-4" /> Description Analysis
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-xs">
                <MicroStat label="Length" value={`${result.description.length} chars`} score={result.description.lengthScore} max={10} />
                <MicroStat label="Above-fold" value={result.description.aboveFoldHasKeyword ? "has keyword" : "no keyword"} score={result.description.aboveFoldScore} max={5} />
                <MicroStat label="Density" value={`${result.description.keywordDensity[0]?.density ?? 0}% top`} score={result.description.densityScore} max={5} />
                <MicroStat label="Links" value={`${result.description.links.affiliate.length + result.description.links.social.length + result.description.links.website.length} total`} score={result.description.linksScore} max={5} />
                <MicroStat label="Chapters" value={`${result.description.chapters.length} found`} score={result.description.chaptersScore} max={5} />
              </div>
              {result.description.aboveFold && (
                <div className="rounded border bg-background px-3 py-2 text-[11px]">
                  <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-0.5">Above the fold (first 125 chars)</div>
                  <p className="font-mono text-foreground">{result.description.aboveFold}</p>
                </div>
              )}
              {result.description.keywordDensity.length > 0 && (
                <div className="rounded border bg-background px-3 py-2 text-[11px]">
                  <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">Top keywords (density)</div>
                  <div className="flex flex-wrap gap-1">
                    {result.description.keywordDensity.map((k) => (
                      <Badge key={k.word} variant="secondary" className="text-[10px]">{k.word} ×{k.count} ({k.density}%)</Badge>
                    ))}
                  </div>
                </div>
              )}
              {(result.description.links.affiliate.length > 0 || result.description.links.social.length > 0 || result.description.links.website.length > 0) && (
                <div className="rounded border bg-background px-3 py-2 text-[11px] space-y-1">
                  <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Detected links</div>
                  {result.description.links.affiliate.map((u, i) => (
                    <div key={`a${i}`} className="text-amber-600 dark:text-amber-400 truncate">affiliate: {u}</div>
                  ))}
                  {result.description.links.social.map((u, i) => (
                    <div key={`s${i}`} className="text-blue-600 dark:text-blue-400 truncate">social: {u}</div>
                  ))}
                  {result.description.links.website.map((u, i) => (
                    <div key={`w${i}`} className="text-muted-foreground truncate">website: {u}</div>
                  ))}
                </div>
              )}
              {result.description.chapters.length > 0 && (
                <div className="rounded border bg-background px-3 py-2 text-[11px] space-y-0.5">
                  <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1 flex items-center gap-1">
                    Chapters
                    {result.description.chaptersValid ? (
                      <Badge variant="outline" className="text-[10px] text-emerald-600"><CheckCircle2 className="h-2.5 w-2.5" /> valid sequence</Badge>
                    ) : (
                      <Badge variant="outline" className="text-[10px] text-red-600"><AlertCircle className="h-2.5 w-2.5" /> invalid sequence</Badge>
                    )}
                  </div>
                  {result.description.chapters.map((c, i) => (
                    <div key={i} className="font-mono flex gap-2">
                      <span className="text-muted-foreground">{c.raw}</span>
                      <span className="text-foreground">{c.label}</span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 space-y-3">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <Hash className="h-4 w-4" /> Tags & Hashtags
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
                <MicroStat label="Tag count" value={`${result.tags.tags.length} tags`} score={result.tags.countScore} max={10} />
                <MicroStat label="Tag relevance" value={`${result.tags.matchedKeywords.length} matched`} score={result.tags.relevanceScore} max={10} />
                <MicroStat label="Long-tail tags" value={`${result.tags.longTailCount} found`} score={result.tags.longTailScore} max={5} />
                <MicroStat label="Hashtag count" value={`${result.hashtags.hashtags.length}`} score={result.hashtags.countScore} max={5} />
                <MicroStat label="Hashtag variety" value={`${result.hashtags.varietyScore}/5`} score={result.hashtags.varietyScore} max={5} />
                <MicroStat label="Category match" value={`${result.hashtags.categoryMatches.length} matches`} score={result.hashtags.categoryScore} max={5} />
              </div>
              {result.hashtags.hashtags.length > 0 && (
                <div className="rounded border bg-background px-3 py-2 text-[11px]">
                  <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">Detected hashtags</div>
                  <div className="flex flex-wrap gap-1">
                    {result.hashtags.hashtags.map((h) => (
                      <Badge key={h} variant="secondary" className="text-[10px]">{h}</Badge>
                    ))}
                  </div>
                </div>
              )}
              {result.hashtags.suggested.length > 0 && (
                <div className="rounded border bg-background px-3 py-2 text-[11px]">
                  <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">Suggested hashtags</div>
                  <div className="flex flex-wrap gap-1">
                    {result.hashtags.suggested.map((h) => (
                      <Badge key={h} variant="outline" className="text-[10px] cursor-pointer" onClick={() => setForm((f) => ({ ...f, videoDescription: `${f.videoDescription} ${h}` }))}>+ {h}</Badge>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 space-y-2">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <ImageIcon className="h-4 w-4" /> Thumbnail text suggestion
              </h3>
              {result.summary.thumbnail.hook ? (
                <>
                  <div className="rounded border bg-black px-4 py-3 text-center">
                    <span className="text-lg font-bold tracking-tight text-white uppercase">{result.summary.thumbnail.hook}</span>
                  </div>
                  <p className="text-[11px] text-muted-foreground">3-5 word hook derived from your title. Add this as a text overlay on your thumbnail image.</p>
                </>
              ) : (
                <p className="text-xs text-muted-foreground">Enter a video title to get a thumbnail hook suggestion.</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 space-y-2">
              <div className="flex flex-wrap gap-2">
                <CopyButton getText={() => { handleSaveHistory(); return text; }} label="Copy report" />
                <DownloadButton getText={() => { handleSaveHistory(); return text; }} filename="youtube-seo-report.txt" mime="text/plain" label="Download .txt" />
                <DownloadButton getText={() => csv} filename="youtube-seo-report.csv" mime="text/csv" label="Download CSV" />
                <ShareButton getUrl={() => { handleSaveHistory(); return buildShareUrl(inputs); }} />
                <ClearButton onClick={handleClear} />
              </div>
            </CardContent>
          </Card>
        </>
      ) : (
        <EmptyState
          title="Enter your YouTube video metadata to analyze SEO"
          hint="Fill in the title, description, tags, and target keywords. The tool scores your video 0-100 across title (30pts), description (30pts), tags (25pts), and hashtags (15pts). Click a category preset to auto-fill tags."
          icon={<Youtube className="h-8 w-8" />}
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
                <div key={i} className="rounded border bg-background px-3 py-2 text-xs flex flex-wrap items-center gap-2">
                  <Badge variant="outline" className={`text-[10px] ${h.totalScore >= 80 ? "text-emerald-600" : h.totalScore >= 50 ? "text-amber-600" : "text-red-600"}`}>
                    {h.totalScore}/100
                  </Badge>
                  <Badge variant="outline" className="text-[10px]">{h.category}</Badge>
                  <span className="text-foreground truncate flex-1">{h.videoTitle}</span>
                  <span className="text-muted-foreground text-[10px]">T{h.titleScore} · D{h.descriptionScore} · G{h.tagsScore} · H{h.hashtagsScore}</span>
                  <span className="text-muted-foreground text-[10px]">· {new Date(h.ts).toLocaleString()}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-3">
          <p className="text-xs text-muted-foreground">
            <strong className="text-foreground">Privacy:</strong> All metadata analysis runs locally. No network calls, no AI APIs. History is stored in localStorage on this device only.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function ScoreStat({ label, score, max }: { label: string; score: number; max: number }) {
  const pct = score / max;
  const color = pct >= 0.8 ? "text-emerald-600 dark:text-emerald-400" : pct >= 0.5 ? "text-amber-600 dark:text-amber-400" : "text-red-600 dark:text-red-400";
  return (
    <div className="rounded border bg-background px-3 py-2">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className={`text-base font-semibold font-mono ${color}`}>{score}<span className="text-[11px] text-muted-foreground">/{max}</span></div>
      <div className="mt-1 h-1 w-full rounded bg-muted overflow-hidden">
        <div className={`h-full ${pct >= 0.8 ? "bg-emerald-500" : pct >= 0.5 ? "bg-amber-500" : "bg-red-500"}`} style={{ width: `${Math.min(pct, 1) * 100}%` }} />
      </div>
    </div>
  );
}

function MicroStat({ label, value, score, max }: { label: string; value: string; score: number; max: number }) {
  const pct = score / max;
  const color = pct >= 0.8 ? "text-emerald-600 dark:text-emerald-400" : pct >= 0.5 ? "text-amber-600 dark:text-amber-400" : "text-red-600 dark:text-red-400";
  return (
    <div className="rounded border bg-background px-3 py-2">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="text-xs font-medium text-foreground">{value}</div>
      <div className={`text-[11px] font-mono ${color}`}>{score}/{max}</div>
    </div>
  );
}
