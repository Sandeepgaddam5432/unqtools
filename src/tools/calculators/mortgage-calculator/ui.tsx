/**
 * Mortgage Calculator — Preact island UI.
 */
import { useMemo, useState } from "preact/hooks";
import {
  Input,
  Button,
  Card,
  Toggle,
  CopyButton,
  DownloadButton,
  ToastContainer,
  toast,
  ErrorBanner,
} from "../../../components/ui";
import {
  calculateMortgage,
  formatCurrency,
  mortgageScheduleToCsv,
  type MortgageInput,
} from "./logic";

export default function MortgageCalculator() {
  const [homePrice, setHomePrice] = useState<number>(400_000);
  const [downPaymentPct, setDownPaymentPct] = useState<number>(20);
  const [rate, setRate] = useState<number>(6.5);
  const [termYears, setTermYears] = useState<number>(30);
  const [propertyTaxAnnual, setPropertyTaxAnnual] = useState<number>(6_000);
  const [homeInsuranceAnnual, setHomeInsuranceAnnual] = useState<number>(1_200);
  const [hoaAnnual, setHoaAnnual] = useState<number>(0);
  const [pmiRatePct, setPmiRatePct] = useState<number>(0.5);
  const [extraMonthly, setExtraMonthly] = useState<number>(0);
  const [oneTimeExtraAmount, setOneTimeExtraAmount] = useState<number>(0);
  const [oneTimeExtraMonth, setOneTimeExtraMonth] = useState<number>(60);
  const [showAdvanced, setShowAdvanced] = useState<boolean>(false);
  const [scheduleGrouping, setScheduleGrouping] = useState<"monthly" | "yearly">("yearly");

  const input: MortgageInput = useMemo(
    () => ({
      homePrice,
      downPaymentPct,
      annualInterestRatePct: rate,
      termYears,
      propertyTaxAnnual,
      homeInsuranceAnnual,
      hoaAnnual,
      pmiRatePct,
      extraMonthly: extraMonthly > 0 ? extraMonthly : undefined,
      oneTimeExtra:
        showAdvanced && oneTimeExtraAmount > 0
          ? { month: oneTimeExtraMonth, amount: oneTimeExtraAmount }
          : undefined,
    }),
    [
      homePrice,
      downPaymentPct,
      rate,
      termYears,
      propertyTaxAnnual,
      homeInsuranceAnnual,
      hoaAnnual,
      pmiRatePct,
      extraMonthly,
      showAdvanced,
      oneTimeExtraAmount,
      oneTimeExtraMonth,
    ],
  );

  const result = useMemo(() => calculateMortgage(input), [input]);
  const fmt = (n: number) => formatCurrency(n, "en-US", "USD");

  function loadSample() {
    setHomePrice(450_000);
    setDownPaymentPct(10);
    setRate(6.875);
    setTermYears(30);
    setPropertyTaxAnnual(7_200);
    setHomeInsuranceAnnual(1_500);
    setHoaAnnual(600);
    setPmiRatePct(0.55);
    setExtraMonthly(150);
    setOneTimeExtraAmount(10_000);
    setOneTimeExtraMonth(60);
    setShowAdvanced(true);
    toast("Sample loaded", "info");
  }

  const csvText = useMemo(() => {
    if ("error" in result) return "";
    return mortgageScheduleToCsv(result.schedule, scheduleGrouping);
  }, [result, scheduleGrouping]);

  return (
    <div class="space-y-4">
      <ToastContainer />

      <Card class="!p-4">
        <div class="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Input
            id="mtg-price"
            label="Home price"
            type="number"
            min={0}
            step={1000}
            value={homePrice}
            onInput={(e) => setHomePrice(Number((e.currentTarget as HTMLInputElement).value))}
          />
          <Input
            id="mtg-down"
            label="Down payment (%)"
            type="number"
            min={0}
            max={100}
            step={1}
            value={downPaymentPct}
            onInput={(e) => setDownPaymentPct(Number((e.currentTarget as HTMLInputElement).value))}
            hint={homePrice > 0 ? `${fmt((homePrice * downPaymentPct) / 100)}` : ""}
          />
          <Input
            id="mtg-rate"
            label="Interest rate (% p.a.)"
            type="number"
            min={0}
            step={0.125}
            value={rate}
            onInput={(e) => setRate(Number((e.currentTarget as HTMLInputElement).value))}
          />
          <div>
            <label for="mtg-term" class="mb-1 block text-sm font-medium">
              Term
            </label>
            <select
              id="mtg-term"
              class="unq-input"
              value={termYears}
              onChange={(e) => setTermYears(Number((e.currentTarget as HTMLSelectElement).value))}
            >
              <option value={10}>10 years</option>
              <option value={15}>15 years</option>
              <option value={20}>20 years</option>
              <option value={25}>25 years</option>
              <option value={30}>30 years</option>
              <option value={40}>40 years</option>
            </select>
          </div>
          <Input
            id="mtg-tax"
            label="Property tax (annual)"
            type="number"
            min={0}
            step={100}
            value={propertyTaxAnnual}
            onInput={(e) =>
              setPropertyTaxAnnual(Number((e.currentTarget as HTMLInputElement).value))
            }
          />
          <Input
            id="mtg-ins"
            label="Home insurance (annual)"
            type="number"
            min={0}
            step={50}
            value={homeInsuranceAnnual}
            onInput={(e) =>
              setHomeInsuranceAnnual(Number((e.currentTarget as HTMLInputElement).value))
            }
          />
          <Input
            id="mtg-hoa"
            label="HOA (annual)"
            type="number"
            min={0}
            step={50}
            value={hoaAnnual}
            onInput={(e) => setHoaAnnual(Number((e.currentTarget as HTMLInputElement).value))}
          />
          <Input
            id="mtg-extra"
            label="Extra / month"
            type="number"
            min={0}
            step={50}
            value={extraMonthly}
            onInput={(e) => setExtraMonthly(Number((e.currentTarget as HTMLInputElement).value))}
            hint="Direct principal reduction"
          />
        </div>

        <div class="mt-3">
          <Toggle
            id="mtg-advanced"
            label="Show advanced (PMI rate, one-time extra)"
            checked={showAdvanced}
            onChange={setShowAdvanced}
          />
        </div>

        {showAdvanced && (
          <div class="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Input
              id="mtg-pmi"
              label="PMI rate (% of loan)"
              type="number"
              min={0}
              step={0.05}
              value={pmiRatePct}
              onInput={(e) => setPmiRatePct(Number((e.currentTarget as HTMLInputElement).value))}
              hint="Typical: 0.3%–1.5% annually"
            />
            <Input
              id="mtg-onetime-amt"
              label="One-time extra amount"
              type="number"
              min={0}
              step={1000}
              value={oneTimeExtraAmount}
              onInput={(e) =>
                setOneTimeExtraAmount(Number((e.currentTarget as HTMLInputElement).value))
              }
            />
            <Input
              id="mtg-onetime-mo"
              label="At month #"
              type="number"
              min={1}
              step={1}
              value={oneTimeExtraMonth}
              onInput={(e) =>
                setOneTimeExtraMonth(Number((e.currentTarget as HTMLInputElement).value))
              }
            />
          </div>
        )}

        <div class="mt-4 flex flex-wrap gap-2">
          <Button onClick={loadSample}>Load sample</Button>
          <Button
            variant="outline"
            onClick={() => {
              setHomePrice(0);
              setRate(0);
            }}
          >
            Clear
          </Button>
        </div>
      </Card>

      {"error" in result ? (
        <ErrorBanner message={result.error} />
      ) : (
        <>
          <div class="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Card class="!p-4 text-center">
              <p class="text-unq-muted text-xs uppercase tracking-wide">Loan Amount</p>
              <p class="mt-1 text-2xl font-bold tabular-nums">{fmt(result.loanAmount)}</p>
            </Card>
            <Card class="!p-4 text-center">
              <p class="text-unq-muted text-xs uppercase tracking-wide">Monthly P&I</p>
              <p class="mt-1 text-2xl font-bold tabular-nums">
                {fmt(result.monthlyBreakdown.principalAndInterest)}
              </p>
            </Card>
            <Card class="border-unq-accent/40 !p-4 text-center">
              <p class="text-unq-muted text-xs uppercase tracking-wide">Total Monthly</p>
              <p class="mt-1 text-2xl font-bold tabular-nums text-unq-accent">
                {fmt(result.monthlyBreakdown.total)}
              </p>
              <p class="text-unq-muted text-[10px]">P&I + tax + ins + PMI + HOA</p>
            </Card>
            <Card class="!p-4 text-center">
              <p class="text-unq-muted text-xs uppercase tracking-wide">Total Interest</p>
              <p class="mt-1 text-2xl font-bold tabular-nums">{fmt(result.totalInterest)}</p>
            </Card>
          </div>

          <Card class="!p-4">
            <p class="mb-3 text-sm font-semibold">PITI breakdown</p>
            <div class="space-y-2 text-sm">
              <div class="flex justify-between">
                <span>Principal & Interest</span>
                <span class="font-mono">{fmt(result.monthlyBreakdown.principalAndInterest)}</span>
              </div>
              <div class="flex justify-between">
                <span>Property tax</span>
                <span class="font-mono">{fmt(result.monthlyBreakdown.propertyTax)}</span>
              </div>
              <div class="flex justify-between">
                <span>Home insurance</span>
                <span class="font-mono">{fmt(result.monthlyBreakdown.homeInsurance)}</span>
              </div>
              <div class="flex justify-between">
                <span>PMI</span>
                <span class="font-mono">
                  {result.monthlyBreakdown.pmi > 0 ? fmt(result.monthlyBreakdown.pmi) : "—"}
                </span>
              </div>
              <div class="flex justify-between">
                <span>HOA</span>
                <span class="font-mono">
                  {result.monthlyBreakdown.hoa > 0 ? fmt(result.monthlyBreakdown.hoa) : "—"}
                </span>
              </div>
              <div class="flex justify-between border-t border-unq-border pt-2 font-semibold">
                <span>Total monthly</span>
                <span class="font-mono">{fmt(result.monthlyBreakdown.total)}</span>
              </div>
            </div>
          </Card>

          {(result.totalPmiPaid > 0 || result.interestSaved > 0) && (
            <Card class="border-unq-success/40 bg-unq-success/5 !p-4">
              {result.totalPmiPaid > 0 && (
                <p class="text-sm">
                  <strong>Total PMI paid:</strong>{" "}
                  <span class="font-mono">{fmt(result.totalPmiPaid)}</span>
                  {result.pmiDropMonth !== null && (
                    <span class="text-unq-muted ml-2">
                      (drops off at month {result.pmiDropMonth} — 78% LTV)
                    </span>
                  )}
                </p>
              )}
              {result.interestSaved > 0 && (
                <p class="mt-1 text-sm">
                  <strong>Extra payments save:</strong>{" "}
                  <span class="font-mono text-unq-success">{fmt(result.interestSaved)}</span>{" "}
                  interest and{" "}
                  <span class="font-mono text-unq-success">{result.monthsSaved} months</span> off
                  your loan.
                </p>
              )}
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
                  filename={`mortgage-amortization-${scheduleGrouping}.csv`}
                  getText={() => csvText}
                  mime="text/csv"
                  label="Download CSV"
                />
              </div>
            </div>

            <div
              class="max-h-[480px] overflow-auto"
              tabindex="0"
              role="region"
              aria-label="Amortization schedule table — scrollable"
            >
              <table class="w-full text-xs">
                <thead class="sticky top-0 bg-unq-surface">
                  <tr class="text-unq-muted border-b border-unq-border text-left">
                    <th class="px-2 py-2">{scheduleGrouping === "monthly" ? "Mo" : "Yr"}</th>
                    <th class="px-2 py-2 text-right">Interest</th>
                    <th class="px-2 py-2 text-right">Principal</th>
                    {showAdvanced && <th class="px-2 py-2 text-right">Extra</th>}
                    <th class="px-2 py-2 text-right">PMI</th>
                    <th class="px-2 py-2 text-right">Balance</th>
                    <th class="px-2 py-2 text-right">LTV</th>
                  </tr>
                </thead>
                <tbody>
                  {scheduleGrouping === "monthly"
                    ? result.schedule.map((r) => (
                        <tr key={r.month} class="border-unq-border/40 border-b">
                          <td class="px-2 py-1.5 font-mono">{r.month}</td>
                          <td class="text-unq-muted px-2 py-1.5 text-right font-mono">
                            {fmt(r.interest)}
                          </td>
                          <td class="px-2 py-1.5 text-right font-mono">{fmt(r.principal)}</td>
                          {showAdvanced && (
                            <td class="px-2 py-1.5 text-right font-mono">
                              {r.extra > 0 ? fmt(r.extra) : "—"}
                            </td>
                          )}
                          <td class="px-2 py-1.5 text-right font-mono">
                            {r.pmi > 0 ? fmt(r.pmi) : "—"}
                          </td>
                          <td class="px-2 py-1.5 text-right font-mono">{fmt(r.balance)}</td>
                          <td class="text-unq-muted px-2 py-1.5 text-right font-mono">{r.ltv}%</td>
                        </tr>
                      ))
                    : (() => {
                        const rows: {
                          year: number;
                          interest: number;
                          principal: number;
                          extra: number;
                          pmi: number;
                          balance: number;
                          ltv: number;
                        }[] = [];
                        for (let i = 0; i < result.schedule.length; i += 12) {
                          const slice = result.schedule.slice(i, i + 12);
                          if (slice.length === 0) break;
                          rows.push({
                            year: Math.floor(i / 12) + 1,
                            interest: slice.reduce((s, r) => s + r.interest, 0),
                            principal: slice.reduce((s, r) => s + r.principal, 0),
                            extra: slice.reduce((s, r) => s + r.extra, 0),
                            pmi: slice.reduce((s, r) => s + r.pmi, 0),
                            balance: slice[slice.length - 1]!.balance,
                            ltv: slice[slice.length - 1]!.ltv,
                          });
                        }
                        return rows.map((r) => (
                          <tr key={r.year} class="border-unq-border/40 border-b">
                            <td class="px-2 py-1.5 font-mono">{r.year}</td>
                            <td class="text-unq-muted px-2 py-1.5 text-right font-mono">
                              {fmt(r.interest)}
                            </td>
                            <td class="px-2 py-1.5 text-right font-mono">{fmt(r.principal)}</td>
                            {showAdvanced && (
                              <td class="px-2 py-1.5 text-right font-mono">
                                {r.extra > 0 ? fmt(r.extra) : "—"}
                              </td>
                            )}
                            <td class="px-2 py-1.5 text-right font-mono">
                              {r.pmi > 0 ? fmt(r.pmi) : "—"}
                            </td>
                            <td class="px-2 py-1.5 text-right font-mono">{fmt(r.balance)}</td>
                            <td class="text-unq-muted px-2 py-1.5 text-right font-mono">
                              {r.ltv}%
                            </td>
                          </tr>
                        ));
                      })()}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}

      <Card class="text-unq-muted !p-4 text-xs">
        <p>
          <strong>Privacy:</strong> all calculations happen locally in your browser. PMI
          auto-cancels at 78% LTV per the Homeowners Protection Act. This tool does not capture
          leads or contact info.
        </p>
      </Card>
    </div>
  );
}
