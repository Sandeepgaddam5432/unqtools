"use client";

import React, { useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { CopyButton, ErrorBanner, EmptyState } from "../../_shared";
import {
  generateHashtags,
  parseKeywords,
  formatHashtags,
  sortByRelevance,
  defaultOptions,
  PLATFORM_LIMITS,
  type Platform,
  type HashtagOptions,
} from "./logic";

const PLATFORMS: Platform[] = ["instagram", "twitter", "linkedin", "tiktok", "facebook"];

export default function SocialHashtagGenerator() {
  const [text, setText] = useState("");
  const [opts, setOpts] = useState<HashtagOptions>(defaultOptions());

  const keywords = useMemo(() => parseKeywords(text), [text]);
  const tags = useMemo(() => {
    if (keywords.length === 0) return [];
    return sortByRelevance(generateHashtags(keywords, opts), keywords);
  }, [keywords, opts]);

  const limit = PLATFORM_LIMITS[opts.platform];
  const formatted = useMemo(() => formatHashtags(tags, " "), [tags]);

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="space-y-1">
            <Label htmlFor="kw" className="text-xs text-muted-foreground">Keywords (comma, space, or newline separated)</Label>
            <Textarea
              id="kw"
              placeholder={"yoga, fitness, wellness\nmindfulness"}
              value={text}
              onChange={(e) => setText(e.target.value)}
              className="font-mono text-sm min-h-[80px]"
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Platform</Label>
              <select
                value={opts.platform}
                onChange={(e) => setOpts((s) => ({ ...s, platform: e.target.value as Platform }))}
                className="w-full rounded-md border bg-background px-2 py-1.5 text-sm"
              >
                {PLATFORMS.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <div className="flex flex-col justify-end gap-2">
              <label className="flex items-center gap-2 text-xs">
                <input type="checkbox" checked={opts.includeTrending} onChange={(e) => setOpts((s) => ({ ...s, includeTrending: e.target.checked }))} />
                Include trending
              </label>
              <label className="flex items-center gap-2 text-xs">
                <input type="checkbox" checked={opts.includeNiche} onChange={(e) => setOpts((s) => ({ ...s, includeNiche: e.target.checked }))} />
                Include niche variations
              </label>
              <label className="flex items-center gap-2 text-xs">
                <input type="checkbox" checked={opts.camelCase} onChange={(e) => setOpts((s) => ({ ...s, camelCase: e.target.checked }))} />
                CamelCase
              </label>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-xs">{tags.length}/{limit.maxHashtags} tags</Badge>
            <Badge variant="outline" className="text-xs">Recommended: {limit.recommended}</Badge>
          </div>
        </CardContent>
      </Card>

      {tags.length === 0 && text.trim() && (
        <ErrorBanner message="No hashtags generated. Try different keywords or enable niche/trending options." />
      )}

      {tags.length > 0 && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-semibold">Generated hashtags</Label>
              <CopyButton getText={() => formatted} />
            </div>
            <div className="rounded-md border bg-muted/30 p-3 text-sm font-mono break-all">
              {formatted}
            </div>
            <div className="flex flex-wrap gap-1">
              {tags.map((t) => (
                <Badge key={t} variant="outline" className="text-[10px]">#{t}</Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {!text.trim() && (
        <EmptyState
          title="Enter keywords to generate hashtags"
          hint="Pick a platform to enforce its hashtag limits. Optional trending and niche variations expand your set."
        />
      )}
    </div>
  );
}
