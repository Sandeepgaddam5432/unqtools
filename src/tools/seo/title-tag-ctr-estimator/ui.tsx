"use client";

import React, { useState, useCallback, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { ErrorBanner, CopyButton, DownloadButton } from "../../_shared";
import {
  scoreAllTitles,
  estimateCtrAtPosition,
  truncateToPixels,
  findBoldRanges,
  appendBrandSuffix,
  parseBulkInput,
  auditBulk,
  encodePreset,
  decodePreset,
  tokenize,
  TITLE_LIMITS,
  DEFAULT_CTR_CURVE,
  type TitleVariant,
  type TitleScore,
  type BrandSeparator,
} from "./logic";

const DEFAULT_VARIANTS: TitleVariant[] = [
  { id: "a", label: "A", title: "Best Running Shoes 2026 — Reviews & Buying Guide | RunFit" },
  { id: "b", label: "B", title: "Best Running Shoes 2026: Top Picks for Road & Trail" },
  { id: "c", label: "C", title: "17 Best Running Shoes Tested for 200+ Miles (2026)" },
];

function statusColor(status: TitleScore["status"]): string {
  if (status === "good") return "#22c55e";
  if (status === "warn") return "#eab308";
  return "#ef4444";
}

function VariantCard({
  variant,
  keyword,
  position,
  isWinner,
  onUpdate,
  onRemove,
}: {
  variant: TitleVariant;
  keyword: string;
  position: number;
  isWinner: boolean;
  onUpdate: (id: string, patch: Partial<TitleVariant>) => void;
  onRemove: (id: string) => void;
}) {
  const terms = tokenize(keyword);
  const truncated = truncateToPixels(variant.title, TITLE_LIMITS.desktopPx);
  const boldRanges = findBoldRanges(truncated.text, terms);
  const segs: { text: string; bold: boolean }[] = [];
  let cursor = 0;
  for (const r of boldRanges) {
    if (r.start > cursor) segs.push({ text: truncated.text.slice(cursor, r.start), bold: false });
    segs.push({ text: truncated.text.slice(r.start, r.end), bold: true });
    cursor = r.end;
  }
  if (cursor < truncated.text.length) segs.push({ text: truncated.text.slice(cursor), bold: false });
  if (segs.length === 0) segs.push({ text: truncated.text, bold: false });

  return (
    <Card className={isWinner ? "border-primary" : ""}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm flex items-center gap-2">
            <Badge variant="outline">Variant {variant.label}</Badge>
            {isWinner && <Badge variant="default">Winner</Badge>}
          </CardTitle>
          <Button size="icon-sm" variant="ghost" onClick={() => onRemove(variant.id)}>×</Button>
        </div>
      </CardHeader>
      <CardContent className="p-4 pt-0 space-y-2">
        <Input value={variant.title} onChange={(e) => onUpdate(variant.id, { title: e.target.value })} />
        <div className="bg-white dark:bg-[#1a1a1a] p-2 rounded-md text-base">
          <p style={{ color: "#1a0dab" }}>
            {segs.map((s, i) => (
              <span key={i} style={{ fontWeight: s.bold ? 700 : 400 }}>{s.text}</span>
            ))}
          </p>
        </div>
        <p className="text-xs text-muted-foreground">
          {variant.title.length} chars / ~{variant.title.length * 9}px {truncated.truncated ? "(truncated desktop)" : ""}
        </p>
        <div className="h-1.5 rounded bg-muted overflow-hidden">
          <div
            className="h-full"
            style={{
              width: `${Math.min(100, (variant.title.length * 9 / TITLE_LIMITS.desktopPx) * 100)}%`,
              background: variant.title.length * 9 > TITLE_LIMITS.desktopPx ? "#ef4444" : "#22c55e",
            }}
          />
        </div>
      </CardContent>
    </Card>
  );
}

export default function TitleTagCtrEstimator() {
  const [variants, setVariants] = useState<TitleVariant[]>(DEFAULT_VARIANTS);
  const [keyword, setKeyword] = useState("best running shoes");
  const [position, setPosition] = useState(1);
  const [bulkInput, setBulkInput] = useState("");
  const [presetStr, setPresetStr] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [brand, setBrand] = useState("RunFit");
  const [separator, setSeparator] = useState<BrandSeparator>("pipe");

  const result = useMemo(() => {
    const r = scoreAllTitles(variants, keyword);
    if ("error" in r) { queueMicrotask(() => setError(r.error)); return null; }
    queueMicrotask(() => setError(null));
    return r;
  }, [variants, keyword]);

  const bulkResult = useMemo(() => {
    if (!bulkInput.trim()) return null;
    return auditBulk(parseBulkInput(bulkInput));
  }, [bulkInput]);

  const updateVariant = useCallback((id: string, patch: Partial<TitleVariant>) => {
    setVariants((prev) => prev.map((v) => (v.id === id ? { ...v, ...patch } : v)));
  }, []);
  const removeVariant = useCallback((id: string) => {
    setVariants((prev) => prev.filter((v) => v.id !== id));
  }, []);
  const addVariant = useCallback(() => {
    const labels = variants.map((v) => v.label);
    const next = String.fromCharCode(65 + labels.length);
    setVariants((prev) => [...prev, { id: `v${Date.now()}`, label: next, title: "" }]);
  }, [variants]);

  const applyBrandSuffix = useCallback(() => {
    setVariants((prev) => prev.map((v) => {
      if (!v.title) return v;
      // Strip existing suffix first (rough).
      const stripped = v.title.replace(/\s+[\|\u2014\u2013:—-]\s+[A-Za-z0-9 &.+]+$/, "");
      return { ...v, title: appendBrandSuffix(stripped, brand, separator) };
    }));
  }, [brand, separator]);

  const sharePreset = useCallback(() => setPresetStr(encodePreset(variants, keyword)), [variants, keyword]);
  const applyPreset = useCallback(() => {
    const decoded = decodePreset(presetStr);
    if ("error" in decoded) { setError(decoded.error); return; }
    setVariants(decoded.variants);
    setKeyword(decoded.keyword);
    setError(null);
  }, [presetStr]);

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-muted-foreground">Target keyword (for scoring + bolding)</Label>
              <Input value={keyword} onChange={(e) => setKeyword(e.target.value)} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-muted-foreground">SERP position (for CTR estimate): {position}</Label>
              <input type="range" min={1} max={10} value={position} onChange={(e) => setPosition(Number(e.target.value))} className="w-full" />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-muted-foreground">Brand name</Label>
              <Input value={brand} onChange={(e) => setBrand(e.target.value)} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-muted-foreground">Separator</Label>
              <select
                className="h-9 rounded-md border border-input bg-background px-3 text-sm"
                value={separator}
                onChange={(e) => setSeparator(e.target.value as BrandSeparator)}
              >
                <option value="pipe">Pipe |</option>
                <option value="em-dash">Em-dash —</option>
                <option value="colon">Colon :</option>
                <option value="none">None (space)</option>
              </select>
            </div>
            <Button size="sm" onClick={applyBrandSuffix}>Apply brand suffix to all</Button>
          </div>
        </CardContent>
      </Card>

      {error && <ErrorBanner message={error} />}

      {result && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <p className="text-sm font-medium">{result.recommendation}</p>
            {result.duplicates.length > 0 && (
              <p className="text-xs text-yellow-700 dark:text-yellow-400">{"⚠️"} {result.duplicates.length} duplicate group(s) detected.</p>
            )}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {result.variants.map((v) => {
                const variant = variants.find((x) => x.id === v.id);
                if (!variant) return null;
                const ctr = estimateCtrAtPosition(v, position);
                return (
                  <div key={v.id} className="rounded-md border p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">Variant {v.label}</span>
                      <span className="text-xs" style={{ color: statusColor(v.status) }}>{v.qualityScore}/100</span>
                    </div>
                    <div className="h-1.5 rounded bg-muted overflow-hidden">
                      <div className="h-full" style={{ width: `${v.qualityScore}%`, background: statusColor(v.status) }} />
                    </div>
                    <ul className="text-xs space-y-0.5">
                      {v.breakdown.map((b, i) => (
                        <li key={i} className="flex justify-between gap-2">
                          <span className="text-muted-foreground">{b.rule}</span>
                          <span>+{b.points}</span>
                        </li>
                      ))}
                    </ul>
                    <div className="flex flex-wrap gap-1">
                      {v.keywordAtFront && <Badge variant="secondary">KW front</Badge>}
                      {v.hasNumber && <Badge variant="secondary">Number</Badge>}
                      {v.hasBrandSuffix && <Badge variant="secondary">Brand</Badge>}
                      {v.powerWords.length > 0 && <Badge variant="secondary">Power</Badge>}
                      {v.emotionWords.length > 0 && <Badge variant="secondary">Emotion</Badge>}
                    </div>
                    <div className="text-xs pt-1 border-t">
                      <span className="text-muted-foreground">Est. CTR @ pos {position}: </span>
                      <span className="font-medium">{ctr.toFixed(2)}%</span>
                      <span className="text-muted-foreground"> (base {DEFAULT_CTR_CURVE[position - 1]!.toFixed(1)}%)</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {variants.map((v) => (
          <VariantCard
            key={v.id}
            variant={v}
            keyword={keyword}
            position={position}
            isWinner={result?.winner?.id === v.id}
            onUpdate={updateVariant}
            onRemove={removeVariant}
          />
        ))}
      </div>

      <div className="flex gap-2">
        <Button size="sm" onClick={addVariant}>+ Add variant</Button>
      </div>

      {result && (
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-sm">CTR curve (position × variant)</CardTitle></CardHeader>
          <CardContent className="p-4 pt-0">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left border-b">
                  <th className="py-1 pr-2">Variant</th>
                  {Array.from({ length: 10 }, (_, i) => <th key={i} className="py-1 px-1 text-center">P{i + 1}</th>)}
                </tr>
              </thead>
              <tbody>
                {result.variants.map((v) => (
                  <tr key={v.id} className="border-b">
                    <td className="py-1 pr-2 font-medium">{v.label}</td>
                    {v.ctrByPosition.map((c) => (
                      <td key={c.position} className="py-1 px-1 text-center">{c.adjustedCtr.toFixed(1)}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-sm">Bulk audit (paste one URL per line; "url | title")</CardTitle></CardHeader>
        <CardContent className="p-4 pt-0 space-y-2">
          <Textarea value={bulkInput} onChange={(e) => setBulkInput(e.target.value)} rows={5} placeholder={"https://a.com | Best page title\nhttps://b.com | \nhttps://c.com | same title"} />
          {bulkResult && (
            <>
              <div className="flex flex-wrap gap-2">
                <Badge variant="outline">OK: {bulkResult.ok}</Badge>
                <Badge variant="outline">Missing: {bulkResult.missing}</Badge>
                <Badge variant="outline">Duplicates: {bulkResult.duplicates}</Badge>
                <Badge variant="outline">Too long: {bulkResult.tooLong}</Badge>
                <Badge variant="outline">Too short: {bulkResult.tooShort}</Badge>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-left border-b">
                      <th className="py-1 pr-2">URL</th>
                      <th className="py-1 pr-2">Title</th>
                      <th className="py-1 pr-2">Chars</th>
                      <th className="py-1 pr-2">Status</th>
                      <th className="py-1 pr-2">Note</th>
                    </tr>
                  </thead>
                  <tbody>
                    {bulkResult.rows.map((r, i) => (
                      <tr key={i} className="border-b">
                        <td className="py-1 pr-2 truncate max-w-[120px]">{r.url}</td>
                        <td className="py-1 pr-2 truncate max-w-[200px]">{r.title || "(empty)"}</td>
                        <td className="py-1 pr-2">{r.charCount}</td>
                        <td className="py-1 pr-2"><Badge variant="outline">{r.status}</Badge></td>
                        <td className="py-1 pr-2 text-muted-foreground">{r.note}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <DownloadButton getText={() => bulkResult.csv} filename="title-audit.csv" mime="text/csv" />
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-sm">Shareable preset</CardTitle></CardHeader>
        <CardContent className="p-4 pt-0 space-y-2">
          <div className="flex gap-2">
            <Button size="sm" onClick={sharePreset}>Generate preset</Button>
            <Button size="sm" variant="ghost" onClick={() => navigator.clipboard.writeText(presetStr)}>Copy</Button>
          </div>
          <Input value={presetStr} onChange={(e) => setPresetStr(e.target.value)} placeholder="Paste a preset string here" />
          <Button size="sm" variant="outline" onClick={applyPreset}>Apply preset</Button>
        </CardContent>
      </Card>

      {result?.winner && (
        <Card>
          <CardContent className="p-4 flex flex-wrap gap-2 justify-end">
            <CopyButton getText={() => variants.find((v) => v.id === result.winner!.id)?.title ?? ""} label="Copy winning title" />
          </CardContent>
        </Card>
      )}

      <Card><CardContent className="p-4">
        <p className="text-xs text-muted-foreground"><strong className="text-foreground">Honest note:</strong> CTR is an estimate from published curves + a quality heuristic — actual CTR varies by niche, intent, and SERP features, and Google sometimes rewrites titles. All processing is local.</p>
      </CardContent></Card>
    </div>
  );
}
