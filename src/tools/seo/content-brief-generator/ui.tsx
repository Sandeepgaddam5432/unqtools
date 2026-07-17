"use client";

import React, { useState, useMemo, useCallback, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  CopyButton,
  DownloadButton,
  EmptyState,
  ShareButton,
  ClearButton,
} from "../../_shared";
import { toast } from "sonner";
import {
  INTENT_LABELS,
  validateInput,
  suggestLsiKeywords,
  suggestOutline,
  renderMarkdown,
  renderHtml,
  parseList,
  parseLinks,
  buildShareUrl,
  parseShareUrl,
  loadHistory,
  saveHistory,
  clearHistory,
  type SearchIntent,
  type ContentBriefInput,
  type OutlineItem,
  type HistoryEntry,
} from "./logic";
import {
  History,
  Plus,
  X,
  ClipboardList,
  Lightbulb,
} from "lucide-react";

const INTENT_OPTIONS = Object.entries(INTENT_LABELS).map(([key, label]) => ({
  key: key as SearchIntent,
  label,
}));

export default function ContentBriefGenerator() {
  const [targetKeyword, setTargetKeyword] = useState("");
  const [title, setTitle] = useState("");
  const [searchIntent, setSearchIntent] = useState<SearchIntent>("informational");
  const [wordCountTarget, setWordCountTarget] = useState(1500);
  const [audience, setAudience] = useState("");
  const [tone, setTone] = useState("");
  const [outline, setOutline] = useState<OutlineItem[]>([]);
  const [keyPointsText, setKeyPointsText] = useState("");
  const [lsiKeywordsText, setLsiKeywordsText] = useState("");
  const [internalLinksText, setInternalLinksText] = useState("");
  const [externalLinksText, setExternalLinksText] = useState("");
  const [competitorUrlsText, setCompetitorUrlsText] = useState("");
  const [notes, setNotes] = useState("");
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  useEffect(() => {
    setHistory(loadHistory());
    if (typeof window !== "undefined" && window.location.hash) {
      const parsed = parseShareUrl(window.location.hash);
      if (parsed.targetKeyword) {
        setTargetKeyword(parsed.targetKeyword);
        if (parsed.title) setTitle(parsed.title);
        if (parsed.searchIntent) setSearchIntent(parsed.searchIntent);
        if (parsed.wordCountTarget) setWordCountTarget(parsed.wordCountTarget);
        if (parsed.audience) setAudience(parsed.audience);
        if (parsed.tone) setTone(parsed.tone);
        if (parsed.outline) setOutline(parsed.outline);
        if (parsed.keyPoints) setKeyPointsText(parsed.keyPoints.join("\n"));
        if (parsed.lsiKeywords) setLsiKeywordsText(parsed.lsiKeywords.join(", "));
        if (parsed.internalLinks) {
          setInternalLinksText(parsed.internalLinks.map((l) => `${l.anchor} | ${l.url}`).join("\n"));
        }
        if (parsed.externalLinks) {
          setExternalLinksText(parsed.externalLinks.map((l) => `${l.anchor} | ${l.url}`).join("\n"));
        }
        if (parsed.competitorUrls) setCompetitorUrlsText(parsed.competitorUrls.join("\n"));
        if (parsed.notes) setNotes(parsed.notes);
        toast.info("Loaded from share link");
      }
    }
  }, []);

  const input: ContentBriefInput = useMemo(
    () => ({
      targetKeyword,
      title,
      searchIntent,
      wordCountTarget,
      audience: audience || undefined,
      tone: tone || undefined,
      outline,
      keyPoints: parseList(keyPointsText),
      lsiKeywords: parseList(lsiKeywordsText),
      internalLinks: parseLinks(internalLinksText),
      externalLinks: parseLinks(externalLinksText),
      competitorUrls: parseList(competitorUrlsText),
      notes: notes || undefined,
    }),
    [
      targetKeyword, title, searchIntent, wordCountTarget, audience, tone,
      outline, keyPointsText, lsiKeywordsText, internalLinksText,
      externalLinksText, competitorUrlsText, notes,
    ],
  );

  const validation = useMemo(() => validateInput(input), [input]);
  const markdownOutput = useMemo(() => {
    try {
      if (!targetKeyword.trim() || !title.trim()) return "";
      return renderMarkdown(input);
    } catch {
      return "";
    }
  }, [input, targetKeyword, title]);

  const lsiSuggestions = useMemo(() => suggestLsiKeywords(targetKeyword), [targetKeyword]);

  const addOutlineItem = useCallback(() => {
    setOutline((prev) => [...prev, { heading: "", notes: "" }]);
  }, []);
  const removeOutlineItem = useCallback((i: number) => {
    setOutline((prev) => prev.filter((_, idx) => idx !== i));
  }, []);
  const updateOutlineItem = useCallback(
    (i: number, key: keyof OutlineItem, val: string) => {
      setOutline((prev) =>
        prev.map((o, idx) => (idx === i ? { ...o, [key]: val } : o)),
      );
    },
    [],
  );
  const applySuggestedOutline = useCallback(() => {
    const suggested = suggestOutline(targetKeyword);
    if (suggested.length === 0) {
      toast.error("Enter a target keyword first");
      return;
    }
    setOutline(suggested);
    toast.success(`Applied suggested outline (${suggested.length} sections)`);
  }, [targetKeyword]);

  const addLsiSuggestion = useCallback((s: string) => {
    setLsiKeywordsText((prev) => {
      const existing = parseList(prev);
      if (existing.includes(s)) return prev;
      return prev + (prev.trim() ? ", " : "") + s;
    });
  }, []);

  const handleSaveHistory = useCallback(() => {
    if (targetKeyword.trim() && title.trim()) {
      saveHistory({
        ts: Date.now(),
        title,
        keyword: targetKeyword,
        wordCount: wordCountTarget,
        snippet: markdownOutput.slice(0, 100),
      });
      setHistory(loadHistory());
    }
  }, [targetKeyword, title, wordCountTarget, markdownOutput]);

  const handleClear = useCallback(() => {
    setTargetKeyword("");
    setTitle("");
    setSearchIntent("informational");
    setWordCountTarget(1500);
    setAudience("");
    setTone("");
    setOutline([]);
    setKeyPointsText("");
    setLsiKeywordsText("");
    setInternalLinksText("");
    setExternalLinksText("");
    setCompetitorUrlsText("");
    setNotes("");
    toast.info("Brief cleared");
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
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label htmlFor="cb-keyword">Target keyword *</Label>
              <Input
                id="cb-keyword"
                value={targetKeyword}
                onChange={(e) => setTargetKeyword(e.target.value)}
                placeholder="email marketing"
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="cb-title">Title *</Label>
              <Input
                id="cb-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="The Complete Guide to Email Marketing"
                className="mt-1"
              />
              <div className="text-xs text-muted-foreground mt-1">
                {title.length}/70 chars
              </div>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label htmlFor="cb-intent">Search intent</Label>
              <Select
                value={searchIntent}
                onValueChange={(v) => setSearchIntent(v as SearchIntent)}
              >
                <SelectTrigger id="cb-intent" className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {INTENT_OPTIONS.map((o) => (
                    <SelectItem key={o.key} value={o.key}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="cb-wordcount">
                Word count target: {wordCountTarget}
              </Label>
              <Slider
                id="cb-wordcount"
                value={[wordCountTarget]}
                onValueChange={(v) => setWordCountTarget(v[0])}
                min={100}
                max={5000}
                step={100}
                className="mt-3"
                aria-label="Word count target"
              />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label htmlFor="cb-audience">Audience (optional)</Label>
              <Input
                id="cb-audience"
                value={audience}
                onChange={(e) => setAudience(e.target.value)}
                placeholder="Small business owners"
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="cb-tone">Tone (optional)</Label>
              <Input
                id="cb-tone"
                value={tone}
                onChange={(e) => setTone(e.target.value)}
                placeholder="Professional but friendly"
                className="mt-1"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-foreground">
              Outline ({outline.length})
            </h3>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="ghost"
                onClick={applySuggestedOutline}
                disabled={!targetKeyword.trim()}
                className="gap-1.5"
              >
                <Lightbulb className="h-3.5 w-3.5" /> Suggest
              </Button>
              <Button size="sm" variant="outline" onClick={addOutlineItem} className="gap-1.5">
                <Plus className="h-3.5 w-3.5" /> Add section
              </Button>
            </div>
          </div>
          {outline.map((o, i) => (
            <div key={i} className="rounded-md border p-3 space-y-2">
              <div className="flex items-center justify-between">
                <Badge variant="outline" className="text-xs">#{i + 1}</Badge>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => removeOutlineItem(i)}
                  aria-label="Remove"
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>
              <Input
                value={o.heading}
                onChange={(e) => updateOutlineItem(i, "heading", e.target.value)}
                placeholder="Section heading"
                className="text-sm"
              />
              <Textarea
                value={o.notes || ""}
                onChange={(e) => updateOutlineItem(i, "notes", e.target.value)}
                placeholder="Notes for the writer (what to cover)"
                className="text-xs min-h-[40px]"
              />
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4 space-y-3">
          <div>
            <Label htmlFor="cb-keypoints">Key points (one per line)</Label>
            <Textarea
              id="cb-keypoints"
              value={keyPointsText}
              onChange={(e) => setKeyPointsText(e.target.value)}
              placeholder={"Define email marketing\nList 3 best practices"}
              className="mt-1 min-h-[80px] text-xs"
            />
          </div>
          <div>
            <Label htmlFor="cb-lsi">LSI / related keywords (comma-separated)</Label>
            <Textarea
              id="cb-lsi"
              value={lsiKeywordsText}
              onChange={(e) => setLsiKeywordsText(e.target.value)}
              placeholder="drip campaign, newsletter, automation"
              className="mt-1 min-h-[60px] text-xs"
            />
          </div>
          {lsiSuggestions.length > 0 && (
            <div className="space-y-2">
              <div className="text-xs text-muted-foreground">Suggestions:</div>
              <div className="flex flex-wrap gap-1.5">
                {lsiSuggestions.map((s) => (
                  <Button
                    key={s}
                    size="sm"
                    variant="outline"
                    onClick={() => addLsiSuggestion(s)}
                    className="text-xs h-auto py-1"
                  >
                    + {s}
                  </Button>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4 space-y-3">
          <div>
            <Label htmlFor="cb-internal">Internal links (anchor | URL — one per line)</Label>
            <Textarea
              id="cb-internal"
              value={internalLinksText}
              onChange={(e) => setInternalLinksText(e.target.value)}
              placeholder={"Our blog | https://example.com/blog\nGuide | https://example.com/guide"}
              className="mt-1 min-h-[60px] text-xs font-mono"
            />
          </div>
          <div>
            <Label htmlFor="cb-external">External links (anchor | URL — one per line)</Label>
            <Textarea
              id="cb-external"
              value={externalLinksText}
              onChange={(e) => setExternalLinksText(e.target.value)}
              placeholder={"Source | https://example.com/source"}
              className="mt-1 min-h-[60px] text-xs font-mono"
            />
          </div>
          <div>
            <Label htmlFor="cb-comp">Competitor URLs (one per line)</Label>
            <Textarea
              id="cb-comp"
              value={competitorUrlsText}
              onChange={(e) => setCompetitorUrlsText(e.target.value)}
              placeholder={"https://competitor.com/article"}
              className="mt-1 min-h-[40px] text-xs font-mono"
            />
          </div>
          <div>
            <Label htmlFor="cb-notes">Additional notes</Label>
            <Textarea
              id="cb-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Any other instructions for the writer…"
              className="mt-1 min-h-[60px] text-xs"
            />
          </div>
        </CardContent>
      </Card>

      {validation.warnings.length > 0 && (
        <div className="rounded-md border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-700 dark:text-amber-400 space-y-1">
          {validation.warnings.slice(0, 5).map((w, i) => <div key={i}>• {w}</div>)}
          {validation.warnings.length > 5 && (
            <div>• ...and {validation.warnings.length - 5} more</div>
          )}
        </div>
      )}

      {markdownOutput ? (
        <div className="space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Label>Brief preview (Markdown)</Label>
            <div className="flex flex-wrap gap-2">
              <CopyButton getText={() => { handleSaveHistory(); return markdownOutput; }} label="Copy .md" />
              <DownloadButton getText={() => markdownOutput} filename="content-brief.md" label="Download .md" />
              <DownloadButton
                getText={() => { try { return renderHtml(input); } catch { return ""; } }}
                filename="content-brief.html"
                mime="text/html"
                label="Download .html"
              />
              <ShareButton getUrl={() => { handleSaveHistory(); return buildShareUrl(input); }} />
              <ClearButton onClick={handleClear} />
            </div>
          </div>
          <pre className="overflow-auto whitespace-pre-wrap rounded-md border bg-muted/30 p-3 font-mono text-xs max-h-[500px]">
            {markdownOutput}
          </pre>
        </div>
      ) : (
        <EmptyState
          title="Enter a keyword and title to generate a brief"
          hint="A content brief tells a writer what to write — keyword, intent, outline, key points, LSI terms, links, and competitor URLs."
          icon={<ClipboardList className="h-8 w-8" />}
        />
      )}

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
                  <Badge variant="outline" className="mr-2">{h.wordCount} words</Badge>
                  <span className="text-muted-foreground">{h.title}</span>
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
            <strong className="text-foreground">Privacy:</strong> Brief
            generation runs locally. History is stored in localStorage on this
            device only.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
