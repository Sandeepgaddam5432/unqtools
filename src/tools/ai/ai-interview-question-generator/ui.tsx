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
  ROLE_LABELS,
  CATEGORY_LABELS,
  SENIORITY_LABELS,
  ROLE_PRESETS,
  getQuestions,
  computeStats,
  gradeAnswer,
  renderText,
  renderMarkdown,
  renderCsv,
  renderJson,
  loadHistory,
  saveHistory,
  clearHistory,
  loadBanks,
  saveBank,
  removeBank,
  clearBanks,
  buildShareUrl,
  parseShareUrl,
  buildLlmPrompt,
  renderLlmResult,
  type Role,
  type Category,
  type Seniority,
  type Question,
  type GradedAnswer,
  type HistoryEntry,
  type SavedBank,
  type ShareState,
} from "./logic";
import {
  Mic, Sparkles, Key, History, BookMarked, ChevronDown, ChevronRight,
  AlertCircle, Trash2, ClipboardCheck, GraduationCap, ListChecks,
} from "lucide-react";

export default function AiInterviewQuestionGenerator() {
  const [role, setRole] = useState<Role>("developer");
  const [selectedCats, setSelectedCats] = useState<Category[]>([]);
  const [seniority, setSeniority] = useState<Seniority | "">("");
  const [jobDescription, setJobDescription] = useState("");
  const [questions, setQuestions] = useState<Question[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [practiceId, setPracticeId] = useState<string | null>(null);
  const [practiceAnswer, setPracticeAnswer] = useState("");
  const [graded, setGraded] = useState<GradedAnswer | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [banks, setBanks] = useState<SavedBank[]>([]);
  const [bankName, setBankName] = useState("");
  const [error, setError] = useState("");
  const [showLlm, setShowLlm] = useState(false);
  const [llmKey, setLlmKey] = useState("");
  const [llmProvider, setLlmProvider] = useState<"openai" | "anthropic">("openai");
  const [llmLoading, setLlmLoading] = useState(false);

  useEffect(() => {
    setHistory(loadHistory());
    setBanks(loadBanks());
    const key = typeof localStorage !== "undefined"
      ? localStorage.getItem("unqtools:ai-interview:llm-key")
      : null;
    if (key) setLlmKey(key);
    if (typeof window !== "undefined" && window.location.hash) {
      const p = parseShareUrl(window.location.hash);
      if (p.role) setRole(p.role);
      if (p.categories && p.categories.length > 0) setSelectedCats(p.categories);
      if (p.seniority) setSeniority(p.seniority);
      if (p.role || p.categories?.length) toast.info("Loaded from share link");
    }
  }, []);

  const handleGenerate = useCallback(() => {
    setError("");
    const cats = selectedCats.length > 0 ? selectedCats : undefined;
    const sen = seniority || undefined;
    const out = getQuestions(role, cats, sen);
    if (out.length === 0) {
      setError(`No questions match role=${role}, seniority=${sen ?? "any"}, categories=${cats?.join(",") ?? "all"}. Try broadening your filters.`);
      toast.error("No questions match those filters");
      setQuestions([]);
      return;
    }
    setQuestions(out);
    setExpandedId(null);
    setPracticeId(null);
    setGraded(null);
    saveHistory({
      ts: Date.now(),
      role,
      categories: selectedCats,
      seniority: sen ?? null,
      questionCount: out.length,
    });
    setHistory(loadHistory());
    toast.success(`Generated ${out.length} questions`);
  }, [role, selectedCats, seniority]);

  const stats = useMemo(() => computeStats(questions), [questions]);
  const shareState: ShareState = {
    role,
    categories: selectedCats,
    seniority: seniority || null,
  };

  const toggleCat = (c: Category) => {
    setSelectedCats((prev) => prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c]);
  };

  const handleClear = useCallback(() => {
    setQuestions([]);
    setExpandedId(null);
    setPracticeId(null);
    setGraded(null);
    setError("");
    toast.info("Cleared");
  }, []);

  const handleClearHistory = useCallback(() => {
    clearHistory();
    setHistory([]);
    toast.success("History cleared");
  }, []);

  const handleSaveBank = useCallback(() => {
    if (questions.length === 0) {
      toast.error("Generate questions first");
      return;
    }
    const name = bankName.trim() || `${ROLE_LABELS[role]} set · ${new Date().toLocaleDateString()}`;
    saveBank({
      ts: Date.now(),
      name,
      role,
      categories: selectedCats,
      seniority: seniority || null,
      questionIds: questions.map((q) => q.id),
    });
    setBanks(loadBanks());
    setBankName("");
    toast.success(`Saved "${name}"`);
  }, [questions, bankName, role, selectedCats, seniority]);

  const handleRemoveBank = useCallback((ts: number) => {
    removeBank(ts);
    setBanks(loadBanks());
    toast.info("Bank removed");
  }, []);

  const handleClearBanks = useCallback(() => {
    clearBanks();
    setBanks([]);
    toast.success("Banks cleared");
  }, []);

  const handleGrade = useCallback((question: Question) => {
    const result = gradeAnswer({ question, answer: practiceAnswer });
    setGraded(result);
    toast.success(`Graded: ${result.score}/100`);
  }, [practiceAnswer]);

  const handleSaveLlmKey = () => {
    if (typeof localStorage !== "undefined") {
      if (llmKey) localStorage.setItem("unqtools:ai-interview:llm-key", llmKey);
      else localStorage.removeItem("unqtools:ai-interview:llm-key");
    }
    toast.success(llmKey ? "API key saved locally" : "API key cleared");
  };

  const handleLlmEnhance = useCallback(async () => {
    if (!llmKey) {
      toast.error("Please paste your API key first");
      return;
    }
    setLlmLoading(true);
    setError("");
    try {
      const prompt = buildLlmPrompt(
        role,
        seniority || null,
        selectedCats,
        jobDescription.trim(),
      );
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
            { role: "system", content: "You are an expert interviewer and hiring manager who designs role-specific interview questions." },
            { role: "user", content: prompt },
          ],
          temperature: 0.8,
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
      const extra: Question[] = parsed.questions.map((q, i) => ({
        id: `llm-${Date.now()}-${i}`,
        role,
        category: q.category,
        difficulty: q.difficulty,
        text: q.text,
        tags: q.tags,
        modelAnswer: q.modelAnswer,
        followUps: q.followUps,
        redFlags: q.redFlags,
        rubric: [
          { criterion: "communication", weight: 0.2, level0: "Rambling.", level5: "Crisp." },
          { criterion: "depth", weight: 0.25, level0: "Surface.", level5: "Deep." },
          { criterion: "structure", weight: 0.2, level0: "No structure.", level5: "Clear framework." },
          { criterion: "evidence", weight: 0.2, level0: "No examples.", level5: "Quantified." },
          { criterion: "role-fit", weight: 0.15, level0: "Off-target.", level5: "On-target." },
        ],
        seniority: seniority ? [seniority] : ["mid", "senior"],
      }));
      setQuestions((prev) => [...extra, ...prev]);
      toast.success(`LLM added ${extra.length} questions`);
    } catch (err) {
      setError(`LLM error: ${err instanceof Error ? err.message : String(err)}`);
      toast.error("LLM enhancement failed");
    } finally {
      setLlmLoading(false);
    }
  }, [llmKey, llmProvider, role, seniority, selectedCats, jobDescription]);

  return (
    <div className="space-y-4 unq-animate-fade-in-up">
      <Card>
        <CardContent className="p-4 space-y-3">
          <div>
            <Label className="text-xs">Role</Label>
            <div className="flex flex-wrap gap-2 pt-1">
              {(Object.keys(ROLE_LABELS) as Role[]).map((r) => (
                <Button
                  key={r}
                  variant={role === r ? "default" : "outline"}
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => setRole(r)}
                >{ROLE_LABELS[r]}</Button>
              ))}
            </div>
          </div>
          <div>
            <Label className="text-xs">Categories (leave empty for all)</Label>
            <div className="flex flex-wrap gap-2 pt-1">
              {(Object.keys(CATEGORY_LABELS) as Category[]).map((c) => (
                <Button
                  key={c}
                  variant={selectedCats.includes(c) ? "default" : "outline"}
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => toggleCat(c)}
                >{CATEGORY_LABELS[c]}</Button>
              ))}
            </div>
          </div>
          <div>
            <Label className="text-xs">Seniority (leave empty for all)</Label>
            <div className="flex flex-wrap gap-2 pt-1">
              <Button
                variant={seniority === "" ? "default" : "outline"}
                size="sm"
                className="h-7 text-xs"
                onClick={() => setSeniority("")}
              >Any</Button>
              {(Object.keys(SENIORITY_LABELS) as Seniority[]).map((s) => (
                <Button
                  key={s}
                  variant={seniority === s ? "default" : "outline"}
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => setSeniority(s)}
                >{SENIORITY_LABELS[s]}</Button>
              ))}
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="interview-jd">Job description (optional — for LLM enhancement)</Label>
            <Textarea
              id="interview-jd"
              value={jobDescription}
              onChange={(e) => setJobDescription(e.target.value)}
              placeholder="Paste the JD here if you want LLM-generated questions tailored to it…"
              className="min-h-[80px] resize-y text-xs font-mono"
            />
          </div>
          <div className="flex flex-wrap gap-1">
            <span className="text-[10px] text-muted-foreground mr-1">Role presets:</span>
            {ROLE_PRESETS.map((p) => (
              <Button
                key={p}
                variant="ghost"
                size="sm"
                className="h-6 text-[11px]"
                onClick={() => setJobDescription((prev) => prev ? `${prev}\n\nRole context: ${p}` : `Role context: ${p}`)}
              >+ {p}</Button>
            ))}
          </div>
          <div className="flex flex-wrap gap-2 pt-1">
            <RunButton onClick={handleGenerate} label="Generate questions" />
            <CopyButton
              getText={() => renderText(questions)}
              label="Copy all"
              disabled={questions.length === 0}
            />
            <DownloadButton
              getText={() => renderText(questions)}
              filename="interview-questions.txt"
              mime="text/plain"
              label="Download .txt"
              disabled={questions.length === 0}
            />
            <DownloadButton
              getText={() => renderJson(questions)}
              filename="interview-questions.json"
              mime="application/json"
              label="Download JSON"
              disabled={questions.length === 0}
            />
            <DownloadButton
              getText={() => renderMarkdown(questions)}
              filename="interview-questions.md"
              mime="text/markdown"
              label="Download MD"
              disabled={questions.length === 0}
            />
            <DownloadButton
              getText={() => renderCsv(questions)}
              filename="interview-questions.csv"
              mime="text/csv"
              label="Download CSV"
              disabled={questions.length === 0}
            />
            <ShareButton getUrl={() => buildShareUrl(shareState)} />
            <ClearButton onClick={handleClear} />
          </div>
        </CardContent>
      </Card>

      {error && <ErrorBanner message={error} />}

      {questions.length > 0 ? (
        <>
          <Card>
            <CardContent className="p-4 space-y-2">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <Sparkles className="h-4 w-4" /> {questions.length} questions · avg difficulty {stats.avgDifficulty}
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                <Stat label="Total" value={questions.length} />
                <Stat label="Behavioral" value={stats.byCategory.behavioral} />
                <Stat label="Technical" value={stats.byCategory.technical} />
                <Stat label="Situational" value={stats.byCategory.situational} />
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                <Stat label="Culture fit" value={stats.byCategory["culture-fit"]} />
                <Stat label="Avg difficulty" value={stats.avgDifficulty} />
                <Stat label="Role" value={ROLE_LABELS[stats.role]} />
                <Stat label="Categories in library" value={Object.keys(CATEGORY_LABELS).length} />
              </div>
            </CardContent>
          </Card>

          <div className="space-y-2">
            {questions.map((q, i) => (
              <Card key={q.id}>
                <CardContent className="p-4 space-y-2">
                  <div className="flex items-start gap-2">
                    <span className="text-xs text-muted-foreground mt-0.5">#{i + 1}</span>
                    <div className="flex-1">
                      <div className="flex flex-wrap items-center gap-1 mb-1">
                        <Badge variant="outline" className="text-[10px]">{CATEGORY_LABELS[q.category]}</Badge>
                        <Badge variant="outline" className="text-[10px]">Difficulty {q.difficulty}/5</Badge>
                        <Badge variant="secondary" className="text-[10px]">
                          {q.seniority.map((s) => SENIORITY_LABELS[s]).join(" / ")}
                        </Badge>
                        {q.tags.map((t) => (
                          <Badge key={t} variant="outline" className="text-[10px]">#{t}</Badge>
                        ))}
                      </div>
                      <p className="text-sm font-medium text-foreground">{q.text}</p>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-1.5 pl-6">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs gap-1.5"
                      onClick={() => setExpandedId(expandedId === q.id ? null : q.id)}
                    >
                      {expandedId === q.id ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                      Model answer & rubric
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs gap-1.5"
                      onClick={() => {
                        setPracticeId(practiceId === q.id ? null : q.id);
                        setGraded(null);
                        setPracticeAnswer("");
                      }}
                    >
                      <GraduationCap className="h-3.5 w-3.5" />
                      {practiceId === q.id ? "Close practice" : "Practice"}
                    </Button>
                    <CopyButton getText={() => q.text} label="Copy question" size="sm" />
                  </div>

                  {expandedId === q.id && (
                    <div className="pl-6 space-y-2 text-xs">
                      <div className="rounded border bg-muted/30 p-2">
                        <div className="font-semibold text-foreground mb-1">Model answer</div>
                        <p className="text-foreground/90">{q.modelAnswer}</p>
                      </div>
                      <div className="rounded border bg-muted/30 p-2">
                        <div className="font-semibold text-foreground mb-1">Follow-up probes</div>
                        <ul className="list-disc pl-4 space-y-0.5 text-foreground/90">
                          {q.followUps.map((f, j) => <li key={j}>{f}</li>)}
                        </ul>
                      </div>
                      <div className="rounded border border-amber-500/20 bg-amber-500/5 p-2">
                        <div className="font-semibold text-foreground mb-1 flex items-center gap-1">
                          <AlertCircle className="h-3 w-3" /> Red flags
                        </div>
                        <ul className="list-disc pl-4 space-y-0.5 text-foreground/90">
                          {q.redFlags.map((f, j) => <li key={j}>{f}</li>)}
                        </ul>
                      </div>
                      <div className="rounded border bg-muted/30 p-2">
                        <div className="font-semibold text-foreground mb-1 flex items-center gap-1">
                          <ListChecks className="h-3 w-3" /> Scoring rubric
                        </div>
                        <table className="w-full text-[11px]">
                          <thead>
                            <tr className="text-muted-foreground">
                              <th className="text-left font-normal">Criterion</th>
                              <th className="text-left font-normal">Wt</th>
                              <th className="text-left font-normal">0</th>
                              <th className="text-left font-normal">5</th>
                            </tr>
                          </thead>
                          <tbody>
                            {q.rubric.map((r) => (
                              <tr key={r.criterion}>
                                <td className="font-medium align-top">{r.criterion}</td>
                                <td className="align-top">{r.weight}</td>
                                <td className="align-top text-foreground/80">{r.level0}</td>
                                <td className="align-top text-foreground/80">{r.level5}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {practiceId === q.id && (
                    <div className="pl-6 space-y-2">
                      <Label htmlFor={`practice-${q.id}`} className="text-xs">
                        Type your answer — we'll grade it heuristically against the rubric.
                      </Label>
                      <Textarea
                        id={`practice-${q.id}`}
                        value={practiceAnswer}
                        onChange={(e) => {
                          setPracticeAnswer(e.target.value);
                          setGraded(null);
                        }}
                        placeholder="Use STAR for behavioral questions (Situation, Task, Action, Result). Aim for 50-600 words."
                        className="min-h-[120px] resize-y text-xs"
                      />
                      <div className="flex flex-wrap items-center gap-2">
                        <RunButton
                          onClick={() => handleGrade(q)}
                          label="Grade my answer"
                          disabled={practiceAnswer.trim().length === 0}
                        />
                        {graded && (
                          <>
                            <Badge variant={graded.score >= 70 ? "default" : graded.score >= 40 ? "secondary" : "outline"}>
                              Score: {graded.score}/100
                            </Badge>
                            <span className="text-[11px] text-muted-foreground">
                              {graded.wordCount} words · STAR: {graded.hasStar ? "yes" : "no"} · {graded.keywordHits.length} keyword hits
                            </span>
                          </>
                        )}
                      </div>
                      {graded && (
                        <div className="rounded border bg-muted/30 p-2 text-xs space-y-2">
                          <div>
                            <div className="font-semibold text-foreground mb-1">Feedback</div>
                            <ul className="list-disc pl-4 space-y-0.5">
                              {graded.feedback.map((f, j) => <li key={j}>{f}</li>)}
                            </ul>
                          </div>
                          <div>
                            <div className="font-semibold text-foreground mb-1">Rubric breakdown</div>
                            <div className="space-y-1">
                              {graded.rubricScores.map((r) => (
                                <div key={r.criterion} className="flex items-start gap-2">
                                  <span className="text-muted-foreground w-24">{r.criterion}</span>
                                  <Badge variant="outline" className="text-[10px]">{r.score}/5</Badge>
                                  <span className="text-foreground/80">{r.comment}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                          {graded.keywordHits.length > 0 && (
                            <div>
                              <div className="font-semibold text-foreground mb-1">Keyword hits</div>
                              <div className="flex flex-wrap gap-1">
                                {graded.keywordHits.map((k) => (
                                  <Badge key={k} variant="outline" className="text-[10px] font-mono">{k}</Badge>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      ) : (
        <EmptyState
          title="Generate role-specific interview questions"
          hint="Pick a role, optionally filter by category and seniority, then click Generate. Each question includes a model answer, follow-up probes, red-flag notes, and a 5-criteria scoring rubric."
          icon={<Mic className="h-8 w-8" />}
        />
      )}

      <Card>
        <CardContent className="p-4 space-y-2">
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
            <BookMarked className="h-4 w-4" /> Save current set as a question bank
          </h3>
          <div className="flex flex-wrap gap-2">
            <Input
              value={bankName}
              onChange={(e) => setBankName(e.target.value)}
              placeholder={`Bank name (default: ${ROLE_LABELS[role]} set)`}
              className="h-8 text-xs flex-1 min-w-[200px]"
            />
            <Button variant="outline" size="sm" onClick={handleSaveBank} disabled={questions.length === 0}>
              Save bank
            </Button>
          </div>
          {banks.length > 0 && (
            <div className="space-y-1 pt-1">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Saved banks ({banks.length})</span>
                <Button variant="ghost" size="sm" onClick={handleClearBanks}>Clear all</Button>
              </div>
              {banks.slice(0, 10).map((b) => (
                <div key={b.ts} className="rounded border bg-background px-3 py-2 text-xs">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-foreground">{b.name}</span>
                    <Badge variant="outline" className="text-[10px]">{ROLE_LABELS[b.role]}</Badge>
                    <Badge variant="outline" className="text-[10px]">{b.questionIds.length} q</Badge>
                    {b.seniority && <Badge variant="outline" className="text-[10px]">{SENIORITY_LABELS[b.seniority]}</Badge>}
                    <span className="text-muted-foreground ml-auto">{new Date(b.ts).toLocaleDateString()}</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 text-xs gap-1"
                      onClick={() => handleRemoveBank(b.ts)}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

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
                Paste an OpenAI or Anthropic API key to generate tailored questions (especially useful with a pasted JD). Your key is stored only in localStorage on this device. The only network call goes directly from your browser to the provider you choose.
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
                    setRole(h.role);
                    setSelectedCats(h.categories);
                    setSeniority(h.seniority ?? "");
                    toast.info("Loaded from history — click Generate to re-run");
                  }}
                  className="w-full text-left rounded border bg-background px-3 py-2 text-xs hover:bg-muted/30"
                >
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant="outline" className="text-[10px]">{ROLE_LABELS[h.role]}</Badge>
                    {h.categories.length > 0 ? h.categories.map((c) => (
                      <Badge key={c} variant="outline" className="text-[10px]">{CATEGORY_LABELS[c]}</Badge>
                    )) : <Badge variant="outline" className="text-[10px]">All categories</Badge>}
                    {h.seniority && <Badge variant="outline" className="text-[10px]">{SENIORITY_LABELS[h.seniority]}</Badge>}
                    <Badge variant="secondary" className="text-[10px]">{h.questionCount} q</Badge>
                    <span className="text-muted-foreground ml-auto">{new Date(h.ts).toLocaleString()}</span>
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
            <strong className="text-foreground">Privacy:</strong> All question generation, grading, and bank storage runs locally in your browser. History and saved banks are stored in localStorage on this device only. The only network call is if you paste your own LLM API key — that request goes directly from your browser to the provider you choose.
          </p>
          <p className="text-xs text-muted-foreground mt-2">
            <strong className="text-foreground">Honesty:</strong> AI-generated answers and rubrics are guidance, not hiring decisions. Practice-mode grading is a heuristic — it's a self-check, not a substitute for real interview practice or a real interviewer. Avoid bias and follow local employment law. Small local models are less nuanced than BYO-key mode. Nothing is uploaded or logged by us.
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
