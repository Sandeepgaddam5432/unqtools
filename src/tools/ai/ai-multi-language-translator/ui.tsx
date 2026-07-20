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
  Languages, History, Key, Sparkles, ArrowLeftRight, BookMarked,
  AlertTriangle, Database, Type,
} from "lucide-react";
import {
  HISTORY_MAX,
  LANGUAGES,
  LANGUAGE_LABELS,
  RTL_LANGUAGES,
  SAMPLE_PHRASES,
  HONESTY_NOTES,
  PHRASEBOOK,
  getPhraseCount,
  getCategories,
  detectLanguage,
  translateText,
  translateBatch,
  splitLines,
  transliterate,
  isRtl,
  countChars,
  countWords,
  renderMarkdownTable,
  renderPlainText,
  buildLlmPrompt,
  renderLlmResult,
  loadHistory,
  saveHistory,
  clearHistory,
  loadTranslationMemory,
  addToTranslationMemory,
  clearTranslationMemory,
  lookupTranslationMemory,
  loadGlossary,
  saveGlossary,
  clearGlossary,
  buildShareUrl,
  parseShareUrl,
  type LanguageCode,
  type TranslationResult,
  type TranslationMemoryEntry,
} from "./logic";

type SourceLang = LanguageCode | "auto";

const SOURCE_OPTIONS: { value: SourceLang; label: string }[] = [
  { value: "auto", label: "Auto-detect" },
  ...LANGUAGES.map((l) => ({ value: l.code as SourceLang, label: `${l.name} (${l.nativeName})` })),
];

const TARGET_OPTIONS: { value: LanguageCode; label: string }[] = LANGUAGES.map((l) => ({
  value: l.code,
  label: `${l.name} (${l.nativeName})`,
}));

export default function AiMultiLanguageTranslator() {
  const [source, setSource] = useState<SourceLang>("auto");
  const [target, setTarget] = useState<LanguageCode>("es");
  const [text, setText] = useState("");
  const [batchMode, setBatchMode] = useState(false);
  const [history, setHistory] = useState<ReturnType<typeof loadHistory>>([]);
  const [memory, setMemory] = useState<TranslationMemoryEntry[]>([]);
  const [glossaryText, setGlossaryText] = useState("");
  const [showLlm, setShowLlm] = useState(false);
  const [llmKey, setLlmKey] = useState("");
  const [llmProvider, setLlmProvider] = useState<"openai" | "anthropic">("openai");
  const [llmLoading, setLlmLoading] = useState(false);
  const [llmError, setLlmError] = useState("");
  const [llmOutput, setLlmOutput] = useState("");

  useEffect(() => {
    setHistory(loadHistory());
    setMemory(loadTranslationMemory());
    setGlossaryText(loadGlossary().join("\n"));
    const key = typeof localStorage !== "undefined"
      ? localStorage.getItem("unqtools:ai-multi-language-translator:llm-key")
      : null;
    if (key) setLlmKey(key);
    if (typeof window !== "undefined" && window.location.hash) {
      const p = parseShareUrl(window.location.hash);
      if (p.text) {
        setText(p.text);
        setSource(p.source);
        setTarget(p.target);
        toast.info("Loaded from share link");
      }
    }
  }, []);

  const glossaryTerms = useMemo(
    () => glossaryText.split(/[\n,]+/).map((s) => s.trim()).filter(Boolean),
    [glossaryText],
  );

  const detected = useMemo(() => (source === "auto" ? detectLanguage(text) : { lang: source, confidence: 1 }), [source, text]);

  const result = useMemo(
    () => translateText(text, source, target, glossaryTerms),
    [text, source, target, glossaryTerms],
  );

  const batchResults = useMemo<TranslationResult[] | null>(() => {
    if (!batchMode || !text.trim()) return null;
    return translateBatch(splitLines(text), source, target, glossaryTerms);
  }, [batchMode, text, source, target, glossaryTerms]);

  const charCount = useMemo(() => countChars(text), [text]);
  const wordCount = useMemo(() => countWords(text), [text]);
  const transliterated = useMemo(
    () => transliterate(result.translated, target),
    [result.translated, target],
  );

  const handleSwap = useCallback(() => {
    const next = (() => {
      if (source === "auto") return { source: target as SourceLang, target: "en" as LanguageCode };
      return { source: target as SourceLang, target: source as LanguageCode };
    })();
    setSource(next.source);
    setTarget(next.target);
    // Also swap text with translated output.
    if (result.translated) setText(result.translated);
  }, [source, target, result]);

  const handleClear = useCallback(() => {
    setText("");
    setLlmOutput("");
    setLlmError("");
    toast.info("Cleared");
  }, []);

  const handleSample = useCallback((lang: LanguageCode, sampleText: string) => {
    setSource(lang);
    setText(sampleText);
    toast.info(`Loaded sample: ${LANGUAGE_LABELS[lang]}`);
  }, []);

  const handleSaveHistory = useCallback((method: "dictionary" | "llm") => {
    if (text.trim() && result.translated) {
      saveHistory({
        ts: Date.now(),
        source: detected.lang,
        target,
        sourceText: text,
        targetText: result.translated,
        method,
      });
      setHistory(loadHistory());
    }
  }, [text, result, detected, target]);

  const handleClearHistory = useCallback(() => {
    clearHistory();
    setHistory([]);
    toast.success("History cleared");
  }, []);

  const handleAddToMemory = useCallback(() => {
    if (!text.trim() || !result.translated) {
      toast.error("Nothing to add");
      return;
    }
    addToTranslationMemory({
      source: detected.lang,
      target,
      sourceText: text,
      targetText: result.translated,
    });
    setMemory(loadTranslationMemory());
    toast.success("Added to translation memory");
  }, [text, result, detected, target]);

  const handleClearMemory = useCallback(() => {
    clearTranslationMemory();
    setMemory([]);
    toast.success("Translation memory cleared");
  }, []);

  const handleSaveGlossary = useCallback(() => {
    saveGlossary(glossaryTerms);
    toast.success(`Saved ${glossaryTerms.length} glossary terms`);
  }, [glossaryTerms]);

  const handleClearGlossary = useCallback(() => {
    setGlossaryText("");
    clearGlossary();
    toast.success("Glossary cleared");
  }, []);

  const handleEnhanceWithLlm = useCallback(async () => {
    if (!llmKey) {
      setLlmError("Enter an API key first.");
      return;
    }
    if (!text.trim()) {
      setLlmError("Enter some text to translate.");
      return;
    }
    setLlmLoading(true);
    setLlmError("");
    setLlmOutput("");
    try {
      if (typeof localStorage !== "undefined") {
        localStorage.setItem("unqtools:ai-multi-language-translator:llm-key", llmKey);
      }
      const prompt = buildLlmPrompt(text, source, target);
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
              { role: "system", content: "You are a professional translator." },
              { role: "user", content: prompt },
            ],
            max_tokens: 1500,
            temperature: 0.3,
          })
        : JSON.stringify({
            model: "claude-3-5-haiku-latest",
            max_tokens: 1500,
            system: "You are a professional translator.",
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
      const rendered = renderLlmResult(out);
      setLlmOutput(rendered);
      handleSaveHistory("llm");
      toast.success("LLM translation complete");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Unknown error";
      setLlmError(msg);
      toast.error("LLM translation failed");
    } finally {
      setLlmLoading(false);
    }
  }, [llmKey, llmProvider, text, source, target, handleSaveHistory]);

  const targetDir = isRtl(target) ? "rtl" : "ltr";

  return (
    <div className="space-y-4 unq-animate-fade-in-up">
      {/* Language selectors */}
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="grid sm:grid-cols-[1fr_auto_1fr] gap-2 items-end">
            <div className="space-y-1">
              <Label htmlFor="tmt-src" className="text-[11px]">Source language</Label>
              <select
                id="tmt-src"
                value={source}
                onChange={(e) => setSource(e.target.value as SourceLang)}
                className="h-9 w-full text-xs rounded border bg-background px-2"
              >
                {SOURCE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
              {source === "auto" && text.trim() && (
                <p className="text-[10px] text-muted-foreground">
                  Detected: <span className="font-medium text-foreground">{LANGUAGE_LABELS[detected.lang]}</span> ({Math.round(detected.confidence * 100)}%)
                </p>
              )}
            </div>
            <Button variant="outline" size="icon" className="h-9 w-9" onClick={handleSwap} aria-label="Swap languages">
              <ArrowLeftRight className="h-4 w-4" />
            </Button>
            <div className="space-y-1">
              <Label htmlFor="tmt-tgt" className="text-[11px]">Target language</Label>
              <select
                id="tmt-tgt"
                value={target}
                onChange={(e) => setTarget(e.target.value as LanguageCode)}
                className="h-9 w-full text-xs rounded border bg-background px-2"
              >
                {TARGET_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <label className="flex items-center gap-1.5 text-xs cursor-pointer">
              <input type="checkbox" checked={batchMode} onChange={() => setBatchMode((v) => !v)} />
              Batch mode (one phrase per line)
            </label>
            <Button variant="ghost" size="sm" className="h-6 text-[11px]" onClick={() => setShowLlm((v) => !v)}>
              <Key className="h-3 w-3 mr-1" /> {showLlm ? "Hide" : "BYO key LLM"}
            </Button>
            <div className="ml-auto flex flex-wrap gap-1">
              <Badge variant="outline" className="text-[10px]">{getPhraseCount()} phrases</Badge>
              <Badge variant="outline" className="text-[10px]">{getCategories().length} categories</Badge>
              <Badge variant="outline" className="text-[10px]">10 languages</Badge>
            </div>
          </div>
          <div className="flex flex-wrap gap-1">
            <span className="text-[10px] text-muted-foreground py-0.5">Samples:</span>
            {SAMPLE_PHRASES.map((s) => (
              <Button
                key={s.lang}
                variant="ghost"
                size="sm"
                className="h-6 text-[11px]"
                onClick={() => handleSample(s.lang, s.text)}
              >
                + {LANGUAGE_LABELS[s.lang]}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Source / target side-by-side */}
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="grid sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="tmt-text" className="text-[11px]">Source</Label>
                <span className="text-[10px] text-muted-foreground">{charCount} chars · {wordCount} words</span>
              </div>
              <Textarea
                id="tmt-text"
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder={"Type text to translate…"}
                className="min-h-[160px] resize-y font-mono text-xs"
              />
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-[11px]">Translation ({LANGUAGE_LABELS[target]})</Label>
                <div className="flex gap-1">
                  <Badge variant="outline" className="text-[10px]">{result.dictionaryHits} dict</Badge>
                  <Badge variant="outline" className="text-[10px]">{result.memoryHits} mem</Badge>
                </div>
              </div>
              <div
                dir={targetDir}
                className="min-h-[160px] rounded border bg-muted/40 p-3 text-xs font-mono whitespace-pre-wrap overflow-auto"
              >
                {batchResults ? batchResults.map((r, i) => (
                  <div key={i}>{r.translated || " "}</div>
                )) : (result.translated || <span className="text-muted-foreground">Translation appears here…</span>)}
              </div>
            </div>
          </div>
          {target === "ru" || target === "ar" ? (
            <div className="space-y-1">
              <Label className="text-[10px] text-muted-foreground">Transliteration (Latin)</Label>
              <div className="rounded border bg-background px-3 py-2 text-xs font-mono">
                {transliterated || <span className="text-muted-foreground">—</span>}
              </div>
            </div>
          ) : null}
          <div className="flex flex-wrap gap-2 pt-1">
            <CopyButton
              getText={() => { handleSaveHistory("dictionary"); return batchResults ? renderPlainText(batchResults) : result.translated; }}
              label="Copy translation"
            />
            <DownloadButton
              getText={() => { handleSaveHistory("dictionary"); return batchResults ? renderMarkdownTable(batchResults) : renderMarkdownTable([result]); }}
              filename="translation.md"
              mime="text/markdown"
              label="Download .md"
            />
            <Button size="sm" variant="outline" onClick={handleAddToMemory} disabled={!text.trim()}>
              <BookMarked className="h-3.5 w-3.5 mr-1.5" /> Add to memory
            </Button>
            <ShareButton getUrl={() => { handleSaveHistory("dictionary"); return buildShareUrl({ source, target, text }); }} />
            <ClearButton onClick={handleClear} />
          </div>
        </CardContent>
      </Card>

      {/* LLM enhancement */}
      {showLlm && (
        <Card>
          <CardContent className="p-4 space-y-2">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
              <Sparkles className="h-4 w-4" /> BYO-key LLM translation
            </h3>
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
            <Button size="sm" onClick={handleEnhanceWithLlm} disabled={llmLoading || !text.trim() || !llmKey}>
              {llmLoading ? "Working…" : "Translate with LLM"}
            </Button>
            {llmError && <ErrorBanner message={llmError} />}
            {llmOutput && (
              <div className="space-y-1">
                <Label className="text-[10px] text-muted-foreground">LLM translation</Label>
                <div dir={targetDir} className="rounded border bg-muted/40 p-3 text-xs font-mono whitespace-pre-wrap">
                  {llmOutput}
                </div>
                <div className="flex gap-2 pt-1">
                  <CopyButton getText={() => llmOutput} label="Copy LLM output" />
                  <Button size="sm" variant="outline" onClick={handleAddToMemory}>
                    <BookMarked className="h-3.5 w-3.5 mr-1.5" /> Save LLM output to memory
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Translation memory + glossary */}
      <Card>
        <CardContent className="p-4 space-y-3">
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
            <Database className="h-4 w-4" /> Translation memory & glossary
          </h3>
          <div className="grid sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <Label className="text-[10px] text-muted-foreground">Memory entries ({memory.length})</Label>
                <Button variant="ghost" size="sm" className="h-5 text-[10px]" onClick={handleClearMemory}>Clear</Button>
              </div>
              <div className="max-h-[160px] overflow-auto rounded border bg-background text-[11px] divide-y">
                {memory.length === 0 ? (
                  <div className="p-2 text-muted-foreground">No entries yet.</div>
                ) : memory.slice(0, 50).map((m, i) => (
                  <div key={i} className="px-2 py-1 font-mono">
                    <Badge variant="outline" className="text-[9px] mr-1">{m.source}→{m.target}</Badge>
                    <span className="text-foreground">{m.sourceText}</span>
                    <span className="text-muted-foreground"> → </span>
                    <span className="text-foreground">{m.targetText}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="space-y-1">
              <Label htmlFor="tmt-glossary" className="text-[10px] text-muted-foreground">
                Glossary / do-not-translate list (one per line)
              </Label>
              <Textarea
                id="tmt-glossary"
                value={glossaryText}
                onChange={(e) => setGlossaryText(e.target.value)}
                placeholder={"Acme\nBrand Name"}
                className="min-h-[80px] resize-y font-mono text-[11px]"
              />
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={handleSaveGlossary}>Save glossary</Button>
                <Button size="sm" variant="ghost" onClick={handleClearGlossary}>Clear</Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Stats */}
      {text.trim() && (
        <Card>
          <CardContent className="p-4 space-y-2">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
              <Type className="h-4 w-4" /> Translation stats
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
              <Stat label="Source chars" value={charCount} />
              <Stat label="Source words" value={wordCount} />
              <Stat label="Dictionary hits" value={result.dictionaryHits} />
              <Stat label="Memory hits" value={result.memoryHits} />
              <Stat label="Passthrough" value={result.passthroughCount} />
              <Stat label="Direction" value={isRtl(target) ? "RTL" : "LTR"} />
              <Stat label="Detected" value={LANGUAGE_LABELS[result.detected]} />
              <Stat label="Confidence" value={`${Math.round(result.detectedConfidence * 100)}%`} />
            </div>
          </CardContent>
        </Card>
      )}

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
                  onClick={() => { setSource(h.source); setTarget(h.target); setText(h.sourceText); }}
                >
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-[10px]">{h.source}→{h.target}</Badge>
                    <Badge variant="outline" className="text-[10px]">{h.method}</Badge>
                    <span className="font-mono text-muted-foreground truncate">{h.sourceText}</span>
                  </div>
                  <div className="text-[10px] text-muted-foreground mt-0.5">
                    → {h.targetText} · {new Date(h.ts).toLocaleString()}
                  </div>
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

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded border bg-background px-3 py-2">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="text-sm font-semibold text-foreground">{value}</div>
    </div>
  );
}
