"use client";

import React, { useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ErrorBanner } from "../../_shared";
import { calculateAge } from "./logic";

function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default function AgeCalculator() {
  const [birthdate, setBirthdate] = useState("1990-01-15");
  const [targetDate, setTargetDate] = useState(todayStr());
  const [result, setResult] = useState<ReturnType<typeof calculateAge> | null>(null);
  const [error, setError] = useState<string | null>(null);

  const calculate = useCallback(() => {
    const r = calculateAge({ birthdate, targetDate: targetDate || undefined });
    if ("error" in r) { setError(r.error); setResult(null); } else { setResult(r); setError(null); }
  }, [birthdate, targetDate]);

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-muted-foreground">Birthdate</Label>
              <Input type="date" value={birthdate} onChange={(e) => setBirthdate(e.target.value)} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-muted-foreground">Target date (default: today)</Label>
              <Input type="date" value={targetDate} onChange={(e) => setTargetDate(e.target.value)} />
            </div>
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={calculate}>Calculate</Button>
            <Button size="sm" variant="ghost" onClick={() => setTargetDate(todayStr())}>Today</Button>
            <Button size="sm" variant="ghost" onClick={() => { setResult(null); setError(null); }}>Clear</Button>
          </div>
        </CardContent>
      </Card>

      {error && <ErrorBanner message={error} />}

      {result && !("error" in result) && (
        <>
          <Card>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground mb-1">Your age</p>
              <p className="text-3xl font-bold text-primary">{result.years} years, {result.months} months, {result.days} days</p>
            </CardContent>
          </Card>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
            <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Total days</p><p className="text-lg font-bold">{result.totalDays.toLocaleString()}</p></CardContent></Card>
            <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Total weeks</p><p className="text-lg font-bold">{result.totalWeeks.toLocaleString()}</p></CardContent></Card>
            <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Total hours</p><p className="text-lg font-bold">{result.totalHours.toLocaleString()}</p></CardContent></Card>
            <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Total minutes</p><p className="text-lg font-bold">{result.totalMinutes.toLocaleString()}</p></CardContent></Card>
            <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Total seconds</p><p className="text-lg font-bold">{result.totalSeconds.toLocaleString()}</p></CardContent></Card>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <Card><CardContent className="p-4">
              <p className="text-xs text-muted-foreground mb-1">Born on</p>
              <p className="text-sm font-bold">{result.weekdayBorn}</p>
              <p className="text-xs text-muted-foreground mt-2 mb-1">Zodiac</p>
              <p className="text-sm font-bold">{result.zodiacEmoji} {result.zodiacSign}</p>
              <p className="text-xs text-muted-foreground mt-2 mb-1">Chinese zodiac</p>
              <p className="text-sm font-bold">{result.chineseZodiac}</p>
            </CardContent></Card>
            <Card><CardContent className="p-4">
              <p className="text-xs text-muted-foreground mb-1">Birthstone</p>
              <p className="text-sm font-bold">{result.birthstone}</p>
              <p className="text-xs text-muted-foreground mt-2 mb-1">Birth flower</p>
              <p className="text-sm font-bold">{result.birthFlower}</p>
              <p className="text-xs text-muted-foreground mt-2 mb-1">Generation</p>
              <p className="text-sm font-bold">{result.generation}</p>
            </CardContent></Card>
            <Card><CardContent className="p-4">
              <p className="text-xs text-muted-foreground mb-1">Next birthday</p>
              <p className="text-sm font-bold">{result.nextBirthday.date}</p>
              <p className="text-xs text-muted-foreground">({result.nextBirthday.weekday})</p>
              <p className="text-sm mt-2"><Badge variant="outline">{result.nextBirthday.daysUntil} days</Badge></p>
              <p className="text-xs text-muted-foreground mt-2 mb-1">Half-birthday</p>
              <p className="text-sm font-bold">{result.halfBirthday.date} ({result.halfBirthday.daysUntil} days)</p>
            </CardContent></Card>
          </div>

          <Card>
            <CardContent className="p-4 grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
              <div>
                <p className="text-xs text-muted-foreground">Eligibility</p>
                <p>{result.isEligibleToVote ? "✅" : "❌"} Vote (18+)</p>
                <p>{result.isEligibleToDrive ? "✅" : "❌"} Drive (16+)</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Retirement at 65</p>
                <p className="font-bold">{result.retirementDate}</p>
              </div>
              {result.lifeExpectancyRemaining && (
                <div>
                  <p className="text-xs text-muted-foreground">Life expectancy remaining</p>
                  <p className="font-bold">{result.lifeExpectancyRemaining.years} years</p>
                  <p className="text-xs text-muted-foreground">{result.lifeExpectancyRemaining.note}</p>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}

      <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground"><strong className="text-foreground">Privacy:</strong> all calculations run locally. No data leaves your browser.</p></CardContent></Card>
    </div>
  );
}
