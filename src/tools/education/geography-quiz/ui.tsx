"use client";

import React, { useState, useMemo, useCallback, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  CopyButton,
  DownloadButton,
  EmptyState,
  ShareButton,
} from "../../_shared";
import { toast } from "sonner";
import {
  COUNTRY_DB,
  TOPIC_LABELS,
  REGION_LABELS,
  DIFFICULTY_LABELS,
  QUESTION_TYPE_LABELS,
  CONTINENT_LABELS,
  filterByRegion,
  filterByDifficulty,
  searchCountries,
  generateQuiz,
  validateAnswer,
  computeScore,
  computeSummaryStats,
  renderText,
  renderHtml,
  renderCsv,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  type Topic,
  type Region,
  type Difficulty,
  type QuestionType,
  type QuizQuestion,
  type HistoryEntry,
} from "./logic";
import {
  Globe, History, Check, X, Trophy, RotateCcw, Search, Code, Flag, ListChecks,
} from "lucide-react";

type RenderMode = "text" | "html" | "csv";

export default function GeographyQuiz() {
  const [topic, setTopic] = useState<Topic>("capitals");
  const [region, setRegion] = useState<Region>("world");
  const [count, setCount] = useState(10);
  const [difficulty, setDifficulty] = useState<Difficulty>("easy");
  const [questionType, setQuestionType] = useState<QuestionType>("multiple-choice");

  const [quiz, setQuiz] = useState<QuizQuestion[] | null>(null);
  const [answers, setAnswers] = useState<(string | number)[]>([]);
  const [submitted, setSubmitted] = useState(false);

  const [renderMode, setRenderMode] = useState<RenderMode>("text");
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [countrySearch, setCountrySearch] = useState("");

  useEffect(() => {
    setHistory(loadHistory());
    if (typeof window !== "undefined" && window.location.hash) {
      const p = parseShareUrl(window.location.hash);
      if (p.topic) setTopic(p.topic);
      if (p.region) setRegion(p.region);
      if (typeof p.count === "number") setCount(p.count);
      if (p.difficulty) setDifficulty(p.difficulty);
      if (p.type) setQuestionType(p.type);
      const hasAny = p.topic || p.region || p.difficulty || p.type || p.count;
      if (hasAny) toast.info("Loaded settings from share link");
    }
  }, []);

  // Compute the pool size for current settings (preview before generating)
  const poolSize = useMemo(() => {
    return filterByDifficulty(filterByRegion(COUNTRY_DB, region), difficulty).length;
  }, [region, difficulty]);

  const canGenerate = poolSize > 0;

  const handleGenerate = useCallback(() => {
    if (!canGenerate) {
      toast.error("No countries match these filters");
      return;
    }
    const qs = generateQuiz({ topic, region, count, difficulty, type: questionType });
    if (qs.length === 0) {
      toast.error("No questions could be generated");
      return;
    }
    setQuiz(qs);
    setAnswers(new Array(qs.length).fill(questionType === "multiple-choice" ? -1 : ""));
    setSubmitted(false);
    toast.success(`Generated ${qs.length} questions`);
  }, [topic, region, count, difficulty, questionType, canGenerate]);

  const handleAnswerMc = (qi: number, optIdx: number) => {
    if (submitted) return;
    setAnswers((prev) => {
      const next = [...prev];
      next[qi] = optIdx;
      return next;
    });
  };

  const handleAnswerText = (qi: number, val: string) => {
    if (submitted) return;
    setAnswers((prev) => {
      const next = [...prev];
      next[qi] = val;
      return next;
    });
  };

  const handleSubmit = useCallback(() => {
    if (!quiz) return;
    setSubmitted(true);
    const result = computeScore(quiz, answers);
    saveHistory({
      ts: Date.now(),
      topic,
      region,
      difficulty,
      type: questionType,
      total: result.total,
      correct: result.correct,
      percentage: result.percentage,
    });
    setHistory(loadHistory());
    toast.success(`Scored ${result.correct}/${result.total} (${result.percentage}%)`);
  }, [quiz, answers, topic, region, difficulty, questionType]);

  const handleReset = useCallback(() => {
    setQuiz(null);
    setAnswers([]);
    setSubmitted(false);
  }, []);

  const handleRegenerate = useCallback(() => {
    handleGenerate();
  }, [handleGenerate]);

  const handleClearSettings = useCallback(() => {
    setTopic("capitals");
    setRegion("world");
    setCount(10);
    setDifficulty("easy");
    setQuestionType("multiple-choice");
    toast.info("Settings reset");
  }, []);

  const handleClearHistory = useCallback(() => {
    clearHistory();
    setHistory([]);
    toast.success("History cleared");
  }, []);

  const result = useMemo(() => {
    if (!quiz || !submitted) return null;
    return computeScore(quiz, answers);
  }, [quiz, answers, submitted]);

  const summaryStats = useMemo(() => {
    if (!result) return null;
    return computeSummaryStats(result);
  }, [result]);

  const renderOutput = useMemo(() => {
    if (!quiz) return "";
    if (renderMode === "text") return renderText(quiz);
    if (renderMode === "html") return renderHtml(quiz, `${TOPIC_LABELS[topic]} Quiz`);
    return renderCsv(quiz);
  }, [quiz, renderMode, topic]);

  const downloadFilename = useMemo(() => {
    const base = `geography-quiz-${topic}-${region}`.toLowerCase().replace(/[^a-z0-9-]+/g, "-");
    const ext = renderMode === "html" ? "html" : renderMode === "csv" ? "csv" : "txt";
    return `${base}.${ext}`;
  }, [topic, region, renderMode]);

  const downloadMime = renderMode === "html" ? "text/html" : renderMode === "csv" ? "text/csv" : "text/plain";

  const filteredCountries = useMemo(
    () => searchCountries(COUNTRY_DB, countrySearch),
    [countrySearch],
  );

  const allAnswered = useMemo(() => {
    if (!quiz) return false;
    return answers.every((a) => {
      if (questionType === "multiple-choice") return typeof a === "number" && a >= 0;
      return typeof a === "string" && a.trim().length > 0;
    });
  }, [quiz, answers, questionType]);

  return (
    <div className="space-y-4 unq-animate-fade-in-up">
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            <div>
              <Label className="text-xs">Topic</Label>
              <select
                value={topic}
                onChange={(e) => setTopic(e.target.value as Topic)}
                className="mt-1 w-full h-9 text-xs rounded border bg-background px-2"
              >
                {(Object.keys(TOPIC_LABELS) as Topic[]).map((t) => (
                  <option key={t} value={t}>{TOPIC_LABELS[t]}</option>
                ))}
              </select>
            </div>
            <div>
              <Label className="text-xs">Region</Label>
              <select
                value={region}
                onChange={(e) => setRegion(e.target.value as Region)}
                className="mt-1 w-full h-9 text-xs rounded border bg-background px-2"
              >
                {(Object.keys(REGION_LABELS) as Region[]).map((r) => (
                  <option key={r} value={r}>{REGION_LABELS[r]}</option>
                ))}
              </select>
            </div>
            <div>
              <Label className="text-xs">Difficulty</Label>
              <select
                value={difficulty}
                onChange={(e) => setDifficulty(e.target.value as Difficulty)}
                className="mt-1 w-full h-9 text-xs rounded border bg-background px-2"
              >
                {(Object.keys(DIFFICULTY_LABELS) as Difficulty[]).map((d) => (
                  <option key={d} value={d}>{DIFFICULTY_LABELS[d]}</option>
                ))}
              </select>
            </div>
            <div>
              <Label className="text-xs">Question type</Label>
              <select
                value={questionType}
                onChange={(e) => setQuestionType(e.target.value as QuestionType)}
                className="mt-1 w-full h-9 text-xs rounded border bg-background px-2"
              >
                {(Object.keys(QUESTION_TYPE_LABELS) as QuestionType[]).map((qt) => (
                  <option key={qt} value={qt}>{QUESTION_TYPE_LABELS[qt]}</option>
                ))}
              </select>
            </div>
            <div>
              <Label className="text-xs">Number of questions</Label>
              <Input
                type="number"
                min={1}
                max={50}
                value={count}
                onChange={(e) => setCount(Math.max(1, Math.min(50, parseInt(e.target.value, 10) || 1)))}
                className="mt-1 h-9 text-xs"
              />
            </div>
            <div className="flex items-end gap-2">
              <Button size="sm" onClick={handleGenerate} disabled={!canGenerate} className="gap-1.5">
                <Globe className="h-3.5 w-3.5" />
                {quiz ? "New quiz" : "Generate quiz"}
              </Button>
              <ShareButton
                getUrl={() => buildShareUrl({ topic, region, count, difficulty, type: questionType })}
              />
            </div>
          </div>
          <div className="text-xs text-muted-foreground flex items-center gap-2">
            <Badge variant="outline" className="text-[10px]">Pool: {poolSize} countries</Badge>
            {poolSize === 0 && <span className="text-destructive">No countries match — try another region/difficulty</span>}
          </div>
        </CardContent>
      </Card>

      {quiz ? (
        <>
          {/* Quiz taking / review panel */}
          <Card>
            <CardContent className="p-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                  <ListChecks className="h-4 w-4" /> Quiz: {TOPIC_LABELS[topic]} · {REGION_LABELS[region]} · {DIFFICULTY_LABELS[difficulty]}
                </h3>
                {submitted ? (
                  <Button variant="outline" size="sm" onClick={handleRegenerate} className="gap-1.5">
                    <RotateCcw className="h-3.5 w-3.5" /> New quiz
                  </Button>
                ) : (
                  <Button size="sm" onClick={handleSubmit} disabled={!allAnswered} className="gap-1.5">
                    <Trophy className="h-3.5 w-3.5" /> Submit answers
                  </Button>
                )}
              </div>

              {result && summaryStats && (
                <div className="rounded border bg-muted/30 p-3 space-y-2">
                  <div className="flex items-center gap-2">
                    <Trophy className="h-5 w-5 text-amber-500" />
                    <span className="text-base font-semibold text-foreground">
                      {result.correct} / {result.total} correct ({result.percentage}%)
                    </span>
                    <Badge variant={result.percentage >= 70 ? "default" : "secondary"} className="text-[10px]">
                      {result.percentage >= 90 ? "Excellent"
                        : result.percentage >= 70 ? "Pass"
                          : result.percentage >= 40 ? "Keep practicing"
                            : "Try again"}
                    </Badge>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                    <Stat label="Total" value={summaryStats.total} />
                    <Stat label="Correct" value={summaryStats.correct} />
                    <Stat label="Accuracy" value={`${summaryStats.accuracy}%`} />
                    <Stat label="Hardest region" value={summaryStats.hardestRegion ? CONTINENT_LABELS[summaryStats.hardestRegion as keyof typeof CONTINENT_LABELS] ?? summaryStats.hardestRegion : "—"} />
                  </div>
                  {Object.keys(result.byRegion).length > 0 && (
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {Object.entries(result.byRegion).map(([r, s]) => (
                        <Badge key={r} variant="outline" className="text-[10px]">
                          {CONTINENT_LABELS[r as keyof typeof CONTINENT_LABELS] ?? r}: {s.correct}/{s.total}
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
              )}

              <div className="space-y-2 max-h-[500px] overflow-auto pr-1">
                {quiz.map((q, qi) => {
                  const ua = answers[qi];
                  const isCorrect = submitted && (
                    q.type === "multiple-choice"
                      ? typeof ua === "number" && ua === q.correctIndex
                      : typeof ua === "string" && validateAnswer(ua, q.answer)
                  );
                  return (
                    <div
                      key={q.id}
                      className={`rounded border px-3 py-2 text-xs ${submitted ? (isCorrect ? "border-emerald-400 bg-emerald-50/30 dark:bg-emerald-950/20" : "border-red-400 bg-red-50/30 dark:bg-red-950/20") : "bg-background"}`}
                    >
                      <div className="font-medium text-foreground flex items-start gap-2">
                        <span className="font-mono text-muted-foreground">{qi + 1}.</span>
                        <span className="flex-1">{q.prompt}</span>
                        {submitted && (isCorrect ? <Check className="h-4 w-4 text-emerald-600" /> : <X className="h-4 w-4 text-red-600" />)}
                      </div>
                      {q.type === "multiple-choice" ? (
                        <div className="mt-2 space-y-1 pl-5">
                          {q.options.map((opt, oi) => {
                            const selected = ua === oi;
                            const showCorrect = submitted && oi === q.correctIndex;
                            const showWrong = submitted && selected && oi !== q.correctIndex;
                            return (
                              <label
                                key={oi}
                                className={`flex items-center gap-2 cursor-pointer rounded px-2 py-1 ${showCorrect ? "bg-emerald-100 dark:bg-emerald-900/30" : showWrong ? "bg-red-100 dark:bg-red-900/30" : "hover:bg-muted/40"}`}
                              >
                                <input
                                  type="radio"
                                  name={`q-${qi}`}
                                  checked={selected}
                                  disabled={submitted}
                                  onChange={() => handleAnswerMc(qi, oi)}
                                />
                                <span className="font-mono text-[10px] text-muted-foreground">{String.fromCharCode(65 + oi)})</span>
                                <span>{opt}</span>
                              </label>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="mt-2 pl-5">
                          <Input
                            type="text"
                            value={typeof ua === "string" ? ua : ""}
                            onChange={(e) => handleAnswerText(qi, e.target.value)}
                            disabled={submitted}
                            placeholder="Type your answer…"
                            className="h-7 text-xs"
                          />
                          {submitted && (
                            <div className="mt-1 text-[11px] text-muted-foreground">
                              Correct answer: <span className="font-medium text-foreground">{q.answer}</span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Export panel */}
          <Card>
            <CardContent className="p-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                  <Code className="h-4 w-4" /> Export quiz
                </h3>
                <div className="flex flex-wrap gap-1">
                  {(["text", "html", "csv"] as RenderMode[]).map((m) => (
                    <Button
                      key={m}
                      variant={renderMode === m ? "default" : "outline"}
                      size="sm"
                      className="h-7 text-[11px]"
                      onClick={() => setRenderMode(m)}
                    >
                      {m === "text" ? "TXT" : m === "html" ? "HTML" : "CSV"}
                    </Button>
                  ))}
                </div>
              </div>
              <pre className="text-[11px] font-mono whitespace-pre-wrap break-words rounded border bg-muted/30 p-3 max-h-[280px] overflow-auto">
                {renderOutput}
              </pre>
              <div className="flex flex-wrap gap-2">
                <CopyButton getText={() => renderOutput} label="Copy output" />
                <DownloadButton
                  getText={() => renderOutput}
                  filename={downloadFilename}
                  mime={downloadMime}
                  label={`Download .${downloadFilename.split(".").pop()}`}
                />
                <DownloadButton
                  getText={() => renderHtml(quiz, `${TOPIC_LABELS[topic]} Quiz`)}
                  filename={`geography-quiz-${topic}.html`}
                  mime="text/html"
                  label="Download HTML"
                />
                <DownloadButton
                  getText={() => renderCsv(quiz)}
                  filename={`geography-quiz-${topic}.csv`}
                  mime="text/csv"
                  label="Download CSV"
                />
              </div>
            </CardContent>
          </Card>
        </>
      ) : (
        <EmptyState
          title="Generate a geography quiz"
          hint="Pick a topic, region, difficulty, and question type above, then click 'Generate quiz'. The built-in 150+ country database covers all 6 inhabited continents."
          icon={<Globe className="h-8 w-8" />}
        />
      )}

      {/* Country reference / flag descriptions */}
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
              <Flag className="h-4 w-4" /> Country reference ({filteredCountries.length})
            </h3>
            <div className="relative">
              <Search className="h-3.5 w-3.5 absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={countrySearch}
                onChange={(e) => setCountrySearch(e.target.value)}
                placeholder="Search countries, capitals, currencies…"
                className="h-8 pl-7 max-w-[260px] text-xs"
              />
            </div>
          </div>
          <div className="space-y-1 max-h-[280px] overflow-auto pr-1">
            {filteredCountries.slice(0, 50).map((c) => (
              <div key={c.code} className="rounded border bg-background px-3 py-1.5 text-xs">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-[10px] font-mono">{c.code}</Badge>
                  <span className="font-medium text-foreground">{c.name}</span>
                  <Badge variant="secondary" className="text-[10px]">{CONTINENT_LABELS[c.continent]}</Badge>
                  {c.fame === 1 && <Badge variant="outline" className="text-[10px] text-emerald-600">easy</Badge>}
                  {c.fame === 2 && <Badge variant="outline" className="text-[10px] text-amber-600">medium</Badge>}
                  {c.fame === 3 && <Badge variant="outline" className="text-[10px] text-red-600">hard</Badge>}
                </div>
                <div className="text-[11px] text-muted-foreground mt-0.5">
                  <span className="font-mono">Capital:</span> {c.capital} ·
                  <span className="font-mono ml-1">Currency:</span> {c.currency} ·
                  <span className="font-mono ml-1">Lang:</span> {c.language} ·
                  <span className="font-mono ml-1">Pop:</span> {c.population}M
                </div>
                <div className="text-[11px] text-muted-foreground mt-0.5 italic">
                  <Flag className="h-3 w-3 inline mr-1" />{c.flagDesc}
                </div>
              </div>
            ))}
            {filteredCountries.length > 50 && (
              <div className="text-center text-[11px] text-muted-foreground py-2">
                Showing first 50 of {filteredCountries.length} matches. Refine your search to see more.
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* History */}
      {history.length > 0 && (
        <Card>
          <CardContent className="p-4 space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <History className="h-4 w-4" /> Recent quizzes ({history.length})
              </h3>
              <Button variant="ghost" size="sm" onClick={handleClearHistory}>Clear</Button>
            </div>
            <div className="space-y-1">
              {history.slice(0, 8).map((h, i) => (
                <div key={i} className="rounded border bg-background px-3 py-2 text-xs flex flex-wrap items-center gap-2">
                  <Badge variant="outline" className="text-[10px]">{TOPIC_LABELS[h.topic]}</Badge>
                  <Badge variant="outline" className="text-[10px]">{REGION_LABELS[h.region]}</Badge>
                  <Badge variant="outline" className="text-[10px]">{DIFFICULTY_LABELS[h.difficulty].split(" ")[0]}</Badge>
                  <Badge variant="outline" className="text-[10px]">{QUESTION_TYPE_LABELS[h.type]}</Badge>
                  <span className="font-medium text-foreground">{h.correct}/{h.total}</span>
                  <span className="text-muted-foreground">({h.percentage}%)</span>
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
            <strong className="text-foreground">Privacy:</strong> The entire country database lives in your browser. Quiz generation, scoring, and rendering all run locally. History is stored in localStorage on this device only.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function Stat({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) {
  return (
    <div className="rounded border bg-background px-3 py-2">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="text-base font-semibold text-foreground">{value}</div>
    </div>
  );
}
