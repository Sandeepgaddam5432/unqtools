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
  Braces, History, Sparkles, AlertTriangle, Key, FileText, Code2, Check,
} from "lucide-react";
import {
  FLAVOR_LABELS,
  ALL_FLAVORS,
  SAMPLE_DESCRIPTIONS,
  PATTERN_LIBRARY,
  normalizeDescription,
  normalizeFlags,
  buildRegex,
  testRegex,
  explainRegex,
  convertFlavor,
  renderPatternForFlavor,
  detectRedos,
  previewReplace,
  buildCodeSnippet,
  renderText,
  renderMarkdown,
  renderJson,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  buildLlmPrompt,
  parseLlmResult,
  type BuildResult,
  type Flavor,
  type HistoryEntry,
  type MatchSegment,
} from "./logic";

export default function AIRegexBuilder() {
  const [description, setDescription] = useState("");
  const [sample, setSample] = useState("");
  const [flavor, setFlavor] = useState<Flavor>("js");
  const [flagsInput, setFlagsInput] = useState("");
  const [result, setResult] = useState<BuildResult | null>(null);
  const [replacement, setReplacement] = useState("");
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [llmKey, setLlmKey] = useState("");
  const [llmLoading, setLlmLoading] = useState(false);
  const [showLlm, setShowLlm] = useState(false);

  useEffect(() => {
    setHistory(loadHistory());
    if (typeof window !== "undefined" && window.location.hash) {
      const p = parseShareUrl(window.location.hash);
      if (p.description) setDescription(p.description);
      if (p.sample) setSample(p.sample);
      setFlavor(p.flavor);
      if (p.flags) setFlagsInput(p.flags);
      if (p.description || p.sample) toast.info("Loaded from share link");
    }
  }, []);

  const flags = useMemo(() => normalizeFlags(flagsInput), [flagsInput]);

  const liveTest = useMemo(() => {
    if (!result) return null;
    return testRegex(result.pattern, flags, sample);
  }, [result, flags, sample]);

  const replacePreview = useMemo(() => {
    if (!result || !replacement) return null;
    return previewReplace(result.pattern, flags, sample, replacement);
  }, [result, flags, sample, replacement]);

  const codeSnippet = useMemo(() => {
    if (!result) return "";
    return buildCodeSnippet(result.pattern, flags, flavor);
  }, [result, flags, flavor]);

  const handleRun = useCallback(() => {
    const clean = normalizeDescription(description);
    if (!clean) {
      toast.error("Enter a description first");
      return;
    }
    const r = buildRegex(clean, { flavor, sample, flags });
    setResult(r);
    saveHistory({
      ts: Date.now(),
      description: clean,
      pattern: r.pattern,
      flags,
      patternId: r.patternId,
      matchCount: r.test.matchCount,
    });
    setHistory(loadHistory());
    if (r.patternId) {
      toast.success(`Matched library pattern: ${r.patternName}`);
    } else {
      toast.info("No library match — used literal input as regex");
    }
  }, [description, flavor, sample, flags]);

  const handleClear = useCallback(() => {
    setDescription("");
    setSample("");
    setFlagsInput("");
    setReplacement("");
    setResult(null);
    toast.info("Cleared");
  }, []);

  const handleClearHistory = useCallback(() => {
    clearHistory();
    setHistory([]);
    toast.success("History cleared");
  }, []);

  const handleLoadSample = useCallback((s: { description: string; sample: string }) => {
    setDescription(s.description);
    setSample(s.sample);
    toast.info("Sample loaded");
  }, []);

  const handleLlmEnhance = useCallback(async () => {
    if (!llmKey) {
      toast.error("Paste your LLM API key first");
      return;
    }
    const clean = normalizeDescription(description);
    if (!clean) {
      toast.error("Enter a description first");
      return;
    }
    setLlmLoading(true);
    try {
      const sys = buildLlmPrompt(clean, flavor);
      const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${llmKey}`,
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          messages: [
            { role: "system", content: "You are a regex expert." },
            { role: "user", content: sys },
          ],
          temperature: 0.2,
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json() as { choices?: { message?: { content?: string } }[] };
      const text = json.choices?.[0]?.message?.content ?? "";
      const parsed = parseLlmResult(text);
      if (!parsed) throw new Error("No pattern returned");
      // Apply the LLM-suggested pattern directly.
      const r = buildRegex(parsed.pattern, { flavor, sample, flags: parsed.flags });
      r.patternName = `LLM-suggested: ${parsed.explanation.slice(0, 50)}`;
      r.notes = parsed.explanation;
      setResult(r);
      toast.success("LLM-suggested regex applied — verify with the live tester");
    } catch (e) {
      toast.error(`LLM call failed: ${e instanceof Error ? e.message : "unknown"}`);
    } finally {
      setLlmLoading(false);
    }
  }, [llmKey, description, flavor, sample, flags]);

  return (
    <div className="space-y-4 unq-animate-fade-in-up">
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="arb-desc">Describe what you want to match</Label>
            <Textarea
              id="arb-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={"match email addresses\nfind ipv4 addresses\nextract hex color codes"}
              className="min-h-[60px] resize-y text-xs"
            />
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <div>
              <Label className="text-xs">Flavor</Label>
              <select
                value={flavor}
                onChange={(e) => setFlavor(e.target.value as Flavor)}
                className="mt-1 h-8 w-full text-xs rounded border bg-background px-2"
              >
                {ALL_FLAVORS.map((f) => (
                  <option key={f} value={f}>{FLAVOR_LABELS[f]}</option>
                ))}
              </select>
            </div>
            <div>
              <Label className="text-xs">Flags</Label>
              <Input
                value={flagsInput}
                onChange={(e) => setFlagsInput(e.target.value)}
                placeholder={"g (auto)"}
                className="mt-1 h-8 text-xs font-mono"
              />
            </div>
            <div className="col-span-2 flex items-end">
              <Button onClick={handleRun} className="h-8 gap-1.5 text-xs w-full">
                <Sparkles className="h-3.5 w-3.5" /> Build regex
              </Button>
            </div>
          </div>
          <div className="flex flex-wrap gap-1">
            {SAMPLE_DESCRIPTIONS.map((s) => (
              <Button
                key={s.label}
                variant="ghost"
                size="sm"
                className="h-6 text-[11px]"
                onClick={() => handleLoadSample(s)}
              >+ {s.label}</Button>
            ))}
          </div>
          <div className="space-y-1">
            <Label htmlFor="arb-sample" className="text-xs">Sample text to test against (live)</Label>
            <Textarea
              id="arb-sample"
              value={sample}
              onChange={(e) => setSample(e.target.value)}
              placeholder={"Paste any text and matches will be highlighted live."}
              className="min-h-[80px] resize-y font-mono text-xs"
            />
          </div>
        </CardContent>
      </Card>

      {result ? (
        <>
          <Card>
            <CardContent className="p-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                  <Braces className="h-4 w-4" /> {result.patternName}
                </h3>
                <div className="flex items-center gap-1">
                  <Badge variant="secondary" className="text-[10px]">{FLAVOR_LABELS[flavor]}</Badge>
                  {liveTest?.ok && (
                    <Badge variant="outline" className="text-[10px]">{liveTest.matchCount} match(es)</Badge>
                  )}
                  {result.patternId && (
                    <Badge variant="outline" className="text-[10px]">library: {result.patternId}</Badge>
                  )}
                </div>
              </div>
              <div className="rounded border bg-background px-3 py-2 font-mono text-sm break-all">
                {renderPatternForFlavor(result.pattern, flags, flavor)}
              </div>
              {result.notes && (
                <p className="text-[11px] text-muted-foreground">{result.notes}</p>
              )}
              <div className="flex flex-wrap gap-2">
                <CopyButton getText={() => renderPatternForFlavor(result.pattern, flags, flavor)} label="Copy pattern" />
                <CopyButton getText={() => renderText(result)} label="Copy report" />
                <DownloadButton
                  getText={() => renderMarkdown(result)}
                  filename="regex-build.md"
                  mime="text/markdown"
                  label="Download .md"
                />
                <DownloadButton
                  getText={() => renderJson(result)}
                  filename="regex-build.json"
                  mime="application/json"
                  label="Download JSON"
                />
                <ShareButton getUrl={() => buildShareUrl(description, sample, flavor, flagsInput)} />
                <ClearButton onClick={handleClear} />
              </div>
            </CardContent>
          </Card>

          {liveTest && liveTest.ok && sample && (
            <Card>
              <CardContent className="p-4 space-y-2">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                  <Check className="h-4 w-4" /> Live test ({liveTest.matchCount} match{liveTest.matchCount === 1 ? "" : "es"})
                </h3>
                <HighlightedText sample={sample} matches={liveTest.matches} />
                {liveTest.groups.length > 0 && (
                  <div className="space-y-1 pt-1">
                    <Label className="text-xs">Capture groups</Label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-1">
                      {liveTest.groups.map((g) => (
                        <div key={g.index} className="rounded border bg-background px-2 py-1 text-[11px]">
                          <Badge variant="outline" className="text-[9px] mr-1">#{g.index}{g.name ? ` ${g.name}` : ""}</Badge>
                          <span className="font-mono text-muted-foreground">
                            {g.values.slice(0, 5).map((v) => v || "(empty)").join(" · ") || "(no values)"}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {liveTest && !liveTest.ok && (
            <Card>
              <CardContent className="p-4 space-y-2">
                <h3 className="text-sm font-semibold text-destructive flex items-center gap-1.5">
                  <AlertTriangle className="h-4 w-4" /> Test error
                </h3>
                <p className="text-xs text-muted-foreground font-mono">{liveTest.error}</p>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardContent className="p-4 space-y-2">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <FileText className="h-4 w-4" /> Token-by-token explanation
              </h3>
              <div className="space-y-1 max-h-[280px] overflow-auto">
                {result.tokens.map((t, i) => (
                  <div key={i} className="flex items-start gap-2 rounded border bg-background px-2 py-1 text-[11px]">
                    <Badge variant="outline" className="text-[9px]">{t.type}</Badge>
                    <code className="font-mono text-foreground text-xs whitespace-pre">{t.raw}</code>
                    <span className="text-muted-foreground flex-1">{t.description}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {result.redosWarnings.length > 0 && (
            <Card>
              <CardContent className="p-4 space-y-2">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                  <AlertTriangle className="h-4 w-4" /> ReDoS warnings ({result.redosWarnings.length})
                </h3>
                <div className="space-y-2">
                  {result.redosWarnings.map((w, i) => (
                    <div key={i} className="rounded border border-amber-300/40 bg-amber-50/50 dark:bg-amber-900/10 px-3 py-2 text-[11px]">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge variant={w.severity === "high" ? "destructive" : "secondary"} className="text-[9px]">
                          {w.severity}
                        </Badge>
                        <code className="font-mono text-foreground text-xs">{w.pattern}</code>
                      </div>
                      <p className="text-muted-foreground">{w.reason}</p>
                      <p className="text-foreground mt-1">Fix: <span className="text-muted-foreground">{w.suggestion}</span></p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardContent className="p-4 space-y-2">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <Code2 className="h-4 w-4" /> Code snippet ({FLAVOR_LABELS[flavor]})
              </h3>
              <pre className="text-[11px] font-mono text-foreground whitespace-pre-wrap rounded border bg-background px-3 py-2">{codeSnippet}</pre>
              <CopyButton getText={() => codeSnippet} label="Copy snippet" />
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 space-y-2">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                Replace preview (optional)
              </h3>
              <Input
                value={replacement}
                onChange={(e) => setReplacement(e.target.value)}
                placeholder={"$1 (use $1, $2 for groups)"}
                className="text-xs font-mono"
              />
              {replacePreview && replacePreview.ok && (
                <>
                  <div className="text-[11px] text-muted-foreground">
                    {replacePreview.replacements} replacement(s) made
                  </div>
                  <pre className="text-[11px] font-mono text-foreground whitespace-pre-wrap rounded border bg-background px-3 py-2 max-h-[200px] overflow-auto">{replacePreview.result}</pre>
                  <CopyButton getText={() => replacePreview.result} label="Copy result" />
                </>
              )}
              {replacePreview && !replacePreview.ok && (
                <p className="text-xs text-destructive font-mono">{replacePreview.error}</p>
              )}
            </CardContent>
          </Card>
        </>
      ) : (
        <EmptyState
          title="Describe a pattern to build a regex"
          hint="Type what you want to match (e.g. 'match email addresses') and the tool will pick a tested pattern from its library, explain it token-by-token, and test it live against any sample text."
          icon={<Braces className="h-8 w-8" />}
        />
      )}

      <Card>
        <CardContent className="p-4 space-y-2">
          <details>
            <summary className="text-xs font-medium text-foreground cursor-pointer">Pattern library ({PATTERN_LIBRARY.length})</summary>
            <div className="mt-2 space-y-1 max-h-[200px] overflow-auto">
              {PATTERN_LIBRARY.map((p) => (
                <button
                  key={p.id}
                  onClick={() => setDescription(p.keywords[0])}
                  className="block w-full text-left rounded border bg-background px-2 py-1 text-[11px] hover:bg-muted"
                >
                  <span className="font-medium text-foreground">{p.name}</span>
                  <span className="text-muted-foreground"> — {p.keywords.join(", ")}</span>
                </button>
              ))}
            </div>
          </details>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4 space-y-2">
          <button
            onClick={() => setShowLlm(!showLlm)}
            className="flex items-center gap-1.5 text-sm font-semibold text-foreground"
          >
            <Key className="h-4 w-4" /> Optional: enhance with your own LLM key
          </button>
          {showLlm && (
            <div className="space-y-2">
              <p className="text-[11px] text-muted-foreground">
                Paste your own OpenAI API key to ask GPT for a regex pattern. AI-generated regex must always be verified with the live tester below. The key is stored only in this browser tab and sent directly to OpenAI — never to us.
              </p>
              <Input
                type="password"
                value={llmKey}
                onChange={(e) => setLlmKey(e.target.value)}
                placeholder="sk-..."
                className="font-mono text-xs"
              />
              <Button onClick={handleLlmEnhance} disabled={llmLoading} size="sm" className="gap-1.5 text-xs">
                {llmLoading ? "Working…" : "Enhance with LLM"}
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
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant="outline" className="text-[10px]">{h.matchCount} matches</Badge>
                    {h.patternId && <Badge variant="outline" className="text-[10px]">{h.patternId}</Badge>}
                    <span className="text-muted-foreground text-[11px] truncate">{h.description}</span>
                    <span className="text-muted-foreground ml-auto text-[10px]">{new Date(h.ts).toLocaleString()}</span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-3">
          <p className="text-xs text-muted-foreground">
            <strong className="text-foreground">Privacy:</strong> All pattern matching, testing, explaining, and ReDoS analysis run locally in your browser. The only network call is if you paste your own LLM API key.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function HighlightedText({ sample, matches }: { sample: string; matches: MatchSegment[] }) {
  if (matches.length === 0) {
    return <p className="text-xs text-muted-foreground italic">No matches in sample.</p>;
  }
  const parts: React.ReactNode[] = [];
  let cursor = 0;
  matches.forEach((m, i) => {
    if (m.start > cursor) {
      parts.push(<span key={`t-${i}`} className="text-muted-foreground">{sample.slice(cursor, m.start)}</span>);
    }
    parts.push(
      <mark key={`m-${i}`} className="bg-emerald-200 dark:bg-emerald-900/60 text-foreground rounded px-0.5">
        {m.text}
      </mark>,
    );
    cursor = m.end;
  });
  if (cursor < sample.length) {
    parts.push(<span key="t-end" className="text-muted-foreground">{sample.slice(cursor)}</span>);
  }
  return (
    <pre className="text-[11px] font-mono text-foreground whitespace-pre-wrap rounded border bg-background px-3 py-2 max-h-[200px] overflow-auto">
      {parts}
    </pre>
  );
}

// Suppress unused import warning
export type _Unused = typeof convertFlavor & typeof explainRegex & typeof detectRedos;
