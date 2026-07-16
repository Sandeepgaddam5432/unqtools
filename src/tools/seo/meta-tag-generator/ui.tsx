"use client";

import React, { useState, useMemo, useCallback, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
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
  generateMetaTags,
  validateInput,
  countCharacters,
  buildPreviewData,
  buildShareUrl,
  parseShareUrl,
  loadHistory,
  saveHistory,
  clearHistory,
  TITLE_MAX,
  DESCRIPTION_MAX,
  estimatePixelWidth,
  type MetaTagInput,
  type RobotsDirective,
  type HistoryEntry,
} from "./logic";
import { History, Eye } from "lucide-react";

const ROBOTS_OPTIONS: RobotsDirective[] = [
  "index, follow",
  "noindex, follow",
  "index, nofollow",
  "noindex, nofollow",
];

function CharCounter({ value, max }: { value: string; max: number }) {
  const c = countCharacters(value, max);
  const px = estimatePixelWidth(value);
  const color = c.isOver
    ? "text-red-600 dark:text-red-400"
    : c.isWarn
      ? "text-amber-600 dark:text-amber-400"
      : "text-muted-foreground";
  return (
    <div className={`text-xs ${color}`}>
      {c.value}/{max} chars · ~{px}px
      {c.isOver && " (over limit)"}
      {c.isWarn && !c.isOver && " (near limit)"}
    </div>
  );
}

export default function MetaTagGenerator() {
  const [input, setInput] = useState<MetaTagInput>({
    title: "",
    description: "",
    keywords: "",
    author: "",
    robots: "index, follow",
    viewport: "width=device-width, initial-scale=1",
    charset: "UTF-8",
    canonical: "",
    themeColor: "#ffffff",
    appleWebApp: false,
    ogTitle: "",
    ogDescription: "",
    ogImage: "",
    ogUrl: "",
    ogType: "website",
    ogSiteName: "",
    twitterCard: "summary",
    twitterSite: "",
    twitterCreator: "",
  });
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  useEffect(() => {
    setHistory(loadHistory());
    if (typeof window !== "undefined" && window.location.hash) {
      const parsed = parseShareUrl(window.location.hash);
      if (Object.keys(parsed).length > 0) {
        setInput((prev) => ({ ...prev, ...parsed } as MetaTagInput));
        toast.info("Loaded from share link");
      }
    }
  }, []);

  const validation = useMemo(() => validateInput(input), [input]);
  const output = useMemo(() => {
    if (!input.title.trim()) return "";
    try {
      return generateMetaTags(input);
    } catch (e) {
      return "";
    }
  }, [input]);
  const preview = useMemo(() => buildPreviewData(input), [input]);

  const update = useCallback(<K extends keyof MetaTagInput>(key: K, val: MetaTagInput[K]) => {
    setInput((prev) => ({ ...prev, [key]: val }));
  }, []);

  const handleCopy = useCallback(() => {
    if (output) {
      try {
        saveHistory({
          ts: Date.now(),
          title: input.title,
          description: input.description,
          snippet: output,
        });
        setHistory(loadHistory());
      } catch {
        // ignore
      }
    }
  }, [output, input]);

  const handleClear = useCallback(() => {
    setInput({
      title: "",
      description: "",
      keywords: "",
      author: "",
      robots: "index, follow",
      viewport: "width=device-width, initial-scale=1",
      charset: "UTF-8",
      canonical: "",
      themeColor: "#ffffff",
      appleWebApp: false,
      ogTitle: "",
      ogDescription: "",
      ogImage: "",
      ogUrl: "",
      ogType: "website",
      ogSiteName: "",
      twitterCard: "summary",
      twitterSite: "",
      twitterCreator: "",
    });
    setError(null);
    toast.info("Form cleared");
  }, []);

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
              <Label htmlFor="mt-title">Title</Label>
              <Input
                id="mt-title"
                value={input.title}
                onChange={(e) => update("title", e.target.value)}
                placeholder="Page title (max 60 chars recommended)"
              />
              <CharCounter value={input.title} max={TITLE_MAX} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="mt-canonical">Canonical URL</Label>
              <Input
                id="mt-canonical"
                value={input.canonical}
                onChange={(e) => update("canonical", e.target.value)}
                placeholder="https://example.com/page"
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="mt-desc">Meta description</Label>
            <Textarea
              id="mt-desc"
              value={input.description}
              onChange={(e) => update("description", e.target.value)}
              placeholder="Page description (max 160 chars recommended)"
              className="min-h-[80px] resize-y"
            />
            <CharCounter value={input.description} max={DESCRIPTION_MAX} />
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label htmlFor="mt-keywords">Keywords</Label>
              <Input
                id="mt-keywords"
                value={input.keywords}
                onChange={(e) => update("keywords", e.target.value)}
                placeholder="seo, html, meta"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="mt-author">Author</Label>
              <Input
                id="mt-author"
                value={input.author}
                onChange={(e) => update("author", e.target.value)}
                placeholder="Author name"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Robots directive</Label>
              <Select
                value={input.robots}
                onValueChange={(v) => update("robots", v as RobotsDirective)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ROBOTS_OPTIONS.map((r) => (
                    <SelectItem key={r} value={r}>{r}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label htmlFor="mt-viewport">Viewport</Label>
              <Input
                id="mt-viewport"
                value={input.viewport}
                onChange={(e) => update("viewport", e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="mt-charset">Charset</Label>
              <Input
                id="mt-charset"
                value={input.charset}
                onChange={(e) => update("charset", e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="mt-theme">Theme color</Label>
              <div className="flex gap-2">
                <Input
                  id="mt-theme"
                  value={input.themeColor}
                  onChange={(e) => update("themeColor", e.target.value)}
                />
                <input
                  type="color"
                  value={input.themeColor}
                  onChange={(e) => update("themeColor", e.target.value)}
                  className="h-9 w-12 rounded border border-input bg-background"
                  aria-label="Pick theme color"
                />
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Switch
              id="mt-apple"
              checked={!!input.appleWebApp}
              onCheckedChange={(v) => update("appleWebApp", v)}
            />
            <Label htmlFor="mt-apple" className="text-sm cursor-pointer">
              Apple mobile web-app capable
            </Label>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4 space-y-3">
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
            <Eye className="h-4 w-4" /> Open Graph &amp; Twitter Card
          </h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="mt-ogt">og:title</Label>
              <Input
                id="mt-ogt"
                value={input.ogTitle}
                onChange={(e) => update("ogTitle", e.target.value)}
                placeholder="(defaults to title)"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="mt-ogd">og:description</Label>
              <Input
                id="mt-ogd"
                value={input.ogDescription}
                onChange={(e) => update("ogDescription", e.target.value)}
                placeholder="(defaults to description)"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="mt-ogi">og:image</Label>
              <Input
                id="mt-ogi"
                value={input.ogImage}
                onChange={(e) => update("ogImage", e.target.value)}
                placeholder="https://example.com/image.png"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="mt-ogu">og:url</Label>
              <Input
                id="mt-ogu"
                value={input.ogUrl}
                onChange={(e) => update("ogUrl", e.target.value)}
                placeholder="https://example.com"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="mt-ogty">og:type</Label>
              <Input
                id="mt-ogty"
                value={input.ogType}
                onChange={(e) => update("ogType", e.target.value)}
                placeholder="website"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="mt-ogsn">og:site_name</Label>
              <Input
                id="mt-ogsn"
                value={input.ogSiteName}
                onChange={(e) => update("ogSiteName", e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Twitter card type</Label>
              <Select
                value={input.twitterCard}
                onValueChange={(v) =>
                  update("twitterCard", v as "summary" | "summary_large_image")
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="summary">summary</SelectItem>
                  <SelectItem value="summary_large_image">summary_large_image</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="mt-tsite">twitter:site</Label>
              <Input
                id="mt-tsite"
                value={input.twitterSite}
                onChange={(e) => update("twitterSite", e.target.value)}
                placeholder="@handle"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="mt-tc">twitter:creator</Label>
              <Input
                id="mt-tc"
                value={input.twitterCreator}
                onChange={(e) => update("twitterCreator", e.target.value)}
                placeholder="@handle"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Preview */}
      {preview.title && (
        <Card>
          <CardContent className="p-4 space-y-2">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
              <Eye className="h-4 w-4" /> Live preview
            </h3>
            <div className="rounded-md border bg-background p-3 space-y-1">
              <div className="text-[#1a0dab] text-lg leading-snug">{preview.truncatedTitle || "Untitled"}</div>
              <div className="text-[#006621] text-xs">{preview.url || "https://example.com"}</div>
              <div className="text-sm text-muted-foreground">
                {preview.truncatedDescription || "No description yet."}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Validation warnings */}
      {validation.warnings.length > 0 && (
        <div className="rounded-md border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-700 dark:text-amber-400 space-y-1">
          {validation.warnings.map((w, i) => (
            <div key={i}>• {w}</div>
          ))}
        </div>
      )}

      {error && <ErrorBanner message={error} />}

      {/* Output */}
      {output ? (
        <div className="space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Label>Generated meta tags</Label>
            <div className="flex flex-wrap gap-2">
              <CopyButton getText={() => { handleCopy(); return output; }} />
              <DownloadButton
                getText={() => output}
                filename="meta-tags.html"
                mime="text/html"
              />
              <ShareButton getUrl={() => buildShareUrl(input)} />
              <ClearButton onClick={handleClear} />
            </div>
          </div>
          <pre className="overflow-auto whitespace-pre-wrap rounded-md border bg-muted/30 p-3 font-mono text-xs break-all">
            {output}
          </pre>
        </div>
      ) : (
        <EmptyState
          title="Fill the form to generate meta tags"
          hint="At minimum enter a page title to produce the title, charset, viewport, and description tags."
        />
      )}

      {/* History */}
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
                    setInput((prev) => ({ ...prev, title: h.title, description: h.description }));
                    toast.info("Loaded from history");
                  }}
                  className="block w-full text-left rounded border bg-background px-3 py-2 text-xs hover:bg-muted/50 transition-colors cursor-pointer"
                >
                  <span className="font-medium">{h.title || "Untitled"}</span>
                  <span className="text-muted-foreground ml-2">{h.description.slice(0, 60)}</span>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-3">
          <p className="text-xs text-muted-foreground">
            <strong className="text-foreground">Privacy:</strong> tag generation runs locally — your inputs never leave the browser. History is stored in localStorage on this device only.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
