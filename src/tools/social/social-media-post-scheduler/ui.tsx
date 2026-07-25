"use client";

import React, { useState, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ErrorBanner, CopyButton, DownloadButton } from "../../_shared";
import { planWeek, planMulti, bestSlot, toCsv, OPTIMAL_TIMES, PLATFORM_LABELS, type Platform } from "./logic";

const PLATFORMS = Object.keys(PLATFORM_LABELS) as Platform[];

export default function SocialMediaPostScheduler() {
  const [selected, setSelected] = useState<Platform[]>(["instagram", "twitter"]);
  const [maxPosts, setMaxPosts] = useState(3);

  const toggle = (p: Platform) => {
    setSelected((prev) => prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]);
  };

  const posts = useMemo(() => selected.length === 1 ? planWeek(selected[0]!, maxPosts) : planMulti(selected), [selected, maxPosts]);
  const csv = useMemo(() => toCsv(posts), [posts]);
  const best = useMemo(() => (selected.length > 0 ? bestSlot(selected[0]!) : null), [selected]);

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4 space-y-3">
          <Label className="text-xs text-muted-foreground">Select platforms</Label>
          <div className="flex flex-wrap gap-2">
            {PLATFORMS.map((p) => (
              <button
                key={p}
                onClick={() => toggle(p)}
                className={`px-2.5 py-1 rounded-md text-xs font-medium border cursor-pointer ${selected.includes(p) ? "bg-primary text-primary-foreground" : "bg-background hover:bg-muted"}`}
              >
                {PLATFORM_LABELS[p]}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2 text-xs">
            <Label>Max posts per platform</Label>
            <input type="number" min={1} max={5} value={maxPosts} onChange={(e) => setMaxPosts(Number(e.target.value))} className="h-7 w-16 rounded border bg-background px-2 text-xs" />
          </div>
          {selected.length === 0 && <ErrorBanner message="Select at least one platform" />}
        </CardContent>
      </Card>

      {best && (
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-emerald-600">Best slot for {PLATFORM_LABELS[best.platform]}</Badge>
              <span className="text-xs">{best.day} at {best.time}</span>
              <span className="text-xs text-muted-foreground">— {best.reason}</span>
              <div className="ml-auto flex gap-2">
                <CopyButton getText={() => csv} label="Copy CSV" />
                <DownloadButton getText={() => csv} filename="schedule.csv" mime="text/csv" label="Download" />
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-4 space-y-2">
          <p className="text-sm font-semibold">Scheduled posts ({posts.length})</p>
          <div className="space-y-1.5">
            {posts.map((p, i) => (
              <div key={i} className="flex items-center gap-2 text-xs rounded border bg-background px-2 py-1.5">
                <Badge variant="outline" className="text-[10px]">{PLATFORM_LABELS[p.platform]}</Badge>
                <span className="font-mono">{p.day} {p.time}</span>
                <span className="text-muted-foreground">— {p.reason}</span>
              </div>
            ))}
            {posts.length === 0 && <p className="text-xs text-muted-foreground">No posts scheduled.</p>}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4 space-y-2">
          <p className="text-sm font-semibold">Reference: optimal times</p>
          <div className="space-y-1.5 text-xs">
            {PLATFORMS.map((p) => (
              <div key={p} className="rounded border bg-background p-2">
                <Badge variant="outline" className="text-[10px]">{PLATFORM_LABELS[p]}</Badge>
                <span className="ml-2 text-muted-foreground">{OPTIMAL_TIMES[p].map((s) => `${s.day} ${s.time}`).join(" · ")}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card><CardContent className="p-3"><p className="text-xs text-muted-foreground"><strong className="text-foreground">Privacy:</strong> all scheduling runs locally.</p></CardContent></Card>
    </div>
  );
}
