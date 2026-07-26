"use client";

import React, { useState, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CopyButton, DownloadButton, ErrorBanner } from "../../_shared";
import {
  validateInput, summarize, summarizeBatch, bayes, batchToCsv, formatPct,
  permutations, combinations, binomialPmf, binomialCdf, type ProbabilityInput,
} from "./logic";

export default function ProbabilityCalc() {
  const [pA, setPA] = useState("0.5");
  const [pB, setPB] = useState("0.4");
  const [pAB, setPAB] = useState("");
  const [bayesPBA, setBayesPBA] = useState("");
  const [batchText, setBatchText] = useState("");
  const [nPrN, setNPrN] = useState("5");
  const [nPrR, setNPrR] = useState("2");
  const [binN, setBinN] = useState("10");
  const [binP, setBinP] = useState("0.5");
  const [binK, setBinK] = useState("5");
  const [error, setError] = useState<string | null>(null);

  const summary = useMemo(() => {
    queueMicrotask(() => setError(null));
    const a = Number(pA); const b = Number(pB);
    const ab = pAB === "" ? undefined : Number(pAB);
    const v = validateInput({ pA: a, pB: b, pAB: ab });
    if ("error" in v) { queueMicrotask(() => setError(v.error)); return null; }
    return summarize(v);
  }, [pA, pB, pAB]);

  const bayesResult = useMemo(() => {
    if (bayesPBA === "") return null;
    return bayes(Number(pA), Number(pB), Number(bayesPBA));
  }, [pA, pB, bayesPBA]);

  const batchLines = useMemo(() => batchText.split(/\r?\n/).map((l) => l.trim()).filter((l) => l.length > 0), [batchText]);
  const batchInputs = useMemo<ProbabilityInput[]>(() => {
    return batchLines.map((line) => {
      const parts = line.split(",").map((p) => p.trim());
      return { pA: Number(parts[0] ?? 0), pB: Number(parts[1] ?? 0), pAB: parts[2] ? Number(parts[2]) : undefined };
    });
  }, [batchLines]);
  const batchSummaries = useMemo(() => summarizeBatch(batchInputs), [batchInputs]);

  const nPr = useMemo(() => permutations(Number(nPrN), Number(nPrR)), [nPrN, nPrR]);
  const nCr = useMemo(() => combinations(Number(nPrN), Number(nPrR)), [nPrN, nPrR]);
  const binomPmf = useMemo(() => binomialPmf(Number(binN), Number(binP), Number(binK)), [binN, binP, binK]);
  const binomCdf = useMemo(() => binomialCdf(Number(binN), Number(binP), Number(binK)), [binN, binP, binK]);

  const csvSummary = useMemo(() => {
    if (!summary) return "";
    return batchToCsv([summary]);
  }, [summary]);

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-muted-foreground">P(A)</Label>
              <Input value={pA} onChange={(e) => setPA(e.target.value)} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-muted-foreground">P(B)</Label>
              <Input value={pB} onChange={(e) => setPB(e.target.value)} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-muted-foreground">P(A∩B) — optional</Label>
              <Input value={pAB} onChange={(e) => setPAB(e.target.value)} placeholder="auto = P(A)×P(B)" />
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs text-muted-foreground">Bayes: P(B|A) — optional</Label>
            <Input value={bayesPBA} onChange={(e) => setBayesPBA(e.target.value)} placeholder="e.g. 0.8" />
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="ghost" onClick={() => { setPA("0.1"); setPB("0.05"); setPAB(""); setBayesPBA("0.5"); }}>Load sample</Button>
            <CopyButton getText={() => csvSummary} disabled={!summary} />
            <DownloadButton getText={() => csvSummary} filename="probability.csv" mime="text/csv" disabled={!summary} />
          </div>
        </CardContent>
      </Card>

      {error && <ErrorBanner message={error} />}

      {!error && summary && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground mb-1">P(A ∩ B)</p><p className="text-xl font-bold">{formatPct(summary.pAB)}</p></CardContent></Card>
            <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground mb-1">P(A ∪ B)</p><p className="text-xl font-bold">{formatPct(summary.pAUB)}</p></CardContent></Card>
            <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground mb-1">P(A|B)</p><p className="text-xl font-bold">{summary.pAGivenB !== null ? formatPct(summary.pAGivenB) : "—"}</p></CardContent></Card>
            <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground mb-1">P(B|A)</p><p className="text-xl font-bold">{summary.pBGivenA !== null ? formatPct(summary.pBGivenA) : "—"}</p></CardContent></Card>
            <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground mb-1">P(not A)</p><p className="text-xl font-bold">{formatPct(summary.pNotA)}</p></CardContent></Card>
            <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground mb-1">Odds of A</p><p className="text-xl font-bold">{summary.oddsA !== null ? summary.oddsA.toFixed(3) : "—"}</p></CardContent></Card>
          </div>
          <Card>
            <CardContent className="p-4 space-y-2">
              <div className="flex flex-wrap gap-2">
                <Badge variant={summary.independent ? "default" : "outline"}>{summary.independent ? "A ⊥ B (independent)" : "A and B are dependent"}</Badge>
                <Badge variant={summary.mutuallyExclusive ? "default" : "outline"}>{summary.mutuallyExclusive ? "Mutually exclusive" : "Not mutually exclusive"}</Badge>
                {typeof bayesResult === "number" && <Badge variant="secondary">Bayes P(A|B) = {formatPct(bayesResult)}</Badge>}
              </div>
            </CardContent>
          </Card>
        </>
      )}

      <Card>
        <CardContent className="p-4 space-y-3">
          <Label className="text-xs text-muted-foreground">Permutations & combinations (nPr / nCr)</Label>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5"><Label className="text-xs text-muted-foreground">n</Label><Input value={nPrN} onChange={(e) => setNPrN(e.target.value)} /></div>
            <div className="flex flex-col gap-1.5"><Label className="text-xs text-muted-foreground">r</Label><Input value={nPrR} onChange={(e) => setNPrR(e.target.value)} /></div>
          </div>
          <div className="flex gap-2 text-xs">
            <Badge variant="outline">nPr = {typeof nPr === "number" ? nPr : "err"}</Badge>
            <Badge variant="outline">nCr = {typeof nCr === "number" ? nCr : "err"}</Badge>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4 space-y-3">
          <Label className="text-xs text-muted-foreground">Binomial distribution P(X=k)</Label>
          <div className="grid grid-cols-3 gap-3">
            <div className="flex flex-col gap-1.5"><Label className="text-xs text-muted-foreground">n</Label><Input value={binN} onChange={(e) => setBinN(e.target.value)} /></div>
            <div className="flex flex-col gap-1.5"><Label className="text-xs text-muted-foreground">p</Label><Input value={binP} onChange={(e) => setBinP(e.target.value)} /></div>
            <div className="flex flex-col gap-1.5"><Label className="text-xs text-muted-foreground">k</Label><Input value={binK} onChange={(e) => setBinK(e.target.value)} /></div>
          </div>
          <div className="flex gap-2 text-xs">
            <Badge variant="outline">P(X=k) = {typeof binomPmf === "number" ? formatPct(binomPmf) : "err"}</Badge>
            <Badge variant="outline">P(X≤k) = {typeof binomCdf === "number" ? formatPct(binomCdf) : "err"}</Badge>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4 space-y-3">
          <Label className="text-xs text-muted-foreground">Batch mode (one P(A),P(B),P(A∩B) per line)</Label>
          <textarea className="rounded-md border bg-background px-3 py-2 text-sm min-h-[80px] font-mono" placeholder={"0.5,0.4,0.2\n0.3,0.3"} value={batchText} onChange={(e) => setBatchText(e.target.value)} />
          {batchSummaries.length > 0 && (
            <div className="flex items-center justify-between">
              <Badge variant="outline">{batchSummaries.length} rows</Badge>
              <DownloadButton getText={() => batchToCsv(batchSummaries)} filename="probability-batch.csv" mime="text/csv" />
            </div>
          )}
        </CardContent>
      </Card>

      <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground"><strong className="text-foreground">Privacy:</strong> all calculations run locally in your browser.</p></CardContent></Card>
    </div>
  );
}
