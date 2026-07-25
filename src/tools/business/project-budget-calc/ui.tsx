"use client";

import React, { useState, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ErrorBanner, CopyButton, DownloadButton } from "../../_shared";
import { computeBudget, toMarkdown, type BudgetInput, type LaborLine, type MaterialLine } from "./logic";

export default function ProjectBudgetCalc() {
  const [labor, setLabor] = useState<LaborLine[]>([{ role: "Engineer", hours: 100, rate: 50 }]);
  const [materials, setMaterials] = useState<MaterialLine[]>([{ name: "Server", qty: 2, unitCost: 1000 }]);
  const [overheadPct, setOverheadPct] = useState(10);
  const [contingencyPct, setContingencyPct] = useState(5);
  const [taxPct, setTaxPct] = useState(7);

  const input: BudgetInput = { labor, materials, overheadPct, contingencyPct, taxPct };
  const result = useMemo(() => computeBudget(input), [labor, materials, overheadPct, contingencyPct, taxPct]);
  const md = useMemo(() => toMarkdown(result), [result]);

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold">Labor</p>
            <Button size="sm" variant="outline" onClick={() => setLabor((p) => [...p, { role: "", hours: 0, rate: 0 }])}>+ Add line</Button>
          </div>
          {labor.map((l, i) => (
            <div key={i} className="grid grid-cols-1 sm:grid-cols-4 gap-2">
              <Input placeholder="Role" value={l.role} onChange={(e) => setLabor((p) => p.map((x, idx) => idx === i ? { ...x, role: e.target.value } : x))} className="h-8 text-xs" />
              <Input type="number" placeholder="Hours" value={l.hours} onChange={(e) => setLabor((p) => p.map((x, idx) => idx === i ? { ...x, hours: Number(e.target.value) } : x))} className="h-8 text-xs" />
              <Input type="number" placeholder="Rate" value={l.rate} onChange={(e) => setLabor((p) => p.map((x, idx) => idx === i ? { ...x, rate: Number(e.target.value) } : x))} className="h-8 text-xs" />
              <Button size="sm" variant="ghost" onClick={() => setLabor((p) => p.filter((_, idx) => idx !== i))}>Remove</Button>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold">Materials</p>
            <Button size="sm" variant="outline" onClick={() => setMaterials((p) => [...p, { name: "", qty: 0, unitCost: 0 }])}>+ Add line</Button>
          </div>
          {materials.map((m, i) => (
            <div key={i} className="grid grid-cols-1 sm:grid-cols-4 gap-2">
              <Input placeholder="Item" value={m.name} onChange={(e) => setMaterials((p) => p.map((x, idx) => idx === i ? { ...x, name: e.target.value } : x))} className="h-8 text-xs" />
              <Input type="number" placeholder="Qty" value={m.qty} onChange={(e) => setMaterials((p) => p.map((x, idx) => idx === i ? { ...x, qty: Number(e.target.value) } : x))} className="h-8 text-xs" />
              <Input type="number" placeholder="Unit cost" value={m.unitCost} onChange={(e) => setMaterials((p) => p.map((x, idx) => idx === i ? { ...x, unitCost: Number(e.target.value) } : x))} className="h-8 text-xs" />
              <Button size="sm" variant="ghost" onClick={() => setMaterials((p) => p.filter((_, idx) => idx !== i))}>Remove</Button>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="grid grid-cols-3 gap-2">
            <div><Label className="text-[10px] uppercase text-muted-foreground">Overhead %</Label><Input type="number" value={overheadPct} onChange={(e) => setOverheadPct(Number(e.target.value))} className="mt-1 h-8 text-xs" /></div>
            <div><Label className="text-[10px] uppercase text-muted-foreground">Contingency %</Label><Input type="number" value={contingencyPct} onChange={(e) => setContingencyPct(Number(e.target.value))} className="mt-1 h-8 text-xs" /></div>
            <div><Label className="text-[10px] uppercase text-muted-foreground">Tax % (materials)</Label><Input type="number" value={taxPct} onChange={(e) => setTaxPct(Number(e.target.value))} className="mt-1 h-8 text-xs" /></div>
          </div>
          {result.warnings.length > 0 && <ErrorBanner message={result.warnings.join("; ")} />}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold">Budget breakdown</p>
            <div className="flex gap-2">
              <CopyButton getText={() => md} label="Copy MD" />
              <DownloadButton getText={() => md} filename="project-budget.md" mime="text/markdown" label="Download" />
            </div>
          </div>
          <div className="space-y-1 text-xs">
            <Row label="Labor" value={result.laborCost} />
            <Row label="Materials" value={result.materialsCost} />
            <Row label="Materials tax" value={result.materialsTax} />
            <Row label="Subtotal" value={result.subtotal} />
            <Row label={`Overhead (${overheadPct}%)`} value={result.overhead} />
            <Row label={`Contingency (${contingencyPct}%)`} value={result.contingency} />
            <div className="flex justify-between border-t pt-2 font-bold">
              <span>Total</span><span className="font-mono">${result.total}</span>
            </div>
          </div>
          <div className="grid grid-cols-4 gap-1.5">
            <PctCell label="Labor" pct={result.costBreakdownPct.labor} />
            <PctCell label="Materials" pct={result.costBreakdownPct.materials} />
            <PctCell label="Overhead" pct={result.costBreakdownPct.overhead} />
            <PctCell label="Contingency" pct={result.costBreakdownPct.contingency} />
          </div>
        </CardContent>
      </Card>

      <Card><CardContent className="p-3"><p className="text-xs text-muted-foreground"><strong className="text-foreground">Privacy:</strong> all calculations run locally.</p></CardContent></Card>
    </div>
  );
}

function Row({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex justify-between"><span className="text-muted-foreground">{label}</span><span className="font-mono">${value}</span></div>
  );
}
function PctCell({ label, pct }: { label: string; pct: number }) {
  return (
    <div className="rounded border bg-background px-2 py-1 text-center">
      <div className="text-[10px] uppercase text-muted-foreground">{label}</div>
      <div className="font-mono text-sm"><Badge variant="outline" className="text-[10px]">{pct}%</Badge></div>
    </div>
  );
}
