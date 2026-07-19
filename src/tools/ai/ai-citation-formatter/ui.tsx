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
  RunButton,
  ErrorBanner,
} from "../../_shared";
import { toast } from "sonner";
import {
  HISTORY_MAX,
  LIBRARY_MAX,
  LLM_KEY_STORAGE,
  STYLE_LABELS,
  TYPE_LABELS,
  SORT_LABELS,
  DEFAULT_STYLE,
  DEFAULT_TYPE,
  parseAuthors,
  validateSource,
  formatCitation,
  formatBibliography,
  sortSources,
  renderPlain,
  renderMarkdown,
  renderHtml,
  renderBibtex,
  renderRis,
  renderJson,
  honestyNote,
  loadHistory,
  saveHistory,
  clearHistory,
  loadLibrary,
  saveLibraryEntry,
  removeLibraryEntry,
  clearLibrary,
  buildShareUrl,
  parseShareUrl,
  buildLlmPrompt,
  renderLlmResult,
  generateId,
  resetIeeeCounter,
  type CitationStyle,
  type SourceType,
  type Source,
  type FormattedCitation,
  type LibraryEntry,
  type HistoryEntry,
  type SortMode,
  type LlmEnhancement,
} from "./logic";
import {
  Quote, Key, History, ShieldAlert, Wand2, Trash2,
  BookOpen, FileText, Globe, Newspaper, AlertCircle,
} from "lucide-react";

const TYPE_ICONS: Record<SourceType, React.ReactNode> = {
  book: <BookOpen className="h-3.5 w-3.5" />,
  journal: <FileText className="h-3.5 w-3.5" />,
  website: <Globe className="h-3.5 w-3.5" />,
  newspaper: <Newspaper className="h-3.5 w-3.5" />,
};

const EMPTY_SOURCE: Source = {
  id: "",
  type: DEFAULT_TYPE,
  title: "",
  authors: [],
  year: "",
};

export default function AiCitationFormatter() {
  const [style, setStyle] = useState<CitationStyle>(DEFAULT_STYLE);
  const [source, setSource] = useState<Source>(EMPTY_SOURCE);
  const [authorsText, setAuthorsText] = useState("");
  const [library, setLibrary] = useState<LibraryEntry[]>([]);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [sortMode, setSortMode] = useState<SortMode>("alpha");
  const [error, setError] = useState("");
  const [showLlm, setShowLlm] = useState(false);
  const [llmKey, setLlmKey] = useState("");
  const [llmProvider, setLlmProvider] = useState<"openai" | "anthropic">("openai");
  const [llmLoading, setLlmLoading] = useState(false);
  const [llmError, setLlmError] = useState("");
  const [llmResult, setLlmResult] = useState<LlmEnhancement | null>(null);

  useEffect(() => {
    setLibrary(loadLibrary());
    setHistory(loadHistory());
    const key = typeof localStorage !== "undefined"
      ? localStorage.getItem(LLM_KEY_STORAGE)
      : null;
    if (key) setLlmKey(key);
    if (typeof window !== "undefined" && window.location.hash) {
      const p = parseShareUrl(window.location.hash);
      if (p.style) setStyle(p.style);
      if (p.source) {
        const next: Source = {
          ...EMPTY_SOURCE,
          ...p.source,
          id: p.source.id || generateId(),
        } as Source;
        setSource(next);
        if (p.source.authors) {
          setAuthorsText(p.source.authors.map((a) => `${a.last}, ${a.first}`).join("\n"));
        }
        toast.info("Loaded from share link");
      }
    }
  }, []);

  const effectiveSource = useMemo<Source>(() => ({
    ...source,
    id: source.id || generateId(),
    authors: parseAuthors(authorsText),
  }), [source, authorsText]);

  const warnings = useMemo(() => validateSource(effectiveSource), [effectiveSource]);
  const currentCitation = useMemo(
    () => formatCitation(effectiveSource, style),
    [effectiveSource, style],
  );

  const sortedLibrary = useMemo(() => {
    const sources = library.map((e) => e.source);
    const sorted = sortSources(sources, sortMode);
    return sorted.map((s) => ({
      source: s,
      citation: formatCitation(s, style),
    }));
  }, [library, sortMode, style]);

  const bibliography = useMemo(() => {
    const sources = library.map((e) => e.source);
    if (sources.length === 0) return [];
    return formatBibliography(sortSources(sources, sortMode), style);
  }, [library, sortMode, style]);

  const handleAddToLibrary = useCallback(() => {
    if (!effectiveSource.title.trim()) {
      toast.error("Enter a title first");
      return;
    }
    const next = saveLibraryEntry(effectiveSource);
    setLibrary(next);
    saveHistory({
      ts: Date.now(),
      style,
      type: effectiveSource.type,
      title: effectiveSource.title,
    });
    setHistory(loadHistory());
    toast.success(`Added "${effectiveSource.title}" to library`);
  }, [effectiveSource, style]);

  const handleRemoveFromLibrary = useCallback((id: string) => {
    const next = removeLibraryEntry(id);
    setLibrary(next);
    toast.info("Removed from library");
  }, []);

  const handleClear = useCallback(() => {
    setSource(EMPTY_SOURCE);
    setAuthorsText("");
    setError("");
    toast.info("Cleared form");
  }, []);

  const handleClearHistory = useCallback(() => {
    clearHistory();
    setHistory([]);
    toast.success("History cleared");
  }, []);

  const handleClearLibrary = useCallback(() => {
    clearLibrary();
    setLibrary([]);
    toast.success("Library cleared");
  }, []);

  const handleTypeChange = (t: SourceType) => {
    setSource((prev) => ({ ...prev, type: t }));
  };

  const handleLlmPolish = useCallback(async () => {
    if (!llmKey) {
      toast.error("Paste your LLM API key first");
      return;
    }
    if (!effectiveSource.title.trim()) {
      toast.error("Enter a title first");
      return;
    }
    setLlmLoading(true);
    setLlmError("");
    setLlmResult(null);
    try {
      if (typeof localStorage !== "undefined") {
        localStorage.setItem(LLM_KEY_STORAGE, llmKey);
      }
      const prompt = buildLlmPrompt(effectiveSource, style);
      const url = llmProvider === "openai"
        ? "https://api.openai.com/v1/chat/completions"
        : "https://api.anthropic.com/v1/messages";
      const res = await fetch(url, {
        method: "POST",
        headers: llmProvider === "openai"
          ? { "Content-Type": "application/json", Authorization: `Bearer ${llmKey}` }
          : {
              "Content-Type": "application/json",
              "x-api-key": llmKey,
              "anthropic-version": "2023-06-01",
            },
        body: JSON.stringify(
          llmProvider === "openai"
            ? {
                model: "gpt-4o-mini",
                messages: [
                  { role: "system", content: "You are an academic citation assistant. Always respond with valid JSON." },
                  { role: "user", content: prompt },
                ],
                temperature: 0.5,
              }
            : {
                model: "claude-3-5-haiku-latest",
                max_tokens: 1500,
                system: "You are an academic citation assistant. Always respond with valid JSON.",
                messages: [{ role: "user", content: prompt }],
              },
        ),
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`LLM API ${res.status}: ${text.slice(0, 200)}`);
      }
      const data = await res.json();
      const raw = llmProvider === "openai"
        ? (data.choices?.[0]?.message?.content ?? "")
        : (data.content?.[0]?.text ?? "");
      const parsed = renderLlmResult(raw);
      if (!parsed.ok) throw new Error(parsed.error);
      setLlmResult(parsed.result);
      toast.success("LLM polish complete");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "LLM polish failed";
      setLlmError(msg);
      toast.error(msg);
    } finally {
      setLlmLoading(false);
    }
  }, [llmKey, llmProvider, effectiveSource, style]);

  return (
    <div className="space-y-4 unq-animate-fade-in-up">
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <Field label="Citation style">
              <select
                className="h-9 w-full rounded border bg-background px-2 text-sm"
                value={style}
                onChange={(e) => setStyle(e.target.value as CitationStyle)}
              >
                {(Object.keys(STYLE_LABELS) as CitationStyle[]).map((s) => (
                  <option key={s} value={s}>{STYLE_LABELS[s]}</option>
                ))}
              </select>
            </Field>
            <Field label="Source type">
              <select
                className="h-9 w-full rounded border bg-background px-2 text-sm"
                value={source.type}
                onChange={(e) => handleTypeChange(e.target.value as SourceType)}
              >
                {(Object.keys(TYPE_LABELS) as SourceType[]).map((t) => (
                  <option key={t} value={t}>{TYPE_LABELS[t]}</option>
                ))}
              </select>
            </Field>
            <Field label="Year">
              <Input
                value={source.year}
                onChange={(e) => setSource((p) => ({ ...p, year: e.target.value }))}
                placeholder="2024"
                className="h-9 text-sm"
              />
            </Field>
          </div>
          <Field label="Title">
            <Input
              value={source.title}
              onChange={(e) => setSource((p) => ({ ...p, title: e.target.value }))}
              placeholder="The title of the work"
              className="h-9 text-sm"
            />
          </Field>
          <Field label="Authors (one per line, or separated by ';' — accepts 'Last, First' or 'First Last')">
            <Textarea
              value={authorsText}
              onChange={(e) => setAuthorsText(e.target.value)}
              placeholder={"Doe, Jane\nSmith, John"}
              className="min-h-[60px] resize-y font-mono text-xs"
            />
            <div className="text-[10px] text-muted-foreground mt-1">
              Parsed: {effectiveSource.authors.length} author(s)
              {effectiveSource.authors.length > 0 && (
                <span className="ml-2">
                  {effectiveSource.authors.map((a) => `${a.last}, ${a.first}`).join("; ")}
                </span>
              )}
            </div>
          </Field>

          {source.type === "book" && (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <Field label="Publisher">
                <Input
                  value={source.publisher ?? ""}
                  onChange={(e) => setSource((p) => ({ ...p, publisher: e.target.value }))}
                  className="h-9 text-sm"
                />
              </Field>
              <Field label="City">
                <Input
                  value={source.city ?? ""}
                  onChange={(e) => setSource((p) => ({ ...p, city: e.target.value }))}
                  className="h-9 text-sm"
                />
              </Field>
              <Field label="Edition">
                <Input
                  value={source.edition ?? ""}
                  onChange={(e) => setSource((p) => ({ ...p, edition: e.target.value }))}
                  placeholder="2nd"
                  className="h-9 text-sm"
                />
              </Field>
              <Field label="ISBN">
                <Input
                  value={source.isbn ?? ""}
                  onChange={(e) => setSource((p) => ({ ...p, isbn: e.target.value }))}
                  className="h-9 text-sm font-mono"
                />
              </Field>
            </div>
          )}

          {source.type === "journal" && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <Field label="Journal">
                <Input
                  value={source.journal ?? ""}
                  onChange={(e) => setSource((p) => ({ ...p, journal: e.target.value }))}
                  className="h-9 text-sm"
                />
              </Field>
              <Field label="Volume">
                <Input
                  value={source.volume ?? ""}
                  onChange={(e) => setSource((p) => ({ ...p, volume: e.target.value }))}
                  className="h-9 text-sm font-mono"
                />
              </Field>
              <Field label="Issue">
                <Input
                  value={source.issue ?? ""}
                  onChange={(e) => setSource((p) => ({ ...p, issue: e.target.value }))}
                  className="h-9 text-sm font-mono"
                />
              </Field>
              <Field label="Pages">
                <Input
                  value={source.pages ?? ""}
                  onChange={(e) => setSource((p) => ({ ...p, pages: e.target.value }))}
                  placeholder="12-34"
                  className="h-9 text-sm font-mono"
                />
              </Field>
              <Field label="DOI">
                <Input
                  value={source.doi ?? ""}
                  onChange={(e) => setSource((p) => ({ ...p, doi: e.target.value }))}
                  placeholder="10.xxxx/xxxx"
                  className="h-9 text-sm font-mono"
                />
              </Field>
            </div>
          )}

          {source.type === "website" && (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <Field label="Site name">
                <Input
                  value={source.siteName ?? ""}
                  onChange={(e) => setSource((p) => ({ ...p, siteName: e.target.value }))}
                  className="h-9 text-sm"
                />
              </Field>
              <Field label="URL">
                <Input
                  value={source.url ?? ""}
                  onChange={(e) => setSource((p) => ({ ...p, url: e.target.value }))}
                  placeholder="https://"
                  className="h-9 text-sm font-mono"
                />
              </Field>
              <Field label="Published date">
                <Input
                  type="date"
                  value={source.publishedDate ?? ""}
                  onChange={(e) => setSource((p) => ({ ...p, publishedDate: e.target.value }))}
                  className="h-9 text-sm"
                />
              </Field>
              <Field label="Accessed date">
                <Input
                  type="date"
                  value={source.accessedDate ?? ""}
                  onChange={(e) => setSource((p) => ({ ...p, accessedDate: e.target.value }))}
                  className="h-9 text-sm"
                />
              </Field>
            </div>
          )}

          {source.type === "newspaper" && (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <Field label="Newspaper">
                <Input
                  value={source.newspaper ?? ""}
                  onChange={(e) => setSource((p) => ({ ...p, newspaper: e.target.value }))}
                  className="h-9 text-sm"
                />
              </Field>
              <Field label="Section">
                <Input
                  value={source.section ?? ""}
                  onChange={(e) => setSource((p) => ({ ...p, section: e.target.value }))}
                  className="h-9 text-sm"
                />
              </Field>
              <Field label="Published date">
                <Input
                  type="date"
                  value={source.publishedDate ?? ""}
                  onChange={(e) => setSource((p) => ({ ...p, publishedDate: e.target.value }))}
                  className="h-9 text-sm"
                />
              </Field>
              <Field label="Pages">
                <Input
                  value={source.pages ?? ""}
                  onChange={(e) => setSource((p) => ({ ...p, pages: e.target.value }))}
                  className="h-9 text-sm font-mono"
                />
              </Field>
              <Field label="URL">
                <Input
                  value={source.url ?? ""}
                  onChange={(e) => setSource((p) => ({ ...p, url: e.target.value }))}
                  className="h-9 text-sm font-mono"
                />
              </Field>
            </div>
          )}
        </CardContent>
      </Card>

      {warnings.length > 0 && (
        <div className="rounded-lg border border-amber-300/60 bg-amber-50 dark:bg-amber-950/30 p-3 text-xs space-y-1">
          {warnings.map((w, i) => (
            <div key={i} className="flex items-start gap-1.5">
              <AlertCircle className="h-3.5 w-3.5 flex-shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
              <span className="text-amber-800 dark:text-amber-200">{w}</span>
            </div>
          ))}
        </div>
      )}

      <Card>
        <CardContent className="p-4 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <RunButton onClick={handleAddToLibrary} label="Add to library" />
            <ShareButton getUrl={() => buildShareUrl(effectiveSource, style)} />
            <ClearButton onClick={handleClear} />
          </div>
        </CardContent>
      </Card>

      {error && <ErrorBanner message={error} />}

      {currentCitation && source.title.trim() && (
        <Card>
          <CardContent className="p-4 space-y-2">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
              <Quote className="h-4 w-4" /> Preview — {STYLE_LABELS[style]} · {TYPE_LABELS[source.type]}
            </h3>
            <div className="rounded border bg-background p-3 text-sm">
              <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Reference list entry</div>
              <p className="mt-1 text-foreground">{currentCitation.reference}</p>
            </div>
            <div className="rounded border bg-background p-3 text-sm">
              <div className="text-[10px] uppercase tracking-wide text-muted-foreground">In-text citation</div>
              <p className="mt-1 text-foreground font-mono">{currentCitation.inText}</p>
            </div>
            <div className="rounded border bg-muted/40 p-2 text-[10px] text-muted-foreground">
              <span className="font-mono">{currentCitation.bibtexKey}</span> (BibTeX key)
            </div>
            <div className="flex flex-wrap gap-2">
              <CopyButton getText={() => currentCitation.reference} label="Copy reference" />
              <CopyButton getText={() => currentCitation.inText} label="Copy in-text" />
            </div>
          </CardContent>
        </Card>
      )}

      {library.length > 0 ? (
        <>
          <Card>
            <CardContent className="p-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                  <Quote className="h-4 w-4" /> Reference list ({library.length}/{LIBRARY_MAX})
                </h3>
                <div className="flex items-center gap-2">
                  <select
                    className="h-8 text-xs rounded border bg-background px-2"
                    value={sortMode}
                    onChange={(e) => setSortMode(e.target.value as SortMode)}
                  >
                    {(Object.keys(SORT_LABELS) as SortMode[]).map((m) => (
                      <option key={m} value={m}>{SORT_LABELS[m]}</option>
                    ))}
                  </select>
                  <Button variant="ghost" size="sm" onClick={handleClearLibrary}>Clear</Button>
                </div>
              </div>
              <div className="space-y-1.5 max-h-[400px] overflow-auto">
                {sortedLibrary.map(({ source: s, citation }) => (
                  <div key={s.id} className="rounded border bg-background p-2.5 text-xs">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1">
                        <div className="flex items-center gap-1.5 mb-1">
                          <Badge variant="outline" className="text-[10px]">
                            {TYPE_ICONS[s.type]} {TYPE_LABELS[s.type]}
                          </Badge>
                          {citation.warnings.length > 0 && (
                            <Badge variant="outline" className="text-[10px] text-amber-700 dark:text-amber-300">
                              ⚠ {citation.warnings.length}
                            </Badge>
                          )}
                        </div>
                        <p className="text-foreground">{citation.reference}</p>
                        <p className="text-muted-foreground mt-1 font-mono text-[10px]">In-text: {citation.inText}</p>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 flex-shrink-0"
                        onClick={() => handleRemoveFromLibrary(s.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
              <div className="flex flex-wrap gap-2 pt-2">
                <CopyButton getText={() => renderPlain(bibliography)} label="Copy plain" />
                <DownloadButton getText={() => renderPlain(bibliography)} filename="references.txt" mime="text/plain" label=".txt" />
                <DownloadButton getText={() => renderMarkdown(bibliography)} filename="references.md" mime="text/markdown" label=".md" />
                <DownloadButton getText={() => renderHtml(bibliography)} filename="references.html" mime="text/html" label=".html" />
                <DownloadButton
                  getText={() => renderBibtex(bibliography, library.map((e) => e.source))}
                  filename="references.bib"
                  mime="application/x-bibtex"
                  label=".bib"
                />
                <DownloadButton
                  getText={() => renderRis(bibliography, library.map((e) => e.source))}
                  filename="references.ris"
                  mime="application/x-research-info-systems"
                  label=".ris"
                />
                <DownloadButton
                  getText={() => renderJson(bibliography, library.map((e) => e.source), style)}
                  filename="references.json"
                  mime="application/json"
                  label=".json"
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowLlm((s) => !s)}
                className="gap-1.5"
              >
                <Wand2 className="h-3.5 w-3.5" /> {showLlm ? "Hide" : "Show"} optional LLM polish (BYO key)
              </Button>
              {showLlm && (
                <div className="mt-3 space-y-2">
                  <div className="rounded border bg-amber-50 dark:bg-amber-950/30 p-2 text-[11px] text-amber-800 dark:text-amber-200 flex items-start gap-1.5">
                    <ShieldAlert className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" />
                    <span>
                      Optional LLM polish sends your current source details to your chosen LLM
                      provider (OpenAI or Anthropic) using <strong>your own API key</strong>,
                      stored only in this browser. The LLM may suggest refinements — always
                      verify against the original source. Skip this for 100% offline use.
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-2 items-center">
                    <select
                      className="h-9 rounded border bg-background px-2 text-xs"
                      value={llmProvider}
                      onChange={(e) => setLlmProvider(e.target.value as "openai" | "anthropic")}
                    >
                      <option value="openai">OpenAI</option>
                      <option value="anthropic">Anthropic</option>
                    </select>
                    <Input
                      type="password"
                      placeholder="Paste your API key (sk-... or sk-ant-...)"
                      value={llmKey}
                      onChange={(e) => setLlmKey(e.target.value)}
                      className="h-9 flex-1 min-w-[200px] font-mono text-xs"
                    />
                    <RunButton onClick={handleLlmPolish} loading={llmLoading} label="Polish with LLM" />
                  </div>
                  {llmError && <ErrorBanner message={llmError} />}
                  {llmResult && (
                    <div className="rounded border bg-background p-3 text-xs space-y-2">
                      {llmResult.refinedTitle && (
                        <div>
                          <strong className="text-foreground">Refined title:</strong>
                          <p className="text-muted-foreground mt-1">{llmResult.refinedTitle}</p>
                        </div>
                      )}
                      {llmResult.suggestedAuthors.length > 0 && (
                        <div>
                          <strong className="text-foreground">Suggested authors:</strong>
                          <ul className="mt-1 list-disc list-inside text-muted-foreground">
                            {llmResult.suggestedAuthors.map((a, i) => <li key={i}>{a}</li>)}
                          </ul>
                        </div>
                      )}
                      {llmResult.notes.length > 0 && (
                        <div>
                          <strong className="text-foreground">Notes:</strong>
                          <ul className="mt-1 list-disc list-inside text-muted-foreground">
                            {llmResult.notes.map((n, i) => <li key={i}>{n}</li>)}
                          </ul>
                        </div>
                      )}
                      {llmResult.missingFields.length > 0 && (
                        <div>
                          <strong className="text-foreground">Missing fields to verify:</strong>
                          <ul className="mt-1 list-disc list-inside text-amber-700 dark:text-amber-300">
                            {llmResult.missingFields.map((n, i) => <li key={i}>{n}</li>)}
                          </ul>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </>
      ) : (
        <EmptyState
          title="Enter source details and click 'Add to library'"
          hint="Build a multi-source reference list, switch citation styles instantly, sort, and export to plain text / Markdown / HTML / BibTeX / RIS / JSON."
          icon={<Quote className="h-8 w-8" />}
        />
      )}

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
                <div key={i} className="rounded border bg-background px-3 py-2 text-xs flex flex-wrap items-center gap-2">
                  <Badge variant="outline" className="text-[10px]">{STYLE_LABELS[h.style].split(" ")[0]}</Badge>
                  <Badge variant="outline" className="text-[10px]">{TYPE_LABELS[h.type]}</Badge>
                  <span className="font-mono text-foreground truncate max-w-[300px]">{h.title}</span>
                  <span className="text-muted-foreground ml-auto">{new Date(h.ts).toLocaleString()}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-3">
          <p className="text-xs text-muted-foreground">
            <strong className="text-foreground">Privacy + Honesty:</strong> {honestyNote()}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      {children}
    </div>
  );
}
