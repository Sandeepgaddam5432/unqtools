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
  History, FileText, Plus, Trash2, ArrowUp, ArrowDown,
  Eye, EyeOff, Upload, ChevronDown,
} from "lucide-react";
import {
  SECTION_TYPE_LABELS,
  LICENSE_LABELS,
  TEMPLATE_LABELS,
  BADGE_PRESETS,
  applyTemplate,
  createSection,
  renderMarkdown,
  computeStats,
  parseReadme,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  type Section,
  type SectionType,
  type TemplateId,
  type LicenseId,
  type BadgeId,
  type ReadmeModel,
  type HistoryEntry,
} from "./logic";

const ALL_SECTION_TYPES = Object.keys(SECTION_TYPE_LABELS) as SectionType[];

export default function ReadmeGenerator() {
  const [model, setModel] = useState<ReadmeModel>(() => applyTemplate("npm"));
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [showImport, setShowImport] = useState(false);
  const [importText, setImportText] = useState("");

  useEffect(() => {
    setHistory(loadHistory());
  }, []);

  const markdown = useMemo(() => renderMarkdown(model), [model]);
  const stats = useMemo(() => computeStats(model), [model]);

  const handleSaveHistory = useCallback(() => {
    saveHistory({
      ts: Date.now(),
      projectName: model.project.name,
      sectionCount: model.sections.length,
      chars: markdown.length,
    });
    setHistory(loadHistory());
  }, [model, markdown]);

  const handleApplyTemplate = useCallback((t: TemplateId) => {
    setModel(applyTemplate(t, model.project));
    toast.success(`Applied ${TEMPLATE_LABELS[t]} template`);
  }, [model.project]);

  const updateProject = useCallback((field: keyof ReadmeModel["project"], value: string | number) => {
    setModel((prev) => ({ ...prev, project: { ...prev.project, [field]: value } }));
  }, []);

  const addSection = useCallback((type: SectionType) => {
    setModel((prev) => ({ ...prev, sections: [...prev.sections, createSection(type)] }));
    toast.success(`Added ${SECTION_TYPE_LABELS[type]} section`);
  }, []);

  const removeSection = useCallback((id: string) => {
    setModel((prev) => ({ ...prev, sections: prev.sections.filter((s) => s.id !== id) }));
  }, []);

  const moveSection = useCallback((id: string, dir: -1 | 1) => {
    setModel((prev) => {
      const idx = prev.sections.findIndex((s) => s.id === id);
      if (idx < 0) return prev;
      const next = [...prev.sections];
      const newIdx = idx + dir;
      if (newIdx < 0 || newIdx >= next.length) return prev;
      [next[idx], next[newIdx]] = [next[newIdx], next[idx]];
      return { ...prev, sections: next };
    });
  }, []);

  const toggleEnabled = useCallback((id: string) => {
    setModel((prev) => ({
      ...prev,
      sections: prev.sections.map((s) => (s.id === id ? { ...s, enabled: !s.enabled } : s)),
    }));
  }, []);

  const updateSectionField = useCallback((id: string, field: keyof Section, value: unknown) => {
    setModel((prev) => ({
      ...prev,
      sections: prev.sections.map((s) => (s.id === id ? { ...s, [field]: value } : s)),
    }));
  }, []);

  const toggleBadge = useCallback((sectionId: string, badgeId: BadgeId) => {
    setModel((prev) => ({
      ...prev,
      sections: prev.sections.map((s) => {
        if (s.id !== sectionId) return s;
        const current = s.badges ?? [];
        return { ...s, badges: current.includes(badgeId) ? current.filter((b) => b !== badgeId) : [...current, badgeId] };
      }),
    }));
  }, []);

  const handleImport = useCallback(() => {
    const text = importText.trim();
    if (!text) {
      toast.error("Paste an existing README.md first");
      return;
    }
    const parsed = parseReadme(text);
    // Preserve author/year from existing model if import didn't capture them.
    if (!parsed.project.author) parsed.project.author = model.project.author;
    if (!parsed.project.year) parsed.project.year = model.project.year;
    setModel(parsed);
    toast.success(`Imported README (${parsed.sections.length} sections)`);
    setShowImport(false);
    setImportText("");
  }, [importText, model.project.author, model.project.year]);

  const handleClear = useCallback(() => {
    setModel(applyTemplate("npm"));
    toast.info("Reset to npm template");
  }, []);

  const handleClearHistory = useCallback(() => {
    clearHistory();
    setHistory([]);
    toast.success("History cleared");
  }, []);

  return (
    <div className="space-y-4 unq-animate-fade-in-up">
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <Label className="text-xs font-semibold">Template:</Label>
            {(Object.keys(TEMPLATE_LABELS) as TemplateId[]).map((t) => (
              <Button
                key={t}
                size="sm"
                variant="outline"
                onClick={() => handleApplyTemplate(t)}
                className="h-7 text-[11px]"
              >
                {TEMPLATE_LABELS[t]}
              </Button>
            ))}
            <div className="ml-auto flex gap-2">
              <Button size="sm" variant="ghost" onClick={() => setShowImport((s) => !s)} className="gap-1.5">
                <Upload className="h-3.5 w-3.5" /> Import README
              </Button>
              <ClearButton onClick={handleClear} />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="rg-name" className="text-xs">Project name</Label>
              <Input id="rg-name" value={model.project.name} onChange={(e) => updateProject("name", e.target.value)} className="h-8 text-sm" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="rg-author" className="text-xs">Copyright author</Label>
              <Input id="rg-author" value={model.project.author} onChange={(e) => updateProject("author", e.target.value)} className="h-8 text-sm" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="rg-repo" className="text-xs">GitHub repo URL</Label>
              <Input id="rg-repo" value={model.project.repoUrl} onChange={(e) => updateProject("repoUrl", e.target.value)} placeholder="https://github.com/user/repo" className="h-8 text-sm" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="rg-npm" className="text-xs">npm package name</Label>
              <Input id="rg-npm" value={model.project.npmPackage} onChange={(e) => updateProject("npmPackage", e.target.value)} className="h-8 text-sm" />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="rg-desc" className="text-xs">Description (one sentence)</Label>
              <Input id="rg-desc" value={model.project.description} onChange={(e) => updateProject("description", e.target.value)} className="h-8 text-sm" />
            </div>
          </div>
        </CardContent>
      </Card>

      {showImport && (
        <Card>
          <CardContent className="p-4 space-y-2">
            <Label htmlFor="rg-import" className="text-xs font-semibold">Paste an existing README.md to import</Label>
            <Textarea
              id="rg-import"
              value={importText}
              onChange={(e) => setImportText(e.target.value)}
              placeholder={"# My Project\n\nA description...\n\n## Installation\n\n```bash\nnpm install my-project\n```\n"}
              className="min-h-[160px] resize-y font-mono text-xs"
            />
            <div className="flex gap-2">
              <Button size="sm" onClick={handleImport}>Import</Button>
              <Button size="sm" variant="ghost" onClick={() => { setShowImport(false); setImportText(""); }}>Cancel</Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-4 space-y-2">
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
            <Plus className="h-4 w-4" /> Add section
          </h3>
          <div className="flex flex-wrap gap-1.5">
            {ALL_SECTION_TYPES.map((t) => (
              <Button key={t} size="sm" variant="ghost" className="h-7 text-[11px]" onClick={() => addSection(t)}>
                + {SECTION_TYPE_LABELS[t]}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardContent className="p-4 space-y-2">
            <h3 className="text-sm font-semibold text-foreground">Sections ({model.sections.length})</h3>
            <div className="space-y-2 max-h-[600px] overflow-auto pr-1">
              {model.sections.map((s, idx) => (
                <div key={s.id} className={`rounded border p-2 space-y-1.5 ${s.enabled ? "bg-background" : "bg-muted/30 opacity-60"}`}>
                  <div className="flex items-center gap-1.5">
                    <Badge variant="outline" className="text-[10px]">{SECTION_TYPE_LABELS[s.type]}</Badge>
                    <Input
                      value={s.title}
                      onChange={(e) => updateSectionField(s.id, "title", e.target.value)}
                      className="h-7 text-xs flex-1"
                      placeholder="Section title"
                    />
                    <Button size="icon-sm" variant="ghost" onClick={() => toggleEnabled(s.id)} title={s.enabled ? "Disable" : "Enable"}>
                      {s.enabled ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
                    </Button>
                    <Button size="icon-sm" variant="ghost" onClick={() => moveSection(s.id, -1)} disabled={idx === 0} title="Move up">
                      <ArrowUp className="h-3.5 w-3.5" />
                    </Button>
                    <Button size="icon-sm" variant="ghost" onClick={() => moveSection(s.id, 1)} disabled={idx === model.sections.length - 1} title="Move down">
                      <ArrowDown className="h-3.5 w-3.5" />
                    </Button>
                    <Button size="icon-sm" variant="ghost" onClick={() => removeSection(s.id)} title="Remove">
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                  {(s.type !== "title" && s.type !== "badges" && s.type !== "license" && s.type !== "screenshots" && s.type !== "toc") && (
                    <Textarea
                      value={s.body}
                      onChange={(e) => updateSectionField(s.id, "body", e.target.value)}
                      className="min-h-[60px] resize-y font-mono text-[11px]"
                      placeholder="Section body (markdown)"
                    />
                  )}
                  {s.type === "badges" && (
                    <div className="flex flex-wrap gap-1.5">
                      {BADGE_PRESETS.map((b) => (
                        <label key={b.id} className="flex items-center gap-1 text-[11px] cursor-pointer">
                          <input
                            type="checkbox"
                            checked={(s.badges ?? []).includes(b.id)}
                            onChange={() => toggleBadge(s.id, b.id)}
                          />
                          {b.label}
                        </label>
                      ))}
                    </div>
                  )}
                  {s.type === "license" && (
                    <select
                      value={s.license ?? "mit"}
                      onChange={(e) => updateSectionField(s.id, "license", e.target.value as LicenseId)}
                      className="h-7 text-xs rounded border bg-background px-2"
                    >
                      {(Object.keys(LICENSE_LABELS) as LicenseId[]).map((l) => (
                        <option key={l} value={l}>{LICENSE_LABELS[l]}</option>
                      ))}
                    </select>
                  )}
                  {s.type === "screenshots" && (
                    <Input
                      value={(s.images ?? []).map((i) => i.url).join(", ")}
                      onChange={(e) => updateSectionField(s.id, "images", e.target.value.split(",").map((u) => ({ url: u.trim(), alt: "screenshot" })).filter((i) => i.url))}
                      placeholder="Comma-separated image URLs"
                      className="h-7 text-xs"
                    />
                  )}
                  {s.type === "details" && (
                    <label className="flex items-center gap-1.5 text-[11px]">
                      <input
                        type="checkbox"
                        checked={s.collapsed ?? true}
                        onChange={(e) => updateSectionField(s.id, "collapsed", e.target.checked)}
                      />
                      Collapsed by default
                    </label>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <FileText className="h-4 w-4" /> README.md preview
              </h3>
              <div className="flex flex-wrap gap-1.5">
                <CopyButton getText={() => { handleSaveHistory(); return markdown; }} label="Copy" />
                <DownloadButton
                  getText={() => { handleSaveHistory(); return markdown; }}
                  filename="README.md"
                  mime="text/markdown"
                  label="Download"
                />
                <ShareButton getUrl={() => { handleSaveHistory(); return buildShareUrl(model); }} />
              </div>
            </div>
            <div className="grid grid-cols-3 sm:grid-cols-5 gap-1.5">
              <Stat label="Sections" value={stats.sections} />
              <Stat label="Enabled" value={stats.enabledSections} />
              <Stat label="Badges" value={stats.badges} />
              <Stat label="Words" value={stats.words} />
              <Stat label="Chars" value={stats.chars} />
            </div>
            <pre className="rounded border bg-muted/30 p-3 text-[11px] font-mono whitespace-pre-wrap max-h-[480px] overflow-auto">{markdown}</pre>
          </CardContent>
        </Card>
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
                <div key={i} className="rounded border bg-background px-3 py-1.5 text-xs flex items-center gap-2">
                  <FileText className="h-3 w-3 text-muted-foreground" />
                  <span className="font-mono font-medium text-foreground">{h.projectName || "(untitled)"}</span>
                  <Badge variant="outline" className="text-[10px]">{h.sectionCount} sections</Badge>
                  <Badge variant="outline" className="text-[10px]">{h.chars} chars</Badge>
                  <span className="text-muted-foreground ml-auto">{new Date(h.ts).toLocaleString()}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-3">
          <p className="text-xs text-muted-foreground">
            <strong className="text-foreground">Privacy:</strong> All README generation runs locally. Your project info is never uploaded. History is stored in localStorage on this device only.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded border bg-background px-2 py-1.5">
      <div className="text-[9px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="text-sm font-semibold text-foreground">{value}</div>
    </div>
  );
}
