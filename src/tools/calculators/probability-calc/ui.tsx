"use client";

import React, { useState, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { CopyButton, DownloadButton, ErrorBanner } from "../../_shared";
import { validateInput, intersection, union, conditionalAGivenB, conditionalBGivenA, bayes, oddsFromProb, formatPct } from "./logic";

export default function ProbabilityCalc() {
  const [pA, setPA] = useState("0.5");
  const [pB, setPB] = useState("0.4");
  const [pAB, setPAB] = useState("");
  const [bayesPBA, setBayesPBA] = useState("");
  const [error, setError] = useState<string | null>(null);

  const results = useMemo(() => {
    setError(null);
    const a = Number(pA); const b = Number(pB);
    const ab = pAB === "" ? undefined : Number(pAB);
    const v = validateInput({ pA: a, pB: b, pAB: ab });
    if ("error" in v) { setError(v.error); return null; }
    const inter = intersection(v);
    const uni = union(v);
    const cAB = conditionalAGivenB(v);
    const cBA = conditionalBGivenA(v);
    const odds = oddsFromProb(a);
    return { inter, uni, cAB, cBA, odds };
  }, [pA, pB, pAB]);

  const bayesResult = useMemo(() => {
    if (bayesPBA === "") return null;
    const a = Number(pA); const b = Number(pB); const pba = Number(bayesPBA);
    return bayes(a, b, pba);
  }, [pA, pB, bayesPBA]);

  const summary = useMemo(() => {
    if (!results) return "";
    const lines = ["Metric,Value"];
    lines.push(`P(A ∩ B),${results.inter.toFixed(4)}`);
    lines.push(`P(A ∪ B),${results.uni.toFixed(4)}`);
    if (typeof results.cAB === "number") lines.push(`P(A|B),${results.cAB.toFixed(4)}`);
    if (typeof results.cBA === "number") lines.push(`P(B|A),${results.cBA.toFixed(4)}`);
    if (typeof results.odds === "number") lines.push(`Odds(A),${results.odds.toFixed(4)}`);
    if (typeof bayesResult === "number") lines.push(`Bayes P(A|B),${bayesResult.toFixed(4)}`);
    return lines.join("\n");
  }, [results, bayesResult]);

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
            <CopyButton getText={() => summary} disabled={!results} />
            <DownloadButton getText={() => summary} filename="probability.csv" mime="text/csv" disabled={!results} />
          </div>
        </CardContent>
      </Card>

      {error && <ErrorBanner message={error} />}

      {!error && results && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground mb-1">P(A ∩ B)</p><p className="text-xl font-bold">{formatPct(results.inter)}</p></CardContent></Card>
          <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground mb-1">P(A ∪ B)</p><p className="text-xl font-bold">{formatPct(results.uni)}</p></CardContent></Card>
          <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground mb-1">P(A|B)</p><p className="text-xl font-bold">{typeof results.cAB === "number" ? formatPct(results.cAB) : "—"}</p></CardContent></Card>
          <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground mb-1">P(B|A)</p><p className="text-xl font-bold">{typeof results.cBA === "number" ? formatPct(results.cBA) : "—"}</p></CardContent></Card>
          <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground mb-1">Odds of A</p><p className="text-xl font-bold">{typeof results.odds === "number" ? results.odds.toFixed(3) : "—"}</p></CardContent></Card>
          <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground mb-1">Bayes P(A|B)</p><p className="text-xl font-bold">{typeof bayesResult === "number" ? formatPct(bayesResult) : "—"}</p></CardContent></Card>
        </div>
      )}

      <Card>
        <CardContent className="p-4">
          <p className="text-xs text-muted-foreground">
            <strong className="text-foreground">Privacy:</strong> all calculations run locally in your browser.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
