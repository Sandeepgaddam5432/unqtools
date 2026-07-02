/**
 * SIP Calculator — Preact island UI.
 */
import { useMemo, useState } from "preact/hooks";
import {
  Input,
  Button,
  Card,
  Toggle,
  CopyButton,
  ToastContainer,
  toast,
  ErrorBanner,
} from "../../../components/ui";
import { calculateSip, formatCurrency, formatCompact, type SipInput } from "./logic";

export default function SipCalculator() {
  const [monthly, setMonthly] = useState<number>(10000);
  const [annualReturn, setAnnualReturn] = useState<number>(12);
  const [years, setYears] = useState<number>(10);
  const [stepUpPct, setStepUpPct] = useState<number>(0);
  const [inflationPct, setInflationPct] = useState<number>(0);
  const [showAdvanced, setShowAdvanced] = useState<boolean>(false);
  const [currency, setCurrency] = useState<"INR" | "USD" | "EUR" | "GBP">("INR");

  const input: SipInput = useMemo(
    () => ({
      monthlyInvestment: monthly,
      annualReturnPct: annualReturn,
      years,
      stepUpPct: showAdvanced ? stepUpPct : 0,
      inflationPct: showAdvanced ? inflationPct : 0,
    }),
    [monthly, annualReturn, years, showAdvanced, stepUpPct, inflationPct],
  );

  const result = useMemo(() => calculateSip(input), [input]);

  const locale =
    currency === "INR"
      ? "en-IN"
      : currency === "USD"
        ? "en-US"
        : currency === "EUR"
          ? "en-IE"
          : "en-GB";
  const fmt = (n: number) => formatCurrency(n, locale, currency);
  const fmtC = (n: number) => formatCompact(n, locale, currency);

  function loadSample() {
    setMonthly(25000);
    setAnnualReturn(14);
    setYears(20);
    setStepUpPct(10);
    setInflationPct(6);
    setShowAdvanced(true);
    toast("Sample loaded", "info");
  }

  function copySummary() {
    if ("error" in result) return;
    const text = `SIP Projection
Monthly: ${fmt(monthly)}
Duration: ${years} years
Expected return: ${annualReturn}% p.a.
Total Invested: ${fmt(result.totalInvested)}
Future Value: ${fmt(result.futureValue)}
Returns: ${fmt(result.totalReturns)}
Wealth Ratio: ${result.wealthRatio}x${result.realFutureValue ? `\nReal Value (inflation-adj): ${fmt(result.realFutureValue)}` : ""}`;
    void navigator.clipboard.writeText(text).then(
      () => toast("Summary copied", "success"),
      () => toast("Could not copy", "error"),
    );
  }

  return (
    <div class="space-y-4">
      <ToastContainer />

      <Card class="!p-4">
        <div class="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Input
            id="sip-monthly"
            label="Monthly investment"
            type="number"
            min={0}
            step={500}
            value={monthly}
            onInput={(e) => setMonthly(Number((e.currentTarget as HTMLInputElement).value))}
          />
          <Input
            id="sip-return"
            label="Expected return (% p.a.)"
            type="number"
            min={0}
            max={50}
            step={0.5}
            value={annualReturn}
            onInput={(e) => setAnnualReturn(Number((e.currentTarget as HTMLInputElement).value))}
          />
          <Input
            id="sip-years"
            label="Duration (years)"
            type="number"
            min={1}
            max={100}
            step={1}
            value={years}
            onInput={(e) => setYears(Number((e.currentTarget as HTMLInputElement).value))}
          />
          <div>
            <label for="sip-currency" class="mb-1 block text-sm font-medium">
              Currency
            </label>
            <select
              id="sip-currency"
              class="unq-input"
              value={currency}
              onChange={(e) =>
                setCurrency((e.currentTarget as HTMLSelectElement).value as typeof currency)
              }
            >
              <option value="INR">₹ INR</option>
              <option value="USD">$ USD</option>
              <option value="EUR">€ EUR</option>
              <option value="GBP">£ GBP</option>
            </select>
          </div>
        </div>

        <div class="mt-3">
          <Toggle
            id="sip-advanced"
            label="Show advanced options (step-up, inflation)"
            checked={showAdvanced}
            onChange={setShowAdvanced}
          />
        </div>

        {showAdvanced && (
          <div class="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Input
              id="sip-stepup"
              label="Annual step-up (%)"
              type="number"
              min={0}
              max={50}
              step={1}
              value={stepUpPct}
              onInput={(e) => setStepUpPct(Number((e.currentTarget as HTMLInputElement).value))}
              hint="Increase monthly investment by this % each year"
            />
            <Input
              id="sip-inflation"
              label="Inflation rate (% p.a.)"
              type="number"
              min={0}
              max={20}
              step={0.5}
              value={inflationPct}
              onInput={(e) => setInflationPct(Number((e.currentTarget as HTMLInputElement).value))}
              hint="Used to show real (inflation-adjusted) value"
            />
          </div>
        )}

        <div class="mt-4 flex flex-wrap gap-2">
          <Button onClick={loadSample}>Load sample</Button>
          <Button
            variant="outline"
            onClick={() => {
              setMonthly(0);
              setAnnualReturn(0);
              setYears(0);
            }}
          >
            Clear
          </Button>
          {"error" in result ? null : (
            <Button variant="ghost" onClick={copySummary}>
              Copy summary
            </Button>
          )}
        </div>
      </Card>

      {"error" in result ? (
        <ErrorBanner message={result.error} />
      ) : (
        <>
          <div class="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Card class="!p-4 text-center">
              <p class="text-unq-muted text-xs uppercase tracking-wide">Total Invested</p>
              <p class="mt-1 text-2xl font-bold tabular-nums">{fmt(result.totalInvested)}</p>
              <p class="text-unq-muted mt-1 text-xs">{fmtC(result.totalInvested)}</p>
            </Card>
            <Card class="border-unq-success/40 !p-4 text-center">
              <p class="text-unq-muted text-xs uppercase tracking-wide">Future Value</p>
              <p class="text-unq-success-strong mt-1 text-2xl font-bold tabular-nums">
                {fmt(result.futureValue)}
              </p>
              <p class="text-unq-muted mt-1 text-xs">{fmtC(result.futureValue)}</p>
            </Card>
            <Card class="!p-4 text-center">
              <p class="text-unq-muted text-xs uppercase tracking-wide">Total Returns</p>
              <p class="mt-1 text-2xl font-bold tabular-nums">{fmt(result.totalReturns)}</p>
              <p class="text-unq-muted mt-1 text-xs">{result.wealthRatio}x wealth ratio</p>
            </Card>
          </div>

          {result.realFutureValue !== undefined && (
            <Card class="!p-4">
              <p class="text-sm">
                <strong>Inflation-adjusted value:</strong>{" "}
                <span class="font-mono">{fmt(result.realFutureValue)}</span>
                <span class="text-unq-muted ml-2 text-xs">
                  (real purchasing power at {inflationPct}% inflation)
                </span>
              </p>
            </Card>
          )}

          <Card class="!p-4">
            <div class="mb-3 flex items-center justify-between">
              <p class="text-sm font-semibold">Year-by-year breakdown</p>
              <CopyButton
                getText={() => {
                  if ("error" in result) return "";
                  return result.yearlyBreakdown
                    .map(
                      (r) =>
                        `Year ${r.year}\tInvested: ${r.investedThisYear}\tTotal: ${r.totalInvested}\tValue: ${r.yearEndValue}\tReturns: ${r.returns}`,
                    )
                    .join("\n");
                }}
                label="Copy"
              />
            </div>
            <div class="unq-scroll-x max-h-[420px] overflow-y-auto">
              <table class="w-full text-xs">
                <thead class="sticky top-0 bg-unq-surface">
                  <tr class="text-unq-muted border-b border-unq-border text-left">
                    <th class="px-2 py-2">Year</th>
                    <th class="px-2 py-2 text-right">Invested (year)</th>
                    <th class="px-2 py-2 text-right">Total Invested</th>
                    <th class="px-2 py-2 text-right">Year-end Value</th>
                    <th class="px-2 py-2 text-right">Returns</th>
                  </tr>
                </thead>
                <tbody>
                  {result.yearlyBreakdown.map((r) => (
                    <tr key={r.year} class="border-unq-border/40 border-b">
                      <td class="px-2 py-1.5 font-mono">{r.year}</td>
                      <td class="px-2 py-1.5 text-right font-mono">{fmt(r.investedThisYear)}</td>
                      <td class="px-2 py-1.5 text-right font-mono">{fmt(r.totalInvested)}</td>
                      <td class="text-unq-success-strong px-2 py-1.5 text-right font-mono">
                        {fmt(r.yearEndValue)}
                      </td>
                      <td class="text-unq-muted px-2 py-1.5 text-right font-mono">
                        {fmt(r.returns)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}

      <Card class="text-unq-muted !p-4 text-xs">
        <p>
          <strong>Privacy:</strong> all calculations happen locally in your browser. The standard
          SIP formula{" "}
          <code>
            FV = P × [((1+r)<sup>n</sup> − 1) / r] × (1+r)
          </code>{" "}
          is used. Returns shown are projections based on your assumed rate, not guarantees.
        </p>
      </Card>
    </div>
  );
}
