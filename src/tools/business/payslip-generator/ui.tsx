"use client";

import React, { useState, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { CopyButton, DownloadButton, ErrorBanner } from "../../_shared";
import { computePayslip, renderPayslip, formatMoney } from "./logic";

export default function PayslipGenerator() {
  const [gross, setGross] = useState(5000);
  const [taxRate, setTaxRate] = useState(20);
  const [deductions, setDeductions] = useState([{ name: "Insurance", amount: 200 }]);
  const [allowances, setAllowances] = useState([{ name: "Travel", amount: 100 }]);
  const [error, setError] = useState<string | null>(null);

  const result = useMemo(() => {
    const r = computePayslip({ grossSalary: gross, taxRate, deductions, allowances });
    if ("error" in r) { setError(r.error); return null; }
    setError(null);
    return r;
  }, [gross, taxRate, deductions, allowances]);

  const report = result ? renderPayslip({ grossSalary: gross, taxRate, deductions, allowances }, result) : "";

  const updateD = (i: number, field: "name" | "amount", value: string) => {
    const next = [...deductions];
    next[i] = { ...next[i]!, [field]: field === "amount" ? Number(value) : value };
    setDeductions(next);
  };
  const updateA = (i: number, field: "name" | "amount", value: string) => {
    const next = [...allowances];
    next[i] = { ...next[i]!, [field]: field === "amount" ? Number(value) : value };
    setAllowances(next);
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <div><Label className="text-xs text-muted-foreground">Gross salary</Label><input type="number" className="w-full rounded-md border px-2 py-1 text-sm" value={gross} onChange={(e) => setGross(Number(e.target.value))} /></div>
            <div><Label className="text-xs text-muted-foreground">Tax rate (%)</Label><input type="number" className="w-full rounded-md border px-2 py-1 text-sm" value={taxRate} onChange={(e) => setTaxRate(Number(e.target.value))} /></div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center justify-between"><Label className="text-xs text-muted-foreground">Deductions</Label><Button size="sm" variant="outline" onClick={() => setDeductions([...deductions, { name: "", amount: 0 }])}>Add</Button></div>
          {deductions.map((d, i) => (
            <div key={i} className="flex gap-2">
              <input type="text" placeholder="Name" className="flex-1 rounded-md border px-2 py-1 text-sm" value={d.name} onChange={(e) => updateD(i, "name", e.target.value)} />
              <input type="number" placeholder="Amount" className="w-28 rounded-md border px-2 py-1 text-sm" value={d.amount} onChange={(e) => updateD(i, "amount", e.target.value)} />
              <Button size="sm" variant="ghost" onClick={() => setDeductions(deductions.filter((_, j) => j !== i))}>Remove</Button>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center justify-between"><Label className="text-xs text-muted-foreground">Allowances</Label><Button size="sm" variant="outline" onClick={() => setAllowances([...allowances, { name: "", amount: 0 }])}>Add</Button></div>
          {allowances.map((a, i) => (
            <div key={i} className="flex gap-2">
              <input type="text" placeholder="Name" className="flex-1 rounded-md border px-2 py-1 text-sm" value={a.name} onChange={(e) => updateA(i, "name", e.target.value)} />
              <input type="number" placeholder="Amount" className="w-28 rounded-md border px-2 py-1 text-sm" value={a.amount} onChange={(e) => updateA(i, "amount", e.target.value)} />
              <Button size="sm" variant="ghost" onClick={() => setAllowances(allowances.filter((_, j) => j !== i))}>Remove</Button>
            </div>
          ))}
        </CardContent>
      </Card>

      {error && <ErrorBanner message={error} />}

      {result && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Net pay</p>
                <p className="text-2xl font-bold">{formatMoney(result.net)}</p>
              </div>
              <div className="flex gap-2">
                <CopyButton getText={() => report} />
                <DownloadButton getText={() => report} filename="payslip.txt" />
              </div>
            </div>
            <pre className="text-xs overflow-x-auto p-3 bg-muted/40 rounded-md font-mono whitespace-pre-wrap">{report}</pre>
          </CardContent>
        </Card>
      )}

      <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground"><strong className="text-foreground">Privacy:</strong> all calculations run locally in your browser.</p></CardContent></Card>
    </div>
  );
}
