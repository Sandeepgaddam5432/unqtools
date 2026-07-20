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
  ErrorBanner,
} from "../../_shared";
import { toast } from "sonner";
import {
  summarizeTranscript,
  renderMarkdown,
  renderRecapEmail,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  type SummaryLength,
  type MeetingMinutes,
  type HistoryEntry,
} from "./logic";
import {
  ClipboardList, FileText, Mail, History, AlertTriangle,
  Users, CheckSquare, HelpCircle, AlertCircle,
} from "lucide-react";

const SAMPLE_TRANSCRIPT = `Alice: Welcome to the standup. We decided to ship the API next week.
Bob: Great. I will write the docs by Friday.
Carol: Risk is the auth flow is not ready.
Alice: What about the load test? @bob needs to run it.
Bob: Agreed to delay the launch by two days.
Alice: TODO: open a ticket for the regression.`;

export default function AiMeetingMinutesSummarizer() {
  const [transcript, setTranscript] = useState("");
  const [title, setTitle] = useState("");
  const [length, setLength] = useState<SummaryLength>("standard");
  const [minutes, setMinutes] = useState<MeetingMinutes | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [view, setView] = useState<"markdown" | "email">("markdown");

  useEffect(() => {
    setHistory(loadHistory());
    if (typeof window !== "undefined" && window.location.hash) {
      const p = parseShareUrl(window.location.hash);
      if (p.transcript) {
        setTranscript(p.transcript);
        setTitle(p.title);
        setLength(p.length);
        toast.info("Loaded from share link");
      }
    }
  }, []);

  const markdown = useMemo(
    () => (minutes ? renderMarkdown(minutes) : ""),
    [minutes],
  );
  const email = useMemo(
    () => (minutes ? renderRecapEmail(minutes, title || "Meeting attendee") : ""),
    [minutes, title],
  );

  const handleRun = useCallback(() => {
    if (!transcript.trim()) {
      toast.error("Paste a transcript first");
      return;
    }
    const m = summarizeTranscript(transcript, { title: title || "Meeting Minutes", length });
    setMinutes(m);
    saveHistory({
      ts: Date.now(),
      title: title || "Meeting Minutes",
      attendeeCount: m.attendees.length,
      actionCount: m.actionItems.length,
      decisionCount: m.decisions.length,
      wordCount: m.stats.wordCount,
    });
    setHistory(loadHistory());
    toast.success(`Generated minutes — ${m.decisions.length} decisions, ${m.actionItems.length} actions`);
  }, [transcript, title, length]);

  const handleClear = useCallback(() => {
    setTranscript("");
    setTitle("");
    setLength("standard");
    setMinutes(null);
    toast.info("Cleared");
  }, []);

  const handleClearHistory = useCallback(() => {
    clearHistory();
    setHistory([]);
    toast.success("History cleared");
  }, []);

  return (
    <div className="space-y-4 unq-animate-fade-in-up">
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="mms-title">Meeting title (optional)</Label>
            <Input
              id="mms-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Standup 2024-01-15"
              className="h-9"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="mms-transcript">Meeting transcript (plain text, VTT, or SRT)</Label>
            <Textarea
              id="mms-transcript"
              value={transcript}
              onChange={(e) => setTranscript(e.target.value)}
              placeholder={"Alice: Welcome to the standup. We decided to ship the API.\nBob: I will write the docs by Friday."}
              className="min-h-[180px] resize-y font-mono text-xs"
            />
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs"
                onClick={() => setTranscript(SAMPLE_TRANSCRIPT)}
              >Load sample</Button>
              <Label className="text-xs ml-2">Summary length:</Label>
              {(["brief", "standard", "detailed"] as SummaryLength[]).map((l) => (
                <Button
                  key={l}
                  variant={length === l ? "default" : "outline"}
                  size="sm"
                  className="h-7 text-xs capitalize"
                  onClick={() => setLength(l)}
                >{l}</Button>
              ))}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" onClick={handleRun} className="gap-1.5">
              <ClipboardList className="h-3.5 w-3.5" /> Generate minutes
            </Button>
            <ClearButton onClick={handleClear} />
            <ShareButton
              getUrl={() =>
                buildShareUrl(transcript, { title, length })
              }
            />
          </div>
        </CardContent>
      </Card>

      {minutes?.warnings.length ? (
        <ErrorBanner message={minutes.warnings.join(" ")} />
      ) : null}

      {minutes ? (
        <>
          <Card>
            <CardContent className="p-4 space-y-2">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                <Stat label="Format" value={minutes.format} />
                <Stat label="Turns" value={minutes.stats.turnCount} />
                <Stat label="Words" value={minutes.stats.wordCount} />
                <Stat label="Sentences" value={minutes.stats.sentenceCount} />
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs pt-1">
                <Stat label="Attendees" value={minutes.attendees.length} highlight="good" />
                <Stat label="Decisions" value={minutes.decisions.length} highlight="good" />
                <Stat label="Action items" value={minutes.actionItems.length} highlight="good" />
                <Stat label="Open questions" value={minutes.openQuestions.length} />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 space-y-3">
              {minutes.attendees.length > 0 && (
                <Section icon={<Users className="h-4 w-4" />} title="Attendees">
                  <div className="flex flex-wrap gap-1.5">
                    {minutes.attendees.map((a) => (
                      <Badge key={a} variant="secondary" className="text-[11px]">{a}</Badge>
                    ))}
                  </div>
                </Section>
              )}
              {minutes.tldr && (
                <Section icon={<FileText className="h-4 w-4" />} title="TL;DR">
                  <p className="text-xs text-foreground">{minutes.tldr}</p>
                </Section>
              )}
              {minutes.summary && (
                <Section icon={<FileText className="h-4 w-4" />} title="Discussion summary">
                  <p className="text-xs text-foreground leading-relaxed">{minutes.summary}</p>
                </Section>
              )}
              {minutes.decisions.length > 0 && (
                <Section icon={<CheckSquare className="h-4 w-4" />} title={`Decisions (${minutes.decisions.length})`}>
                  <ul className="space-y-1">
                    {minutes.decisions.map((d) => (
                      <li key={d.id} className="text-xs text-foreground flex gap-2">
                        <Badge variant="outline" className="text-[10px] h-5">{d.cue}</Badge>
                        <span>{d.text}</span>
                      </li>
                    ))}
                  </ul>
                </Section>
              )}
              {minutes.actionItems.length > 0 && (
                <Section icon={<CheckSquare className="h-4 w-4" />} title={`Action items (${minutes.actionItems.length})`}>
                  <ul className="space-y-1">
                    {minutes.actionItems.map((a) => (
                      <li key={a.id} className="text-xs text-foreground flex flex-wrap items-center gap-2">
                        <input type="checkbox" className="h-3 w-3" />
                        <span className="flex-1">{a.task}</span>
                        {a.owner && <Badge variant="secondary" className="text-[10px]">@{a.owner}</Badge>}
                        {a.due && <Badge variant="outline" className="text-[10px]">due {a.due}</Badge>}
                        <Badge variant="outline" className="text-[10px]">{a.rawCue}</Badge>
                      </li>
                    ))}
                  </ul>
                </Section>
              )}
              {minutes.openQuestions.length > 0 && (
                <Section icon={<HelpCircle className="h-4 w-4" />} title={`Open questions (${minutes.openQuestions.length})`}>
                  <ul className="space-y-1">
                    {minutes.openQuestions.map((q) => (
                      <li key={q.id} className="text-xs text-foreground flex gap-2">
                        <span className="text-muted-foreground">{q.speaker}:</span>
                        <span>{q.text}</span>
                      </li>
                    ))}
                  </ul>
                </Section>
              )}
              {minutes.risks.length > 0 && (
                <Section icon={<AlertCircle className="h-4 w-4" />} title={`Risks / blockers (${minutes.risks.length})`}>
                  <ul className="space-y-1">
                    {minutes.risks.map((r) => (
                      <li key={r.id} className="text-xs text-foreground flex gap-2">
                        <Badge variant="outline" className="text-[10px] h-5">{r.cue}</Badge>
                        <span>{r.text}</span>
                      </li>
                    ))}
                  </ul>
                </Section>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex gap-1">
                  <Button
                    variant={view === "markdown" ? "default" : "outline"}
                    size="sm"
                    className="h-7 text-xs gap-1.5"
                    onClick={() => setView("markdown")}
                  ><FileText className="h-3.5 w-3.5" /> Markdown</Button>
                  <Button
                    variant={view === "email" ? "default" : "outline"}
                    size="sm"
                    className="h-7 text-xs gap-1.5"
                    onClick={() => setView("email")}
                  ><Mail className="h-3.5 w-3.5" /> Recap email</Button>
                </div>
                <div className="flex flex-wrap gap-2">
                  <CopyButton getText={() => view === "markdown" ? markdown : email} />
                  <DownloadButton
                    getText={() => view === "markdown" ? markdown : email}
                    filename={view === "markdown" ? "meeting-minutes.md" : "meeting-recap.txt"}
                    mime="text/plain"
                    label="Download"
                  />
                </div>
              </div>
              <Textarea
                value={view === "markdown" ? markdown : email}
                readOnly
                className="min-h-[320px] resize-y font-mono text-xs"
              />
            </CardContent>
          </Card>
        </>
      ) : (
        <EmptyState
          title="Paste a meeting transcript to generate minutes"
          hint="Supports plain text with speaker labels (Alice: ...), WebVTT (.vtt), and SubRip (.srt). TL;DR, decisions, action items with owners/due dates, and open questions are extracted on-device."
          icon={<ClipboardList className="h-8 w-8" />}
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
                  <Badge variant="outline" className="mr-2">{h.attendeeCount} attendees</Badge>
                  <Badge variant="outline" className="mr-2">{h.actionCount} actions</Badge>
                  <Badge variant="outline" className="mr-2">{h.decisionCount} decisions</Badge>
                  <span className="text-muted-foreground">{h.title}</span>
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
            <strong className="text-foreground flex items-center gap-1">
              <AlertTriangle className="h-3 w-3" /> Privacy + honesty:
            </strong>{" "}
            All summarization runs locally. History is stored in localStorage on this device only. The extractor is deterministic and may miss subtle owner/date cues — review before sending.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function Section({
  icon,
  title,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1">
      <h4 className="text-xs font-semibold text-foreground flex items-center gap-1.5">{icon} {title}</h4>
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
