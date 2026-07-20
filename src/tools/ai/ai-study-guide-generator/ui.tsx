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
  FORMAT_LABELS,
  READING_LEVEL_LABELS,
  DEPTH_LABELS,
  DEPTH_CONFIG,
  TOPIC_PRESETS,
  clean,
  generateStudyGuide,
  renderMarkdown,
  renderText,
  renderCsv,
  renderJson,
  renderFlashcardsJson,
  loadHistory,
  saveHistory,
  clearHistory,
  loadFavorites,
  saveFavorite,
  removeFavorite,
  clearFavorites,
  buildShareUrl,
  parseShareUrl,
  buildLlmPrompt,
  renderLlmResult,
  type GuideFormat,
  type ReadingLevel,
  type Depth,
  type StudyGuide,
  type QuestionAnswer,
  type HistoryEntry,
  type FavoriteEntry,
  type ShareState,
} from "./logic";
import {
  BookOpen, Sparkles, Key, History, Hash, ListTree,
  AlertCircle, Star, Trash2, HelpCircle, Layers,
  ChevronDown, ChevronRight, Brain,
} from "lucide-react";

const SAMPLE_NOTES = `Photosynthesis is the process by which plants convert light energy into chemical energy.
The chloroplasts in plant cells contain chlorophyll, which absorbs sunlight.
During photosynthesis, carbon dioxide and water are converted into glucose and oxygen.
This process occurs in two stages: the light-dependent reactions and the Calvin cycle.
The light-dependent reactions take place in the thylakoid membranes.
The Calvin cycle takes place in the stroma of the chloroplast.
Chlorophyll is the green pigment responsible for absorbing light energy.
Stomata are tiny pores on leaves that allow gas exchange.
Plants release oxygen as a byproduct of photosynthesis.`;

export default function AiStudyGuideGenerator() {
  const [format, setFormat] = useState<GuideFormat>("outline");
  const [readingLevel, setReadingLevel] = useState<ReadingLevel>("high");
  const [depth, setDepth] = useState<Depth>("standard");
  const [topic, setTopic] = useState("");
  const [sourceText, setSourceText] = useState("");
  const [guide, setGuide] = useState<StudyGuide | null>(null);
  const [revealedAnswers, setRevealedAnswers] = useState<Set<string>>(new Set());
  const [collapsedSections, setCollapsedSections] = useState<Set<number>>(new Set());
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [faves, setFaves] = useState<FavoriteEntry[]>([]);
  const [error, setError] = useState("");
  const [showLlm, setShowLlm] = useState(false);
  const [llmKey, setLlmKey] = useState("");
  const [llmProvider, setLlmProvider] = useState<"openai" | "anthropic">("openai");
  const [llmLoading, setLlmLoading] = useState(false);

  useEffect(() => {
    setHistory(loadHistory());
    setFaves(loadFavorites());
    const key = typeof localStorage !== "undefined"
      ? localStorage.getItem("unqtools:ai-study-guide:llm-key")
      : null;
    if (key) setLlmKey(key);
    if (typeof window !== "undefined" && window.location.hash) {
      const p = parseShareUrl(window.location.hash);
      if (p.format) setFormat(p.format);
      if (p.readingLevel) setReadingLevel(p.readingLevel);
      if (p.depth) setDepth(p.depth);
      if (p.topic) setTopic(p.topic);
      if (p.topic) toast.info("Loaded from share link");
    }
  }, []);

  const handleGenerate = useCallback(() => {
    const text = clean(sourceText);
    if (!text) {
      setError("Paste your notes or chapter text to generate a study guide.");
      toast.error("Paste source text first");
      return;
    }
    if (text.length < 50) {
      setError("Source text is too short — paste at least a paragraph.");
      toast.error("Need more source text");
      return;
    }
    setError("");
    const g = generateStudyGuide(text, format, readingLevel, depth, clean(topic));
    setGuide(g);
    setRevealedAnswers(new Set());
    setCollapsedSections(new Set());
    saveHistory({
      ts: Date.now(),
      format, readingLevel, depth, topic: clean(topic),
      inputWordCount: g.meta.inputWordCount,
      questionCount: g.meta.questionCount,
      flashcardCount: g.meta.flashcardCount,
    });
    setHistory(loadHistory());
    toast.success(`Generated ${g.meta.termCount} terms, ${g.meta.questionCount} questions, ${g.meta.flashcardCount} flashcards`);
  }, [sourceText, format, readingLevel, depth, topic]);

  const shareState: ShareState = { format, readingLevel, depth, topic };

  const handleClear = useCallback(() => {
    setGuide(null);
    setRevealedAnswers(new Set());
    setCollapsedSections(new Set());
    setError("");
    toast.info("Cleared");
  }, []);

  const handleClearHistory = useCallback(() => {
    clearHistory();
    setHistory([]);
    toast.success("History cleared");
  }, []);

  const handleSaveFavorite = useCallback(() => {
    if (!guide) return;
    saveFavorite({
      ts: Date.now(),
      format: guide.format,
      readingLevel: guide.readingLevel,
      depth: guide.depth,
      topic: guide.topic,
      markdown: renderMarkdown(guide),
    });
    setFaves(loadFavorites());
    toast.success("Saved to favorites");
  }, [guide]);

  const handleRemoveFavorite = useCallback((ts: number) => {
    removeFavorite(ts);
    setFaves(loadFavorites());
    toast.info("Removed from favorites");
  }, []);

  const handleClearFavorites = useCallback(() => {
    clearFavorites();
    setFaves([]);
    toast.success("Favorites cleared");
  }, []);

  const toggleAnswer = useCallback((qid: string) => {
    setRevealedAnswers((prev) => {
      const next = new Set(prev);
      if (next.has(qid)) next.delete(qid);
      else next.add(qid);
      return next;
    });
  }, []);

  const toggleSection = useCallback((idx: number) => {
    setCollapsedSections((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  }, []);

  const handleSaveLlmKey = () => {
    if (typeof localStorage !== "undefined") {
      if (llmKey) localStorage.setItem("unqtools:ai-study-guide:llm-key", llmKey);
      else localStorage.removeItem("unqtools:ai-study-guide:llm-key");
    }
    toast.success(llmKey ? "API key saved locally" : "API key cleared");
  };

  const handleLlmEnhance = useCallback(async () => {
    if (!llmKey) {
      toast.error("Please paste your API key first");
      return;
    }
    const text = clean(sourceText);
    if (!text) {
      toast.error("Paste source text first");
      return;
    }
    setLlmLoading(true);
    setError("");
    try {
      const prompt = buildLlmPrompt(format, readingLevel, depth, clean(topic), text);
      const url = llmProvider === "openai"
        ? "https://api.openai.com/v1/chat/completions"
        : "https://api.anthropic.com/v1/messages";
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      let body: Record<string, unknown>;
      if (llmProvider === "openai") {
        headers["Authorization"] = `Bearer ${llmKey}`;
        body = {
          model: "gpt-4o-mini",
          messages: [
            { role: "system", content: "You are an expert tutor who turns notes into structured study guides." },
            { role: "user", content: prompt },
          ],
          temperature: 0.4,
        };
      } else {
        headers["x-api-key"] = llmKey;
        headers["anthropic-version"] = "2023-06-01";
        body = {
          model: "claude-3-5-haiku-20241022",
          max_tokens: 4096,
          messages: [{ role: "user", content: prompt }],
        };
      }
      const res = await fetch(url, { method: "POST", headers, body: JSON.stringify(body) });
      if (!res.ok) {
        const txt = await res.text();
        setError(`LLM request failed (${res.status}): ${txt.slice(0, 200)}`);
        toast.error("LLM request failed");
        setLlmLoading(false);
        return;
      }
      const data = await res.json();
      const rawText = llmProvider === "openai"
        ? (data.choices?.[0]?.message?.content ?? "")
        : (data.content?.[0]?.text ?? "");
      const parsed = renderLlmResult(rawText);
      if (!parsed.ok) {
        setError(parsed.error);
        setLlmLoading(false);
        return;
      }
      // Merge LLM result into the existing guide
      if (guide) {
        setGuide({
          ...guide,
          overview: parsed.result.overview || guide.overview,
          learningObjectives: parsed.result.learningObjectives.length > 0
            ? parsed.result.learningObjectives
            : guide.learningObjectives,
          keyTerms: parsed.result.keyTerms.length > 0
            ? parsed.result.keyTerms.map((t, i) => ({
                term: t.term,
                definition: t.definition,
                score: 1,
                occurrences: 1,
              }))
            : guide.keyTerms,
          questions: parsed.result.questions.length > 0
            ? parsed.result.questions.map((q, i) => ({
                id: `llm-q-${i}`,
                type: q.type,
                question: q.question,
                answer: q.answer,
                choices: q.choices,
                correctIndex: q.correctIndex,
                sourceSentence: q.sourceSentence,
              }))
            : guide.questions,
          flashcards: parsed.result.keyTerms.length > 0
            ? parsed.result.keyTerms.slice(0, 20).map((t, i) => ({
                id: `llm-fc-${i}`,
                front: t.term,
                back: t.definition,
              }))
            : guide.flashcards,
        });
        toast.success(`LLM enhanced the guide`);
      }
    } catch (err) {
      setError(`LLM error: ${err instanceof Error ? err.message : String(err)}`);
      toast.error("LLM enhancement failed");
    } finally {
      setLlmLoading(false);
    }
  }, [llmKey, llmProvider, format, readingLevel, depth, topic, sourceText, guide]);

  const markdown = useMemo(() => guide ? renderMarkdown(guide) : "", [guide]);
  const json = useMemo(() => guide ? renderJson(guide) : "", [guide]);
  const csv = useMemo(() => guide ? renderCsv(guide) : "", [guide]);
  const flashcardsJson = useMemo(() => guide ? renderFlashcardsJson(guide) : "", [guide]);

  return (
    <div className="space-y-4 unq-animate-fade-in-up">
      <Card>
        <CardContent className="p-4 space-y-3">
          <div>
            <Label className="text-xs">Output format</Label>
            <div className="flex flex-wrap gap-2 pt-1">
              {(Object.keys(FORMAT_LABELS) as GuideFormat[]).map((f) => (
                <Button
                  key={f}
                  variant={format === f ? "default" : "outline"}
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => setFormat(f)}
                >{FORMAT_LABELS[f]}</Button>
              ))}
            </div>
          </div>
          <div>
            <Label className="text-xs">Reading level</Label>
            <div className="flex flex-wrap gap-2 pt-1">
              {(Object.keys(READING_LEVEL_LABELS) as ReadingLevel[]).map((r) => (
                <Button
                  key={r}
                  variant={readingLevel === r ? "default" : "outline"}
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => setReadingLevel(r)}
                >{READING_LEVEL_LABELS[r]}</Button>
              ))}
            </div>
          </div>
          <div>
            <Label className="text-xs">Depth</Label>
            <div className="flex flex-wrap gap-2 pt-1">
              {(Object.keys(DEPTH_LABELS) as Depth[]).map((d) => (
                <Button
                  key={d}
                  variant={depth === d ? "default" : "outline"}
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => setDepth(d)}
                >{DEPTH_LABELS[d].split(" ")[0]}</Button>
              ))}
            </div>
            <p className="text-[11px] text-muted-foreground mt-1">
              {DEPTH_LABELS[depth]} · {DEPTH_CONFIG[depth].sentencesPerSection} sentences per section, {DEPTH_CONFIG[depth].questionCount} questions
            </p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="sg-topic">Topic (optional — auto-detected if blank)</Label>
            <Input
              id="sg-topic"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="e.g., Photosynthesis"
              className="text-sm"
            />
            <div className="flex flex-wrap gap-1">
              {TOPIC_PRESETS.map((t) => (
                <Button
                  key={t}
                  variant="ghost"
                  size="sm"
                  className="h-6 text-[11px]"
                  onClick={() => setTopic(t)}
                >+ {t}</Button>
              ))}
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="sg-source">Source notes / chapter text</Label>
            <Textarea
              id="sg-source"
              value={sourceText}
              onChange={(e) => setSourceText(e.target.value)}
              placeholder="Paste your notes or textbook chapter here. The longer the input, the richer the guide."
              className="min-h-[160px] resize-y font-sans text-sm"
            />
            <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
              <Badge variant="outline" className="text-[10px]">{sourceText.split(/\s+/).filter(Boolean).length} words</Badge>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 text-[11px]"
                onClick={() => setSourceText(SAMPLE_NOTES)}
              >Load sample notes</Button>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 pt-1">
            <RunButton onClick={handleGenerate} label="Generate study guide" />
            <ShareButton getUrl={() => buildShareUrl(shareState)} />
            <ClearButton onClick={handleClear} />
          </div>
        </CardContent>
      </Card>

      {error && <ErrorBanner message={error} />}

      {guide ? (
        <>
          <Card>
            <CardContent className="p-4 space-y-2">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <Sparkles className="h-4 w-4" /> Study Guide: {guide.topic || "(auto-detected)"}
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                <Stat label="Format" value={FORMAT_LABELS[guide.format]} />
                <Stat label="Input words" value={guide.meta.inputWordCount} />
                <Stat label="Output words" value={guide.meta.outputWordCount} />
                <Stat label="Compression" value={`${guide.meta.compressionRatio.toFixed(2)}×`} />
                <Stat label="Key terms" value={guide.meta.termCount} />
                <Stat label="Questions" value={guide.meta.questionCount} />
                <Stat label="Flashcards" value={guide.meta.flashcardCount} />
                <Stat label="Sections" value={guide.sections.length} />
              </div>
              <div className="flex flex-wrap gap-2 pt-2">
                <CopyButton getText={() => markdown} label="Copy Markdown" />
                <DownloadButton getText={() => markdown} filename="study-guide.md" mime="text/markdown" label="Download .md" />
                <DownloadButton getText={() => json} filename="study-guide.json" mime="application/json" label="Download JSON" />
                <DownloadButton getText={() => csv} filename="study-guide-questions.csv" mime="text/csv" label="Download Q's CSV" />
                <DownloadButton getText={() => flashcardsJson} filename="study-guide-flashcards.json" mime="application/json" label="Download flashcards" />
                <Button variant="ghost" size="sm" className="gap-1.5" onClick={handleSaveFavorite}>
                  <Star className="h-3.5 w-3.5" /> Save
                </Button>
              </div>
            </CardContent>
          </Card>

          {guide.overview && (
            <Card>
              <CardContent className="p-4 space-y-2">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                  <BookOpen className="h-4 w-4" /> Overview
                </h3>
                <p className="text-sm text-foreground">{guide.overview}</p>
              </CardContent>
            </Card>
          )}

          {guide.learningObjectives.length > 0 && (
            <Card>
              <CardContent className="p-4 space-y-2">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                  <ListTree className="h-4 w-4" /> Learning Objectives
                </h3>
                <ul className="list-disc list-inside space-y-1 text-sm">
                  {guide.learningObjectives.map((o, i) => (
                    <li key={i}>{o}</li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}

          {guide.keyTerms.length > 0 && (
            <Card>
              <CardContent className="p-4 space-y-2">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                  <Hash className="h-4 w-4" /> Key Terms ({guide.keyTerms.length})
                </h3>
                <div className="space-y-2">
                  {guide.keyTerms.map((t, i) => (
                    <div key={i} className="rounded border bg-background px-3 py-2 text-xs">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-mono font-semibold text-foreground">{t.term}</span>
                        <Badge variant="outline" className="text-[10px]">{t.occurrences}× in source</Badge>
                      </div>
                      <p className="text-muted-foreground">{t.definition}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {guide.sections.length > 0 && (guide.format === "outline" || guide.format === "summary") && (
            <Card>
              <CardContent className="p-4 space-y-2">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                  <Layers className="h-4 w-4" /> Sections ({guide.sections.length})
                </h3>
                <div className="space-y-2">
                  {guide.sections.map((sec, i) => (
                    <div key={i} className="rounded border bg-background px-3 py-2 text-xs">
                      <button
                        onClick={() => toggleSection(i)}
                        className="flex items-center gap-1.5 w-full text-left hover:underline"
                      >
                        {collapsedSections.has(i) ? <ChevronRight className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                        <span className="font-semibold text-foreground">{sec.heading}</span>
                        <Badge variant="secondary" className="text-[10px] ml-auto">{sec.sentences.length} pts</Badge>
                      </button>
                      {!collapsedSections.has(i) && (
                        <ul className="list-disc list-inside space-y-1 mt-1.5">
                          {sec.sentences.map((s, j) => (
                            <li key={j}>{s}</li>
                          ))}
                        </ul>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {guide.summary.length > 0 && guide.format === "summary" && (
            <Card>
              <CardContent className="p-4 space-y-2">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                  <BookOpen className="h-4 w-4" /> Summary
                </h3>
                <div className="space-y-1.5 text-sm">
                  {guide.summary.map((s, i) => (
                    <p key={i}>{s}</p>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {guide.questions.length > 0 && (guide.format === "qa" || guide.format === "summary") && (
            <Card>
              <CardContent className="p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                    <HelpCircle className="h-4 w-4" /> Self-Test Questions ({guide.questions.length})
                  </h3>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-xs"
                    onClick={() => {
                      if (revealedAnswers.size === guide.questions.length) {
                        setRevealedAnswers(new Set());
                      } else {
                        setRevealedAnswers(new Set(guide.questions.map((q) => q.id)));
                      }
                    }}
                  >
                    {revealedAnswers.size === guide.questions.length ? "Hide all" : "Reveal all"}
                  </Button>
                </div>
                <div className="space-y-2">
                  {guide.questions.map((q, i) => (
                    <QuestionCard
                      key={q.id}
                      q={q}
                      index={i}
                      revealed={revealedAnswers.has(q.id)}
                      onToggle={() => toggleAnswer(q.id)}
                    />
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {guide.flashcards.length > 0 && guide.format === "flashcard" && (
            <Card>
              <CardContent className="p-4 space-y-2">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                  <Brain className="h-4 w-4" /> Flashcards ({guide.flashcards.length})
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {guide.flashcards.map((f, i) => (
                    <div key={f.id} className="rounded border bg-background px-3 py-2 text-xs">
                      <Badge variant="secondary" className="text-[10px] mb-1">Card {i + 1}</Badge>
                      <div className="font-mono font-semibold text-foreground">{f.front}</div>
                      <div className="text-muted-foreground mt-1 border-t pt-1">{f.back}</div>
                    </div>
                  ))}
                </div>
                <div className="flex flex-wrap gap-2 pt-2">
                  <CopyButton getText={() => flashcardsJson} label="Copy flashcards JSON" size="sm" />
                </div>
              </CardContent>
            </Card>
          )}
        </>
      ) : (
        <EmptyState
          title="Generate a structured study guide from your notes"
          hint="Paste your notes or chapter text, choose a format (outline, Q&A, summary sheet, flashcards), reading level, and depth. The tool extracts key terms, summarizes top sentences, and generates self-test questions — all on-device."
          icon={<BookOpen className="h-8 w-8" />}
        />
      )}

      <Card>
        <CardContent className="p-4 space-y-2">
          <button
            onClick={() => setShowLlm((v) => !v)}
            className="flex items-center gap-1.5 text-sm font-semibold text-foreground hover:underline"
          >
            <Key className="h-4 w-4" /> Optional: enhance with your own LLM key
            {showLlm ? " ▾" : " ▸"}
          </button>
          {showLlm && (
            <div className="space-y-2 pt-2">
              <p className="text-xs text-muted-foreground">
                Paste an OpenAI or Anthropic API key to get richer term definitions, more accurate Q&A, and stronger summaries. Your key is stored only in localStorage on this device. The only network call goes directly from your browser to the provider you choose.
              </p>
              <div className="flex flex-wrap gap-2">
                <select
                  value={llmProvider}
                  onChange={(e) => setLlmProvider(e.target.value as "openai" | "anthropic")}
                  className="h-8 text-xs rounded border bg-background px-2"
                >
                  <option value="openai">OpenAI</option>
                  <option value="anthropic">Anthropic</option>
                </select>
                <Input
                  type="password"
                  value={llmKey}
                  onChange={(e) => setLlmKey(e.target.value)}
                  placeholder="sk-..."
                  className="h-8 text-xs flex-1 min-w-[200px]"
                />
                <Button variant="outline" size="sm" onClick={handleSaveLlmKey}>Save key</Button>
                <RunButton
                  onClick={handleLlmEnhance}
                  loading={llmLoading}
                  label="Enhance with LLM"
                />
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {faves.length > 0 && (
        <Card>
          <CardContent className="p-4 space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <Star className="h-4 w-4" /> Favorites ({faves.length})
              </h3>
              <Button variant="ghost" size="sm" onClick={handleClearFavorites}>Clear</Button>
            </div>
            <div className="space-y-1">
              {faves.slice(0, 10).map((f) => (
                <div key={f.ts} className="rounded border bg-background px-3 py-2 text-xs">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant="outline" className="text-[10px]">{FORMAT_LABELS[f.format]}</Badge>
                    <Badge variant="outline" className="text-[10px]">{READING_LEVEL_LABELS[f.readingLevel]}</Badge>
                    <span className="text-muted-foreground ml-auto">{new Date(f.ts).toLocaleDateString()}</span>
                  </div>
                  <div className="mt-1 text-muted-foreground">{f.topic || "(no topic)"}</div>
                  <div className="flex gap-1.5 mt-1">
                    <CopyButton getText={() => f.markdown} label="Copy MD" size="sm" />
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs gap-1.5"
                      onClick={() => handleRemoveFavorite(f.ts)}
                    >
                      <Trash2 className="h-3.5 w-3.5" /> Remove
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
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
              {history.slice(0, 5).map((h) => (
                <button
                  key={h.ts}
                  onClick={() => {
                    setFormat(h.format);
                    setReadingLevel(h.readingLevel);
                    setDepth(h.depth);
                    setTopic(h.topic);
                    toast.info("Loaded from history — click Generate to re-run");
                  }}
                  className="w-full text-left rounded border bg-background px-3 py-2 text-xs hover:bg-muted/30"
                >
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant="outline" className="text-[10px]">{FORMAT_LABELS[h.format]}</Badge>
                    <Badge variant="outline" className="text-[10px]">{READING_LEVEL_LABELS[h.readingLevel]}</Badge>
                    <Badge variant="outline" className="text-[10px]">{h.depth}</Badge>
                    <Badge variant="secondary" className="text-[10px]">{h.inputWordCount}w in</Badge>
                    <span className="text-muted-foreground ml-auto">{new Date(h.ts).toLocaleString()}</span>
                  </div>
                  <div className="mt-1 text-muted-foreground">
                    {h.topic || "(no topic)"} · {h.questionCount} Q's · {h.flashcardCount} cards
                  </div>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-3">
          <p className="text-xs text-muted-foreground">
            <strong className="text-foreground">Privacy:</strong> All summarization, term extraction, and Q&A generation runs locally. History and favorites are stored in localStorage on this device only. The only network call is if you paste your own LLM API key — that request goes directly from your browser to the provider you choose.
          </p>
          <p className="text-xs text-muted-foreground mt-2">
            <strong className="text-foreground">Honesty:</strong> AI can misstate facts — always verify against your source material. On-device extractive summarization is less precise than a BYO-key LLM and works best with dense, factual text (textbook chapters, lecture notes, Wikipedia-style articles). This is a study aid, not a substitute for the source. Nothing is uploaded or logged by us.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function QuestionCard({
  q,
  index,
  revealed,
  onToggle,
}: {
  q: QuestionAnswer;
  index: number;
  revealed: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="rounded border bg-background px-3 py-2 text-xs">
      <div className="flex items-center gap-2 mb-1">
        <Badge variant="secondary" className="text-[10px]">Q{index + 1}</Badge>
        <Badge variant="outline" className="text-[10px]">{q.type === "mcq" ? "MCQ" : "Short answer"}</Badge>
      </div>
      <p className="font-medium text-foreground">{q.question}</p>
      {q.choices && q.type === "mcq" && (
        <ol className="list-[upper-alpha] list-inside mt-1.5 space-y-0.5">
          {q.choices.map((c, i) => (
            <li key={i} className={revealed && i === q.correctIndex ? "text-emerald-600 dark:text-emerald-400 font-medium" : ""}>
              {c}
            </li>
          ))}
        </ol>
      )}
      {revealed ? (
        <div className="mt-2 rounded bg-muted/40 p-2 text-xs">
          <strong>Answer:</strong> {q.answer}
          {q.sourceSentence && (
            <div className="mt-1 text-muted-foreground italic">Source: {q.sourceSentence}</div>
          )}
        </div>
      ) : (
        <Button variant="ghost" size="sm" className="h-7 text-xs mt-1.5" onClick={onToggle}>
          Reveal answer
        </Button>
      )}
      {revealed && (
        <Button variant="ghost" size="sm" className="h-7 text-xs mt-1" onClick={onToggle}>
          Hide
        </Button>
      )}
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
