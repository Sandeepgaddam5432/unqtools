"use client";

import React, { useState, useMemo, useCallback, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
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
  History, Binary, Sigma, CheckCircle2, AlertTriangle, FlaskConical,
} from "lucide-react";
import {
  ROUNDING_MODES,
  convertAll,
  parseBatchInput,
  batchConvert,
  detectInputForm,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  type RoundingMode,
  type HistoryEntry,
  type InputForm,
} from "./logic";

type Mode = "single" | "batch";

const FORM_LABELS: Record<InputForm, string> = {
  decimal: "Decimal",
  scientific: "Scientific",
  engineering: "Engineering",
  "e-notation": "E-notation",
  "si-prefixed": "SI-prefixed",
  "binary-prefixed": "Binary-prefixed",
  unknown: "Unknown",
};

export default function ScientificEngineeringNotationConverter() {
  const [input, setInput] = useState("");
  const [sigFigs, setSigFigs] = useState(0);
  const [roundingMode, setRoundingMode] = useState<RoundingMode>("half-up");
  const [binaryPrefixes, setBinaryPrefixes] = useState(false);
  const [mode, setMode] = useState<Mode>("single");
  const [batchText, setBatchText] = useState("");
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  useEffect(() => {
    setHistory(loadHistory());
    if (typeof window !== "undefined" && window.location.hash) {
      const p = parseShareUrl(window.location.hash);
      if (p.input) {
        setInput(p.input);
        setSigFigs(p.sigFigs);
        setRoundingMode(p.roundingMode);
        setBinaryPrefixes(p.binaryPrefixes);
        toast.info("Loaded from share link");
      }
    }
  }, []);

  const result = useMemo(() => {
    if (!input.trim()) return null;
    return convertAll(input, { sigFigs, roundingMode, binaryPrefixes });
  }, [input, sigFigs, roundingMode, binaryPrefixes]);

  const detectedForm = useMemo(
    () => (input.trim() ? detectInputForm(input) : "unknown"),
    [input],
  );

  const batchResults = useMemo(() => {
    if (mode !== "batch" || !batchText.trim()) return [];
    const lines = parseBatchInput(batchText);
    return batchConvert(lines, { sigFigs, roundingMode, binaryPrefixes });
  }, [mode, batchText, sigFigs, roundingMode, binaryPrefixes]);

  const handleSaveHistory = useCallback(() => {
    if (input.trim() && result && !result.error) {
      saveHistory({
        ts: Date.now(),
        input: input.trim(),
        sigFigs,
        roundingMode,
        form: detectedForm,
      });
      setHistory(loadHistory());
    }
  }, [input, result, sigFigs, roundingMode, detectedForm]);

  const handleClear = useCallback(() => {
    setInput("");
    setSigFigs(0);
    setRoundingMode("half-up");
    setBinaryPrefixes(false);
    setBatchText("");
    toast.info("Cleared");
  }, []);

  const handleClearHistory = useCallback(() => {
    clearHistory();
    setHistory([]);
    toast.success("History cleared");
  }, []);

  const allForms = useMemo(() => {
    if (!result || result.error) return [];
    return [
      { label: "Decimal", value: result.decimal },
      { label: "Scientific", value: result.scientific },
      { label: "Engineering", value: result.engineering },
      { label: "E-notation", value: result.eNotation },
      { label: "SI-prefixed", value: result.siPrefixed },
      ...(binaryPrefixes
        ? [{ label: "Binary-prefixed", value: result.binaryPrefixed }]
        : []),
    ];
  }, [result, binaryPrefixes]);

  return (
    <div className="space-y-4 unq-animate-fade-in-up">
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex flex-wrap gap-2">
            <Button
              variant={mode === "single" ? "default" : "outline"}
              size="sm"
              onClick={() => setMode("single")}
            >
              Single
            </Button>
            <Button
              variant={mode === "batch" ? "default" : "outline"}
              size="sm"
              onClick={() => setMode("batch")}
            >
              Batch
            </Button>
          </div>

          {mode === "single" ? (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="sen-input">Number (any form: 1234, 1.23e4, 12.3k, 4.7µ, 1.5e-9)</Label>
                {input.trim() && (
                  <Badge variant="outline" className="text-[10px]">
                    Detected: {FORM_LABELS[detectedForm]}
                  </Badge>
                )}
              </div>
              <Input
                id="sen-input"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="e.g. 6.02214076e23 or 1.234×10^5 or 12.3k"
                className="font-mono text-sm"
              />
            </div>
          ) : (
            <div className="space-y-1.5">
              <Label htmlFor="sen-batch">Numbers (one per line)</Label>
              <Textarea
                id="sen-batch"
                value={batchText}
                onChange={(e) => setBatchText(e.target.value)}
                placeholder={"6.02214076e23\n1.234×10^5\n12.3k\n4.7µ"}
                className="min-h-[120px] resize-y font-mono text-xs"
              />
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
            <div className="space-y-1">
              <Label htmlFor="sen-sig" className="text-xs">Significant figures (0 = auto)</Label>
              <Input
                id="sen-sig"
                type="number"
                min={0}
                max={50}
                value={sigFigs}
                onChange={(e) => setSigFigs(Math.max(0, Math.min(50, parseInt(e.target.value, 10) || 0)))}
                className="font-mono text-sm"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="sen-mode" className="text-xs">Rounding mode</Label>
              <select
                id="sen-mode"
                value={roundingMode}
                onChange={(e) => setRoundingMode(e.target.value as RoundingMode)}
                className="h-9 w-full text-sm rounded border bg-background px-2"
              >
                {ROUNDING_MODES.map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Binary IEC prefixes</Label>
              <label className="flex h-9 items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={binaryPrefixes}
                  onChange={(e) => setBinaryPrefixes(e.target.checked)}
                />
                <span className="text-muted-foreground">Show Ki/Mi/Gi… form</span>
              </label>
            </div>
          </div>
        </CardContent>
      </Card>

      {mode === "single" && result && (
        result.error ? (
          <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
            <AlertTriangle className="h-4 w-4 flex-shrink-0" />
            <span>{result.error}</span>
          </div>
        ) : (
          <Card>
            <CardContent className="p-4 space-y-2">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <Sigma className="h-4 w-4" /> All forms
              </h3>
              <div className="space-y-1.5">
                {allForms.map((f) => (
                  <div
                    key={f.label}
                    className="flex items-center gap-2 rounded border bg-background px-3 py-2"
                  >
                    <Badge variant="outline" className="text-[10px] w-28 justify-center flex-shrink-0">
                      {f.label}
                    </Badge>
                    <span className="flex-1 font-mono text-sm text-foreground break-all">
                      {f.value || "—"}
                    </span>
                    <CopyButton
                      getText={() => { handleSaveHistory(); return f.value; }}
                      label=""
                      successLabel="Copied!"
                      size="icon-sm"
                    />
                  </div>
                ))}
              </div>
              <div className="flex flex-wrap gap-2 pt-2">
                <CopyButton
                  getText={() => {
                    handleSaveHistory();
                    return allForms.map((f) => `${f.label}: ${f.value}`).join("\n");
                  }}
                  label="Copy all"
                />
                <DownloadButton
                  getText={() => allForms.map((f) => `${f.label}: ${f.value}`).join("\n")}
                  filename="notation-conversion.txt"
                  label="Download"
                />
                <ShareButton
                  getUrl={() => {
                    handleSaveHistory();
                    return buildShareUrl({
                      input,
                      sigFigs,
                      roundingMode,
                      binaryPrefixes,
                    });
                  }}
                />
                <ClearButton onClick={handleClear} />
              </div>
            </CardContent>
          </Card>
        )
      )}

      {mode === "single" && !input.trim() && (
        <EmptyState
          title="Enter a number in any notation form"
          hint="Decimal (1234), scientific (1.234×10^3), engineering (12.3×10^3), SI-prefixed (12.3k), or E-notation (1.5e-9). All forms update live."
          icon={<FlaskConical className="h-8 w-8" />}
        />
      )}

      {mode === "batch" && batchResults.length > 0 && (
        <Card>
          <CardContent className="p-4 space-y-2">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
              <Binary className="h-4 w-4" /> Batch results ({batchResults.length})
            </h3>
            <div className="space-y-1 max-h-[500px] overflow-auto">
              {batchResults.map((r, i) => (
                <div
                  key={i}
                  className="rounded border bg-background px-3 py-2 text-xs space-y-1"
                >
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-[10px]">
                      {r.result.error ? (
                        <AlertTriangle className="h-3 w-3" />
                      ) : (
                        <CheckCircle2 className="h-3 w-3" />
                      )}
                    </Badge>
                    <span className="font-mono text-foreground">{r.input}</span>
                    {!r.result.error && (
                      <Badge variant="secondary" className="text-[10px]">
                        {FORM_LABELS[r.result.form]}
                      </Badge>
                    )}
                  </div>
                  {r.result.error ? (
                    <div className="text-destructive text-[11px] pl-7">{r.result.error}</div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-3 gap-y-0.5 pl-7 text-[11px]">
                      <div><span className="text-muted-foreground">Decimal:</span> <span className="font-mono">{r.result.decimal}</span></div>
                      <div><span className="text-muted-foreground">Scientific:</span> <span className="font-mono">{r.result.scientific}</span></div>
                      <div><span className="text-muted-foreground">Engineering:</span> <span className="font-mono">{r.result.engineering}</span></div>
                      <div><span className="text-muted-foreground">E-notation:</span> <span className="font-mono">{r.result.eNotation}</span></div>
                      <div><span className="text-muted-foreground">SI-prefixed:</span> <span className="font-mono">{r.result.siPrefixed}</span></div>
                      {binaryPrefixes && (
                        <div><span className="text-muted-foreground">Binary:</span> <span className="font-mono">{r.result.binaryPrefixed}</span></div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
            <div className="flex flex-wrap gap-2 pt-2">
              <CopyButton
                getText={() => batchResults.map((r) => r.result.error
                  ? `${r.input}\tERROR: ${r.result.error}`
                  : `${r.input}\t${r.result.decimal}\t${r.result.scientific}\t${r.result.engineering}\t${r.result.eNotation}\t${r.result.siPrefixed}`).join("\n")}
                label="Copy all"
              />
              <DownloadButton
                getText={() => batchResults.map((r) => r.result.error
                  ? `${r.input}\tERROR: ${r.result.error}`
                  : `${r.input}\t${r.result.decimal}\t${r.result.scientific}\t${r.result.engineering}\t${r.result.eNotation}\t${r.result.siPrefixed}`).join("\n")}
                filename="notation-batch.txt"
                label="Download"
              />
              <ClearButton onClick={handleClear} />
            </div>
          </CardContent>
        </Card>
      )}

      {history.length > 0 && (
        <Card>
          <CardContent className="p-4 space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <History className="h-4 w-4" /> Recent ({history.length})
              </h3>
              <Button variant="ghost" size="sm" onClick={handleClearHistory}>Clear</Button>
            </div>
            <div className="space-y-1">
              {history.slice(0, 5).map((h, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => {
                    setInput(h.input);
                    setSigFigs(h.sigFigs);
                    setRoundingMode(h.roundingMode);
                    setMode("single");
                  }}
                  className="w-full text-left rounded border bg-background px-3 py-2 text-xs hover:bg-accent"
                >
                  <Badge variant="outline" className="mr-2 text-[10px]">{FORM_LABELS[h.form]}</Badge>
                  {h.sigFigs > 0 && (
                    <Badge variant="outline" className="mr-2 text-[10px]">{h.sigFigs} sf</Badge>
                  )}
                  <span className="font-mono text-foreground">{h.input}</span>
                  <span className="text-muted-foreground ml-2">· {new Date(h.ts).toLocaleString()}</span>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-3">
          <p className="text-xs text-muted-foreground">
            <strong className="text-foreground">Privacy:</strong> All conversions run locally with exact BigInt math. History is stored in localStorage on this device only.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
