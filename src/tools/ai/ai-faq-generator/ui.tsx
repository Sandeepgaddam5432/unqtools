"use client";

import React, { useState, useMemo, useCallback, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  CopyButton,
  DownloadButton,
  EmptyState,
  ShareButton,
  ClearButton,
  RunButton,
} from "../../_shared";
import { toast } from "sonner";
import {
  QUESTION_TYPE_LABELS,
  TONE_LABELS,
  LENGTH_LABELS,
  SAMPLE_TOPICS,
  generateFaq,
  groupByType,
  regenerateItem,
  computeStats,
  renderText,
  renderMarkdown,
  renderHtmlAccordion,
  renderJsonLd,
  renderJson,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  type QuestionType,
  type Tone,
  type Length,
  type FAQDocument,
  type HistoryEntry,
} from "./logic";
import { HelpCircle, History, Sparkles, RefreshCw, AlertTriangle, FileCode } from "lucide-react";

type Tab = "markdown" | "html" | "jsonld";

export default function AiFaqGenerator() {
  const [topic, setTopic] = useState("");
  const [content, setContent] = useState("");
  const [tone, setTone] = useState<Tone>("neutral");
  const [length, setLength] = useState<Length>("standard");
  const [voiceSearch, setVoiceSearch] = useState(false);
  const [count, setCount] = useState(12);
  const [faq, setFaq] = useState<FAQDocument | null>(null);
  const [tab, setTab] = useState<Tab>("markdown");
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  useEffect(() => {
    setHistory(loadHistory());
    if (typeof window !== "undefined" && window.location.hash) {
      const s = parseShareUrl(window.location.hash);
      if (s.topic) {
        setTopic(s.topic);
        setTone(s.tone);
        setLength(s.length);
        setVoiceSearch(s.voiceSearch);
        setCount(s.count);
        toast.info("Loaded from share link");
      }
    }
  }, []);

  const handleGenerate = useCallback(() => {
    const t = topic.trim();
    if (!t && !content.trim()) {
      toast.error("Enter a topic or paste some content");
      return;
    }
    const f = generateFaq(t, content, { tone, length, voiceSearch, count });
    setFaq(f);
    saveHistory({
      ts: Date.now(),
      topic: t,
      tone,
      length,
      questionCount: f.items.length,
      groundedCount: f.items.filter((i) => i.grounded).length,
      sourceChars: content.length,
    });
    setHistory(loadHistory());
    toast.success(`Generated ${f.items.length} FAQ pairs (${f.items.filter((i) => i.grounded).length} grounded)`);
  }, [topic, content, tone, length, voiceSearch, count]);

  const handleClear = useCallback(() => {
    setTopic("");
    setContent("");
    setFaq(null);
    toast.info("Cleared");
  }, []);

  const handleClearHistory = useCallback(() => {
    clearHistory();
    setHistory([]);
    toast.success("History cleared");
  }, []);

  const handleRegenerate = useCallback((id: string) => {
    setFaq((prev) => (prev ? regenerateItem(prev, id) : prev));
    toast.info("Regenerated");
  }, []);

  const stats = useMemo(() => (faq ? computeStats(faq) : null), [faq]);
  const groups = useMemo(() => (faq ? groupByType(faq.items) : []), [faq]);
  const markdown = useMemo(() => (faq ? renderMarkdown(faq) : ""), [faq]);
  const html = useMemo(() => (faq ? renderHtmlAccordion(faq) : ""), [faq]);
  const jsonLd = useMemo(() => (faq ? renderJsonLd(faq) : ""), [faq]);
  const text = useMemo(() => (faq ? renderText(faq) : ""), [faq]);
  const jsonRaw = useMemo(() => (faq ? renderJson(faq) : ""), [faq]);

  return (
    <div className="space-y-4 unq-animate-fade-in-up">
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="afg-topic">Topic <span className="text-muted-foreground">(required if no content)</span></Label>
            <Textarea
              id="afg-topic"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="e.g. Acme Cloud Backup — encrypted offsite storage for teams"
              className="min-h-[50px] resize-y"
            />
            <div className="flex flex-wrap gap-1 pt-1">
              {SAMPLE_TOPICS.slice(0, 5).map((t) => (
                <Button
                  key={t}
                  variant="ghost"
                  size="sm"
                  className="h-6 text-[11px] max-w-full"
                  onClick={() => setTopic(t)}
                  title={t}
                >
                  <span className="truncate">{t.length > 36 ? t.slice(0, 36) + "…" : t}</span>
                </Button>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="afg-content">
              Source content <span className="text-muted-foreground">(optional — paste a doc, product page, or article; answers will be grounded in it)</span>
            </Label>
            <Textarea
              id="afg-content"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder={"Paste your content here. We extract sentences and ground each answer in the most relevant snippet. If no snippet matches, the answer is flagged 'not grounded' and uses an honest generic template."}
              className="min-h-[140px] resize-y font-mono text-xs"
            />
            {content && (
              <p className="text-[11px] text-muted-foreground">
                {content.length.toLocaleString()} characters · {content.split(/\s+/).filter(Boolean).length.toLocaleString()} words
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Tone</Label>
              <select
                value={tone}
                onChange={(e) => setTone(e.target.value as Tone)}
                className="h-9 w-full text-xs rounded border bg-background px-2"
              >
                {(Object.keys(TONE_LABELS) as Tone[]).map((t) => (
                  <option key={t} value={t}>{TONE_LABELS[t]}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Length</Label>
              <select
                value={length}
                onChange={(e) => setLength(e.target.value as Length)}
                className="h-9 w-full text-xs rounded border bg-background px-2"
              >
                {(Object.keys(LENGTH_LABELS) as Length[]).map((l) => (
                  <option key={l} value={l}>{LENGTH_LABELS[l]}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Questions</Label>
              <select
                value={count}
                onChange={(e) => setCount(Number.parseInt(e.target.value, 10))}
                className="h-9 w-full text-xs rounded border bg-background px-2"
              >
                {[8, 10, 12, 16, 20, 24, 32].map((n) => (
                  <option key={n} value={n}>{n} questions</option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Voice search</Label>
              <label className="flex items-center gap-1.5 text-xs h-9 cursor-pointer">
                <input
                  type="checkbox"
                  checked={voiceSearch}
                  onChange={(e) => setVoiceSearch(e.target.checked)}
                />
                <span>Contractions (What's)</span>
              </label>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <RunButton onClick={handleGenerate} label="Generate FAQ" />
            <ClearButton onClick={handleClear} />
            <ShareButton
              getUrl={() => buildShareUrl({ topic, tone, length, voiceSearch, count })}
            />
          </div>
        </CardContent>
      </Card>

      {faq && stats ? (
        <>
          <Card>
            <CardContent className="p-4 space-y-2">
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-xs">
                <Stat label="Questions" value={stats.totalQuestions} />
                <Stat label="Grounded" value={stats.groundedCount} highlight={stats.groundedCount > 0 ? "good" : undefined} />
                <Stat label="Not grounded" value={stats.notGroundedCount} highlight={stats.notGroundedCount > 0 ? "bad" : undefined} />
                <Stat label="Words" value={stats.wordCount} />
                <Stat label="Characters" value={stats.characterCount} />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                  <HelpCircle className="h-4 w-4" /> FAQ ({faq.items.length} pairs)
                </h3>
              </div>
              <div className="space-y-4">
                {groups.map((g) => (
                  <div key={g.type} className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-[10px]">{g.label}</Badge>
                      <span className="text-[10px] text-muted-foreground">{g.items.length} question(s)</span>
                    </div>
                    <div className="space-y-2">
                      {g.items.map((i) => (
                        <FaqItemCard
                          key={i.id}
                          item={i}
                          onRegenerate={() => handleRegenerate(i.id)}
                        />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 space-y-3">
              <div className="flex flex-wrap gap-2">
                <TabButton active={tab === "markdown"} onClick={() => setTab("markdown")} label="Markdown" />
                <TabButton active={tab === "html"} onClick={() => setTab("html")} label="HTML accordion" />
                <TabButton active={tab === "jsonld"} onClick={() => setTab("jsonld")} label="JSON-LD schema" />
              </div>
              <pre className="rounded border bg-muted/30 p-3 text-[11px] font-mono overflow-auto max-h-[400px] whitespace-pre-wrap break-words">
                {tab === "markdown" ? markdown : tab === "html" ? html : jsonLd}
              </pre>
              <div className="flex flex-wrap gap-2">
                <CopyButton
                  getText={() => (tab === "markdown" ? markdown : tab === "html" ? html : jsonLd)}
                  label={`Copy ${tab === "jsonld" ? "JSON-LD" : tab}`}
                />
                {tab === "markdown" && (
                  <DownloadButton
                    getText={() => markdown}
                    filename="faq.md"
                    mime="text/markdown"
                    label="Download .md"
                  />
                )}
                {tab === "html" && (
                  <DownloadButton
                    getText={() => html}
                    filename="faq.html"
                    mime="text/html"
                    label="Download .html"
                  />
                )}
                {tab === "jsonld" && (
                  <DownloadButton
                    getText={() => jsonLd}
                    filename="faq.jsonld"
                    mime="application/ld+json"
                    label="Download .jsonld"
                  />
                )}
                <DownloadButton
                  getText={() => text}
                  filename="faq.txt"
                  mime="text/plain"
                  label="Download .txt"
                />
                <DownloadButton
                  getText={() => jsonRaw}
                  filename="faq.json"
                  mime="application/json"
                  label="Download .json"
                />
              </div>
              {tab === "jsonld" && (
                <p className="text-[11px] text-muted-foreground flex items-start gap-1.5">
                  <FileCode className="h-3 w-3 mt-0.5 flex-shrink-0" />
                  <span>
                    Paste this into a <code>&lt;script type="application/ld+json"&gt;</code> tag in your page's
                    HTML to enable Google FAQ rich results. The schema validates as <code>@type=FAQPage</code>.
                  </span>
                </p>
              )}
            </CardContent>
          </Card>
        </>
      ) : (
        <EmptyState
          title="Enter a topic or paste content, then click Generate FAQ"
          hint="We extract keywords and sentences from your content, expand 8 question-type templates (What/How/Why/When/Where/Who/Which/Can), and produce 10+ grounded Q&A pairs. Each answer is grounded in your source — or honestly flagged 'not grounded' if no snippet matches. Export as Markdown, HTML accordion, or JSON-LD FAQPage schema."
          icon={<Sparkles className="h-8 w-8" />}
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
                <button
                  key={i}
                  onClick={() => {
                    setTopic(h.topic);
                    setTone(h.tone);
                    setLength(h.length);
                    const f = generateFaq(h.topic, "", { tone: h.tone, length: h.length, count: h.questionCount });
                    setFaq(f);
                    toast.info("Regenerated from history (source content not saved)");
                  }}
                  className="block w-full text-left rounded border bg-background px-3 py-2 text-xs hover:bg-muted"
                >
                  <Badge variant="outline" className="mr-2 text-[10px]">{h.questionCount}Q</Badge>
                  <Badge variant="outline" className="mr-2 text-[10px]">{h.groundedCount} grounded</Badge>
                  {h.sourceChars > 0 && (
                    <Badge variant="outline" className="mr-2 text-[10px]">{h.sourceChars} chars</Badge>
                  )}
                  <span className="text-muted-foreground">{h.topic || "(no topic)"}</span>
                  <span className="text-muted-foreground ml-2">· {new Date(h.ts).toLocaleString()}</span>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-3">
          <p className="text-xs text-muted-foreground">
            <strong className="text-foreground">Honesty:</strong> Answers are only as accurate as your source. Items marked{" "}
            <span className="text-amber-600 dark:text-amber-400">⚠ not grounded</span> couldn't be backed by your pasted content — we never fabricate facts, statistics, or quotes. All generation runs locally; nothing is uploaded.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function FaqItemCard({
  item,
  onRegenerate,
}: {
  item: { id: string; question: string; answer: string; grounded: boolean; sourceSnippet?: string };
  onRegenerate: () => void;
}) {
  return (
    <div className="rounded border bg-background p-3 space-y-1.5">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1">
          <p className="text-sm font-medium text-foreground">{item.question}</p>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={onRegenerate}
          title="Regenerate this Q&A"
          className="h-6 w-6 flex-shrink-0"
        >
          <RefreshCw className="h-3 w-3" />
        </Button>
      </div>
      <p className="text-xs text-foreground">{item.answer}</p>
      <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
        {item.grounded ? (
          <Badge variant="secondary" className="text-[9px] bg-emerald-500/10 text-emerald-700 dark:text-emerald-300">
            Grounded in source
          </Badge>
        ) : (
          <Badge variant="secondary" className="text-[9px] bg-amber-500/10 text-amber-700 dark:text-amber-300 gap-1">
            <AlertTriangle className="h-2.5 w-2.5" /> Not grounded
          </Badge>
        )}
        {item.sourceSnippet && (
          <span className="text-[10px] text-muted-foreground italic truncate max-w-[400px]">
            “{item.sourceSnippet}”
          </span>
        )}
      </div>
    </div>
  );
}

function TabButton({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <Button
      variant={active ? "default" : "outline"}
      size="sm"
      onClick={onClick}
      className="text-[11px] h-7"
    >
      {label}
    </Button>
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
    ? "text-amber-600 dark:text-amber-400"
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
