"use client";

import React, { useState, useCallback, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ErrorBanner, CopyButton, DownloadButton } from "../../_shared";
import {
  generateQuiz,
  scoreQuiz,
  worksheetToText,
  answerKey,
  resultToText,
  type QuizMode,
  type QuizQuestion,
  type QuizResult,
} from "./logic";

const MODES: { id: QuizMode; label: string }[] = [
  { id: "symbol-to-name", label: "Symbol → Name" },
  { id: "name-to-symbol", label: "Name → Symbol" },
  { id: "number-to-symbol", label: "Number → Symbol" },
];

export default function PeriodicTableQuiz() {
  const [mode, setMode] = useState<QuizMode>("symbol-to-name");
  const [count, setCount] = useState("10");
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [answers, setAnswers] = useState<Map<string, string>>(new Map());
  const [result, setResult] = useState<QuizResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const start = useCallback(() => {
    const n = Number(count) || 10;
    if (n < 1) { setError("Count must be at least 1."); return; }
    setQuestions(generateQuiz(n, mode));
    setAnswers(new Map());
    setResult(null);
    setError(null);
  }, [count, mode]);

  const choose = useCallback((qid: string, option: string) => {
    setAnswers((prev) => {
      const next = new Map(prev);
      next.set(qid, option);
      return next;
    });
  }, []);

  const submit = useCallback(() => {
    if (questions.length === 0) { setError("No questions to score."); return; }
    setResult(scoreQuiz(questions, answers));
  }, [questions, answers]);

  const clear = useCallback(() => {
    setQuestions([]); setAnswers(new Map()); setResult(null); setError(null);
  }, []);

  const answeredCount = answers.size;

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4 space-y-4">
          <div className="flex flex-wrap gap-2">
            <Label className="text-xs text-muted-foreground self-center mr-2">Mode:</Label>
            {MODES.map((m) => (
              <Button key={m.id} size="sm" variant={mode === m.id ? "default" : "outline"} onClick={() => setMode(m.id)} disabled={questions.length > 0}>{m.label}</Button>
            ))}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-muted-foreground">Number of questions</Label>
              <Input type="number" min={1} max={42} value={count} onChange={(e) => setCount(e.target.value)} aria-label="Number of questions" disabled={questions.length > 0} />
            </div>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Button size="sm" onClick={start} disabled={false}>Start quiz</Button>
            <Button size="sm" variant="ghost" onClick={() => { setCount("10"); setMode("symbol-to-name"); }}>Reset</Button>
            <Button size="sm" variant="ghost" onClick={clear}>Clear</Button>
          </div>
        </CardContent>
      </Card>

      {error && <ErrorBanner message={error} />}

      {questions.length > 0 && (
        <Card>
          <CardContent className="p-4 flex items-center justify-between flex-wrap gap-2">
            <p className="text-sm text-muted-foreground">
              Progress: {answeredCount} / {questions.length} answered
            </p>
            <Button size="sm" onClick={submit} disabled={answeredCount === 0}>Submit answers</Button>
          </CardContent>
        </Card>
      )}

      {questions.map((q, i) => {
        const sel = answers.get(q.id);
        const showCorrect = result !== null;
        return (
          <Card key={q.id}>
            <CardContent className="p-4 space-y-2">
              <p className="text-sm font-semibold">{i + 1}. {q.prompt}</p>
              <div className="grid grid-cols-2 gap-2">
                {q.options.map((o) => {
                  const isSel = sel === o;
                  const isAnswer = o === q.answer;
                  let cls = "outline";
                  if (showCorrect) {
                    if (isAnswer) cls = "default";
                    else if (isSel) cls = "destructive";
                  } else if (isSel) {
                    cls = "default";
                  }
                  return (
                    <Button
                      key={o}
                      size="sm"
                      variant={cls as "default" | "outline" | "destructive"}
                      onClick={() => choose(q.id, o)}
                      disabled={showCorrect}
                      className="justify-start"
                    >
                      {o}
                    </Button>
                  );
                })}
              </div>
              {showCorrect && (
                <p className="text-xs text-muted-foreground">
                  {sel === q.answer ? "✓ Correct" : `✗ Correct answer: ${q.answer}`}
                </p>
              )}
            </CardContent>
          </Card>
        );
      })}

      {result && (
        <>
          <Card>
            <CardContent className="p-4 grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
              <div><p className="text-xs text-muted-foreground">Score</p><p className="text-2xl font-bold text-primary">{result.correct} / {result.total}</p></div>
              <div><p className="text-xs text-muted-foreground">Percent</p><p className="text-2xl font-bold">{result.percent}%</p></div>
              <div><p className="text-xs text-muted-foreground">Grade</p><p className="text-2xl font-bold">{result.grade}</p></div>
              <div><p className="text-xs text-muted-foreground">Incorrect</p><p className="text-2xl font-bold text-red-500">{result.incorrect}</p></div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center justify-between flex-wrap gap-2">
              <p className="text-xs text-muted-foreground">Export worksheet &amp; answer key</p>
              <div className="flex gap-2">
                <CopyButton getText={() => worksheetToText(questions)} label="Copy worksheet" />
                <CopyButton getText={() => answerKey(questions)} label="Copy answers" />
                <CopyButton getText={() => resultToText(result)} label="Copy result" />
                <DownloadButton getText={() => worksheetToText(questions) + "\n\n" + answerKey(questions)} filename="periodic-quiz.txt" />
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
