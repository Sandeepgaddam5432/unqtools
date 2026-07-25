"use client";

import React, { useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ErrorBanner, EmptyState } from "../../_shared";
import { predictEngagement, validateInput, defaultInput, type EngagementInput } from "./logic";

const POST_TYPES: EngagementInput["postType"][] = ["image", "video", "carousel", "text", "story"];
const NICHES: EngagementInput["accountNiche"][] = ["broad", "niche", "micro-niche"];

const TIER_COLOR: Record<string, string> = {
  low: "border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-400",
  medium: "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400",
  high: "border-blue-500/30 bg-blue-500/10 text-blue-700 dark:text-blue-400",
  viral: "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
};

export default function SocialEngagementPredictor() {
  const [input, setInput] = useState<EngagementInput>(defaultInput());

  const error = useMemo(() => validateInput(input), [input]);
  const result = useMemo(() => (error ? null : predictEngagement(input)), [input, error]);

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Follower count</Label>
              <Input type="number" min={0} value={input.followerCount} onChange={(e) => setInput((s) => ({ ...s, followerCount: parseInt(e.target.value, 10) || 0 }))} className="text-sm font-mono" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Post type</Label>
              <select value={input.postType} onChange={(e) => setInput((s) => ({ ...s, postType: e.target.value as EngagementInput["postType"] }))} className="w-full rounded-md border bg-background px-2 py-1.5 text-sm">
                {POST_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Hashtag count (0-30)</Label>
              <Input type="number" min={0} max={30} value={input.hashtagCount} onChange={(e) => setInput((s) => ({ ...s, hashtagCount: parseInt(e.target.value, 10) || 0, hasHashtags: parseInt(e.target.value, 10) > 0 }))} className="text-sm font-mono" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Caption length</Label>
              <Input type="number" min={0} max={2200} value={input.captionLength} onChange={(e) => setInput((s) => ({ ...s, captionLength: parseInt(e.target.value, 10) || 0 }))} className="text-sm font-mono" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Account niche</Label>
              <select value={input.accountNiche} onChange={(e) => setInput((s) => ({ ...s, accountNiche: e.target.value as EngagementInput["accountNiche"] }))} className="w-full rounded-md border bg-background px-2 py-1.5 text-sm">
                {NICHES.map((n) => <option key={n} value={n}>{n}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-2 items-end">
              <label className="flex items-center gap-1 text-xs">
                <input type="checkbox" checked={input.hasMentions} onChange={(e) => setInput((s) => ({ ...s, hasMentions: e.target.checked }))} />
                Mentions
              </label>
              <label className="flex items-center gap-1 text-xs">
                <input type="checkbox" checked={input.hasEmoji} onChange={(e) => setInput((s) => ({ ...s, hasEmoji: e.target.checked }))} />
                Emoji
              </label>
              <label className="flex items-center gap-1 text-xs">
                <input type="checkbox" checked={input.bestTimePosting} onChange={(e) => setInput((s) => ({ ...s, bestTimePosting: e.target.checked }))} />
                Best time
              </label>
              <label className="flex items-center gap-1 text-xs">
                <input type="checkbox" checked={input.hasCallToAction} onChange={(e) => setInput((s) => ({ ...s, hasCallToAction: e.target.checked }))} />
                CTA
              </label>
            </div>
          </div>
        </CardContent>
      </Card>

      {error && <ErrorBanner message={error} />}

      {result && (
        <>
          <Card>
            <CardContent className="p-4 space-y-2">
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant="outline" className={`text-xs ${TIER_COLOR[result.tier]}`}>Tier: {result.tier}</Badge>
                <Badge variant="outline" className="text-xs">Score: {result.score}/100</Badge>
                <Badge variant="outline" className="text-xs">Engagement rate: {result.engagementRate.toFixed(2)}%</Badge>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <Stat label="Likes" value={result.predictedLikes.toLocaleString()} />
                <Stat label="Comments" value={result.predictedComments.toLocaleString()} />
                <Stat label="Shares" value={result.predictedShares.toLocaleString()} />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 space-y-2">
              <Label className="text-sm font-semibold">Factor breakdown</Label>
              <div className="space-y-1">
                {result.factors.map((f) => (
                  <div key={f.label} className="grid grid-cols-[1fr_80px_60px] gap-2 items-center text-xs py-1 border-b border-border/40 last:border-0">
                    <span>{f.label}</span>
                    <span className="text-muted-foreground">×{f.weight.toFixed(1)}</span>
                    <code className="font-mono text-right">{f.impact.toFixed(2)}</code>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {!result && !error && (
        <EmptyState title="Adjust the inputs" hint="Predicted likes, comments, shares, and a tier score are computed in real time." />
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border bg-muted/30 p-2 text-center">
      <div className="text-[10px] text-muted-foreground">{label}</div>
      <code className="font-mono text-sm">{value}</code>
    </div>
  );
}
