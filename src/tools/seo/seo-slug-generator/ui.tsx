"use client";

import React, { useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CopyButton, ErrorBanner } from "../../_shared";
import { generateSlug, generateSlugsBatch, slugToTitle, deduplicateSlug, type Separator, type CaseMode, type SlugInput } from "./logic";

const SEPARATORS: Separator[] = ["-", "_", ".", "~", "+"];
const LANGS = ["en", "es", "fr", "de", "it", "pt", "nl", "sv", "all"];

export default function SeoSlugGenerator() {
  const [text, setText] = useState("The Best Coffee Grinders for Your Home in 2024");
  const [separator, setSeparator] = useState<Separator>("-");
  const [caseMode, setCaseMode] = useState<CaseMode>("lower");
  const [removeStopWords, setRemoveStopWords] = useState(true);
  const [stopWordLang, setStopWordLang] = useState("en");
  const [transliterate, setTransliterate] = useState(true);
  const [maxLength, setMaxLength] = useState("");
  const [preserveNumbers, setPreserveNumbers] = useState(true);
  const [stripEmoji, setStripEmoji] = useState(true);
  const [customReplacements, setCustomReplacements] = useState("");

  const [result, setResult] = useState<ReturnType<typeof generateSlug> | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Batch
  const [batchText, setBatchText] = useState("Hello World\nFoo Bar\nBaz Qux");
  const [batchResults, setBatchResults] = useState<ReturnType<typeof generateSlugsBatch> | null>(null);

  // Reverse
  const [reverseSlug, setReverseSlug] = useState("hello-world");
  const [reverseResult, setReverseResult] = useState<string | null>(null);

  // Deduplicate
  const [dedupeSlug, setDedupeSlug] = useState("hello-world");
  const [dedupeExisting, setDedupeExisting] = useState("hello-world\nhello-world-1");
  const [dedupeResult, setDedupeResult] = useState<string | null>(null);

  const buildInput = useCallback((): SlugInput => {
    const replacements = customReplacements
      .split("\n")
      .filter(Boolean)
      .map((line) => {
        const [find, ...rest] = line.split("=");
        return { find: find?.trim() ?? "", replace: rest.join("=").trim() };
      })
      .filter((r) => r.find);
    return {
      text,
      separator,
      caseMode,
      removeStopWords,
      stopWordLang: stopWordLang as SlugInput["stopWordLang"],
      transliterate,
      maxLength: maxLength ? Number(maxLength) : undefined,
      preserveNumbers,
      stripEmoji,
      customReplacements: replacements,
    };
  }, [text, separator, caseMode, removeStopWords, stopWordLang, transliterate, maxLength, preserveNumbers, stripEmoji, customReplacements]);

  const generate = useCallback(() => {
    const r = generateSlug(buildInput());
    if ("error" in r) { setError(r.error); setResult(null); } else { setResult(r); setError(null); }
  }, [buildInput]);

  const runBatch = useCallback(() => {
    const lines = batchText.split("\n").filter(Boolean);
    const r = generateSlugsBatch(lines.map((t) => ({ ...buildInput(), text: t })));
    if ("error" in r) { setError(r.error); setBatchResults(null); } else { setBatchResults(r); setError(null); }
  }, [batchText, buildInput]);

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4 space-y-4">
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs text-muted-foreground">Text to slugify</Label>
            <Input value={text} onChange={(e) => setText(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-muted-foreground">Separator</Label>
              <select className="h-9 rounded-md border border-input bg-background px-3 text-sm" value={separator} onChange={(e) => setSeparator(e.target.value as Separator)}>
                {SEPARATORS.map((s) => <option key={s} value={s}>{s === " " ? "(space)" : s}</option>)}
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-muted-foreground">Case</Label>
              <select className="h-9 rounded-md border border-input bg-background px-3 text-sm" value={caseMode} onChange={(e) => setCaseMode(e.target.value as CaseMode)}>
                <option value="lower">lowercase</option>
                <option value="upper">UPPERCASE</option>
                <option value="preserve">Preserve</option>
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-muted-foreground">Stop words lang</Label>
              <select className="h-9 rounded-md border border-input bg-background px-3 text-sm" value={stopWordLang} onChange={(e) => setStopWordLang(e.target.value)} disabled={!removeStopWords}>
                {LANGS.map((l) => <option key={l} value={l}>{l === "all" ? "All languages" : l}</option>)}
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-muted-foreground">Max length</Label>
              <Input type="number" min="0" value={maxLength} onChange={(e) => setMaxLength(e.target.value)} placeholder="(no limit)" />
            </div>
          </div>
          <div className="flex flex-wrap gap-4 text-sm">
            <label className="flex items-center gap-2"><input type="checkbox" checked={removeStopWords} onChange={(e) => setRemoveStopWords(e.target.checked)} /><span>Remove stop words</span></label>
            <label className="flex items-center gap-2"><input type="checkbox" checked={transliterate} onChange={(e) => setTransliterate(e.target.checked)} /><span>Transliterate unicode (é→e)</span></label>
            <label className="flex items-center gap-2"><input type="checkbox" checked={preserveNumbers} onChange={(e) => setPreserveNumbers(e.target.checked)} /><span>Preserve numbers</span></label>
            <label className="flex items-center gap-2"><input type="checkbox" checked={stripEmoji} onChange={(e) => setStripEmoji(e.target.checked)} /><span>Strip emoji</span></label>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs text-muted-foreground">Custom replacements (one per line: find=replace)</Label>
            <textarea className="rounded-md border border-input bg-background px-3 py-2 text-sm min-h-[60px]" value={customReplacements} onChange={(e) => setCustomReplacements(e.target.value)} placeholder={"C++=cpp\n.NET=dotnet"} />
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={generate}>Generate slug</Button>
            <Button size="sm" variant="ghost" onClick={() => { setText("The Best Coffee Grinders for Your Home in 2024"); setSeparator("-"); setCaseMode("lower"); setRemoveStopWords(true); setTransliterate(true); setPreserveNumbers(true); setStripEmoji(true); setCustomReplacements(""); setMaxLength(""); }}>Sample</Button>
            <Button size="sm" variant="ghost" onClick={() => { setResult(null); setError(null); }}>Clear</Button>
          </div>
        </CardContent>
      </Card>

      {error && <ErrorBanner message={error} />}

      {result && !("error" in result) && (
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground mb-1">Generated slug</p>
            <p className="text-2xl font-bold text-primary font-mono break-all">{result.slug || "(empty)"}</p>
            <p className="text-xs text-muted-foreground mt-1">{result.slug.length} chars</p>
            <div className="mt-3 flex items-center gap-2 flex-wrap">
              <CopyButton getText={() => result.slug} />
              {result.truncated && <Badge variant="outline">Truncated</Badge>}
              {result.wordsRemoved.length > 0 && <Badge variant="outline">{result.wordsRemoved.length} stop words removed</Badge>}
            </div>
            {result.warnings.length > 0 && (
              <ul className="mt-3 space-y-1 text-xs text-yellow-700 dark:text-yellow-400">
                {result.warnings.map((w, i) => <li key={i}>⚠️ {w}</li>)}
              </ul>
            )}
          </CardContent>
        </Card>
      )}

      {/* Batch mode */}
      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-sm">Batch mode (one slug per line)</CardTitle></CardHeader>
        <CardContent className="p-4 pt-0 space-y-3">
          <textarea className="rounded-md border border-input bg-background px-3 py-2 text-sm min-h-[100px] font-mono" value={batchText} onChange={(e) => setBatchText(e.target.value)} />
          <Button size="sm" onClick={runBatch}>Generate batch</Button>
          {batchResults && !("error" in batchResults) && (
            <div className="space-y-2">
              {batchResults.map((r, i) => (
                <div key={i} className="flex items-center gap-2 p-2 rounded-md border border-border/50">
                  <span className="text-xs text-muted-foreground flex-1 truncate">{r.originalText}</span>
                  <span className="text-xs font-mono font-bold text-primary">{r.slug}</span>
                  <CopyButton getText={() => r.slug} size="icon-sm" />
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Reverse */}
      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-sm">Reverse: slug → Title Case</CardTitle></CardHeader>
        <CardContent className="p-4 pt-0 space-y-3">
          <Input value={reverseSlug} onChange={(e) => setReverseSlug(e.target.value)} placeholder="hello-world" />
          <Button size="sm" onClick={() => setReverseResult(slugToTitle(reverseSlug, separator))}>Convert</Button>
          {reverseResult && <p className="text-sm">Title: <strong className="text-primary">{reverseResult}</strong></p>}
        </CardContent>
      </Card>

      {/* Deduplicate */}
      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-sm">Deduplicate: avoid slug collisions</CardTitle></CardHeader>
        <CardContent className="p-4 pt-0 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5"><Label className="text-xs text-muted-foreground">New slug</Label><Input value={dedupeSlug} onChange={(e) => setDedupeSlug(e.target.value)} /></div>
            <div className="flex flex-col gap-1.5"><Label className="text-xs text-muted-foreground">Existing slugs (one per line)</Label><textarea className="rounded-md border border-input bg-background px-3 py-2 text-sm min-h-[60px] font-mono" value={dedupeExisting} onChange={(e) => setDedupeExisting(e.target.value)} /></div>
          </div>
          <Button size="sm" onClick={() => setDedupeResult(deduplicateSlug(dedupeSlug, dedupeExisting.split("\n").filter(Boolean), separator))}>Deduplicate</Button>
          {dedupeResult && <p className="text-sm">Unique slug: <strong className="text-primary font-mono">{dedupeResult}</strong></p>}
        </CardContent>
      </Card>

      <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground"><strong className="text-foreground">Privacy:</strong> all slug generation runs locally. No data leaves your browser.</p></CardContent></Card>
    </div>
  );
}
