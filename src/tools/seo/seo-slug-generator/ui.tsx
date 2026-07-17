"use client";

import React, { useState, useMemo, useCallback, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { CopyButton, DownloadButton, EmptyState, ShareButton, ClearButton } from "../../_shared";
import { toast } from "sonner";
import {
  generateSlug,
  generateBatch,
  computeStats,
  validateSlug,
  buildUrlPreview,
  renderBatchCsv,
  buildShareUrl,
  parseShareUrl,
  loadHistory,
  saveHistory,
  clearHistory,
  type Separator,
  type SlugOptions,
  type HistoryEntry,
} from "./logic";
import { History, Link as LinkIcon, ListChecks, Globe } from "lucide-react";

export default function SeoSlugGenerator() {
  const [title, setTitle] = useState("");
  const [domain, setDomain] = useState("https://example.com");
  const [separator, setSeparator] = useState<Separator>("-");
  const [maxLength, setMaxLength] = useState(75);
  const [removeStopWords, setRemoveStopWords] = useState(true);
  const [lower, setLower] = useState(true);
  const [strip, setStrip] = useState(true);
  const [trailingSlash, setTrailingSlash] = useState(false);
  const [bulkMode, setBulkMode] = useState(false);
  const [bulkInput, setBulkInput] = useState("");
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  useEffect(() => {
    setHistory(loadHistory());
    if (typeof window !== "undefined" && window.location.hash) {
      const parsed = parseShareUrl(window.location.hash);
      if (parsed.title || parsed.domain) {
        setTitle(parsed.title);
        setDomain(parsed.domain || "https://example.com");
        if (parsed.options.separator) setSeparator(parsed.options.separator);
        if (parsed.options.maxLength !== undefined) setMaxLength(parsed.options.maxLength);
        if (parsed.options.removeStopWords !== undefined) setRemoveStopWords(parsed.options.removeStopWords);
        if (parsed.options.lower !== undefined) setLower(parsed.options.lower);
        if (parsed.options.stripDiacritics !== undefined) setStrip(parsed.options.stripDiacritics);
        setTrailingSlash(parsed.trailingSlash);
        toast.info("Loaded from share link");
      }
    }
  }, []);

  const options: SlugOptions = useMemo(
    () => ({ separator, maxLength, removeStopWords, lower, stripDiacritics: strip }),
    [separator, maxLength, removeStopWords, lower, strip],
  );

  const slug = useMemo(() => generateSlug(title, options), [title, options]);
  const stats = useMemo(() => computeStats(slug), [slug]);
  const validation = useMemo(() => validateSlug(slug), [slug]);
  const urlPreview = useMemo(
    () => buildUrlPreview(slug, domain, trailingSlash),
    [slug, domain, trailingSlash],
  );

  const bulkResults = useMemo(() => {
    if (!bulkMode) return [];
    return generateBatch(bulkInput, options);
  }, [bulkMode, bulkInput, options]);

  const bulkCsv = useMemo(() => renderBatchCsv(bulkResults), [bulkResults]);

  const handleSaveHistory = useCallback(() => {
    if (slug) {
      saveHistory({
        ts: Date.now(),
        title,
        slug,
        separator,
        maxLength,
        removeStopWords,
      });
      setHistory(loadHistory());
    }
  }, [slug, title, separator, maxLength, removeStopWords]);

  const handleClear = useCallback(() => {
    setTitle("");
    setBulkInput("");
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
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-foreground">Input</h3>
            <Button
              size="sm"
              variant={bulkMode ? "default" : "outline"}
              onClick={() => setBulkMode((m) => !m)}
            >
              {bulkMode ? "Single mode" : "Bulk mode"}
            </Button>
          </div>
          {!bulkMode ? (
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="sg-title">Title / text</Label>
                <Input
                  id="sg-title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="The Best 10 SEO Tools of 2026"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="sg-domain">Domain (for preview)</Label>
                <Input
                  id="sg-domain"
                  value={domain}
                  onChange={(e) => setDomain(e.target.value)}
                  placeholder="https://example.com"
                />
              </div>
            </div>
          ) : (
            <div className="space-y-1.5">
              <Label htmlFor="sg-bulk">Titles (one per line)</Label>
              <Textarea
                id="sg-bulk"
                value={bulkInput}
                onChange={(e) => setBulkInput(e.target.value)}
                placeholder={"The Best SEO Tools\nHow to Write a Blog Post"}
                className="min-h-[140px] font-mono text-xs resize-y"
              />
            </div>
          )}

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="sg-sep">Separator</Label>
              <select
                id="sg-sep"
                value={separator}
                onChange={(e) => setSeparator(e.target.value as Separator)}
                className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="-">Hyphen ( - )</option>
                <option value="_">Underscore ( _ )</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="sg-max">Max length: {maxLength}</Label>
              <input
                id="sg-max"
                type="range"
                min={10}
                max={120}
                step={5}
                value={maxLength}
                onChange={(e) => setMaxLength(parseInt(e.target.value, 10))}
                className="w-full cursor-pointer"
              />
            </div>
          </div>

          <div className="flex flex-wrap gap-4">
            <div className="flex items-center gap-2">
              <Switch id="sg-stop" checked={removeStopWords} onCheckedChange={setRemoveStopWords} />
              <Label htmlFor="sg-stop" className="text-sm cursor-pointer">Remove stop words</Label>
            </div>
            <div className="flex items-center gap-2">
              <Switch id="sg-lower" checked={lower} onCheckedChange={setLower} />
              <Label htmlFor="sg-lower" className="text-sm cursor-pointer">Lowercase</Label>
            </div>
            <div className="flex items-center gap-2">
              <Switch id="sg-strip" checked={strip} onCheckedChange={setStrip} />
              <Label htmlFor="sg-strip" className="text-sm cursor-pointer">Strip diacritics</Label>
            </div>
            <div className="flex items-center gap-2">
              <Switch id="sg-slash" checked={trailingSlash} onCheckedChange={setTrailingSlash} />
              <Label htmlFor="sg-slash" className="text-sm cursor-pointer">Trailing slash</Label>
            </div>
          </div>
        </CardContent>
      </Card>

      {!bulkMode && slug && (
        <>
          <Card>
            <CardContent className="p-4 space-y-3">
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Generated slug</Label>
                <div className="font-mono text-lg break-all text-foreground">{slug}</div>
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">URL preview</Label>
                <div className="font-mono text-xs break-all text-emerald-600 dark:text-emerald-400">
                  <Globe className="h-3 w-3 inline mr-1" />
                  {urlPreview}
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Badge variant="outline">{stats.length} chars</Badge>
                <Badge variant="outline">{stats.wordCount} words</Badge>
                <Badge variant="outline">{stats.alphaCount} letters</Badge>
                <Badge variant="outline">{stats.digitCount} digits</Badge>
                <Badge variant={validation.ok ? "default" : "destructive"}>
                  {validation.ok ? "Valid" : `${validation.issues.length} issue(s)`}
                </Badge>
              </div>
              {!validation.ok && (
                <ul className="text-xs text-amber-600 dark:text-amber-400 list-disc list-inside space-y-0.5">
                  {validation.issues.map((iss, i) => (
                    <li key={i}>{iss}</li>
                  ))}
                </ul>
              )}
              <div className="flex flex-wrap gap-2 pt-2">
                <CopyButton
                  getText={() => {
                    handleSaveHistory();
                    return slug;
                  }}
                  label="Copy slug"
                />
                <CopyButton getText={() => urlPreview} label="Copy URL" />
                <ShareButton
                  getUrl={() => {
                    handleSaveHistory();
                    return buildShareUrl({ title, domain, options, trailingSlash });
                  }}
                />
                <ClearButton onClick={handleClear} />
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {!bulkMode && !slug && (
        <EmptyState
          title="Enter a title to generate a slug"
          hint="Lowercase, hyphens, special-char stripping, stop-word removal, length caps, and live URL preview."
          icon={<LinkIcon className="h-8 w-8" />}
        />
      )}

      {bulkMode && bulkResults.length > 0 && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <ListChecks className="h-4 w-4" /> {bulkResults.length} slugs
              </h3>
              <div className="flex gap-2">
                <CopyButton getText={() => bulkResults.map((r) => r.slug).join("\n")} label="Copy slugs" />
                <DownloadButton
                  getText={() => bulkCsv}
                  filename="slugs.csv"
                  mime="text/csv"
                  label="Download CSV"
                />
              </div>
            </div>
            <div className="space-y-1 max-h-[300px] overflow-auto">
              {bulkResults.map((r, i) => (
                <div
                  key={i}
                  className="flex items-center gap-2 rounded border bg-background px-3 py-1.5 text-xs"
                >
                  <div className="flex-1 truncate text-muted-foreground">{r.title}</div>
                  <div className="text-muted-foreground">→</div>
                  <div className="font-mono text-foreground">{r.slug || "(empty)"}</div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
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
                    setTitle(h.title);
                    setSeparator(h.separator);
                    setMaxLength(h.maxLength);
                    setRemoveStopWords(h.removeStopWords);
                    toast.info("Loaded from history");
                  }}
                  className="block w-full text-left rounded border bg-background px-3 py-2 text-xs hover:bg-muted/50 transition-colors cursor-pointer"
                >
                  <div className="font-mono text-foreground">{h.slug}</div>
                  <div className="text-muted-foreground truncate mt-0.5">{h.title}</div>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-3">
          <p className="text-xs text-muted-foreground">
            <strong className="text-foreground">Privacy:</strong> slug generation runs locally. History is stored in localStorage on this device only.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
