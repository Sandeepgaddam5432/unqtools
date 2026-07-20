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
  FORMAT_LABELS,
  PERSONA_LABELS,
  SCALE_LABELS,
  INVEST_LABELS,
  SAMPLE_FEATURES,
  normalizeFeature,
  parseBulkFeatures,
  detectPersona,
  suggestRoles,
  suggestSplitAxes,
  generateUserStory,
  generateFromFeatures,
  splitEpic,
  computeStats,
  renderMarkdown,
  renderText,
  renderJiraCsv,
  renderAzureCsv,
  renderJson,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  type Persona,
  type StoryFormat,
  type PointScale,
  type UserStory,
  type HistoryEntry,
} from "./logic";
import {
  Users, History, Sparkles, Scissors, Lightbulb,
} from "lucide-react";

export default function AiUserStoryCreator() {
  const [featureText, setFeatureText] = useState("");
  const [persona, setPersona] = useState<Persona>("end-user");
  const [format, setFormat] = useState<StoryFormat>("as-a");
  const [scale, setScale] = useState<PointScale>("fibonacci");
  const [splitMode, setSplitMode] = useState(false);
  const [stories, setStories] = useState<UserStory[]>([]);
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  useEffect(() => {
    setHistory(loadHistory());
    if (typeof window !== "undefined" && window.location.hash) {
      const s = parseShareUrl(window.location.hash);
      if (s.feature) {
        setFeatureText(s.feature);
        setPersona(s.persona);
        setFormat(s.format);
        setScale(s.scale);
        toast.info("Loaded from share link");
      }
    }
  }, []);

  const detectedPersona = useMemo(
    () => (featureText ? detectPersona(featureText) : null),
    [featureText],
  );
  const roleHints = useMemo(
    () => (featureText ? suggestRoles(featureText) : []),
    [featureText],
  );
  const splitAxes = useMemo(
    () => (featureText ? suggestSplitAxes(featureText) : []),
    [featureText],
  );

  const stats = useMemo(() => computeStats(stories), [stories]);

  const handleGenerate = useCallback(() => {
    const features = parseBulkFeatures(featureText);
    if (features.length === 0) {
      toast.error("Enter a feature or epic first");
      return;
    }
    let result: UserStory[] = [];
    if (splitMode && features.length === 1) {
      result = splitEpic(features[0], persona, format, scale);
      if (result.length === 0) result = generateFromFeatures(features, persona, format, scale);
    } else {
      result = generateFromFeatures(features, persona, format, scale);
    }
    setStories(result);
    const totalPoints = result.reduce((sum, s) => {
      const n = typeof s.storyPoints === "number"
        ? s.storyPoints
        : ({ XS: 1, S: 2, M: 3, L: 5, XL: 8 } as Record<string, number>)[s.storyPoints as string] ?? 0;
      return sum + n;
    }, 0);
    saveHistory({
      ts: Date.now(),
      feature: features[0],
      persona,
      storyCount: result.length,
      totalPoints: String(totalPoints),
      format,
    });
    setHistory(loadHistory());
    toast.success(`Generated ${result.length} user ${result.length === 1 ? "story" : "stories"}`);
  }, [featureText, persona, format, scale, splitMode]);

  const handleClear = useCallback(() => {
    setFeatureText("");
    setStories([]);
    setSplitMode(false);
    toast.info("Cleared");
  }, []);

  const handleClearHistory = useCallback(() => {
    clearHistory();
    setHistory([]);
    toast.success("History cleared");
  }, []);

  const markdown = useMemo(() => renderMarkdown(stories), [stories]);
  const text = useMemo(() => renderText(stories), [stories]);
  const jiraCsv = useMemo(() => renderJiraCsv(stories), [stories]);
  const azureCsv = useMemo(() => renderAzureCsv(stories), [stories]);
  const json = useMemo(() => renderJson(stories), [stories]);

  return (
    <div className="space-y-4 unq-animate-fade-in-up">
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="usc-feature">Feature or epic description (one per line, semicolon, or numbered list for bulk)</Label>
            <Textarea
              id="usc-feature"
              value={featureText}
              onChange={(e) => setFeatureText(e.target.value)}
              placeholder={"Sign in with Google OAuth so users do not have to remember another password"}
              className="min-h-[80px] resize-y font-mono text-xs"
            />
            <div className="flex flex-wrap gap-1">
              {SAMPLE_FEATURES.slice(0, 6).map((f) => (
                <Button
                  key={f}
                  variant="ghost"
                  size="sm"
                  className="h-6 text-[11px] max-w-[280px] truncate"
                  onClick={() => setFeatureText(f)}
                  title={f}
                >+ {f.slice(0, 40)}…</Button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
            <Field label="Persona">
              <select
                value={persona}
                onChange={(e) => setPersona(e.target.value as Persona)}
                className="h-9 w-full text-xs rounded border bg-background px-2"
              >
                {(Object.keys(PERSONA_LABELS) as Persona[]).map((p) => (
                  <option key={p} value={p}>{PERSONA_LABELS[p]}</option>
                ))}
              </select>
            </Field>
            <Field label="Story format">
              <select
                value={format}
                onChange={(e) => setFormat(e.target.value as StoryFormat)}
                className="h-9 w-full text-xs rounded border bg-background px-2"
              >
                {(Object.keys(FORMAT_LABELS) as StoryFormat[]).map((f) => (
                  <option key={f} value={f}>{FORMAT_LABELS[f]}</option>
                ))}
              </select>
            </Field>
            <Field label="Point scale">
              <select
                value={scale}
                onChange={(e) => setScale(e.target.value as PointScale)}
                className="h-9 w-full text-xs rounded border bg-background px-2"
              >
                {(Object.keys(SCALE_LABELS) as PointScale[]).map((s) => (
                  <option key={s} value={s}>{SCALE_LABELS[s]}</option>
                ))}
              </select>
            </Field>
            <Field label="Epic splitting">
              <label className="flex items-center gap-2 text-xs h-9 px-2 rounded border bg-background cursor-pointer">
                <input
                  type="checkbox"
                  checked={splitMode}
                  onChange={(e) => setSplitMode(e.target.checked)}
                />
                Split epic into stories
              </label>
            </Field>
          </div>

          {detectedPersona && detectedPersona !== persona && (
            <div className="text-xs text-muted-foreground">
              <Lightbulb className="h-3.5 w-3.5 inline mr-1" />
              Detected persona: <button
                className="underline hover:text-primary"
                onClick={() => setPersona(detectedPersona)}
              >{PERSONA_LABELS[detectedPersona]}</button>
            </div>
          )}
          {roleHints.length > 0 && (
            <div className="text-xs text-muted-foreground">
              <span className="font-medium">Role hints:</span>{" "}
              {roleHints.slice(0, 3).join(" · ")}
            </div>
          )}
          {splitMode && splitAxes.length > 0 && (
            <div className="text-xs text-muted-foreground">
              <Scissors className="h-3.5 w-3.5 inline mr-1" />
              Suggested split axes: {splitAxes.join(", ")}
            </div>
          )}

          <div className="flex flex-wrap gap-2 pt-1">
            <RunButton onClick={handleGenerate} label={splitMode ? "Split epic" : "Generate stories"} />
            <ClearButton onClick={handleClear} disabled={!featureText && stories.length === 0} />
          </div>
        </CardContent>
      </Card>

      {stories.length > 0 ? (
        <>
          <Card>
            <CardContent className="p-4 space-y-2">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <Users className="h-4 w-4" /> {stories.length} {stories.length === 1 ? "story" : "stories"} · {stats.totalAC} AC · {stats.totalTasks} tasks · {stats.totalEdgeCases} edge cases
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                <Stat label="Total points" value={stats.totalPoints ?? "—"} />
                <Stat label="INVEST pass" value={stats.investPassCount} highlight="good" />
                <Stat label="INVEST warn" value={stats.investWarnCount} highlight="bad" />
                <Stat label="INVEST fail" value={stats.investFailCount} highlight="bad" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 space-y-3">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <Sparkles className="h-4 w-4" /> Stories
              </h3>
              <div className="space-y-3 max-h-[600px] overflow-auto">
                {stories.map((s) => (
                  <div key={s.id} className="rounded border bg-background p-3 space-y-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant="secondary" className="text-[10px]">{s.id}</Badge>
                      <Badge variant="outline" className="text-[10px]">{PERSONA_LABELS[s.persona]}</Badge>
                      <Badge variant="outline" className="text-[10px]">{s.storyPoints} pts</Badge>
                      <Badge variant="outline" className="text-[10px]">{s.tasks.length} tasks</Badge>
                      <Badge variant="outline" className="text-[10px]">{s.acceptanceCriteria.length} AC</Badge>
                    </div>
                    <p className="text-sm font-medium text-foreground">{s.statement}</p>
                    {s.acceptanceCriteria.length > 0 && (
                      <div className="space-y-1">
                        <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Acceptance Criteria (Gherkin)</div>
                        {s.acceptanceCriteria.map((ac) => (
                          <div key={ac.id} className="text-xs text-muted-foreground">
                            <span className="font-medium text-foreground">[{ac.scenario}]</span>{" "}
                            Given {ac.given}, when {ac.when}, then {ac.then}.
                          </div>
                        ))}
                      </div>
                    )}
                    {s.tasks.length > 0 && (
                      <div className="space-y-1">
                        <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Tasks</div>
                        {s.tasks.map((t) => (
                          <div key={t.id} className="text-xs text-muted-foreground flex items-center gap-2">
                            <input type="checkbox" className="h-3 w-3" />
                            <span className="flex-1">{t.description}</span>
                            <Badge variant="outline" className="text-[10px]">~{t.hoursEstimate}h</Badge>
                          </div>
                        ))}
                      </div>
                    )}
                    {s.invest.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 pt-1">
                        {s.invest.map((inv) => (
                          <Badge
                            key={inv.dimension}
                            variant="outline"
                            className={
                              "text-[10px] " + (
                                inv.verdict === "pass"
                                  ? "border-emerald-500/40 text-emerald-700 dark:text-emerald-300"
                                  : inv.verdict === "warn"
                                    ? "border-amber-500/40 text-amber-700 dark:text-amber-300"
                                    : "border-red-500/40 text-red-700 dark:text-red-300"
                              )
                            }
                            title={inv.reason}
                          >
                            {inv.verdict === "pass" ? "✓" : inv.verdict === "warn" ? "⚠" : "✗"}{" "}
                            {INVEST_LABELS[inv.dimension]}
                          </Badge>
                        ))}
                      </div>
                    )}
                    {s.notes && (
                      <p className="text-[11px] italic text-muted-foreground">{s.notes}</p>
                    )}
                  </div>
                ))}
              </div>
              <div className="flex flex-wrap gap-2 pt-2">
                <CopyButton getText={() => markdown} label="Copy Markdown" />
                <DownloadButton getText={() => markdown} filename="user-stories.md" mime="text/markdown" label="Download .md" />
                <CopyButton getText={() => text} label="Copy text" successLabel="Copied text!" />
                <DownloadButton getText={() => jiraCsv} filename="user-stories-jira.csv" mime="text/csv" label="Jira CSV" />
                <DownloadButton getText={() => azureCsv} filename="user-stories-azure.csv" mime="text/csv" label="Azure CSV" />
                <DownloadButton getText={() => json} filename="user-stories.json" mime="application/json" label="JSON" />
                <ShareButton getUrl={() => buildShareUrl({ feature: featureText, persona, format, scale })} />
              </div>
            </CardContent>
          </Card>
        </>
      ) : (
        <EmptyState
          title="Enter a feature or epic to generate user stories"
          hint="Use the standard 'As a / I want / so that' format, Job Story, or B-MMN. Each story comes with Gherkin acceptance criteria, INVEST checks, story points, edge cases, and a task breakdown. Bulk mode: one feature per line."
          icon={<Users className="h-8 w-8" />}
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
                <div key={i} className="rounded border bg-background px-3 py-2 text-xs">
                  <Badge variant="outline" className="mr-2 text-[10px]">{h.storyCount} stories</Badge>
                  <Badge variant="outline" className="mr-2 text-[10px]">{h.totalPoints} pts</Badge>
                  <Badge variant="outline" className="mr-2 text-[10px]">{PERSONA_LABELS[h.persona]}</Badge>
                  <span className="text-muted-foreground">{h.feature}</span>
                  <span className="text-muted-foreground ml-2">· {new Date(h.ts).toLocaleString()}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-3">
          <p className="text-xs text-muted-foreground">
            <strong className="text-foreground">Privacy + honesty:</strong> All generation runs locally. Stories are drafts for the team to refine and estimate together — points are suggestions, not commitments. History is stored in localStorage on this device only.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <Label className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</Label>
      {children}
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
