"use client";

import React, { useState, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ErrorBanner, CopyButton, DownloadButton } from "../../_shared";
import { computeMilestones, toMarkdown, type ContractConfig } from "./logic";

export default function ContractDateCalc() {
  const [config, setConfig] = useState<ContractConfig>({
    startDate: "2024-01-01",
    durationDays: 365,
    noticePeriodDays: 30,
    renewalLeadDays: 60,
    paymentNetDays: 30,
    milestones: [
      { label: "Kickoff", offsetDays: 0 },
      { label: "Mid-term review", offsetDays: 180 },
      { label: "Final delivery", offsetDays: 360 },
    ],
  });
  const result = useMemo(() => computeMilestones(config), [config]);
  const md = useMemo(() => toMarkdown(result), [result]);
  const patch = (p: Partial<ContractConfig>) => setConfig((prev) => ({ ...prev, ...p }));

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
            <div><Label className="text-[10px] uppercase text-muted-foreground">Start</Label><Input type="date" value={config.startDate} onChange={(e) => patch({ startDate: e.target.value })} className="mt-1 h-8 text-xs" /></div>
            <div><Label className="text-[10px] uppercase text-muted-foreground">Duration (days)</Label><Input type="number" value={config.durationDays} onChange={(e) => patch({ durationDays: Number(e.target.value) })} className="mt-1 h-8 text-xs" /></div>
            <div><Label className="text-[10px] uppercase text-muted-foreground">Notice period</Label><Input type="number" value={config.noticePeriodDays} onChange={(e) => patch({ noticePeriodDays: Number(e.target.value) })} className="mt-1 h-8 text-xs" /></div>
            <div><Label className="text-[10px] uppercase text-muted-foreground">Renewal lead</Label><Input type="number" value={config.renewalLeadDays} onChange={(e) => patch({ renewalLeadDays: Number(e.target.value) })} className="mt-1 h-8 text-xs" /></div>
            <div><Label className="text-[10px] uppercase text-muted-foreground">Payment NET</Label><Input type="number" value={config.paymentNetDays} onChange={(e) => patch({ paymentNetDays: Number(e.target.value) })} className="mt-1 h-8 text-xs" /></div>
          </div>
          {result.errors.length > 0 && <ErrorBanner message={result.errors.join("; ")} />}
        </CardContent>
      </Card>

      {result.errors.length === 0 && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold">Key dates</p>
              <div className="flex gap-2">
                <CopyButton getText={() => md} label="Copy MD" />
                <DownloadButton getText={() => md} filename="contract-milestones.md" mime="text/markdown" label="Download" />
              </div>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
              <Cell label="Start" value={result.startDate} />
              <Cell label="End" value={result.endDate} />
              <Cell label="Notice due" value={result.noticeDate} />
              <Cell label="Renewal notice" value={result.renewalNoticeDate} />
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-muted-foreground">Milestones</p>
                <Button size="sm" variant="outline" onClick={() => patch({ milestones: [...config.milestones, { label: "New", offsetDays: 30 }] })}>+ Add</Button>
              </div>
              {result.milestones.map((m, i) => (
                <div key={i} className="flex items-center gap-2 text-xs">
                  <Input value={config.milestones[i].label} onChange={(e) => patch({ milestones: config.milestones.map((x, idx) => idx === i ? { ...x, label: e.target.value } : x) })} className="h-7 text-xs" />
                  <Input type="number" value={config.milestones[i].offsetDays} onChange={(e) => patch({ milestones: config.milestones.map((x, idx) => idx === i ? { ...x, offsetDays: Number(e.target.value) } : x) })} className="h-7 text-xs w-24" />
                  <Badge variant="outline" className="font-mono text-[11px]">{m.date}</Badge>
                  <Button size="icon-sm" variant="ghost" onClick={() => patch({ milestones: config.milestones.filter((_, idx) => idx !== i) })}>×</Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card><CardContent className="p-3"><p className="text-xs text-muted-foreground"><strong className="text-foreground">Privacy:</strong> all date arithmetic runs locally.</p></CardContent></Card>
    </div>
  );
}

function Cell({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded border bg-background px-2 py-1.5">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="font-mono text-sm">{value}</div>
    </div>
  );
}
