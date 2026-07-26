"use client";

import React, { useState, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { ErrorBanner, CopyButton, DownloadButton } from "../../_shared";
import {
  computeMortgageInsurance,
  validateInputs,
  fmtUSD,
  ltvRiskLabel,
  compareLoanTypes,
  pmiCancellationYear,
  refinanceBreakeven,
  type LoanType,
  type Term,
} from "./logic";

export default function MortgageInsuranceCalcUI() {
  const [homePrice, setHomePrice] = useState("500000");
  const [downPayment, setDownPayment] = useState("50000");
  const [creditScore, setCreditScore] = useState("720");
  const [rate, setRate] = useState("7");
  const [loanType, setLoanType] = useState<LoanType>("conventional");
  const [term, setTerm] = useState<Term>(30);
  const [vaFirstUse, setVaFirstUse] = useState(true);
  const [vaDisabled, setVaDisabled] = useState(false);
  const [closingCosts, setClosingCosts] = useState("5000");
  const [monthlySavings, setMonthlySavings] = useState("150");

  const errors = useMemo(
    () =>
      validateInputs({
        homePrice: parseFloat(homePrice),
        downPayment: parseFloat(downPayment),
        creditScore: parseFloat(creditScore),
      }),
    [homePrice, downPayment, creditScore],
  );

  const result = useMemo(() => {
    if (errors.length) return null;
    return computeMortgageInsurance({
      homePrice: parseFloat(homePrice),
      downPayment: parseFloat(downPayment),
      loanType,
      term,
      creditScore: parseFloat(creditScore),
      interestRate: parseFloat(rate),
      vaFirstUse,
      vaDisabled,
    });
  }, [homePrice, downPayment, loanType, term, creditScore, rate, vaFirstUse, vaDisabled, errors]);

  const cancelYr = useMemo(() => {
    if (errors.length) return null;
    return pmiCancellationYear(
      parseFloat(homePrice),
      parseFloat(downPayment),
      parseFloat(rate),
      term,
    );
  }, [homePrice, downPayment, rate, term, errors]);

  const comparison = useMemo(() => {
    if (errors.length) return [];
    return compareLoanTypes({
      homePrice: parseFloat(homePrice),
      downPayment: parseFloat(downPayment),
      term,
      creditScore: parseFloat(creditScore),
      vaFirstUse,
      vaDisabled,
    });
  }, [homePrice, downPayment, term, creditScore, vaFirstUse, vaDisabled, errors]);

  const breakeven = useMemo(() => {
    const c = parseFloat(closingCosts);
    const m = parseFloat(monthlySavings);
    if (!isFinite(c) || !isFinite(m) || c <= 0 || m <= 0) return null;
    return refinanceBreakeven(c, m);
  }, [closingCosts, monthlySavings]);

  const risk = result ? ltvRiskLabel(result.ltv) : null;
  const summary = useMemo(() => {
    if (!result) return "";
    return [
      `Loan type: ${loanType.toUpperCase()}`,
      `Loan amount: ${fmtUSD(result.loanAmount)}`,
      `LTV: ${result.ltv}% (${risk?.label ?? ""})`,
      `Monthly MI: ${fmtUSD(result.monthlyMI)}`,
      `Annual MI: ${fmtUSD(result.annualMI)}`,
      `Upfront MI: ${fmtUSD(result.upfrontMI)}`,
      `5-year total: ${fmtUSD(result.totalUpfrontPlusFiveYear)}`,
    ].join("\n");
  }, [result, loanType, risk]);

  return (
    <div className="space-y-4">
      {errors.length > 0 && <ErrorBanner message={errors.join("; ")} />}

      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div>
              <Label className="text-xs text-muted-foreground">Home price ($)</Label>
              <Input value={homePrice} onChange={(e) => setHomePrice(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Down payment ($)</Label>
              <Input value={downPayment} onChange={(e) => setDownPayment(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Credit score (300-850)</Label>
              <Input value={creditScore} onChange={(e) => setCreditScore(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Interest rate (%)</Label>
              <Input value={rate} onChange={(e) => setRate(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Loan type</Label>
              <select
                value={loanType}
                onChange={(e) => setLoanType(e.target.value as LoanType)}
                className="w-full h-9 rounded-md border bg-background px-2 text-sm"
              >
                <option value="conventional">Conventional (PMI)</option>
                <option value="fha">FHA (MIP)</option>
                <option value="va">VA (Funding Fee)</option>
              </select>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Term (years)</Label>
              <select
                value={term}
                onChange={(e) => setTerm(Number(e.target.value) as Term)}
                className="w-full h-9 rounded-md border bg-background px-2 text-sm"
              >
                <option value={15}>15 years</option>
                <option value={20}>20 years</option>
                <option value={30}>30 years</option>
              </select>
            </div>
            {loanType === "va" && (
              <>
                <div className="flex items-center gap-2 pt-6">
                  <input id="va-first" type="checkbox" checked={vaFirstUse} onChange={(e) => setVaFirstUse(e.target.checked)} />
                  <Label htmlFor="va-first" className="text-xs">First-time VA use</Label>
                </div>
                <div className="flex items-center gap-2 pt-6">
                  <input id="va-dis" type="checkbox" checked={vaDisabled} onChange={(e) => setVaDisabled(e.target.checked)} />
                  <Label htmlFor="va-dis" className="text-xs">Disabled veteran (fee waived)</Label>
                </div>
              </>
            )}
          </div>
        </CardContent>
      </Card>

      {result && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <p className="text-sm font-medium">Mortgage insurance breakdown</p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <div className="rounded-md border p-3">
                <p className="text-xs text-muted-foreground">Loan amount</p>
                <p className="text-lg font-bold">{fmtUSD(result.loanAmount)}</p>
              </div>
              <div className="rounded-md border p-3">
                <p className="text-xs text-muted-foreground">LTV</p>
                <p className="text-lg font-bold">
                  {result.ltv}%
                  {risk && (
                    <span className={`ml-1 text-xs px-1.5 py-0.5 rounded bg-${risk.color}-500/15 text-${risk.color}-700 dark:text-${risk.color}-400`}>
                      {risk.label}
                    </span>
                  )}
                </p>
              </div>
              <div className="rounded-md border p-3">
                <p className="text-xs text-muted-foreground">Monthly MI</p>
                <p className="text-lg font-bold">{fmtUSD(result.monthlyMI)}</p>
              </div>
              <div className="rounded-md border p-3">
                <p className="text-xs text-muted-foreground">Upfront MI</p>
                <p className="text-lg font-bold">{fmtUSD(result.upfrontMI)}</p>
              </div>
            </div>
            <div className="rounded-md border p-3">
              <p className="text-xs text-muted-foreground">5-year total cost</p>
              <p className="text-2xl font-bold">{fmtUSD(result.totalUpfrontPlusFiveYear)}</p>
              <p className="text-xs text-muted-foreground mt-1">
                Cancellable: <span className="font-bold text-foreground">{result.cancellable ? "Yes" : "No"}</span>
              </p>
            </div>
            <ul className="text-xs text-muted-foreground list-disc pl-4 space-y-1">
              {result.notes.map((n, i) => (
                <li key={i}>{n}</li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {result && result.schedule.length > 0 && (
        <Card>
          <CardContent className="p-4">
            <p className="text-sm font-medium mb-2">5-year MI cost schedule</p>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-muted-foreground border-b">
                    <th className="py-1.5">Year</th>
                    <th className="py-1.5">Monthly MI</th>
                    <th className="py-1.5">Annual MI</th>
                    <th className="py-1.5">Cumulative</th>
                  </tr>
                </thead>
                <tbody className="font-mono">
                  {result.schedule.map((s) => (
                    <tr key={s.year} className="border-b border-border/30">
                      <td className="py-1.5">{s.year}</td>
                      <td>{fmtUSD(s.monthlyMI)}</td>
                      <td>{fmtUSD(s.annualMI)}</td>
                      <td>{fmtUSD(s.cumulativeMI)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardContent className="p-4 space-y-2">
            <p className="text-sm font-medium">Loan type comparison (5-yr cost)</p>
            <div className="space-y-2">
              {comparison.map((c) => (
                <div key={c.type} className="flex items-center justify-between rounded-md border p-2">
                  <span className="text-sm font-medium uppercase">{c.type}</span>
                  <div className="text-right text-sm">
                    <p className="font-mono">{fmtUSD(c.fiveYear)} total</p>
                    <p className="text-xs text-muted-foreground">{fmtUSD(c.monthly)}/mo · {fmtUSD(c.upfront)} upfront</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 space-y-3">
            <p className="text-sm font-medium">PMI cancellation & refinance</p>
            {cancelYr && (
              <p className="text-sm">
                Estimated PMI cancellation: <span className="font-bold">Year {cancelYr}</span> (assumes 3%/yr home appreciation)
              </p>
            )}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs text-muted-foreground">Refi closing costs ($)</Label>
                <Input value={closingCosts} onChange={(e) => setClosingCosts(e.target.value)} />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Monthly savings ($)</Label>
                <Input value={monthlySavings} onChange={(e) => setMonthlySavings(e.target.value)} />
              </div>
            </div>
            {breakeven !== null && (
              <p className="text-sm">
                Breakeven: <span className="font-bold">{breakeven} months</span> ({(breakeven / 12).toFixed(1)} years)
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="p-4 flex flex-wrap gap-2 items-center">
          <CopyButton getText={() => summary} label="Copy summary" />
          <DownloadButton getText={() => summary} filename="mortgage-insurance.txt" />
          <p className="text-xs text-muted-foreground ml-auto">
            100% private — runs locally. Estimates use 2024 US industry rates.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
