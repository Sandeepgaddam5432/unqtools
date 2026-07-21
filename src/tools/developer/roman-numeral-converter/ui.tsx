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
  EmptyState,
  ShareButton,
  ClearButton,
  ErrorBanner,
} from "../../_shared";
import { toast } from "sonner";
import {
  History, Hash, ArrowLeftRight, BookOpen, ListOrdered,
  CheckCircle2, AlertTriangle, Calendar,
} from "lucide-react";
import {
  STANDARD_MAX,
  VINCULUM_MAX,
  COMBINING_OVERLINE,
  ROMAN_PRESETS,
  HISTORY_FACTS,
  arabicToRoman,
  romanToArabic,
  validateRoman,
  decomposeArabic,
  decomposeRoman,
  parseBatch,
  renderBatchText,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  hasVinculum,
  type ConversionMode,
  type ValidationMode,
  type HistoryEntry,
} from "./logic";

type Direction = "to-roman" | "to-arabic";

/** Render a Roman string with HTML overline spans (instead of combining marks) for display. */
function OverlineRoman({ text }: { text: string }) {
  if (!text) return null;
  // Walk through and split into runs of overlined vs non-overlined chars.
  const runs: { chars: string; over: boolean }[] = [];
  let i = 0;
  while (i < text.length) {
    const ch = text[i];
    const over = i + 1 < text.length && text[i + 1] === COMBINING_OVERLINE;
    if (over) i += 2;
    else i += 1;
    if (runs.length > 0 && runs[runs.length - 1].over === over) {
      runs[runs.length - 1].chars += ch;
    } else {
      runs.push({ chars: ch, over });
    }
  }
  return (
    <>
      {runs.map((r, idx) =>
        r.over
          ? <span key={idx} className="overline-roman" style={{ textDecoration: "overline" }}>{r.chars}</span>
          : <span key={idx}>{r.chars}</span>,
      )}
    </>
  );
}

export default function RomanNumeralConverter() {
  const [direction, setDirection] = useState<Direction>("to-roman");
  const [input, setInput] = useState("1994");
  const [mode, setMode] = useState<ConversionMode>("vinculum");
  const [validation, setValidation] = useState<ValidationMode>("strict");
  const [batchText, setBatchText] = useState("");
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  useEffect(() => {
    setHistory(loadHistory());
    if (typeof window !== "undefined" && window.location.hash) {
      const p = parseShareUrl(window.location.hash);
      if (p.direction) setDirection(p.direction);
      if (p.input) setInput(p.input);
      if (p.input || p.direction !== "to-roman") toast.info("Loaded from share link");
    }
  }, []);

  // Single-conversion result (live).
  const singleResult = useMemo(() => {
    if (!input.trim()) return null;
    if (direction === "to-roman") {
      const n = Number(input.replace(/[, ]/g, ""));
      if (!Number.isFinite(n) || !/^-?\d+$/.test(input.replace(/[, ]/g, ""))) {
        return { ok: false, error: "Enter a positive integer (1 or higher)." };
      }
      const r = arabicToRoman(n, mode);
      return r;
    } else {
      const r = romanToArabic(input, validation);
      return r;
    }
  }, [input, direction, mode, validation]);

  // Breakdown.
  const breakdown = useMemo(() => {
    if (!input.trim()) return null;
    if (direction === "to-roman") {
      const n = Number(input.replace(/[, ]/g, ""));
      if (!Number.isFinite(n) || !/^-?\d+$/.test(input.replace(/[, ]/g, ""))) return null;
      return decomposeArabic(n, mode);
    }
    return decomposeRoman(input);
  }, [input, direction, mode]);

  // Validation result (always run — useful for highlighting input).
  const validationInfo = useMemo(() => {
    if (direction !== "to-arabic" || !input.trim()) return null;
    return validateRoman(input, validation);
  }, [input, direction, validation]);

  const batchResult = useMemo(() => parseBatch(batchText), [batchText]);

  const handleSaveHistory = useCallback(() => {
    if (singleResult && singleResult.ok) {
      const output = direction === "to-roman"
        ? (singleResult as { roman: string }).roman
        : String((singleResult as { value: number }).value);
      if (output) {
        saveHistory({
          ts: Date.now(),
          direction,
          input,
          output,
          vinculum: hasVinculum(output) || direction === "to-arabic" && (singleResult as { usedVinculum?: boolean }).usedVinculum === true,
        });
        setHistory(loadHistory());
      }
    }
  }, [singleResult, direction, input]);

  const handleClear = useCallback(() => {
    setInput("");
    toast.info("Cleared");
  }, []);

  const handleClearHistory = useCallback(() => {
    clearHistory();
    setHistory([]);
    toast.success("History cleared");
  }, []);

  const applyPreset = (i: number) => {
    const p = ROMAN_PRESETS[i];
    setDirection("to-roman");
    setInput(p.value);
    setMode("vinculum");
    toast.info(`Loaded preset: ${p.label}`);
  };

  const swapDirection = () => {
    if (singleResult && singleResult.ok) {
      const newInput = direction === "to-roman"
        ? (singleResult as { roman: string }).roman
        : String((singleResult as { value: number }).value);
      setDirection(direction === "to-roman" ? "to-arabic" : "to-roman");
      setInput(newInput);
      toast.info("Swapped direction");
    } else {
      setDirection(direction === "to-roman" ? "to-arabic" : "to-roman");
      toast.info("Swapped direction");
    }
  };

  return (
    <div className="space-y-4 unq-animate-fade-in-up">
      {/* ============= Single Converter ============= */}
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
              <ArrowLeftRight className="h-4 w-4" /> Converter
            </h3>
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="outline" size="sm" onClick={swapDirection} className="gap-1.5">
                <ArrowLeftRight className="h-3.5 w-3.5" /> Swap
              </Button>
            </div>
          </div>

          <div className="flex flex-wrap gap-1">
            <Button
              variant={direction === "to-roman" ? "default" : "outline"}
              size="sm"
              onClick={() => setDirection("to-roman")}
            >Arabic → Roman</Button>
            <Button
              variant={direction === "to-arabic" ? "default" : "outline"}
              size="sm"
              onClick={() => setDirection("to-arabic")}
            >Roman → Arabic</Button>
          </div>

          <div className="grid sm:grid-cols-2 gap-2">
            <div className="space-y-1.5">
              <Label htmlFor="r-input" className="text-xs">
                {direction === "to-roman" ? "Arabic number (e.g. 1994)" : "Roman numeral (e.g. MCMXCIV)"}
              </Label>
              <Input
                id="r-input"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={direction === "to-roman" ? "1994" : "MCMXCIV"}
                className={`font-mono text-sm h-9 ${validationInfo && !validationInfo.valid ? "border-destructive" : ""}`}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">
                {direction === "to-roman" ? "Conversion mode" : "Validation mode"}
              </Label>
              {direction === "to-roman" ? (
                <select
                  value={mode}
                  onChange={(e) => setMode(e.target.value as ConversionMode)}
                  className="h-9 w-full text-xs rounded border bg-background px-2"
                >
                  <option value="standard">Standard (max 3,999)</option>
                  <option value="vinculum">Vinculum / overline (max 3,999,999)</option>
                </select>
              ) : (
                <select
                  value={validation}
                  onChange={(e) => setValidation(e.target.value as ValidationMode)}
                  className="h-9 w-full text-xs rounded border bg-background px-2"
                >
                  <option value="strict">Strict (reject IIII, IC, VV)</option>
                  <option value="lenient">Lenient (allow any Roman chars)</option>
                </select>
              )}
            </div>
          </div>

          <div className="flex flex-wrap gap-1">
            {ROMAN_PRESETS.map((p, i) => (
              <Button
                key={i}
                variant="ghost"
                size="sm"
                className="h-6 text-[11px]"
                onClick={() => applyPreset(i)}
                title={p.description}
              >{p.label}</Button>
            ))}
          </div>

          {singleResult && !singleResult.ok && input.trim() !== "" && (
            <ErrorBanner message={singleResult.error ?? "Invalid input."} />
          )}

          {singleResult && singleResult.ok && (
            <div className="rounded-lg border bg-background p-3 space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="secondary" className="gap-1">
                  <CheckCircle2 className="h-3 w-3" /> Result
                </Badge>
                {direction === "to-arabic" && (singleResult as { usedVinculum?: boolean }).usedVinculum && (
                  <Badge variant="outline" className="text-[10px]">vinculum</Badge>
                )}
                {direction === "to-roman" && hasVinculum((singleResult as { roman: string }).roman) && (
                  <Badge variant="outline" className="text-[10px]">vinculum (×1000)</Badge>
                )}
              </div>
              <div className="text-2xl font-mono font-semibold text-foreground break-all">
                {direction === "to-roman"
                  ? <OverlineRoman text={(singleResult as { roman: string }).roman} />
                  : (singleResult as { value: number }).value.toLocaleString()}
              </div>
              <div className="text-xs text-muted-foreground">
                {direction === "to-roman"
                  ? <>Arabic <span className="font-mono text-foreground">{Number(input.replace(/[, ]/g, "")).toLocaleString()}</span> → Roman</>
                  : <>Roman <span className="font-mono text-foreground">{input}</span> → Arabic</>}
              </div>

              {breakdown && breakdown.ok && breakdown.steps && (
                <div className="rounded border bg-card p-2 space-y-1">
                  <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Additive / subtractive breakdown</div>
                  <div className="flex flex-wrap gap-1">
                    {breakdown.steps.map((st, i) => (
                      <span key={i} className="inline-flex items-center gap-1 rounded bg-muted/60 px-1.5 py-0.5 text-[11px]">
                        {i > 0 && <span className="text-muted-foreground">+</span>}
                        <span className="font-mono font-medium text-foreground">
                          {direction === "to-roman" ? <OverlineRoman text={st.piece} /> : <OverlineRoman text={st.piece} />}
                        </span>
                        <span className="text-muted-foreground text-[10px]">({st.formula} = {st.value.toLocaleString()})</span>
                        <span className="text-[10px] text-muted-foreground">→ {st.cumulative.toLocaleString()}</span>
                      </span>
                    ))}
                  </div>
                  <div className="text-xs text-foreground font-mono pt-1">= {breakdown.total?.toLocaleString()}</div>
                </div>
              )}

              <div className="flex flex-wrap gap-2 pt-1">
                <CopyButton
                  getText={() => {
                    handleSaveHistory();
                    return direction === "to-roman"
                      ? (singleResult as { roman: string }).roman
                      : String((singleResult as { value: number }).value);
                  }}
                  label="Copy result"
                />
                <ShareButton getUrl={() => { handleSaveHistory(); return buildShareUrl(direction, input); }} />
                <ClearButton onClick={handleClear} />
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ============= Batch Converter ============= */}
      <Card>
        <CardContent className="p-4 space-y-3">
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
            <ListOrdered className="h-4 w-4" /> Batch Convert
          </h3>
          <p className="text-[11px] text-muted-foreground">
            Paste a list (one per line, or comma/semicolon separated). Each line is auto-detected: numbers → Roman (vinculum mode), anything else → Arabic (strict mode).
          </p>
          <Textarea
            value={batchText}
            onChange={(e) => setBatchText(e.target.value)}
            placeholder={"1994\nMMXXIV\n4000\n2024"}
            className="min-h-[80px] resize-y font-mono text-xs"
          />
          {batchText.trim() && (
            <div className="rounded border bg-background p-2 space-y-1 max-h-[260px] overflow-auto">
              {batchResult.entries.map((e, i) => (
                <div key={i} className="flex items-center gap-2 text-xs">
                  <Badge variant="outline" className="text-[10px]">
                    {batchResult.direction[i] === "to-roman" ? "→R" : "→A"}
                  </Badge>
                  <span className="font-mono text-foreground w-32 truncate">{e.input}</span>
                  <span className="text-muted-foreground">→</span>
                  {e.ok ? (
                    <span className="font-mono text-foreground flex-1 truncate">
                      {batchResult.direction[i] === "to-roman"
                        ? <OverlineRoman text={e.output ?? ""} />
                        : e.output}
                    </span>
                  ) : (
                    <span className="text-destructive text-[11px] flex-1 truncate">
                      <AlertTriangle className="inline h-3 w-3 mr-1" />{e.error}
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
          {batchText.trim() && (
            <div className="flex flex-wrap gap-2">
              <CopyButton getText={() => renderBatchText(batchResult)} label="Copy batch as text" />
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setBatchText("")}
                className="gap-1.5"
              >Clear batch</Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ============= Year Helper ============= */}
      <Card>
        <CardContent className="p-4 space-y-2">
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
            <Calendar className="h-4 w-4" /> Year Helper
          </h3>
          <p className="text-[11px] text-muted-foreground">
            Common years rendered in Roman form (vinculum mode for years &gt; 3999):
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
            {[1492, 1776, 1969, 1989, 2000, 2024, 2025, 3999].map((y) => {
              const r = arabicToRoman(y, "vinculum");
              return (
                <div key={y} className="rounded border bg-background p-2">
                  <div className="font-mono text-foreground text-sm">{y}</div>
                  <div className="font-mono text-muted-foreground text-xs break-all">
                    {r.ok ? <OverlineRoman text={r.roman ?? ""} /> : "—"}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* ============= History ============= */}
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
                  onClick={() => { setDirection(h.direction); setInput(h.input); toast.info("Loaded from history"); }}
                  className="w-full text-left rounded border bg-background px-3 py-2 text-xs hover:bg-muted/30"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline" className="text-[10px]">{h.direction === "to-roman" ? "→R" : "→A"}</Badge>
                    <span className="font-mono text-foreground">{h.input}</span>
                    <span className="text-muted-foreground">→</span>
                    <span className="font-mono text-foreground">
                      {h.direction === "to-roman" ? <OverlineRoman text={h.output} /> : h.output}
                    </span>
                    {h.vinculum && <Badge variant="outline" className="text-[10px]">vinculum</Badge>}
                    <span className="text-muted-foreground ml-auto">{new Date(h.ts).toLocaleString()}</span>
                  </div>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ============= History of Roman numerals ============= */}
      <Card>
        <CardContent className="p-4 space-y-2">
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
            <BookOpen className="h-4 w-4" /> History of Roman Numerals
          </h3>
          <div className="grid sm:grid-cols-2 gap-2">
            {HISTORY_FACTS.map((f, i) => (
              <div key={i} className="rounded border bg-background p-2 text-xs">
                <div className="font-medium text-foreground">{f.title}</div>
                <div className="text-[11px] text-muted-foreground mt-1">{f.body}</div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* ============= Reference ============= */}
      <Card>
        <CardContent className="p-3 space-y-2">
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
            <Hash className="h-4 w-4" /> Quick Reference
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
            {[
              { s: "I", v: "1" }, { s: "V", v: "5" }, { s: "X", v: "10" }, { s: "L", v: "50" },
              { s: "C", v: "100" }, { s: "D", v: "500" }, { s: "M", v: "1000" },
              { s: `V${COMBINING_OVERLINE}`, v: "5000" }, { s: `X${COMBINING_OVERLINE}`, v: "10000" },
              { s: `C${COMBINING_OVERLINE}`, v: "100000" }, { s: `M${COMBINING_OVERLINE}`, v: "1000000" },
              { s: "—", v: "0 (nulla)" },
            ].map((row, i) => (
              <div key={i} className="rounded border bg-background p-2 text-center">
                <div className="font-mono text-lg font-semibold text-foreground">
                  <OverlineRoman text={row.s} />
                </div>
                <div className="text-[10px] text-muted-foreground">{row.v}</div>
              </div>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-2 text-[11px] text-muted-foreground">
            <div>Standard max: <span className="font-mono text-foreground">{STANDARD_MAX.toLocaleString()}</span></div>
            <div>Vinculum max: <span className="font-mono text-foreground">{VINCULUM_MAX.toLocaleString()}</span></div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
