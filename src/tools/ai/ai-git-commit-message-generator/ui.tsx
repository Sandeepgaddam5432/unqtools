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
  CHANGE_TYPE_LABELS,
  STYLE_LABELS,
  GITMOJI_MAP,
  COMMIT_STYLES,
  HONESTY_NOTE,
  LLM_KEY_STORAGE,
  LARGE_DIFF_LINE_THRESHOLD,
  SUBJECT_MAX,
  parseDiff,
  classifyChangeType,
  detectBreakingChange,
  extractIssueRefs,
  generateCommit,
  validateConventional,
  chunkLargeDiff,
  summarizeLargeDiff,
  generateHookSnippet,
  renderText,
  renderMarkdown,
  renderJson,
  loadHistory,
  saveHistory,
  clearHistory,
  loadPreset,
  savePreset,
  clearPreset,
  buildShareUrl,
  parseShareUrl,
  buildLlmPrompt,
  parseLlmResult,
  renderLlmResult,
  type ChangeType,
  type CommitStyle,
  type CommitMessage,
  type HistoryEntry,
  type LlmEnhancement,
} from "./logic";
import {
  GitCommitHorizontal, History, Sparkles, ShieldAlert, Key, Wand2,
  AlertTriangle, CheckCircle2, FileText,
} from "lucide-react";

const SAMPLE_DIFF = `diff --git a/src/parser.ts b/src/parser.ts
index 1111111..2222222 100644
--- a/src/parser.ts
+++ b/src/parser.ts
@@ -10,6 +10,18 @@ export function parse(text: string) {
   return tokens;
 }

+export function parseNested(text: string) {
+  // Add support for nested arrays
+  const tokens = text.split(",");
+  return tokens.map((t) => t.trim());
+}
+
 export function tokenize(text: string) {
   return text.split("");
 }
`;

export default function AiGitCommitMessageGenerator() {
  const [diff, setDiff] = useState("");
  const [style, setStyle] = useState<CommitStyle>("conventional-body");
  const [typeOverride, setTypeOverride] = useState<ChangeType | "">("");
  const [scopeOverride, setScopeOverride] = useState("");
  const [subjectOverride, setSubjectOverride] = useState("");
  const [includeBody, setIncludeBody] = useState(true);
  const [includeFooter, setIncludeFooter] = useState(true);
  const [wrapBody, setWrapBody] = useState(true);
  const [message, setMessage] = useState<CommitMessage | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [showLlm, setShowLlm] = useState(false);
  const [showHook, setShowHook] = useState(false);
  const [llmKey, setLlmKey] = useState("");
  const [llmProvider, setLlmProvider] = useState<"openai" | "anthropic">("openai");
  const [llmLoading, setLlmLoading] = useState(false);
  const [llmError, setLlmError] = useState("");
  const [llmResult, setLlmResult] = useState<LlmEnhancement | null>(null);

  useEffect(() => {
    setHistory(loadHistory());
    const preset = loadPreset();
    if (preset) {
      setStyle(preset.style);
      setScopeOverride(preset.scope);
      setIncludeBody(preset.includeBody);
      setIncludeFooter(preset.includeFooter);
      setWrapBody(preset.wrapBody);
    }
    const key = typeof localStorage !== "undefined"
      ? localStorage.getItem(LLM_KEY_STORAGE)
      : null;
    if (key) setLlmKey(key);
    if (typeof window !== "undefined" && window.location.hash) {
      const s = parseShareUrl(window.location.hash);
      if (s) {
        setStyle(s.style);
        if (s.typeOverride) setTypeOverride(s.typeOverride);
        if (s.scopeOverride) setScopeOverride(s.scopeOverride);
        setIncludeBody(s.includeBody);
        setIncludeFooter(s.includeFooter);
        toast.info("Loaded settings from share link");
      }
    }
  }, []);

  const parsed = useMemo(() => parseDiff(diff), [diff]);
  const classification = useMemo(() => classifyChangeType(parsed, diff), [parsed, diff]);
  const breakingInfo = useMemo(() => detectBreakingChange(diff, parsed), [diff, parsed]);
  const issueRefs = useMemo(() => extractIssueRefs(diff, parsed), [diff, parsed]);
  const largeDiffSummary = useMemo(
    () => parsed.summarized ? summarizeLargeDiff(diff) : null,
    [parsed.summarized, diff],
  );

  const handleGenerate = useCallback(() => {
    if (!diff.trim()) {
      toast.error("Paste a diff first");
      return;
    }
    const msg = generateCommit(diff, {
      style,
      typeOverride: typeOverride || undefined,
      scopeOverride: scopeOverride || undefined,
      subjectOverride: subjectOverride || undefined,
      includeBody,
      includeFooter,
      wrapBody,
    });
    setMessage(msg);
    saveHistory({
      ts: msg.generatedAt,
      type: msg.type,
      scope: msg.scope,
      subject: msg.subject,
      style: msg.style,
      fileCount: parsed.fileCount,
      additions: parsed.totalAdditions,
      deletions: parsed.totalDeletions,
      isBreaking: msg.isBreaking,
    });
    setHistory(loadHistory());
    toast.success("Commit message generated");
  }, [diff, style, typeOverride, scopeOverride, subjectOverride, includeBody, includeFooter, wrapBody, parsed]);

  const handleClear = useCallback(() => {
    setDiff("");
    setMessage(null);
    setTypeOverride("");
    setScopeOverride("");
    setSubjectOverride("");
    toast.info("Cleared");
  }, []);

  const handleSample = useCallback(() => {
    setDiff(SAMPLE_DIFF);
    toast.info("Loaded sample diff");
  }, []);

  const handleSavePreset = useCallback(() => {
    savePreset({
      scope: scopeOverride,
      style,
      includeBody,
      includeFooter,
      wrapBody,
    });
    toast.success("Preset saved to localStorage");
  }, [scopeOverride, style, includeBody, includeFooter, wrapBody]);

  const handleClearPreset = useCallback(() => {
    clearPreset();
    toast.info("Preset cleared");
  }, []);

  const handleClearHistory = useCallback(() => {
    clearHistory();
    setHistory([]);
    toast.success("History cleared");
  }, []);

  const validation = useMemo(
    () => message ? validateConventional(message.full) : null,
    [message],
  );

  const handleLlmPolish = useCallback(async () => {
    if (!llmKey) {
      toast.error("Paste your LLM API key first");
      return;
    }
    if (!diff.trim()) {
      toast.error("Paste a diff first");
      return;
    }
    setLlmLoading(true);
    setLlmError("");
    setLlmResult(null);
    try {
      if (typeof localStorage !== "undefined") {
        localStorage.setItem(LLM_KEY_STORAGE, llmKey);
      }
      const prompt = buildLlmPrompt(parsed, classification, diff);
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
                  { role: "system", content: "You are a senior engineer. Write a Conventional Commits message. Respond with the message in a single fenced code block." },
                  { role: "user", content: prompt },
                ],
                temperature: 0.4,
              }
            : {
                model: "claude-3-5-haiku-latest",
                max_tokens: 1500,
                system: "You are a senior engineer. Write a Conventional Commits message. Respond with the message in a single fenced code block.",
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
      const model = llmProvider === "openai" ? "gpt-4o-mini" : "claude-3-5-haiku-latest";
      const parsedLlm = parseLlmResult(raw, model);
      setLlmResult(parsedLlm);
      toast.success("LLM polish complete");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "LLM polish failed";
      setLlmError(msg);
      toast.error(msg);
    } finally {
      setLlmLoading(false);
    }
  }, [llmKey, llmProvider, diff, parsed, classification]);

  const hookSnippet = useMemo(() => generateHookSnippet(
    typeof window !== "undefined" ? window.location.href : "https://unqtools.local/tools/ai-git-commit-message-generator",
  ), []);

  return (
    <div className="space-y-4 unq-animate-fade-in-up">
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <Label htmlFor="gcm-diff">Paste your git diff (output of <code className="font-mono text-[11px]">git diff --cached</code>)</Label>
            <Button variant="ghost" size="sm" onClick={handleSample} className="text-[11px]">Load sample</Button>
          </div>
          <Textarea
            id="gcm-diff"
            value={diff}
            onChange={(e) => setDiff(e.target.value)}
            placeholder={"diff --git a/src/file.ts b/src/file.ts\n@@ -1,1 +1,1 @@\n-old line\n+new line"}
            className="min-h-[180px] resize-y font-mono text-xs"
          />
          {parsed.fileCount > 0 && (
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <Badge variant="outline" className="text-[10px]">{parsed.fileCount} files</Badge>
              <Badge variant="outline" className="text-[10px] text-emerald-600 dark:text-emerald-400">+{parsed.totalAdditions}</Badge>
              <Badge variant="outline" className="text-[10px] text-red-600 dark:text-red-400">−{parsed.totalDeletions}</Badge>
              {parsed.summarized && (
                <Badge variant="outline" className="text-[10px] text-yellow-600 dark:text-yellow-400">
                  <AlertTriangle className="h-3 w-3 mr-1" /> large diff summarized
                </Badge>
              )}
              {breakingInfo.isBreaking && (
                <Badge variant="outline" className="text-[10px] text-red-600 dark:text-red-400">
                  <AlertTriangle className="h-3 w-3 mr-1" /> breaking change
                </Badge>
              )}
              {issueRefs.length > 0 && (
                <Badge variant="outline" className="text-[10px]">{issueRefs.join(" ")}</Badge>
              )}
            </div>
          )}
          {largeDiffSummary && (
            <div className="rounded border border-yellow-500/30 bg-yellow-500/10 p-2 text-xs text-yellow-700 dark:text-yellow-300 space-y-1">
              <div className="font-medium">Large-diff summary (chunked map-reduce):</div>
              <div>{largeDiffSummary.fileCount} files, +{largeDiffSummary.additions} −{largeDiffSummary.deletions}</div>
              {largeDiffSummary.topPaths.length > 0 && (
                <div>Top paths: {largeDiffSummary.topPaths.slice(0, 5).join(", ")}</div>
              )}
              {largeDiffSummary.topSymbols.length > 0 && (
                <div>Symbols: {largeDiffSummary.topSymbols.slice(0, 6).join(", ")}</div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4 space-y-3">
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
            <Sparkles className="h-4 w-4" /> Style + overrides
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Style</Label>
              <select
                className="h-9 w-full rounded border bg-background px-2 text-sm"
                value={style}
                onChange={(e) => setStyle(e.target.value as CommitStyle)}
              >
                {COMMIT_STYLES.map((s) => (
                  <option key={s} value={s}>{STYLE_LABELS[s]}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Type override (optional)</Label>
              <select
                className="h-9 w-full rounded border bg-background px-2 text-sm"
                value={typeOverride}
                onChange={(e) => setTypeOverride(e.target.value as ChangeType | "")}
              >
                <option value="">Auto: {classification.type}</option>
                {(Object.keys(CHANGE_TYPE_LABELS) as ChangeType[]).map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Scope override (optional)</Label>
              <Input
                value={scopeOverride}
                onChange={(e) => setScopeOverride(e.target.value)}
                placeholder={`Auto: ${classification.scope || "(none)"}`}
                className="h-9 text-sm"
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="gcm-subject" className="text-xs">Subject override (optional)</Label>
            <Input
              id="gcm-subject"
              value={subjectOverride}
              onChange={(e) => setSubjectOverride(e.target.value)}
              placeholder="Auto-generated from diff"
              className="text-sm"
              maxLength={SUBJECT_MAX}
            />
          </div>
          <div className="flex flex-wrap gap-4 pt-1">
            <label className="flex items-center gap-1.5 text-xs cursor-pointer">
              <input type="checkbox" checked={includeBody} onChange={(e) => setIncludeBody(e.target.checked)} />
              Include body
            </label>
            <label className="flex items-center gap-1.5 text-xs cursor-pointer">
              <input type="checkbox" checked={includeFooter} onChange={(e) => setIncludeFooter(e.target.checked)} />
              Include footer (refs + breaking)
            </label>
            <label className="flex items-center gap-1.5 text-xs cursor-pointer">
              <input type="checkbox" checked={wrapBody} onChange={(e) => setWrapBody(e.target.checked)} />
              Wrap body at 100 cols
            </label>
          </div>
          <div className="flex flex-wrap gap-2">
            <RunButton onClick={handleGenerate} label="Generate commit message" disabled={!diff.trim()} />
            <ClearButton onClick={handleClear} disabled={!diff && !message} />
            <Button variant="outline" size="sm" onClick={handleSavePreset} className="gap-1.5">
              <CheckCircle2 className="h-3.5 w-3.5" /> Save preset
            </Button>
            <Button variant="ghost" size="sm" onClick={handleClearPreset}>Clear preset</Button>
            <ShareButton getUrl={() => buildShareUrl({
              style,
              typeOverride: typeOverride || undefined,
              scopeOverride: scopeOverride || undefined,
              includeBody,
              includeFooter,
            })} />
          </div>
        </CardContent>
      </Card>

      {message ? (
        <>
          <Card>
            <CardContent className="p-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                  <GitCommitHorizontal className="h-4 w-4" /> Generated commit message
                </h3>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="text-[10px]">{message.type}</Badge>
                  {message.scope && <Badge variant="outline" className="text-[10px]">{message.scope}</Badge>}
                  <Badge variant="outline" className="text-[10px]">{STYLE_LABELS[message.style]}</Badge>
                  {message.isBreaking && (
                    <Badge variant="outline" className="text-[10px] text-red-600 dark:text-red-400">breaking</Badge>
                  )}
                </div>
              </div>
              <pre className="rounded border bg-background p-3 text-xs font-mono whitespace-pre-wrap break-words">
{message.full}
              </pre>
              {validation && (
                <div className="text-xs">
                  {validation.valid ? (
                    <span className="text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                      <CheckCircle2 className="h-3 w-3" /> Conventional Commits: valid
                    </span>
                  ) : (
                    <div className="text-yellow-700 dark:text-yellow-300">
                      <div className="flex items-center gap-1">
                        <AlertTriangle className="h-3 w-3" /> Validation notes:
                      </div>
                      <ul className="ml-4 list-disc">
                        {validation.errors.map((e, i) => (<li key={i}>{e}</li>) )}
                      </ul>
                    </div>
                  )}
                </div>
              )}
              {message.warnings.length > 0 && (
                <div className="rounded border border-yellow-500/30 bg-yellow-500/10 p-2 text-xs text-yellow-700 dark:text-yellow-300">
                  {message.warnings.map((w, i) => (<div key={i}>• {w}</div>) )}
                </div>
              )}
              <div className="flex flex-wrap gap-2">
                <CopyButton getText={() => message.full} label="Copy message" />
                <DownloadButton getText={() => message.full} filename="commit-message.txt" label="Download .txt" />
                <DownloadButton getText={() => renderMarkdown(message)} filename="commit-message.md" mime="text/markdown" label="Download .md" />
                <DownloadButton getText={() => renderJson(message)} filename="commit-message.json" mime="application/json" label="Download JSON" />
                <Button variant="outline" size="sm" onClick={() => setShowLlm((v) => !v)} className="gap-1.5">
                  <Wand2 className="h-3.5 w-3.5" /> {showLlm ? "Hide" : "Show"} LLM polish
                </Button>
                <Button variant="outline" size="sm" onClick={() => setShowHook((v) => !v)} className="gap-1.5">
                  <FileText className="h-3.5 w-3.5" /> {showHook ? "Hide" : "Show"} git hook
                </Button>
              </div>
            </CardContent>
          </Card>

          {showLlm && (
            <Card>
              <CardContent className="p-4 space-y-3">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                  <Key className="h-4 w-4" /> BYO-key LLM polish (optional, never uploads via our servers)
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <select
                    className="h-9 rounded border bg-background px-2 text-sm"
                    value={llmProvider}
                    onChange={(e) => setLlmProvider(e.target.value as "openai" | "anthropic")}
                  >
                    <option value="openai">OpenAI (gpt-4o-mini)</option>
                    <option value="anthropic">Anthropic (claude-3-5-haiku)</option>
                  </select>
                  <Input
                    type="password"
                    placeholder="Paste API key (stored only in this browser)"
                    value={llmKey}
                    onChange={(e) => setLlmKey(e.target.value)}
                    className="h-9 text-sm"
                  />
                </div>
                <div className="flex flex-wrap gap-2">
                  <RunButton onClick={handleLlmPolish} loading={llmLoading} label="Polish with LLM" disabled={!diff.trim()} />
                  {llmKey && (
                    <Button variant="ghost" size="sm" onClick={() => {
                      setLlmKey("");
                      if (typeof localStorage !== "undefined") localStorage.removeItem(LLM_KEY_STORAGE);
                      toast.info("API key cleared");
                    }}>
                      Clear key
                    </Button>
                  )}
                </div>
                {llmError && <ErrorBanner message={llmError} />}
                {llmResult && (
                  <div className="rounded border bg-background p-3 text-xs space-y-2">
                    <div className="font-semibold text-foreground">{renderLlmResult(llmResult).split("\n")[0]}</div>
                    <pre className="font-mono whitespace-pre-wrap break-words">{llmResult.message}</pre>
                    <div className="flex flex-wrap gap-2">
                      <CopyButton getText={() => llmResult.message} label="Copy LLM message" />
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {showHook && (
            <Card>
              <CardContent className="p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                    <FileText className="h-4 w-4" /> prepare-commit-msg hook snippet
                  </h3>
                  <CopyButton getText={() => hookSnippet} label="Copy hook" />
                </div>
                <p className="text-xs text-muted-foreground">
                  Save as <code className="font-mono">.git/hooks/prepare-commit-msg</code> and <code className="font-mono">chmod +x</code> it.
                  The hook copies your staged diff to the clipboard and points you to this tool to generate a message.
                </p>
                <pre className="rounded border bg-background p-3 text-xs font-mono whitespace-pre-wrap break-words max-h-[300px] overflow-auto">
{hookSnippet}
                </pre>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardContent className="p-4 space-y-2">
              <h3 className="text-sm font-semibold text-foreground">Diff stats</h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                <Stat label="Files changed" value={parsed.fileCount} />
                <Stat label="Additions" value={`+${parsed.totalAdditions}`} highlight="good" />
                <Stat label="Deletions" value={`−${parsed.totalDeletions}`} highlight="bad" />
                <Stat label="Confidence" value={`${classification.confidence}%`} />
              </div>
              {parsed.files.length > 0 && (
                <div className="space-y-1 pt-2">
                  <div className="text-xs font-medium text-muted-foreground">Files:</div>
                  <div className="space-y-1 max-h-[200px] overflow-auto">
                    {parsed.files.slice(0, 20).map((f, i) => (
                      <div key={i} className="rounded border bg-background px-3 py-1.5 text-xs flex items-center gap-2">
                        <Badge variant="outline" className="text-[10px]">{f.kind}</Badge>
                        <span className="font-mono text-muted-foreground text-[10px] w-16 truncate">{f.language}</span>
                        <span className="font-mono text-foreground flex-1 truncate">{f.path}</span>
                        <span className="text-emerald-600 dark:text-emerald-400 text-[10px]">+{f.additions}</span>
                        <span className="text-red-600 dark:text-red-400 text-[10px]">−{f.deletions}</span>
                      </div>
                    ))}
                    {parsed.files.length > 20 && (
                      <div className="text-xs text-muted-foreground">… and {parsed.files.length - 20} more</div>
                    )}
                  </div>
                </div>
              )}
              {classification.reasons.length > 0 && (
                <div className="space-y-1 pt-2">
                  <div className="text-xs font-medium text-muted-foreground">Why this type:</div>
                  <ul className="ml-4 list-disc text-xs text-muted-foreground space-y-0.5">
                    {classification.reasons.slice(0, 5).map((r, i) => (<li key={i}>{r}</li>) )}
                  </ul>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      ) : (
        <EmptyState
          title="Paste a git diff to generate a Conventional Commits message"
          hint={`We'll parse the diff, classify the change type (feat/fix/docs/refactor/test/chore/perf/style/ci/build), detect breaking changes and issue refs, and assemble a subject + body + footer in your chosen style. Large diffs (>${LARGE_DIFF_LINE_THRESHOLD.toLocaleString()} lines) are chunked and summarized.`}
          icon={<GitCommitHorizontal className="h-8 w-8" />}
        />
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
                <div key={i} className="rounded border bg-background px-3 py-2 text-xs">
                  <Badge variant="secondary" className="mr-2 text-[10px]">{h.type}</Badge>
                  {h.scope && <Badge variant="outline" className="mr-2 text-[10px]">{h.scope}</Badge>}
                  <span className="font-medium text-foreground">{h.subject}</span>
                  <span className="text-muted-foreground ml-2">· {h.fileCount} files · +{h.additions} −{h.deletions} · {STYLE_LABELS[h.style]}</span>
                  {h.isBreaking && <Badge variant="outline" className="ml-2 text-[10px] text-red-600 dark:text-red-400">breaking</Badge>}
                  <span className="text-muted-foreground ml-2">· {new Date(h.ts).toLocaleString()}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-3">
          <p className="text-xs text-muted-foreground flex items-start gap-1.5">
            <ShieldAlert className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" />
            <span><strong className="text-foreground">Honesty:</strong> {HONESTY_NOTE}</span>
          </p>
        </CardContent>
      </Card>
    </div>
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
