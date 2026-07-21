"use client";

import React, { useState, useMemo, useCallback, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  CopyButton,
  DownloadButton,
  EmptyState,
  ShareButton,
  ClearButton,
} from "../../_shared";
import { toast } from "sonner";
import {
  SCOPES,
  PERM_BITS,
  SPECIAL_BITS,
  SCOPE_LABELS,
  BIT_LABELS,
  BIT_VALUES,
  PRESETS,
  emptyMode,
  parseOctal,
  modeToSmartOctal,
  modeToSymbolic,
  modeToSymbolicShort,
  modeToSymbolicExpr,
  toggleBit,
  toggleSpecial,
  buildChmodNumeric,
  buildChmodSymbolic,
  buildRecursiveSafe,
  lintMode,
  explainMode,
  computeUmask,
  smartParse,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  type ChmodMode,
  type Scope,
  type PermBit,
  type SpecialBit,
  type FileMode,
  type ChmodVariant,
  type HistoryEntry,
} from "./logic";
import {
  History, Lock, ShieldAlert, ShieldCheck, AlertTriangle,
  Terminal, Info, KeyRound, Folder, FileText,
} from "lucide-react";

const SCOPE_BIT_COLOR: Record<PermBit, string> = {
  read: "text-emerald-600 dark:text-emerald-400",
  write: "text-amber-600 dark:text-amber-400",
  execute: "text-blue-600 dark:text-blue-400",
};

const SCOPE_BIT_LETTER: Record<PermBit, string> = {
  read: "r",
  write: "w",
  execute: "x",
};

export default function ChmodCalculator() {
  const [mode, setMode] = useState<ChmodMode>(() => parseOctal("755")!);
  const [kind, setKind] = useState<FileMode>("file");
  const [variant, setVariant] = useState<ChmodVariant>("numeric");
  const [target, setTarget] = useState("file");
  const [recursive, setRecursive] = useState(false);
  const [pasteInput, setPasteInput] = useState("");
  const [umaskInput, setUmaskInput] = useState("022");
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  useEffect(() => {
    setHistory(loadHistory());
    if (typeof window !== "undefined" && window.location.hash) {
      const p = parseShareUrl(window.location.hash);
      if (p.octal) {
        const m = parseOctal(p.octal);
        if (m) {
          setMode(m);
          setKind(p.kind);
          setVariant(p.variant);
          toast.info("Loaded from share link");
        }
      }
    }
  }, []);

  const octal = useMemo(() => modeToSmartOctal(mode), [mode]);
  const octal4 = useMemo(() => {
    const s = (mode.setuid ? 4 : 0) + (mode.setgid ? 2 : 0) + (mode.sticky ? 1 : 0);
    return `${s}${octal.length === 4 ? octal.slice(1) : octal}`;
  }, [mode, octal]);
  const symbolic = useMemo(() => modeToSymbolic(mode), [mode]);
  const symbolicShort = useMemo(() => modeToSymbolicShort(mode), [mode]);
  const lint = useMemo(() => lintMode(mode, kind), [mode, kind]);
  const explain = useMemo(() => explainMode(mode, kind), [mode, kind]);
  const umask = useMemo(() => computeUmask(umaskInput), [umaskInput]);

  const cmdNumeric = useMemo(
    () => buildChmodNumeric(mode, target, { recursive }),
    [mode, target, recursive],
  );
  const cmdSymbolic = useMemo(
    () => buildChmodSymbolic(mode, target, { recursive }),
    [mode, target, recursive],
  );
  const cmdRecursiveSafe = useMemo(
    () => buildRecursiveSafe(mode, target === "." ? "." : target),
    [mode, target],
  );

  const handleToggleBit = useCallback((scope: Scope, bit: PermBit) => {
    setMode((prev) => toggleBit(prev, scope, bit));
  }, []);
  const handleToggleSpecial = useCallback((s: SpecialBit) => {
    setMode((prev) => toggleSpecial(prev, s));
  }, []);

  const handlePreset = useCallback((oct: string) => {
    const m = parseOctal(oct);
    if (m) {
      setMode(m);
      toast.info(`Loaded preset ${oct}`);
    }
  }, []);

  const handlePaste = useCallback(() => {
    const r = smartParse(pasteInput);
    if (!r) {
      toast.error("Could not parse input as octal, symbolic, or expression");
      return;
    }
    setMode(r.mode);
    toast.success(`Parsed as ${r.source}: ${r.canonicalOctal} (${r.canonicalSymbolic})`);
  }, [pasteInput]);

  const handleClear = useCallback(() => {
    setMode(emptyMode());
    setKind("file");
    setVariant("numeric");
    setTarget("file");
    setRecursive(false);
    setPasteInput("");
    toast.info("Cleared");
  }, []);

  const handleClearHistory = useCallback(() => {
    clearHistory();
    setHistory([]);
    toast.success("History cleared");
  }, []);

  const handleRecordHistory = useCallback(() => {
    saveHistory({
      ts: Date.now(),
      octal,
      symbolic,
      kind,
    });
    setHistory(loadHistory());
  }, [octal, symbolic, kind]);

  return (
    <div className="space-y-4 unq-animate-fade-in-up">
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-semibold flex items-center gap-1.5">
              <Lock className="h-4 w-4" /> Permission grid
            </h3>
            <div className="flex gap-1">
              <Button
                variant={kind === "file" ? "default" : "outline"}
                size="sm"
                className="h-7 text-[11px] gap-1"
                onClick={() => setKind("file")}
              >
                <FileText className="h-3 w-3" /> File
              </Button>
              <Button
                variant={kind === "directory" ? "default" : "outline"}
                size="sm"
                className="h-7 text-[11px] gap-1"
                onClick={() => setKind("directory")}
              >
                <Folder className="h-3 w-3" /> Directory
              </Button>
              <ClearButton onClick={handleClear} />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr>
                  <th className="text-left p-2 w-24">Permission</th>
                  {PERM_BITS.map((b) => (
                    <th key={b} className="p-2 text-center">
                      <span className={`font-mono font-semibold ${SCOPE_BIT_COLOR[b]}`}>
                        {SCOPE_BIT_LETTER[b]}
                      </span>{" "}
                      <span className="text-muted-foreground">({BIT_VALUES[b]})</span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {SCOPES.map((scope) => (
                  <tr key={scope} className="border-t">
                    <td className="p-2 font-medium">{SCOPE_LABELS[scope]}</td>
                    {PERM_BITS.map((bit) => (
                      <td key={bit} className="p-2 text-center">
                        <label className="inline-flex items-center gap-1 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={mode[scope][bit]}
                            onChange={() => handleToggleBit(scope, bit)}
                            className="h-4 w-4"
                          />
                          <span className="text-[10px] text-muted-foreground">{BIT_LABELS[bit]}</span>
                        </label>
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="border-t pt-3">
            <Label className="text-xs uppercase tracking-wide text-muted-foreground">Special bits</Label>
            <div className="flex flex-wrap gap-3 pt-1.5">
              <label className="flex items-center gap-1.5 text-xs cursor-pointer">
                <input
                  type="checkbox"
                  checked={mode.setuid}
                  onChange={() => handleToggleSpecial("setuid")}
                  className="h-4 w-4"
                />
                <Badge variant="outline" className="text-[10px]">setuid</Badge>
                <span className="text-muted-foreground">4000 · runs as owner</span>
              </label>
              <label className="flex items-center gap-1.5 text-xs cursor-pointer">
                <input
                  type="checkbox"
                  checked={mode.setgid}
                  onChange={() => handleToggleSpecial("setgid")}
                  className="h-4 w-4"
                />
                <Badge variant="outline" className="text-[10px]">setgid</Badge>
                <span className="text-muted-foreground">2000 · runs as group / inherits</span>
              </label>
              <label className="flex items-center gap-1.5 text-xs cursor-pointer">
                <input
                  type="checkbox"
                  checked={mode.sticky}
                  onChange={() => handleToggleSpecial("sticky")}
                  className="h-4 w-4"
                />
                <Badge variant="outline" className="text-[10px]">sticky</Badge>
                <span className="text-muted-foreground">1000 · owner-only delete</span>
              </label>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4 space-y-3">
          <h3 className="text-sm font-semibold flex items-center gap-1.5">
            <Terminal className="h-4 w-4" /> Three-way output
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <OutputBox
              label="Octal"
              value={octal}
              hint={`4-digit: ${octal4}`}
              onCopy={handleRecordHistory}
            />
            <OutputBox
              label="Symbolic"
              value={symbolic}
              hint={`short: ${symbolicShort}`}
              onCopy={handleRecordHistory}
            />
            <OutputBox
              label="Symbolic expr"
              value={modeToSymbolicExpr(mode)}
              hint="chmod-style"
              onCopy={handleRecordHistory}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="chmod-target" className="text-xs">Target file/dir name</Label>
            <Input
              id="chmod-target"
              value={target}
              onChange={(e) => setTarget(e.target.value)}
              placeholder="myfile.txt"
              className="h-8 text-xs font-mono"
            />
            <label className="flex items-center gap-2 text-xs cursor-pointer pt-1">
              <input
                type="checkbox"
                checked={recursive}
                onChange={(e) => setRecursive(e.target.checked)}
                className="h-4 w-4"
              />
              Add <code className="font-mono">-R</code> recursive flag
            </label>
          </div>

          <div className="space-y-1">
            <div className="flex items-center gap-1.5">
              <Button
                variant={variant === "numeric" ? "default" : "outline"}
                size="sm"
                className="h-7 text-[11px]"
                onClick={() => setVariant("numeric")}
              >Numeric</Button>
              <Button
                variant={variant === "symbolic" ? "default" : "outline"}
                size="sm"
                className="h-7 text-[11px]"
                onClick={() => setVariant("symbolic")}
              >Symbolic</Button>
              <CopyButton
                getText={() => { handleRecordHistory(); return variant === "numeric" ? cmdNumeric : cmdSymbolic; }}
                label="Copy chmod"
              />
              <ShareButton getUrl={() => { handleRecordHistory(); return buildShareUrl(octal, kind, variant); }} />
            </div>
            <pre className="rounded border bg-muted/50 px-3 py-2 font-mono text-xs text-foreground overflow-x-auto">
              {variant === "numeric" ? cmdNumeric : cmdSymbolic}
            </pre>
          </div>

          <div className="space-y-1">
            <Label className="text-xs flex items-center gap-1.5">
              <Info className="h-3.5 w-3.5" /> Safer recursive pattern (separates files & dirs)
            </Label>
            <pre className="rounded border bg-muted/50 px-3 py-2 font-mono text-[10px] text-foreground overflow-x-auto whitespace-pre-wrap">
              {cmdRecursiveSafe}
            </pre>
            <CopyButton getText={() => cmdRecursiveSafe} label="Copy find pattern" />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4 space-y-2">
          <h3 className="text-sm font-semibold flex items-center gap-1.5">
            <KeyRound className="h-4 w-4" /> Paste any format
          </h3>
          <div className="flex gap-2">
            <Input
              value={pasteInput}
              onChange={(e) => setPasteInput(e.target.value)}
              placeholder={'755  |  rwxr-xr-x  |  drwxr-xr-x  |  u=rwx,go=rx  |  u+x,go-w'}
              className="h-8 text-xs font-mono"
              onKeyDown={(e) => { if (e.key === "Enter") handlePaste(); }}
            />
            <Button size="sm" onClick={handlePaste}>Load</Button>
          </div>
          <div className="flex flex-wrap gap-1 pt-1">
            {PRESETS.map((p) => (
              <Button
                key={p.id}
                variant="ghost"
                size="sm"
                className="h-6 text-[11px] font-mono"
                title={p.description}
                onClick={() => handlePreset(p.octal)}
              >{p.label}</Button>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4 space-y-2">
          <h3 className="text-sm font-semibold flex items-center gap-1.5">
            {lint.ok ? <ShieldCheck className="h-4 w-4 text-emerald-600" /> : <ShieldAlert className="h-4 w-4 text-red-600" />}
            Security linter
          </h3>
          {lint.ok ? (
            <p className="text-xs text-emerald-600 dark:text-emerald-400">
              No security issues detected for this mode applied to a {kind}.
            </p>
          ) : (
            <div className="space-y-1">
              {lint.issues.map((iss, i) => (
                <div
                  key={i}
                  className={`flex items-start gap-2 rounded-lg border p-2 text-xs ${
                    iss.level === "danger"
                      ? "border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-300"
                      : iss.level === "warning"
                        ? "border-yellow-500/30 bg-yellow-500/10 text-yellow-700 dark:text-yellow-300"
                        : "border-blue-500/30 bg-blue-500/10 text-blue-700 dark:text-blue-300"
                  }`}
                >
                  {iss.level === "info"
                    ? <Info className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" />
                    : <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" />}
                  <span>{iss.message}</span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4 space-y-2">
          <h3 className="text-sm font-semibold">Plain-English explainer</h3>
          <div className="space-y-1 max-h-[260px] overflow-auto">
            {explain.map((row, i) => (
              <div
                key={i}
                className={`flex items-baseline gap-2 rounded border px-2 py-1 text-xs ${
                  row.on ? "bg-background" : "bg-muted/30 opacity-60"
                }`}
              >
                <span className="font-mono w-20 text-[10px] uppercase tracking-wide text-muted-foreground">
                  {row.scope === "special" ? "special" : row.scope.charAt(0)}/{row.bit.charAt(0)}
                </span>
                <span className={row.on ? "text-foreground" : "text-muted-foreground line-through"}>
                  {row.text}
                </span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4 space-y-2">
          <h3 className="text-sm font-semibold flex items-center gap-1.5">
            <Info className="h-4 w-4" /> Umask companion
          </h3>
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-1">
              <Label htmlFor="umask" className="text-xs">umask</Label>
              <Input
                id="umask"
                value={umaskInput}
                onChange={(e) => setUmaskInput(e.target.value)}
                placeholder="022"
                className="h-8 text-xs font-mono w-24"
              />
            </div>
            {umask && (
              <div className="flex gap-3 text-xs">
                <div className="rounded border bg-background px-3 py-2">
                  <div className="text-[10px] uppercase text-muted-foreground">New file</div>
                  <div className="font-mono font-semibold">{umask.fileOctal}</div>
                </div>
                <div className="rounded border bg-background px-3 py-2">
                  <div className="text-[10px] uppercase text-muted-foreground">New dir</div>
                  <div className="font-mono font-semibold">{umask.dirOctal}</div>
                </div>
              </div>
            )}
          </div>
          <p className="text-[10px] text-muted-foreground">
            File = 0666 & ~umask; Dir = 0777 & ~umask. The shell applies this mask to every newly created file/dir.
          </p>
        </CardContent>
      </Card>

      {history.length > 0 && (
        <Card>
          <CardContent className="p-4 space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold flex items-center gap-1.5">
                <History className="h-4 w-4" /> Recent ({history.length})
              </h3>
              <Button variant="ghost" size="sm" onClick={handleClearHistory}>Clear</Button>
            </div>
            <div className="space-y-1 max-h-[180px] overflow-auto">
              {history.map((h, i) => (
                <button
                  key={i}
                  onClick={() => {
                    const m = parseOctal(h.octal);
                    if (m) {
                      setMode(m);
                      setKind(h.kind);
                    }
                  }}
                  className="block w-full text-left rounded border bg-background px-3 py-1.5 text-xs hover:bg-muted"
                >
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-[10px] font-mono">{h.octal}</Badge>
                    <Badge variant="outline" className="text-[10px]">{h.kind}</Badge>
                    <span className="font-mono text-muted-foreground text-[10px]">{h.symbolic}</span>
                    <span className="text-muted-foreground ml-auto text-[10px]">{new Date(h.ts).toLocaleString()}</span>
                  </div>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-3">
          <p className="text-xs text-muted-foreground">
            <strong className="text-foreground">Privacy:</strong> All permission math is pure bitwise computation in your browser. History (last 20) is stored in localStorage on this device only. ACLs and extended attributes are out of scope.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function OutputBox({
  label,
  value,
  hint,
  onCopy,
}: {
  label: string;
  value: string;
  hint?: string;
  onCopy?: () => void;
}) {
  return (
    <div className="rounded border bg-background px-3 py-2">
      <div className="flex items-center justify-between">
        <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
        <CopyButton getText={() => { onCopy?.(); return value; }} label="" size="icon-sm" />
      </div>
      <div className="font-mono text-lg font-semibold text-foreground">{value}</div>
      {hint && <div className="text-[10px] text-muted-foreground font-mono">{hint}</div>}
    </div>
  );
}
