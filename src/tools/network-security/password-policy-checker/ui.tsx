"use client";

import React, { useState, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ErrorBanner, CopyButton, DownloadButton } from "../../_shared";
import { checkPolicy, DEFAULT_POLICY, type PasswordPolicy, type PolicyCheckResult } from "./logic";

export default function PasswordPolicyChecker() {
  const [password, setPassword] = useState("");
  const [policy, setPolicy] = useState<PasswordPolicy>(DEFAULT_POLICY);

  const result = useMemo<PolicyCheckResult | null>(() =>
    password ? checkPolicy(password, policy) : null,
  [password, policy]);

  const summary = useMemo(() => {
    if (!result) return "";
    const lines = [
      `Password: ${"*".repeat(result.password.length)}`,
      `Passed: ${result.passed}`,
      `Score: ${result.score}/100`,
      "",
      ...result.checks.map((c) => `${c.passed ? "✓" : "✗"} ${c.label}${c.detail ? ` (${c.detail})` : ""}`),
      "",
      ...result.suggestions.map((s) => `→ ${s}`),
    ];
    return lines.join("\n");
  }, [result]);

  const patch = (p: Partial<PasswordPolicy>) => setPolicy((prev) => ({ ...prev, ...p }));

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="ppc-pw" className="text-xs text-muted-foreground">Password to check</Label>
            <Input id="ppc-pw" type="text" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Enter a password" className="font-mono" />
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
            <NumField label="Min length" value={policy.minLength} onChange={(v) => patch({ minLength: v })} />
            <NumField label="Max length" value={policy.maxLength} onChange={(v) => patch({ maxLength: v })} />
            <NumField label="Min unique" value={policy.minUnique} onChange={(v) => patch({ minUnique: v })} />
            <NumField label="Max repeating" value={policy.maxRepeating} onChange={(v) => patch({ maxRepeating: v })} />
          </div>
          <div className="flex flex-wrap gap-3 text-xs">
            <Toggle label="a-z" checked={policy.requireLower} onChange={(v) => patch({ requireLower: v })} />
            <Toggle label="A-Z" checked={policy.requireUpper} onChange={(v) => patch({ requireUpper: v })} />
            <Toggle label="0-9" checked={policy.requireDigit} onChange={(v) => patch({ requireDigit: v })} />
            <Toggle label="Symbols" checked={policy.requireSymbol} onChange={(v) => patch({ requireSymbol: v })} />
            <Toggle label="Reject common" checked={policy.rejectCommon} onChange={(v) => patch({ rejectCommon: v })} />
            <Toggle label="Reject sequential" checked={policy.rejectSequential} onChange={(v) => patch({ rejectSequential: v })} />
            <Toggle label="Reject repeating" checked={policy.rejectRepeating} onChange={(v) => patch({ rejectRepeating: v })} />
          </div>
        </CardContent>
      </Card>

      {result && !result.passed && (
        <ErrorBanner message="Password does not satisfy one or more policy rules." />
      )}

      {result && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Badge variant="outline" className={result.passed ? "text-emerald-600" : "text-red-600"}>
                {result.passed ? "PASS" : "FAIL"}
              </Badge>
              <span className="text-xs text-muted-foreground">Score: {result.score}/100</span>
              <div className="ml-auto flex gap-2">
                <CopyButton getText={() => summary} label="Copy" />
                <DownloadButton getText={() => summary} filename="policy-report.txt" />
              </div>
            </div>
            <div className="space-y-1">
              {result.checks.map((c) => (
                <div key={c.id} className="flex items-center gap-2 text-xs">
                  <span className={c.passed ? "text-emerald-600" : "text-red-600"}>{c.passed ? "✓" : "✗"}</span>
                  <span>{c.label}</span>
                  {c.detail && <span className="text-muted-foreground">— {c.detail}</span>}
                </div>
              ))}
            </div>
            {result.suggestions.length > 0 && (
              <div className="rounded border bg-muted/30 p-2 text-xs space-y-1">
                <p className="font-semibold">Suggestions</p>
                {result.suggestions.map((s, i) => <div key={i}>→ {s}</div>)}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-3">
          <p className="text-xs text-muted-foreground">
            <strong className="text-foreground">Privacy:</strong> all checks run locally in your browser. The password is never uploaded.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function NumField({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <div>
      <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</Label>
      <Input type="number" value={value} onChange={(e) => onChange(Number(e.target.value))} className="mt-1 h-8 text-xs" />
    </div>
  );
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center gap-1.5 cursor-pointer">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span>{label}</span>
    </label>
  );
}
