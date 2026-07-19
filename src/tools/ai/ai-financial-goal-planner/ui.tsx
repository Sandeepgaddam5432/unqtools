"use client";

import React, { useState, useMemo, useCallback, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  CopyButton,
  DownloadButton,
  EmptyState,
  ShareButton,
  ClearButton,
  RunButton,
} from "../../_shared";
import { toast } from "sonner";
import {
  GOAL_TYPE_LABELS,
  GOAL_TYPE_DESCRIPTIONS,
  GOAL_TYPE_DEFAULTS,
  CURRENCY_OPTIONS,
  CURRENCY_SYMBOLS,
  DEBT_STRATEGY_LABELS,
  GOAL_PRESETS,
  DEFAULT_INFLATION_RATE,
  round2,
  computeMonthlyContribution,
  buildRoadmap,
  compareScenarios,
  whatIfRate,
  formatCurrency,
  formatPercent,
  formatMonth,
  renderText,
  renderMarkdown,
  renderJson,
  renderCsv,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  makeId,
  type Goal,
  type DebtItem,
  type CurrencyCode,
  type DebtStrategy,
  type GoalType,
  type RoadmapPlan,
  type HistoryEntry,
} from "./logic";
import {
  PiggyBank, History, Plus, Trash2, Calculator,
  TrendingUp, AlertTriangle, CheckCircle2, Sparkles,
} from "lucide-react";

export default function AiFinancialGoalPlanner() {
  const [currency, setCurrency] = useState<CurrencyCode>("USD");
  const [strategy, setStrategy] = useState<DebtStrategy>("avalanche");
  const [inflationRate, setInflationRate] = useState(DEFAULT_INFLATION_RATE);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [debts, setDebts] = useState<DebtItem[]>([]);
  const [plan, setPlan] = useState<RoadmapPlan | null>(null);
  const [scenarioB, setScenarioB] = useState<RoadmapPlan | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [whatIfRateVal, setWhatIfRateVal] = useState(0.05);
  const [showWhatIf, setShowWhatIf] = useState(false);

  useEffect(() => {
    setHistory(loadHistory());
    if (typeof window !== "undefined" && window.location.hash) {
      const s = parseShareUrl(window.location.hash);
      if (s) {
        setCurrency(s.currency);
        setStrategy(s.strategy);
        setInflationRate(s.inflationRate);
        if (s.goals.length > 0) {
          setGoals(s.goals.map((g, i) => ({ ...g, id: makeId("goal"), priority: i + 1 })));
        }
        if (s.debts.length > 0) {
          setDebts(s.debts.map((d) => ({ ...d, id: makeId("debt") })));
        }
        toast.info("Loaded from share link");
      }
    }
  }, []);

  const symbol = CURRENCY_SYMBOLS[currency];

  const addGoalFromPreset = useCallback((presetIndex: number) => {
    const preset = GOAL_PRESETS[presetIndex];
    setGoals((prev) => [
      ...prev,
      { ...preset, id: makeId("goal"), priority: prev.length + 1 },
    ]);
    toast.success(`Added ${preset.name}`);
  }, []);

  const addBlankGoal = useCallback(() => {
    setGoals((prev) => [
      ...prev,
      {
        id: makeId("goal"),
        type: "custom",
        name: `Goal ${prev.length + 1}`,
        targetAmount: 10000,
        currentAmount: 0,
        timelineMonths: 24,
        annualReturnRate: 0.04,
        priority: prev.length + 1,
      },
    ]);
  }, []);

  const updateGoal = useCallback((id: string, patch: Partial<Goal>) => {
    setGoals((prev) => prev.map((g) => (g.id === id ? { ...g, ...patch } : g)));
  }, []);

  const removeGoal = useCallback((id: string) => {
    setGoals((prev) => prev.filter((g) => g.id !== id).map((g, i) => ({ ...g, priority: i + 1 })));
  }, []);

  const moveGoal = useCallback((id: string, dir: -1 | 1) => {
    setGoals((prev) => {
      const idx = prev.findIndex((g) => g.id === id);
      if (idx < 0) return prev;
      const newIdx = idx + dir;
      if (newIdx < 0 || newIdx >= prev.length) return prev;
      const next = [...prev];
      const [g] = next.splice(idx, 1);
      next.splice(newIdx, 0, g);
      return next.map((g2, i) => ({ ...g2, priority: i + 1 }));
    });
  }, []);

  const addDebt = useCallback(() => {
    setDebts((prev) => [
      ...prev,
      {
        id: makeId("debt"),
        name: `Debt ${prev.length + 1}`,
        balance: 5000,
        interestRate: 18,
        minimumPayment: 150,
      },
    ]);
  }, []);

  const updateDebt = useCallback((id: string, patch: Partial<DebtItem>) => {
    setDebts((prev) => prev.map((d) => (d.id === id ? { ...d, ...patch } : d)));
  }, []);

  const removeDebt = useCallback((id: string) => {
    setDebts((prev) => prev.filter((d) => d.id !== id));
  }, []);

  const handleGenerate = useCallback(() => {
    if (goals.length === 0) {
      toast.error("Add at least one goal first");
      return;
    }
    const p = buildRoadmap(goals, debts, strategy, currency, inflationRate);
    setPlan(p);
    setScenarioB(null);
    saveHistory({
      ts: Date.now(),
      goalCount: goals.length,
      totalMonthly: p.totalMonthlyContribution,
      totalTarget: goals.reduce((s, g) => s + g.targetAmount, 0),
      currency,
      label: goals.map((g) => g.name).join(", "),
    });
    setHistory(loadHistory());
    toast.success(`Roadmap built — ${formatCurrency(p.totalMonthlyContribution, currency)}/mo`);
  }, [goals, debts, strategy, currency, inflationRate]);

  const handleScenarioB = useCallback(() => {
    if (!plan) return;
    // Variant: switch debt strategy if debts exist
    const newStrat: DebtStrategy = strategy === "avalanche" ? "snowball" : "avalanche";
    const b = buildRoadmap(goals, debts, newStrat, currency, inflationRate);
    setScenarioB(b);
    const cmp = compareScenarios(plan, b);
    toast.success(`Scenario B built — winner: ${cmp.winner.toUpperCase()}`);
  }, [plan, goals, debts, strategy, currency, inflationRate]);

  const handleClear = useCallback(() => {
    setGoals([]);
    setDebts([]);
    setPlan(null);
    setScenarioB(null);
    toast.info("Cleared");
  }, []);

  const handleClearHistory = useCallback(() => {
    clearHistory();
    setHistory([]);
    toast.success("History cleared");
  }, []);

  const whatIfContrib = useMemo(() => {
    if (goals.length === 0) return 0;
    return round2(goals.reduce((s, g) => s + whatIfRate(g, whatIfRateVal), 0));
  }, [goals, whatIfRateVal]);

  return (
    <div className="space-y-4 unq-animate-fade-in-up">
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1">
              <Label htmlFor="fgp-currency" className="text-xs">Currency</Label>
              <select
                id="fgp-currency"
                value={currency}
                onChange={(e) => setCurrency(e.target.value as CurrencyCode)}
                className="h-9 w-full text-sm rounded border bg-background px-2"
              >
                {CURRENCY_OPTIONS.map((c) => (
                  <option key={c.code} value={c.code}>{c.symbol} {c.code} — {c.label}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="fgp-strategy" className="text-xs">Debt strategy</Label>
              <select
                id="fgp-strategy"
                value={strategy}
                onChange={(e) => setStrategy(e.target.value as DebtStrategy)}
                className="h-9 w-full text-sm rounded border bg-background px-2"
              >
                {(Object.keys(DEBT_STRATEGY_LABELS) as DebtStrategy[]).map((s) => (
                  <option key={s} value={s}>{DEBT_STRATEGY_LABELS[s]}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="fgp-inflation" className="text-xs">Inflation rate: {formatPercent(inflationRate, 1)}</Label>
              <Input
                id="fgp-inflation"
                type="number"
                step="0.005"
                min="0"
                max="0.2"
                value={inflationRate}
                onChange={(e) => setInflationRate(Number(e.target.value) || 0)}
                className="h-9 text-sm"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
              <PiggyBank className="h-4 w-4" /> Goals ({goals.length})
            </h3>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={addBlankGoal} className="gap-1">
                <Plus className="h-3.5 w-3.5" /> Blank goal
              </Button>
            </div>
          </div>
          <div className="flex flex-wrap gap-1">
            {GOAL_PRESETS.map((p, i) => (
              <Button key={i} variant="ghost" size="sm" className="h-6 text-[11px]" onClick={() => addGoalFromPreset(i)}>
                + {p.name}
              </Button>
            ))}
          </div>
          {goals.length === 0 ? (
            <EmptyState
              title="Add goals to start your roadmap"
              hint="Click a preset above or add a blank goal. Each goal needs a target amount, current savings, timeline (months), and an assumed annual return rate."
              icon={<PiggyBank className="h-8 w-8" />}
            />
          ) : (
            <div className="space-y-3">
              {goals.map((g, idx) => (
                <GoalRow
                  key={g.id}
                  goal={g}
                  idx={idx}
                  total={goals.length}
                  symbol={symbol}
                  onChange={(patch) => updateGoal(g.id, patch)}
                  onRemove={() => removeGoal(g.id)}
                  onMove={(d) => moveGoal(g.id, d)}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
              <TrendingUp className="h-4 w-4" /> Debts ({debts.length}) — optional
            </h3>
            <Button variant="outline" size="sm" onClick={addDebt} className="gap-1">
              <Plus className="h-3.5 w-3.5" /> Add debt
            </Button>
          </div>
          {debts.length === 0 ? (
            <p className="text-xs text-muted-foreground">No debts. Add credit cards, loans, or other debts to generate a snowball/avalanche payoff schedule.</p>
          ) : (
            <div className="space-y-3">
              {debts.map((d) => (
                <DebtRow
                  key={d.id}
                  debt={d}
                  symbol={symbol}
                  onChange={(patch) => updateDebt(d.id, patch)}
                  onRemove={() => removeDebt(d.id)}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex flex-wrap gap-2 items-center">
            <RunButton onClick={handleGenerate} label="Build roadmap" disabled={goals.length === 0} />
            {plan && debts.length > 0 && (
              <Button variant="outline" size="sm" onClick={handleScenarioB} className="gap-1">
                <Sparkles className="h-3.5 w-3.5" /> Compare scenario B
              </Button>
            )}
            <CopyButton
              getText={() => { if (!plan) return ""; return renderText(plan); }}
              label="Copy text"
              disabled={!plan}
            />
            <DownloadButton
              getText={() => { if (!plan) return ""; return renderMarkdown(plan); }}
              filename="financial-roadmap.md"
              mime="text/markdown"
              label="Download .md"
              disabled={!plan}
            />
            <DownloadButton
              getText={() => { if (!plan) return ""; return renderJson(plan); }}
              filename="financial-roadmap.json"
              mime="application/json"
              label="Download JSON"
              disabled={!plan}
            />
            <DownloadButton
              getText={() => { if (!plan) return ""; return renderCsv(plan); }}
              filename="financial-goals.csv"
              mime="text/csv"
              label="Download CSV"
              disabled={!plan}
            />
            <ShareButton
              getUrl={() => buildShareUrl({
                currency, strategy, inflationRate,
                goals: goals.map(({ id: _id, priority: _p, ...rest }) => rest),
                debts: debts.map(({ id: _id, ...rest }) => rest),
              })}
              disabled={goals.length === 0}
            />
            <ClearButton onClick={handleClear} disabled={goals.length === 0 && debts.length === 0} />
          </div>
        </CardContent>
      </Card>

      {plan && (
        <>
          <Card>
            <CardContent className="p-4 space-y-2">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <Calculator className="h-4 w-4" /> Roadmap Summary
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                <Stat label="Monthly total" value={formatCurrency(plan.totalMonthlyContribution, currency)} highlight="good" />
                <Stat label="Total contributions" value={formatCurrency(plan.totalContributed, currency)} />
                <Stat label="Projected interest" value={formatCurrency(plan.totalInterest, currency)} highlight="good" />
                <Stat label="Goals" value={plan.goals.length} />
              </div>
              {plan.debtPlan && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs pt-2">
                  <Stat label="Total debt" value={formatCurrency(plan.debtPlan.totalDebt, currency)} highlight="bad" />
                  <Stat label="Debt interest" value={formatCurrency(plan.debtPlan.totalInterest, currency)} highlight="bad" />
                  <Stat label="Payoff time" value={formatMonth(plan.debtPlan.payoffMonths)} />
                  <Stat label="Strategy" value={plan.debtPlan.strategy} />
                </div>
              )}
            </CardContent>
          </Card>

          {scenarioB && (
            <Card>
              <CardContent className="p-4 space-y-2">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                  <Sparkles className="h-4 w-4" /> Scenario Compare
                </h3>
                {(() => {
                  const cmp = compareScenarios(plan, scenarioB);
                  return (
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                      <Stat label="A: Monthly" value={formatCurrency(plan.totalMonthlyContribution, currency)} highlight={cmp.winner === "a" ? "good" : undefined} />
                      <Stat label="B: Monthly" value={formatCurrency(scenarioB.totalMonthlyContribution, currency)} highlight={cmp.winner === "b" ? "good" : undefined} />
                      <Stat label="Δ Monthly" value={formatCurrency(cmp.deltaMonthly, currency)} />
                      <Stat label="Winner" value={cmp.winner.toUpperCase()} highlight="good" />
                    </div>
                  );
                })()}
              </CardContent>
            </Card>
          )}

          <Card>
            <CardContent className="p-4 space-y-2">
              <button
                className="text-sm font-semibold text-foreground flex items-center gap-1.5 w-full text-left"
                onClick={() => setShowWhatIf((s) => !s)}
              >
                <TrendingUp className="h-4 w-4" /> What-if sliders {showWhatIf ? "▾" : "▸"}
              </button>
              {showWhatIf && (
                <div className="space-y-2 pt-2">
                  <Label htmlFor="fgp-wi-rate" className="text-xs">
                    Annual return rate: {formatPercent(whatIfRateVal, 2)}
                  </Label>
                  <Input
                    id="fgp-wi-rate"
                    type="range"
                    min="0"
                    max="0.15"
                    step="0.005"
                    value={whatIfRateVal}
                    onChange={(e) => setWhatIfRateVal(Number(e.target.value))}
                    className="w-full"
                  />
                  <div className="text-xs">
                    Total monthly contribution at {formatPercent(whatIfRateVal, 2)}:{" "}
                    <strong className="text-foreground">{formatCurrency(whatIfContrib, currency)}</strong>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 space-y-3">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <PiggyBank className="h-4 w-4" /> Goals (in priority order)
              </h3>
              {plan.goals.map((p) => (
                <div key={p.goal.id} className="rounded border bg-background p-3 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className="text-[10px]">{GOAL_TYPE_LABELS[p.goal.type]}</Badge>
                      <span className="font-medium text-foreground text-sm">{p.goal.name}</span>
                    </div>
                    <Badge variant={p.isAchievable ? "default" : "destructive"} className="text-[10px]">
                      {p.isAchievable ? (
                        <><CheckCircle2 className="h-3 w-3 mr-1" /> Achievable</>
                      ) : (
                        <><AlertTriangle className="h-3 w-3 mr-1" /> Shortfall: {formatCurrency(p.shortfall, currency)}</>
                      )}
                    </Badge>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                    <Stat label="Target" value={formatCurrency(p.goal.targetAmount, currency)} />
                    <Stat label="Current" value={formatCurrency(p.goal.currentAmount, currency)} />
                    <Stat label="Timeline" value={formatMonth(p.goal.timelineMonths)} />
                    <Stat label="Rate" value={formatPercent(p.goal.annualReturnRate)} />
                    <Stat label="Monthly" value={formatCurrency(p.monthlyContribution, currency)} highlight="good" />
                    <Stat label="Final balance" value={formatCurrency(p.finalBalance, currency)} />
                    <Stat label="Interest earned" value={formatCurrency(p.totalInterest, currency)} highlight="good" />
                    <Stat label="New contributions" value={formatCurrency(p.totalContributed - p.goal.currentAmount, currency)} />
                  </div>
                  {p.warnings.length > 0 && (
                    <div className="text-xs space-y-1">
                      {p.warnings.map((w, i) => (
                        <div key={i} className="flex items-start gap-1.5 text-amber-600 dark:text-amber-400">
                          <AlertTriangle className="h-3 w-3 flex-shrink-0 mt-0.5" />
                          <span>{w}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="text-[10px] text-muted-foreground font-mono bg-muted/40 rounded p-1.5">
                    Formula: {p.formula}
                  </div>
                  {p.milestones.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {p.milestones.map((m, i) => (
                        <Badge key={i} variant="outline" className="text-[10px]">
                          Month {m.month}: {m.label} ({formatCurrency(m.targetCumulative, currency)})
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>

          {plan.debtPlan && plan.debtPlan.schedule.length > 0 && (
            <Card>
              <CardContent className="p-4 space-y-2">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                  <TrendingUp className="h-4 w-4" /> Debt Payoff Schedule — {DEBT_STRATEGY_LABELS[plan.debtPlan.strategy]}
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                  <Stat label="Total debt" value={formatCurrency(plan.debtPlan.totalDebt, currency)} />
                  <Stat label="Interest paid" value={formatCurrency(plan.debtPlan.totalInterest, currency)} highlight="bad" />
                  <Stat label="Total paid" value={formatCurrency(plan.debtPlan.totalPaid, currency)} />
                  <Stat label="Payoff time" value={formatMonth(plan.debtPlan.payoffMonths)} />
                </div>
                <div className="max-h-[300px] overflow-auto rounded border">
                  <table className="w-full text-[11px]">
                    <thead className="bg-muted/50 sticky top-0">
                      <tr>
                        <th className="text-left p-1.5">Month</th>
                        <th className="text-left p-1.5">Debt</th>
                        <th className="text-right p-1.5">Payment</th>
                        <th className="text-right p-1.5">Interest</th>
                        <th className="text-right p-1.5">Principal</th>
                        <th className="text-right p-1.5">Balance</th>
                      </tr>
                    </thead>
                    <tbody>
                      {plan.debtPlan.schedule.slice(0, 100).map((r, i) => (
                        <tr key={i} className="border-t">
                          <td className="p-1.5">{r.month}</td>
                          <td className="p-1.5">{r.debtName}</td>
                          <td className="p-1.5 text-right">{formatCurrency(r.payment, currency)}</td>
                          <td className="p-1.5 text-right text-amber-600 dark:text-amber-400">{formatCurrency(r.interest, currency)}</td>
                          <td className="p-1.5 text-right">{formatCurrency(r.principal, currency)}</td>
                          <td className="p-1.5 text-right">{formatCurrency(r.balanceAfter, currency)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {plan.debtPlan.schedule.length > 100 && (
                    <p className="text-[10px] text-muted-foreground p-1.5">Showing first 100 rows. Download full plan as JSON.</p>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}

      {history.length > 0 && (
        <Card>
          <CardContent className="p-4 space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <History className="h-4 w-4" /> Recent ({history.length})
              </h3>
              <Button variant="ghost" size="sm" onClick={handleClearHistory}>Clear</Button>
            </div>
            <div className="space-y-1">
              {history.slice(0, 5).map((h, i) => (
                <div key={i} className="rounded border bg-background px-3 py-2 text-xs">
                  <Badge variant="outline" className="mr-2">{h.goalCount} goals</Badge>
                  <Badge variant="outline" className="mr-2">{formatCurrency(h.totalMonthly, h.currency)}/mo</Badge>
                  <span className="text-muted-foreground">{h.label}</span>
                  <span className="text-muted-foreground ml-2">· {new Date(h.ts).toLocaleString()}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-3 space-y-1">
          <p className="text-xs text-muted-foreground">
            <strong className="text-foreground">Privacy:</strong> All math runs locally in your browser. No bank linking, no sign-up, no upload. Saved plans live in this device's localStorage.
          </p>
          <p className="text-xs text-amber-600 dark:text-amber-400">
            <strong>Disclaimer:</strong> Educational tool only. Not financial, investment, or tax advice. Projections use assumptions that may not hold. Consult a licensed professional.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function GoalRow({
  goal,
  idx,
  total,
  symbol,
  onChange,
  onRemove,
  onMove,
}: {
  goal: Goal;
  idx: number;
  total: number;
  symbol: string;
  onChange: (patch: Partial<Goal>) => void;
  onRemove: () => void;
  onMove: (dir: -1 | 1) => void;
}) {
  return (
    <div className="rounded border bg-background p-3 space-y-2">
      <div className="flex items-center gap-2">
        <Badge variant="secondary" className="text-[10px]">#{idx + 1}</Badge>
        <select
          value={goal.type}
          onChange={(e) => {
            const t = e.target.value as GoalType;
            const def = GOAL_TYPE_DEFAULTS[t];
            onChange({ type: t, targetAmount: def.targetAmount, timelineMonths: def.timelineMonths, annualReturnRate: def.annualReturnRate });
          }}
          className="h-7 text-xs rounded border bg-background px-2"
        >
          {(Object.keys(GOAL_TYPE_LABELS) as GoalType[]).map((t) => (
            <option key={t} value={t}>{GOAL_TYPE_LABELS[t]}</option>
          ))}
        </select>
        <Input
          value={goal.name}
          onChange={(e) => onChange({ name: e.target.value })}
          className="h-7 text-sm flex-1"
          placeholder="Goal name"
        />
        <Button variant="ghost" size="icon" onClick={() => onMove(-1)} disabled={idx === 0}>↑</Button>
        <Button variant="ghost" size="icon" onClick={() => onMove(1)} disabled={idx === total - 1}>↓</Button>
        <Button variant="ghost" size="icon" onClick={onRemove}><Trash2 className="h-3.5 w-3.5" /></Button>
      </div>
      <p className="text-[10px] text-muted-foreground">{GOAL_TYPE_DESCRIPTIONS[goal.type]}</p>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
        <div className="space-y-0.5">
          <Label className="text-[10px]">Target ({symbol})</Label>
          <Input
            type="number"
            min="0"
            value={goal.targetAmount}
            onChange={(e) => onChange({ targetAmount: Number(e.target.value) || 0 })}
            className="h-7 text-xs"
          />
        </div>
        <div className="space-y-0.5">
          <Label className="text-[10px]">Current ({symbol})</Label>
          <Input
            type="number"
            min="0"
            value={goal.currentAmount}
            onChange={(e) => onChange({ currentAmount: Number(e.target.value) || 0 })}
            className="h-7 text-xs"
          />
        </div>
        <div className="space-y-0.5">
          <Label className="text-[10px]">Timeline (months)</Label>
          <Input
            type="number"
            min="1"
            value={goal.timelineMonths}
            onChange={(e) => onChange({ timelineMonths: Number(e.target.value) || 1 })}
            className="h-7 text-xs"
          />
        </div>
        <div className="space-y-0.5">
          <Label className="text-[10px]">Annual rate</Label>
          <Input
            type="number"
            step="0.005"
            min="0"
            max="0.5"
            value={goal.annualReturnRate}
            onChange={(e) => onChange({ annualReturnRate: Number(e.target.value) || 0 })}
            className="h-7 text-xs"
          />
        </div>
      </div>
      <GoalPreview goal={goal} symbol={symbol} />
    </div>
  );
}

function GoalPreview({ goal, symbol }: { goal: Goal; symbol: string }) {
  const monthly = computeMonthlyContribution(goal.targetAmount, goal.currentAmount, goal.timelineMonths, goal.annualReturnRate);
  return (
    <div className="text-[10px] text-muted-foreground">
      Required monthly: <strong className="text-foreground">{symbol}{round2(monthly).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>
    </div>
  );
}

function DebtRow({
  debt,
  symbol,
  onChange,
  onRemove,
}: {
  debt: DebtItem;
  symbol: string;
  onChange: (patch: Partial<DebtItem>) => void;
  onRemove: () => void;
}) {
  return (
    <div className="rounded border bg-background p-3 space-y-2">
      <div className="flex items-center gap-2">
        <Input
          value={debt.name}
          onChange={(e) => onChange({ name: e.target.value })}
          className="h-7 text-sm flex-1"
          placeholder="Debt name"
        />
        <Button variant="ghost" size="icon" onClick={onRemove}><Trash2 className="h-3.5 w-3.5" /></Button>
      </div>
      <div className="grid grid-cols-3 gap-2 text-xs">
        <div className="space-y-0.5">
          <Label className="text-[10px]">Balance ({symbol})</Label>
          <Input
            type="number"
            min="0"
            value={debt.balance}
            onChange={(e) => onChange({ balance: Number(e.target.value) || 0 })}
            className="h-7 text-xs"
          />
        </div>
        <div className="space-y-0.5">
          <Label className="text-[10px]">Interest rate (%)</Label>
          <Input
            type="number"
            step="0.1"
            min="0"
            max="100"
            value={debt.interestRate}
            onChange={(e) => onChange({ interestRate: Number(e.target.value) || 0 })}
            className="h-7 text-xs"
          />
        </div>
        <div className="space-y-0.5">
          <Label className="text-[10px]">Min payment ({symbol})</Label>
          <Input
            type="number"
            min="0"
            value={debt.minimumPayment}
            onChange={(e) => onChange({ minimumPayment: Number(e.target.value) || 0 })}
            className="h-7 text-xs"
          />
        </div>
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string | number;
  highlight?: "bad" | "good";
}) {
  const color = highlight === "bad"
    ? "text-red-600 dark:text-red-400"
    : highlight === "good"
      ? "text-emerald-600 dark:text-emerald-400"
      : "text-foreground";
  return (
    <div className="rounded border bg-background px-3 py-2">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className={`text-base font-semibold ${color}`}>{value}</div>
    </div>
  );
}
