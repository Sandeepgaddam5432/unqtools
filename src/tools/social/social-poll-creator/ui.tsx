"use client";

import React, { useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ErrorBanner, CopyButton, DownloadButton } from "../../_shared";
import {
  getAllPollPlatforms,
  getPollPlatform,
  createPoll,
  addOption,
  removeOption,
  vote,
  simulateVotes,
  totalVotes,
  percentages,
  winner,
  validateForPlatform,
  formatPollText,
  formatPollMarkdown,
  exportPollCSV,
  resetVotes,
  marginOfError,
  suggestDuration,
  samplePoll,
  type Poll,
} from "./logic";

export default function SocialPollCreator() {
  const platforms = useMemo(() => getAllPollPlatforms(), []);
  const [platformId, setPlatformId] = useState<string>("twitter");
  const [poll, setPoll] = useState<Poll>(() => samplePoll());
  const [newOption, setNewOption] = useState<string>("");
  const [error, setError] = useState<string>("");

  const platform = getPollPlatform(platformId)!;
  const warnings = useMemo(() => validateForPlatform(poll, platform), [poll, platform]);
  const total = totalVotes(poll);
  const pct = useMemo(() => percentages(poll), [poll]);
  const win = useMemo(() => winner(poll), [poll]);
  const moe = marginOfError(poll);

  return (
    <div className="space-y-4">
      {error && <ErrorBanner message={error} />}

      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Target platform</Label>
              <select value={platformId} onChange={(e) => setPlatformId(e.target.value)} className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-xs">
                {platforms.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Question</Label>
              <input value={poll.question} onChange={(e) => setPoll((p) => ({ ...p, question: e.target.value }))} className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-xs" />
            </div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Duration (hours)</Label>
              <select value={poll.durationHours} onChange={(e) => setPoll((p) => ({ ...p, durationHours: Number(e.target.value) }))} className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-xs">
                {platform.durations.map((d) => (
                  <option key={d} value={d}>{d === 0 ? "Live" : `${d}h`}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Auto-suggest duration</Label>
              <button onClick={() => setPoll((p) => ({ ...p, durationHours: suggestDuration(p.question) }))} className="w-full px-2 py-1.5 text-xs rounded-md border border-border bg-muted/40 hover:bg-muted">
                Suggest from question
              </button>
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Allow multiple</Label>
              <label className="flex items-center gap-1 text-xs mt-2">
                <input type="checkbox" checked={poll.allowMultiple} onChange={(e) => setPoll((p) => ({ ...p, allowMultiple: e.target.checked }))} />
                Multi-select
              </label>
            </div>
          </div>
          <p className="text-[10px] text-muted-foreground">{platform.notes}</p>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <Label className="text-sm font-semibold">Options</Label>
            <button onClick={() => setPoll(samplePoll())} className="text-xs text-muted-foreground hover:text-foreground">Load sample</button>
          </div>
          <div className="space-y-1.5">
            {poll.options.map((o, i) => (
              <div key={o.id} className="rounded-md border border-border p-2 text-xs">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 flex-1">
                    <span className="font-mono text-muted-500">{i + 1}.</span>
                    <input value={o.text} onChange={(e) => setPoll((p) => ({ ...p, options: p.options.map((x) => (x.id === o.id ? { ...x, text: e.target.value } : x)) }))} className="flex-1 rounded border border-border bg-background px-2 py-1 text-xs" />
                    <span className="text-[10px] text-muted-foreground">{o.text.length}/{platform.maxOptionLength}</span>
                  </div>
                  <button onClick={() => setPoll((p) => removeOption(p, o.id))} className="text-red-500 text-[10px] hover:underline">remove</button>
                </div>
                <div className="flex items-center gap-2 mt-1.5">
                  <button onClick={() => setPoll((p) => vote(p, [o.id]))} className="px-2 py-0.5 text-[10px] rounded border border-border bg-muted/40 hover:bg-muted">+1 vote</button>
                  <span className="text-[10px] text-muted-foreground">{o.votes} votes</span>
                  <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                    <div className="h-full bg-primary" style={{ width: `${pct[i]?.pct ?? 0}%` }} />
                  </div>
                  <span className="text-[10px] font-mono w-10 text-right">{(pct[i]?.pct ?? 0).toFixed(0)}%</span>
                </div>
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <input value={newOption} onChange={(e) => setNewOption(e.target.value)} placeholder="New option text" className="flex-1 rounded-md border border-border bg-background px-3 py-1.5 text-xs" />
            <button onClick={() => { if (newOption.trim()) { setPoll((p) => addOption(p, newOption)); setNewOption(""); } }} className="px-3 py-1.5 text-xs rounded-md bg-primary text-primary-foreground hover:opacity-90">+ Add</button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div>
              <h3 className="text-base font-semibold">Results</h3>
              <p className="text-xs text-muted-foreground">{total} votes · margin of error ±{moe}%</p>
            </div>
            <div className="flex gap-2 flex-wrap">
              <button onClick={() => setPoll((p) => simulateVotes(p, 25))} className="px-2 py-1 text-[10px] rounded border border-border bg-muted/40 hover:bg-muted">Simulate 25</button>
              <button onClick={() => setPoll((p) => resetVotes(p))} className="px-2 py-1 text-[10px] rounded border border-border bg-muted/40 hover:bg-muted">Reset votes</button>
              <CopyButton getText={() => formatPollText(poll)} label="Copy text" />
              <CopyButton getText={() => formatPollMarkdown(poll)} label="Copy MD" />
              <DownloadButton getText={() => exportPollCSV(poll)} filename="poll.csv" mime="text/csv" label="CSV" />
            </div>
          </div>
          {win.length > 0 && total > 0 && (
            <p className="text-xs">
              {win.length === 1 ? "Leader" : "Tied"}: <span className="font-medium">{win.map((w) => w.text).join(", ")}</span>
            </p>
          )}
          {warnings.length > 0 && (
            <ul className="text-xs text-amber-700 dark:text-amber-400 list-disc pl-4">
              {warnings.map((w, i) => <li key={i}>{w}</li>)}
            </ul>
          )}
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Preview</Label>
            <pre className="text-xs whitespace-pre-wrap font-mono rounded-md border border-border p-2">{formatPollText(poll)}</pre>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
