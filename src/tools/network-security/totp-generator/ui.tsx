"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { CopyButton, ErrorBanner, EmptyState } from "../../_shared";
import {
  generateTotp,
  secondsRemaining,
  generateRandomSecret,
  buildOtpAuthUri,
  DEFAULT_OPTIONS,
  type TotpOptions,
  type TotpAlgorithm,
} from "./logic";
import { KeyRound, RefreshCw } from "lucide-react";

const ALGORITHMS: TotpAlgorithm[] = ["SHA-1", "SHA-256", "SHA-512"];

export default function TotpGenerator() {
  const [secret, setSecret] = useState("");
  const [period, setPeriod] = useState(DEFAULT_OPTIONS.period);
  const [digits, setDigits] = useState(DEFAULT_OPTIONS.digits);
  const [algorithm, setAlgorithm] = useState<TotpAlgorithm>(DEFAULT_OPTIONS.algorithm);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [remaining, setRemaining] = useState(0);
  const [now, setNow] = useState(Date.now());

  const opts: TotpOptions | null = secret.trim()
    ? { secret: secret.replace(/\s/g, "").toUpperCase(), period, digits, algorithm }
    : null;

  // Live clock — update every second
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  // Regenerate TOTP code when inputs or time window change
  useEffect(() => {
    if (!opts) {
      setCode("");
      setError(null);
      setRemaining(0);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const newCode = await generateTotp(opts, now);
        if (!cancelled) {
          setCode(newCode);
          setError(null);
          setRemaining(secondsRemaining(period, now));
        }
      } catch (e) {
        if (!cancelled) {
          setCode("");
          setError((e as Error).message ?? "Generation failed");
          setRemaining(0);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [opts?.secret, period, digits, algorithm, Math.floor(now / 1000 / period)]);

  const generateSecret = useCallback(() => {
    setSecret(generateRandomSecret(20));
  }, []);

  // Progress bar width
  const progressPct = opts ? (remaining / period) * 100 : 0;
  const isExpiring = remaining <= 5;

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4 space-y-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="totp-secret" className="text-sm">Base32 secret</Label>
              <button
                type="button"
                onClick={generateSecret}
                className="text-xs text-primary hover:underline cursor-pointer inline-flex items-center gap-1"
              >
                <RefreshCw className="h-3 w-3" /> Generate random
              </button>
            </div>
            <Input
              id="totp-secret"
              placeholder="JBSWY3DPEHPK3PXP"
              value={secret}
              onChange={(e) => setSecret(e.target.value)}
              className="font-mono text-sm"
              aria-label="TOTP secret"
              autoComplete="off"
              spellCheck={false}
            />
            <p className="text-[10px] text-muted-foreground">
              Paste the secret from your 2FA setup (e.g. from the otpauth:// URL or text view).
            </p>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="totp-period" className="text-xs text-muted-foreground">Period (s)</Label>
              <Input
                id="totp-period"
                type="number"
                min={1}
                max={600}
                value={period}
                onChange={(e) => setPeriod(parseInt(e.target.value, 10) || 30)}
                className="font-mono text-sm"
                aria-label="TOTP period in seconds"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="totp-digits" className="text-xs text-muted-foreground">Digits</Label>
              <select
                id="totp-digits"
                value={digits}
                onChange={(e) => setDigits(parseInt(e.target.value, 10))}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm font-mono cursor-pointer"
                aria-label="TOTP digits"
              >
                <option value={6}>6</option>
                <option value={8}>8</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="totp-alg" className="text-xs text-muted-foreground">Algorithm</Label>
              <select
                id="totp-alg"
                value={algorithm}
                onChange={(e) => setAlgorithm(e.target.value as TotpAlgorithm)}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm font-mono cursor-pointer"
                aria-label="TOTP algorithm"
              >
                {ALGORITHMS.map((a) => (
                  <option key={a} value={a}>{a}</option>
                ))}
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      {error && <ErrorBanner message={error} />}

      {code && !error && (
        <Card>
          <CardContent className="p-6 space-y-4">
            <div className="text-center">
              <p className="text-xs text-muted-foreground mb-2 uppercase tracking-widest">Current code</p>
              <div className="flex items-center justify-center gap-3">
                <code className={`text-4xl sm:text-5xl font-mono font-bold tracking-[0.2em] ${isExpiring ? "text-amber-600 dark:text-amber-400" : "text-foreground"}`}>
                  {code}
                </code>
                <CopyButton getText={() => code} label="" size="icon" />
              </div>
              <div className="mt-4 max-w-xs mx-auto">
                <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                  <div
                    className={`h-full transition-all duration-1000 ease-linear ${isExpiring ? "bg-amber-500" : "bg-primary"}`}
                    style={{ width: `${progressPct}%` }}
                  />
                </div>
                <p className="text-[10px] text-muted-foreground mt-1.5">
                  Refreshes in <span className="font-mono">{remaining}s</span>
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {!secret.trim() && !error && (
        <EmptyState
          title="Enter a TOTP secret"
          hint="Paste your 2FA secret (base32) or click Generate random to test. Codes refresh live every period."
          icon={<KeyRound className="h-8 w-8" />}
        />
      )}

      {opts && code && !error && (
        <Card>
          <CardContent className="p-4 space-y-2">
            <Label className="text-xs text-muted-foreground">otpauth:// URI (for QR codes)</Label>
            <pre className="overflow-auto whitespace-pre-wrap rounded-md border bg-muted/30 p-3 font-mono text-[10px] break-all">
              {buildOtpAuthUri(opts)}
            </pre>
            <p className="text-[10px] text-muted-foreground">
              Use this URI with any QR code generator to create a scannable code for Google Authenticator, Authy, etc.
            </p>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-4">
          <p className="text-xs text-muted-foreground">
            <strong className="text-foreground">Privacy:</strong> TOTP codes
            are generated locally using Web Crypto (HMAC-{algorithm}). Your
            secret never leaves your browser.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
