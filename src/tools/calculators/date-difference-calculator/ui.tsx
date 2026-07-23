"use client";

import React, { useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DownloadButton, ErrorBanner } from "../../_shared";
import { calculateDateDiff, addToDate, dateDiffToCsv } from "./logic";

export default function DateDifferenceCalculator() {
  const [startDate, setStartDate] = useState("2020-01-01");
  const [endDate, setEndDate] = useState("2020-12-31");
  const [holidays, setHolidays] = useState("");
  const [result, setResult] = useState<ReturnType<typeof calculateDateDiff> | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Add to date
  const [addStartDate, setAddStartDate] = useState("2020-01-01");
  const [addDays, setAddDays] = useState("30");
  const [addWeeks, setAddWeeks] = useState("0");
  const [addMonths, setAddMonths] = useState("0");
  const [addYears, setAddYears] = useState("0");
  const [addBusinessDays, setAddBusinessDays] = useState("0");
  const [addResult, setAddResult] = useState<string | null>(null);

  const calculate = useCallback(() => {
    const holidayList = holidays.split(/[\s,]+/).filter(Boolean);
    const r = calculateDateDiff({ startDate, endDate, holidays: holidayList });
    if ("error" in r) { setError(r.error); setResult(null); } else { setResult(r); setError(null); }
  }, [startDate, endDate, holidays]);

  const runAdd = useCallback(() => {
    const r = addToDate({
      startDate: addStartDate,
      days: Number(addDays) || undefined,
      weeks: Number(addWeeks) || undefined,
      months: Number(addMonths) || undefined,
      years: Number(addYears) || undefined,
      businessDays: Number(addBusinessDays) || undefined,
    });
    if (typeof r === "string") { setAddResult(r); setError(null); } else { setError(r.error); setAddResult(null); }
  }, [addStartDate, addDays, addWeeks, addMonths, addYears, addBusinessDays]);

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-muted-foreground">Start date</Label>
              <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-muted-foreground">End date</Label>
              <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs text-muted-foreground">Holidays to exclude (comma-separated YYYY-MM-DD)</Label>
            <Input value={holidays} onChange={(e) => setHolidays(e.target.value)} placeholder="2020-01-01, 2020-07-04" />
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={calculate}>Calculate difference</Button>
            <Button size="sm" variant="ghost" onClick={() => { setResult(null); setError(null); }}>Clear</Button>
          </div>
        </CardContent>
      </Card>

      {error && <ErrorBanner message={error} />}

      {result && !("error" in result) && (
        <>
          <Card>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground mb-1">Duration</p>
              <p className="text-2xl font-bold text-primary">{result.humanized}</p>
              <p className="text-sm text-muted-foreground mt-1">Total: {result.totalDays} days ({result.totalWeeks} weeks)</p>
              <Badge variant="outline" className="mt-2">{result.direction}</Badge>
            </CardContent>
          </Card>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Business days</p><p className="text-lg font-bold">{result.businessDays}</p></CardContent></Card>
            <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Weekend days</p><p className="text-lg font-bold">{result.totalWeekendDays}</p></CardContent></Card>
            <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Calendar breakdown</p><p className="text-sm font-bold">{result.years}y {result.months}m {result.days}d</p></CardContent></Card>
            <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Total weeks</p><p className="text-lg font-bold">{result.totalWeeks}</p></CardContent></Card>
          </div>

          <Card>
            <CardContent className="p-4 grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
              <div><p className="text-xs text-muted-foreground">Start weekday</p><p className="font-bold">{result.weekdayStart}</p></div>
              <div><p className="text-xs text-muted-foreground">End weekday</p><p className="font-bold">{result.weekdayEnd}</p></div>
              <div><p className="text-xs text-muted-foreground">ISO weeks</p><p className="font-bold">{result.isoWeekStart} → {result.isoWeekEnd}</p></div>
              <div><p className="text-xs text-muted-foreground">Day of year</p><p className="font-bold">{result.dayOfYearStart} → {result.dayOfYearEnd}</p></div>
              <div><p className="text-xs text-muted-foreground">Quarter</p><p className="font-bold">Q{result.quarterStart} → Q{result.quarterEnd}</p></div>
              <div><p className="text-xs text-muted-foreground">Half-year</p><p className="font-bold">{result.halfYearStart} → {result.halfYearEnd}</p></div>
              <div><p className="text-xs text-muted-foreground">Days left in end year</p><p className="font-bold">{result.daysRemainingInYearEnd}</p></div>
              <div><p className="text-xs text-muted-foreground">Leap year (start)</p><p className="font-bold">{result.isLeapYearStart ? "Yes" : "No"}</p></div>
            </CardContent>
          </Card>

          {result.perWeekBreakdown.length > 0 && result.perWeekBreakdown.length <= 20 && (
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm">Per-week breakdown</CardTitle>
                  <DownloadButton getText={() => dateDiffToCsv(result)} filename="date-diff-weekly.csv" mime="text/csv" />
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <div className="max-h-[300px] overflow-auto">
                  <table className="w-full text-xs">
                    <thead className="bg-muted/80 sticky top-0">
                      <tr><th className="p-2 text-left">Week of</th><th className="p-2 text-right">Days</th></tr>
                    </thead>
                    <tbody>
                      {result.perWeekBreakdown.map((w, i) => (
                        <tr key={i} className="border-t border-border/50">
                          <td className="p-2 font-mono">{w.weekOf}</td>
                          <td className="p-2 text-right font-mono">{w.days}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}

      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-sm">Add / subtract from a date</CardTitle></CardHeader>
        <CardContent className="p-4 pt-0 space-y-3">
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs text-muted-foreground">Start date</Label>
            <Input type="date" value={addStartDate} onChange={(e) => setAddStartDate(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            <div><Label className="text-xs text-muted-foreground">+ Days</Label><Input type="number" value={addDays} onChange={(e) => setAddDays(e.target.value)} /></div>
            <div><Label className="text-xs text-muted-foreground">+ Weeks</Label><Input type="number" value={addWeeks} onChange={(e) => setAddWeeks(e.target.value)} /></div>
            <div><Label className="text-xs text-muted-foreground">+ Months</Label><Input type="number" value={addMonths} onChange={(e) => setAddMonths(e.target.value)} /></div>
            <div><Label className="text-xs text-muted-foreground">+ Years</Label><Input type="number" value={addYears} onChange={(e) => setAddYears(e.target.value)} /></div>
            <div><Label className="text-xs text-muted-foreground">+ Business days</Label><Input type="number" value={addBusinessDays} onChange={(e) => setAddBusinessDays(e.target.value)} /></div>
          </div>
          <Button size="sm" onClick={runAdd}>Compute</Button>
          {addResult && (
            <p className="text-sm">Result: <strong className="text-primary text-lg">{addResult}</strong></p>
          )}
        </CardContent>
      </Card>

      <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground"><strong className="text-foreground">Privacy:</strong> all date math runs locally in your browser.</p></CardContent></Card>
    </div>
  );
}
