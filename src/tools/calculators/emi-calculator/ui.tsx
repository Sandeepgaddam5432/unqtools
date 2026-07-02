/**
 * Loan / EMI Calculator — Preact island UI.
 */
import { useMemo, useState } from "preact/hooks";
import {
  Input,
  Button,
  Card,
  Toggle,
  DownloadButton,
  CopyButton,
  ToastContainer,
  toast,
  ErrorBanner,
} from "../../../components/ui";
import { calculateEmi, formatCurrency, scheduleToCsv, type EmiInput } from "./logic";

export default function EmiCalculator() {
  const [principal, setPrincipal] = useState<number>(500000);
  const [annualRatePct, setAnnualRatePct] = useState<number>(9.5);
  const [tenureMonths, setTenureMonths] = useState<number>(60);
  const [showPrepayment, setShowPrepayment] = useState<boolean>(false);
  const [prepayMonth, setPrepayMonth] = useState<number>(12);
  const [prepayAmount, setPrepayAmount] = useState<number>(100000);
  const [recurringExtra, setRecurringExtra] = useState<number>(0);
  const [currency, setCurrency] = useState<"INR" | "USD" | "EUR" | "GBP">("INR");
  const [scheduleGrouping, setScheduleGrouping] = useState<"monthly" | "yearly">("monthly");

  const input: EmiInput = useMemo(
    () => ({
      principal,
      annualRatePct,
      tenureMonths,
      oneTimePrepayment:
        showPrepayment && prepayAmount > 0
          ? { month: prepayMonth, amount: prepayAmount }
          : undefined,
      recurringExtra: recurringExtra > 0 ? recurringExtra : undefined,
    }),
    [
      principal,
      annualRatePct,
      tenureMonths,
      showPrepayment,
      prepayMonth,
      prepayAmount,
      recurringExtra,
    ],
  );

  const result = useMemo(() => calculateEmi(input), [input]);

  const locale =
    currency === "INR"
      ? "en-IN"
      : currency === "USD"
        ? "en-US"
        : currency === "EUR"
          ? "en-IE"
          : "en-GB";
  const fmt = (n: number) => formatCurrency(n, locale, currency);

  function loadSample() {
    setPrincipal(2500000);
    setAnnualRatePct(8.4);
    setTenureMonths(240);
    setShowPrepayment(true);
    setPrepayMonth(36);
    setPrepayAmount(500000);
    setRecurringExtra(5000);
    toast("Sample loaded", "info");
  }

  function clearAll() {
    setPrincipal(0);
    setAnnualRatePct(0);
    setTenureMonths(0);
    setRecurringExtra(0);
  }

  function copySummary() {
    if ("error" in result) return;
    const text = `EMI: ${fmt(result.emi)} / month
Total Interest: ${fmt(result.totalInterest)}
Total Payment: ${fmt(result.totalPayment)}
Months: ${result.actualMonths} (saved ${result.monthsSaved})
Interest Saved: ${fmt(result.interestSaved)}`;
    void navigator.clipboard.writeText(text).then(
      () => toast("Summary copied", "success"),
      () => toast("Could not copy", "error"),
    );
  }

  const csvText = useMemo(() => {
    if ("error" in result) return "";
    return scheduleToCsv(result.schedule, scheduleGrouping);
  }, [result, scheduleGrouping]);

  return (
    <div class="space-y-4">
      <ToastContainer />

      <Card class="!p-4">
        <div class="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Input
            id="emi-principal"
            label="Principal"
            type="number"
            min={0}
            step={1000}
            value={principal}
            onInput={(e) => setPrincipal(Number((e.currentTarget as HTMLInputElement).value))}
          />
          <Input
            id="emi-rate"
            label="Annual interest rate (%)"
            type="number"
            min={0}
            step={0.05}
            value={annualRatePct}
            onInput={(e) => setAnnualRatePct(Number((e.currentTarget as HTMLInputElement).value))}
          />
          <Input
            id="emi-tenure"
            label="Tenure (months)"
            type="number"
            min={1}
            step={1}
            value={tenureMonths}
            onInput={(e) => setTenureMonths(Number((e.currentTarget as HTMLInputElement).value))}
          />
          <div>
            <label for="emi-currency" class="mb-1 block text-sm font-medium">
              Currency
            </label>
            <select
              id="emi-currency"
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
            id="emi-prepay-toggle"
            label="Enable prepayment modeling"
            checked={showPrepayment}
            onChange={setShowPrepayment}
          />
        </div>

        {showPrepayment && (
          <div class="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Input
              id="emi-prepay-month"
              label="One-time prepayment at month"
              type="number"
              min={1}
              step={1}
              value={prepayMonth}
              onInput={(e) => setPrepayMonth(Number((e.currentTarget as HTMLInputElement).value))}
            />
            <Input
              id="emi-prepay-amount"
              label="One-time amount"
              type="number"
              min={0}
              step={1000}
              value={prepayAmount}
              onInput={(e) => setPrepayAmount(Number((e.currentTarget as HTMLInputElement).value))}
            />
            <Input
              id="emi-recurring"
              label="Recurring extra / month"
              type="number"
              min={0}
              step={100}
              value={recurringExtra}
              onInput={(e) =>
                setRecurringExtra(Number((e.currentTarget as HTMLInputElement).value))
              }
            />
          </div>
        )}

        <div class="mt-4 flex flex-wrap gap-2">
          <Button onClick={loadSample}>Load sample</Button>
          <Button variant="outline" onClick={clearAll}>
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
          <div class="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Card class="!p-4 text-center">
              <p class="text-xs uppercase tracking-wide text-unq-muted">Monthly EMI</p>
              <p class="mt-1 text-2xl font-bold tabular-nums">{fmt(result.emi)}</p>
            </Card>
            <Card class="!p-4 text-center">
              <p class="text-xs uppercase tracking-wide text-unq-muted">Total Interest</p>
              <p class="mt-1 text-2xl font-bold tabular-nums">{fmt(result.totalInterest)}</p>
            </Card>
            <Card class="!p-4 text-center">
              <p class="text-xs uppercase tracking-wide text-unq-muted">Total Payment</p>
              <p class="mt-1 text-2xl font-bold tabular-nums">{fmt(result.totalPayment)}</p>
            </Card>
            <Card class="!p-4 text-center">
              <p class="text-xs uppercase tracking-wide text-unq-muted">Months</p>
              <p class="mt-1 text-2xl font-bold tabular-nums">
                {result.actualMonths}
                {result.monthsSaved > 0 && (
                  <span class="block text-sm text-unq-success">−{result.monthsSaved} saved</span>
                )}
              </p>
            </Card>
          </div>

          {result.interestSaved > 0 && (
            <Card class="border-unq-success/40 bg-unq-success/5 !p-4">
              <p class="text-sm">
                <strong>Interest saved by prepayment:</strong>{" "}
                <span class="font-mono text-unq-success">{fmt(result.interestSaved)}</span>
              </p>
            </Card>
          )}

          <Card class="!p-4">
            <div class="mb-3 flex flex-wrap items-center justify-between gap-3">
              <div class="flex items-center gap-3">
                <p class="text-sm font-semibold">Amortization schedule</p>
                <div class="flex gap-1 text-xs">
                  <button
                    class={`rounded-unq px-3 py-1 ${scheduleGrouping === "monthly" ? "bg-unq-primary text-unq-bg" : "border border-unq-border"}`}
                    onClick={() => setScheduleGrouping("monthly")}
                  >
                    Monthly
                  </button>
                  <button
                    class={`rounded-unq px-3 py-1 ${scheduleGrouping === "yearly" ? "bg-unq-primary text-unq-bg" : "border border-unq-border"}`}
                    onClick={() => setScheduleGrouping("yearly")}
                  >
                    Yearly
                  </button>
                </div>
              </div>
              <div class="flex gap-2">
                <CopyButton getText={() => csvText} label="Copy CSV" />
                <DownloadButton
                  filename={`amortization-${scheduleGrouping}.csv`}
                  getText={() => csvText}
                  mime="text/csv"
                  label="Download CSV"
                />
              </div>
            </div>

            <div class="max-h-[480px] overflow-auto">
              <table class="w-full text-xs">
                <thead class="sticky top-0 bg-unq-surface">
                  <tr class="border-b border-unq-border text-left text-unq-muted">
                    <th class="px-2 py-2">{scheduleGrouping === "monthly" ? "Month" : "Year"}</th>
                    <th class="px-2 py-2 text-right">EMI</th>
                    <th class="px-2 py-2 text-right">Interest</th>
                    <th class="px-2 py-2 text-right">Principal</th>
                    {showPrepayment && <th class="px-2 py-2 text-right">Prepayment</th>}
                    <th class="px-2 py-2 text-right">Balance</th>
                  </tr>
                </thead>
                <tbody>
                  {scheduleGrouping === "monthly"
                    ? result.schedule.map((r) => (
                        <tr key={r.month} class="border-unq-border/40 border-b">
                          <td class="px-2 py-1.5 font-mono">{r.month}</td>
                          <td class="px-2 py-1.5 text-right font-mono">{fmt(r.emi)}</td>
                          <td class="px-2 py-1.5 text-right font-mono text-unq-muted">
                            {fmt(r.interest)}
                          </td>
                          <td class="px-2 py-1.5 text-right font-mono">{fmt(r.principal)}</td>
                          {showPrepayment && (
                            <td class="px-2 py-1.5 text-right font-mono">
                              {r.prepayment > 0 ? fmt(r.prepayment) : "—"}
                            </td>
                          )}
                          <td class="px-2 py-1.5 text-right font-mono">{fmt(r.balance)}</td>
                        </tr>
                      ))
                    : (() => {
                        const rows: {
                          year: number;
                          emi: number;
                          interest: number;
                          principal: number;
                          prepayment: number;
                          balance: number;
                        }[] = [];
                        for (let i = 0; i < result.schedule.length; i += 12) {
                          const slice = result.schedule.slice(i, i + 12);
                          if (slice.length === 0) break;
                          rows.push({
                            year: Math.floor(i / 12) + 1,
                            emi: slice.reduce((s, r) => s + r.emi, 0),
                            interest: slice.reduce((s, r) => s + r.interest, 0),
                            principal: slice.reduce((s, r) => s + r.principal, 0),
                            prepayment: slice.reduce((s, r) => s + r.prepayment, 0),
                            balance: slice[slice.length - 1]!.balance,
                          });
                        }
                        return rows.map((r) => (
                          <tr key={r.year} class="border-unq-border/40 border-b">
                            <td class="px-2 py-1.5 font-mono">{r.year}</td>
                            <td class="px-2 py-1.5 text-right font-mono">{fmt(r.emi)}</td>
                            <td class="px-2 py-1.5 text-right font-mono text-unq-muted">
                              {fmt(r.interest)}
                            </td>
                            <td class="px-2 py-1.5 text-right font-mono">{fmt(r.principal)}</td>
                            {showPrepayment && (
                              <td class="px-2 py-1.5 text-right font-mono">
                                {r.prepayment > 0 ? fmt(r.prepayment) : "—"}
                              </td>
                            )}
                            <td class="px-2 py-1.5 text-right font-mono">{fmt(r.balance)}</td>
                          </tr>
                        ));
                      })()}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}

      <Card class="!p-4 text-xs text-unq-muted">
        <p>
          <strong>Privacy:</strong> all calculations happen locally in your browser. Nothing is
          uploaded. The standard EMI formula is used:{" "}
          <code>
            P·r·(1+r)<sup>n</sup> / ((1+r)<sup>n</sup> − 1)
          </code>
          .
        </p>
      </Card>
    </div>
  );
}
