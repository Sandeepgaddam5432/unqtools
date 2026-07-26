"use client";

import React, { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { CopyButton, DownloadButton, EmptyState } from "../../_shared";
import {
  generatePassword,
  generatePronounceable,
  generatePassphrase,
  generateBatch,
  batchToCsv,
  buildAlphabet,
  passwordEntropy,
  passphraseEntropy,
  encodeSettings,
  decodeSettings,
  classLabel,
  computeResultEntropy,
  autoClearClipboard,
  type PasswordOptions,
  type PassphraseOptions,
} from "./logic";
import { KeyRound, RefreshCw, Eye, EyeOff, ShieldCheck, Link2, Sparkles, FileDown } from "lucide-react";
import { toast } from "sonner";

type Mode = "password" | "passphrase" | "pronounceable";

export default function StrongPasswordGenerator() {
  const [mode, setMode] = useState<Mode>("password");
  const [opts, setOpts] = useState<PasswordOptions>({
    length: 20, upper: true, lower: true, digits: true, symbols: true,
    excludeAmbiguous: false, minUpper: 0, minLower: 0, minDigits: 1, minSymbols: 0,
  });
  const [pOpts, setPOpts] = useState<PassphraseOptions>({
    wordCount: 5, separator: "-", capitalize: true, appendDigit: true, appendSymbol: false,
  });
  const [output, setOutput] = useState("");
  const [batch, setBatch] = useState<string[]>([]);
  const [batchCount, setBatchCount] = useState(10);
  const [show, setShow] = useState(true);
  const [autoClear, setAutoClear] = useState(false);
  const clearRef = useRef<(() => void) | null>(null);

  const regenerate = useCallback(() => {
    try {
      let v = "";
      if (mode === "password") v = generatePassword(opts);
      else if (mode === "pronounceable") v = generatePronounceable(opts.length, opts);
      else v = generatePassphrase(pOpts);
      setOutput(v);
      setBatch([]);
    } catch (e) {
      toast.error((e as Error).message);
    }
  }, [mode, opts, pOpts]);

  // Auto-generate on mount and when settings change
  useEffect(() => { regenerate(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);
  useEffect(() => { regenerate(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [mode, opts, pOpts]);

  // Load settings from URL fragment on mount
  useEffect(() => {
    const decoded = decodeSettings(window.location.hash);
    if (decoded) {
      setOpts(decoded);
      toast.info("Loaded settings from URL");
    }
  }, []);

  const entropy = useMemo(() => {
    if (!output) return 0;
    if (mode === "passphrase") return passphraseEntropy(pOpts);
    return computeResultEntropy(output, opts);
  }, [output, mode, opts, pOpts]);

  const alphabetInfo = useMemo(() => {
    if (mode !== "password" && mode !== "pronounceable") return null;
    const { chars, classes } = buildAlphabet(opts);
    return { size: chars.length, classes };
  }, [mode, opts]);

  const handleCopy = useCallback(() => {
    if (!output) return;
    navigator.clipboard.writeText(output);
    toast.success("Password copied");
    if (autoClear) {
      if (clearRef.current) clearRef.current();
      clearRef.current = autoClearClipboard(30000);
      toast.info("Clipboard auto-clears in 30s");
    }
  }, [output, autoClear]);

  const handleShare = useCallback(() => {
    const url = `${window.location.origin}${window.location.pathname}${encodeSettings(opts)}`;
    navigator.clipboard.writeText(url);
    toast.success("Settings URL copied (NEVER includes the password)");
  }, [opts]);

  const handleBatch = useCallback(() => {
    try {
      const b = generateBatch(opts, batchCount);
      setBatch(b);
      toast.success(`Generated ${b.length} passwords`);
    } catch (e) {
      toast.error((e as Error).message);
    }
  }, [opts, batchCount]);

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <Label className="text-sm font-semibold flex items-center gap-2"><KeyRound className="h-4 w-4 text-primary" /> Generated password</Label>
            <div className="flex flex-wrap gap-1.5">
              <button type="button" onClick={() => setMode("password")} className={`px-2 py-1 rounded-md text-[11px] font-medium border cursor-pointer ${mode === "password" ? "bg-primary text-primary-foreground" : "bg-background hover:bg-muted"}`}>Random</button>
              <button type="button" onClick={() => setMode("passphrase")} className={`px-2 py-1 rounded-md text-[11px] font-medium border cursor-pointer ${mode === "passphrase" ? "bg-primary text-primary-foreground" : "bg-background hover:bg-muted"}`}>Passphrase</button>
              <button type="button" onClick={() => setMode("pronounceable")} className={`px-2 py-1 rounded-md text-[11px] font-medium border cursor-pointer ${mode === "pronounceable" ? "bg-primary text-primary-foreground" : "bg-background hover:bg-muted"}`}>Pronounceable</button>
            </div>
          </div>
          <div className="flex items-stretch gap-2">
            <code className={`flex-1 font-mono text-sm bg-muted/40 rounded-md p-2.5 break-all min-h-[40px] ${show ? "" : "select-none"}`} style={show ? {} : { filter: "blur(6px)" }}>
              {output || "—"}
            </code>
            <button type="button" onClick={() => setShow(!show)} className="px-2 rounded-md border bg-background hover:bg-muted cursor-pointer" aria-label={show ? "Hide" : "Show"}>
              {show ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
            </button>
          </div>
          <div className="flex flex-wrap gap-2 items-center">
            <button type="button" onClick={regenerate} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium bg-primary text-primary-foreground hover:opacity-90 cursor-pointer">
              <RefreshCw className="h-3 w-3" /> Regenerate
            </button>
            <CopyButton getText={() => output} label="Copy" />
            <button type="button" onClick={handleShare} className="inline-flex items-center gap-1 text-[11px] text-primary hover:underline cursor-pointer">
              <Link2 className="h-3 w-3" /> Copy settings URL
            </button>
            <label className="flex items-center gap-1 text-[11px] text-muted-foreground cursor-pointer ml-auto">
              <input type="checkbox" checked={autoClear} onChange={(e) => setAutoClear(e.target.checked)} />
              Auto-clear clipboard (30s)
            </label>
          </div>
          <div className="flex items-center gap-3 text-xs text-muted-foreground pt-1">
            <Badge variant="outline" className="text-[10px]">{entropy.toFixed(1)} bits entropy</Badge>
            {alphabetInfo && <Badge variant="outline" className="text-[10px]">{alphabetInfo.size}-char alphabet</Badge>}
            <span>{classLabel(opts)}</span>
          </div>
        </CardContent>
      </Card>

      {mode === "password" && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <Label className="text-sm font-semibold flex items-center gap-2"><Sparkles className="h-4 w-4 text-primary" /> Password options</Label>
            <div className="grid grid-cols-[100px_1fr] gap-2 items-center">
              <Label className="text-[11px] text-muted-foreground">Length: {opts.length}</Label>
              <input type="range" min={4} max={64} value={opts.length} onChange={(e) => setOpts({ ...opts, length: Number(e.target.value) })} className="w-full" />
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
              {([["upper", "A-Z"], ["lower", "a-z"], ["digits", "0-9"], ["symbols", "!@#"]] as const).map(([k, label]) => (
                <label key={k} className="flex items-center gap-1.5 cursor-pointer">
                  <input type="checkbox" checked={opts[k]} onChange={(e) => setOpts({ ...opts, [k]: e.target.checked })} />
                  {label}
                </label>
              ))}
            </div>
            <label className="flex items-center gap-1.5 text-xs cursor-pointer">
              <input type="checkbox" checked={opts.excludeAmbiguous} onChange={(e) => setOpts({ ...opts, excludeAmbiguous: e.target.checked })} />
              Exclude ambiguous (0 O 1 l I | &apos; &quot;)
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {([["minUpper", "min upper"], ["minLower", "min lower"], ["minDigits", "min digits"], ["minSymbols", "min symbols"]] as const).map(([k, label]) => (
                <label key={k} className="flex flex-col gap-1 text-[11px]">
                  <span className="text-muted-foreground">{label}</span>
                  <Input type="number" min={0} max={20} value={opts[k] ?? 0} onChange={(e) => setOpts({ ...opts, [k]: Math.max(0, Number(e.target.value)) })} className="text-xs h-8" />
                </label>
              ))}
            </div>
            <label className="flex flex-col gap-1 text-[11px]">
              <span className="text-muted-foreground">Custom symbol set (optional — overrides default)</span>
              <Input type="text" value={opts.customSymbols ?? ""} onChange={(e) => setOpts({ ...opts, customSymbols: e.target.value })} placeholder="!@#$%^&*" className="font-mono text-xs h-8" />
            </label>
          </CardContent>
        </Card>
      )}

      {mode === "passphrase" && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <Label className="text-sm font-semibold flex items-center gap-2"><Sparkles className="h-4 w-4 text-primary" /> Passphrase options (EFF wordlist)</Label>
            <div className="grid grid-cols-[100px_1fr] gap-2 items-center">
              <Label className="text-[11px] text-muted-foreground">Words: {pOpts.wordCount}</Label>
              <input type="range" min={2} max={10} value={pOpts.wordCount} onChange={(e) => setPOpts({ ...pOpts, wordCount: Number(e.target.value) })} className="w-full" />
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              <label className="flex flex-col gap-1 text-[11px]">
                <span className="text-muted-foreground">Separator</span>
                <Input type="text" value={pOpts.separator} onChange={(e) => setPOpts({ ...pOpts, separator: e.target.value })} className="font-mono text-xs h-8" maxLength={3} />
              </label>
              <label className="flex items-center gap-1.5 text-xs cursor-pointer self-end pb-2">
                <input type="checkbox" checked={pOpts.capitalize} onChange={(e) => setPOpts({ ...pOpts, capitalize: e.target.checked })} />
                Capitalize
              </label>
              <label className="flex items-center gap-1.5 text-xs cursor-pointer self-end pb-2">
                <input type="checkbox" checked={pOpts.appendDigit} onChange={(e) => setPOpts({ ...pOpts, appendDigit: e.target.checked })} />
                + Digit
              </label>
              <label className="flex items-center gap-1.5 text-xs cursor-pointer self-end pb-2">
                <input type="checkbox" checked={pOpts.appendSymbol} onChange={(e) => setPOpts({ ...pOpts, appendSymbol: e.target.checked })} />
                + Symbol
              </label>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <Label className="text-sm font-semibold">Batch generation</Label>
            <div className="flex items-center gap-2">
              <Input type="number" min={1} max={1000} value={batchCount} onChange={(e) => setBatchCount(Math.max(1, Math.min(1000, Number(e.target.value))))} className="w-20 text-xs h-8" />
              <button type="button" onClick={handleBatch} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium border bg-background hover:bg-muted cursor-pointer">
                <Sparkles className="h-3 w-3" /> Generate
              </button>
              {batch.length > 0 && (
                <DownloadButton getText={() => batchToCsv(batch, opts)} filename="passwords.csv" label="CSV" mime="text/csv" />
              )}
            </div>
          </div>
          {batch.length > 0 && (
            <div className="max-h-64 overflow-y-auto rounded-md border border-border/60">
              {batch.map((p, i) => (
                <div key={i} className="grid grid-cols-[40px_1fr_auto] gap-2 items-center px-2 py-1 border-b border-border/40 last:border-0 text-xs">
                  <span className="text-muted-foreground text-[10px]">{i + 1}</span>
                  <code className="font-mono break-all">{p}</code>
                  <CopyButton getText={() => p} label="" size="icon-sm" />
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4 flex items-start gap-2">
          <ShieldCheck className="h-4 w-4 text-emerald-500 flex-shrink-0 mt-0.5" />
          <div className="text-xs text-muted-foreground">
            <strong className="text-foreground">CSPRNG + bias-free.</strong> Generated with <code className="font-mono">crypto.getRandomValues</code> and rejection sampling (no modulo bias). Passwords never leave your browser — no server, no logging. Shareable URLs encode only the settings, never the password. Length is uncapped up to 128 chars; batch up to 1000 at once.
          </div>
        </CardContent>
      </Card>

      {!output && (
        <EmptyState title="Configure and generate" hint="CSPRNG-secured passwords, EFF passphrases, and pronounceable strings — all 100% local." icon={<KeyRound className="h-8 w-8" />} />
      )}
    </div>
  );
}
