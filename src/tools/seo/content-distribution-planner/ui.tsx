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
  CHANNEL_CONFIGS,
  ALL_CHANNEL_IDS,
  CHANNEL_PRESETS,
  parseChannels,
  parseHashtags,
  suggestHashtags,
  generateAll,
  filterByChannel,
  computeSummaryStats,
  renderText,
  renderCsv,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  type ChannelId,
  type DistributionInput,
  type HistoryEntry,
} from "./logic";
import { History, Share2, AlertTriangle, Hash, Sparkles } from "lucide-react";

export default function ContentDistributionPlanner() {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [url, setUrl] = useState("");
  const [channelsText, setChannelsText] = useState("");
  const [hashtagsText, setHashtagsText] = useState("");
  const [cta, setCta] = useState("");
  const [filterChannel, setFilterChannel] = useState<ChannelId | "">("");
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  useEffect(() => {
    setHistory(loadHistory());
    if (typeof window !== "undefined" && window.location.hash) {
      const p = parseShareUrl(window.location.hash);
      if (p.title) setTitle(p.title);
      if (p.description) setDescription(p.description);
      if (p.url) setUrl(p.url);
      if (p.channels && p.channels.length > 0) setChannelsText(p.channels.join(", "));
      if (p.hashtags && p.hashtags.length > 0) setHashtagsText(p.hashtags.join(" "));
      if (p.cta) setCta(p.cta);
      if (p.title || p.channels?.length) toast.info("Loaded from share link");
    }
  }, []);

  const channels = useMemo(() => parseChannels(channelsText), [channelsText]);
  const hashtags = useMemo(() => parseHashtags(hashtagsText), [hashtagsText]);

  const input: DistributionInput = useMemo(() => ({
    title,
    description,
    url,
    channels,
    hashtags,
    cta,
  }), [title, description, url, channels, hashtags, cta]);

  const snippets = useMemo(() => generateAll(input), [input]);
  const filtered = useMemo(() => filterByChannel(snippets, filterChannel), [snippets, filterChannel]);
  const stats = useMemo(() => computeSummaryStats(snippets), [snippets]);
  const text = useMemo(() => renderText(filtered), [filtered]);
  const csv = useMemo(() => renderCsv(filtered), [filtered]);
  const suggested = useMemo(() => suggestHashtags(title, 10), [title]);

  const handleSaveHistory = useCallback(() => {
    if (snippets.length > 0) {
      saveHistory({
        ts: Date.now(),
        title: title || "(untitled)",
        channels,
        totalSnippets: snippets.length,
      });
      setHistory(loadHistory());
    }
  }, [snippets, title, channels]);

  const handleClear = useCallback(() => {
    setTitle("");
    setDescription("");
    setUrl("");
    setChannelsText("");
    setHashtagsText("");
    setCta("");
    setFilterChannel("");
    toast.info("Cleared");
  }, []);

  const handleClearHistory = useCallback(() => {
    clearHistory();
    setHistory([]);
    toast.success("History cleared");
  }, []);

  const toggleChannel = (id: ChannelId) => {
    const current = channels;
    const next = current.includes(id)
      ? current.filter((c) => c !== id)
      : [...current, id];
    setChannelsText(next.map((c) => CHANNEL_CONFIGS[c].label).join(", "));
  };

  const applyPreset = (key: string) => {
    const preset = CHANNEL_PRESETS[key];
    if (preset) {
      setChannelsText(preset.map((c) => CHANNEL_CONFIGS[c].label).join(", "));
      toast.info(`Applied preset: ${key}`);
    }
  };

  return (
    <div className="space-y-4 unq-animate-fade-in-up">
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="cdp-title">Content title</Label>
            <Input
              id="cdp-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="10 Free SEO Tools You Should Use"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cdp-desc">Content description / source</Label>
            <Textarea
              id="cdp-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="A short summary of the piece you're distributing…"
              className="min-h-[80px] resize-y font-mono text-xs"
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="cdp-url">Content URL</Label>
              <Input
                id="cdp-url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://example.com/blog/post"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cdp-cta">Call-to-action</Label>
              <Input
                id="cdp-cta"
                value={cta}
                onChange={(e) => setCta(e.target.value)}
                placeholder="Read the full list"
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cdp-channels">Target channels (comma-separated)</Label>
            <Input
              id="cdp-channels"
              value={channelsText}
              onChange={(e) => setChannelsText(e.target.value)}
              placeholder="twitter, linkedin, reddit, devto"
              className="font-mono text-xs"
            />
            <div className="flex flex-wrap gap-1 pt-1">
              {ALL_CHANNEL_IDS.map((id) => (
                <Button
                  key={id}
                  variant={channels.includes(id) ? "default" : "ghost"}
                  size="sm"
                  className="h-6 text-[11px]"
                  onClick={() => toggleChannel(id)}
                >
                  {channels.includes(id) ? "✓ " : "+ "}
                  {CHANNEL_CONFIGS[id].label}
                </Button>
              ))}
            </div>
            <div className="flex flex-wrap gap-1 pt-2">
              <span className="text-[10px] text-muted-foreground uppercase tracking-wide self-center">Presets:</span>
              {Object.keys(CHANNEL_PRESETS).map((key) => (
                <Button
                  key={key}
                  variant="outline"
                  size="sm"
                  className="h-6 text-[11px]"
                  onClick={() => applyPreset(key)}
                >
                  {key}
                </Button>
              ))}
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cdp-tags">Hashtags (space or comma-separated)</Label>
            <Input
              id="cdp-tags"
              value={hashtagsText}
              onChange={(e) => setHashtagsText(e.target.value)}
              placeholder="#seo #marketing #freetools"
              className="font-mono text-xs"
            />
            {suggested.length > 0 && (
              <div className="flex flex-wrap items-center gap-1 pt-1">
                <Sparkles className="h-3 w-3 text-muted-foreground" />
                <span className="text-[10px] text-muted-foreground uppercase tracking-wide">Suggested:</span>
                {suggested.map((h) => (
                  <Button
                    key={h}
                    variant="ghost"
                    size="sm"
                    className="h-6 text-[11px]"
                    onClick={() =>
                      setHashtagsText((prev) => (prev ? `${prev} ${h}` : h))
                    }
                  >
                    + {h}
                  </Button>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {snippets.length > 0 ? (
        <>
          <Card>
            <CardContent className="p-4 space-y-2">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <Share2 className="h-4 w-4" /> {snippets.length} snippets across {channels.length} channel(s)
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-xs">
                <Stat label="Total channels" value={stats.totalChannels} />
                <Stat label="Total chars" value={stats.totalChars} />
                <Stat label="Total hashtags" value={stats.totalHashtags} />
                <Stat label="Truncated" value={stats.truncatedCount} highlight={stats.truncatedCount > 0 ? "bad" : undefined} />
                <Stat label="Warnings" value={stats.warningCount} highlight={stats.warningCount > 0 ? "bad" : undefined} />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                  <Hash className="h-4 w-4" /> Snippets ({filtered.length})
                </h3>
                <select
                  value={filterChannel}
                  onChange={(e) => setFilterChannel(e.target.value as ChannelId | "")}
                  className="h-8 text-xs rounded border bg-background px-2"
                >
                  <option value="">All channels</option>
                  {ALL_CHANNEL_IDS.map((id) => (
                    <option key={id} value={id}>{CHANNEL_CONFIGS[id].label}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-2 max-h-[600px] overflow-auto">
                {filtered.map((s) => (
                  <div key={s.channelId} className="rounded border bg-background px-3 py-2 text-xs space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary" className="text-[10px]">{s.channelLabel}</Badge>
                        <Badge variant="outline" className="text-[10px]">{s.charCount}/{s.charLimit}</Badge>
                        {s.hashtagCount > 0 && (
                          <Badge variant="outline" className="text-[10px]">{s.hashtagCount} tags</Badge>
                        )}
                      </div>
                      {s.truncated && (
                        <Badge variant="destructive" className="text-[10px] gap-1">
                          <AlertTriangle className="h-3 w-3" /> truncated
                        </Badge>
                      )}
                    </div>
                    {s.warnings.length > 0 && (
                      <div className="text-[10px] text-amber-600 dark:text-amber-400">
                        {s.warnings.map((w, i) => (<div key={i}>⚠ {w}</div>))}
                      </div>
                    )}
                    <pre className="whitespace-pre-wrap font-mono text-[11px] text-foreground bg-muted/30 p-2 rounded">
                      {s.snippet}
                    </pre>
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
                  filename="content-distribution.txt"
                  mime="text/plain"
                  label="Download .txt"
                />
                <DownloadButton
                  getText={() => csv}
                  filename="content-distribution.csv"
                  mime="text/csv"
                  label="Download CSV"
                />
                <ShareButton getUrl={() => { handleSaveHistory(); return buildShareUrl({ title, description, url, channels, hashtags, cta }); }} />
                <ClearButton onClick={handleClear} />
              </div>
            </CardContent>
          </Card>
        </>
      ) : (
        <EmptyState
          title="Enter content + channels to generate snippets"
          hint="Fill in the title, description, URL, and pick target channels. The tool generates a platform-specific snippet for each channel, respecting character limits and hashtag rules."
          icon={<Share2 className="h-8 w-8" />}
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
                  <Badge variant="outline" className="mr-2">{h.channels.length} channels</Badge>
                  <Badge variant="outline" className="mr-2">{h.totalSnippets} snippets</Badge>
                  <span className="text-muted-foreground">{h.title}</span>
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
            <strong className="text-foreground">Privacy:</strong> All snippet generation runs locally in your browser. History is stored in localStorage on this device only. No content, URLs, or inputs ever leave your device.
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
