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
} from "../../_shared";
import { toast } from "sonner";
import {
  History, Binary, Search, Type as TypeIcon, Table2,
  CheckCircle2, AlertTriangle,
} from "lucide-react";
import {
  UNICODE_BLOCKS,
  codePointInfo,
  characterInfo,
  asciiTable,
  blockTable,
  decomposeString,
  searchCodePoints,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  type CharInfo,
  type HistoryEntry,
  type UnicodeBlock,
} from "./logic";

type Mode = "ascii" | "block" | "search" | "string";

const MODES: { mode: Mode; label: string; hint: string }[] = [
  { mode: "ascii", label: "ASCII table (0–127)", hint: "Browse all 128 ASCII characters" },
  { mode: "block", label: "Unicode block browser", hint: "Pick a Unicode block to inspect" },
  { mode: "search", label: "Code point search", hint: "Search by char, decimal, hex, or name" },
  { mode: "string", label: "String decompose", hint: "Paste a string and see every code point" },
];

export default function AsciiUnicodeCodePointExplorer() {
  const [mode, setMode] = useState<Mode>("ascii");
  const [searchText, setSearchText] = useState("");
  const [stringText, setStringText] = useState("");
  const [blockName, setBlockName] = useState<string>("Basic Latin");
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  useEffect(() => {
    setHistory(loadHistory());
    if (typeof window !== "undefined" && window.location.hash) {
      const p = parseShareUrl(window.location.hash);
      setMode(p.mode);
      if (p.mode === "search") setSearchText(p.query);
      else if (p.mode === "string") setStringText(p.query);
      else if (p.mode === "block") setBlockName(p.query || "Basic Latin");
      if (p.mode || p.query) toast.info("Loaded from share link");
    }
  }, []);

  const asciiRows = useMemo<CharInfo[]>(() => mode === "ascii" ? asciiTable() : [], [mode]);
  const blockRows = useMemo<CharInfo[]>(() => {
    if (mode !== "block") return [];
    const b = UNICODE_BLOCKS.find((x) => x.name === blockName);
    return b ? blockTable(b, 256) : [];
  }, [mode, blockName]);
  const searchResult = useMemo(() => {
    if (mode !== "search" || !searchText.trim()) return null;
    return searchCodePoints(searchText);
  }, [mode, searchText]);
  const decomposed = useMemo<CharInfo[]>(() => {
    if (mode !== "string" || !stringText) return [];
    return decomposeString(stringText);
  }, [mode, stringText]);

  const handleSaveHistory = useCallback((query: string, codePoint: number | null) => {
    if (query.trim()) {
      saveHistory({ ts: Date.now(), query: query.trim(), codePoint });
      setHistory(loadHistory());
    }
  }, []);

  const handleClear = useCallback(() => {
    setSearchText("");
    setStringText("");
    setBlockName("Basic Latin");
    setMode("ascii");
    toast.info("Cleared");
  }, []);

  const handleClearHistory = useCallback(() => {
    clearHistory();
    setHistory([]);
    toast.success("History cleared");
  }, []);

  const shareQuery = useMemo(() => {
    if (mode === "search") return searchText;
    if (mode === "string") return stringText;
    if (mode === "block") return blockName;
    return "";
  }, [mode, searchText, stringText, blockName]);

  return (
    <div className="space-y-4 unq-animate-fade-in-up">
      <Card>
        <CardContent className="p-4 space-y-3">
          <div>
            <Label className="text-xs">Mode</Label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 pt-1">
              {MODES.map((m) => (
                <Button
                  key={m.mode}
                  variant={mode === m.mode ? "default" : "outline"}
                  size="sm"
                  className="text-[11px] h-8 justify-start"
                  onClick={() => setMode(m.mode)}
                >
                  {m.label}
                </Button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {mode === "ascii" && (
        <Card>
          <CardContent className="p-4 space-y-2">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
              <Table2 className="h-4 w-4" /> ASCII table (128 characters)
            </h3>
            <CharGrid infos={asciiRows} onSelect={(cp) => handleSaveHistory(`U+${cp.toString(16).toUpperCase().padStart(4, "0")}`, cp)} />
          </CardContent>
        </Card>
      )}

      {mode === "block" && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="au-block">Unicode block</Label>
              <select
                id="au-block"
                value={blockName}
                onChange={(e) => setBlockName(e.target.value)}
                className="h-9 w-full text-xs rounded border bg-background px-2"
              >
                {UNICODE_BLOCKS.map((b) => (
                  <option key={b.name} value={b.name}>
                    {b.name} (U+{b.start.toString(16).toUpperCase().padStart(4, "0")}–U+{b.end.toString(16).toUpperCase().padStart(4, "0")})
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <Table2 className="h-4 w-4" /> {blockName} ({blockRows.length} code points shown — capped at 256)
              </h3>
              <CharGrid infos={blockRows} onSelect={(cp) => handleSaveHistory(`U+${cp.toString(16).toUpperCase().padStart(4, "0")}`, cp)} />
            </div>
          </CardContent>
        </Card>
      )}

      {mode === "search" && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="au-search">Search query (character, decimal, hex, or name)</Label>
              <Input
                id="au-search"
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                placeholder="A, 65, U+0041, 0x41, or LATIN CAPITAL"
                className="font-mono text-sm"
              />
              <p className="text-[11px] text-muted-foreground">
                Try a literal character, a decimal code, U+XXXX / 0xXXXX hex, or part of a Unicode name.
              </p>
            </div>
            {searchResult && searchResult.results.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center gap-1.5 text-xs">
                  <Badge variant="outline">{searchResult.mode}</Badge>
                  <span className="text-muted-foreground">{searchResult.results.length} result(s)</span>
                </div>
                {searchResult.results.slice(0, 20).map((info) => (
                  <CharInfoCard key={info.codePoint} info={info} onSave={() => handleSaveHistory(searchText, info.codePoint)} />
                ))}
                {searchResult.results.length > 20 && (
                  <p className="text-[11px] text-muted-foreground">
                    Showing first 20 of {searchResult.results.length} results — refine your search for more.
                  </p>
                )}
              </div>
            )}
            {searchResult && searchResult.results.length === 0 && (
              <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
                <AlertTriangle className="h-4 w-4 flex-shrink-0" />
                <span>No matches for &quot;{searchText}&quot;. Try a literal character, decimal, hex, or name substring.</span>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {mode === "string" && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="au-string">Paste any string</Label>
              <Textarea
                id="au-string"
                value={stringText}
                onChange={(e) => setStringText(e.target.value)}
                placeholder="Hello, 世界! 😀"
                className="min-h-[80px] resize-y font-mono text-sm"
              />
              <p className="text-[11px] text-muted-foreground">
                The string is decomposed code-point-by-code-point — astral characters (like emoji) are handled correctly via surrogate pairs.
              </p>
            </div>
            {decomposed.length > 0 && (
              <div className="space-y-2">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                  <TypeIcon className="h-4 w-4" /> {decomposed.length} code point(s)
                </h3>
                <div className="space-y-2 max-h-[600px] overflow-auto">
                  {decomposed.map((info, i) => (
                    <CharInfoCard
                      key={`${info.codePoint}-${i}`}
                      info={info}
                      onSave={() => handleSaveHistory(stringText, info.codePoint)}
                    />
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {mode === "ascii" && (
        <EmptyState
          title="ASCII characters above"
          hint="The first 128 Unicode code points — the foundation of every text encoding."
          icon={<Table2 className="h-8 w-8" />}
        />
      )}

      <div className="flex flex-wrap gap-2">
        <ShareButton
          getUrl={() => {
            handleSaveHistory(shareQuery, null);
            return buildShareUrl({ mode, query: shareQuery });
          }}
        />
        <ClearButton onClick={handleClear} />
      </div>

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
                    if (h.codePoint !== null) {
                      setMode("search");
                      setSearchText(h.query);
                    } else {
                      setMode("search");
                      setSearchText(h.query);
                    }
                  }}
                  className="w-full text-left rounded border bg-background px-3 py-2 text-xs hover:bg-accent"
                >
                  {h.codePoint !== null && (
                    <Badge variant="outline" className="mr-2 text-[10px]">U+{h.codePoint.toString(16).toUpperCase().padStart(4, "0")}</Badge>
                  )}
                  <span className="font-mono text-foreground break-all">{h.query}</span>
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
            <strong className="text-foreground">Privacy:</strong> All lookups run locally against a bundled Unicode block & ASCII name list. History is stored in localStorage on this device only. The bundled data is a curated snapshot — brand-new Unicode releases may lag until the data is updated.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function CharGrid({ infos, onSelect }: { infos: CharInfo[]; onSelect: (cp: number) => void }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-1 max-h-[400px] overflow-auto">
      {infos.map((info) => (
        <button
          key={info.codePoint}
          type="button"
          onClick={() => onSelect(info.codePoint)}
          className="rounded border bg-background px-2 py-1.5 text-left text-[10px] hover:bg-accent"
          title={`${info.name} — ${info.uPlus}`}
        >
          <div className="flex items-center justify-between">
            <span className="font-mono text-muted-foreground">{info.uPlus.replace("U+", "")}</span>
            <span className="font-mono text-base text-foreground">
              {info.isPrintable ? info.character : info.isControl ? "•" : "·"}
            </span>
          </div>
          <div className="font-mono text-muted-foreground truncate">{info.name}</div>
        </button>
      ))}
    </div>
  );
}

function CharInfoCard({ info, onSave }: { info: CharInfo; onSave: () => void }) {
  const display = info.isPrintable
    ? info.character
    : info.isControl
      ? `<control> ${info.name}`
      : `<non-printable> ${info.name}`;
  return (
    <div className="rounded border bg-background p-3 space-y-2">
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-3xl font-mono text-foreground">
              {info.isPrintable ? info.character : "·"}
            </span>
            <div>
              <div className="text-xs font-mono font-semibold text-foreground">{info.uPlus}</div>
              <div className="text-[11px] text-muted-foreground">{info.name}</div>
            </div>
          </div>
        </div>
        <div className="flex flex-wrap gap-1 justify-end">
          <Badge variant="outline" className="text-[10px]">{info.block}</Badge>
          <Badge variant="outline" className="text-[10px]">cat: {info.category}</Badge>
          {info.isAscii && <Badge variant="secondary" className="text-[10px]">ASCII</Badge>}
          {info.isControl && <Badge variant="destructive" className="text-[10px]">control</Badge>}
        </div>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-1 text-[11px]">
        <Field label="Display" value={display} mono />
        <Field label="Decimal" value={info.decimal.toString()} mono />
        <Field label="Hex" value={info.hex4} mono />
        <Field label="Binary" value={info.binary} mono />
        <Field label="HTML (dec)" value={info.htmlEntityDecimal} mono />
        <Field label="HTML (hex)" value={info.htmlEntityHex} mono />
        <Field label="URL encoding" value={info.urlEncoding} mono />
        <Field label="CSS escape" value={info.cssEscape} mono />
        <Field label="JS escape" value={info.jsEscape} mono />
        <Field label="UTF-8 bytes" value={info.utf8Bytes.map((b) => b.toString(16).toUpperCase().padStart(2, "0")).join(" ")} mono />
        <Field label="UTF-16 BE bytes" value={info.utf16Bytes.map((b) => b.toString(16).toUpperCase().padStart(2, "0")).join(" ")} mono />
        <Field label="UTF-32 BE bytes" value={info.utf32Bytes.map((b) => b.toString(16).toUpperCase().padStart(2, "0")).join(" ")} mono />
      </div>
      <div className="flex flex-wrap gap-1.5 pt-1">
        <CopyButton
          getText={() => { onSave(); return info.character; }}
          label="Copy character"
        />
        <CopyButton
          getText={() => info.uPlus}
          label="Copy U+"
        />
        <CopyButton
          getText={() => info.jsEscape}
          label="Copy JS escape"
        />
        <CopyButton
          getText={() => info.urlEncoding}
          label="Copy URL"
        />
        <CopyButton
          getText={() => info.htmlEntityHex}
          label="Copy HTML hex"
        />
      </div>
    </div>
  );
}

function Field({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="rounded border bg-background px-2 py-1">
      <div className="text-[9px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className={`text-foreground break-all ${mono ? "font-mono" : ""}`}>{value}</div>
    </div>
  );
}

// Suppress unused-import lint for icons that may be referenced indirectly.
export const _UnusedIcons = { Binary, Search, CheckCircle2 };
