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
  PLATFORMS,
  PLATFORM_LABELS,
  MODES,
  MODE_LABELS,
  CHAR_LIMITS,
  OPTIMAL_RANGES,
  buildResult,
  renderText,
  renderCsv,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  type Platform,
  type Mode,
  type HistoryEntry,
} from "./logic";
import {
  Gauge, Hash, AtSign, Link2, Smile, Type, History,
  CheckCircle2, AlertCircle, AlertTriangle, Eye, Scissors, Clock,
} from "lucide-react";

export default function SocialMediaCharacterCounter() {
  const [text, setText] = useState<string>("");
  const [platform, setPlatform] = useState<Platform>("twitter");
  const [mode, setMode] = useState<Mode>("post");
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [showPreview, setShowPreview] = useState<boolean>(false);

  useEffect(() => {
    setHistory(loadHistory());
    if (typeof window !== "undefined" && window.location.hash) {
      const p = parseShareUrl(window.location.hash);
      if (p.text) setText(p.text);
      setPlatform(p.platform);
      setMode(p.mode);
      if (window.location.hash.length > 1) toast.info("Loaded from share link");
    }
  }, []);

  const result = useMemo(
    () => buildResult({ text, platform, mode }),
    [text, platform, mode],
  );
  const textReport = useMemo(() => renderText(result), [result]);
  const csv = useMemo(() => renderCsv(result), [result]);

  const handleSaveHistory = useCallback(() => {
    if (text.trim().length > 0) {
      saveHistory({
        ts: Date.now(),
        text,
        platform,
        mode,
        charCount: result.charCount,
      });
      setHistory(loadHistory());
    }
  }, [text, platform, mode, result.charCount]);

  const handleClear = useCallback(() => {
    setText("");
    setPlatform("twitter");
    setMode("post");
    toast.info("Cleared");
  }, []);

  const handleClearHistory = useCallback(() => {
    clearHistory();
    setHistory([]);
    toast.success("History cleared");
  }, []);

  const loadFromHistory = (h: HistoryEntry) => {
    setText(h.text);
    setPlatform(h.platform);
    setMode(h.mode);
    toast.info("Loaded from history");
  };

  const limitColor =
    result.overLimit
      ? "text-red-600 dark:text-red-400"
      : result.inOptimalRange
        ? "text-emerald-600 dark:text-emerald-400"
        : result.remaining < 20
          ? "text-amber-600 dark:text-amber-400"
          : "text-foreground";

  const progressBar =
    result.overLimit
      ? "bg-red-500"
      : result.inOptimalRange
        ? "bg-emerald-500"
        : "bg-primary";

  const fillPct = Math.min(100, Math.round((result.charCount / result.limit) * 100));

  return (
    <div className="space-y-4 unq-animate-fade-in-up">
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="smcc-platform" className="text-xs">Platform</Label>
              <select
                id="smcc-platform"
                value={platform}
                onChange={(e) => setPlatform(e.target.value as Platform)}
                className="h-9 w-full rounded border bg-background px-2 text-sm"
              >
                {PLATFORMS.map((p) => (
                  <option key={p} value={p}>
                    {PLATFORM_LABELS[p]} — {CHAR_LIMITS[p][mode]} chars
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="smcc-mode" className="text-xs">Mode</Label>
              <select
                id="smcc-mode"
                value={mode}
                onChange={(e) => setMode(e.target.value as Mode)}
                className="h-9 w-full rounded border bg-background px-2 text-sm"
              >
                {MODES.map((m) => (
                  <option key={m} value={m}>
                    {MODE_LABELS[m]} — {CHAR_LIMITS[platform][m]} chars
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-1">
            <Label htmlFor="smcc-text" className="text-xs">Your text</Label>
            <Textarea
              id="smcc-text"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Type or paste your post here…"
              className="min-h-[140px] resize-y font-mono text-sm"
            />
          </div>

          <div className="flex flex-wrap gap-2 items-center text-xs">
            <Badge variant="outline" className="text-[10px]">
              {PLATFORM_LABELS[platform]} {MODE_LABELS[mode]}
            </Badge>
            <Badge variant="outline" className="text-[10px]">
              Optimal: {result.optimalRange.min}–{result.optimalRange.max}
            </Badge>
            <label className="flex items-center gap-1 ml-auto cursor-pointer">
              <input
                type="checkbox"
                checked={showPreview}
                onChange={(e) => setShowPreview(e.target.checked)}
              />
              <Eye className="h-3 w-3" /> Live preview
            </label>
          </div>
        </CardContent>
      </Card>

      {text.length > 0 ? (
        <>
          <Card>
            <CardContent className="p-4 space-y-3">
              <div className="flex flex-wrap items-baseline gap-3">
                <div className={`text-4xl font-bold tabular-nums ${limitColor}`}>
                  {result.charCount}
                </div>
                <div className="text-sm text-muted-foreground">
                  / {result.limit} chars
                </div>
                <div className={`text-sm font-medium ${limitColor} ml-auto`}>
                  {result.remaining >= 0
                    ? `${result.remaining} remaining`
                    : `${-result.remaining} over limit`}
                </div>
              </div>
              <div className="h-2 rounded-full bg-muted overflow-hidden">
                <div
                  className={`h-full transition-all ${progressBar}`}
                  style={{ width: `${fillPct}%` }}
                />
              </div>
              <div className="flex items-center gap-2 text-xs">
                {result.overLimit ? (
                  <Badge variant="destructive" className="gap-1">
                    <AlertTriangle className="h-3 w-3" /> Exceeded limit
                  </Badge>
                ) : result.inOptimalRange ? (
                  <Badge variant="default" className="gap-1 bg-emerald-600 hover:bg-emerald-600">
                    <CheckCircle2 className="h-3 w-3" /> In optimal range
                  </Badge>
                ) : result.lengthStatus === "under" ? (
                  <Badge variant="secondary" className="gap-1">
                    <AlertCircle className="h-3 w-3" /> Under optimal length
                  </Badge>
                ) : (
                  <Badge variant="secondary" className="gap-1">
                    <AlertCircle className="h-3 w-3" /> Over optimal length
                  </Badge>
                )}
                <span className="text-muted-foreground ml-auto">
                  Status: {result.lengthStatus}
                </span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 space-y-3">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <Gauge className="h-4 w-4" /> Metrics
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                <Stat icon={<Type className="h-3 w-3" />} label="Characters" value={result.charCount} />
                <Stat icon={<Type className="h-3 w-3" />} label="Graphemes" value={result.graphemeCount} />
                <Stat icon={<Type className="h-3 w-3" />} label="Words" value={result.wordCount} />
                <Stat icon={<Clock className="h-3 w-3" />} label="Read (sec)" value={result.readingTimeSec} />
                <Stat icon={<Hash className="h-3 w-3" />} label="Hashtags" value={result.hashtagCount} />
                <Stat icon={<AtSign className="h-3 w-3" />} label="Mentions" value={result.mentionCount} />
                <Stat icon={<Link2 className="h-3 w-3" />} label="URLs" value={result.urlCount} />
                <Stat icon={<Smile className="h-3 w-3" />} label="Emojis" value={result.emojiCount} />
              </div>

              {(result.hashtags.length > 0 || result.mentions.length > 0 || result.urls.length > 0) && (
                <div className="space-y-1 pt-1">
                  {result.hashtags.length > 0 && (
                    <div>
                      <span className="text-[10px] uppercase tracking-wide text-muted-foreground">Hashtags</span>
                      <div className="flex flex-wrap gap-1 mt-0.5">
                        {result.hashtags.map((h, i) => (
                          <Badge key={i} variant="outline" className="text-[10px] font-mono">{h}</Badge>
                        ))}
                      </div>
                    </div>
                  )}
                  {result.mentions.length > 0 && (
                    <div>
                      <span className="text-[10px] uppercase tracking-wide text-muted-foreground">Mentions</span>
                      <div className="flex flex-wrap gap-1 mt-0.5">
                        {result.mentions.map((m, i) => (
                          <Badge key={i} variant="outline" className="text-[10px] font-mono">{m}</Badge>
                        ))}
                      </div>
                    </div>
                  )}
                  {result.urls.length > 0 && (
                    <div>
                      <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
                        URLs {platform === "twitter" ? "(counted as 23 chars each)" : ""}
                      </span>
                      <div className="space-y-0.5 mt-0.5">
                        {result.urls.map((u, i) => (
                          <div key={i} className="text-[10px] font-mono text-muted-foreground truncate">
                            {u}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {result.overLimit && (
                <div className="rounded border border-blue-300 dark:border-blue-700 bg-blue-50 dark:bg-blue-950/30 px-3 py-2 text-xs space-y-1">
                  <div className="flex items-center gap-1.5 font-medium text-blue-700 dark:text-blue-400">
                    <Scissors className="h-3.5 w-3.5" /> Auto-truncated to fit ({result.limit} chars)
                  </div>
                  <pre className="font-mono text-[11px] whitespace-pre-wrap break-words text-foreground">
{result.truncated}
                  </pre>
                </div>
              )}

              {showPreview && (
                <div className="rounded border bg-background px-3 py-2 text-xs space-y-1">
                  <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Live preview</div>
                  <div className="whitespace-pre-wrap break-words text-foreground">
                    {text}
                  </div>
                </div>
              )}

              <div className="flex flex-wrap gap-2 pt-2">
                <CopyButton
                  getText={() => { handleSaveHistory(); return textReport; }}
                  label="Copy report"
                />
                <DownloadButton
                  getText={() => { handleSaveHistory(); return textReport; }}
                  filename={`char-counter-${platform}-${mode}.txt`}
                  mime="text/plain"
                  label="Download .txt"
                />
                <DownloadButton
                  getText={() => csv}
                  filename={`char-counter-${platform}-${mode}.csv`}
                  mime="text/csv"
                  label="Download CSV"
                />
                <ShareButton getUrl={() => { handleSaveHistory(); return buildShareUrl({ text, platform, mode }); }} />
                <ClearButton onClick={handleClear} />
              </div>
            </CardContent>
          </Card>
        </>
      ) : (
        <EmptyState
          title="Type or paste your text to count characters"
          hint="Pick a platform and mode above to see the per-platform char limit. The counter is Unicode-aware — emojis count as 2 chars per Twitter spec, and URLs are counted as 23 chars on Twitter (t.co shortening)."
          icon={<Gauge className="h-8 w-8" />}
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
                  onClick={() => loadFromHistory(h)}
                  className="w-full text-left rounded border bg-background px-3 py-2 text-xs hover:bg-muted/50"
                >
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-[10px]">{h.charCount} chars</Badge>
                    <Badge variant="outline" className="text-[10px]">
                      {PLATFORM_LABELS[h.platform]} {MODE_LABELS[h.mode]}
                    </Badge>
                    <span className="text-muted-foreground ml-auto">{new Date(h.ts).toLocaleString()}</span>
                  </div>
                  <div className="mt-1 truncate font-mono text-[11px] text-foreground">
                    {h.text}
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
            <strong className="text-foreground">Privacy:</strong> All counting runs locally in your browser. Recent texts are stored in localStorage on this device only — nothing is uploaded.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function Stat({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
}) {
  return (
    <div className="rounded border bg-background px-3 py-2">
      <div className="flex items-center gap-1 text-[10px] uppercase tracking-wide text-muted-foreground">
        {icon}
        {label}
      </div>
      <div className="text-base font-semibold tabular-nums text-foreground">{value}</div>
    </div>
  );
}
