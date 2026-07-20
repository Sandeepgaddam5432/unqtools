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
  STAGE_TYPES,
  DRIVER_TARGETS,
  STAGE_DEFAULTS,
  SAMPLE_DOCS,
  createStage,
  createDefaultState,
  generatePipelineJson,
  generateMongosh,
  generateDriverCode,
  validateStage,
  validatePipeline,
  runPipeline,
  safeJsonParse,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  type PipelineState,
  type Stage,
  type StageType,
  type DriverTarget,
  type HistoryEntry,
} from "./logic";
import {
  History, Database, Plus, Trash2, ArrowUp, ArrowDown,
  Layers, Code2, Beaker, Eye, EyeOff, Filter,
} from "lucide-react";

export default function MongodbAggregationPipelineBuilder() {
  const [state, setState] = useState<PipelineState>(createDefaultState);
  const [sampleText, setSampleText] = useState("");
  const [driverTarget, setDriverTarget] = useState<DriverTarget>("mongosh");
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [previewStageId, setPreviewStageId] = useState<string | null>(null);

  useEffect(() => {
    setHistory(loadHistory());
    if (typeof window !== "undefined" && window.location.hash) {
      const p = parseShareUrl(window.location.hash);
      if (Object.keys(p).length > 0) {
        setState((prev) => ({ ...prev, ...p }));
        toast.info("Loaded pipeline from share link");
      }
    }
  }, []);

  // ---- stage ops ----
  const addStage = useCallback((type: StageType) => {
    setState((s) => ({ ...s, stages: [...s.stages, createStage(type)] }));
  }, []);
  const updateStage = useCallback((id: string, patch: Partial<Stage>) => {
    setState((s) => ({ ...s, stages: s.stages.map((st) => (st.id === id ? { ...st, ...patch } : st)) }));
  }, []);
  const removeStage = useCallback((id: string) => {
    setState((s) => ({ ...s, stages: s.stages.filter((st) => st.id !== id) }));
    if (previewStageId === id) setPreviewStageId(null);
  }, [previewStageId]);
  const moveStage = useCallback((id: string, dir: -1 | 1) => {
    setState((s) => {
      const idx = s.stages.findIndex((st) => st.id === id);
      if (idx < 0) return s;
      const newIdx = idx + dir;
      if (newIdx < 0 || newIdx >= s.stages.length) return s;
      const stages = [...s.stages];
      const [removed] = stages.splice(idx, 1);
      stages.splice(newIdx, 0, removed);
      return { ...s, stages };
    });
  }, []);

  const setCollection = useCallback((coll: string) => {
    setState((s) => ({ ...s, collection: coll }));
  }, []);

  // ---- derived outputs ----
  const pipelineJson = useMemo(() => generatePipelineJson(state), [state]);
  const mongoshResult = useMemo(() => generateMongosh(state), [state]);
  const driverResult = useMemo(() => generateDriverCode(state, driverTarget), [state, driverTarget]);
  const pipelineValidation = useMemo(() => validatePipeline(state), [state]);

  const sampleDocs = useMemo(() => {
    if (!sampleText.trim()) return null;
    const p = safeJsonParse(sampleText);
    if (!p.ok || !Array.isArray(p.value)) return null;
    return p.value as unknown[];
  }, [sampleText]);

  const pipelineRun = useMemo(() => {
    if (!sampleDocs || !pipelineValidation.ok) return null;
    return runPipeline(sampleDocs, state);
  }, [sampleDocs, state, pipelineValidation]);

  const handleClear = useCallback(() => {
    setState(createDefaultState());
    setPreviewStageId(null);
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
      collection: state.collection,
      stageCount: state.stages.filter((s) => s.enabled).length,
      stageTypes: state.stages.filter((s) => s.enabled).map((s) => s.type),
      finalCount: pipelineRun?.ok ? pipelineRun.final.length : 0,
    });
    setHistory(loadHistory());
  }, [state, pipelineRun]);

  const handleLoadSample = useCallback(() => {
    setSampleText(SAMPLE_DOCS);
    toast.info("Loaded sample documents");
  }, []);

  const previewStage = previewStageId && pipelineRun?.ok
    ? pipelineRun.stages.find((s) => s.stageId === previewStageId)
    : null;

  return (
    <div className="space-y-4 unq-animate-fade-in-up">
      {/* Top controls: collection */}
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="agg-coll" className="text-xs">Collection</Label>
            <Input
              id="agg-coll"
              value={state.collection}
              onChange={(e) => setCollection(e.target.value)}
              className="font-mono text-xs h-8 max-w-sm"
            />
          </div>
        </CardContent>
      </Card>

      {/* Stage list */}
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
              <Layers className="h-4 w-4" /> Pipeline Stages ({state.stages.length})
            </h3>
            <div className="flex flex-wrap gap-1">
              {STAGE_TYPES.map((t) => (
                <Button
                  key={t.value}
                  variant="outline"
                  size="sm"
                  className="h-7 text-[11px] font-mono"
                  onClick={() => addStage(t.value)}
                  title={t.hint}
                >
                  <Plus className="h-3 w-3" /> {t.value}
                </Button>
              ))}
            </div>
          </div>

          {state.stages.length === 0 ? (
            <EmptyState
              title="No stages yet"
              hint="Click a stage button above to add it to the pipeline."
              icon={<Layers className="h-8 w-8" />}
            />
          ) : (
            <div className="space-y-2">
              {state.stages.map((stage, idx) => (
                <StageRow
                  key={stage.id}
                  stage={stage}
                  index={idx}
                  total={state.stages.length}
                  validation={validateStage(stage)}
                  isPreviewing={previewStageId === stage.id}
                  onUpdate={(patch) => updateStage(stage.id, patch)}
                  onRemove={() => removeStage(stage.id)}
                  onMove={(dir) => moveStage(stage.id, dir)}
                  onPreview={() => setPreviewStageId(previewStageId === stage.id ? null : stage.id)}
                />
              ))}
            </div>
          )}

          {!pipelineValidation.ok && (
            <ErrorBanner message={`Stage error: ${pipelineValidation.error}`} />
          )}
        </CardContent>
      </Card>

      {/* Sample docs */}
      <Card>
        <CardContent className="p-4 space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
              <Beaker className="h-4 w-4" /> Sample Documents (in-browser test)
            </h3>
            <Button variant="outline" size="sm" className="h-7 text-xs" onClick={handleLoadSample}>Load sample</Button>
          </div>
          <Textarea
            value={sampleText}
            onChange={(e) => setSampleText(e.target.value)}
            placeholder='[{"name":"Alice","amount":100}, ...]'
            className="min-h-[100px] font-mono text-xs"
          />
          {sampleText.trim() && !sampleDocs && (
            <ErrorBanner message="Sample input must be a JSON array of documents." />
          )}
        </CardContent>
      </Card>

      {/* Per-stage results */}
      {pipelineRun?.ok && sampleDocs && (
        <Card>
          <CardContent className="p-4 space-y-2">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
              <Filter className="h-4 w-4" /> Per-stage Results
            </h3>
            <div className="space-y-1">
              {pipelineRun.stages.map((s, i) => {
                const stage = state.stages.find((st) => st.id === s.stageId);
                if (!stage) return null;
                return (
                  <button
                    key={s.stageId}
                    onClick={() => setPreviewStageId(previewStageId === s.stageId ? null : s.stageId)}
                    className={`w-full flex items-center gap-2 rounded border px-3 py-1.5 text-xs text-left ${previewStageId === s.stageId ? "bg-primary/10 border-primary" : "bg-background hover:bg-muted/40"}`}
                  >
                    <span className="text-muted-foreground text-[10px] w-4">{i + 1}.</span>
                    <Badge variant={stage.enabled ? "secondary" : "outline"} className="text-[10px] font-mono">{stage.type}</Badge>
                    {!stage.enabled && <Badge variant="outline" className="text-[10px]">disabled</Badge>}
                    <span className="ml-auto text-muted-foreground">{s.count} docs</span>
                  </button>
                );
              })}
            </div>
            {previewStage && previewStage.output && (
              <div className="rounded border bg-background max-h-[300px] overflow-auto">
                {previewStage.output.slice(0, 20).map((d, i) => (
                  <pre key={i} className="text-[10px] font-mono px-2 py-1 border-b last:border-0">
                    {JSON.stringify(d)}
                  </pre>
                ))}
                {previewStage.output.length > 20 && (
                  <div className="text-[10px] text-muted-foreground px-2 py-1">
                    … and {previewStage.output.length - 20} more
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Outputs */}
      <Card>
        <CardContent className="p-4 space-y-3">
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
            <Code2 className="h-4 w-4" /> Output
          </h3>
          {!pipelineJson.ok && showError(pipelineJson.error)}
          {!driverResult.ok && showError(driverResult.error)}

          <div className="space-y-2">
            <Label className="text-xs">Pipeline JSON</Label>
            <pre className="rounded border bg-muted/30 p-2 text-[11px] font-mono overflow-auto max-h-[200px]">
              {pipelineJson.ok ? pipelineJson.output : "—"}
            </pre>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs">Driver code</Label>
              <select
                value={driverTarget}
                onChange={(e) => setDriverTarget(e.target.value as DriverTarget)}
                className="h-7 text-xs rounded border bg-background px-2"
              >
                {DRIVER_TARGETS.map((d) => (
                  <option key={d.value} value={d.value}>{d.label}</option>
                ))}
              </select>
            </div>
            <pre className="rounded border bg-muted/30 p-2 text-[11px] font-mono overflow-auto max-h-[300px]">
              {driverResult.ok ? driverResult.output : mongoshResult.ok ? mongoshResult.output : "—"}
            </pre>
          </div>

          <div className="flex flex-wrap gap-2">
            <CopyButton
              getText={() => { handleRecordHistory(); return pipelineJson.ok ? pipelineJson.output : ""; }}
              label="Copy JSON"
            />
            <CopyButton
              getText={() => mongoshResult.ok ? mongoshResult.output : ""}
              label="Copy mongosh"
            />
            <CopyButton
              getText={() => driverResult.ok ? driverResult.output : ""}
              label={`Copy ${driverTarget}`}
            />
            <DownloadButton
              getText={() => pipelineJson.ok ? pipelineJson.output : ""}
              filename="mongo-pipeline.json"
              mime="application/json"
              label="Download JSON"
            />
            <DownloadButton
              getText={() => driverResult.ok ? driverResult.output : ""}
              filename={`mongo-pipeline.${driverTarget === "python" ? "py" : driverTarget === "java" ? "java" : driverTarget === "csharp" ? "cs" : driverTarget === "php" ? "php" : driverTarget === "node" ? "js" : "sh"}`}
              label={`Download ${driverTarget}`}
            />
            <ShareButton getUrl={() => { handleRecordHistory(); return buildShareUrl(state); }} />
            <ClearButton onClick={handleClear} />
          </div>
        </CardContent>
      </Card>

      {state.stages.length === 0 && !sampleText && (
        <EmptyState
          title="Start building an aggregation pipeline"
          hint="Add stages with the buttons above. Each stage's JSON spec is editable. Load sample documents to see per-stage transformations in-browser."
          icon={<Database className="h-8 w-8" />}
        />
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
                <div key={i} className="rounded border bg-background px-3 py-2 text-xs">
                  <Badge variant="outline" className="mr-2">{h.collection}</Badge>
                  <Badge variant="secondary" className="mr-2">{h.stageCount} stages</Badge>
                  <span className="font-mono text-muted-foreground">{h.stageTypes.join(" → ")}</span>
                  <span className="text-muted-foreground ml-2">· {h.finalCount} final · {new Date(h.ts).toLocaleString()}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-3">
          <p className="text-xs text-muted-foreground">
            <strong className="text-foreground">Privacy:</strong> All pipeline building, sample-document execution, and driver-code generation runs locally in your browser. History is stored in localStorage on this device only.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function StageRow({
  stage,
  index,
  total,
  validation,
  isPreviewing,
  onUpdate,
  onRemove,
  onMove,
  onPreview,
}: {
  stage: Stage;
  index: number;
  total: number;
  validation: { ok: true } | { ok: false; error: string };
  isPreviewing: boolean;
  onUpdate: (patch: Partial<Stage>) => void;
  onRemove: () => void;
  onMove: (dir: -1 | 1) => void;
  onPreview: () => void;
}) {
  const stageInfo = STAGE_TYPES.find((s) => s.value === stage.type);
  return (
    <div className={`rounded border p-3 space-y-2 ${stage.enabled ? "bg-card" : "bg-muted/30 opacity-70"} ${isPreviewing ? "ring-2 ring-primary" : ""}`}>
      <div className="flex items-center gap-2">
        <span className="text-[10px] text-muted-foreground w-4">{index + 1}.</span>
        <Badge variant="secondary" className="text-[10px] font-mono">{stage.type}</Badge>
        <span className="text-[10px] text-muted-foreground">{stageInfo?.hint}</span>
        <div className="ml-auto flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onMove(-1)}
            disabled={index === 0}
            title="Move up"
          >
            <ArrowUp className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onMove(1)}
            disabled={index === total - 1}
            title="Move down"
          >
            <ArrowDown className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={onPreview}
            title={isPreviewing ? "Hide preview" : "Preview output"}
          >
            {isPreviewing ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onUpdate({ enabled: !stage.enabled })}
            title={stage.enabled ? "Disable stage" : "Enable stage"}
          >
            <Filter className={`h-3.5 w-3.5 ${stage.enabled ? "text-primary" : "text-muted-foreground"}`} />
          </Button>
          <Button variant="ghost" size="icon" onClick={onRemove} title="Remove stage">
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
      <Textarea
        value={stage.spec}
        onChange={(e) => onUpdate({ spec: e.target.value })}
        placeholder={STAGE_DEFAULTS[stage.type]}
        className="min-h-[60px] font-mono text-xs"
      />
      {!validation.ok && (
        <p className="text-[10px] text-destructive">{validation.error}</p>
      )}
    </div>
  );
}

function showError(msg: string) {
  return <ErrorBanner message={msg} />;
}
