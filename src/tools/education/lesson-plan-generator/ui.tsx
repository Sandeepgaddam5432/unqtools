"use client";

import React, { useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { CopyButton, DownloadButton, ErrorBanner, EmptyState } from "../../_shared";
import { generateLessonPlan, planToMarkdown, validateInput } from "./logic";

export default function LessonPlanGenerator() {
  const [subject, setSubject] = useState("");
  const [topic, setTopic] = useState("");
  const [gradeLevel, setGradeLevel] = useState("Middle School (6-8)");
  const [duration, setDuration] = useState(45);
  const [objectives, setObjectives] = useState("");
  const [materials, setMaterials] = useState("");

  const input = useMemo(() => ({
    subject,
    topic,
    gradeLevel,
    durationMinutes: duration,
    objectives: objectives.split(/\r?\n/).map((s) => s.trim()).filter(Boolean),
    materials: materials.split(/\r?\n/).map((s) => s.trim()).filter(Boolean),
  }), [subject, topic, gradeLevel, duration, objectives, materials]);

  const error = useMemo(() => validateInput(input), [input]);
  const plan = useMemo(() => (error ? null : generateLessonPlan(input)), [input, error]);
  const markdown = useMemo(() => (plan ? planToMarkdown(plan) : ""), [plan]);

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Subject</Label>
              <Input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="e.g. Biology" className="text-sm" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Topic</Label>
              <Input value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="e.g. Cell Structure" className="text-sm" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Grade level</Label>
              <Input value={gradeLevel} onChange={(e) => setGradeLevel(e.target.value)} className="text-sm" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Duration (minutes)</Label>
              <Input type="number" min={5} max={240} value={duration} onChange={(e) => setDuration(parseInt(e.target.value, 10) || 45)} className="text-sm" />
            </div>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Learning objectives (one per line — optional)</Label>
            <Textarea value={objectives} onChange={(e) => setObjectives(e.target.value)} placeholder={"Students will describe…\nStudents will identify…"} className="text-sm min-h-[80px]" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Materials (one per line — optional)</Label>
            <Textarea value={materials} onChange={(e) => setMaterials(e.target.value)} placeholder={"Whiteboard\nHandouts"} className="text-sm min-h-[60px]" />
          </div>
        </CardContent>
      </Card>

      {error && <ErrorBanner message={error} />}

      {plan && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div>
                <h3 className="text-base font-semibold">{plan.title}</h3>
                <div className="flex flex-wrap gap-2 mt-1">
                  <Badge variant="outline" className="text-xs">{plan.gradeLevel}</Badge>
                  <Badge variant="outline" className="text-xs">{plan.totalDuration} min</Badge>
                </div>
              </div>
              <div className="flex gap-2">
                <CopyButton getText={() => markdown} />
                <DownloadButton getText={() => markdown} filename="lesson-plan.md" />
              </div>
            </div>

            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Objectives</Label>
              <ul className="text-xs space-y-1 list-disc pl-4">
                {plan.objectives.map((o, i) => <li key={i}>{o}</li>)}
              </ul>
            </div>

            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Materials</Label>
              <div className="flex flex-wrap gap-1">
                {plan.materials.map((m, i) => <Badge key={i} variant="outline" className="text-[10px]">{m}</Badge>)}
              </div>
            </div>

            <div className="space-y-1">
              <Label className="text-sm font-semibold">Lesson sequence</Label>
              <div className="space-y-1">
                {plan.sections.map((s, i) => (
                  <div key={i} className="grid grid-cols-[100px_1fr_60px] gap-2 items-start text-xs py-2 border-b border-border/40 last:border-0">
                    <code className="font-mono text-muted-foreground">{s.durationMinutes} min</code>
                    <div>
                      <div className="font-medium text-foreground">{s.title}</div>
                      <div className="text-muted-foreground mt-0.5">{s.description}</div>
                    </div>
                    <CopyButton getText={() => `${s.title} (${s.durationMinutes} min)`} label="" size="icon-sm" />
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Assessment</Label>
              <p className="text-xs">{plan.assessment}</p>
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Homework</Label>
              <p className="text-xs">{plan.homework}</p>
            </div>
          </CardContent>
        </Card>
      )}

      {!plan && !error && (
        <EmptyState title="Enter lesson details" hint="Fill in subject and topic to generate a structured 5-phase lesson plan with timing allocation." />
      )}
    </div>
  );
}
