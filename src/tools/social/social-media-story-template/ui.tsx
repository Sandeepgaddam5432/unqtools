"use client";

import React, { useState, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ErrorBanner, CopyButton, DownloadButton } from "../../_shared";
import { TEMPLATES, byPlatform, toText, PLATFORM_LABELS, allPlatforms, type Platform, type StoryTemplate } from "./logic";

const PLATFORMS = allPlatforms();

export default function SocialMediaStoryTemplate() {
  const [platform, setPlatform] = useState<Platform>("instagram");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const list = useMemo(() => byPlatform(platform), [platform]);
  const selected = useMemo<StoryTemplate | null>(() => {
    if (!selectedId) return list[0] ?? null;
    return list.find((t) => t.id === selectedId) ?? null;
  }, [list, selectedId]);
  const text = useMemo(() => (selected ? toText(selected) : ""), [selected]);

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4 space-y-3">
          <Label className="text-xs text-muted-foreground">Choose a platform</Label>
          <div className="flex flex-wrap gap-2">
            {PLATFORMS.map((p) => (
              <button
                key={p}
                onClick={() => { setPlatform(p); setSelectedId(null); }}
                className={`px-2.5 py-1 rounded-md text-xs font-medium border cursor-pointer ${platform === p ? "bg-primary text-primary-foreground" : "bg-background hover:bg-muted"}`}
              >
                {PLATFORM_LABELS[p]}
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4 space-y-2">
          <p className="text-sm font-semibold">Templates for {PLATFORM_LABELS[platform]} ({list.length})</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
            {list.map((t) => (
              <button
                key={t.id}
                onClick={() => setSelectedId(t.id)}
                className={`text-left rounded border p-2 text-xs hover:bg-muted/40 ${selected?.id === t.id ? "border-primary" : "bg-background"}`}
              >
                <span className="font-medium">{t.title}</span>
                <span className="ml-2 text-[10px] text-muted-foreground">{t.slides.length} slides · {t.aspectRatio}</span>
              </button>
            ))}
            {list.length === 0 && <p className="text-xs text-muted-foreground">No templates for this platform.</p>}
          </div>
        </CardContent>
      </Card>

      {selected && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center gap-2">
              <p className="text-sm font-semibold">{selected.title}</p>
              <Badge variant="outline" className="text-[10px]">{PLATFORM_LABELS[selected.platform]}</Badge>
              <Badge variant="outline" className="text-[10px]">{selected.aspectRatio}</Badge>
              <Badge variant="outline" className="text-[10px]">{selected.recommendedDuration}s/slide</Badge>
              <div className="ml-auto flex gap-2">
                <CopyButton getText={() => text} label="Copy" />
                <DownloadButton getText={() => text} filename={`story-${selected.id}.txt`} label="Download" />
              </div>
            </div>
            <div className="space-y-1.5">
              {selected.slides.map((s, i) => (
                <div key={i} className="rounded border bg-background px-2 py-1.5 text-xs">
                  <Badge variant="outline" className="text-[10px] mr-2">{i + 1}. {s.kind}</Badge>
                  <span>{s.text}</span>
                </div>
              ))}
            </div>
            <div className="rounded border bg-muted/30 p-2 text-xs space-y-1">
              <p className="font-semibold text-foreground">Tips</p>
              {selected.tips.map((tip, i) => <div key={i}>→ {tip}</div>)}
            </div>
          </CardContent>
        </Card>
      )}

      <Card><CardContent className="p-3"><p className="text-xs text-muted-foreground"><strong className="text-foreground">Privacy:</strong> static reference data; all browsing runs locally.</p></CardContent></Card>
    </div>
  );
}
