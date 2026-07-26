"use client";

import React, { useState, useMemo, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { CopyButton, EmptyState } from "../../_shared";
import { analyzePassword, scoreLabel, scoreColor } from "./logic";
import { Gauge, Eye, EyeOff, AlertTriangle, ShieldAlert, Lightbulb, ListChecks } from "lucide-react";
import { toast } from "sonner";

export default function PasswordStrengthMeter() {
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [customDictRaw, setCustomDictRaw] = useState("");

  const customDict = useMemo(() => customDictRaw.split(/[\s,;\n]+/).filter(Boolean), [customDictRaw]);
  const result = useMemo(() => (password ? analyzePassword(password, customDict) : null), [password, customDict]);

  const meterWidth = result ? ((result.score + 1) / 5) * 100 : 0;

  const handleSuggestionCopy = useCallback(() => {
    if (!result) return;
    const text = result.suggestions.join("\n");
    navigator.clipboard.writeText(text);
    toast.success("Suggestions copied");
  }, [result]);

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <Label htmlFor="pw-input" className="text-sm font-semibold flex items-center gap-2">
              <Gauge className="h-4 w-4 text-primary" /> Password
            </Label>
            <button type="button" onClick={() => setShow(!show)}
              className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground cursor-pointer">
              {show ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
              {show ? "Hide" : "Show"}
            </button>
          </div>
          <Input
            id="pw-input"
            type={show ? "text" : "password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Type a password to analyze…"
            className="font-mono text-sm"
            autoComplete="off"
            spellCheck={false}
          />
          {result && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-medium" style={{ color: scoreColor(result.score) }}>
                  {scoreLabel(result.score)} · {result.score}/4
                </span>
                <span className="text-muted-foreground">{result.entropy.toFixed(1)} bits of entropy · {result.length} chars</span>
              </div>
              <div className="h-2.5 w-full rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-300"
                  style={{ width: `${meterWidth}%`, backgroundColor: scoreColor(result.score) }}
                  role="progressbar"
                  aria-valuenow={result.score}
                  aria-valuemin={0}
                  aria-valuemax={4}
                />
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {result && (
        <>
          {result.warning && (
            <div className="flex items-start gap-2 rounded-md border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-700 dark:text-amber-400">
              <ShieldAlert className="h-4 w-4 flex-shrink-0 mt-0.5" />
              <div>{result.warning}</div>
            </div>
          )}

          <Card>
            <CardContent className="p-4 space-y-3">
              <Label className="text-sm font-semibold">Crack-time scenarios (model-explicit)</Label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div className="rounded-md border border-emerald-500/30 bg-emerald-500/5 p-2.5">
                  <div className="text-[10px] uppercase tracking-wider text-emerald-700 dark:text-emerald-400">Online · throttled</div>
                  <div className="text-sm font-semibold mt-0.5">{result.crackTimes.onlineThrottled}</div>
                  <div className="text-[10px] text-muted-foreground mt-0.5">100 guesses/hour — login rate-limit</div>
                </div>
                <div className="rounded-md border border-blue-500/30 bg-blue-500/5 p-2.5">
                  <div className="text-[10px] uppercase tracking-wider text-blue-700 dark:text-blue-400">Online · no throttle</div>
                  <div className="text-sm font-semibold mt-0.5">{result.crackTimes.onlineNoThrottle}</div>
                  <div className="text-[10px] text-muted-foreground mt-0.5">10 guesses/sec</div>
                </div>
                <div className="rounded-md border border-amber-500/30 bg-amber-500/5 p-2.5">
                  <div className="text-[10px] uppercase tracking-wider text-amber-700 dark:text-amber-400">Offline · bcrypt (cost 10)</div>
                  <div className="text-sm font-semibold mt-0.5">{result.crackTimes.offlineBcrypt}</div>
                  <div className="text-[10px] text-muted-foreground mt-0.5">10,000 guesses/sec · single GPU</div>
                </div>
                <div className="rounded-md border border-red-500/30 bg-red-500/5 p-2.5">
                  <div className="text-[10px] uppercase tracking-wider text-red-700 dark:text-red-400">Offline · MD5 (fast hash)</div>
                  <div className="text-sm font-semibold mt-0.5">{result.crackTimes.offlineMd5}</div>
                  <div className="text-[10px] text-muted-foreground mt-0.5">100 billion guesses/sec · GPU rig</div>
                </div>
              </div>
              <p className="text-[10px] text-muted-foreground flex items-start gap-1">
                <AlertTriangle className="h-3 w-3 flex-shrink-0 mt-0.5" />
                A 4/4 password can still fall in days against MD5 — hash choice matters as much as password choice. The bcrypt(MD5) trap (MD5 then bcrypt) eliminates bcrypt's protection entirely.
              </p>
            </CardContent>
          </Card>

          {result.matches.length > 0 && (
            <Card>
              <CardContent className="p-4 space-y-2">
                <Label className="text-sm font-semibold flex items-center gap-2"><ListChecks className="h-4 w-4 text-primary" /> Pattern breakdown</Label>
                <div className="space-y-1">
                  {result.matches.map((m, i) => (
                    <div key={i} className="grid grid-cols-[100px_1fr_60px] gap-2 items-center text-xs py-1 border-b border-border/40 last:border-0">
                      <Badge variant="outline" className="text-[9px] uppercase justify-center">{m.pattern}</Badge>
                      <div>
                        <code className="font-mono font-semibold">"{m.token}"</code>
                        <span className="text-muted-foreground ml-1">{m.message}</span>
                      </div>
                      <span className="text-muted-foreground text-right text-[11px]">{m.entropy.toFixed(1)}b</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {result.suggestions.length > 0 && (
            <Card>
              <CardContent className="p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-semibold flex items-center gap-2"><Lightbulb className="h-4 w-4 text-primary" /> Suggestions</Label>
                  <CopyButton getText={() => result.suggestions.join("\n")} label="Copy" size="sm" />
                </div>
                <ul className="space-y-1.5 text-xs">
                  {result.suggestions.map((s, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <span className="text-primary mt-0.5">→</span>
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
        <CardContent className="p-4 space-y-2">
          <Label className="text-xs text-muted-foreground">Custom dictionary (optional)</Label>
          <Input type="text" value={customDictRaw} onChange={(e) => setCustomDictRaw(e.target.value)} placeholder="company name, pet name, city (comma-separated)" className="text-xs" />
          <p className="text-[10px] text-muted-foreground">Words here get matched as dictionary patterns — useful for catching passwords built from personal info.</p>
        </CardContent>
      </Card>

      {!password && (
        <EmptyState title="Type a password to see its real strength" hint="Honest zxcvbn-style estimation: random passphrases beat 'P@ssw0rd1'. Multi-scenario crack times, pattern breakdown, and 100% private — your password never leaves the browser." icon={<Gauge className="h-8 w-8" />} />
      )}

      <Card>
        <CardContent className="p-4 flex items-start gap-2">
          <ShieldAlert className="h-4 w-4 text-emerald-500 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-muted-foreground">
            <strong className="text-foreground">100% private.</strong> Estimation runs entirely in your browser. No server, no logging, no analytics on the password field. We don't query any breach database — if you want a breach check, paste only the first 5 chars of your password's SHA-1 into a separate HIBP k-anonymity tool.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
