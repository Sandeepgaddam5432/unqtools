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
  ErrorBanner,
} from "../../_shared";
import { toast } from "sonner";
import {
  GENDER_MIX_OPTIONS,
  NAT_OPTIONS,
  PASSWORD_POLICY_OPTIONS,
  FIELD_KEYS,
  DEFAULT_OPTIONS,
  SAMPLE_SEEDS,
  MAX_BATCH,
  generateBatch,
  exportProfiles,
  exportMime,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  validateOptions,
  type ProfileOptions,
  type ExportFormat,
  type HistoryEntry,
  type UserProfile,
} from "./logic";
import { History, UserRound, Wand2, AlertTriangle, Database, Download } from "lucide-react";

const EXPORT_FORMATS: ReadonlyArray<{ value: ExportFormat; label: string }> = [
  { value: "json", label: "JSON" },
  { value: "csv", label: "CSV" },
  { value: "xml", label: "XML" },
  { value: "ndjson", label: "NDJSON" },
];

export default function RandomUserProfileGenerator() {
  const [opts, setOpts] = useState<ProfileOptions>({ ...DEFAULT_OPTIONS });
  const [format, setFormat] = useState<ExportFormat>("json");
  const [profiles, setProfiles] = useState<UserProfile[] | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [excludeInput, setExcludeInput] = useState<string>("");
  const [includeInput, setIncludeInput] = useState<string>("");

  useEffect(() => {
    setHistory(loadHistory());
    if (typeof window !== "undefined" && window.location.hash) {
      const parsed = parseShareUrl(window.location.hash);
      setOpts(parsed);
      setExcludeInput(parsed.excludeFields.join(", "));
      setIncludeInput(parsed.includeFields.join(", "));
      toast.info("Loaded options from share link");
    }
  }, []);

  const validation = useMemo(() => validateOptions(opts), [opts]);

  const setOpt = useCallback(
    <K extends keyof ProfileOptions>(key: K, value: ProfileOptions[K]) => {
      setOpts((prev) => ({ ...prev, [key]: value }));
    },
    [],
  );

  const handleGenerate = useCallback(() => {
    const v = validateOptions(opts);
    if (!v.ok) {
      toast.error(v.error);
      return;
    }
    const inc = includeInput.split(",").map((s) => s.trim()).filter(Boolean);
    const exc = excludeInput.split(",").map((s) => s.trim()).filter(Boolean);
    const finalOpts: ProfileOptions = { ...opts, includeFields: inc, excludeFields: exc };
    const r = generateBatch(finalOpts);
    if (!r.ok) {
      toast.error(r.error);
      return;
    }
    setProfiles(r.output);
    setOpts(finalOpts);
    toast.success(`Generated ${r.output.length} profile${r.output.length === 1 ? "" : "s"}`);
  }, [opts, includeInput, excludeInput]);

  const handleClear = useCallback(() => {
    setProfiles(null);
    toast.info("Cleared output");
  }, []);

  const handleClearHistory = useCallback(() => {
    clearHistory();
    setHistory([]);
    toast.success("History cleared");
  }, []);

  const recordHistory = useCallback(() => {
    if (profiles && profiles.length > 0) {
      const text = exportProfiles(profiles, opts, format);
      saveHistory({
        ts: Date.now(),
        count: profiles.length,
        gender: opts.gender,
        nat: opts.nat,
        seed: opts.seed,
        format,
        previewName: profiles[0]!.name.full,
        bytes: text.length,
      });
      setHistory(loadHistory());
    }
  }, [profiles, opts, format]);

  const exportText = useMemo(() => {
    if (!profiles) return "";
    return exportProfiles(profiles, opts, format);
  }, [profiles, opts, format]);

  const mime = exportMime(format);

  return (
    <div className="space-y-4 unq-animate-fade-in-up">
      <Card>
        <CardContent className="p-4 space-y-3">
          <h3 className="text-sm font-semibold flex items-center gap-1.5">
            <Wand2 className="h-4 w-4" /> Profile options
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            <Field label="Gender mix">
              <select
                value={opts.gender}
                onChange={(e) => setOpt("gender", e.target.value as ProfileOptions["gender"])}
                className="h-8 w-full text-xs rounded border bg-background px-2"
              >
                {GENDER_MIX_OPTIONS.map((g) => <option key={g.value} value={g.value}>{g.label}</option>)}
              </select>
            </Field>
            <Field label="Nationality">
              <select
                value={opts.nat}
                onChange={(e) => setOpt("nat", e.target.value as ProfileOptions["nat"])}
                className="h-8 w-full text-xs rounded border bg-background px-2"
              >
                {NAT_OPTIONS.map((n) => <option key={n.value} value={n.value}>{n.label}</option>)}
              </select>
            </Field>
            <Field label={`Count (max ${MAX_BATCH.toLocaleString()})`}>
              <Input
                type="number"
                min={1}
                max={MAX_BATCH}
                value={opts.count}
                onChange={(e) => setOpt("count", Math.max(1, Math.min(MAX_BATCH, Number(e.target.value) || 1)))}
                className="h-8 text-xs"
              />
            </Field>
            <Field label="Seed (optional)">
              <Input
                type="text"
                value={opts.seed}
                onChange={(e) => setOpt("seed", e.target.value.slice(0, 200))}
                placeholder="leave blank for random"
                className="h-8 text-xs"
              />
            </Field>
            <Field label="Email domain">
              <Input
                type="text"
                value={opts.emailDomain}
                onChange={(e) => setOpt("emailDomain", e.target.value)}
                className="h-8 text-xs"
              />
            </Field>
            <Field label="Password policy">
              <select
                value={opts.passwordPolicy}
                onChange={(e) => setOpt("passwordPolicy", e.target.value as ProfileOptions["passwordPolicy"])}
                className="h-8 w-full text-xs rounded border bg-background px-2"
              >
                {PASSWORD_POLICY_OPTIONS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
              </select>
            </Field>
            <Field label="Export format">
              <select
                value={format}
                onChange={(e) => setFormat(e.target.value as ExportFormat)}
                className="h-8 w-full text-xs rounded border bg-background px-2"
              >
                {EXPORT_FORMATS.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
              </select>
            </Field>
            <Field label="Sample seed">
              <select
                value=""
                onChange={(e) => e.target.value && setOpt("seed", e.target.value)}
                className="h-8 w-full text-xs rounded border bg-background px-2"
              >
                <option value="">Pick a sample…</option>
                {SAMPLE_SEEDS.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </Field>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Include fields (comma-separated dot-paths, e.g. name.first,email)">
              <Input
                type="text"
                value={includeInput}
                onChange={(e) => setIncludeInput(e.target.value)}
                placeholder="empty = all fields"
                className="h-8 text-xs font-mono"
              />
            </Field>
            <Field label="Exclude fields (comma-separated dot-paths)">
              <Input
                type="text"
                value={excludeInput}
                onChange={(e) => setExcludeInput(e.target.value)}
                placeholder="e.g. login.salt,login.md5"
                className="h-8 text-xs font-mono"
              />
            </Field>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" onClick={handleGenerate} disabled={!validation.ok} className="gap-1.5">
              <UserRound className="h-3.5 w-3.5" /> Generate
            </Button>
            <span className="text-[10px] text-muted-foreground">
              {FIELD_KEYS.length} fields available per profile
            </span>
          </div>
        </CardContent>
      </Card>

      {validation && !validation.ok && (
        <ErrorBanner message={validation.error} />
      )}

      {profiles && profiles.length > 0 ? (
        <>
          {profiles.length <= 12 && (
            <Card>
              <CardContent className="p-4 space-y-3">
                <h3 className="text-sm font-semibold flex items-center gap-1.5">
                  <UserRound className="h-4 w-4" /> Preview ({profiles.length})
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {profiles.slice(0, 12).map((p, i) => (
                    <div key={i} className="rounded-lg border bg-card p-3 flex gap-3">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={p.avatar}
                        alt={p.name.full}
                        width={56}
                        height={56}
                        className="rounded-md flex-shrink-0 bg-muted"
                      />
                      <div className="min-w-0 flex-1 text-xs">
                        <div className="font-medium truncate">{p.name.full}</div>
                        <div className="text-muted-foreground truncate">{p.email}</div>
                        <div className="text-muted-foreground truncate">{p.location.city}, {p.nat}</div>
                        <div className="flex flex-wrap gap-1 mt-1">
                          <Badge variant="outline" className="text-[9px]">{p.gender}</Badge>
                          <Badge variant="outline" className="text-[9px]">{p.company.title}</Badge>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardContent className="p-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-sm font-semibold flex items-center gap-1.5">
                  <Database className="h-4 w-4" /> Export ({format.toUpperCase()})
                </h3>
                <div className="flex flex-wrap gap-2">
                  <CopyButton getText={() => { recordHistory(); return exportText; }} label="Copy" />
                  <DownloadButton
                    getText={() => { recordHistory(); return exportText; }}
                    filename={`profiles.${mime.ext}`}
                    mime={mime.mime}
                    label={`Download .${mime.ext}`}
                  />
                  <ShareButton getUrl={() => buildShareUrl({ ...opts })} />
                  <ClearButton onClick={handleClear} />
                </div>
              </div>
              <Textarea
                readOnly
                value={exportText}
                className="min-h-[260px] resize-y font-mono text-xs"
              />
              <div className="flex flex-wrap gap-2 text-[10px] text-muted-foreground">
                <Badge variant="outline">{profiles.length} profile{profiles.length === 1 ? "" : "s"}</Badge>
                <Badge variant="outline">{exportText.length.toLocaleString()} bytes</Badge>
                <Badge variant="outline">{opts.nat}</Badge>
                <Badge variant="outline">{opts.gender}</Badge>
                {opts.seed && <Badge variant="outline">seed: {opts.seed}</Badge>}
              </div>
            </CardContent>
          </Card>
        </>
      ) : (
        <EmptyState
          title="Generate coherent fake personas offline"
          hint="Pick a nationality, gender mix, and count — optionally provide a seed for reproducible output. 50+ correlated fields per profile, with algorithmic (non-real) avatars. 100% client-side."
          icon={<UserRound className="h-8 w-8" />}
        />
      )}

      {history.length > 0 && (
        <Card>
          <CardContent className="p-4 space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold flex items-center gap-1.5">
                <History className="h-4 w-4" /> Recent ({history.length})
              </h3>
              <Button variant="ghost" size="sm" onClick={handleClearHistory}>Clear</Button>
            </div>
            <div className="space-y-1 max-h-[200px] overflow-auto">
              {history.slice(0, 5).map((h, i) => (
                <div key={i} className="rounded border bg-background px-3 py-1.5 text-xs">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-[10px]">{h.count}</Badge>
                    <Badge variant="outline" className="text-[10px]">{h.nat}</Badge>
                    <Badge variant="outline" className="text-[10px]">{h.gender}</Badge>
                    <Badge variant="outline" className="text-[10px]">{h.format}</Badge>
                    <span className="text-muted-foreground ml-auto">{new Date(h.ts).toLocaleString()}</span>
                  </div>
                  <code className="block mt-1 text-[10px] text-muted-foreground truncate">
                    {h.previewName} · seed: {h.seed || "(random)"}
                  </code>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-3">
          <p className="text-xs text-muted-foreground">
            <strong className="text-foreground">Privacy:</strong> Profiles are generated entirely in your
            browser using a seeded PRNG. Avatars are algorithmic SVG identicons — no real faces. Nothing is
            uploaded. History (last 20) is stored in localStorage on this device only.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</Label>
      <div>{children}</div>
    </div>
  );
}
