"use client";

import React, { useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ErrorBanner, CopyButton, DownloadButton } from "../../_shared";
import {
  getAllThreadPlatforms,
  getThreadPlatform,
  generateThread,
  validateThread,
  suggestHook,
  suggestCTA,
  exportThreadText,
  exportThreadJSON,
  exportThreadCSV,
  totalThreadChars,
  readingTimeSec,
  longestPost,
  mergeThread,
  optimizePosts,
} from "./logic";

export default function SocialThreadGenerator() {
  const platforms = useMemo(() => getAllThreadPlatforms(), []);
  const [platformId, setPlatformId] = useState<string>("twitter");
  const [text, setText] = useState<string>("Here is a long-form thought about productivity. First, sleep is non-negotiable. Second, deep work blocks beat context switching. Third, ship in public. Fourth, your environment is stronger than your willpower. Fifth, review your week every Friday. Sixth, automate the boring parts. Seventh, write everything down. Eighth, keep a decisions journal. Ninth, favor boring consistency. Tenth, measure what matters.");
  const [hookIdx, setHookIdx] = useState<number>(0);
  const [ctaIdx, setCtaIdx] = useState<number>(0);
  const [error, setError] = useState<string>("");

  const platform = getThreadPlatform(platformId)!;
  const hooks = useMemo(() => suggestHook(""), []);
  const ctas = useMemo(() => suggestCTA(), []);

  const fullText = `${hooks[hookIdx]}\n\n${text}\n\n${ctas[ctaIdx]}`;
  const thread = useMemo(() => generateThread(fullText, platform), [fullText, platform]);
  const optimized = useMemo(() => optimizePosts(thread), [thread]);
  const warnings = useMemo(() => validateThread(optimized, platform), [optimized, platform]);
  const totalChars = totalThreadChars(optimized);
  const longest = longestPost(optimized);
  const readSec = readingTimeSec(optimized);

  return (
    <div className="space-y-4">
      {error && <ErrorBanner message={error} />}

      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Platform</Label>
              <select value={platformId} onChange={(e) => setPlatformId(e.target.value)} className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-xs">
                {platforms.map((p) => (
                  <option key={p.id} value={p.id}>{p.name} ({p.charLimit} chars/post)</option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Topic / Hook</Label>
              <select value={hookIdx} onChange={(e) => setHookIdx(Number(e.target.value))} className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-xs">
                {hooks.map((h, i) => (
                  <option key={i} value={i}>{h}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Thread body</Label>
            <textarea value={text} onChange={(e) => setText(e.target.value)} rows={4} className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-xs" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Closing CTA</Label>
            <select value={ctaIdx} onChange={(e) => setCtaIdx(Number(e.target.value))} className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-xs">
              {ctas.map((c, i) => (
                <option key={i} value={i}>{c}</option>
              ))}
            </select>
          </div>
          <p className="text-[10px] text-muted-foreground">{platform.notes}</p>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div>
              <h3 className="text-base font-semibold">Thread preview ({optimized.length} posts)</h3>
              <p className="text-xs text-muted-foreground">{totalChars} chars total · ~{readSec}s reading time</p>
            </div>
            <div className="flex gap-2 flex-wrap">
              <CopyButton getText={() => exportThreadText(optimized)} label="Copy text" />
              <DownloadButton getText={() => exportThreadCSV(optimized)} filename="thread.csv" mime="text/csv" label="CSV" />
              <DownloadButton getText={() => exportThreadJSON(optimized)} filename="thread.json" mime="application/json" label="JSON" />
            </div>
          </div>
          {warnings.length > 0 && (
            <ul className="text-xs text-amber-700 dark:text-amber-400 list-disc pl-4">
              {warnings.map((w, i) => <li key={i}>{w}</li>)}
            </ul>
          )}
          <div className="space-y-2">
            {optimized.map((p) => (
              <div key={p.index} className="rounded-md border border-border p-2 text-xs">
                <div className="flex items-center justify-between gap-2 mb-1">
                  <Badge variant="outline" className="text-[10px]">{p.index}/{p.total}</Badge>
                  <span className={`text-[10px] ${p.charCount > platform.charLimit ? "text-red-500" : "text-muted-foreground"}`}>{p.charCount} chars</span>
                </div>
                <p className="whitespace-pre-wrap">{p.text}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4 space-y-3">
          <Label className="text-sm font-semibold">Stats &amp; tools</Label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
            <div className="rounded-md border border-border p-2">
              <div className="text-muted-foreground">Posts</div>
              <code className="font-mono">{optimized.length}</code>
            </div>
            <div className="rounded-md border border-border p-2">
              <div className="text-muted-foreground">Longest post</div>
              <code className="font-mono">{longest?.charCount ?? 0}</code>
            </div>
            <div className="rounded-md border border-border p-2">
              <div className="text-muted-foreground">Total chars</div>
              <code className="font-mono">{totalChars}</code>
            </div>
            <div className="rounded-md border border-border p-2">
              <div className="text-muted-foreground">Read time</div>
              <code className="font-mono">{readSec}s</code>
            </div>
          </div>
          <div className="space-y-1 pt-1">
            <Label className="text-xs text-muted-foreground">Merged thread (paste as one block)</Label>
            <pre className="text-xs whitespace-pre-wrap font-mono rounded-md border border-border p-2">{mergeThread(optimized) || "—"}</pre>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
