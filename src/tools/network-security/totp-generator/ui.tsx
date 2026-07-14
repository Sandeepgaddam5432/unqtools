"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { CopyButton, ErrorBanner, EmptyState } from "../../_shared";
import { toast } from "sonner";
import {
  generateTotp,
  generateHotp,
  generateSteamCode,
  secondsRemaining,
  generateRandomSecret,
  buildOtpAuthUri,
  DEFAULT_OPTIONS,
  DEFAULT_HOTP,
  loadAccounts,
  addAccount,
  removeAccount,
  generateBackupCodes,
  checkSecretStrength,
  generateNextCodes,
  type TotpOptions,
  type TotpAlgorithm,
  type TotpAccount,
  type BackupCodes,
} from "./logic";
import { KeyRound, RefreshCw, Plus, Trash2, Dice5, Clock, AlertTriangle, Shield } from "lucide-react";

type Mode = "totp" | "hotp" | "steam";

const ALGORITHMS: TotpAlgorithm[] = ["SHA-1", "SHA-256", "SHA-512"];
const MODES: { id: Mode; label: string; hint: string }[] = [
  { id: "totp", label: "TOTP", hint: "Time-based" },
  { id: "hotp", label: "HOTP", hint: "Counter" },
  { id: "steam", label: "Steam", hint: "Steam Guard" },
];

export default function TotpGenerator() {
  const [mode, setMode] = useState<Mode>("totp");
  const [secret, setSecret] = useState("");
  const [period, setPeriod] = useState(DEFAULT_OPTIONS.period);
  const [digits, setDigits] = useState(DEFAULT_OPTIONS.digits);
  const [algorithm, setAlgorithm] = useState<TotpAlgorithm>(DEFAULT_OPTIONS.algorithm);
  const [counter, setCounter] = useState(0);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [remaining, setRemaining] = useState(0);
  const [now, setNow] = useState(Date.now());
  const [accounts, setAccounts] = useState<TotpAccount[]>([]);
  const [showAccounts, setShowAccounts] = useState(false);
  const [showBackup, setShowBackup] = useState(false);
  const [backupCodes, setBackupCodes] = useState<BackupCodes | null>(null);
  const [showNextCodes, setShowNextCodes] = useState(false);
  const [nextCodes, setNextCodes] = useState<Array<{ code: string; validAt: Date }>>([]);

  // Load accounts on mount
  useEffect(() => { setAccounts(loadAccounts()); }, []);

  const cleanSecret = secret.replace(/\s/g, "").toUpperCase();
  const strength = useMemo(() => cleanSecret ? checkSecretStrength(cleanSecret) : null, [cleanSecret]);

  // Live clock
  useEffect(() => {
    if (mode !== "totp") return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [mode]);

  // Generate code
  useEffect(() => {
    if (!cleanSecret) { setCode(""); setError(null); setRemaining(0); return; }
    let cancelled = false;
    (async () => {
      try {
        let newCode: string;
        if (mode === "steam") {
          newCode = await generateSteamCode(cleanSecret, now);
        } else if (mode === "hotp") {
          newCode = await generateHotp({ secret: cleanSecret, counter, digits: digits as 6 | 8, algorithm });
        } else {
          newCode = await generateTotp({ secret: cleanSecret, period, digits: digits as 6 | 8, algorithm }, now);
        }
        if (!cancelled) { setCode(newCode); setError(null); if (mode === "totp") setRemaining(secondsRemaining(period, now)); }
      } catch (e) {
        if (!cancelled) { setCode(""); setError((e as Error).message); setRemaining(0); }
      }
    })();
    return () => { cancelled = true; };
  }, [cleanSecret, mode, period, digits, algorithm, counter, Math.floor(now / 1000 / period)]);

  const generateSecret = useCallback(() => { setSecret(generateRandomSecret(20)); }, []);
  const progressPct = mode === "totp" && cleanSecret ? (remaining / period) * 100 : 0;
  const isExpiring = remaining <= 5;

  const handleAddAccount = () => {
    if (!cleanSecret) { toast.error("Enter a secret first"); return; }
    const issuer = prompt("Issuer (e.g. Google):") || "Unknown";
    const account = prompt("Account (e.g. user@example.com):") || "user";
    const updated = addAccount({ issuer, account, secret: cleanSecret, period, digits, algorithm, type: mode, counter: mode === "hotp" ? counter : undefined });
    setAccounts(updated);
    toast.success(`Account "${issuer}:${account}" added`);
  };

  const handleRemoveAccount = (id: string) => {
    setAccounts(removeAccount(id));
    toast.success("Account removed");
  };

  const handleGenBackup = () => {
    setBackupCodes(generateBackupCodes(8, 8));
    setShowBackup(true);
  };

  const handleShowNext = async () => {
    if (!cleanSecret) return;
    const codes = await generateNextCodes({ secret: cleanSecret, period, digits: digits as 6 | 8, algorithm }, 5);
    setNextCodes(codes);
    setShowNextCodes(!showNextCodes);
  };

  return (
    <div className="space-y-4">
      {/* Mode selector */}
      <Card>
        <CardContent className="p-3">
          <div className="grid grid-cols-3 gap-1.5">
            {MODES.map((m) => (
              <button key={m.id} type="button" onClick={() => { setMode(m.id); setCode(""); }}
                className={`px-2 py-2 rounded-md text-xs font-medium transition-colors cursor-pointer text-center ${mode === m.id ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:text-foreground"}`}
                aria-pressed={mode === m.id}>
                <div className="font-semibold">{m.label}</div>
                <div className="text-[9px] opacity-70 mt-0.5">{m.hint}</div>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Secret + options */}
      <Card>
        <CardContent className="p-4 space-y-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="totp-secret" className="text-sm">Base32 secret</Label>
              <button type="button" onClick={generateSecret} className="text-xs text-primary hover:underline cursor-pointer inline-flex items-center gap-1">
                <RefreshCw className="h-3 w-3" /> Generate random
              </button>
            </div>
            <Input id="totp-secret" placeholder="JBSWY3DPEHPK3PXP" value={secret}
              onChange={(e) => setSecret(e.target.value)} className="font-mono text-sm" aria-label="TOTP secret" autoComplete="off" spellCheck={false} />
            {strength && (
              <div className="flex items-center gap-2">
                <Badge variant="outline" className={`text-[9px] ${strength.label === "Weak" ? "border-red-500/30 text-red-600" : strength.label === "Fair" ? "border-amber-500/30 text-amber-600" : "border-emerald-500/30 text-emerald-600"}`}>
                  <Shield className="h-2.5 w-2.5 mr-1" />{strength.label} · {strength.bits} bits
                </Badge>
                {strength.label === "Weak" && <span className="text-[10px] text-red-600">{strength.recommendation}</span>}
              </div>
            )}
          </div>
          <div className="grid grid-cols-3 gap-3">
            {mode === "totp" && (
              <div className="space-y-1.5">
                <Label htmlFor="totp-period" className="text-xs text-muted-foreground">Period (s)</Label>
                <Input id="totp-period" type="number" min={1} max={600} value={period}
                  onChange={(e) => setPeriod(parseInt(e.target.value, 10) || 30)} className="font-mono text-sm" aria-label="TOTP period" />
              </div>
            )}
            {mode === "hotp" && (
              <div className="space-y-1.5">
                <Label htmlFor="hotp-counter" className="text-xs text-muted-foreground">Counter</Label>
                <Input id="hotp-counter" type="number" min={0} value={counter}
                  onChange={(e) => setCounter(parseInt(e.target.value, 10) || 0)} className="font-mono text-sm" aria-label="HOTP counter" />
              </div>
            )}
            {mode !== "steam" && (
              <div className="space-y-1.5">
                <Label htmlFor="totp-digits" className="text-xs text-muted-foreground">Digits</Label>
                <select id="totp-digits" value={digits} onChange={(e) => setDigits(parseInt(e.target.value, 10))}
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm font-mono cursor-pointer" aria-label="Digits">
                  <option value={6}>6</option><option value={8}>8</option>
                </select>
              </div>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="totp-alg" className="text-xs text-muted-foreground">Algorithm</Label>
              <select id="totp-alg" value={algorithm} onChange={(e) => setAlgorithm(e.target.value as TotpAlgorithm)}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm font-mono cursor-pointer" aria-label="Algorithm">
                {ALGORITHMS.map((a) => <option key={a} value={a}>{a}</option>)}
              </select>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={handleAddAccount} disabled={!cleanSecret}
              className="text-xs text-primary hover:underline cursor-pointer disabled:opacity-50 inline-flex items-center gap-1">
              <Plus className="h-3 w-3" /> Save to accounts ({accounts.length})
            </button>
            <button type="button" onClick={() => setShowAccounts(!showAccounts)}
              className="text-xs text-muted-foreground hover:text-foreground cursor-pointer">
              {showAccounts ? "Hide" : "Show"} accounts
            </button>
            <button type="button" onClick={handleGenBackup}
              className="text-xs text-muted-foreground hover:text-foreground cursor-pointer">
              Generate backup codes
            </button>
            {mode === "totp" && (
              <button type="button" onClick={handleShowNext} disabled={!cleanSecret}
                className="text-xs text-muted-foreground hover:text-foreground cursor-pointer disabled:opacity-50">
                Next 5 codes
              </button>
            )}
          </div>
        </CardContent>
      </Card>

      {error && <ErrorBanner message={error} />}

      {/* Code display */}
      {code && !error && (
        <Card>
          <CardContent className="p-6 space-y-4">
            <div className="text-center">
              <p className="text-xs text-muted-foreground mb-2 uppercase tracking-widest">
                {mode === "steam" ? "Steam Guard code" : mode === "hotp" ? "HOTP code" : "Current code"}
              </p>
              <div className="flex items-center justify-center gap-3">
                <code className={`font-mono font-bold tracking-[0.15em] ${mode === "steam" ? "text-3xl" : "text-4xl sm:text-5xl"} ${isExpiring && mode === "totp" ? "text-amber-600 dark:text-amber-400" : "text-foreground"}`}>
                  {code}
                </code>
                <CopyButton getText={() => code} label="" size="icon" />
              </div>
              {mode === "totp" && (
                <div className="mt-4 max-w-xs mx-auto">
                  <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                    <div className={`h-full transition-all duration-1000 ease-linear ${isExpiring ? "bg-amber-500" : "bg-primary"}`} style={{ width: `${progressPct}%` }} />
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-1.5">Refreshes in <span className="font-mono">{remaining}s</span></p>
                </div>
              )}
              {mode === "hotp" && (
                <p className="text-[10px] text-muted-foreground mt-2">Counter: {counter} — increment for next code</p>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Accounts panel */}
      {showAccounts && (
        <Card>
          <CardContent className="p-4 space-y-2">
            <Label className="text-sm font-semibold">Saved accounts ({accounts.length})</Label>
            {accounts.length === 0 ? (
              <p className="text-xs text-muted-foreground">No accounts saved. Enter a secret and click "Save to accounts".</p>
            ) : (
              <div className="space-y-1 max-h-[300px] overflow-y-auto">
                {accounts.map((a) => (
                  <div key={a.id} className="grid grid-cols-[1fr_auto] gap-2 items-center text-xs py-1.5 border-b border-border/40 last:border-0">
                    <div className="min-w-0">
                      <p className="font-medium truncate">{a.issuer}:{a.account}</p>
                      <p className="text-[10px] text-muted-foreground">{a.type.toUpperCase()} · {a.digits} digits</p>
                    </div>
                    <div className="flex gap-1">
                      <button type="button" onClick={() => { setSecret(a.secret); setMode(a.type); setPeriod(a.period); setDigits(a.digits); setAlgorithm(a.algorithm); if(a.counter!==undefined) setCounter(a.counter); }}
                        className="text-[10px] text-primary hover:underline cursor-pointer">Load</button>
                      <button type="button" onClick={() => handleRemoveAccount(a.id)}
                        className="text-[10px] text-red-600 hover:underline cursor-pointer"><Trash2 className="h-3 w-3" /></button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Backup codes */}
      {showBackup && backupCodes && (
        <Card>
          <CardContent className="p-4 space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-semibold">Backup codes (one-time use)</Label>
              <button type="button" onClick={() => setShowBackup(false)} className="text-xs text-muted-foreground hover:text-foreground cursor-pointer">Close</button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {backupCodes.codes.map((c, i) => (
                <div key={i} className="flex items-center gap-2 rounded-md border bg-muted/20 p-2">
                  <code className="font-mono text-sm flex-1">{c}</code>
                  <CopyButton getText={() => c} label="" size="icon-sm" />
                </div>
              ))}
            </div>
            <p className="text-[10px] text-muted-foreground">Store these securely. Each code can be used once if you lose access to your authenticator.</p>
          </CardContent>
        </Card>
      )}

      {/* Next N codes */}
      {showNextCodes && nextCodes.length > 0 && (
        <Card>
          <CardContent className="p-4 space-y-2">
            <Label className="text-sm font-semibold">Next 5 codes (preview)</Label>
            <div className="space-y-1">
              {nextCodes.map((c, i) => (
                <div key={i} className="grid grid-cols-[auto_1fr_auto] gap-2 items-center text-xs py-1">
                  <Badge variant="outline" className="text-[9px]">+{i * period}s</Badge>
                  <code className="font-mono">{c.code}</code>
                  <span className="text-[10px] text-muted-foreground">{c.validAt.toLocaleTimeString()}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {!secret.trim() && !error && (
        <EmptyState title="Enter a secret to generate codes" hint="Paste your 2FA secret (base32) or click Generate random. Supports TOTP, HOTP, and Steam Guard." icon={<KeyRound className="h-8 w-8" />} />
      )}

      {cleanSecret && code && !error && (
        <Card>
          <CardContent className="p-4 space-y-2">
            <Label className="text-xs text-muted-foreground">otpauth:// URI (for QR codes)</Label>
            <pre className="overflow-auto whitespace-pre-wrap rounded-md border bg-muted/30 p-3 font-mono text-[10px] break-all">
              {buildOtpAuthUri({ secret: cleanSecret, period, digits: digits as 6 | 8, algorithm })}
            </pre>
            <p className="text-[10px] text-muted-foreground">Use this URI with any QR code generator for Google Authenticator, Authy, etc.</p>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-4">
          <p className="text-xs text-muted-foreground">
            <strong className="text-foreground">Privacy:</strong> all code generation is local via WebCrypto (HMAC-{algorithm}). Your secret never leaves your browser. Accounts are stored in localStorage on your device only.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
