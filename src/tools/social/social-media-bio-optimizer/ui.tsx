"use client";

import React, { useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ErrorBanner, CopyButton, DownloadButton } from "../../_shared";
import {
  getAllPlatforms,
  getPlatformById,
  countChars,
  countWords,
  countHashtags,
  countEmojis,
  countLineBreaks,
  countURLs,
  extractKeywords,
  suggestOptimizations,
  optimizeBio,
  splitLines,
  scoreBio,
  exportAnalysisText,
} from "./logic";

export default function SocialMediaBioOptimizer() {
  const platforms = useMemo(() => getAllPlatforms(), []);
  const [platformId, setPlatformId] = useState<string>("instagram");
  const [bio, setBio] = useState<string>("Music producer 🎧 | making beats since 2010\nDM for collabs\n#hiphop #producer");
  const [error, setError] = useState<string>("");

  const platform = getPlatformById(platformId)!;
  const chars = countChars(bio);
  const words = countWords(bio);
  const hashtags = countHashtags(bio);
  const emojis = countEmojis(bio);
  const breaks = countLineBreaks(bio);
  const urls = countURLs(bio);
  const keywords = useMemo(() => extractKeywords(bio, 5), [bio]);
  const tips = useMemo(() => suggestOptimizations(bio, platform), [bio, platform]);
  const optimized = useMemo(() => optimizeBio(bio, platform), [bio, platform]);
  const score = useMemo(() => scoreBio(bio, platform), [bio, platform]);
  const lines = useMemo(() => splitLines(bio), [bio]);

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
                  <option key={p.id} value={p.id}>{p.name} ({p.charLimit} chars)</option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Your bio</Label>
              <textarea value={bio} onChange={(e) => setBio(e.target.value)} rows={3} className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-xs" />
            </div>
          </div>
          <p className="text-[10px] text-muted-foreground">{platform.notes}</p>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <h3 className="text-base font-semibold">Analysis</h3>
            <div className="flex gap-2 flex-wrap">
              <CopyButton getText={() => optimized.optimized} label="Copy optimized" />
              <DownloadButton getText={() => exportAnalysisText(bio, platform)} filename={`bio-analysis-${platform.id}.txt`} label="TXT" />
            </div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-2 text-xs">
            <div className="rounded-md border border-border p-2">
              <div className="text-muted-foreground">Chars</div>
              <code className={`font-mono ${chars > platform.charLimit ? "text-red-500" : ""}`}>{chars} / {platform.charLimit}</code>
            </div>
            <div className="rounded-md border border-border p-2">
              <div className="text-muted-foreground">Words</div>
              <code className="font-mono">{words}</code>
            </div>
            <div className="rounded-md border border-border p-2">
              <div className="text-muted-foreground">Hashtags</div>
              <code className={`font-mono ${hashtags.length > platform.hashtagLimit ? "text-red-500" : ""}`}>{hashtags.length} / {platform.hashtagLimit}</code>
            </div>
            <div className="rounded-md border border-border p-2">
              <div className="text-muted-foreground">Emojis</div>
              <code className="font-mono">{emojis}</code>
            </div>
            <div className="rounded-md border border-border p-2">
              <div className="text-muted-foreground">Line breaks</div>
              <code className="font-mono">{breaks}</code>
            </div>
            <div className="rounded-md border border-border p-2">
              <div className="text-muted-foreground">URLs</div>
              <code className="font-mono">{urls}</code>
            </div>
          </div>
          <div className="space-y-1 pt-1">
            <Label className="text-xs text-muted-foreground">Top keywords</Label>
            <div className="flex flex-wrap gap-1">
              {keywords.length === 0 ? (
                <span className="text-xs text-muted-foreground">No keywords detected — add searchable terms.</span>
              ) : (
                keywords.map((k) => (
                  <Badge key={k.word} variant="outline" className="text-[10px]">{k.word} ×{k.count}</Badge>
                ))
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4 space-y-3">
          <Label className="text-sm font-semibold">Score: {score.score}/100</Label>
          <div className="space-y-1">
            {score.breakdown.map((b) => (
              <div key={b.factor} className="grid grid-cols-[100px_1fr_40px] gap-2 items-center text-xs">
                <span className="text-muted-foreground">{b.factor}</span>
                <div className="h-2 rounded-full bg-muted overflow-hidden">
                  <div className="h-full bg-primary" style={{ width: `${(b.points / 25) * 100}%` }} />
                </div>
                <code className="font-mono text-right">{b.points}</code>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4 space-y-3">
          <Label className="text-sm font-semibold">Suggestions</Label>
          {tips.length === 0 ? (
            <p className="text-xs text-muted-foreground">Looks great — no urgent changes.</p>
          ) : (
            <ul className="text-xs list-disc pl-4 space-y-1">
              {tips.map((t, i) => (
                <li key={i}>{t}</li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4 space-y-3">
          <Label className="text-sm font-semibold">Optimized version (saved {optimized.saved} chars)</Label>
          <pre className="text-xs whitespace-pre-wrap font-mono rounded-md border border-border p-2">{optimized.optimized || "—"}</pre>
          <div className="space-y-1 pt-1">
            <Label className="text-xs text-muted-foreground">Line preview</Label>
            <div className="space-y-0.5 text-xs">
              {lines.map((l, i) => (
                <div key={i} className="font-mono">
                  <span className="text-muted-500">{i + 1}.</span> {l}
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
