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
  DB_TYPES,
  FORMATS,
  DEFAULT_PORTS,
  getDbTypeMeta,
  detectDbType,
  detectFormat,
  parseConnectionString,
  buildConnectionString,
  validateConnectionString,
  maskPasswordParts,
  convertFormat,
  getDriverHints,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  emptyParts,
  type DbType,
  type Format,
  type ConnParts,
  type Host,
  type HistoryEntry,
} from "./logic";
import {
  History, Database, Link2, Eye, EyeOff, ShieldCheck,
  AlertTriangle, Terminal, Code2, ArrowRight,
} from "lucide-react";

const DEFAULT_INPUT = "postgres://user:password@localhost:5432/mydb?sslmode=require";

export default function ConnectionStringBuilderParser() {
  const [input, setInput] = useState("");
  const [mask, setMask] = useState(true);
  const [activeFormat, setActiveFormat] = useState<Format>("uri");
  const [activeDbType, setActiveDbType] = useState<DbType>("postgresql");
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [parts, setParts] = useState<ConnParts>(emptyParts());

  useEffect(() => {
    setHistory(loadHistory());
    if (typeof window !== "undefined" && window.location.hash) {
      const p = parseShareUrl(window.location.hash);
      if (p.cs) {
        setInput(p.cs);
        if (p.dbType) setActiveDbType(p.dbType);
        if (p.format) setActiveFormat(p.format);
        toast.info("Loaded from share link (password masked)");
      }
    }
  }, []);

  const detected = useMemo(() => {
    const dt = detectDbType(input);
    const fmt = detectFormat(input);
    return { dbType: dt, format: fmt };
  }, [input]);

  const parseResult = useMemo(() => {
    if (!input.trim()) return null;
    return parseConnectionString(input);
  }, [input]);

  const validation = useMemo(() => {
    if (!input.trim()) return null;
    return validateConnectionString(input);
  }, [input]);

  // Sync parts from parseResult when input changes.
  useEffect(() => {
    if (parseResult?.ok) {
      setParts(parseResult.parts);
      setActiveDbType(parseResult.dbType);
      setActiveFormat(parseResult.format);
    }
  }, [parseResult]);

  const output = useMemo(() => {
    try {
      const maskedParts = mask ? maskPasswordParts(parts) : parts;
      return buildConnectionString(maskedParts, activeDbType, activeFormat, { maskPassword: mask });
    } catch (e) {
      return `Error: ${(e as Error).message}`;
    }
  }, [parts, activeDbType, activeFormat, mask]);

  const driverHints = useMemo(
    () => getDriverHints(activeDbType),
    [activeDbType],
  );

  const supportedFormats = useMemo(() => {
    const meta = getDbTypeMeta(activeDbType);
    return FORMATS.filter((f) => {
      if (f.value === "uri") return meta.supportsUri;
      if (f.value === "keyvalue") return meta.supportsKeyValue;
      if (f.value === "jdbc") return meta.supportsJdbc;
      return false;
    });
  }, [activeDbType]);

  const handleConvertFromInput = useCallback((target: Format) => {
    if (!input.trim()) return;
    const r = convertFormat(input, target);
    if (r.ok) {
      setActiveFormat(target);
      setActiveDbType(r.dbType);
      setParts(parseResult?.ok ? parseResult.parts : emptyParts());
      toast.success(`Converted to ${target}`);
    } else {
      toast.error(r.error);
    }
  }, [input, parseResult]);

  const handleSetField = useCallback(
    <K extends keyof ConnParts>(key: K, value: ConnParts[K]) => {
      setParts((prev) => ({ ...prev, [key]: value }));
    },
    [],
  );

  const handleSetHost = useCallback((i: number, patch: Partial<Host>) => {
    setParts((prev) => ({
      ...prev,
      hosts: prev.hosts.map((h, idx) => (idx === i ? { ...h, ...patch } : h)),
    }));
  }, []);

  const handleAddHost = useCallback(() => {
    setParts((prev) => ({ ...prev, hosts: [...prev.hosts, { host: "" }] }));
  }, []);

  const handleRemoveHost = useCallback((i: number) => {
    setParts((prev) => ({ ...prev, hosts: prev.hosts.filter((_, idx) => idx !== i) }));
  }, []);

  const handleSetParam = useCallback((k: string, v: string) => {
    setParts((prev) => ({ ...prev, params: { ...prev.params, [k]: v } }));
  }, []);

  const handleRemoveParam = useCallback((k: string) => {
    setParts((prev) => {
      const next = { ...prev.params };
      delete next[k];
      return { ...prev, params: next };
    });
  }, []);

  const handleClear = useCallback(() => {
    setInput("");
    setParts(emptyParts());
    toast.info("Cleared");
  }, []);

  const handleClearHistory = useCallback(() => {
    clearHistory();
    setHistory([]);
    toast.success("History cleared");
  }, []);

  const handleRecordHistory = useCallback(() => {
    if (input.trim() && output && !output.startsWith("Error:")) {
      saveHistory({
        ts: Date.now(),
        dbType: activeDbType,
        format: activeFormat,
        inputPreview: input.slice(0, 80),
        outputPreview: output.slice(0, 80),
        masked: mask,
      });
      setHistory(loadHistory());
    }
  }, [input, output, activeDbType, activeFormat, mask]);

  const handleLoadSample = useCallback(() => {
    setInput(DEFAULT_INPUT);
    toast.info("Loaded sample connection string");
  }, []);

  return (
    <div className="space-y-4 unq-animate-fade-in-up">
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-semibold flex items-center gap-1.5">
              <Link2 className="h-4 w-4" /> Connection string
            </h3>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={handleLoadSample}>Sample</Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setMask((m) => !m)}
                className="gap-1.5"
              >
                {mask ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                {mask ? "Reveal password" : "Hide password"}
              </Button>
              <ClearButton onClick={handleClear} disabled={!input} />
            </div>
          </div>
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={"postgres://user:password@host:5432/db?sslmode=require\nmysql://u:p@host/db\nmongodb://u:p@h1:27017,h2:27017/db?replicaSet=rs0\nredis://h:6379/0\nServer=h,1433;Database=db;User Id=u;Password=p\njdbc:postgresql://h:5432/db\nfile:/data/db.sqlite"}
            className="min-h-[80px] resize-y font-mono text-xs"
          />
          <div className="flex flex-wrap gap-2 text-[10px]">
            {detected.dbType && (
              <Badge variant="secondary" className="text-[10px]">
                Detected: {getDbTypeMeta(detected.dbType).label}
              </Badge>
            )}
            {detected.format && (
              <Badge variant="outline" className="text-[10px]">
                Format: {detected.format}
              </Badge>
            )}
            {input && (
              <Badge variant="outline" className="text-[10px]">{input.length} chars</Badge>
            )}
          </div>
        </CardContent>
      </Card>

      {validation && !validation.ok && (
        <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
          <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-medium">Validation errors:</p>
            <ul className="list-disc list-inside text-xs mt-1">
              {validation.errors.map((e, i) => <li key={i}>{e}</li>)}
            </ul>
          </div>
        </div>
      )}
      {validation && validation.ok && validation.warnings.length > 0 && (
        <div className="flex items-start gap-2 rounded-lg border border-yellow-500/30 bg-yellow-500/10 p-3 text-xs text-yellow-700 dark:text-yellow-300">
          <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5" />
          <div>
            {validation.warnings.map((w, i) => <p key={i}>{w}</p>)}
          </div>
        </div>
      )}

      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-semibold flex items-center gap-1.5">
              <Database className="h-4 w-4" /> Structured fields
            </h3>
            <select
              value={activeDbType}
              onChange={(e) => setActiveDbType(e.target.value as DbType)}
              className="h-8 text-xs rounded border bg-background px-2"
            >
              {DB_TYPES.map((d) => (
                <option key={d.value} value={d.value}>{d.label}</option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            <Field label="User">
              <Input
                value={parts.user ?? ""}
                onChange={(e) => handleSetField("user", e.target.value)}
                placeholder="user"
                className="h-8 text-xs font-mono"
              />
            </Field>
            <Field label="Password">
              <Input
                type={mask ? "password" : "text"}
                value={parts.password ?? ""}
                onChange={(e) => handleSetField("password", e.target.value)}
                placeholder="password"
                className="h-8 text-xs font-mono"
              />
            </Field>
            {activeDbType !== "sqlite" && (
              <Field label="Database">
                <Input
                  value={parts.database ?? ""}
                  onChange={(e) => handleSetField("database", e.target.value)}
                  placeholder={activeDbType === "redis" ? "0" : "mydb"}
                  className="h-8 text-xs font-mono"
                />
              </Field>
            )}
            {activeDbType === "sqlite" && (
              <Field label="File path">
                <Input
                  value={parts.database ?? ""}
                  onChange={(e) => handleSetField("database", e.target.value)}
                  placeholder="/data/db.sqlite"
                  className="h-8 text-xs font-mono"
                />
              </Field>
            )}
            <Field label="SSL/TLS">
              <label className="flex items-center gap-1.5 text-xs">
                <input
                  type="checkbox"
                  checked={!!parts.ssl}
                  onChange={(e) => handleSetField("ssl", e.target.checked)}
                />
                <ShieldCheck className="h-3.5 w-3.5" /> Enable
              </label>
            </Field>
          </div>

          {activeDbType !== "sqlite" && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs">Hosts</Label>
                <Button variant="outline" size="sm" onClick={handleAddHost} className="h-6 text-[11px]">+ Add host</Button>
              </div>
              {parts.hosts.length === 0 ? (
                <p className="text-xs text-muted-foreground">No hosts yet.</p>
              ) : (
                <div className="space-y-1">
                  {parts.hosts.map((h, i) => (
                    <div key={i} className="flex gap-2">
                      <Input
                        value={h.host}
                        onChange={(e) => handleSetHost(i, { host: e.target.value })}
                        placeholder="host"
                        className="h-8 text-xs font-mono flex-1"
                      />
                      <Input
                        type="number"
                        value={h.port ?? ""}
                        onChange={(e) => handleSetHost(i, { port: e.target.value ? parseInt(e.target.value, 10) : undefined })}
                        placeholder={`port (default ${DEFAULT_PORTS[activeDbType] ?? "—"})`}
                        className="h-8 text-xs font-mono w-40"
                      />
                      <Button variant="ghost" size="sm" onClick={() => handleRemoveHost(i)} className="h-8">Remove</Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="space-y-2">
            <Label className="text-xs">Parameters</Label>
            {Object.keys(parts.params).length === 0 && (
              <p className="text-xs text-muted-foreground">No extra params.</p>
            )}
            {Object.entries(parts.params).map(([k, v]) => (
              <div key={k} className="flex gap-2">
                <Input
                  value={k}
                  readOnly
                  className="h-8 text-xs font-mono w-40 bg-muted/50"
                />
                <Input
                  value={v}
                  onChange={(e) => handleSetParam(k, e.target.value)}
                  className="h-8 text-xs font-mono flex-1"
                />
                <Button variant="ghost" size="sm" onClick={() => handleRemoveParam(k)} className="h-8">×</Button>
              </div>
            ))}
            <AddParamRow onAdd={(k, v) => handleSetParam(k, v)} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-semibold flex items-center gap-1.5">
              <Terminal className="h-4 w-4" /> Output ({activeFormat})
            </h3>
            <div className="flex gap-1">
              {supportedFormats.map((f) => (
                <Button
                  key={f.value}
                  variant={activeFormat === f.value ? "default" : "outline"}
                  size="sm"
                  className="h-7 text-[11px]"
                  onClick={() => setActiveFormat(f.value)}
                >
                  {f.value}
                </Button>
              ))}
            </div>
          </div>
          <div className="flex flex-wrap gap-1 text-[10px]">
            {supportedFormats.map((f) => (
              <button
                key={f.value}
                onClick={() => handleConvertFromInput(f.value)}
                disabled={!input.trim()}
                className="flex items-center gap-1 rounded border bg-background px-2 py-0.5 text-[10px] hover:bg-muted disabled:opacity-40"
              >
                From input <ArrowRight className="h-2.5 w-2.5" /> {f.value}
              </button>
            ))}
          </div>
          <Textarea
            readOnly
            value={output}
            className="min-h-[60px] resize-y font-mono text-xs"
          />
          <div className="flex flex-wrap gap-2">
            <CopyButton getText={() => { handleRecordHistory(); return output; }} label="Copy" />
            <DownloadButton
              getText={() => output}
              filename={`connection-string-${activeDbType}.${activeFormat === "uri" ? "txt" : activeFormat === "jdbc" ? "properties" : "conf"}`}
              label="Download"
            />
            <ShareButton getUrl={() => {
              handleRecordHistory();
              return buildShareUrl(parts, activeDbType, activeFormat);
            }} />
          </div>
        </CardContent>
      </Card>

      {driverHints.length > 0 && (
        <Card>
          <CardContent className="p-4 space-y-2">
            <h3 className="text-sm font-semibold flex items-center gap-1.5">
              <Code2 className="h-4 w-4" /> Driver snippets
            </h3>
            <div className="space-y-2">
              {driverHints.map((h) => (
                <div key={h.framework} className="rounded border bg-background px-3 py-2">
                  <div className="flex items-center gap-2 text-xs mb-1">
                    <Badge variant="secondary" className="text-[10px]">{h.framework}</Badge>
                    <span className="text-muted-foreground">{h.language}</span>
                    <CopyButton
                      getText={() => h.snippet(mask ? maskPasswordParts(parts) : parts, activeDbType)}
                      label="Copy"
                      size="icon-sm"
                    />
                  </div>
                  <pre className="text-[10px] font-mono whitespace-pre-wrap text-foreground/90 bg-muted/50 rounded p-2">
{h.snippet(mask ? maskPasswordParts(parts) : parts, activeDbType)}
                  </pre>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {history.length > 0 ? (
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
                <button
                  key={i}
                  onClick={() => {
                    setInput(h.inputPreview);
                    setActiveDbType(h.dbType);
                    setActiveFormat(h.format);
                  }}
                  className="block w-full text-left rounded border bg-background px-3 py-1.5 text-xs hover:bg-muted"
                >
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-[10px]">{h.dbType}</Badge>
                    <Badge variant="outline" className="text-[10px]">{h.format}</Badge>
                    {h.masked && <Badge variant="outline" className="text-[10px]">masked</Badge>}
                    <span className="text-muted-foreground ml-auto">{new Date(h.ts).toLocaleString()}</span>
                  </div>
                  <code className="block mt-1 font-mono text-[10px] text-foreground/80 truncate">{h.outputPreview}</code>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      ) : null}

      {!input && (
        <EmptyState
          title="Paste a connection string to begin"
          hint="Supports PostgreSQL, MySQL, MongoDB, Redis, SQL Server, SQLite — in URI, key/value, or JDBC form. Auto-detects the database type and parses into structured fields you can edit."
          icon={<Link2 className="h-8 w-8" />}
        />
      )}

      <Card>
        <CardContent className="p-3">
          <p className="text-xs text-muted-foreground">
            <strong className="text-foreground">Privacy:</strong> All parsing and building happens in your browser. Passwords never leave this device. Share URLs always mask passwords with '***'. History (last 20) is stored in localStorage on this device only.
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

function AddParamRow({ onAdd }: { onAdd: (k: string, v: string) => void }) {
  const [k, setK] = useState("");
  const [v, setV] = useState("");
  return (
    <div className="flex gap-2">
      <Input
        value={k}
        onChange={(e) => setK(e.target.value)}
        placeholder="param name (e.g. sslmode)"
        className="h-8 text-xs font-mono w-44"
      />
      <Input
        value={v}
        onChange={(e) => setV(e.target.value)}
        placeholder="value (e.g. require)"
        className="h-8 text-xs font-mono flex-1"
      />
      <Button
        variant="outline"
        size="sm"
        className="h-8"
        onClick={() => {
          if (k) {
            onAdd(k, v);
            setK("");
            setV("");
          }
        }}
      >
        Add
      </Button>
    </div>
  );
}
