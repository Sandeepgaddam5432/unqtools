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
  RunButton,
  ErrorBanner,
} from "../../_shared";
import { toast } from "sonner";
import {
  TEMPLATES,
  TEMPLATE_LABELS,
  LICENSE_LABELS,
  BADGE_LABELS,
  SECTION_LABELS,
  ALL_SECTIONS,
  DEFAULT_INPUTS,
  SAMPLE_PROJECTS,
  LLM_KEY_STORAGE,
  listTemplates,
  buildSectionsFromTemplate,
  toggleSection,
  moveSectionUp,
  moveSectionDown,
  buildBadges,
  buildLicenseText,
  generateReadme,
  parsePackageJson,
  parseExistingReadme,
  markdownToHtml,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  buildLlmPrompt,
  renderLlmResult,
  type TemplateId,
  type LicenseId,
  type BadgeType,
  type SectionId,
  type ReadmeInputs,
  type Section,
  type HistoryEntry,
} from "./logic";
import {
  FileText, History, Key, Sparkles, ArrowUp, ArrowDown,
  Code, Package,
} from "lucide-react";

type Tab = "preview" | "markdown" | "sections" | "import" | "history";

export default function AiMarkdownReadmeGenerator() {
  const [templateId, setTemplateId] = useState<TemplateId>("npm-package");
  const [inputs, setInputs] = useState<ReadmeInputs>({ ...DEFAULT_INPUTS });
  const [sections, setSections] = useState<Section[]>(() => buildSectionsFromTemplate("npm-package"));
  const [tab, setTab] = useState<Tab>("preview");
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [showLlm, setShowLlm] = useState(false);
  const [llmKey, setLlmKey] = useState("");
  const [llmBusy, setLlmBusy] = useState(false);
  const [llmResult, setLlmResult] = useState("");
  const [llmError, setLlmError] = useState<string | null>(null);
  const [packageJsonText, setPackageJsonText] = useState("");
  const [importReadmeText, setImportReadmeText] = useState("");

  useEffect(() => {
    setHistory(loadHistory());
    try {
      const k = localStorage.getItem(LLM_KEY_STORAGE);
      if (k) setLlmKey(k);
    } catch { /* ignore */ }
    if (typeof window !== "undefined" && window.location.hash) {
      const parsed = parseShareUrl(window.location.hash);
      if (parsed) {
        setTemplateId(parsed.templateId);
        setInputs(parsed.inputs);
        setSections(parsed.sections);
        toast.info("Loaded from share link");
      }
    }
  }, []);

  const result = useMemo(
    () => generateReadme(inputs, templateId, sections),
    [inputs, templateId, sections],
  );
  const previewHtml = useMemo(() => markdownToHtml(result.markdown), [result.markdown]);

  const updateInput = useCallback(
    <K extends keyof ReadmeInputs>(key: K, value: ReadmeInputs[K]) => {
      setInputs((prev) => ({ ...prev, [key]: value }));
    },
    [],
  );

  const handleTemplateChange = useCallback((id: TemplateId) => {
    setTemplateId(id);
    setSections(buildSectionsFromTemplate(id));
  }, []);

  const handleSaveHistory = useCallback(() => {
    saveHistory({
      ts: Date.now(),
      projectName: inputs.projectName,
      templateId,
      license: inputs.license,
      charCount: result.charCount,
    });
    setHistory(loadHistory());
  }, [inputs.projectName, inputs.license, templateId, result.charCount]);

  const handleClear = useCallback(() => {
    setInputs({ ...DEFAULT_INPUTS });
    setTemplateId("npm-package");
    setSections(buildSectionsFromTemplate("npm-package"));
    setLlmResult("");
    setLlmError(null);
    toast.info("Reset to defaults");
  }, []);

  const handleClearHistory = useCallback(() => {
    clearHistory();
    setHistory([]);
    toast.success("History cleared");
  }, []);

  const handleParsePackageJson = useCallback(() => {
    if (!packageJsonText.trim()) {
      toast.error("Paste a package.json first");
      return;
    }
    const parsed = parsePackageJson(packageJsonText);
    if (Object.keys(parsed).length === 0) {
      toast.error("Could not parse package.json");
      return;
    }
    setInputs((prev) => ({ ...prev, ...parsed }));
    toast.success("package.json parsed — review fields");
    setTab("preview");
  }, [packageJsonText]);

  const handleImportReadme = useCallback(() => {
    if (!importReadmeText.trim()) {
      toast.error("Paste an existing README first");
      return;
    }
    const { inputs: parsedInputs, enabledSections } = parseExistingReadme(importReadmeText);
    setInputs((prev) => ({ ...prev, ...parsedInputs }));
    const overrides: Partial<Record<SectionId, boolean>> = {};
    for (const id of enabledSections) overrides[id] = true;
    setSections(buildSectionsFromTemplate(templateId, overrides));
    toast.success(`Imported — enabled ${enabledSections.length} sections`);
    setTab("preview");
  }, [importReadmeText, templateId]);

  const toggleBadge = (b: BadgeType) => {
    setInputs((prev) => ({
      ...prev,
      badges: prev.badges.includes(b)
        ? prev.badges.filter((x) => x !== b)
        : [...prev.badges, b],
    }));
  };

  const handleLlmKeySave = useCallback(() => {
    try {
      localStorage.setItem(LLM_KEY_STORAGE, llmKey);
      toast.success("API key saved (localStorage only)");
    } catch {
      toast.error("Could not save API key");
    }
  }, [llmKey]);

  const handleLlmEnhance = useCallback(async () => {
    if (!llmKey) {
      toast.error("Paste your own LLM API key first");
      return;
    }
    setLlmBusy(true);
    setLlmError(null);
    try {
      const prompt = buildLlmPrompt(inputs, templateId);
      const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${llmKey}`,
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          messages: [
            { role: "system", content: prompt.system },
            { role: "user", content: prompt.user },
          ],
          temperature: 0.4,
        }),
      });
      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`LLM API error ${res.status}: ${errText.slice(0, 200)}`);
      }
      const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
      const raw = data.choices?.[0]?.message?.content ?? "";
      const rendered = renderLlmResult(raw);
      setLlmResult(rendered);
      toast.success("LLM polish applied — verify the result!");
    } catch (e) {
      setLlmError(e instanceof Error ? e.message : "LLM call failed");
      toast.error("LLM call failed");
    } finally {
      setLlmBusy(false);
    }
  }, [llmKey, inputs, templateId]);

  const enabledBadges = buildBadges(inputs);

  return (
    <div className="space-y-4 unq-animate-fade-in-up">
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Template</Label>
              <select
                value={templateId}
                onChange={(e) => handleTemplateChange(e.target.value as TemplateId)}
                className="h-9 w-full text-sm rounded border bg-background px-2"
              >
                {listTemplates().map((t) => (
                  <option key={t.id} value={t.id}>{TEMPLATE_LABELS[t.id]}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">License</Label>
              <select
                value={inputs.license}
                onChange={(e) => updateInput("license", e.target.value as LicenseId)}
                className="h-9 w-full text-sm rounded border bg-background px-2"
              >
                {Object.entries(LICENSE_LABELS).map(([id, label]) => (
                  <option key={id} value={id}>{label}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Project name</Label>
              <Input
                value={inputs.projectName}
                onChange={(e) => updateInput("projectName", e.target.value)}
                className="text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Tagline (one line)</Label>
              <Input
                value={inputs.tagline}
                onChange={(e) => updateInput("tagline", e.target.value)}
                className="text-sm"
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Description</Label>
            <Textarea
              value={inputs.description}
              onChange={(e) => updateInput("description", e.target.value)}
              className="min-h-[60px] text-sm"
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Install command</Label>
              <Input
                value={inputs.installCmd}
                onChange={(e) => updateInput("installCmd", e.target.value)}
                className="text-sm font-mono"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Author</Label>
              <Input
                value={inputs.author}
                onChange={(e) => updateInput("author", e.target.value)}
                className="text-sm"
              />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">GitHub user</Label>
              <Input
                value={inputs.githubUser}
                onChange={(e) => updateInput("githubUser", e.target.value)}
                className="text-sm font-mono"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">GitHub repo / npm package name</Label>
              <Input
                value={inputs.githubRepo}
                onChange={(e) => {
                  updateInput("githubRepo", e.target.value);
                  updateInput("npmPackage", e.target.value);
                }}
                className="text-sm font-mono"
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Usage example (Markdown)</Label>
            <Textarea
              value={inputs.usageExample}
              onChange={(e) => updateInput("usageExample", e.target.value)}
              className="min-h-[80px] text-sm font-mono"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Features list (Markdown)</Label>
            <Textarea
              value={inputs.featuresList}
              onChange={(e) => updateInput("featuresList", e.target.value)}
              className="min-h-[60px] text-sm font-mono"
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Tech stack (Markdown)</Label>
              <Textarea
                value={inputs.techStack}
                onChange={(e) => updateInput("techStack", e.target.value)}
                className="min-h-[60px] text-sm font-mono"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">API doc (Markdown)</Label>
              <Textarea
                value={inputs.apiDoc}
                onChange={(e) => updateInput("apiDoc", e.target.value)}
                className="min-h-[60px] text-sm font-mono"
              />
            </div>
          </div>
          <div className="flex flex-wrap gap-4 pt-1">
            <label className="flex items-center gap-1.5 text-xs cursor-pointer">
              <input
                type="checkbox"
                checked={inputs.emojiHeadings}
                onChange={() => updateInput("emojiHeadings", !inputs.emojiHeadings)}
              />
              Emoji headings
            </label>
            <label className="flex items-center gap-1.5 text-xs cursor-pointer">
              <input
                type="checkbox"
                checked={inputs.includeToc}
                onChange={() => updateInput("includeToc", !inputs.includeToc)}
              />
              Include table of contents
            </label>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Badges (shields.io)</Label>
            <div className="flex flex-wrap gap-2">
              {(Object.keys(BADGE_LABELS) as BadgeType[]).map((b) => (
                <label key={b} className="flex items-center gap-1 text-[11px] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={inputs.badges.includes(b)}
                    onChange={() => toggleBadge(b)}
                  />
                  {BADGE_LABELS[b]}
                </label>
              ))}
            </div>
            {inputs.badges.includes("custom") && (
              <div className="grid grid-cols-3 gap-2 pt-1">
                <Input
                  value={inputs.customBadgeLabel}
                  onChange={(e) => updateInput("customBadgeLabel", e.target.value)}
                  placeholder="label"
                  className="text-xs"
                />
                <Input
                  value={inputs.customBadgeMessage}
                  onChange={(e) => updateInput("customBadgeMessage", e.target.value)}
                  placeholder="message"
                  className="text-xs"
                />
                <Input
                  value={inputs.customBadgeColor}
                  onChange={(e) => updateInput("customBadgeColor", e.target.value)}
                  placeholder="color"
                  className="text-xs"
                />
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4 space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
              <FileText className="h-4 w-4" /> Output
            </h3>
            <div className="flex flex-wrap gap-1">
              {(["preview", "markdown", "sections", "import", "history"] as Tab[]).map((t) => (
                <Button
                  key={t}
                  size="sm"
                  variant={tab === t ? "default" : "outline"}
                  onClick={() => setTab(t)}
                  className="h-7 text-xs capitalize"
                >{t}</Button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
            <Stat label="Words" value={result.wordCount} />
            <Stat label="Characters" value={result.charCount} />
            <Stat label="Lines" value={result.lineCount} />
            <Stat label="Enabled sections" value={result.sections.length} />
          </div>

          {tab === "preview" && (
            <div className="space-y-2">
              <div
                className="prose prose-sm max-w-none dark:prose-invert rounded border bg-background p-3"
                dangerouslySetInnerHTML={{ __html: previewHtml }}
              />
              <div className="flex flex-wrap gap-2 pt-2">
                <CopyButton
                  getText={() => { handleSaveHistory(); return result.markdown; }}
                  label="Copy README.md"
                />
                <DownloadButton
                  getText={() => { handleSaveHistory(); return result.markdown; }}
                  filename="README.md"
                  mime="text/markdown"
                  label="Download README.md"
                />
                <DownloadButton
                  getText={() => buildLicenseText(inputs.license, inputs.author, inputs.licenseYear)}
                  filename="LICENSE"
                  mime="text/plain"
                  label="Download LICENSE"
                />
                <ShareButton
                  getUrl={() => {
                    handleSaveHistory();
                    return buildShareUrl({ inputs, templateId, sections });
                  }}
                />
                <ClearButton onClick={handleClear} />
              </div>
            </div>
          )}

          {tab === "markdown" && (
            <div className="space-y-2">
              <pre className="whitespace-pre-wrap text-[11px] font-mono rounded border bg-background p-2 max-h-[500px] overflow-auto">
                {result.markdown}
              </pre>
              {llmResult && (
                <div className="space-y-1">
                  <div className="text-xs font-semibold text-foreground flex items-center gap-1">
                    <Sparkles className="h-3.5 w-3.5" /> LLM-polished README (verify before use)
                  </div>
                  <pre className="whitespace-pre-wrap text-[11px] font-mono rounded border bg-yellow-50 dark:bg-yellow-950/30 p-2 max-h-[400px] overflow-auto">
                    {llmResult}
                  </pre>
                  <CopyButton getText={() => llmResult} label="Copy LLM result" />
                </div>
              )}
            </div>
          )}

          {tab === "sections" && (
            <div className="space-y-1 max-h-[500px] overflow-auto">
              <p className="text-xs text-muted-foreground pb-1">Toggle and reorder sections.</p>
              {sections.map((s, i) => (
                <div key={s.id} className="flex items-center gap-2 rounded border bg-background px-3 py-1.5 text-xs">
                  <input
                    type="checkbox"
                    checked={s.enabled}
                    onChange={() => setSections((prev) => toggleSection(prev, s.id))}
                  />
                  <span className="font-mono text-muted-foreground text-[10px] w-6">{i + 1}</span>
                  <span className="flex-1 text-foreground">{SECTION_LABELS[s.id]}</span>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7"
                    onClick={() => setSections((prev) => moveSectionUp(prev, s.id))}
                    disabled={i === 0}
                  ><ArrowUp className="h-3 w-3" /></Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7"
                    onClick={() => setSections((prev) => moveSectionDown(prev, s.id))}
                    disabled={i === sections.length - 1}
                  ><ArrowDown className="h-3 w-3" /></Button>
                </div>
              ))}
            </div>
          )}

          {tab === "import" && (
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label className="text-xs flex items-center gap-1">
                  <Package className="h-3.5 w-3.5" /> Paste a package.json (optional)
                </Label>
                <Textarea
                  value={packageJsonText}
                  onChange={(e) => setPackageJsonText(e.target.value)}
                  placeholder={'{\n  "name": "my-project",\n  "description": "...",\n  "license": "MIT"\n}'}
                  className="min-h-[120px] text-xs font-mono"
                />
                <Button size="sm" onClick={handleParsePackageJson}>Parse package.json</Button>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs flex items-center gap-1">
                  <Code className="h-3.5 w-3.5" /> Paste an existing README.md to restructure
                </Label>
                <Textarea
                  value={importReadmeText}
                  onChange={(e) => setImportReadmeText(e.target.value)}
                  placeholder={"# existing-project\n\nExisting description...\n\n## Installation\n\n```bash\nnpm install\n```\n\n## License\n\nMIT"}
                  className="min-h-[150px] text-xs font-mono"
                />
                <Button size="sm" onClick={handleImportReadme}>Import README</Button>
              </div>
              <div className="flex flex-wrap gap-1">
                {SAMPLE_PROJECTS.map((s) => (
                  <Button
                    key={s.label}
                    variant="ghost"
                    size="sm"
                    className="h-6 text-[11px]"
                    onClick={() => {
                      setInputs(s.inputs);
                      setTemplateId(s.templateId);
                      setSections(buildSectionsFromTemplate(s.templateId));
                      toast.info(`Loaded sample: ${s.label}`);
                    }}
                  >+ {s.label}</Button>
                ))}
              </div>
            </div>
          )}

          {tab === "history" && (
            <div className="space-y-2">
              {history.length > 0 ? (
                <>
                  <div className="flex justify-end">
                    <Button variant="ghost" size="sm" onClick={handleClearHistory}>Clear history</Button>
                  </div>
                  {history.map((h, i) => (
                    <div key={i} className="rounded border bg-background px-3 py-2 text-xs">
                      <Badge variant="outline" className="mr-2">{TEMPLATE_LABELS[h.templateId]}</Badge>
                      <Badge variant="outline" className="mr-2">{LICENSE_LABELS[h.license]}</Badge>
                      <span className="font-mono text-foreground">{h.projectName}</span>
                      <span className="text-muted-foreground ml-2">· {h.charCount} chars · {new Date(h.ts).toLocaleString()}</span>
                    </div>
                  ))}
                </>
              ) : (
                <EmptyState
                  title="No saved projects yet"
                  hint="Use Copy README.md, Download, or Share to add a snapshot to history."
                  icon={<History className="h-8 w-8" />}
                />
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4 space-y-2">
          <button
            className="text-sm font-semibold text-foreground flex items-center gap-1.5 w-full"
            onClick={() => setShowLlm((v) => !v)}
          >
            <Sparkles className="h-4 w-4" /> Optional: BYO-key LLM polish
            <Key className="h-3.5 w-3.5 ml-auto text-muted-foreground" />
          </button>
          {showLlm && (
            <div className="space-y-2 pt-1">
              <p className="text-xs text-muted-foreground">
                Paste your own OpenAI API key (stored in localStorage only) and click polish.
                The request goes directly from your browser to OpenAI — your project inputs
                are sent to them, but never to us.
              </p>
              <Input
                type="password"
                value={llmKey}
                onChange={(e) => setLlmKey(e.target.value)}
                placeholder="sk-..."
                className="text-xs font-mono"
              />
              <div className="flex flex-wrap gap-2">
                <RunButton
                  onClick={handleLlmEnhance}
                  loading={llmBusy}
                  label="Polish with LLM"
                />
                <Button variant="outline" size="sm" onClick={handleLlmKeySave}>Save key</Button>
              </div>
              {llmError && <ErrorBanner message={llmError} />}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-3">
          <p className="text-xs text-muted-foreground">
            <strong className="text-foreground">Honesty:</strong> Generated READMEs are a strong
            starting point — verify commands, options, and API signatures against your actual code.
            All template assembly, badge building, license rendering, and Markdown preview run locally;
            nothing is uploaded. The only network call is if you use your own LLM key.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function Stat({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) {
  return (
    <div className="rounded border bg-background px-3 py-2">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="text-base font-semibold text-foreground">{value}</div>
    </div>
  );
}
