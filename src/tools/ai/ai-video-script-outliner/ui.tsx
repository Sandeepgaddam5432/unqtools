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
  PLATFORM_LABELS,
  TONE_LABELS,
  LENGTH_LABELS,
  PLATFORM_DURATIONS,
  HOOK_LABELS,
  SAMPLE_TOPICS,
  DEFAULT_WPM,
  MIN_WPM,
  MAX_WPM,
  normalizeTopic,
  detectPlatform,
  suggestTone,
  formatTimestamp,
  generateScript,
  chooseHook,
  getChosenHook,
  repurposeToShorts,
  planSeries,
  computeStats,
  renderMarkdown,
  renderTeleprompter,
  renderText,
  renderJson,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  type Platform,
  type Tone,
  type LengthPreset,
  type VideoScript,
  type HistoryEntry,
} from "./logic";
import {
  Video, History, Sparkles, Scissors, RefreshCw, Clapperboard,
} from "lucide-react";

export default function AiVideoScriptOutliner() {
  const [topic, setTopic] = useState("");
  const [platform, setPlatform] = useState<Platform>("youtube-long");
  const [tone, setTone] = useState<Tone>("casual");
  const [length, setLength] = useState<LengthPreset>("medium");
  const [wpm, setWpm] = useState(DEFAULT_WPM);
  const [script, setScript] = useState<VideoScript | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  useEffect(() => {
    setHistory(loadHistory());
    if (typeof window !== "undefined" && window.location.hash) {
      const s = parseShareUrl(window.location.hash);
      if (s.topic) {
        setTopic(s.topic);
        setPlatform(s.platform);
        setTone(s.tone);
        setLength(s.length);
        setWpm(s.wpm);
        toast.info("Loaded from share link");
      }
    }
  }, []);

  const detectedPlatform = useMemo(
    () => (topic ? detectPlatform(topic) : null),
    [topic],
  );
  const detectedTone = useMemo(
    () => (topic ? suggestTone(topic) : null),
    [topic],
  );

  const targetSeconds = PLATFORM_DURATIONS[platform][length];
  const stats = useMemo(() => (script ? computeStats(script) : null), [script]);
  const shorts = useMemo(() => (script ? repurposeToShorts(script) : []), [script]);
  const series = useMemo(
    () => (script ? planSeries(script.topic, platform, tone) : []),
    [script, platform, tone],
  );

  const handleGenerate = useCallback(() => {
    const t = normalizeTopic(topic);
    if (!t) {
      toast.error("Enter a topic first");
      return;
    }
    const s = generateScript(t, platform, tone, length, wpm);
    if (!s) {
      toast.error("Could not generate script");
      return;
    }
    setScript(s);
    saveHistory({
      ts: Date.now(),
      topic: t,
      platform,
      tone,
      length,
      targetSeconds: s.targetSeconds,
      sceneCount: s.scenes.length,
    });
    setHistory(loadHistory());
    toast.success(`Generated ${PLATFORM_LABELS[platform]} script with ${s.scenes.length} scenes`);
  }, [topic, platform, tone, length, wpm]);

  const handleClear = useCallback(() => {
    setTopic("");
    setScript(null);
    toast.info("Cleared");
  }, []);

  const handleClearHistory = useCallback(() => {
    clearHistory();
    setHistory([]);
    toast.success("History cleared");
  }, []);

  const handleSwitchHook = useCallback((hookId: string) => {
    setScript((prev) => (prev ? chooseHook(prev, hookId) : prev));
  }, []);

  const markdown = useMemo(() => (script ? renderMarkdown(script) : ""), [script]);
  const teleprompter = useMemo(() => (script ? renderTeleprompter(script) : ""), [script]);
  const text = useMemo(() => (script ? renderText(script) : ""), [script]);
  const json = useMemo(() => (script ? renderJson(script) : ""), [script]);

  return (
    <div className="space-y-4 unq-animate-fade-in-up">
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="vso-topic">Topic</Label>
            <Textarea
              id="vso-topic"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder={"How to start a podcast in 2025 with under $100"}
              className="min-h-[60px] resize-y text-sm"
            />
            <div className="flex flex-wrap gap-1">
              {SAMPLE_TOPICS.slice(0, 6).map((t) => (
                <Button
                  key={t}
                  variant="ghost"
                  size="sm"
                  className="h-6 text-[11px] max-w-[280px] truncate"
                  onClick={() => setTopic(t)}
                  title={t}
                >+ {t.slice(0, 36)}…</Button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
            <Field label="Platform">
              <select
                value={platform}
                onChange={(e) => setPlatform(e.target.value as Platform)}
                className="h-9 w-full text-xs rounded border bg-background px-2"
              >
                {(Object.keys(PLATFORM_LABELS) as Platform[]).map((p) => (
                  <option key={p} value={p}>{PLATFORM_LABELS[p]}</option>
                ))}
              </select>
            </Field>
            <Field label="Tone">
              <select
                value={tone}
                onChange={(e) => setTone(e.target.value as Tone)}
                className="h-9 w-full text-xs rounded border bg-background px-2"
              >
                {(Object.keys(TONE_LABELS) as Tone[]).map((t) => (
                  <option key={t} value={t}>{TONE_LABELS[t]}</option>
                ))}
              </select>
            </Field>
            <Field label="Length">
              <select
                value={length}
                onChange={(e) => setLength(e.target.value as LengthPreset)}
                className="h-9 w-full text-xs rounded border bg-background px-2"
              >
                {(Object.keys(LENGTH_LABELS) as LengthPreset[]).map((l) => (
                  <option key={l} value={l}>
                    {LENGTH_LABELS[l]} ({formatTimestamp(PLATFORM_DURATIONS[platform][l])})
                  </option>
                ))}
              </select>
            </Field>
            <Field label={`WPM (${MIN_WPM}–${MAX_WPM})`}>
              <Input
                type="number"
                min={MIN_WPM}
                max={MAX_WPM}
                value={wpm}
                onChange={(e) => {
                  const v = Number(e.target.value);
                  if (Number.isFinite(v)) setWpm(Math.max(MIN_WPM, Math.min(MAX_WPM, v)));
                }}
                className="h-9 text-xs"
              />
            </Field>
          </div>

          {(detectedPlatform && detectedPlatform !== platform) || (detectedTone && detectedTone !== tone) ? (
            <div className="text-xs text-muted-foreground space-y-0.5">
              {detectedPlatform && detectedPlatform !== platform && (
                <div>
                  Detected platform:{" "}
                  <button className="underline hover:text-primary" onClick={() => setPlatform(detectedPlatform)}>
                    {PLATFORM_LABELS[detectedPlatform]}
                  </button>
                </div>
              )}
              {detectedTone && detectedTone !== tone && (
                <div>
                  Detected tone:{" "}
                  <button className="underline hover:text-primary" onClick={() => setTone(detectedTone)}>
                    {TONE_LABELS[detectedTone]}
                  </button>
                </div>
              )}
            </div>
          ) : null}

          <div className="flex flex-wrap gap-2 pt-1">
            <RunButton onClick={handleGenerate} label="Generate script" />
            <ClearButton onClick={handleClear} disabled={!topic && !script} />
          </div>
        </CardContent>
      </Card>

      {script && stats ? (
        <>
          <Card>
            <CardContent className="p-4 space-y-2">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <Video className="h-4 w-4" /> {PLATFORM_LABELS[script.platform]} · {formatTimestamp(stats.totalSeconds)} · {stats.totalScenes} scenes · ~{stats.wordEstimate} words
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                <Stat label="Target duration" value={formatTimestamp(script.targetSeconds)} />
                <Stat label="Scenes" value={stats.totalScenes} />
                <Stat label="B-roll cues" value={stats.totalBrollCues} />
                <Stat label="Hook variants" value={stats.hookVariantCount} />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 space-y-3">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <Sparkles className="h-4 w-4" /> Hook
              </h3>
              <div className="rounded border bg-background p-3">
                <Badge variant="secondary" className="text-[10px] mb-2">
                  {HOOK_LABELS[getChosenHook(script)?.style ?? "question"]}
                </Badge>
                <p className="text-sm font-medium text-foreground">{getChosenHook(script)?.text}</p>
              </div>
              {script.hookVariants.length > 1 && (
                <div className="space-y-1.5">
                  <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
                    Switch hook variant
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {script.hookVariants.map((h) => (
                      <Button
                        key={h.id}
                        size="sm"
                        variant={h.id === script.chosenHookId ? "default" : "outline"}
                        className="h-7 text-[11px] gap-1"
                        onClick={() => handleSwitchHook(h.id)}
                      >
                        <RefreshCw className="h-3 w-3" />
                        {HOOK_LABELS[h.style]}
                      </Button>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 space-y-3">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <Clapperboard className="h-4 w-4" /> Scenes
              </h3>
              <div className="space-y-2 max-h-[600px] overflow-auto">
                {script.scenes.map((s) => (
                  <div key={s.id} className="rounded border bg-background p-3 space-y-1.5">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant="secondary" className="text-[10px] font-mono">
                        {formatTimestamp(s.startSeconds)}–{formatTimestamp(s.endSeconds)}
                      </Badge>
                      <span className="text-xs font-medium text-foreground">{s.label}</span>
                    </div>
                    <ul className="text-xs text-muted-foreground space-y-0.5 ml-2">
                      {s.talkingPoints.map((tp, i) => (
                        <li key={i}>• {tp}</li>
                      ))}
                    </ul>
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {s.onScreenText.map((t, i) => (
                        <Badge key={`ot-${i}`} variant="outline" className="text-[10px] font-mono">
                          {t}
                        </Badge>
                      ))}
                    </div>
                    <div className="text-[10px] text-muted-foreground space-y-0.5">
                      {s.brollCues.map((b, i) => (
                        <div key={`br-${i}`}>🎥 {b}</div>
                      ))}
                    </div>
                    {s.retentionTip && (
                      <p className="text-[11px] italic text-amber-700 dark:text-amber-300 pt-1">
                        ⚠ {s.retentionTip}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 space-y-2">
              <h3 className="text-sm font-semibold text-foreground">CTA</h3>
              <p className="text-sm text-foreground">{script.cta}</p>
              {script.retentionTips.length > 0 && (
                <>
                  <h4 className="text-xs uppercase tracking-wide text-muted-foreground pt-2">
                    Retention-curve tips
                  </h4>
                  <ul className="text-xs text-muted-foreground space-y-0.5 ml-2">
                    {script.retentionTips.map((tip, i) => (
                      <li key={i}>• {tip}</li>
                    ))}
                  </ul>
                </>
              )}
            </CardContent>
          </Card>

          {shorts.length > 0 && (
            <Card>
              <CardContent className="p-4 space-y-2">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                  <Scissors className="h-4 w-4" /> Repurpose to Shorts ({shorts.length})
                </h3>
                <div className="space-y-2">
                  {shorts.map((sh, i) => (
                    <div key={i} className="rounded border bg-background p-2 text-xs space-y-1">
                      <div className="font-medium text-foreground">{sh.title}</div>
                      <div className="text-muted-foreground"><strong>Hook:</strong> {sh.hook}</div>
                      <div className="text-muted-foreground"><strong>Beat:</strong> {sh.beat}</div>
                      <div className="text-muted-foreground"><strong>CTA:</strong> {sh.cta}</div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {series.length > 0 && (
            <Card>
              <CardContent className="p-4 space-y-2">
                <h3 className="text-sm font-semibold text-foreground">Series plan (3 episodes)</h3>
                <div className="space-y-1.5">
                  {series.map((ep) => (
                    <div key={ep.episode} className="rounded border bg-background p-2 text-xs">
                      <div className="font-medium text-foreground">
                        Ep {ep.episode}: {ep.title}
                      </div>
                      <div className="text-muted-foreground">{ep.summary}</div>
                      <div className="text-muted-foreground italic">Hook: {ep.hook}</div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardContent className="p-4">
              <div className="flex flex-wrap gap-2">
                <CopyButton getText={() => markdown} label="Copy Markdown" />
                <DownloadButton getText={() => markdown} filename="video-script.md" mime="text/markdown" label="Download .md" />
                <CopyButton getText={() => teleprompter} label="Copy teleprompter" successLabel="Copied!" />
                <DownloadButton getText={() => teleprompter} filename="video-script-teleprompter.txt" mime="text/plain" label="Teleprompter .txt" />
                <CopyButton getText={() => text} label="Copy text" successLabel="Copied text!" />
                <DownloadButton getText={() => json} filename="video-script.json" mime="application/json" label="JSON" />
                <ShareButton getUrl={() => buildShareUrl({ topic, platform, tone, length, wpm })} />
              </div>
            </CardContent>
          </Card>
        </>
      ) : (
        <EmptyState
          title="Enter a topic to generate a video script outline"
          hint="Pick a platform (YouTube long-form, Shorts, TikTok, Reels, or explainer), a tone, and a length. The tool generates hook variants, scene-by-scene beats with timestamps, on-screen text and B-roll cues, retention-curve tips, and a CTA — all offline."
          icon={<Video className="h-8 w-8" />}
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
                  <Badge variant="outline" className="mr-2 text-[10px]">{PLATFORM_LABELS[h.platform]}</Badge>
                  <Badge variant="outline" className="mr-2 text-[10px]">{formatTimestamp(h.targetSeconds)}</Badge>
                  <Badge variant="outline" className="mr-2 text-[10px]">{h.sceneCount} scenes</Badge>
                  <span className="text-muted-foreground">{h.topic}</span>
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
            <strong className="text-foreground">Privacy + honesty:</strong> All generation runs locally. Scripts are drafts — verify facts and add your own voice before recording. History is stored in localStorage on this device only.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <Label className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}

function Stat({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) {
  return (
    <div className="rounded border bg-background px-3 py-2">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="text-base font-semibold text-foreground">{value}</div>
    </div>
  );
}
