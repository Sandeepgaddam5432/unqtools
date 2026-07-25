"use client";

import React, { useState, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ErrorBanner, CopyButton, DownloadButton } from "../../_shared";
import { newQuestion, gradeQuiz, validateQuiz, toCsv, type Quiz, type QuizQuestion } from "./logic";

export default function QuizMaker() {
  const [title, setTitle] = useState("My Quiz");
  const [questions, setQuestions] = useState<QuizQuestion[]>([
    newQuestion("2 + 2?", ["3", "4", "5"], 1, 1),
  ]);
  const [answers, setAnswers] = useState<Record<string, number | null>>({});
  const [prompt, setPrompt] = useState("");
  const [choices, setChoices] = useState("");
  const [correctIdx, setCorrectIdx] = useState(0);
  const [points, setPoints] = useState(1);

  const quiz: Quiz = useMemo(() => ({ id: "quiz", title, questions }), [title, questions]);
  const errors = useMemo(() => validateQuiz(quiz), [quiz]);
  const result = useMemo(() => (questions.length > 0 ? gradeQuiz(quiz, answers) : null), [quiz, answers, questions]);
  const csv = useMemo(() => toCsv(quiz), [quiz]);

  const addQuestion = () => {
    const choiceList = choices.split("\n").map((c) => c.trim()).filter(Boolean);
    if (!prompt.trim() || choiceList.length < 2) return;
    setQuestions((p) => [...p, newQuestion(prompt.trim(), choiceList, Math.max(0, Math.min(choiceList.length - 1, correctIdx)), Math.max(1, points))]);
    setPrompt(""); setChoices(""); setCorrectIdx(0); setPoints(1);
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4 space-y-3">
          <div><Label className="text-xs text-muted-foreground">Quiz title</Label><Input value={title} onChange={(e) => setTitle(e.target.value)} className="mt-1 h-8 text-xs" /></div>
          {errors.length > 0 && <ErrorBanner message={errors.join("; ")} />}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4 space-y-3">
          <p className="text-sm font-semibold">Add question</p>
          <Input placeholder="Question prompt" value={prompt} onChange={(e) => setPrompt(e.target.value)} className="h-8 text-xs" />
          <textarea placeholder={"Choice 1\nChoice 2\nChoice 3"} value={choices} onChange={(e) => setChoices(e.target.value)} className="min-h-[80px] w-full rounded border bg-background px-2 py-1 text-xs" />
          <div className="grid grid-cols-2 gap-2">
            <div><Label className="text-[10px] uppercase text-muted-foreground">Correct (0-based)</Label><Input type="number" value={correctIdx} onChange={(e) => setCorrectIdx(Number(e.target.value))} className="mt-1 h-8 text-xs" /></div>
            <div><Label className="text-[10px] uppercase text-muted-foreground">Points</Label><Input type="number" value={points} onChange={(e) => setPoints(Number(e.target.value))} className="mt-1 h-8 text-xs" /></div>
          </div>
          <Button size="sm" onClick={addQuestion} disabled={!prompt.trim()}>Add question</Button>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold">Quiz ({questions.length} questions)</p>
            <div className="flex gap-2">
              <CopyButton getText={() => csv} label="Copy CSV" />
              <DownloadButton getText={() => csv} filename="quiz.csv" mime="text/csv" label="Download" />
            </div>
          </div>
          {questions.map((q, i) => (
            <div key={q.id} className="rounded border bg-background p-2 text-xs space-y-2">
              <div className="flex items-center gap-2">
                <span className="font-semibold">Q{i + 1}</span>
                <span>{q.prompt}</span>
                <Badge variant="outline" className="ml-auto text-[10px]">{q.points} pt</Badge>
                <Button size="icon-sm" variant="ghost" onClick={() => setQuestions((p) => p.filter((_, idx) => idx !== i))}>×</Button>
              </div>
              <div className="space-y-1">
                {q.choices.map((c, idx) => (
                  <label key={idx} className={`flex items-center gap-2 ${idx === q.correctIndex ? "text-emerald-600" : ""}`}>
                    <input type="radio" name={q.id} checked={answers[q.id] === idx} onChange={() => setAnswers((a) => ({ ...a, [q.id]: idx }))} />
                    <span>{c}{idx === q.correctIndex && " ✓"}</span>
                  </label>
                ))}
              </div>
            </div>
          ))}
          {questions.length === 0 && <p className="text-xs text-muted-foreground">No questions yet.</p>}
        </CardContent>
      </Card>

      {result && (
        <Card>
          <CardContent className="p-4 space-y-2">
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-emerald-600">Grade: {result.grade}</Badge>
              <span className="text-xs text-muted-foreground">{result.correct}/{result.totalQuestions} correct · {result.earnedPoints}/{result.totalPoints} pts · {result.scorePct}%</span>
            </div>
            <div className="h-2 w-full rounded bg-muted overflow-hidden"><div className="h-full bg-emerald-500" style={{ width: `${result.scorePct}%` }} /></div>
          </CardContent>
        </Card>
      )}

      <Card><CardContent className="p-3"><p className="text-xs text-muted-foreground"><strong className="text-foreground">Privacy:</strong> all quiz creation and grading runs locally.</p></CardContent></Card>
    </div>
  );
}
