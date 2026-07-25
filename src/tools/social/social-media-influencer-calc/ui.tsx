"use client";

import React, { useState, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ErrorBanner, CopyButton, DownloadButton } from "../../_shared";
import { estimateRate, PLATFORM_LABELS, POST_TYPE_LABELS, type Platform, type InfluencerInput } from "./logic";

const PLATFORMS = Object.keys(PLATFORM_LABELS) as Platform[];
const POST_TYPES = Object.keys(POST_TYPE_LABELS) as InfluencerInput["postType"][];

export default function SocialMediaInfluencerCalc() {
  const [followers, setFollowers] = useState(50_000);
  const [engagementPct, setEngagementPct] = useState(3);
  const [platform, setPlatform] = useState<Platform>("instagram");
  const [postType, setPostType] = useState<InfluencerInput["postType"]>("post");

  const result = useMemo(() => estimateRate({ followers, engagementPct, platform, postType }), [followers, engagementPct, platform, postType]);

  const report = useMemo(() => {
    const lines = [
      `Followers: ${followers.toLocaleString()}`,
      `Engagement: ${engagementPct}%`,
      `Platform: ${PLATFORM_LABELS[platform]}`,
      `Post type: ${POST_TYPE_LABELS[postType]}`,
      "",
      `Low: $${result.lowEstimate}`,
      `Mid: $${result.midEstimate}`,
      `High: $${result.highEstimate}`,
      "",
      ...result.notes.map((n) => `→ ${n}`),
    ];
    return lines.join("\n");
  }, [result, followers, engagementPct, platform, postType]);

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <div><Label className="text-[10px] uppercase text-muted-foreground">Followers</Label><Input type="number" value={followers} onChange={(e) => setFollowers(Number(e.target.value))} className="mt-1 h-8 text-xs" /></div>
            <div><Label className="text-[10px] uppercase text-muted-foreground">Engagement %</Label><Input type="number" step="0.1" value={engagementPct} onChange={(e) => setEngagementPct(Number(e.target.value))} className="mt-1 h-8 text-xs" /></div>
            <div>
              <Label className="text-[10px] uppercase text-muted-foreground">Platform</Label>
              <select value={platform} onChange={(e) => setPlatform(e.target.value as Platform)} className="mt-1 h-8 w-full text-xs rounded border bg-background px-2">
                {PLATFORMS.map((p) => <option key={p} value={p}>{PLATFORM_LABELS[p]}</option>)}
              </select>
            </div>
            <div>
              <Label className="text-[10px] uppercase text-muted-foreground">Post type</Label>
              <select value={postType} onChange={(e) => setPostType(e.target.value as InfluencerInput["postType"])} className="mt-1 h-8 w-full text-xs rounded border bg-background px-2">
                {POST_TYPES.map((p) => <option key={p} value={p}>{POST_TYPE_LABELS[p]}</option>)}
              </select>
            </div>
          </div>
          {followers <= 0 && <ErrorBanner message="Followers must be greater than zero." />}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold">Estimated rate per post</p>
            <div className="flex gap-2">
              <CopyButton getText={() => report} label="Copy report" />
              <DownloadButton getText={() => report} filename="influencer-rate.txt" label="Download" />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2 text-xs">
            <Cell label="Low" value={`$${result.lowEstimate}`} />
            <Cell label="Mid" value={`$${result.midEstimate}`} highlight />
            <Cell label="High" value={`$${result.highEstimate}`} />
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
            <Cell label="Base / 1k" value={`$${result.baseRatePerPost}`} />
            <Cell label="Eng mult" value={`${result.engagementMultiplier}×`} />
            <Cell label="Platform mult" value={`${result.platformMultiplier}×`} />
            <Cell label="Post-type mult" value={`${result.postTypeMultiplier}×`} />
          </div>
          <div className="rounded border bg-muted/30 p-2 text-xs space-y-1">
            {result.notes.map((n, i) => <div key={i}>→ {n}</div>)}
          </div>
        </CardContent>
      </Card>

      <Card><CardContent className="p-3"><p className="text-xs text-muted-foreground"><strong className="text-foreground">Privacy:</strong> all estimates run locally in your browser.</p></CardContent></Card>
    </div>
  );
}

function Cell({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className={`rounded border px-2 py-1.5 ${highlight ? "bg-emerald-500/10 border-emerald-500/30" : "bg-background"}`}>
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="font-mono text-sm">{value}</div>
    </div>
  );
}
