"use client";

import React, { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
  FIELD_NAMES,
  FIELD_LABELS,
  ID3V1_GENRES,
  detectFormat,
  normalizeFieldName,
  emptyFields,
  validateAllFields,
  parseAudioMetadata,
  writeAudioMetadata,
  formatLabel,
  renderTextReport,
  renderCsv,
  computeSummaryStats,
  generateFilename,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  type AudioFormat,
  type FieldName,
  type Fields,
  type AudioMetadata,
  type HistoryEntry,
} from "./logic";
import {
  Tags, Upload, Download, History, FileAudio,
  Save, AlertTriangle, Lock, FileText, FileSpreadsheet,
} from "lucide-react";

interface LoadedFile {
  bytes: Uint8Array;
  name: string;
  size: number;
  meta: AudioMetadata;
  originalFields: Fields;
}

interface EditResult {
  blob: Blob;
  url: string;
  filename: string;
  sizeBytes: number;
}

export default function AudioMetadataEditor() {
  const [loaded, setLoaded] = useState<LoadedFile | null>(null);
  const [fields, setFields] = useState<Fields>(emptyFields());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [result, setResult] = useState<EditResult | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [useGenrePreset, setUseGenrePreset] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setHistory(loadHistory());
    if (typeof window !== "undefined" && window.location.hash) {
      const p = parseShareUrl(window.location.hash);
      if (p.format || p.title || p.artist || p.album || p.year || p.track || p.genre) {
        setFields((prev) => ({
          ...prev,
          title: p.title ?? prev.title,
          artist: p.artist ?? prev.artist,
          album: p.album ?? prev.album,
          year: p.year ?? prev.year,
          track: p.track ?? prev.track,
          genre: p.genre ?? prev.genre,
        }));
        toast.info("Loaded fields from share link");
      }
    }
    return () => {
      if (result) URL.revokeObjectURL(result.url);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleFile = useCallback(async (file: File) => {
    setError(null);
    setParseError(null);
    setResult(null);
    // Accept any audio-like file (the format detector will figure out the rest)
    if (!file.type.startsWith("audio/") && !/\.(wav|mp3|ogg|flac|m4a|aac|webm|mp4)$/i.test(file.name)) {
      setParseError("Please select an audio file (wav, mp3, ogg, flac).");
      return;
    }
    try {
      setBusy(true);
      const arrayBuffer = await file.arrayBuffer();
      const bytes = new Uint8Array(arrayBuffer);
      const meta = parseAudioMetadata(bytes);
      if (meta.format === "unknown") {
        setParseError("Could not detect the audio format. Supported: MP3, WAV, OGG, FLAC.");
        return;
      }
      setLoaded({
        bytes,
        name: file.name,
        size: file.size,
        meta,
        originalFields: { ...meta.fields },
      });
      setFields({ ...meta.fields });
      toast.success(`Loaded ${file.name} (${formatLabel(meta.format)})`);
    } catch (e) {
      setParseError(`Could not read file: ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  }, []);

  const onFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
    if (e.target) e.target.value = "";
  }, [handleFile]);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  }, [handleFile]);

  const updateField = useCallback((name: FieldName, value: string) => {
    setFields((prev) => ({ ...prev, [name]: value }));
  }, []);

  const handleSave = useCallback(async () => {
    if (!loaded) return;
    setError(null);
    if (loaded.meta.readOnly) {
      setError(`${formatLabel(loaded.meta.format)} is read-only. Cannot write metadata.`);
      return;
    }
    const validationError = validateAllFields(fields);
    if (validationError) {
      setError(validationError);
      return;
    }
    setBusy(true);
    try {
      const written = writeAudioMetadata(loaded.bytes, loaded.meta.format, fields);
      const blob = new Blob([written.buffer as ArrayBuffer], { type: "application/octet-stream" });
      const url = URL.createObjectURL(blob);
      const filename = generateFilename(loaded.name, loaded.meta.format);
      const resultInfo: EditResult = {
        blob,
        url,
        filename,
        sizeBytes: blob.size,
      };
      setResult((prev) => {
        if (prev) URL.revokeObjectURL(prev.url);
        return resultInfo;
      });
      const newMeta: AudioMetadata = {
        ...loaded.meta,
        fields,
        originalSizeBytes: written.length,
      };
      const stats = computeSummaryStats(newMeta, loaded.originalFields, blob.size);
      const entry: HistoryEntry = {
        ts: Date.now(),
        originalName: loaded.name,
        format: loaded.meta.format,
        fields,
        totalFields: stats.totalFields,
        modifiedFields: stats.modifiedFields,
        outputSizeBytes: blob.size,
        filename,
      };
      saveHistory(entry);
      setHistory(loadHistory());
      toast.success(`Saved ${filename} (${stats.modifiedFields} field${stats.modifiedFields === 1 ? "" : "s"} modified)`);
    } catch (e) {
      setError(`Save failed: ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  }, [loaded, fields]);

  const handleDownload = useCallback(() => {
    if (!result) return;
    const a = document.createElement("a");
    a.href = result.url;
    a.download = result.filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    toast.success(`Downloaded ${result.filename}`);
  }, [result]);

  const handleReset = useCallback(() => {
    if (result) URL.revokeObjectURL(result.url);
    setResult(null);
    setLoaded(null);
    setFields(emptyFields());
    setError(null);
    setParseError(null);
    toast.info("Cleared");
  }, [result]);

  const handleClearHistory = useCallback(() => {
    clearHistory();
    setHistory([]);
    toast.success("History cleared");
  }, []);

  const stats = useMemo(() => {
    if (!loaded) return null;
    const newMeta: AudioMetadata = {
      ...loaded.meta,
      fields,
    };
    return computeSummaryStats(newMeta, loaded.originalFields, result?.sizeBytes ?? loaded.size);
  }, [loaded, fields, result]);

  const reportText = useMemo(() => {
    if (!loaded) return "";
    const newMeta: AudioMetadata = { ...loaded.meta, fields };
    return renderTextReport(newMeta, loaded.originalFields);
  }, [loaded, fields]);

  const csvText = useMemo(() => {
    if (!loaded) return "";
    const newMeta: AudioMetadata = { ...loaded.meta, fields };
    return renderCsv(newMeta);
  }, [loaded, fields]);

  const modifiedCount = useMemo(() => {
    if (!loaded) return 0;
    let count = 0;
    for (const name of FIELD_NAMES) {
      if (fields[name] !== loaded.originalFields[name] && (fields[name] || loaded.originalFields[name])) {
        count++;
      }
    }
    return count;
  }, [loaded, fields]);

  return (
    <div className="space-y-4 unq-animate-fade-in-up">
      <Card>
        <CardContent className="p-4 space-y-3">
          <Label className="text-xs">Audio file</Label>
          <div
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={onDrop}
            className={`rounded-lg border-2 border-dashed p-6 text-center transition-colors cursor-pointer ${
              dragOver
                ? "border-primary bg-primary/5"
                : "border-border hover:border-primary/50"
            }`}
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
            <p className="text-sm font-medium text-foreground">
              {loaded ? loaded.name : "Drop an audio file or click to browse"}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {loaded
                ? `${formatBytes(loaded.size)} · ${formatLabel(loaded.meta.format)}`
                : "Supports MP3 (ID3v2), WAV (RIFF INFO), OGG (Vorbis, read-only), FLAC (Vorbis, read-only)"}
            </p>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="audio/*,.wav,.mp3,.ogg,.flac,.m4a,.aac"
            onChange={onFileInput}
            className="hidden"
          />
          {parseError && <ErrorBanner message={parseError} />}
        </CardContent>
      </Card>

      {loaded && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <FileAudio className="h-4 w-4" /> Detected format
              </h3>
              {loaded.meta.readOnly && (
                <Badge variant="outline" className="text-amber-700 dark:text-amber-300 gap-1">
                  <Lock className="h-3 w-3" /> Read-only
                </Badge>
              )}
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
              <Stat label="Format" value={formatLabel(loaded.meta.format)} />
              <Stat label="File size" value={formatBytes(loaded.size)} />
              <Stat label="Fields found" value={FIELD_NAMES.filter((n) => loaded.originalFields[n]).length} />
              <Stat label="Editable" value={loaded.meta.readOnly ? "No" : "Yes"} />
            </div>
            {loaded.meta.readOnly && (
              <div className="rounded border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-xs text-amber-700 dark:text-amber-300 flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                <span>
                  {formatLabel(loaded.meta.format)} parsing is read-only in this tool. You can view
                  and export the metadata, but writing back to OGG/FLAC is not supported.
                </span>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {loaded && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
              <Tags className="h-4 w-4" /> Metadata fields
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {FIELD_NAMES.map((name) => (
                <FieldEditor
                  key={name}
                  name={name}
                  value={fields[name]}
                  originalValue={loaded.originalFields[name]}
                  onChange={(v) => updateField(name, v)}
                  disabled={busy || loaded.meta.readOnly}
                  useGenrePreset={useGenrePreset}
                  onUseGenrePresetChange={setUseGenrePreset}
                />
              ))}
            </div>
            {error && <ErrorBanner message={error} />}
            <div className="flex flex-wrap gap-2 pt-2">
              <Button onClick={handleSave} disabled={busy || loaded.meta.readOnly} className="gap-1.5">
                <Save className="h-3.5 w-3.5" /> {busy ? "Saving…" : "Save metadata"}
              </Button>
              <ShareButton getUrl={() => buildShareUrl({
                format: loaded.meta.format,
                title: fields.title,
                artist: fields.artist,
                album: fields.album,
                year: fields.year,
                track: fields.track,
                genre: fields.genre,
              })} />
              <ClearButton onClick={handleReset} disabled={busy} />
            </div>
          </CardContent>
        </Card>
      )}

      {loaded && (
        <Card>
          <CardContent className="p-4 space-y-2">
            <h3 className="text-sm font-semibold text-foreground">Summary stats</h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
              <Stat label="Format" value={formatLabel(loaded.meta.format)} />
              <Stat label="Total fields" value={stats?.totalFields ?? 0} />
              <Stat label="Modified fields" value={modifiedCount} />
              <Stat label="Output size" value={stats ? formatBytes(stats.outputSizeBytes) : "—"} />
            </div>
          </CardContent>
        </Card>
      )}

      {result && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
              <Download className="h-4 w-4" /> Tagged output
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
              <Stat label="File size" value={formatBytes(result.sizeBytes)} />
              <Stat label="Filename" value={result.filename} />
              <Stat label="Format" value={formatLabel(loaded?.meta.format ?? "unknown")} />
              <Stat label="Modified fields" value={modifiedCount} />
            </div>
            <div className="flex flex-wrap gap-2 pt-2">
              <Button onClick={handleDownload} className="gap-1.5">
                <Download className="h-3.5 w-3.5" /> Download file
              </Button>
              <CopyButton getText={() => result.filename} label="Copy filename" />
              <DownloadButton
                getText={() => reportText}
                filename="metadata-report.txt"
                mime="text/plain"
                label="Download report"
              />
              <DownloadButton
                getText={() => csvText}
                filename="metadata.csv"
                mime="text/csv"
                label="Download CSV"
              />
              <CopyButton getText={() => reportText} label="Copy report" />
              <CopyButton getText={() => csvText} label="Copy CSV" />
            </div>
          </CardContent>
        </Card>
      )}

      {loaded && (
        <Card>
          <CardContent className="p-4 space-y-2">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
              <FileText className="h-4 w-4" /> Text report
            </h3>
            <pre className="text-[11px] font-mono whitespace-pre-wrap rounded border bg-muted/40 p-3 max-h-[300px] overflow-auto">
{reportText}
            </pre>
          </CardContent>
        </Card>
      )}

      {loaded && (
        <Card>
          <CardContent className="p-4 space-y-2">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
              <FileSpreadsheet className="h-4 w-4" /> CSV export
            </h3>
            <pre className="text-[11px] font-mono whitespace-pre-wrap rounded border bg-muted/40 p-3 max-h-[200px] overflow-auto">
{csvText}
            </pre>
          </CardContent>
        </Card>
      )}

      {!loaded && !parseError && (
        <EmptyState
          title="Drop an audio file to view metadata"
          hint="We read the file bytes locally, detect the format by magic bytes (ID3 for MP3, RIFF for WAV, OggS for OGG, fLaC for FLAC), and parse the existing metadata tags into editable fields. For MP3 and WAV, you can edit and write back; for OGG and FLAC, view and export only."
          icon={<Tags className="h-8 w-8" />}
        />
      )}

      {history.length > 0 && (
        <Card>
          <CardContent className="p-4 space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <History className="h-4 w-4" /> History ({history.length})
              </h3>
              <Button variant="ghost" size="sm" onClick={handleClearHistory}>Clear</Button>
            </div>
            <div className="space-y-1 max-h-[300px] overflow-auto">
              {history.slice(0, 10).map((h, i) => (
                <div key={i} className="rounded border bg-background px-3 py-2 text-xs flex flex-wrap items-center gap-2">
                  <Badge variant="outline" className="text-[10px]">{h.format}</Badge>
                  <span className="text-muted-foreground">
                    {h.totalFields} fields · {h.modifiedFields} modified
                  </span>
                  <span className="text-muted-foreground">· {formatBytes(h.outputSizeBytes)}</span>
                  <span className="text-muted-foreground ml-auto truncate max-w-[160px]">{h.originalName}</span>
                  <span className="text-muted-foreground">{new Date(h.ts).toLocaleString()}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-3">
          <p className="text-xs text-muted-foreground">
            <strong className="text-foreground">Privacy:</strong> All file reading,
            metadata parsing, and writing happen locally in your browser via
            FileReader and pure-JS binary parsers. No file is ever uploaded.
            History metadata is stored in localStorage on this device only.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

interface FieldEditorProps {
  name: FieldName;
  value: string;
  originalValue: string;
  onChange: (v: string) => void;
  disabled: boolean;
  useGenrePreset: boolean;
  onUseGenrePresetChange: (v: boolean) => void;
}

function FieldEditor({
  name, value, originalValue, onChange, disabled, useGenrePreset, onUseGenrePresetChange,
}: FieldEditorProps) {
  const isModified = value !== originalValue && (value || originalValue);
  const inputId = `ame-${name}`;
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <Label htmlFor={inputId} className="text-xs">
          {FIELD_LABELS[name]}
          {isModified && <span className="ml-1 text-amber-600 dark:text-amber-400">●</span>}
        </Label>
        {name === "genre" && (
          <Button
            variant="link"
            size="sm"
            className="h-auto p-0 text-[10px]"
            onClick={() => onUseGenrePresetChange(!useGenrePreset)}
            disabled={disabled}
          >
            {useGenrePreset ? "Custom input" : "Genre presets"}
          </Button>
        )}
      </div>
      {name === "genre" && useGenrePreset ? (
        <select
          id={inputId}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          className="h-9 w-full text-xs rounded border bg-background px-2"
        >
          <option value="">(empty)</option>
          {ID3V1_GENRES.map((g) => (
            <option key={g} value={g}>{g}</option>
          ))}
        </select>
      ) : (
        <Input
          id={inputId}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          placeholder={name === "year" ? "2024" : name === "track" ? "5/12" : `Enter ${FIELD_LABELS[name].toLowerCase()}`}
          className="font-mono text-xs"
        />
      )}
      <p className="text-[10px] text-muted-foreground">
        {isModified ? `Modified (was: "${originalValue || "empty"}")` : "Unchanged"}
      </p>
    </div>
  );
}

function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  const k = 1024;
  const units = ["B", "KB", "MB", "GB"];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(k)), units.length - 1);
  return `${(bytes / Math.pow(k, i)).toFixed(i === 0 ? 0 : 2)} ${units[i]}`;
}

function Stat({
  label,
  value,
  icon,
}: {
  label: string;
  value: string | number;
  icon?: React.ReactNode;
}) {
  return (
    <div className="rounded border bg-background px-3 py-2">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground flex items-center gap-1">
        {icon}{label}
      </div>
      <div className="text-sm font-semibold text-foreground break-all">{value}</div>
    </div>
  );
}
