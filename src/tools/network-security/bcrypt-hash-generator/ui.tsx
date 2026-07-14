"use client";

import React, { useState, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { CopyButton, RunButton, ErrorBanner, ActionBar } from "../../_shared";
import { hashPassword, verifyPassword, parseHash, DEFAULT_COST, MIN_COST, MAX_COST } from "./logic";
import { Check, X } from "lucide-react";

export default function BcryptHashGenerator() {
  const [tab, setTab] = useState<"hash" | "verify">("hash");
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 w-full max-w-xs gap-1 p-1 rounded-lg bg-muted">
        <button
          type="button"
          onClick={() => setTab("hash")}
          className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors cursor-pointer ${
            tab === "hash" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
          }`}
          aria-pressed={tab === "hash"}
        >
          Hash
        </button>
        <button
          type="button"
          onClick={() => setTab("verify")}
          className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors cursor-pointer ${
            tab === "verify" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
          }`}
          aria-pressed={tab === "verify"}
        >
          Verify
        </button>
      </div>

      {tab === "hash" ? <HashTab /> : <VerifyTab />}

      <Card>
        <CardContent className="p-4">
          <p className="text-xs text-muted-foreground">
            <strong className="text-foreground">Privacy:</strong> all bcrypt
            hashing runs locally in your browser via <code>bcryptjs</code> (pure
            JavaScript, no native bindings). Your password never leaves your device.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function HashTab() {
  const [password, setPassword] = useState("");
  const [cost, setCost] = useState(DEFAULT_COST);
  const [hash, setHash] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const run = useCallback(async () => {
    setBusy(true);
    setError(null);
    // Defer to next tick so the UI can show "Working…" before the synchronous hash
    await new Promise((r) => setTimeout(r, 0));
    try {
      const result = hashPassword(password, cost);
      setHash(result);
    } catch (e) {
      setError((e as Error).message ?? "Hashing failed");
      setHash("");
    } finally {
      setBusy(false);
    }
  }, [password, cost]);

  const parsed = (() => {
    if (!hash) return null;
    try {
      return parseHash(hash);
    } catch {
      return null;
    }
  })();

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4 space-y-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="bcrypt-pwd" className="text-sm">Password</Label>
              {password.length > 72 && (
                <Badge variant="outline" className="text-[10px] border-amber-500/30 text-amber-700 dark:text-amber-400">
                  exceeds 72 bytes (truncated)
                </Badge>
              )}
              {password.length > 0 && password.length <= 72 && (
                <Badge variant="outline" className="text-[10px]">{password.length} bytes</Badge>
              )}
            </div>
            <Input
              id="bcrypt-pwd"
              type="password"
              placeholder="Enter a password to hash…"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="font-mono text-sm"
              aria-label="Password to hash"
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="bcrypt-cost" className="text-sm">Cost factor</Label>
              <Badge variant="outline" className="font-mono text-xs">{cost}</Badge>
            </div>
            <Slider
              id="bcrypt-cost"
              value={[cost]}
              min={MIN_COST}
              max={20}
              step={1}
              onValueChange={(v) => setCost(v[0])}
              aria-label="Cost factor"
            />
            <div className="flex justify-between text-[10px] text-muted-foreground">
              <span>{MIN_COST} (fast, insecure)</span>
              <span>12 (recommended)</span>
              <span>20+ (slow)</span>
            </div>
            <p className="text-[10px] text-muted-foreground">
              Each increment doubles the time. Cost {cost} ≈ {Math.pow(2, cost - 4).toFixed(0)}× the base cost.
              Max supported: {MAX_COST}.
            </p>
          </div>

          <ActionBar>
            <RunButton onClick={run} label="Generate hash" loading={busy} size="md" disabled={!password || busy} />
          </ActionBar>
        </CardContent>
      </Card>

      {error && <ErrorBanner message={error} />}

      {hash && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-semibold">Bcrypt hash</Label>
              <CopyButton getText={() => hash} label="Copy" size="sm" />
            </div>
            <pre className="overflow-auto whitespace-pre-wrap rounded-md border bg-muted/30 p-3 font-mono text-xs break-all">
              {hash}
            </pre>
            {parsed && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                <div className="rounded-md border bg-muted/20 p-2">
                  <p className="text-[10px] text-muted-foreground">Version</p>
                  <code className="font-mono">${parsed.version}</code>
                </div>
                <div className="rounded-md border bg-muted/20 p-2">
                  <p className="text-[10px] text-muted-foreground">Cost</p>
                  <code className="font-mono">{parsed.cost}</code>
                </div>
                <div className="rounded-md border bg-muted/20 p-2 col-span-2">
                  <p className="text-[10px] text-muted-foreground">Salt (22 chars)</p>
                  <code className="font-mono break-all">{parsed.salt}</code>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function VerifyTab() {
  const [password, setPassword] = useState("");
  const [hash, setHash] = useState("");
  const [result, setResult] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(() => {
    setError(null);
    setResult(null);
    if (!password) {
      setError("Password is required.");
      return;
    }
    if (!hash) {
      setError("Hash is required.");
      return;
    }
    try {
      const ok = verifyPassword(password, hash);
      setResult(ok);
    } catch (e) {
      setError((e as Error).message ?? "Verification failed");
    }
  }, [password, hash]);

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="verify-pwd" className="text-sm">Password to check</Label>
            <Input
              id="verify-pwd"
              type="password"
              placeholder="Enter the password…"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="font-mono text-sm"
              aria-label="Password to verify"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="verify-hash" className="text-sm">Bcrypt hash</Label>
            <Input
              id="verify-hash"
              placeholder="$2b$12$…"
              value={hash}
              onChange={(e) => setHash(e.target.value)}
              className="font-mono text-xs"
              aria-label="Bcrypt hash to verify against"
            />
          </div>

          <ActionBar>
            <RunButton onClick={run} label="Verify password" size="md" disabled={!password || !hash} />
          </ActionBar>
        </CardContent>
      </Card>

      {error && <ErrorBanner message={error} />}

      {result !== null && !error && (
        <Card>
          <CardContent className="p-4">
            <div
              className={`flex items-center gap-3 rounded-lg p-4 ${
                result
                  ? "bg-emerald-500/10 border border-emerald-500/30"
                  : "bg-red-500/10 border border-red-500/30"
              }`}
            >
              {result ? (
                <Check className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
              ) : (
                <X className="h-6 w-6 text-red-600 dark:text-red-400" />
              )}
              <div>
                <p className="text-sm font-semibold text-foreground">
                  {result ? "Password matches" : "Password does not match"}
                </p>
                <p className="text-xs text-muted-foreground">
                  {result
                    ? "The password was successfully verified against the hash."
                    : "The hash does not correspond to the given password."}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
