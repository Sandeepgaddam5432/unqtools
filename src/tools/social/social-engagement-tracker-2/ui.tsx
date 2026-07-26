"use client";

import React, { useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ErrorBanner, CopyButton, DownloadButton } from "../../_shared";
import {
  getAllBenchmarks,
  getBenchmarkById,
  createPost,
  engagementRateByFollowers,
  engagementRateByReach,
  amplificationRate,
  conversationRate,
  saveRate,
  classifyEngagement,
  aggregateStats,
  forecastEngagement,
  validatePost,
  exportPostsCSV,
  compareToBenchmark,
  topPosts,
  buildSummary,
  type EngagementPost,
} from "./logic";

interface DraftPost {
  platform: string;
  likes: string;
  comments: string;
  shares: string;
  saves: string;
  followers: string;
  impressions: string;
}

export default function SocialEngagementTracker2() {
  const benchmarks = useMemo(() => getAllBenchmarks(), []);
  const [posts, setPosts] = useState<EngagementPost[]>([]);
  const [draft, setDraft] = useState<DraftPost>({
    platform: "instagram",
    likes: "100",
    comments: "20",
    shares: "10",
    saves: "5",
    followers: "10000",
    impressions: "20000",
  });
  const [error, setError] = useState<string>("");

  const stats = useMemo(() => aggregateStats(posts), [posts]);
  const forecast = useMemo(() => forecastEngagement(Number(draft.followers) || 0, draft.platform), [draft.followers, draft.platform]);
  const benchmark = getBenchmarkById(draft.platform)!;
  const draftPost = createPost(
    draft.platform,
    Number(draft.likes) || 0,
    Number(draft.comments) || 0,
    Number(draft.shares) || 0,
    Number(draft.saves) || 0,
    Number(draft.followers) || 0,
    Number(draft.impressions) || 0,
  );
  const draftWarnings = validatePost(draftPost);
  const draftER = engagementRateByFollowers(draftPost);
  const draftERR = engagementRateByReach(draftPost);
  const draftClass = classifyEngagement(draftER, draft.platform);
  const draftCompare = compareToBenchmark(draftER, draft.platform);
  const top5 = useMemo(() => topPosts(posts, 5), [posts]);

  const handleAdd = () => {
    if (draftWarnings.length > 0) {
      setError(draftWarnings[0]);
      return;
    }
    setError("");
    setPosts((cur) => [...cur, draftPost]);
  };

  return (
    <div className="space-y-4">
      {error && <ErrorBanner message={error} />}

      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <h3 className="text-base font-semibold">Add a post</h3>
            <div className="flex gap-2 flex-wrap">
              <CopyButton getText={() => buildSummary(posts)} label="Copy summary" disabled={posts.length === 0} />
              <DownloadButton getText={() => exportPostsCSV(posts)} filename="engagement-posts.csv" mime="text/csv" label="CSV" disabled={posts.length === 0} />
            </div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Platform</Label>
              <select value={draft.platform} onChange={(e) => setDraft((d) => ({ ...d, platform: e.target.value }))} className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-xs">
                {benchmarks.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Likes</Label>
              <input type="number" value={draft.likes} onChange={(e) => setDraft((d) => ({ ...d, likes: e.target.value }))} className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-xs" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Comments</Label>
              <input type="number" value={draft.comments} onChange={(e) => setDraft((d) => ({ ...d, comments: e.target.value }))} className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-xs" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Shares</Label>
              <input type="number" value={draft.shares} onChange={(e) => setDraft((d) => ({ ...d, shares: e.target.value }))} className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-xs" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Saves</Label>
              <input type="number" value={draft.saves} onChange={(e) => setDraft((d) => ({ ...d, saves: e.target.value }))} className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-xs" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Followers</Label>
              <input type="number" value={draft.followers} onChange={(e) => setDraft((d) => ({ ...d, followers: e.target.value }))} className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-xs" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Impressions</Label>
              <input type="number" value={draft.impressions} onChange={(e) => setDraft((d) => ({ ...d, impressions: e.target.value }))} className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-xs" />
            </div>
          </div>
          <button onClick={handleAdd} className="px-4 py-1.5 text-xs rounded-md bg-primary text-primary-foreground hover:opacity-90">+ Track post</button>
          <p className="text-[10px] text-muted-foreground">{benchmark.notes}</p>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4 space-y-3">
          <Label className="text-sm font-semibold">Live metrics for current draft</Label>
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-2 text-xs">
            <div className="rounded-md border border-border p-2">
              <div className="text-muted-foreground">ER (followers)</div>
              <code className="font-mono">{draftER.toFixed(2)}%</code>
            </div>
            <div className="rounded-md border border-border p-2">
              <div className="text-muted-foreground">ERR (reach)</div>
              <code className="font-mono">{draftERR.toFixed(2)}%</code>
            </div>
            <div className="rounded-md border border-border p-2">
              <div className="text-muted-foreground">Amplification</div>
              <code className="font-mono">{amplificationRate(draftPost).toFixed(2)}%</code>
            </div>
            <div className="rounded-md border border-border p-2">
              <div className="text-muted-foreground">Conversation</div>
              <code className="font-mono">{conversationRate(draftPost).toFixed(2)}%</code>
            </div>
            <div className="rounded-md border border-border p-2">
              <div className="text-muted-foreground">Save rate</div>
              <code className="font-mono">{saveRate(draftPost).toFixed(2)}%</code>
            </div>
            <div className="rounded-md border border-border p-2">
              <div className="text-muted-foreground">Classification</div>
              <Badge variant="outline" className="text-[10px]">{draftClass.label}</Badge>
            </div>
          </div>
          <div className="text-xs space-y-1">
            <p>Forecast for {Number(draft.followers).toLocaleString()} followers on {benchmark.name}:</p>
            <p className="text-muted-foreground">Expected ~{forecast.expected} engagements · Good: {forecast.good} · Great: {forecast.great}</p>
            <p className="text-muted-foreground">vs avg ({benchmark.avgEngagementRate}%): {draftCompare.delta > 0 ? "+" : ""}{draftCompare.delta.toFixed(2)} pp ({draftCompare.multiplier.toFixed(2)}×)</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4 space-y-3">
          <Label className="text-sm font-semibold">Tracked posts ({posts.length})</Label>
          {posts.length === 0 ? (
            <p className="text-xs text-muted-foreground">No posts tracked yet. Add one above to see aggregate stats.</p>
          ) : (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-2 text-xs">
                <div className="rounded-md border border-border p-2">
                  <div className="text-muted-foreground">Likes</div>
                  <code className="font-mono">{stats.totalLikes}</code>
                </div>
                <div className="rounded-md border border-border p-2">
                  <div className="text-muted-foreground">Comments</div>
                  <code className="font-mono">{stats.totalComments}</code>
                </div>
                <div className="rounded-md border border-border p-2">
                  <div className="text-muted-foreground">Shares</div>
                  <code className="font-mono">{stats.totalShares}</code>
                </div>
                <div className="rounded-md border border-border p-2">
                  <div className="text-muted-foreground">Saves</div>
                  <code className="font-mono">{stats.totalSaves}</code>
                </div>
                <div className="rounded-md border border-border p-2">
                  <div className="text-muted-foreground">Impressions</div>
                  <code className="font-mono">{stats.totalImpressions}</code>
                </div>
                <div className="rounded-md border border-border p-2">
                  <div className="text-muted-foreground">Avg ER</div>
                  <code className="font-mono">{stats.avgEngagementRate.toFixed(2)}%</code>
                </div>
              </div>
              <div className="space-y-1 pt-2">
                <Label className="text-xs text-muted-foreground">Top 5 posts by engagement rate</Label>
                {top5.map((p, i) => (
                  <div key={p.id} className="grid grid-cols-[40px_1fr_80px_80px_60px] gap-2 items-center text-xs py-1 border-b border-border/40 last:border-0">
                    <span className="font-mono text-muted-500">#{i + 1}</span>
                    <span className="text-muted-foreground">{p.platform}</span>
                    <code className="font-mono">{p.likes + p.comments + p.shares + p.saves} eng.</code>
                    <code className="font-mono">{p.impressions} impr.</code>
                    <Badge variant="outline" className="text-[10px] justify-self-end">{engagementRateByFollowers(p).toFixed(2)}%</Badge>
                  </div>
                ))}
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
