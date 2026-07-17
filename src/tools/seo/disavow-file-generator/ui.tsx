"use client";

import React, { useState, useMemo, useCallback, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  CopyButton,
  DownloadButton,
  EmptyState,
  ShareButton,
  ClearButton,
} from "../../_shared";
import { toast } from "sonner";
import {
  generateDisavowFile,
  buildShareUrl,
  parseShareUrl,
  loadHistory,
  saveHistory,
  clearHistory,
  GOOGLE_DISAVOW_DOCS_URL,
  type DisavowMode,
  type HistoryEntry,
} from "./logic";
import { History, ShieldOff, ExternalLink, FileText } from "lucide-react";

export default function DisavowFileGenerator() {
  const [text, setText] = useState("");
  const [mode, setMode] = useState<DisavowMode>("domain");
  const [dedup, setDedup] = useState(true);
  const [sort, setSort] = useState(false);
  const [comment, setComment] = useState("");
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  useEffect(() => {
    setHistory(loadHistory());
    if (typeof window !== "undefined" && window.location.hash) {
      const parsed = parseShareUrl(window.location.hash);
      if (parsed.text !== undefined) {
        setText(parsed.text);
        if (parsed.mode) setMode(parsed.mode);
        if (parsed.dedup !== undefined) setDedup(parsed.dedup);
        if (parsed.sort !== undefined) setSort(parsed.sort);
        if (parsed.comment !== undefined) setComment(parsed.comment);
        toast.info("Loaded from share link");
      }
    }
  }, []);

  const result = useMemo(
    () => generateDisavowFile(text, { mode, dedup, sort, comment }),
    [text, mode, dedup, sort, comment],
  );

  const handleSaveHistory = useCallback(() => {
    if (result.stats.validEntries > 0) {
      saveHistory({
        ts: Date.now(),
        mode,
        entryCount: result.stats.validEntries,
        snippet: result.output.slice(0, 100),
      });
      setHistory(loadHistory());
    }
  }, [result, mode]);

  const handleClear = useCallback(() => {
    setText("");
    setComment("");
    toast.info("Cleared");
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
          <div className="space-y-1.5">
            <Label htmlFor="disavow-urls">URLs to disavow (one per line)</Label>
            <Textarea
              id="disavow-urls"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={"https://spam-site-1.com/page\nhttps://spam-site-2.com\n# Comments start with #"}
              className="min-h-[180px] font-mono text-xs resize-y"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="disavow-comment">Comment (optional, added to file header)</Label>
            <Input
              id="disavow-comment"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Spammy links found in Oct 2026 audit"
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4 space-y-3">
          <h3 className="text-sm font-semibold text-foreground">Options</h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Disavow mode</Label>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant={mode === "domain" ? "default" : "outline"}
                  onClick={() => setMode("domain")}
                >
                  Domain-level (domain:)
                </Button>
                <Button
                  size="sm"
                  variant={mode === "url" ? "default" : "outline"}
                  onClick={() => setMode("url")}
                >
                  URL-level
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                {mode === "domain"
                  ? "Disavows ALL links from each domain (recommended for spam sites)."
                  : "Disavows only links from specific URLs (surgical, targeted)."}
              </p>
            </div>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label htmlFor="disavow-dedup" className="cursor-pointer">
                  Dedup entries (case-insensitive)
                </Label>
                <Switch
                  id="disavow-dedup"
                  checked={dedup}
                  onCheckedChange={setDedup}
                />
              </div>
              <div className="flex items-center justify-between">
                <Label htmlFor="disavow-sort" className="cursor-pointer">
                  Sort alphabetically (domains first)
                </Label>
                <Switch
                  id="disavow-sort"
                  checked={sort}
                  onCheckedChange={setSort}
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {result.stats.validEntries > 0 || result.stats.invalidEntries > 0 ? (
        <>
          <Card>
            <CardContent className="p-4 space-y-3">
              <h3 className="text-sm font-semibold text-foreground">Stats</h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                <div className="rounded-md border bg-background/50 p-2">
                  <div className="text-xs text-muted-foreground">Valid entries</div>
                  <div className="text-lg font-semibold">{result.stats.validEntries}</div>
                </div>
                <div className="rounded-md border bg-background/50 p-2">
                  <div className="text-xs text-muted-foreground">Invalid</div>
                  <div className={`text-lg font-semibold ${result.stats.invalidEntries > 0 ? "text-red-600 dark:text-red-400" : ""}`}>
                    {result.stats.invalidEntries}
                  </div>
                </div>
                <div className="rounded-md border bg-background/50 p-2">
                  <div className="text-xs text-muted-foreground">Duplicates removed</div>
                  <div className="text-lg font-semibold">{result.stats.duplicatesRemoved}</div>
                </div>
                <div className="rounded-md border bg-background/50 p-2">
                  <div className="text-xs text-muted-foreground">
                    {result.stats.mode === "domain" ? "Unique domains" : "Unique URLs"}
                  </div>
                  <div className="text-lg font-semibold">
                    {result.stats.mode === "domain" ? result.stats.uniqueDomains : result.stats.uniqueUrls}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {result.errors.length > 0 && (
            <div className="rounded-md border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-700 dark:text-amber-400 space-y-1">
              <div className="font-medium">Validation issues ({result.errors.length}):</div>
              {result.errors.slice(0, 10).map((e, i) => (
                <div key={i} className="text-xs">• {e}</div>
              ))}
            </div>
          )}

          {result.stats.validEntries > 0 && (
            <div className="space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <Label>Disavow file output</Label>
                <div className="flex flex-wrap gap-2">
                  <CopyButton getText={() => { handleSaveHistory(); return result.output; }} label="Copy" />
                  <DownloadButton
                    getText={() => result.output}
                    filename="disavow.txt"
                    label="Download .txt"
                  />
                  <ShareButton getUrl={() => { handleSaveHistory(); return buildShareUrl({ text, mode, dedup, sort, comment }); }} />
                  <ClearButton onClick={handleClear} />
                </div>
              </div>
              <pre className="overflow-auto whitespace-pre-wrap rounded-md border bg-muted/30 p-3 font-mono text-xs max-h-[400px]">
                {result.output}
              </pre>
            </div>
          )}
        </>
      ) : (
        <EmptyState
          title="Paste URLs to generate a disavow file"
          hint="One URL per line. Lines starting with # are treated as comments. Toggle between domain-level and URL-level disavow."
          icon={<ShieldOff className="h-8 w-8" />}
        />
      )}

      <Card>
        <CardContent className="p-4 space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
              <FileText className="h-4 w-4" /> How to submit
            </h3>
            <a
              href={GOOGLE_DISAVOW_DOCS_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
            >
              Google docs <ExternalLink className="h-3 w-3" />
            </a>
          </div>
          <ol className="text-xs text-muted-foreground space-y-1 list-decimal list-inside">
            <li>Generate the file above and download <code>disavow.txt</code>.</li>
            <li>Open Google Search Console → your property.</li>
            <li>Go to <strong>Links → Disavow links</strong>.</li>
            <li>Upload the file. Changes can take weeks to fully process.</li>
          </ol>
        </CardContent>
      </Card>

      {history.length > 0 && (
        <Card>
          <CardContent className="p-4 space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <History className="h-4 w-4" /> Recent ({history.length})
              </h3>
              <Button variant="ghost" size="sm" onClick={handleClearHistory}>
                Clear
              </Button>
            </div>
            <div className="space-y-1">
              {history.slice(0, 5).map((h, i) => (
                <div key={i} className="rounded border bg-background px-3 py-2 text-xs">
                  <Badge variant="outline" className="mr-2">{h.mode === "domain" ? "domain:" : "URL"}</Badge>
                  <span className="text-muted-foreground">{h.entryCount} entries</span>
                  <div className="text-muted-foreground/70 mt-1">{new Date(h.ts).toLocaleString()}</div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-3">
          <p className="text-xs text-muted-foreground">
            <strong className="text-foreground">Privacy:</strong> Disavow file
            generation is pure string manipulation. We do not submit to Google
            on your behalf. History is stored in localStorage on this device only.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
