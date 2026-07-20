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
  ErrorBanner,
} from "../../_shared";
import { toast } from "sonner";
import {
  Tags, History, Eye, Key, Sparkles, Wand2, FileCode, AlertTriangle,
} from "lucide-react";
import {
  HISTORY_MAX,
  ROBOTS_DIRECTIVES,
  OG_TYPES,
  TWITTER_CARDS,
  JSON_LD_TYPES,
  PREVIEW_PLATFORMS,
  CHARACTER_LIMITS,
  DEFAULT_INPUT,
  SAMPLE_PAGES,
  HONESTY_NOTES,
  normalizeUrl,
  isValidUrl,
  buildMetaTags,
  buildAllPreviews,
  measureTitleLength,
  measureDescriptionLength,
  extractKeywords,
  suggestTitleFromContent,
  suggestDescriptionFromContent,
  renderHtml,
  buildLlmPrompt,
  renderLlmResult,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  type PageMetaInput,
  type PreviewPlatform,
  type RobotsDirective,
  type OGType,
  type TwitterCard,
  type JsonLdType,
  type LengthStatus,
} from "./logic";

const STATUS_COLORS: Record<LengthStatus, string> = {
  good: "text-emerald-600 dark:text-emerald-400",
  warn: "text-amber-600 dark:text-amber-400",
  bad: "text-red-600 dark:text-red-400",
};

const STATUS_BG: Record<LengthStatus, string> = {
  good: "bg-emerald-500",
  warn: "bg-amber-500",
  bad: "bg-red-500",
};

export default function AiMetaTagBuilder() {
  const [input, setInput] = useState<PageMetaInput>({ ...DEFAULT_INPUT });
  const [contentText, setContentText] = useState("");
  const [history, setHistory] = useState<ReturnType<typeof loadHistory>>([]);
  const [activePlatform, setActivePlatform] = useState<PreviewPlatform>("google");
  const [showLlm, setShowLlm] = useState(false);
  const [llmKey, setLlmKey] = useState("");
  const [llmProvider, setLlmProvider] = useState<"openai" | "anthropic">("openai");
  const [llmLoading, setLlmLoading] = useState(false);
  const [llmError, setLlmError] = useState("");

  useEffect(() => {
    setHistory(loadHistory());
    const key = typeof localStorage !== "undefined"
      ? localStorage.getItem("unqtools:ai-meta-tag-builder:llm-key")
      : null;
    if (key) setLlmKey(key);
    if (typeof window !== "undefined" && window.location.hash) {
      const parsed = parseShareUrl(window.location.hash);
      if (parsed.title || parsed.url || parsed.description) {
        setInput(parsed);
        toast.info("Loaded from share link");
      }
    }
  }, []);

  const set = useMemo(() => buildMetaTags(input), [input]);
  const html = useMemo(() => renderHtml(set), [set]);
  const previews = useMemo(() => buildAllPreviews(input), [input]);
  const activePreview = useMemo(
    () => previews.find((p) => p.platform === activePlatform) ?? previews[0],
    [previews, activePlatform],
  );
  const titleCheck = useMemo(
    () => measureTitleLength(input.title, activePlatform),
    [input.title, activePlatform],
  );
  const descCheck = useMemo(
    () => measureDescriptionLength(input.description, activePlatform),
    [input.description, activePlatform],
  );
  const keywordSuggestions = useMemo(
    () => extractKeywords(contentText, 10),
    [contentText],
  );

  const update = useCallback(<K extends keyof PageMetaInput>(k: K, v: PageMetaInput[K]) => {
    setInput((prev) => ({ ...prev, [k]: v }));
  }, []);

  const handleClear = useCallback(() => {
    setInput({ ...DEFAULT_INPUT });
    setContentText("");
    setLlmError("");
    toast.info("Cleared");
  }, []);

  const handleSample = useCallback((s: { label: string; input: PageMetaInput }) => {
    setInput({ ...s.input });
    toast.info(`Loaded sample: ${s.label}`);
  }, []);

  const handleSaveHistory = useCallback(() => {
    if (input.title || input.url) {
      saveHistory({
        ts: Date.now(),
        title: input.title,
        description: input.description,
        url: input.url,
        ogType: input.ogType,
        twitterCard: input.twitterCard,
        robots: input.robots,
      });
      setHistory(loadHistory());
    }
  }, [input]);

  const handleClearHistory = useCallback(() => {
    clearHistory();
    setHistory([]);
    toast.success("History cleared");
  }, []);

  const handleDraftFromContent = useCallback(() => {
    if (!contentText.trim()) {
      toast.error("Paste page content first");
      return;
    }
    const t = suggestTitleFromContent(contentText);
    const d = suggestDescriptionFromContent(contentText);
    if (t) update("title", t);
    if (d) update("description", d);
    const kw = extractKeywords(contentText, 5);
    if (kw.length > 0) update("keywords", kw);
    toast.success("Drafted title, description, and keywords from content");
  }, [contentText, update]);

  const handleEnhanceWithLlm = useCallback(async () => {
    if (!llmKey) {
      setLlmError("Enter an API key first.");
      return;
    }
    if (!contentText.trim()) {
      setLlmError("Paste page content to draft from.");
      return;
    }
    setLlmLoading(true);
    setLlmError("");
    try {
      if (typeof localStorage !== "undefined") {
        localStorage.setItem("unqtools:ai-meta-tag-builder:llm-key", llmKey);
      }
      const prompt = buildLlmPrompt(contentText, input.title, input.description);
      const endpoint = llmProvider === "openai"
        ? "https://api.openai.com/v1/chat/completions"
        : "https://api.anthropic.com/v1/messages";
      const headers: Record<string, string> = llmProvider === "openai"
        ? { "Content-Type": "application/json", "Authorization": `Bearer ${llmKey}` }
        : {
          "Content-Type": "application/json",
          "x-api-key": llmKey,
          "anthropic-version": "2023-06-01",
          "anthropic-dangerous-direct-browser-access": "true",
        };
      const body = llmProvider === "openai"
        ? JSON.stringify({
            model: "gpt-4o-mini",
            messages: [
              { role: "system", content: "You are an SEO copywriter." },
              { role: "user", content: prompt },
            ],
            max_tokens: 400,
            temperature: 0.5,
          })
        : JSON.stringify({
            model: "claude-3-5-haiku-latest",
            max_tokens: 400,
            system: "You are an SEO copywriter.",
            messages: [{ role: "user", content: prompt }],
          });
      const res = await fetch(endpoint, { method: "POST", headers, body });
      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`HTTP ${res.status}: ${errText.slice(0, 200)}`);
      }
      const json = await res.json();
      const out = llmProvider === "openai"
        ? json.choices?.[0]?.message?.content ?? ""
        : json.content?.[0]?.text ?? "";
      const parsed = renderLlmResult(out);
      if (parsed.title) update("title", parsed.title);
      if (parsed.description) update("description", parsed.description);
      toast.success("LLM enhancement applied");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Unknown error";
      setLlmError(msg);
      toast.error("LLM enhancement failed");
    } finally {
      setLlmLoading(false);
    }
  }, [llmKey, llmProvider, contentText, input.title, input.description, update]);

  return (
    <div className="space-y-4 unq-animate-fade-in-up">
      {/* Inputs */}
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="mtb-title">Page title</Label>
            <Input
              id="mtb-title"
              value={input.title}
              onChange={(e) => update("title", e.target.value)}
              placeholder="The Complete Guide to On-Page SEO in 2025"
              className="font-mono text-xs"
            />
            <LengthMeter check={titleCheck} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="mtb-desc">Meta description</Label>
            <Textarea
              id="mtb-desc"
              value={input.description}
              onChange={(e) => update("description", e.target.value)}
              placeholder="Learn on-page SEO in 2025: title tags, meta descriptions, header structure…"
              className="min-h-[60px] resize-y font-mono text-xs"
            />
            <LengthMeter check={descCheck} />
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="mtb-url">Canonical URL</Label>
              <Input
                id="mtb-url"
                value={input.url}
                onChange={(e) => update("url", e.target.value)}
                placeholder="https://example.com/blog/on-page-seo"
                className="font-mono text-xs"
              />
              {!input.url || isValidUrl(input.url) ? null : (
                <p className="text-[10px] text-red-600 dark:text-red-400">Invalid URL</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="mtb-site">Site name</Label>
              <Input
                id="mtb-site"
                value={input.siteName}
                onChange={(e) => update("siteName", e.target.value)}
                placeholder="Example Blog"
                className="font-mono text-xs"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="mtb-img">OG image URL</Label>
              <Input
                id="mtb-img"
                value={input.imageUrl}
                onChange={(e) => update("imageUrl", e.target.value)}
                placeholder="https://example.com/img/og.png"
                className="font-mono text-xs"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1.5">
                <Label htmlFor="mtb-iw" className="text-[11px]">Image W</Label>
                <Input
                  id="mtb-iw"
                  type="number"
                  value={input.imageWidth}
                  onChange={(e) => update("imageWidth", Number(e.target.value) || 0)}
                  className="font-mono text-xs"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="mtb-ih" className="text-[11px]">Image H</Label>
                <Input
                  id="mtb-ih"
                  type="number"
                  value={input.imageHeight}
                  onChange={(e) => update("imageHeight", Number(e.target.value) || 0)}
                  className="font-mono text-xs"
                />
              </div>
            </div>
          </div>
          <div className="grid sm:grid-cols-4 gap-2">
            <div className="space-y-1">
              <Label className="text-[11px]">OG type</Label>
              <select
                value={input.ogType}
                onChange={(e) => update("ogType", e.target.value as OGType)}
                className="h-9 w-full text-xs rounded border bg-background px-2"
              >
                {OG_TYPES.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
            <div className="space-y-1">
              <Label className="text-[11px]">Twitter card</Label>
              <select
                value={input.twitterCard}
                onChange={(e) => update("twitterCard", e.target.value as TwitterCard)}
                className="h-9 w-full text-xs rounded border bg-background px-2"
              >
                {TWITTER_CARDS.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
            </div>
            <div className="space-y-1">
              <Label className="text-[11px]">Robots</Label>
              <select
                value={input.robots}
                onChange={(e) => update("robots", e.target.value as RobotsDirective)}
                className="h-9 w-full text-xs rounded border bg-background px-2"
              >
                {ROBOTS_DIRECTIVES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
              </select>
            </div>
            <div className="space-y-1">
              <Label className="text-[11px]">JSON-LD</Label>
              <select
                value={input.jsonLdType}
                onChange={(e) => update("jsonLdType", e.target.value as JsonLdType | "")}
                className="h-9 w-full text-xs rounded border bg-background px-2"
              >
                <option value="">(none)</option>
                {JSON_LD_TYPES.map((j) => <option key={j.value} value={j.value}>{j.label}</option>)}
              </select>
            </div>
          </div>
          <div className="grid sm:grid-cols-3 gap-2">
            <div className="space-y-1.5">
              <Label htmlFor="mtb-twsite" className="text-[11px]">Twitter site @</Label>
              <Input
                id="mtb-twsite"
                value={input.twitterSite}
                onChange={(e) => update("twitterSite", e.target.value)}
                placeholder="@yoursite"
                className="font-mono text-xs"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="mtb-twcreator" className="text-[11px]">Twitter creator @</Label>
              <Input
                id="mtb-twcreator"
                value={input.twitterCreator}
                onChange={(e) => update("twitterCreator", e.target.value)}
                placeholder="@author"
                className="font-mono text-xs"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="mtb-locale" className="text-[11px]">Locale</Label>
              <Input
                id="mtb-locale"
                value={input.locale}
                onChange={(e) => update("locale", e.target.value)}
                placeholder="en_US"
                className="font-mono text-xs"
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="mtb-kw" className="text-[11px]">Keywords (comma-separated)</Label>
            <Input
              id="mtb-kw"
              value={input.keywords.join(", ")}
              onChange={(e) => update("keywords", e.target.value.split(",").map((s) => s.trim()).filter(Boolean))}
              placeholder="on-page seo, meta tags, 2025"
              className="font-mono text-xs"
            />
          </div>
          <div className="flex flex-wrap gap-1.5 pt-1">
            {SAMPLE_PAGES.map((s) => (
              <Button key={s.label} variant="ghost" size="sm" className="h-6 text-[11px]" onClick={() => handleSample(s)}>
                + {s.label}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* On-device AI drafting */}
      <Card>
        <CardContent className="p-4 space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
              <Wand2 className="h-4 w-4" /> On-device drafting
            </h3>
            <Button variant="ghost" size="sm" className="h-6 text-[11px]" onClick={() => setShowLlm((v) => !v)}>
              <Key className="h-3 w-3 mr-1" /> {showLlm ? "Hide" : "BYO key LLM"}
            </Button>
          </div>
          <Textarea
            value={contentText}
            onChange={(e) => setContentText(e.target.value)}
            placeholder="Paste page content (article text, product description, etc.) to draft title + description…"
            className="min-h-[80px] resize-y font-mono text-xs"
          />
          {keywordSuggestions.length > 0 && (
            <div className="flex flex-wrap gap-1">
              <span className="text-[10px] text-muted-foreground py-0.5">Top keywords:</span>
              {keywordSuggestions.map((kw) => (
                <Badge key={kw} variant="outline" className="text-[10px]">{kw}</Badge>
              ))}
            </div>
          )}
          <div className="flex flex-wrap gap-2">
            <Button size="sm" onClick={handleDraftFromContent} disabled={!contentText.trim()}>
              <Sparkles className="h-3.5 w-3.5 mr-1.5" /> Draft from content
            </Button>
          </div>
          {showLlm && (
            <div className="space-y-2 pt-2 border-t">
              <div className="grid sm:grid-cols-2 gap-2">
                <select
                  value={llmProvider}
                  onChange={(e) => setLlmProvider(e.target.value as "openai" | "anthropic")}
                  className="h-9 text-xs rounded border bg-background px-2"
                >
                  <option value="openai">OpenAI (gpt-4o-mini)</option>
                  <option value="anthropic">Anthropic (claude-3-5-haiku)</option>
                </select>
                <Input
                  type="password"
                  value={llmKey}
                  onChange={(e) => setLlmKey(e.target.value)}
                  placeholder="Paste API key (stored locally)"
                  className="font-mono text-xs"
                />
              </div>
              <Button size="sm" onClick={handleEnhanceWithLlm} disabled={llmLoading || !contentText.trim() || !llmKey}>
                {llmLoading ? "Working…" : "Enhance with LLM"}
              </Button>
              {llmError && <ErrorBanner message={llmError} />}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Live preview */}
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
              <Eye className="h-4 w-4" /> Live preview
            </h3>
            <div className="flex flex-wrap gap-1">
              {PREVIEW_PLATFORMS.map((p) => (
                <Button
                  key={p.value}
                  size="sm"
                  variant={activePlatform === p.value ? "default" : "outline"}
                  className="h-7 text-[11px]"
                  onClick={() => setActivePlatform(p.value)}
                >
                  {p.label}
                </Button>
              ))}
            </div>
          </div>
          <PreviewCard preview={activePreview} />
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
            <Stat label="Title chars" value={`${titleCheck.chars}/${titleCheck.maxChars}`} status={titleCheck.status} />
            <Stat label="Title px" value={`${titleCheck.pixels}/${titleCheck.maxPixels}`} status={titleCheck.status} />
            <Stat label="Desc chars" value={`${descCheck.chars}/${descCheck.maxChars}`} status={descCheck.status} />
            <Stat label="Desc px" value={`${descCheck.pixels}/${descCheck.maxPixels}`} status={descCheck.status} />
          </div>
        </CardContent>
      </Card>

      {/* Generated HTML */}
      <Card>
        <CardContent className="p-4 space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
              <FileCode className="h-4 w-4" /> Generated HTML
            </h3>
            <div className="flex flex-wrap gap-2">
              <CopyButton getText={() => { handleSaveHistory(); return html; }} label="Copy HTML" />
              <DownloadButton
                getText={() => { handleSaveHistory(); return html; }}
                filename="meta-tags.html"
                mime="text/html"
                label="Download .html"
              />
              <ShareButton getUrl={() => { handleSaveHistory(); return buildShareUrl(input); }} />
              <ClearButton onClick={handleClear} />
            </div>
          </div>
          <pre className="rounded border bg-muted/40 p-3 overflow-auto max-h-[500px] text-[11px] font-mono leading-relaxed">
{html}
          </pre>
        </CardContent>
      </Card>

      {/* History */}
      {history.length > 0 && (
        <Card>
          <CardContent className="p-4 space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <History className="h-4 w-4" /> Recent ({history.length}/{HISTORY_MAX})
              </h3>
              <Button variant="ghost" size="sm" onClick={handleClearHistory}>Clear</Button>
            </div>
            <div className="space-y-1">
              {history.slice(0, 5).map((h, i) => (
                <button
                  key={i}
                  className="w-full text-left rounded border bg-background px-3 py-1.5 text-xs hover:bg-muted/40"
                  onClick={() => setInput((prev) => ({ ...prev, title: h.title, description: h.description, url: h.url, ogType: h.ogType, twitterCard: h.twitterCard, robots: h.robots }))}
                >
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-[10px]">{h.ogType}</Badge>
                    <Badge variant="outline" className="text-[10px]">{h.robots}</Badge>
                    <span className="font-mono text-muted-foreground truncate">{h.title || "(no title)"}</span>
                  </div>
                  <div className="text-[10px] text-muted-foreground mt-0.5">{new Date(h.ts).toLocaleString()}</div>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Honesty notes */}
      <Card>
        <CardContent className="p-3 space-y-1">
          <h4 className="text-xs font-semibold text-foreground flex items-center gap-1.5">
            <AlertTriangle className="h-3.5 w-3.5" /> Honesty notes
          </h4>
          <ul className="text-xs text-muted-foreground list-disc pl-5 space-y-0.5">
            {HONESTY_NOTES.map((n, i) => <li key={i}>{n}</li>)}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}

function LengthMeter({ check }: { check: { chars: number; maxChars: number; pixels: number; maxPixels: number; status: LengthStatus } }) {
  const pct = Math.min(100, Math.round((check.pixels / check.maxPixels) * 100));
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
        <div className={`h-full ${STATUS_BG[check.status]}`} style={{ width: `${pct}%` }} />
      </div>
      <span className={`text-[10px] font-mono ${STATUS_COLORS[check.status]}`}>
        {check.chars}/{check.maxChars}c · {check.pixels}px
      </span>
    </div>
  );
}

function Stat({ label, value, status }: { label: string; value: string; status: LengthStatus }) {
  return (
    <div className="rounded border bg-background px-3 py-2">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className={`text-sm font-semibold ${STATUS_COLORS[status]}`}>{value}</div>
    </div>
  );
}

function PreviewCard({ preview }: { preview: ReturnType<typeof buildAllPreviews>[number] }) {
  if (preview.platform === "google") {
    return (
      <div className="rounded border bg-background p-3 max-w-[600px]">
        <div className="text-[12px] text-emerald-700 dark:text-emerald-500 truncate">{preview.url || "example.com"}</div>
        <div className="text-[18px] text-blue-700 dark:text-blue-400 leading-snug mt-0.5 hover:underline cursor-pointer">
          {preview.title || "Page Title"}
        </div>
        <div className="text-[13px] text-muted-foreground mt-0.5 leading-snug">
          {preview.description || "Page description…"}
        </div>
      </div>
    );
  }
  // Social-style preview (Facebook / X / LinkedIn / Slack / Discord).
  return (
    <div className="rounded border bg-background overflow-hidden max-w-[600px]">
      {preview.imageUrl ? (
        <div className="aspect-[1200/630] bg-muted flex items-center justify-center overflow-hidden">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={preview.imageUrl} alt="" className="w-full h-full object-cover" />
        </div>
      ) : (
        <div className="aspect-[1200/630] bg-muted flex items-center justify-center text-[10px] text-muted-foreground">
          No image set
        </div>
      )}
      <div className="p-3 space-y-1">
        <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
          {preview.siteName || preview.url}
        </div>
        <div className="text-[15px] font-semibold text-foreground leading-snug">
          {preview.title || "Page Title"}
        </div>
        <div className="text-[12px] text-muted-foreground leading-snug">
          {preview.description || "Page description…"}
        </div>
      </div>
    </div>
  );
}
