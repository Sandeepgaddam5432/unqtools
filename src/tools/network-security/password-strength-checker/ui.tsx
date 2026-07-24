"use client";

import React, { useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CopyButton, DownloadButton, ErrorBanner } from "../../_shared";
import { analyzePassword, analyzeBatch, batchToCsv, type PasswordAnalysis } from "./logic";

const SCORE_COLORS = ["bg-red-500", "bg-orange-500", "bg-yellow-500", "bg-emerald-500", "bg-emerald-600"];

export default function PasswordStrengthChecker() {
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [analysis, setAnalysis] = useState<PasswordAnalysis | null>(null);
  const [batchInput, setBatchInput] = useState("");
  const [batchResults, setBatchResults] = useState<PasswordAnalysis[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const analyze = useCallback(() => {
    setError(null);
    try {
      setAnalysis(analyzePassword(password));
      setBatchResults(null);
    } catch (e) {
      setError((e as Error).message);
    }
  }, [password]);

  const analyzeBatchFn = useCallback(() => {
    setError(null);
    try {
      const lines = batchInput.split("\n").filter(Boolean);
      setBatchResults(analyzeBatch(lines));
      setAnalysis(null);
    } catch (e) {
      setError((e as Error).message);
    }
  }, [batchInput]);

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4 space-y-4">
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs text-muted-foreground">Password to analyze</Label>
            <div className="flex gap-2">
              <Input type={showPassword ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Enter a password" />
              <Button size="sm" variant="outline" onClick={() => setShowPassword(!showPassword)}>{showPassword ? "Hide" : "Show"}</Button>
            </div>
          </div>
          <Button size="sm" onClick={analyze} disabled={!password}>Analyze</Button>
        </CardContent>
      </Card>

      {error && <ErrorBanner message={error} />}

      {analysis && !error && (
        <>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3 mb-2">
                <p className="text-xs text-muted-foreground">Strength:</p>
                <Badge variant="outline">{analysis.scoreLabel}</Badge>
                <span className="text-xs text-muted-foreground">({analysis.score}/4)</span>
              </div>
              <div className="flex gap-1 mb-3">
                {[0, 1, 2, 3, 4].map((i) => (
                  <div key={i} className={`h-2 flex-1 rounded ${i < analysis.score + 1 ? SCORE_COLORS[analysis.score] : "bg-muted"}`} />
                ))}
              </div>
              <p className="text-xs text-muted-foreground">{analysis.entropy} bits of entropy</p>
            </CardContent>
          </Card>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Card><CardContent className="p-3"><p className="text-xs text-muted-foreground">Length</p><p className="text-sm font-bold">{analysis.length}</p></CardContent></Card>
            <Card><CardContent className="p-3"><p className="text-xs text-muted-foreground">Pool size</p><p className="text-sm font-bold">{analysis.poolSize}</p></CardContent></Card>
            <Card><CardContent className="p-3"><p className="text-xs text-muted-foreground">Common password?</p><p className="text-sm font-bold">{analysis.isCommon ? "YES" : "No"}</p></CardContent></Card>
            <Card><CardContent className="p-3"><p className="text-xs text-muted-foreground">Dictionary word?</p><p className="text-sm font-bold">{analysis.hasDictionaryWord ? "YES" : "No"}</p></CardContent></Card>
          </div>

          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-sm">Character classes detected</CardTitle></CardHeader>
            <CardContent className="p-4 pt-0">
              <p className="text-xs text-muted-foreground mb-2">{analysis.poolDescription}</p>
              <div className="flex flex-wrap gap-2">
                {analysis.classes.lowercase && <Badge variant="outline">a-z</Badge>}
                {analysis.classes.uppercase && <Badge variant="outline">A-Z</Badge>}
                {analysis.classes.digits && <Badge variant="outline">0-9</Badge>}
                {analysis.classes.symbols && <Badge variant="outline">symbols</Badge>}
                {analysis.classes.unicode && <Badge variant="outline">unicode</Badge>}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-sm">Estimated crack time</CardTitle></CardHeader>
            <CardContent className="p-4 pt-0 space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">Offline, fast hashing (bcrypt GPU):</span><strong>{analysis.crackTime.offlineFastHashing}</strong></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Offline, slow hashing (Argon2):</span><strong>{analysis.crackTime.offlineSlowHashing}</strong></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Online, throttled:</span><strong>{analysis.crackTime.onlineThrottled}</strong></div>
            </CardContent>
          </Card>

          {analysis.patterns.length > 0 && (
            <Card>
              <CardHeader className="pb-3"><CardTitle className="text-sm">Detected patterns</CardTitle></CardHeader>
              <CardContent className="p-0">
                <ul className="text-xs divide-y divide-border/50">
                  {analysis.patterns.map((p, i) => (
                    <li key={i} className="p-2 flex items-center gap-2">
                      <span className={`px-1.5 py-0.5 rounded text-[10px] ${p.severity === "danger" ? "bg-red-500/15 text-red-700 dark:text-red-300" : p.severity === "warning" ? "bg-yellow-500/15 text-yellow-700 dark:text-yellow-300" : "bg-blue-500/15 text-blue-700 dark:text-blue-300"}`}>{p.severity}</span>
                      <span>{p.description}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}

          {analysis.suggestions.length > 0 && (
            <Card>
              <CardHeader className="pb-3"><CardTitle className="text-sm">Suggestions</CardTitle></CardHeader>
              <CardContent className="p-0">
                <ul className="text-xs divide-y divide-border/50">
                  {analysis.suggestions.map((s, i) => (
                    <li key={i} className="p-2 flex items-center gap-2">
                      <span className="text-emerald-600 dark:text-emerald-400">→</span>
                      <span>{s}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}
        </>
      )}

      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-sm">Batch mode (one password per line)</CardTitle></CardHeader>
        <CardContent className="p-4 pt-0 space-y-3">
          <textarea className="rounded-md border border-input bg-background px-3 py-2 text-sm min-h-[100px] font-mono" value={batchInput} onChange={(e) => setBatchInput(e.target.value)} placeholder={"password1\nabc123\nAbc123!@#"} />
          <Button size="sm" onClick={analyzeBatchFn} disabled={!batchInput}>Analyze batch</Button>
        </CardContent>
      </Card>

      {batchResults && !error && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm">Batch results ({batchResults.length})</CardTitle>
              <DownloadButton getText={() => batchToCsv(batchResults)} filename="password-analysis.csv" mime="text/csv" />
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-muted/80"><tr>
                  <th className="p-2 text-left">Password</th>
                  <th className="p-2 text-right">Length</th>
                  <th className="p-2 text-right">Entropy</th>
                  <th className="p-2 text-left">Score</th>
                  <th className="p-2 text-left">Common?</th>
                  <th className="p-2 text-left">Crack (offline fast)</th>
                </tr></thead>
                <tbody>
                  {batchResults.map((r, i) => (
                    <tr key={i} className="border-t border-border/50">
                      <td className="p-2 font-mono">{r.password}</td>
                      <td className="p-2 text-right font-mono">{r.length}</td>
                      <td className="p-2 text-right font-mono">{r.entropy}</td>
                      <td className="p-2">{r.scoreLabel}</td>
                      <td className="p-2">{r.isCommon ? "YES" : "No"}</td>
                      <td className="p-2">{r.crackTime.offlineFastHashing}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground"><strong className="text-foreground">Privacy:</strong> all analysis runs locally. Passwords never leave your browser.</p></CardContent></Card>
    </div>
  );
}
