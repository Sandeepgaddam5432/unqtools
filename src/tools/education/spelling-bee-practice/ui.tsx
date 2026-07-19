"use client";

import React, { useState, useMemo, useCallback, useEffect, useRef } from "react";
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
  DIFFICULTY_LABELS,
  PRACTICE_MODES,
  PRACTICE_MODE_LABELS,
  buildHint,
  buildPronunciation,
  buildFillInBlank,
  buildSession,
  buildShareUrl,
  calculateScore,
  clearHistory,
  computeSummary,
  findHomophones,
  generateMultipleChoice,
  loadHistory,
  markFrequency,
  parseShareUrl,
  parseWordList,
  renderCsv,
  renderText,
  saveHistory,
  transition,
  validateSpelling,
  wpmToTtsRate,
  type AnswerRecord,
  type DifficultyLevel,
  type HistoryEntry,
  type MultipleChoiceOption,
  type PracticeMode,
  type PracticeState,
  type WordItem,
} from "./logic";
import {
  SpellCheck, Play, History, ChevronLeft, ChevronRight,
  SkipForward, CheckCircle2, XCircle, Volume2, Lightbulb, RefreshCw,
} from "lucide-react";

const DIFFICULTIES = Object.keys(DIFFICULTY_LABELS) as DifficultyLevel[];

export default function SpellingBeePractice() {
  // ---- Inputs ----
  const [wordListText, setWordListText] = useState("");
  const [difficulty, setDifficulty] = useState<DifficultyLevel>("elementary");
  const [mode, setMode] = useState<PracticeMode>("type-the-word");
  const [speedWpm, setSpeedWpm] = useState(100);

  // ---- Session state ----
  const [queue, setQueue] = useState<WordItem[]>([]);
  const [index, setIndex] = useState(0);
  const [state, setState] = useState<PracticeState>("idle");
  const [typed, setTyped] = useState("");
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [records, setRecords] = useState<AnswerRecord[]>([]);
  const [startTime, setStartTime] = useState<number>(0);
  const [showHint, setShowHint] = useState(false);

  // ---- History ----
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  const sessionStartRef = useRef<number>(0);

  useEffect(() => {
    setHistory(loadHistory());
    if (typeof window !== "undefined" && window.location.hash) {
      const p = parseShareUrl(window.location.hash);
      if (p.words) setWordListText(p.words);
      if (p.difficulty) setDifficulty(p.difficulty);
      if (p.mode) setMode(p.mode);
      if (p.speedWpm) setSpeedWpm(p.speedWpm);
      if (p.words || p.difficulty !== "elementary" || p.mode !== "type-the-word") {
        toast.info("Loaded from share link");
      }
    }
  }, []);

  const ttsRate = useMemo(() => wpmToTtsRate(speedWpm).rate, [speedWpm]);

  const currentWord = queue[index] ?? null;
  const fillInBlank = useMemo(
    () => currentWord && mode === "fill-in-blank"
      ? buildFillInBlank(currentWord.sentence ?? "", currentWord.word)
      : null,
    [currentWord, mode],
  );
  const mcOptions = useMemo(() => {
    if (!currentWord || mode !== "multiple-choice" || state !== "playing") return null;
    // Build distractor pool from same difficulty's preset words.
    const pool = buildSession([], difficulty, 100).map((w) => w.word);
    return generateMultipleChoice(currentWord.word, pool);
  }, [currentWord, mode, state, difficulty]);

  const stats = useMemo(() => computeSummary(records), [records]);
  const score = useMemo(
    () => calculateScore(records.filter((r) => r.correct).length, records.length),
    [records],
  );

  const textReport = useMemo(
    () => renderText(records, stats, difficulty, mode),
    [records, stats, difficulty, mode],
  );
  const csvReport = useMemo(() => renderCsv(records), [records]);

  // ---- TTS ----
  const playWord = useCallback((word: string) => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) {
      toast.error("Text-to-speech not available in this browser");
      return;
    }
    try {
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(word);
      u.rate = ttsRate;
      u.lang = "en-US";
      window.speechSynthesis.speak(u);
    } catch {
      toast.error("Could not play word");
    }
  }, [ttsRate]);

  // ---- Session lifecycle ----
  const startSession = useCallback(() => {
    const custom = parseWordList(wordListText);
    const session = buildSession(custom, difficulty, 20);
    if (session.length === 0) {
      toast.error("No words to practice");
      return;
    }
    setQueue(session);
    setIndex(0);
    setRecords([]);
    setTyped("");
    setSelectedOption(null);
    setShowHint(false);
    setState("playing");
    setStartTime(Date.now());
    sessionStartRef.current = Date.now();
    toast.success(`Started session with ${session.length} words`);
    // Auto-play first word.
    setTimeout(() => playWord(session[0].word), 250);
  }, [wordListText, difficulty, playWord]);

  const submitAnswer = useCallback(() => {
    if (!currentWord || state !== "playing") return;
    const userAnswer = mode === "multiple-choice" ? (selectedOption ?? "") : typed;
    if (!userAnswer.trim() && mode !== "multiple-choice") {
      toast.error("Please type an answer first");
      return;
    }
    const correct = validateSpelling(currentWord.word, userAnswer, { ignoreDiacritics: true });
    const timeTakenMs = Date.now() - startTime;
    const record: AnswerRecord = {
      word: currentWord.word,
      userAnswer,
      correct,
      timeTakenMs,
    };
    setRecords((prev) => [...prev, record]);
    setState("answered");
    if (correct) {
      toast.success("Correct!");
    } else {
      toast.error(`Incorrect — correct spelling: ${currentWord.word}`);
    }
  }, [currentWord, state, mode, typed, selectedOption, startTime]);

  const goNext = useCallback(() => {
    const nextIndex = index + 1;
    const hasMore = nextIndex < queue.length;
    setState((s) => transition(s, "next", hasMore));
    if (hasMore) {
      setIndex(nextIndex);
      setTyped("");
      setSelectedOption(null);
      setShowHint(false);
      setStartTime(Date.now());
      setTimeout(() => playWord(queue[nextIndex].word), 250);
    } else {
      // Session finished — save history.
      const finalRecords = records;
      const stats2 = computeSummary(finalRecords);
      saveHistory({
        ts: Date.now(),
        difficulty,
        mode,
        totalWords: stats2.totalWords,
        correct: stats2.correct,
        accuracy: stats2.accuracy,
      });
      setHistory(loadHistory());
      toast.success(`Session complete! Score: ${stats2.accuracy}%`);
    }
  }, [index, queue, records, difficulty, mode, playWord]);

  const skipWord = useCallback(() => {
    if (!currentWord || state !== "playing") return;
    // Record as incorrect with blank answer.
    const record: AnswerRecord = {
      word: currentWord.word,
      userAnswer: "(skipped)",
      correct: false,
      timeTakenMs: Date.now() - startTime,
    };
    setRecords((prev) => [...prev, record]);
    goNext();
  }, [currentWord, state, startTime, goNext]);

  const resetSession = useCallback(() => {
    setState((s) => transition(s, "reset", false));
    setQueue([]);
    setIndex(0);
    setRecords([]);
    setTyped("");
    setSelectedOption(null);
    setShowHint(false);
  }, []);

  const handleClear = useCallback(() => {
    setWordListText("");
    setDifficulty("elementary");
    setMode("type-the-word");
    setSpeedWpm(100);
    resetSession();
    toast.info("Cleared");
  }, [resetSession]);

  const handleClearHistory = useCallback(() => {
    clearHistory();
    setHistory([]);
    toast.success("History cleared");
  }, []);

  const handleSaveHistory = useCallback(() => {
    if (records.length > 0) {
      const stats2 = computeSummary(records);
      saveHistory({
        ts: Date.now(),
        difficulty,
        mode,
        totalWords: stats2.totalWords,
        correct: stats2.correct,
        accuracy: stats2.accuracy,
      });
      setHistory(loadHistory());
    }
  }, [records, difficulty, mode]);

  const isRunning = state !== "idle" && state !== "finished";

  return (
    <div className="space-y-4 unq-animate-fade-in-up">
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="sbp-words">Custom word list (optional — one per line)</Label>
            <Textarea
              id="sbp-words"
              value={wordListText}
              onChange={(e) => setWordListText(e.target.value)}
              placeholder={"apple\nbanana\ncherry"}
              className="min-h-[80px] resize-y font-mono text-xs"
              disabled={isRunning}
            />
            <p className="text-[10px] text-muted-foreground">
              Leave empty to use the built-in word list for the selected difficulty.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <div className="space-y-1">
              <Label className="text-xs">Difficulty</Label>
              <select
                value={difficulty}
                onChange={(e) => setDifficulty(e.target.value as DifficultyLevel)}
                disabled={isRunning}
                className="h-8 w-full text-xs rounded border bg-background px-2"
              >
                {DIFFICULTIES.map((d) => (
                  <option key={d} value={d}>{DIFFICULTY_LABELS[d]}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Practice mode</Label>
              <select
                value={mode}
                onChange={(e) => setMode(e.target.value as PracticeMode)}
                disabled={isRunning}
                className="h-8 w-full text-xs rounded border bg-background px-2"
              >
                {PRACTICE_MODES.map((m) => (
                  <option key={m} value={m}>{PRACTICE_MODE_LABELS[m]}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Speed (WPM): {speedWpm}</Label>
              <Input
                type="number"
                min={40}
                max={400}
                value={speedWpm}
                onChange={(e) => setSpeedWpm(Number(e.target.value) || 100)}
                disabled={isRunning}
                className="h-8 text-xs"
              />
            </div>
          </div>
          <div className="flex flex-wrap gap-2 pt-1">
            {!isRunning ? (
              <Button onClick={startSession} size="sm" className="gap-1.5">
                <Play className="h-3.5 w-3.5" /> Start practice
              </Button>
            ) : (
              <>
                <Button onClick={resetSession} variant="outline" size="sm" className="gap-1.5">
                  <RefreshCw className="h-3.5 w-3.5" /> End session
                </Button>
                <ShareButton
                  getUrl={() => buildShareUrl({
                    words: wordListText, difficulty, mode, speedWpm,
                  })}
                />
                <ClearButton onClick={handleClear} />
              </>
            )}
            {state === "finished" && records.length > 0 && (
              <ShareButton
                getUrl={() => buildShareUrl({
                  words: wordListText, difficulty, mode, speedWpm,
                })}
              />
            )}
          </div>
        </CardContent>
      </Card>

      {currentWord && state !== "idle" ? (
        <>
          <Card>
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-[10px]">
                    Word {index + 1} / {queue.length}
                  </Badge>
                  <Badge variant="secondary" className="text-[10px]">
                    {DIFFICULTY_LABELS[difficulty]}
                  </Badge>
                  <Badge variant="outline" className="text-[10px]">
                    {PRACTICE_MODE_LABELS[mode]}
                  </Badge>
                  {markFrequency(currentWord.word) === "rare" && (
                    <Badge variant="outline" className="text-[10px] text-amber-600 dark:text-amber-400">
                      rare word
                    </Badge>
                  )}
                </div>
                <div className="text-xs text-muted-foreground">
                  Score: {records.filter((r) => r.correct).length} / {records.length} ({score}%)
                </div>
              </div>

              <div className="flex flex-col items-center gap-3 py-4">
                <Button
                  variant="default"
                  size="lg"
                  onClick={() => playWord(currentWord.word)}
                  className="gap-2"
                >
                  <Volume2 className="h-5 w-5" /> Play word
                </Button>
                {showHint && state === "playing" && (
                  <div className="text-center space-y-1">
                    <p className="text-xs text-muted-foreground">Hint:</p>
                    <p className="font-mono text-base tracking-widest text-foreground">
                      {buildHint(currentWord.word)}
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                      Pronunciation: <span className="font-mono">{buildPronunciation(currentWord.word)}</span>
                    </p>
                    {findHomophones(currentWord.word).length > 0 && (
                      <p className="text-[10px] text-amber-600 dark:text-amber-400">
                        Homophones: {findHomophones(currentWord.word).join(", ")}
                      </p>
                    )}
                  </div>
                )}
                {state === "answered" && (
                  <div className="text-center space-y-1">
                    <p className="font-mono text-2xl text-foreground">
                      {currentWord.word}
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                      Pronunciation: <span className="font-mono">{buildPronunciation(currentWord.word)}</span>
                    </p>
                    {findHomophones(currentWord.word).length > 0 && (
                      <p className="text-[10px] text-amber-600 dark:text-amber-400">
                        Homophones: {findHomophones(currentWord.word).join(", ")}
                      </p>
                    )}
                  </div>
                )}
              </div>

              {mode === "type-the-word" && (
                <div className="space-y-2">
                  <Input
                    value={typed}
                    onChange={(e) => setTyped(e.target.value)}
                    placeholder="Type the word you hear…"
                    className="text-base font-mono"
                    disabled={state !== "playing"}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && state === "playing") submitAnswer();
                    }}
                    autoFocus
                  />
                  {state === "playing" && (
                    <div className="flex gap-2">
                      <Button onClick={submitAnswer} size="sm" className="gap-1.5">
                        <CheckCircle2 className="h-3.5 w-3.5" /> Submit
                      </Button>
                      <Button onClick={() => setShowHint((v) => !v)} variant="outline" size="sm" className="gap-1.5">
                        <Lightbulb className="h-3.5 w-3.5" /> {showHint ? "Hide hint" : "Hint"}
                      </Button>
                      <Button onClick={skipWord} variant="ghost" size="sm" className="gap-1.5">
                        <SkipForward className="h-3.5 w-3.5" /> Skip
                      </Button>
                    </div>
                  )}
                </div>
              )}

              {mode === "multiple-choice" && mcOptions && (
                <div className="space-y-2">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {mcOptions.map((opt, i) => (
                      <MultipleChoiceButton
                        key={i}
                        opt={opt}
                        selected={selectedOption === opt.text}
                        answered={state === "answered"}
                        onClick={() => state === "playing" && setSelectedOption(opt.text)}
                      />
                    ))}
                  </div>
                  {state === "playing" && (
                    <div className="flex gap-2">
                      <Button
                        onClick={submitAnswer}
                        size="sm"
                        className="gap-1.5"
                        disabled={!selectedOption}
                      >
                        <CheckCircle2 className="h-3.5 w-3.5" /> Submit
                      </Button>
                      <Button onClick={() => setShowHint((v) => !v)} variant="outline" size="sm" className="gap-1.5">
                        <Lightbulb className="h-3.5 w-3.5" /> {showHint ? "Hide hint" : "Hint"}
                      </Button>
                      <Button onClick={skipWord} variant="ghost" size="sm" className="gap-1.5">
                        <SkipForward className="h-3.5 w-3.5" /> Skip
                      </Button>
                    </div>
                  )}
                </div>
              )}

              {mode === "fill-in-blank" && fillInBlank && (
                <div className="space-y-2">
                  <p className="text-sm text-foreground bg-muted/40 rounded p-3">
                    {fillInBlank.sentence}
                  </p>
                  <Input
                    value={typed}
                    onChange={(e) => setTyped(e.target.value)}
                    placeholder="Type the missing word…"
                    className="text-base font-mono"
                    disabled={state !== "playing"}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && state === "playing") submitAnswer();
                    }}
                    autoFocus
                  />
                  {state === "playing" && (
                    <div className="flex gap-2">
                      <Button onClick={submitAnswer} size="sm" className="gap-1.5">
                        <CheckCircle2 className="h-3.5 w-3.5" /> Submit
                      </Button>
                      <Button onClick={() => setShowHint((v) => !v)} variant="outline" size="sm" className="gap-1.5">
                        <Lightbulb className="h-3.5 w-3.5" /> {showHint ? "Hide hint" : "Hint"}
                      </Button>
                      <Button onClick={skipWord} variant="ghost" size="sm" className="gap-1.5">
                        <SkipForward className="h-3.5 w-3.5" /> Skip
                      </Button>
                    </div>
                  )}
                </div>
              )}

              {state === "answered" && (
                <div className="space-y-2">
                  {records[records.length - 1]?.correct ? (
                    <div className="flex items-center gap-2 rounded border border-emerald-500/30 bg-emerald-500/10 p-2 text-sm text-emerald-700 dark:text-emerald-300">
                      <CheckCircle2 className="h-4 w-4" /> Correct!
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 rounded border border-destructive/30 bg-destructive/10 p-2 text-sm text-destructive">
                      <XCircle className="h-4 w-4" />
                      Incorrect — you typed "{records[records.length - 1]?.userAnswer || "(blank)"}"
                    </div>
                  )}
                  <div className="flex gap-2">
                    <Button onClick={goNext} size="sm" className="gap-1.5">
                      <ChevronRight className="h-3.5 w-3.5" />
                      {index + 1 < queue.length ? "Next word" : "Finish"}
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      ) : state === "finished" ? (
        <Card>
          <CardContent className="p-4 space-y-3">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
              <SpellCheck className="h-4 w-4" /> Session complete
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
              <Stat label="Total words" value={stats.totalWords} />
              <Stat label="Correct" value={stats.correct} highlight="good" />
              <Stat label="Accuracy" value={`${stats.accuracy}%`} highlight={stats.accuracy >= 80 ? "good" : "bad"} />
              <Stat label="Avg time/word" value={`${stats.avgTimePerWordMs} ms`} />
            </div>
            {stats.hardestWord && (
              <p className="text-xs text-muted-foreground">
                Hardest word: <span className="font-mono text-foreground">{stats.hardestWord}</span>
              </p>
            )}
            <div className="flex flex-wrap gap-2 pt-2">
              <Button onClick={startSession} size="sm" className="gap-1.5">
                <Play className="h-3.5 w-3.5" /> Practice again
              </Button>
              <CopyButton getText={() => { handleSaveHistory(); return textReport; }} label="Copy report" />
              <DownloadButton getText={() => textReport} filename="spelling-session.txt" mime="text/plain" label="Download .txt" />
              <DownloadButton getText={() => csvReport} filename="spelling-session.csv" mime="text/csv" label="Download CSV" />
              <ShareButton getUrl={() => buildShareUrl({ words: wordListText, difficulty, mode, speedWpm })} />
            </div>
          </CardContent>
        </Card>
      ) : (
        <EmptyState
          title="Configure your spelling practice"
          hint="Pick a difficulty level and practice mode, then click Start practice. The tool will pronounce each word via your browser's text-to-speech and you type what you hear."
          icon={<SpellCheck className="h-8 w-8" />}
        />
      )}

      {records.length > 0 && state !== "finished" && (
        <Card>
          <CardContent className="p-4 space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <History className="h-4 w-4" /> Words so far ({records.length})
              </h3>
              <div className="flex gap-2">
                <CopyButton getText={() => textReport} label="Copy report" />
                <DownloadButton getText={() => csvReport} filename="spelling-session.csv" mime="text/csv" label="Download CSV" />
              </div>
            </div>
            <div className="space-y-1 max-h-[300px] overflow-auto">
              {records.map((r, i) => (
                <div
                  key={i}
                  className={`flex items-center gap-2 rounded border bg-background px-3 py-1.5 text-xs ${
                    r.correct ? "border-emerald-500/30" : "border-destructive/30"
                  }`}
                >
                  {r.correct
                    ? <CheckCircle2 className="h-3 w-3 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
                    : <XCircle className="h-3 w-3 text-destructive flex-shrink-0" />}
                  <span className="font-mono text-foreground">{r.word}</span>
                  {!r.correct && (
                    <span className="text-muted-foreground">
                      (you: "{r.userAnswer || "(blank)"}")
                    </span>
                  )}
                  <span className="ml-auto text-[10px] text-muted-foreground">{r.timeTakenMs}ms</span>
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
                <History className="h-4 w-4" /> Recent sessions ({history.length})
              </h3>
              <Button variant="ghost" size="sm" onClick={handleClearHistory}>Clear</Button>
            </div>
            <div className="space-y-1">
              {history.slice(0, 5).map((h, i) => (
                <div key={i} className="rounded border bg-background px-3 py-2 text-xs">
                  <Badge variant="outline" className="mr-2 text-[10px]">{DIFFICULTY_LABELS[h.difficulty]}</Badge>
                  <Badge variant="outline" className="mr-2 text-[10px]">{PRACTICE_MODE_LABELS[h.mode]}</Badge>
                  <Badge variant="secondary" className="mr-2 text-[10px]">{h.accuracy}%</Badge>
                  <span className="text-muted-foreground">
                    {h.correct} / {h.totalWords} · {new Date(h.ts).toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-3">
          <p className="text-xs text-muted-foreground">
            <strong className="text-foreground">Privacy:</strong> All word lists, scoring, validation, and TTS calls run locally. The Web Speech API uses your device's built-in voices. History is stored in localStorage on this device only.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function MultipleChoiceButton({
  opt,
  selected,
  answered,
  onClick,
}: {
  opt: MultipleChoiceOption;
  selected: boolean;
  answered: boolean;
  onClick: () => void;
}) {
  let cls = "border bg-background hover:bg-muted/40 ";
  if (selected && !answered) cls = "border-primary bg-primary/10 ";
  if (answered) {
    if (opt.isCorrect) cls = "border-emerald-500/50 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 ";
    else if (selected) cls = "border-destructive/50 bg-destructive/10 text-destructive ";
    else cls = "border bg-background opacity-60 ";
  }
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={answered}
      className={`text-left rounded px-3 py-2 text-sm font-mono transition ${cls}`}
    >
      {opt.text}
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

// Silence unused-import warnings for icons not yet wired.
export type _Unused = typeof ChevronLeft;
