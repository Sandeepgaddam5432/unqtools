/**
 * Lesson Plan Generator — pure logic.
 * Build a structured lesson plan from inputs.
 */

export interface LessonInput {
  subject: string;
  topic: string;
  gradeLevel: string;
  durationMinutes: number;
  objectives: string[];
  materials: string[];
}

export interface LessonSection {
  title: string;
  durationMinutes: number;
  description: string;
}

export interface LessonPlan {
  title: string;
  subject: string;
  topic: string;
  gradeLevel: string;
  totalDuration: number;
  objectives: string[];
  materials: string[];
  sections: LessonSection[];
  assessment: string;
  homework: string;
  standardsAlignment: string;
}

export function defaultLessonInput(): LessonInput {
  return {
    subject: "",
    topic: "",
    gradeLevel: "Middle School (6-8)",
    durationMinutes: 45,
    objectives: [],
    materials: [],
  };
}

/** Allocate minutes across standard lesson phases. */
export function allocateTime(totalMinutes: number): {
  warmup: number;
  directInstruction: number;
  guidedPractice: number;
  independentPractice: number;
  closure: number;
} {
  const t = Math.max(5, totalMinutes);
  const warmup = Math.round(t * 0.1);
  const directInstruction = Math.round(t * 0.25);
  const guidedPractice = Math.round(t * 0.25);
  const independentPractice = Math.round(t * 0.3);
  // Closure absorbs rounding so the five sections sum to exactly t.
  const closure = t - warmup - directInstruction - guidedPractice - independentPractice;
  return { warmup, directInstruction, guidedPractice, independentPractice, closure };
}

/** Generate a complete lesson plan from inputs. */
export function generateLessonPlan(input: LessonInput): LessonPlan {
  const t = allocateTime(input.durationMinutes);
  const objectives = input.objectives.length > 0
    ? input.objectives
    : [
        `Identify key concepts of ${input.topic || "the topic"}.`,
        `Apply ${input.topic || "the topic"} to a new problem.`,
        `Evaluate understanding through guided practice.`,
      ];
  const materials = input.materials.length > 0
    ? input.materials
    : ["Whiteboard / markers", "Handouts", "Projector / slides"];

  return {
    title: `${input.subject || "Lesson"}: ${input.topic || "Untitled"}`,
    subject: input.subject,
    topic: input.topic,
    gradeLevel: input.gradeLevel,
    totalDuration: input.durationMinutes,
    objectives,
    materials,
    sections: [
      { title: "Warm-up / Hook", durationMinutes: t.warmup, description: "Activate prior knowledge with a quick question or short activity to engage students." },
      { title: "Direct Instruction", durationMinutes: t.directInstruction, description: `Introduce ${input.topic || "the topic"} with examples and key vocabulary.` },
      { title: "Guided Practice", durationMinutes: t.guidedPractice, description: "Work through 2-3 example problems together with class participation." },
      { title: "Independent Practice", durationMinutes: t.independentPractice, description: "Students apply the new concept individually or in small groups." },
      { title: "Closure & Review", durationMinutes: t.closure, description: "Summarize key takeaways and check for understanding with an exit ticket." },
    ],
    assessment: `Exit ticket: students summarize ${input.topic || "the topic"} in 1-2 sentences and submit one question they still have.`,
    homework: `Independent practice worksheet on ${input.topic || "the topic"}, due next class.`,
    standardsAlignment: `Aligned with ${input.gradeLevel} curriculum standards for ${input.subject || "the subject"}.`,
  };
}

/** Convert a lesson plan to Markdown. */
export function planToMarkdown(plan: LessonPlan): string {
  const lines: string[] = [];
  lines.push(`# ${plan.title}`);
  lines.push("");
  lines.push(`- **Grade Level:** ${plan.gradeLevel}`);
  lines.push(`- **Total Duration:** ${plan.totalDuration} minutes`);
  lines.push("");
  lines.push("## Learning Objectives");
  for (const o of plan.objectives) lines.push(`- ${o}`);
  lines.push("");
  lines.push("## Materials");
  for (const m of plan.materials) lines.push(`- ${m}`);
  lines.push("");
  lines.push("## Lesson Sequence");
  for (const s of plan.sections) {
    lines.push(`### ${s.title} (${s.durationMinutes} min)`);
    lines.push(s.description);
    lines.push("");
  }
  lines.push("## Assessment");
  lines.push(plan.assessment);
  lines.push("");
  lines.push("## Homework");
  lines.push(plan.homework);
  lines.push("");
  lines.push("## Standards Alignment");
  lines.push(plan.standardsAlignment);
  return lines.join("\n");
}

/** Validate lesson input. */
export function validateInput(input: LessonInput): string | null {
  if (!input.subject.trim()) return "Subject is required.";
  if (!input.topic.trim()) return "Topic is required.";
  if (input.durationMinutes < 5 || input.durationMinutes > 240) return "Duration must be between 5 and 240 minutes.";
  return null;
}
