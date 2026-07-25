"use client";

import React, { useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ErrorBanner, EmptyState } from "../../_shared";
import {
  evaluateSwap,
  suggestSwapCandidates,
  type Shift,
  type Employee,
} from "./logic";

const DEFAULT_SHIFT: Shift = { id: "s1", employeeId: "e1", role: "cashier", start: "09:00", end: "17:00", day: "2024-05-01" };

const DEFAULT_EMPLOYEES: Employee[] = [
  { id: "e1", name: "Alice", roles: ["cashier", "cook"], maxHoursPerWeek: 40 },
  { id: "e2", name: "Bob", roles: ["cashier"], maxHoursPerWeek: 20 },
  { id: "e3", name: "Carol", roles: ["cashier", "cook"], maxHoursPerWeek: 40 },
];

const DEFAULT_SHIFTS: Shift[] = [
  DEFAULT_SHIFT,
  { id: "s2", employeeId: "e2", role: "cashier", start: "15:00", end: "23:00", day: "2024-05-01" },
];

export default function EmployeeShiftTrader() {
  const [shift, setShift] = useState<Shift>(DEFAULT_SHIFT);
  const [targetId, setTargetId] = useState<string>("e3");
  const [employees] = useState<Employee[]>(DEFAULT_EMPLOYEES);
  const [allShifts] = useState<Shift[]>(DEFAULT_SHIFTS);

  const target = useMemo(() => employees.find((e) => e.id === targetId) ?? null, [employees, targetId]);

  const result = useMemo(() => {
    if (!target) return null;
    const empShifts = allShifts.filter((s) => s.employeeId === target.id);
    return evaluateSwap(
      { shiftId: shift.id, fromEmployeeId: shift.employeeId, toEmployeeId: target.id },
      shift,
      target,
      empShifts
    );
  }, [target, shift, allShifts]);

  const candidates = useMemo(() => suggestSwapCandidates(shift, employees, allShifts), [shift, employees, allShifts]);

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4 space-y-3">
          <Label className="text-sm font-semibold">Shift to swap</Label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Role required</Label>
              <Input value={shift.role} onChange={(e) => setShift((s) => ({ ...s, role: e.target.value }))} className="text-sm" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Day (yyyy-mm-dd)</Label>
              <Input value={shift.day} onChange={(e) => setShift((s) => ({ ...s, day: e.target.value }))} className="text-sm font-mono" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Start (HH:mm)</Label>
              <Input value={shift.start} onChange={(e) => setShift((s) => ({ ...s, start: e.target.value }))} className="text-sm font-mono" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">End (HH:mm)</Label>
              <Input value={shift.end} onChange={(e) => setShift((s) => ({ ...s, end: e.target.value }))} className="text-sm font-mono" />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Proposed recipient</Label>
            <select value={targetId} onChange={(e) => setTargetId(e.target.value)} className="w-full rounded-md border bg-background px-2 py-1.5 text-sm">
              {employees.filter((e) => e.id !== shift.employeeId).map((e) => (
                <option key={e.id} value={e.id}>{e.name} — roles: {e.roles.join(", ")}</option>
              ))}
            </select>
          </div>
        </CardContent>
      </Card>

      {result && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center gap-2 flex-wrap">
              {result.feasible ? (
                <Badge variant="outline" className="text-xs border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400">Feasible</Badge>
              ) : (
                <Badge variant="outline" className="text-xs border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-400">Not feasible</Badge>
              )}
              <Badge variant="outline" className="text-xs">Coverage: {result.coverageMaintained ? "Maintained" : "At risk"}</Badge>
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Reasons</Label>
              <ul className="text-xs space-y-1 list-disc pl-4">
                {result.reasons.map((r, i) => <li key={i}>{r}</li>)}
              </ul>
            </div>
            {result.warnings.length > 0 && (
              <div className="space-y-1">
                <Label className="text-xs text-amber-700 dark:text-amber-400">Warnings</Label>
                <ul className="text-xs space-y-1 list-disc pl-4">
                  {result.warnings.map((w, i) => <li key={i}>{w}</li>)}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-4 space-y-2">
          <Label className="text-sm font-semibold">Suggested candidates ({candidates.length})</Label>
          <div className="space-y-1">
            {candidates.length === 0 && <p className="text-xs text-muted-foreground">No feasible candidates found.</p>}
            {candidates.map((c) => (
              <div key={c.employee.id} className="grid grid-cols-[1fr_1fr_auto] gap-2 items-center text-xs py-1.5 border-b border-border/40 last:border-0">
                <span className="font-medium">{c.employee.name}</span>
                <span className="text-muted-foreground">{c.employee.roles.join(", ")}</span>
                <Badge variant="outline" className="text-[10px] border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400">Available</Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {!result && (
        <EmptyState title="Configure a swap" hint="Set the shift details and pick a recipient to evaluate feasibility." />
      )}
    </div>
  );
}
