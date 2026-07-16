"use client";

import React, { useState, useMemo, useCallback, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CopyButton, DownloadButton, ErrorBanner, EmptyState, ShareButton, ClearButton } from "../../_shared";
import { toast } from "sonner";
import {
  generateOgBlock,
  validateOgInput,
  countChars,
  buildPreviewCard,
  buildDebugLinks,
  buildShareUrl,
  parseShareUrl,
  loadHistory,
  saveHistory,
  clearHistory,
  OG_TITLE_MAX,
  OG_DESCRIPTION_MAX,
  type OgInput,
  type TwitterCardType,
  type OgType,
  type HistoryEntry,
} from "./logic";
import { ExternalLink, History, Image as ImageIcon } from "lucide-react";

const TWITTER_CARD_OPTIONS: TwitterCardType[] = ["summary", "summary_large_image", "player", "app"];
const OG_TYPE_OPTIONS: OgType[] = ["website", "article", "product", "profile", "book", "video.movie", "music.song"];

function CharCounter({ value, max }: { value: string; max: number }) {
  const c = countChars(value, max);
  const color = c.isOver
    ? "text-red-600 dark:text-red-400"
    : c.isWarn
      ? "text-amber-600 dark:text-amber-400"
      : "text-muted-foreground";
  return (
    <div className={`text-xs ${color}`}>
      {c.value}/{max}
      {c.isOver && " (over)"}
      {c.isWarn && !c.isOver && " (near)"}
    </div>
  );
}

export default function OpenGraphGenerator() {
  const [input, setInput] = useState<OgInput>({
    ogTitle: "",
    ogDescription: "",
    ogImage: "",
    ogImageAlt: "",
    ogUrl: "",
    ogType: "website",
    ogSiteName: "",
    ogLocale: "en_US",
    twitterCard: "summary",
    twitterSite: "",
    twitterCreator: "",
    articlePublishedTime: "",
    articleAuthor: "",
    appId: "",
  });
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  useEffect(() => {
    setHistory(loadHistory());
    if (typeof window !== "undefined" && window.location.hash) {
      const parsed = parseShareUrl(window.location.hash);
      if (Object.keys(parsed).length > 0) {
        setInput((prev) => ({ ...prev, ...parsed } as OgInput));
        toast.info("Loaded from share link");
      }
    }
  }, []);

  const validation = useMemo(() => validateOgInput(input), [input]);
  const output = useMemo(() => {
    if (!input.ogTitle.trim()) return "";
    try {
      return generateOgBlock(input);
    } catch {
      return "";
    }
  }, [input]);

  const preview = useMemo(() => buildPreviewCard(input), [input]);
  const debugLinks = useMemo(() => buildDebugLinks(input.ogUrl), [input.ogUrl]);

  const update = useCallback(<K extends keyof OgInput>(key: K, val: OgInput[K]) => {
    setInput((prev) => ({ ...prev, [key]: val }));
  }, []);

  const handleClear = useCallback(() => {
    setInput({
      ogTitle: "",
      ogDescription: "",
      ogImage: "",
      ogImageAlt: "",
      ogUrl: "",
      ogType: "website",
      ogSiteName: "",
      ogLocale: "en_US",
      twitterCard: "summary",
      twitterSite: "",
      twitterCreator: "",
      articlePublishedTime: "",
      articleAuthor: "",
      appId: "",
    });
    toast.info("Form cleared");
  }, []);

  const handleCopy = useCallback(() => {
    if (output) {
      saveHistory({ ts: Date.now(), title: input.ogTitle, snippet: output });
      setHistory(loadHistory());
    }
  }, [output, input.ogTitle]);

  const handleClearHistory = useCallback(() => {
    clearHistory();
    setHistory([]);
    toast.success("History cleared");
  }, []);

  return (
    <div className="space-y-4 unq-animate-fade-in-up">
      <Card>
        <CardContent className="p-4 space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="og-title">og:title</Label>
              <Input
                id="og-title"
                value={input.ogTitle}
                onChange={(e) => update("ogTitle", e.target.value)}
                placeholder="Page title"
              />
              <CharCounter value={input.ogTitle} max={OG_TITLE_MAX} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="og-url">og:url</Label>
              <Input
                id="og-url"
                value={input.ogUrl}
                onChange={(e) => update("ogUrl", e.target.value)}
                placeholder="https://example.com/page"
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="og-desc">og:description</Label>
            <Textarea
              id="og-desc"
              value={input.ogDescription}
              onChange={(e) => update("ogDescription", e.target.value)}
              placeholder="Short description for social cards"
              className="min-h-[80px] resize-y"
            />
            <CharCounter value={input.ogDescription} max={OG_DESCRIPTION_MAX} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="og-image">og:image</Label>
              <Input
                id="og-image"
                value={input.ogImage}
                onChange={(e) => update("ogImage", e.target.value)}
                placeholder="https://example.com/image.png (1200×630)"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="og-imagealt">og:image:alt</Label>
              <Input
                id="og-imagealt"
                value={input.ogImageAlt}
                onChange={(e) => update("ogImageAlt", e.target.value)}
                placeholder="Alt text for accessibility"
              />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label>og:type</Label>
              <Select value={input.ogType} onValueChange={(v) => update("ogType", v as OgType)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {OG_TYPE_OPTIONS.map((t) => (
                    <SelectItem key={t} value={t}>{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="og-sitename">og:site_name</Label>
              <Input
                id="og-sitename"
                value={input.ogSiteName}
                onChange={(e) => update("ogSiteName", e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="og-locale">og:locale</Label>
              <Input
                id="og-locale"
                value={input.ogLocale}
                onChange={(e) => update("ogLocale", e.target.value)}
                placeholder="en_US"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4 space-y-3">
          <h3 className="text-sm font-semibold text-foreground">Twitter Card</h3>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label>twitter:card</Label>
              <Select
                value={input.twitterCard}
                onValueChange={(v) => update("twitterCard", v as TwitterCardType)}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TWITTER_CARD_OPTIONS.map((t) => (
                    <SelectItem key={t} value={t}>{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="t-site">twitter:site</Label>
              <Input
                id="t-site"
                value={input.twitterSite}
                onChange={(e) => update("twitterSite", e.target.value)}
                placeholder="@handle"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="t-creator">twitter:creator</Label>
              <Input
                id="t-creator"
                value={input.twitterCreator}
                onChange={(e) => update("twitterCreator", e.target.value)}
                placeholder="@handle"
              />
            </div>
          </div>
          {input.ogType === "article" && (
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="art-pub">article:published_time</Label>
                <Input
                  id="art-pub"
                  type="datetime-local"
                  value={input.articlePublishedTime}
                  onChange={(e) => update("articlePublishedTime", e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="art-author">article:author</Label>
                <Input
                  id="art-author"
                  value={input.articleAuthor}
                  onChange={(e) => update("articleAuthor", e.target.value)}
                />
              </div>
            </div>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="app-id">fb:app_id (optional)</Label>
            <Input
              id="app-id"
              value={input.appId}
              onChange={(e) => update("appId", e.target.value)}
              placeholder="1234567890"
            />
          </div>
        </CardContent>
      </Card>

      {/* Live preview */}
      {preview.title && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <h3 className="text-sm font-semibold text-foreground">Live social card preview</h3>
            {preview.card === "summary_large_image" ? (
              <div className="overflow-hidden rounded-lg border bg-background max-w-[504px]">
                {preview.image ? (
                  <div className="aspect-[1.91/1] bg-muted">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={preview.image}
                      alt={preview.title}
                      className="h-full w-full object-cover"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = "none";
                      }}
                    />
                  </div>
                ) : (
                  <div className="aspect-[1.91/1] bg-muted flex items-center justify-center text-muted-foreground text-xs">
                    <ImageIcon className="h-8 w-8" />
                  </div>
                )}
                <div className="p-3 space-y-1">
                  <div className="text-xs text-muted-foreground">{preview.url || "example.com"}</div>
                  <div className="font-medium text-sm line-clamp-2">{preview.title}</div>
                  <div className="text-xs text-muted-foreground line-clamp-2">{preview.description}</div>
                </div>
              </div>
            ) : (
              <div className="flex overflow-hidden rounded-lg border bg-background max-w-[504px]">
                {preview.image && (
                  <div className="w-32 flex-shrink-0 bg-muted">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={preview.image}
                      alt={preview.title}
                      className="h-full w-full object-cover"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = "none";
                      }}
                    />
                  </div>
                )}
                <div className="p-3 space-y-1 flex-1">
                  <div className="text-xs text-muted-foreground">{preview.url || "example.com"}</div>
                  <div className="font-medium text-sm line-clamp-2">{preview.title}</div>
                  <div className="text-xs text-muted-foreground line-clamp-2">{preview.description}</div>
                </div>
              </div>
            )}
            <p className="text-xs text-muted-foreground">
              <strong className="text-foreground">WhatsApp:</strong> similar preview with square crop on left and link preview bubble.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Validation warnings */}
      {validation.warnings.length > 0 && (
        <div className="rounded-md border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-700 dark:text-amber-400 space-y-1">
          {validation.warnings.map((w, i) => <div key={i}>• {w}</div>)}
        </div>
      )}

      {/* Output */}
      {output ? (
        <div className="space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Label>Generated tags</Label>
            <div className="flex flex-wrap gap-2">
              <CopyButton getText={() => { handleCopy(); return output; }} />
              <DownloadButton getText={() => output} filename="og-tags.html" mime="text/html" />
              <ShareButton getUrl={() => buildShareUrl(input)} />
              <ClearButton onClick={handleClear} />
            </div>
          </div>
          <pre className="overflow-auto whitespace-pre-wrap rounded-md border bg-muted/30 p-3 font-mono text-xs break-all">
            {output}
          </pre>
          <div className="flex flex-wrap gap-2 pt-2">
            <Button asChild variant="outline" size="sm" className="gap-1.5">
              <a href={debugLinks.facebook} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="h-3.5 w-3.5" /> Facebook Debugger
              </a>
            </Button>
            <Button asChild variant="outline" size="sm" className="gap-1.5">
              <a href={debugLinks.twitter} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="h-3.5 w-3.5" /> Twitter Validator
              </a>
            </Button>
            <Button asChild variant="outline" size="sm" className="gap-1.5">
              <a href={debugLinks.linkedin} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="h-3.5 w-3.5" /> LinkedIn Inspector
              </a>
            </Button>
          </div>
        </div>
      ) : (
        <EmptyState
          title="Fill the form to generate Open Graph tags"
          hint="og:title is required. Add an image URL for the best social card preview."
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
                <button
                  key={i}
                  onClick={() => {
                    setInput((prev) => ({ ...prev, ogTitle: h.title }));
                    toast.info("Loaded title from history");
                  }}
                  className="block w-full text-left rounded border bg-background px-3 py-2 text-xs hover:bg-muted/50 transition-colors cursor-pointer"
                >
                  <span className="font-medium">{h.title || "Untitled"}</span>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-3">
          <p className="text-xs text-muted-foreground">
            <strong className="text-foreground">Privacy:</strong> tag generation runs locally — your inputs never leave the browser. The Facebook/Twitter/LinkedIn links open their public debug tools; you'd paste your URL there yourself.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
