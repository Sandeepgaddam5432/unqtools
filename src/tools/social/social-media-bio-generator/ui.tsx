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
} from "../../_shared";
import { toast } from "sonner";
import {
  TONES,
  PLATFORMS,
  TONE_LABELS,
  PLATFORM_LABELS,
  PLATFORM_CONFIGS,
  generateBio,
  generateAll,
  getCharLimitStatus,
  computeStats,
  renderText,
  renderCsv,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  type Tone,
  type Platform,
  type GeneratedBio,
  type HistoryEntry,
} from "./logic";
import { History, UserSquare, Type, Smile, Megaphone, Link2 } from "lucide-react";

export default function SocialMediaBioGenerator() {
  const [name, setName] = useState("");
  const [profession, setProfession] = useState("");
  const [interests, setInterests] = useState("");
  const [location, setLocation] = useState("");
  const [website, setWebsite] = useState("");
  const [tone, setTone] = useState<Tone>("professional");
  const [platforms, setPlatforms] = useState<Platform[]>(["twitter", "instagram"]);
  const [includeEmojis, setIncludeEmojis] = useState(false);
  const [includeCTA, setIncludeCTA] = useState(true);
  const [pronouns, setPronouns] = useState("");
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  useEffect(() => {
    setHistory(loadHistory());
    if (typeof window !== "undefined" && window.location.hash) {
      const p = parseShareUrl(window.location.hash);
      if (p.name) setName(p.name);
      if (p.profession) setProfession(p.profession);
      if (p.interests) setInterests(p.interests);
      if (p.location) setLocation(p.location);
      if (p.website) setWebsite(p.website);
      setTone(p.tone);
      if (p.platforms.length > 0) setPlatforms(p.platforms);
      setIncludeEmojis(p.includeEmojis);
      setIncludeCTA(p.includeCTA);
      if (p.pronouns) setPronouns(p.pronouns);
      if (p.name || p.platforms.length > 0) toast.info("Loaded from share link");
    }
  }, []);

  const input = useMemo(
    () => ({
      name,
      profession,
      interests,
      location,
      website,
      tone,
      platforms,
      includeEmojis,
      includeCTA,
      pronouns,
    }),
    [name, profession, interests, location, website, tone, platforms, includeEmojis, includeCTA, pronouns],
  );

  const allBios = useMemo(() => {
    if (!name.trim() && !profession.trim()) return [];
    return generateAll(input);
  }, [input, name, profession]);

  const stats = useMemo(() => computeStats(allBios), [allBios]);
  const textReport = useMemo(() => renderText(allBios), [allBios]);
  const csv = useMemo(() => renderCsv(allBios), [allBios]);

  const handleSaveHistory = useCallback(() => {
    if (allBios.length > 0) {
      saveHistory({
        ts: Date.now(),
        name,
        profession,
        platforms,
        tone,
        totalBios: allBios.length,
      });
      setHistory(loadHistory());
    }
  }, [allBios, name, profession, platforms, tone]);

  const togglePlatform = (p: Platform) => {
    setPlatforms((prev) =>
      prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p],
    );
  };

  const handleClear = useCallback(() => {
    setName("");
    setProfession("");
    setInterests("");
    setLocation("");
    setWebsite("");
    setTone("professional");
    setPlatforms(["twitter", "instagram"]);
    setIncludeEmojis(false);
    setIncludeCTA(true);
    setPronouns("");
    toast.info("Cleared");
  }, []);

  const handleClearHistory = useCallback(() => {
    clearHistory();
    setHistory([]);
    toast.success("History cleared");
  }, []);

  const hasInput = (name.trim() || profession.trim()) && platforms.length > 0;

  // Group bios by platform
  const biosByPlatform = useMemo(() => {
    const m = new Map<Platform, GeneratedBio[]>();
    for (const b of allBios) {
      if (!m.has(b.platform)) m.set(b.platform, []);
      m.get(b.platform)!.push(b);
    }
    return m;
  }, [allBios]);

  return (
    <div className="space-y-4 unq-animate-fade-in-up">
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="bio-name">Name</Label>
              <Input
                id="bio-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Jane Doe"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="bio-profession">Profession</Label>
              <Input
                id="bio-profession"
                value={profession}
                onChange={(e) => setProfession(e.target.value)}
                placeholder="Software Engineer"
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="bio-interests">Interests (comma-separated)</Label>
            <Textarea
              id="bio-interests"
              value={interests}
              onChange={(e) => setInterests(e.target.value)}
              placeholder="coding, coffee, photography"
              className="min-h-[60px] resize-y text-sm"
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="bio-location">Location (optional)</Label>
              <Input
                id="bio-location"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="San Francisco"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="bio-website">Website (optional)</Label>
              <Input
                id="bio-website"
                value={website}
                onChange={(e) => setWebsite(e.target.value)}
                placeholder="https://example.com"
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="bio-pronouns">Pronouns (optional, e.g. she/her)</Label>
            <Input
              id="bio-pronouns"
              value={pronouns}
              onChange={(e) => setPronouns(e.target.value)}
              placeholder="she/her, he/him, they/them"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Tone</Label>
            <div className="flex flex-wrap gap-2">
              {TONES.map((t) => (
                <Button
                  key={t}
                  variant={tone === t ? "default" : "outline"}
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => setTone(t)}
                >
                  {TONE_LABELS[t]}
                </Button>
              ))}
            </div>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Platforms</Label>
            <div className="flex flex-wrap gap-2">
              {PLATFORMS.map((p) => (
                <Button
                  key={p}
                  variant={platforms.includes(p) ? "default" : "outline"}
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => togglePlatform(p)}
                >
                  {PLATFORM_LABELS[p]}
                </Button>
              ))}
            </div>
          </div>
          <div className="flex flex-wrap gap-4 pt-1">
            <label className="flex items-center gap-1.5 text-xs cursor-pointer">
              <input type="checkbox" checked={includeEmojis} onChange={(e) => setIncludeEmojis(e.target.checked)} />
              Emojis (tone-aware)
            </label>
            <label className="flex items-center gap-1.5 text-xs cursor-pointer">
              <input type="checkbox" checked={includeCTA} onChange={(e) => setIncludeCTA(e.target.checked)} />
              CTA per platform
            </label>
          </div>
        </CardContent>
      </Card>

      {hasInput && allBios.length > 0 ? (
        <>
          <Card>
            <CardContent className="p-4 space-y-2">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <UserSquare className="h-4 w-4" /> {stats.totalPlatforms} platforms · {stats.totalBios} bios
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                <Stat label="Avg chars" value={stats.avgCharCount} />
                <Stat label="Total emojis" value={stats.totalEmojis} />
                <Stat label="Total CTAs" value={stats.totalCTAs} />
                <Stat label="Within limit" value={`${stats.withinLimitCount}/${stats.totalBios}`} />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 space-y-3">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <Type className="h-4 w-4" /> Generated Bios
              </h3>
              <div className="space-y-3">
                {PLATFORMS.filter((p) => platforms.includes(p)).map((p) => {
                  const list = biosByPlatform.get(p) ?? [];
                  const cfg = PLATFORM_CONFIGS[p];
                  return (
                    <div key={p} className="rounded border bg-background p-3">
                      <div className="flex items-center justify-between pb-2">
                        <div className="flex items-center gap-2">
                          <Badge variant="secondary" className="text-[10px]">{cfg.label}</Badge>
                          <span className="text-[11px] text-muted-foreground">Max {cfg.maxChars} chars</span>
                        </div>
                      </div>
                      <div className="space-y-2">
                        {list.map((b) => {
                          const status = getCharLimitStatus(p, b.charCount);
                          const statusColor = status === "red"
                            ? "text-red-600 dark:text-red-400"
                            : status === "yellow"
                              ? "text-amber-600 dark:text-amber-400"
                              : "text-emerald-600 dark:text-emerald-400";
                          return (
                            <div key={b.variation} className="rounded border border-dashed bg-muted/30 p-2 text-sm">
                              <div className="flex flex-wrap items-center gap-2 pb-1.5">
                                <Badge variant="outline" className="text-[10px]">V{b.variation}</Badge>
                                <span className={`text-[11px] font-mono ${statusColor}`}>{b.charCount}/{b.maxChars}</span>
                                {b.emojiCount > 0 && (
                                  <Badge variant="outline" className="text-[10px]">
                                    <Smile className="h-3 w-3 mr-1" />{b.emojiCount}
                                  </Badge>
                                )}
                                {b.hasCTA && (
                                  <Badge variant="outline" className="text-[10px]">
                                    <Megaphone className="h-3 w-3 mr-1" />CTA
                                  </Badge>
                                )}
                                {website && (
                                  <Badge variant="outline" className="text-[10px]">
                                    <Link2 className="h-3 w-3 mr-1" />link
                                  </Badge>
                                )}
                              </div>
                              <pre className="whitespace-pre-wrap font-sans text-foreground text-sm leading-relaxed">
                                {b.bioText}
                              </pre>
                              <div className="pt-2">
                                <CopyButton
                                  getText={() => { handleSaveHistory(); return b.bioText; }}
                                  label="Copy bio"
                                />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="flex flex-wrap gap-2 pt-2">
                <CopyButton
                  getText={() => { handleSaveHistory(); return textReport; }}
                  label="Copy all"
                />
                <DownloadButton
                  getText={() => { handleSaveHistory(); return textReport; }}
                  filename="social-bios.txt"
                  mime="text/plain"
                  label="Download .txt"
                />
                <DownloadButton
                  getText={() => csv}
                  filename="social-bios.csv"
                  mime="text/csv"
                  label="Download CSV"
                />
                <ShareButton getUrl={() => { handleSaveHistory(); return buildShareUrl(input); }} />
                <ClearButton onClick={handleClear} />
              </div>
            </CardContent>
          </Card>
        </>
      ) : (
        <EmptyState
          title="Enter your name + profession and pick platforms"
          hint="The tool generates 3 bio variations per platform, respecting each platform's char limit (Twitter 160, IG 150, LinkedIn 220, TikTok 80, YouTube 1000)."
          icon={<UserSquare className="h-8 w-8" />}
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
                  <Badge variant="outline" className="mr-2">{TONE_LABELS[h.tone]}</Badge>
                  <Badge variant="outline" className="mr-2">{h.platforms.length} platforms</Badge>
                  <Badge variant="outline" className="mr-2">{h.totalBios} bios</Badge>
                  <span className="text-muted-foreground">{h.name || "—"} · {h.profession || "—"}</span>
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
            <strong className="text-foreground">Privacy:</strong> All bio generation runs locally. History is stored in localStorage on this device only.
          </p>
        </CardContent>
      </Card>
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
