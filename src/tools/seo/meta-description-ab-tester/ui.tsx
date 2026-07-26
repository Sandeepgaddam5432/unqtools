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
  scoreAllVariants,
  truncateToPixels,
  findBoldRanges,
  generateDraftFromContent,
  parseBulkInput,
  auditBulk,
  encodePreset,
  decodePreset,
  tokenize,
  META_LIMITS,
  type Variant,
  type VariantScore,
} from "./logic";

const DEFAULT_VARIANTS: Variant[] = [
  { id: "a", label: "A", description: "Best running shoes 2026 — tested 200+ miles. See our top picks for road, trail, and racing now." },
  { id: "b", label: "B", description: "Discover the best running shoes of 2026 with expert reviews and free buying guide. Find your perfect pair today." },
  { id: "c", label: "C", description: "Top-rated running shoes for 2026. Compare 47 tested models by fit, weight, and price. Save 30%." },
];

function statusColor(status: VariantScore["status"]): string {
  if (status === "good") return "#22c55e";
  if (status === "warn") return "#eab308";
  return "#ef4444";
}

/** Render a single variant card with SERP preview + score breakdown. */
function VariantCard({
  variant,
  keyword,
  isWinner,
  onUpdate,
  onRemove,
}: {
  variant: Variant;
  keyword: string;
  isWinner: boolean;
  onUpdate: (id: string, patch: Partial<Variant>) => void;
  onRemove: (id: string) => void;
}) {
  const terms = tokenize(keyword);
  const truncated = truncateToPixels(variant.description, META_LIMITS.desktopPx);
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
        <Textarea
          value={variant.description}
          onChange={(e) => onUpdate(variant.id, { description: e.target.value })}
          rows={3}
        />
        <div className="bg-white dark:bg-[#1a1a1a] p-2 rounded-md text-sm">
          <p style={{ color: "#1a0dab" }}>
            {segs.map((s, i) => (
              <span key={i} style={{ fontWeight: s.bold ? 700 : 400 }}>{s.text}</span>
            ))}
          </p>
        </div>
        <p className="text-xs text-muted-foreground">
          {variant.description.length} chars / ~{truncated.text.length * 6}px {truncated.truncated ? "(truncated)" : ""}
        </p>
      </CardContent>
    </Card>
  );
}

export default function MetaDescriptionAbTester() {
  const [variants, setVariants] = useState<Variant[]>(DEFAULT_VARIANTS);
  const [keyword, setKeyword] = useState("best running shoes");
  const [bulkInput, setBulkInput] = useState("");
  const [contentInput, setContentInput] = useState("");
  const [presetStr, setPresetStr] = useState("");
  const [error, setError] = useState<string | null>(null);

  const result = useMemo(() => {
    const r = scoreAllVariants(variants, keyword);
    if ("error" in r) { queueMicrotask(() => setError(r.error)); return null; }
    queueMicrotask(() => setError(null));
    return r;
  }, [variants, keyword]);

  const bulkResult = useMemo(() => {
    if (!bulkInput.trim()) return null;
    return auditBulk(parseBulkInput(bulkInput));
  }, [bulkInput]);

  const updateVariant = useCallback((id: string, patch: Partial<Variant>) => {
    setVariants((prev) => prev.map((v) => (v.id === id ? { ...v, ...patch } : v)));
  }, []);
  const removeVariant = useCallback((id: string) => {
    setVariants((prev) => prev.filter((v) => v.id !== id));
  }, []);
  const addVariant = useCallback(() => {
    const labels = variants.map((v) => v.label);
    const next = String.fromCharCode(65 + labels.length);
    setVariants((prev) => [...prev, { id: `v${Date.now()}`, label: next, description: "" }]);
  }, [variants]);

  const generateDraft = useCallback(() => {
    const draft = generateDraftFromContent(contentInput, keyword);
    if (draft) {
      const labels = variants.map((v) => v.label);
      const next = String.fromCharCode(65 + labels.length);
      setVariants((prev) => [...prev, { id: `v${Date.now()}`, label: next, description: draft }]);
    }
  }, [contentInput, keyword, variants]);

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
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs text-muted-foreground">Target keyword / query (for scoring + bolding)</Label>
            <Input value={keyword} onChange={(e) => setKeyword(e.target.value)} />
          </div>
        </CardContent>
      </Card>

      {error && <ErrorBanner message={error} />}

      {result && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <p className="text-sm font-medium">{result.recommendation}</p>
            {result.duplicates.length > 0 && (
              <p className="text-xs text-yellow-700 dark:text-yellow-400">
                {"⚠️"} {result.duplicates.length} duplicate group(s) detected.
              </p>
            )}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {result.variants.map((v) => {
                const variant = variants.find((x) => x.id === v.id);
                if (!variant) return null;
                return (
                  <div key={v.id} className="rounded-md border p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">Variant {v.label}</span>
                      <span className="text-xs" style={{ color: statusColor(v.status) }}>
                        {v.score}/100
                      </span>
                    </div>
                    <div className="h-1.5 rounded bg-muted overflow-hidden">
                      <div className="h-full" style={{ width: `${v.score}%`, background: statusColor(v.status) }} />
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
                      {v.hasCta && <Badge variant="secondary">CTA</Badge>}
                      {v.powerWords.length > 0 && <Badge variant="secondary">Power words</Badge>}
                      {v.emotionWords.length > 0 && <Badge variant="secondary">Emotion</Badge>}
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
            isWinner={result?.winner?.id === v.id}
            onUpdate={updateVariant}
            onRemove={removeVariant}
          />
        ))}
      </div>

      <div className="flex gap-2">
        <Button size="sm" onClick={addVariant}>+ Add variant</Button>
      </div>

      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-sm">On-device draft generator</CardTitle></CardHeader>
        <CardContent className="p-4 pt-0 space-y-2">
          <Textarea value={contentInput} onChange={(e) => setContentInput(e.target.value)} rows={4} placeholder="Paste page content (text or HTML stripped) — a draft description will be extracted." />
          <Button size="sm" onClick={generateDraft}>Generate draft variant</Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-sm">Bulk audit (paste one URL per line; "url | description")</CardTitle></CardHeader>
        <CardContent className="p-4 pt-0 space-y-2">
          <Textarea value={bulkInput} onChange={(e) => setBulkInput(e.target.value)} rows={5} placeholder={"https://a.com | Best running shoes for 2026\nhttps://b.com | \nhttps://c.com | same text"} />
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
                      <th className="py-1 pr-2">Description</th>
                      <th className="py-1 pr-2">Chars</th>
                      <th className="py-1 pr-2">Status</th>
                      <th className="py-1 pr-2">Note</th>
                    </tr>
                  </thead>
                  <tbody>
                    {bulkResult.rows.map((r, i) => (
                      <tr key={i} className="border-b">
                        <td className="py-1 pr-2 truncate max-w-[120px]">{r.url}</td>
                        <td className="py-1 pr-2 truncate max-w-[200px]">{r.description || "(empty)"}</td>
                        <td className="py-1 pr-2">{r.charCount}</td>
                        <td className="py-1 pr-2"><Badge variant="outline">{r.status}</Badge></td>
                        <td className="py-1 pr-2 text-muted-foreground">{r.note}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <DownloadButton getText={() => bulkResult.csv} filename="meta-description-audit.csv" mime="text/csv" />
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
            <CopyButton getText={() => variants.find((v) => v.id === result.winner!.id)?.description ?? ""} label="Copy winning description" />
          </CardContent>
        </Card>
      )}

      <Card><CardContent className="p-4">
        <p className="text-xs text-muted-foreground"><strong className="text-foreground">Honest note:</strong> CTR scores are heuristics, not click guarantees. Google often rewrites descriptions. Pixel cutoffs versioned Jun 2026. All processing is local.</p>
      </CardContent></Card>
    </div>
  );
}
