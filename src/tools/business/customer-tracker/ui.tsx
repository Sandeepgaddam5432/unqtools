"use client";

import React, { useState, useMemo, useCallback, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  CopyButton,
  DownloadButton,
  EmptyState,
  ShareButton,
  ClearButton,
} from "../../_shared";
import { toast } from "sonner";
import {
  STATUS_PRESETS,
  STATUS_LABELS,
  STATUS_FILTER_OPTIONS,
  CURRENCY_PRESETS,
  DEFAULT_INPUT,
  parseCustomers,
  applyFilters,
  computeStatusBreakdown,
  computeFollowupPriority,
  summaryStats,
  computeDaysSinceLastContact,
  computeUrgency,
  formatMoney,
  formatDays,
  renderText,
  renderCsv,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  type Status,
  type StatusFilter,
  type Urgency,
  type CustomerInput,
  type HistoryEntry,
} from "./logic";
import {
  Users,
  History,
  FileText,
  AlertCircle,
  AlertTriangle,
  Trophy,
  Filter,
  Clock,
} from "lucide-react";

const SAMPLE_CUSTOMERS = `Alice,alice@acme.com,+1-555-0100,Acme Corp,2026-07-10,active,5000
Bob,bob@beta.com,(555) 222-3344,Beta LLC,2026-06-01,lead,2500
Carol,carol@gamma.com,555-333-4455,Gamma Inc,,prospect,
Dave,dave@delta.com,1-555-444-5566,Delta Co,2026-05-15,active,7500
Eve,eve@epsilon.com,5556667788,Epsilon LLC,2026-04-01,churned,10000
Frank,frank@zeta.com,555-777-8899,Zeta Inc,2026-07-20,inactive,3000`;

export default function CustomerTracker() {
  const [customersText, setCustomersText] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [daysSinceContact, setDaysSinceContact] = useState("");
  const [currencySymbol, setCurrencySymbol] = useState(DEFAULT_INPUT.currencySymbol);
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  // today's date for days-since calculation (computed once on mount)
  const [today, setToday] = useState("");
  useEffect(() => {
    setToday(new Date().toISOString().slice(0, 10));
  }, []);

  useEffect(() => {
    setHistory(loadHistory());
    if (typeof window !== "undefined" && window.location.hash) {
      const p = parseShareUrl(window.location.hash);
      if (p.customersText) setCustomersText(p.customersText);
      if (p.statusFilter) setStatusFilter(p.statusFilter);
      if (p.daysSinceContact) setDaysSinceContact(p.daysSinceContact);
      if (p.currencySymbol) setCurrencySymbol(p.currencySymbol);
      if (p.customersText || p.daysSinceContact) toast.info("Loaded from share link");
    }
  }, []);

  const input: CustomerInput = useMemo(
    () => ({
      customersText,
      statusFilter,
      daysSinceContact,
      currencySymbol,
      today,
    }),
    [customersText, statusFilter, daysSinceContact, currencySymbol, today],
  );

  const parsed = useMemo(() => parseCustomers(customersText), [customersText]);
  const filtered = useMemo(
    () => applyFilters(parsed.customers, statusFilter, daysSinceContact, today),
    [parsed.customers, statusFilter, daysSinceContact, today],
  );
  const breakdown = useMemo(() => computeStatusBreakdown(filtered), [filtered]);
  const stats = useMemo(
    () => summaryStats(filtered, daysSinceContact, today),
    [filtered, daysSinceContact, today],
  );
  const priority = useMemo(() => computeFollowupPriority(filtered, today), [filtered, today]);
  const topCustomers = useMemo(
    () => [...filtered].sort((a, b) => b.value - a.value).slice(0, 5),
    [filtered],
  );
  const text = useMemo(() => renderText(input, filtered), [input, filtered]);
  const csv = useMemo(() => renderCsv(filtered, today), [filtered, today]);

  const handleSaveHistory = useCallback(() => {
    if (parsed.customers.length > 0) {
      saveHistory({
        ts: Date.now(),
        customersText,
        customerCount: parsed.customers.length,
        totalValue: stats.totalValue,
        averageValue: stats.averageValue,
        overdueCount: stats.overdueCount,
        currencySymbol,
      });
      setHistory(loadHistory());
    }
  }, [customersText, parsed.customers.length, stats.totalValue, stats.averageValue, stats.overdueCount, currencySymbol]);

  const handleClear = useCallback(() => {
    setCustomersText("");
    setStatusFilter("all");
    setDaysSinceContact("");
    setCurrencySymbol(DEFAULT_INPUT.currencySymbol);
    toast.info("Cleared");
  }, []);

  const handleClearHistory = useCallback(() => {
    clearHistory();
    setHistory([]);
    toast.success("History cleared");
  }, []);

  const appendStatusRow = (status: Status) => {
    setCustomersText((prev) => {
      const line = `New ${STATUS_LABELS[status]},new.${status}@example.com,555-010-0000,New Co,${today},${status},1000`;
      return prev ? `${prev}\n${line}` : line;
    });
  };

  const urgencyColor = (u: Urgency): string => {
    switch (u) {
      case "urgent": return "text-red-600 dark:text-red-400";
      case "normal": return "text-amber-600 dark:text-amber-400";
      case "recent": return "text-emerald-600 dark:text-emerald-400";
      default: return "text-muted-foreground";
    }
  };

  const urgencyBadgeVariant: Record<Urgency, "secondary" | "outline" | "destructive" | "default"> = {
    urgent: "destructive",
    normal: "secondary",
    recent: "default",
    none: "outline",
  };

  return (
    <div className="space-y-4 unq-animate-fade-in-up">
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="ct-customers">
                Customers (one per line: name,email,phone,company,last_contact_date,status,value)
              </Label>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-[11px]"
                onClick={() => setCustomersText(SAMPLE_CUSTOMERS)}
              >
                Load sample
              </Button>
            </div>
            <Textarea
              id="ct-customers"
              value={customersText}
              onChange={(e) => setCustomersText(e.target.value)}
              placeholder={SAMPLE_CUSTOMERS}
              className="min-h-[160px] resize-y font-mono text-xs"
            />
            <p className="text-[10px] text-muted-foreground">
              Format: <code>name,email,phone,company,last_contact_date,status,value</code>.
              Statuses: <code>active, inactive, lead, churned, prospect</code>.
              Date is <code>YYYY-MM-DD</code>. Value defaults to 0, status defaults to <code>lead</code>.
              Wrap fields with commas in double quotes. Lines starting with <code>#</code> are ignored.
            </p>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Status presets (click to append a starter row)</Label>
            <div className="flex flex-wrap gap-1">
              {STATUS_PRESETS.map((p) => (
                <Button
                  key={p.status}
                  variant="ghost"
                  size="sm"
                  className="h-7 text-[11px]"
                  onClick={() => appendStatusRow(p.status)}
                >
                  + {p.label}
                </Button>
              ))}
            </div>
          </div>

          <div className="grid sm:grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="ct-status" className="text-xs">Status filter</Label>
              <select
                id="ct-status"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
                className="h-9 w-full text-sm rounded border bg-background px-2"
              >
                {STATUS_FILTER_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ct-days" className="text-xs">Days since contact ≥ (optional)</Label>
              <Input
                id="ct-days"
                type="number"
                min={0}
                value={daysSinceContact}
                onChange={(e) => setDaysSinceContact(e.target.value)}
                placeholder="e.g. 30 — show overdue"
                className="h-9 text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ct-cur" className="text-xs">Currency</Label>
              <select
                id="ct-cur"
                value={currencySymbol}
                onChange={(e) => setCurrencySymbol(e.target.value)}
                className="h-9 w-full text-sm rounded border bg-background px-2"
              >
                {CURRENCY_PRESETS.map((c) => (
                  <option key={c.code} value={c.symbol}>{c.label}</option>
                ))}
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      {parsed.errors.length > 0 && (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 space-y-1">
          <div className="flex items-center gap-2 text-sm text-amber-700 dark:text-amber-300">
            <AlertCircle className="h-4 w-4" />
            <span>{parsed.errors.length} line(s) had issues (valid rows still processed)</span>
          </div>
          <ul className="list-disc list-inside text-xs text-amber-700 dark:text-amber-300 space-y-0.5 max-h-[120px] overflow-auto">
            {parsed.errors.map((e, i) => <li key={i}>{e}</li>)}
          </ul>
        </div>
      )}

      {filtered.length > 0 ? (
        <>
          <Card>
            <CardContent className="p-4 space-y-2">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <Users className="h-4 w-4" /> Customer Summary
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                <Stat label="Total customers" value={String(stats.totalCustomers)} />
                <Stat label="Total value" value={formatMoney(stats.totalValue, currencySymbol)} highlight="good" />
                <Stat label="Average value" value={formatMoney(stats.averageValue, currencySymbol)} />
                {daysSinceContact ? (
                  <Stat label={`Overdue (≥ ${daysSinceContact}d)`} value={String(stats.overdueCount)} highlight={stats.overdueCount > 0 ? "bad" : "good"} />
                ) : (
                  <Stat label="Urgent (>30d)" value={String(stats.urgentCount)} highlight={stats.urgentCount > 0 ? "bad" : "good"} />
                )}
                <Stat label="Normal (14-30d)" value={String(stats.normalCount)} />
                <Stat label="Recent (<14d)" value={String(stats.recentCount)} highlight="good" />
                <Stat label="No contact date" value={String(stats.noContactCount)} highlight={stats.noContactCount > 0 ? "bad" : undefined} />
                {stats.topCustomer && (
                  <Stat label="Top customer" value={`${stats.topCustomer.name} (${formatMoney(stats.topCustomer.value, currencySymbol)})`} />
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 space-y-2">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <Filter className="h-4 w-4" /> Status Breakdown
              </h3>
              <div className="space-y-1">
                {breakdown.map((row) => (
                  <div
                    key={row.status}
                    className={`rounded border bg-background px-3 py-2 text-xs ${row.count === 0 ? "opacity-50" : ""}`}
                  >
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`font-medium ${STATUS_PRESETS.find((p) => p.status === row.status)?.color ?? "text-foreground"}`}>{row.label}</span>
                      <Badge variant="secondary" className="text-[10px]">{row.count} customers</Badge>
                      <span className="ml-auto font-mono font-semibold text-foreground">
                        {formatMoney(row.totalValue, currencySymbol)}
                      </span>
                      <Badge variant="outline" className="text-[10px]">
                        avg {formatMoney(row.avgValue, currencySymbol)}
                      </Badge>
                    </div>
                    {row.totalValue > 0 && (
                      <div className="mt-1 h-1.5 rounded bg-muted overflow-hidden">
                        <div
                          className="h-full bg-primary"
                          style={{
                            width: `${Math.min(100, (row.totalValue / Math.max(1, stats.totalValue)) * 100)}%`,
                          }}
                        />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {stats.overdueCount > 0 && daysSinceContact && (
            <Card>
              <CardContent className="p-4 space-y-2">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                  <AlertTriangle className="h-4 w-4 text-amber-500" /> Overdue Follow-ups ({stats.overdueCount})
                </h3>
                <p className="text-[11px] text-muted-foreground">
                  Customers not contacted in ≥ {daysSinceContact} days (today: {today || "—"}).
                </p>
                <div className="space-y-1 max-h-[200px] overflow-auto">
                  {priority
                    .filter((p) => {
                      if (p.days === null) return true;
                      return p.days >= Number(daysSinceContact);
                    })
                    .map((p, i) => (
                      <div key={i} className="flex items-center gap-2 rounded border bg-background px-3 py-1.5 text-xs">
                        <Badge variant={urgencyBadgeVariant[p.urgency]} className="text-[10px]">{p.urgency}</Badge>
                        <span className="font-medium text-foreground truncate flex-1">{p.customer.name}</span>
                        <span className="text-muted-foreground text-[10px] truncate">{p.customer.email}</span>
                        <span className="font-mono text-muted-foreground text-[10px]">{formatDays(p.days)}</span>
                        <span className="font-mono font-semibold text-foreground">{formatMoney(p.customer.value, currencySymbol)}</span>
                      </div>
                    ))}
                </div>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardContent className="p-4 space-y-2">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <Clock className="h-4 w-4" /> Follow-up Priority (oldest contact first)
              </h3>
              <p className="text-[11px] text-muted-foreground">
                Sorted by days since last contact descending. Customers with no last-contact date appear first.
              </p>
              <div className="space-y-1 max-h-[260px] overflow-auto">
                {priority.map((p, i) => (
                  <div key={i} className="flex items-center gap-2 rounded border bg-background px-3 py-1.5 text-xs">
                    <Badge variant={urgencyBadgeVariant[p.urgency]} className={`text-[10px] ${urgencyColor(p.urgency)}`}>{p.urgency}</Badge>
                    <span className="font-mono text-muted-foreground text-[10px] w-14">{formatDays(p.days)}</span>
                    <Badge variant="outline" className="text-[10px]">{STATUS_LABELS[p.customer.status]}</Badge>
                    <span className="font-medium text-foreground truncate flex-1">{p.customer.name}</span>
                    <span className="text-muted-foreground text-[10px] truncate hidden sm:inline">{p.customer.email}</span>
                    <span className="font-mono font-semibold text-foreground">{formatMoney(p.customer.value, currencySymbol)}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 space-y-2">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <Trophy className="h-4 w-4" /> Top Customers by Value
              </h3>
              <div className="space-y-1">
                {topCustomers.map((c, i) => {
                  const days = computeDaysSinceLastContact(today, c.lastContactDate);
                  const urgency = computeUrgency(days);
                  return (
                    <div key={i} className="flex items-center gap-2 rounded border bg-background px-3 py-1.5 text-xs">
                      <Badge variant="secondary" className="text-[10px]">#{i + 1}</Badge>
                      <Badge variant="outline" className={`text-[10px] ${STATUS_PRESETS.find((p) => p.status === c.status)?.color ?? ""}`}>{STATUS_LABELS[c.status]}</Badge>
                      <span className="font-medium text-foreground truncate flex-1">{c.name}</span>
                      <span className="text-muted-foreground text-[10px] truncate hidden sm:inline">{c.email}</span>
                      <span className={`font-mono text-[10px] ${urgencyColor(urgency)}`} title="days since last contact">{formatDays(days)}</span>
                      <span className="font-mono font-semibold text-foreground">{formatMoney(c.value, currencySymbol)}</span>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 space-y-3">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <FileText className="h-4 w-4" /> Report
              </h3>
              <pre className="rounded border bg-muted/30 p-3 text-[11px] font-mono whitespace-pre-wrap max-h-[400px] overflow-auto">
{text}
              </pre>
              <div className="flex flex-wrap gap-2">
                <CopyButton
                  getText={() => { handleSaveHistory(); return text; }}
                  label="Copy report"
                />
                <DownloadButton
                  getText={() => { handleSaveHistory(); return text; }}
                  filename="customer-tracker-report.txt"
                  mime="text/plain"
                  label="Download .txt"
                />
                <DownloadButton
                  getText={() => { handleSaveHistory(); return csv; }}
                  filename="customers.csv"
                  mime="text/csv"
                  label="Download CSV"
                />
                <ShareButton getUrl={() => { handleSaveHistory(); return buildShareUrl(input); }} />
                <ClearButton onClick={handleClear} />
              </div>
            </CardContent>
          </Card>
        </>
      ) : (
        <EmptyState
          title="Enter customers to track interactions and follow-ups"
          hint="One per line in the form name,email,phone,company,last_contact_date,status,value. Click 'Load sample' to see an example, or click a status preset to add a starter row."
          icon={<Users className="h-8 w-8" />}
        />
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
                <button
                  key={i}
                  onClick={() => {
                    setCustomersText(h.customersText);
                    setCurrencySymbol(h.currencySymbol);
                    toast.info("Restored from history");
                  }}
                  className="w-full text-left rounded border bg-background px-3 py-2 text-xs hover:bg-muted/30"
                >
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant="outline" className="text-[10px]">{h.customerCount} customers</Badge>
                    <Badge variant="outline" className="text-[10px]">{formatMoney(h.totalValue, h.currencySymbol)} total</Badge>
                    <Badge variant="outline" className="text-[10px]">avg {formatMoney(h.averageValue, h.currencySymbol)}</Badge>
                    {h.overdueCount > 0 && (
                      <Badge variant="secondary" className="text-[10px]">{h.overdueCount} overdue</Badge>
                    )}
                    <span className="text-muted-foreground ml-auto">{new Date(h.ts).toLocaleString()}</span>
                  </div>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-3">
          <p className="text-xs text-muted-foreground">
            <strong className="text-foreground">Privacy:</strong> All parsing, filtering, and calculations run 100% in your browser. History is stored in localStorage on this device only. The share link encodes your inputs in the URL hash which never leaves the device unless you copy and send it yourself.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function Stat({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
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
      <div className={`text-sm font-semibold ${color} truncate`}>{value}</div>
    </div>
  );
}
