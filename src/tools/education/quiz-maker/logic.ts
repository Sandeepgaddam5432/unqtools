/**
 * Quiz Maker — pure logic.
 * Multiple choice quiz model, scoring, and validation.
 */

export interface QuizQuestion {
  id: string;
  prompt: string;
  choices: string[];
  correctIndex: number;
  points: number;
}

export interface Quiz {
  id: string;
  title: string;
  questions: QuizQuestion[];
}

export interface QuizAttempt {
  questionId: string;
  selectedIndex: number | null;
  isCorrect: boolean;
  pointsEarned: number;
}

export interface QuizResult {
  totalQuestions: number;
  answered: number;
  correct: number;
  totalPoints: number;
  earnedPoints: number;
  scorePct: number;
  grade: string;
  attempts: QuizAttempt[];
}

export function newQuestion(prompt: string, choices: string[], correctIndex: number, points = 1): QuizQuestion {
  return { id: `q-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, prompt, choices, correctIndex, points };
}

export function gradeQuiz(quiz: Quiz, answers: Record<string, number | null>): QuizResult {
  let answered = 0;
  let correct = 0;
  let totalPoints = 0;
  let earnedPoints = 0;
  const attempts: QuizAttempt[] = [];

  for (const q of quiz.questions) {
    totalPoints += q.points;
    const sel = answers[q.id];
    if (sel === null || sel === undefined) {
      attempts.push({ questionId: q.id, selectedIndex: null, isCorrect: false, pointsEarned: 0 });
      continue;
    }
    answered += 1;
    const isCorrect = sel === q.correctIndex;
    if (isCorrect) {
      correct += 1;
      earnedPoints += q.points;
    }
    attempts.push({ questionId: q.id, selectedIndex: sel, isCorrect, pointsEarned: isCorrect ? q.points : 0 });
  }

  const scorePct = totalPoints > 0 ? Math.round((earnedPoints / totalPoints) * 100) : 0;
  const grade = scorePct >= 90 ? "A" : scorePct >= 80 ? "B" : scorePct >= 70 ? "C" : scorePct >= 60 ? "D" : "F";

  return {
    totalQuestions: quiz.questions.length,
    answered,
    correct,
    totalPoints,
    earnedPoints,
    scorePct,
    grade,
    attempts,
  };
}

export function validateQuiz(quiz: Quiz): string[] {
  const errors: string[] = [];
  if (!quiz.title.trim()) errors.push("Quiz title is required");
  if (quiz.questions.length === 0) errors.push("Quiz must have at least one question");
  for (let i = 0; i < quiz.questions.length; i++) {
    const q = quiz.questions[i];
    if (!q.prompt.trim()) errors.push(`Question ${i + 1}: prompt is empty`);
    if (q.choices.length < 2) errors.push(`Question ${i + 1}: needs at least 2 choices`);
    if (q.correctIndex < 0 || q.correctIndex >= q.choices.length) errors.push(`Question ${i + 1}: correctIndex out of range`);
    if (q.points <= 0) errors.push(`Question ${i + 1}: points must be positive`);
  }
  return errors;
}

export function shuffle<T>(arr: T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j]!, copy[i]!];
  }
  return copy;
}

export function toCsv(quiz: Quiz): string {
  const lines = ["id,prompt,choices,correctIndex,points"];
  for (const q of quiz.questions) {
    lines.push([q.id, `"${q.prompt.replace(/"/g, '""')}"`, `"${q.choices.join("|")}"`, q.correctIndex, q.points].join(","));
  }
  return lines.join("\n");
}
