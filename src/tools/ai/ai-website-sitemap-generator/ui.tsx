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
  Network, History, Key, Sparkles, FileCode, FileText, TreePine,
  Braces, FileJson, ListTree, AlertTriangle,
} from "lucide-react";
import {
  SITE_TYPE_LABELS,
  CHANGEFREQ_LABELS,
  CHANGEFREQ_VALUES,
  loadTemplate,
  parseUrls,
  dedupeUrls,
  applyExcludePatterns,
  buildSitemap,
  renderXmlSitemap,
  renderSitemapIndex,
  renderAllXmlChunks,
  renderHtmlSitemap,
  renderVisualTree,
  renderJson,
  renderMarkdown,
  renderTextList,
  splitIntoChunks,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  buildLlmPrompt,
  renderLlmResult,
  type SiteType,
  type HistoryEntry,
  type ShareState,
} from "./logic";

type Tab = "xml" | "index" | "html" | "visual" | "json" | "markdown" | "text";

const ALL_SITE_TYPES = Object.keys(SITE_TYPE_LABELS) as SiteType[];

export default function AIWebsiteSitemapGenerator() {
  const [siteType, setSiteType] = useState<SiteType>("blog");
  const [rootUrl, setRootUrl] = useState("https://example.com");
  const [customUrlsText, setCustomUrlsText] = useState("");
  const [excludesText, setExcludesText] = useState("");
  const [defaultLastmod, setDefaultLastmod] = useState("");
  const [useTemplate, setUseTemplate] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>("xml");
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [llmKey, setLlmKey] = useState("");
  const [llmLoading, setLlmLoading] = useState(false);
  const [showLlm, setShowLlm] = useState(false);
  const [llmSuggestions, setLlmSuggestions] = useState<string[]>([]);

  useEffect(() => {
    setHistory(loadHistory());
    if (typeof window !== "undefined" && window.location.hash) {
      const p = parseShareUrl(window.location.hash);
      setSiteType(p.siteType);
      setCustomUrlsText(p.customUrls);
      setExcludesText(p.excludes);
      setDefaultLastmod(p.defaultLastmod);
      setUseTemplate(p.useTemplate);
      if (p.customUrls || p.excludes || p.defaultLastmod) toast.info("Loaded from share link");
    }
  }, []);

  const excludes = useMemo(
    () => excludesText.split(/[\n,]+/).map((s) => s.trim()).filter(Boolean),
    [excludesText],
  );
  const customUrls = useMemo(() => parseUrls(customUrlsText), [customUrlsText]);

  const result = useMemo(() => buildSitemap({
    siteType,
    rootUrl,
    customUrls,
    excludes,
    defaultLastmod: defaultLastmod || undefined,
    useTemplate,
  }), [siteType, rootUrl, customUrls, excludes, defaultLastmod, useTemplate]);

  const xmlMain = useMemo(
    () => result.chunked.length > 0 ? renderXmlSitemap(result.chunked[0]) : "",
    [result.chunked],
  );
  const xmlIndex = useMemo(
    () => result.needsIndex
      ? renderSitemapIndex(result.chunked, rootUrl, defaultLastmod || undefined)
      : "",
    [result.chunked, result.needsIndex, rootUrl, defaultLastmod],
  );
  const html = useMemo(() => renderHtmlSitemap(result.urls), [result.urls]);
  const visual = useMemo(() => renderVisualTree(result.tree), [result.tree]);
  const json = useMemo(() => renderJson(result.urls), [result.urls]);
  const markdown = useMemo(() => renderMarkdown(result.urls), [result.urls]);
  const textList = useMemo(() => renderTextList(result.urls), [result.urls]);

  const allXmlChunks = useMemo(() => renderAllXmlChunks(result.chunked), [result.chunked]);

  const handleSaveHistory = useCallback(() => {
    if (result.urls.length === 0) return;
    const sectionCounts = Object.entries(result.stats.bySection);
    const topSection = sectionCounts.sort((a, b) => b[1] - a[1])[0]?.[0] ?? "root";
    saveHistory({
      ts: Date.now(),
      siteType,
      urlCount: result.urls.length,
      chunkCount: result.chunked.length,
      needsIndex: result.needsIndex,
      topSection,
    });
    setHistory(loadHistory());
  }, [result, siteType]);

  const handleDownloadAllChunks = useCallback(() => {
    allXmlChunks.forEach((xml, i) => {
      const blob = new Blob([xml], { type: "application/xml" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `sitemap-${i + 1}.xml`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    });
    handleSaveHistory();
    toast.success(`Downloaded ${allXmlChunks.length} sitemap file(s)`);
  }, [allXmlChunks, handleSaveHistory]);

  const handleClear = useCallback(() => {
    setCustomUrlsText("");
    setExcludesText("");
    setDefaultLastmod("");
    setUseTemplate(true);
    setSiteType("blog");
    setRootUrl("https://example.com");
    setLlmSuggestions([]);
    toast.info("Cleared");
  }, []);

  const handleClearHistory = useCallback(() => {
    clearHistory();
    setHistory([]);
    toast.success("History cleared");
  }, []);

  const shareState: ShareState = useMemo(() => ({
    siteType,
    customUrls: customUrlsText,
    excludes: excludesText,
    defaultLastmod,
    useTemplate,
  }), [siteType, customUrlsText, excludesText, defaultLastmod, useTemplate]);

  const handleLlmEnhance = useCallback(async () => {
    if (!llmKey) {
      toast.error("Paste your LLM API key first");
      return;
    }
    setLlmLoading(true);
    try {
      const prompt = buildLlmPrompt(rootUrl, siteType, result.urls.length);
      const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${llmKey}`,
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          messages: [
            { role: "system", content: "You are an SEO expert. Return only JSON." },
            { role: "user", content: prompt },
          ],
          temperature: 0.5,
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json() as { choices?: { message?: { content?: string } }[] };
      const text = json.choices?.[0]?.message?.content ?? "";
      const suggestions = renderLlmResult(text);
      setLlmSuggestions(suggestions.map((s) => s.loc));
      toast.success(`LLM suggested ${suggestions.length} additional URL(s)`);
    } catch (e) {
      toast.error(`LLM call failed: ${e instanceof Error ? e.message : "unknown"}`);
    } finally {
      setLlmLoading(false);
    }
  }, [llmKey, rootUrl, siteType, result.urls.length]);

  const templateCount = useMemo(() => loadTemplate(siteType, rootUrl).length, [siteType, rootUrl]);

  return (
    <div className="space-y-4 unq-animate-fade-in-up">
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="sg-root" className="text-xs">Root / domain URL</Label>
              <Input
                id="sg-root"
                value={rootUrl}
                onChange={(e) => setRootUrl(e.target.value)}
                placeholder="https://example.com"
                className="font-mono text-xs"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="sg-type" className="text-xs">Site type</Label>
              <select
                id="sg-type"
                value={siteType}
                onChange={(e) => setSiteType(e.target.value as SiteType)}
                className="h-9 w-full text-xs rounded border bg-background px-2"
              >
                {ALL_SITE_TYPES.map((t) => (
                  <option key={t} value={t}>{SITE_TYPE_LABELS[t]}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs">
            <input
              id="sg-tmpl"
              type="checkbox"
              checked={useTemplate}
              onChange={(e) => setUseTemplate(e.target.checked)}
            />
            <label htmlFor="sg-tmpl" className="cursor-pointer">
              Use <strong>{SITE_TYPE_LABELS[siteType]}</strong> template ({templateCount} URLs)
            </label>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="sg-urls" className="text-xs">
              Paste your own URLs (one per line or comma-separated) — merged with template
            </Label>
            <Textarea
              id="sg-urls"
              value={customUrlsText}
              onChange={(e) => setCustomUrlsText(e.target.value)}
              placeholder={"https://example.com/blog/post-1\nhttps://example.com/blog/post-2"}
              className="min-h-[80px] resize-y font-mono text-xs"
            />
            <div className="text-[11px] text-muted-foreground">
              {customUrls.length} custom URL(s) parsed
              {llmSuggestions.length > 0 && (
                <> · <span className="text-emerald-600 dark:text-emerald-400">{llmSuggestions.length} LLM suggestion(s)</span></>
              )}
            </div>
          </div>

          {llmSuggestions.length > 0 && (
            <div className="rounded border border-emerald-300 dark:border-emerald-700 bg-emerald-50 dark:bg-emerald-950/40 p-2 space-y-1">
              <div className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-300 flex items-center gap-1">
                <Sparkles className="h-3 w-3" /> LLM suggestions — click to add
              </div>
              {llmSuggestions.slice(0, 5).map((u) => (
                <button
                  key={u}
                  onClick={() => setCustomUrlsText((prev) => (prev ? `${prev}\n${u}` : u))}
                  className="block text-[11px] font-mono text-left text-foreground hover:text-primary hover:underline truncate w-full"
                >
                  + {u}
                </button>
              ))}
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="sg-ex" className="text-xs">
              Exclude patterns (regex, one per line — e.g. <code>/tag/</code>, <code>\?.*$</code>)
            </Label>
            <Textarea
              id="sg-ex"
              value={excludesText}
              onChange={(e) => setExcludesText(e.target.value)}
              placeholder={"/tag/\n/author/"}
              className="min-h-[60px] resize-y font-mono text-xs"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="sg-lm" className="text-xs">Default lastmod (YYYY-MM-DD)</Label>
              <Input
                id="sg-lm"
                type="date"
                value={defaultLastmod}
                onChange={(e) => setDefaultLastmod(e.target.value)}
                className="font-mono text-xs"
              />
            </div>
            <div className="flex items-end">
              <Button
                onClick={() => { handleSaveHistory(); toast.success(`Sitemap ready: ${result.urls.length} URLs`); }}
                className="h-9 gap-1.5 text-xs w-full"
              >
                <Network className="h-3.5 w-3.5" /> Generate sitemap
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {result.urls.length > 0 ? (
        <>
          <Card>
            <CardContent className="p-4 space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                  <Network className="h-4 w-4" /> {result.urls.length} URLs · {result.chunked.length} chunk(s)
                  {result.needsIndex && (
                    <Badge variant="secondary" className="text-[10px] ml-1">needs sitemap index</Badge>
                  )}
                </h3>
                <div className="flex gap-2">
                  <ShareButton getUrl={() => { handleSaveHistory(); return buildShareUrl(shareState); }} />
                  <ClearButton onClick={handleClear} />
                </div>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                <Stat label="Total URLs" value={result.stats.total} />
                <Stat label="Sections" value={Object.keys(result.stats.bySection).length} />
                <Stat label="Max depth" value={Math.max(0, ...Object.keys(result.stats.byDepth).map(Number))} />
                <Stat label="Avg priority" value={result.stats.avgPriority.toFixed(1)} />
              </div>
              <div className="pt-1 flex flex-wrap gap-1">
                {Object.entries(result.stats.bySection).slice(0, 12).map(([sec, n]) => (
                  <Badge key={sec} variant="outline" className="text-[10px]">
                    {sec}: {n}
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 space-y-3">
              <div className="flex flex-wrap gap-1 border-b pb-2">
                <TabBtn active={activeTab === "xml"} onClick={() => setActiveTab("xml")} icon={<FileCode className="h-3 w-3" />} label="XML" />
                {result.needsIndex && (
                  <TabBtn active={activeTab === "index"} onClick={() => setActiveTab("index")} icon={<FileCode className="h-3 w-3" />} label="Index" />
                )}
                <TabBtn active={activeTab === "html"} onClick={() => setActiveTab("html")} icon={<FileText className="h-3 w-3" />} label="HTML" />
                <TabBtn active={activeTab === "visual"} onClick={() => setActiveTab("visual")} icon={<TreePine className="h-3 w-3" />} label="Visual tree" />
                <TabBtn active={activeTab === "json"} onClick={() => setActiveTab("json")} icon={<FileJson className="h-3 w-3" />} label="JSON" />
                <TabBtn active={activeTab === "markdown"} onClick={() => setActiveTab("markdown")} icon={<Braces className="h-3 w-3" />} label="Markdown" />
                <TabBtn active={activeTab === "text"} onClick={() => setActiveTab("text")} icon={<ListTree className="h-3 w-3" />} label="Text list" />
              </div>

              <div className="max-h-[500px] overflow-auto rounded border bg-muted/30 p-3">
                <pre className="text-[11px] font-mono text-foreground whitespace-pre-wrap break-all">
                  {activeTab === "xml" && xmlMain}
                  {activeTab === "index" && xmlIndex}
                  {activeTab === "html" && html}
                  {activeTab === "visual" && visual}
                  {activeTab === "json" && json}
                  {activeTab === "markdown" && markdown}
                  {activeTab === "text" && textList}
                </pre>
              </div>

              <div className="flex flex-wrap gap-2">
                <CopyButton
                  getText={() => {
                    handleSaveHistory();
                    if (activeTab === "xml") return xmlMain;
                    if (activeTab === "index") return xmlIndex;
                    if (activeTab === "html") return html;
                    if (activeTab === "visual") return visual;
                    if (activeTab === "json") return json;
                    if (activeTab === "markdown") return markdown;
                    return textList;
                  }}
                  label="Copy current"
                />
                {result.needsIndex ? (
                  <DownloadButton
                    getText={() => { handleSaveHistory(); return xmlIndex; }}
                    filename="sitemap-index.xml"
                    mime="application/xml"
                    label="Download index.xml"
                  />
                ) : (
                  <DownloadButton
                    getText={() => { handleSaveHistory(); return xmlMain; }}
                    filename="sitemap.xml"
                    mime="application/xml"
                    label="Download sitemap.xml"
                  />
                )}
                {result.needsIndex && (
                  <Button onClick={handleDownloadAllChunks} variant="outline" size="sm" className="gap-1.5 text-xs">
                    <FileCode className="h-3.5 w-3.5" /> Download all {result.chunked.length} chunks
                  </Button>
                )}
                <DownloadButton
                  getText={() => html}
                  filename="sitemap.html"
                  mime="text/html"
                  label="HTML"
                />
                <DownloadButton
                  getText={() => json}
                  filename="sitemap.json"
                  mime="application/json"
                  label="JSON"
                />
                <DownloadButton
                  getText={() => markdown}
                  filename="sitemap.md"
                  mime="text/markdown"
                  label="Markdown"
                />
                <DownloadButton
                  getText={() => textList}
                  filename="sitemap-urls.txt"
                  mime="text/plain"
                  label="URLs.txt"
                />
              </div>
            </CardContent>
          </Card>
        </>
      ) : (
        <EmptyState
          title="Enter a root URL and pick a site type to generate a sitemap"
          hint="Choose a template (blog, e-commerce, SaaS, portfolio, docs), paste your own URLs, or both. Output is valid XML + HTML + visual + JSON."
          icon={<Network className="h-8 w-8" />}
        />
      )}

      <Card>
        <CardContent className="p-4 space-y-2">
          <button
            onClick={() => setShowLlm(!showLlm)}
            className="flex items-center gap-1.5 text-sm font-semibold text-foreground"
          >
            <Key className="h-4 w-4" /> Optional: suggest more URLs with your own LLM key
          </button>
          {showLlm && (
            <div className="space-y-2">
              <p className="text-[11px] text-muted-foreground">
                Paste your own OpenAI API key to ask GPT for additional URLs to add to your sitemap. The key is stored only in this browser tab and sent directly to OpenAI — never to us.
              </p>
              <Input
                type="password"
                value={llmKey}
                onChange={(e) => setLlmKey(e.target.value)}
                placeholder="sk-..."
                className="font-mono text-xs"
              />
              <Button onClick={handleLlmEnhance} disabled={llmLoading} size="sm" className="gap-1.5 text-xs">
                {llmLoading ? "Working…" : "Suggest URLs with LLM"}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

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
                  <Badge variant="outline" className="mr-2">{SITE_TYPE_LABELS[h.siteType]}</Badge>
                  <Badge variant="outline" className="mr-2">{h.urlCount} URLs</Badge>
                  <Badge variant="outline" className="mr-2">{h.chunkCount} chunk(s)</Badge>
                  {h.needsIndex && <Badge variant="secondary" className="mr-2">index</Badge>}
                  <span className="text-muted-foreground">top: {h.topSection}</span>
                  <span className="text-muted-foreground ml-2">· {new Date(h.ts).toLocaleString()}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-3 space-y-1">
          <p className="text-xs text-muted-foreground">
            <strong className="text-foreground">Privacy:</strong> All template loading, URL parsing, validation, deduplication, splitting, and XML/HTML rendering run locally in your browser. URL lists never leave this device. The only network call is if you paste your own LLM API key.
          </p>
          <p className="text-[11px] text-muted-foreground flex items-center gap-1">
            <AlertTriangle className="h-3 w-3" />
            Sitemaps are generated from the templates and URLs you provide — this tool does not crawl your live site. For a real production site, paste your full URL list (e.g. from Search Console or a server-side crawl) and validate the output in Google Search Console.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function TabBtn({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`px-2.5 py-1 text-[11px] rounded-t border-b-2 transition-colors flex items-center gap-1 ${
        active
          ? "border-primary text-foreground font-semibold"
          : "border-transparent text-muted-foreground hover:text-foreground"
      }`}
    >
      {icon}{label}
    </button>
  );
}

function Stat({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string | number;
  highlight?: "bad" | "good";
}) {
  const color = highlight === "bad"
    ? "text-red-600 dark:text-red-400"
    : highlight === "good"
      ? "text-emerald-600 dark:text-emerald-400"
      : "text-foreground";
  return (
    <div className="rounded border bg-background px-3 py-2">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className={`text-base font-semibold ${color}`}>{value}</div>
    </div>
  );
}
