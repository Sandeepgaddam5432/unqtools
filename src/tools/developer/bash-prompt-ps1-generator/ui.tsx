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
  History, Terminal, Plus, Trash2, ChevronUp, ChevronDown, Wand2, AlertTriangle,
  CheckCircle2, Code2, Eye, GitBranch, Settings2,
} from "lucide-react";
import {
  DEFAULT_OPTIONS,
  DEFAULT_MOCK_DATA,
  PRESETS,
  PROMPT_ELEMENT_TYPES,
  STANDARD_16_COLORS,
  SGR_STYLE_DEFS,
  NERDFONT_GLYPHS,
  SEPARATORS,
  makeNewElement,
  renderBashPrompt,
  renderZshPrompt,
  renderZshRprompt,
  renderPreview,
  generateBashrcSnippet,
  generateZshrcSnippet,
  generatePs2,
  generatePs3,
  generatePs4,
  validatePrompt,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  rgbToHex,
  type PromptElement,
  type PromptOptions,
  type Shell,
  type ColorMode,
  type SgrStyle,
  type HistoryEntry,
} from "./logic";

const COLOR_MODE_LABELS: Record<ColorMode, string> = {
  none: "None",
  standard16: "Standard 16",
  bright16: "Bright 16",
  x256: "256-color",
  truecolor: "Truecolor",
};

export default function BashPromptPs1Generator() {
  const [elements, setElements] = useState<PromptElement[]>(() =>
    JSON.parse(JSON.stringify(PRESETS[0].elements)) as PromptElement[],
  );
  const [options, setOptions] = useState<PromptOptions>(PRESETS[0].options);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [mock, setMock] = useState(DEFAULT_MOCK_DATA);
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  useEffect(() => {
    setHistory(loadHistory());
    if (typeof window !== "undefined" && window.location.hash) {
      const parsed = parseShareUrl(window.location.hash);
      if (parsed.elements.length > 0) {
        setElements(parsed.elements);
        setOptions(parsed.options);
        toast.info("Loaded from share link");
      }
    }
  }, []);

  const ps1 = useMemo(
    () => options.shell === "bash"
      ? renderBashPrompt(elements, options)
      : renderZshPrompt(elements, options),
    [elements, options],
  );
  const preview = useMemo(
    () => renderPreview(elements, options, mock),
    [elements, options, mock],
  );
  const snippet = useMemo(
    () => options.shell === "bash"
      ? generateBashrcSnippet(ps1, options)
      : generateZshrcSnippet(ps1, null, options),
    [ps1, options],
  );
  const ps2 = useMemo(() => generatePs2(options), [options]);
  const ps3 = useMemo(() => generatePs3(options), [options]);
  const ps4 = useMemo(() => generatePs4(options), [options]);
  const issues = useMemo(() => validatePrompt(elements, options), [elements, options]);

  const selected = useMemo(
    () => elements.find((e) => e.id === selectedId) ?? null,
    [elements, selectedId],
  );

  const handleSaveHistory = useCallback(() => {
    saveHistory({
      ts: Date.now(),
      shell: options.shell,
      elementCount: elements.length,
      preview: preview.text,
    });
    setHistory(loadHistory());
  }, [options.shell, elements.length, preview.text]);

  const addElement = useCallback((type: PromptElement["type"]) => {
    const el = makeNewElement(type);
    setElements((prev) => [...prev, el]);
    setSelectedId(el.id);
    toast.success(`Added ${type}`);
  }, []);

  const updateElement = useCallback((id: string, patch: Partial<PromptElement>) => {
    setElements((prev) => prev.map((e) => (e.id === id ? { ...e, ...patch } : e)));
  }, []);

  const deleteElement = useCallback((id: string) => {
    setElements((prev) => prev.filter((e) => e.id !== id));
    setSelectedId((prev) => (prev === id ? null : prev));
  }, []);

  const moveElement = useCallback((id: string, dir: -1 | 1) => {
    setElements((prev) => {
      const idx = prev.findIndex((e) => e.id === id);
      if (idx === -1) return prev;
      const newIdx = idx + dir;
      if (newIdx < 0 || newIdx >= prev.length) return prev;
      const next = [...prev];
      const [item] = next.splice(idx, 1);
      next.splice(newIdx, 0, item);
      return next;
    });
  }, []);

  const loadPreset = useCallback((presetId: string) => {
    const preset = PRESETS.find((p) => p.id === presetId);
    if (!preset) return;
    const cloned = JSON.parse(JSON.stringify(preset.elements)) as PromptElement[];
    setElements(cloned);
    setOptions({ ...preset.options });
    setSelectedId(null);
    toast.success(`Loaded preset: ${preset.label}`);
  }, []);

  const handleClear = useCallback(() => {
    setElements([]);
    setSelectedId(null);
    toast.info("Cleared elements");
  }, []);

  const handleClearHistory = useCallback(() => {
    clearHistory();
    setHistory([]);
    toast.success("History cleared");
  }, []);

  const toggleStyle = useCallback((style: SgrStyle) => {
    if (!selected) return;
    const styles = selected.styles.includes(style)
      ? selected.styles.filter((s) => s !== style)
      : [...selected.styles, style];
    updateElement(selected.id, { styles });
  }, [selected, updateElement]);

  return (
    <div className="space-y-4 unq-animate-fade-in-up">
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
              <Wand2 className="h-4 w-4" /> Presets
            </h3>
            <div className="flex flex-wrap gap-1">
              {PRESETS.map((p) => (
                <Button
                  key={p.id}
                  variant="outline"
                  size="sm"
                  className="h-7 text-[11px]"
                  onClick={() => loadPreset(p.id)}
                  title={p.description}
                >{p.label}</Button>
              ))}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3 pt-1">
            <Label className="text-xs flex items-center gap-1">
              <Settings2 className="h-3 w-3" /> Shell:
              <select
                value={options.shell}
                onChange={(e) => setOptions((prev) => ({ ...prev, shell: e.target.value as Shell }))}
                className="h-7 text-xs rounded border bg-background px-2"
              >
                <option value="bash">Bash</option>
                <option value="zsh">Zsh</option>
              </select>
            </Label>
            <label className="flex items-center gap-1 text-xs cursor-pointer">
              <input
                type="checkbox"
                checked={options.titleBar}
                onChange={(e) => setOptions((prev) => ({ ...prev, titleBar: e.target.checked }))}
              />
              Title bar escape
            </label>
            <label className="flex items-center gap-1 text-xs cursor-pointer">
              <input
                type="checkbox"
                checked={options.resetAtEnd}
                onChange={(e) => setOptions((prev) => ({ ...prev, resetAtEnd: e.target.checked }))}
              />
              Reset at end
            </label>
            <label className="flex items-center gap-1 text-xs cursor-pointer">
              <input
                type="checkbox"
                checked={options.twoLine}
                onChange={(e) => setOptions((prev) => ({ ...prev, twoLine: e.target.checked }))}
              />
              Two-line
            </label>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4 space-y-3">
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
            <Plus className="h-4 w-4" /> Add element
          </h3>
          <div className="flex flex-wrap gap-1">
            {PROMPT_ELEMENT_TYPES.map((t) => (
              <Button
                key={t.type}
                variant="ghost"
                size="sm"
                className="h-7 text-[11px]"
                onClick={() => addElement(t.type)}
                title={t.description}
              >+ {t.label}</Button>
            ))}
          </div>
        </CardContent>
      </Card>

      {elements.length > 0 ? (
        <>
          <Card>
            <CardContent className="p-4 space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                  <Terminal className="h-4 w-4" /> Elements ({elements.length})
                </h3>
                <ClearButton onClick={handleClear} />
              </div>
              <div className="space-y-1">
                {elements.map((el, i) => (
                  <div
                    key={el.id}
                    className={`flex items-center gap-2 rounded border px-3 py-1.5 text-xs cursor-pointer ${
                      selectedId === el.id ? "border-primary bg-primary/5" : "bg-background"
                    }`}
                    onClick={() => setSelectedId(el.id)}
                  >
                    <Badge variant="outline" className="text-[10px] w-6 justify-center">{i + 1}</Badge>
                    <span className="font-mono text-foreground flex-1 truncate">
                      {PROMPT_ELEMENT_TYPES.find((t) => t.type === el.type)?.label ?? el.type}
                      {el.type === "custom-text" && el.text ? `: "${el.text}"` : ""}
                      {el.type === "separator" && el.separator ? `: "${el.separator}"` : ""}
                      {el.type === "nerdfont-glyph" && el.glyph ? `: ${el.glyph}` : ""}
                    </span>
                    {el.fg.mode !== "none" && (
                      <span
                        className="inline-block h-3 w-3 rounded border"
                        style={{ backgroundColor: colorSpecToCss(el.fg) }}
                        title={`FG: ${el.fg.mode}`}
                      />
                    )}
                    <Button
                      variant="ghost" size="icon-sm" className="h-5 w-5"
                      onClick={(e) => { e.stopPropagation(); moveElement(el.id, -1); }}
                      disabled={i === 0}
                    ><ChevronUp className="h-3 w-3" /></Button>
                    <Button
                      variant="ghost" size="icon-sm" className="h-5 w-5"
                      onClick={(e) => { e.stopPropagation(); moveElement(el.id, 1); }}
                      disabled={i === elements.length - 1}
                    ><ChevronDown className="h-3 w-3" /></Button>
                    <Button
                      variant="ghost" size="icon-sm" className="h-5 w-5 text-destructive"
                      onClick={(e) => { e.stopPropagation(); deleteElement(el.id); }}
                    ><Trash2 className="h-3 w-3" /></Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {selected && (
            <Card>
              <CardContent className="p-4 space-y-3">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                  <Settings2 className="h-4 w-4" /> Edit element: {PROMPT_ELEMENT_TYPES.find((t) => t.type === selected.type)?.label}
                </h3>

                {selected.type === "custom-text" && (
                  <div>
                    <Label className="text-xs">Text</Label>
                    <Input
                      value={selected.text ?? ""}
                      onChange={(e) => updateElement(selected.id, { text: e.target.value })}
                      className="mt-1"
                    />
                  </div>
                )}
                {selected.type === "separator" && (
                  <div>
                    <Label className="text-xs">Separator</Label>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {SEPARATORS.map((s) => (
                        <Button
                          key={s}
                          variant={selected.separator === s ? "default" : "outline"}
                          size="sm"
                          className="h-7 text-[11px]"
                          onClick={() => updateElement(selected.id, { separator: s })}
                        >{s === " " ? "(space)" : s}</Button>
                      ))}
                    </div>
                  </div>
                )}
                {selected.type === "nerdfont-glyph" && (
                  <div>
                    <Label className="text-xs">Glyph</Label>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {NERDFONT_GLYPHS.map((g) => (
                        <Button
                          key={g.glyph}
                          variant={selected.glyph === g.glyph ? "default" : "outline"}
                          size="sm"
                          className="h-8 w-8 text-base"
                          onClick={() => updateElement(selected.id, { glyph: g.glyph })}
                          title={g.name}
                        >{g.glyph}</Button>
                      ))}
                    </div>
                  </div>
                )}
                {(selected.type === "prompt-symbol" || selected.type === "exit-status") && (
                  <label className="flex items-center gap-2 text-xs cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selected.exitAwareColor ?? false}
                      onChange={(e) => updateElement(selected.id, { exitAwareColor: e.target.checked })}
                    />
                    Exit-aware color (green = success, red = failure)
                  </label>
                )}

                <div className="grid grid-cols-2 gap-3">
                  <ColorEditor
                    label="Foreground"
                    spec={selected.fg}
                    onChange={(patch) => updateElement(selected.id, { fg: { ...selected.fg, ...patch } })}
                  />
                  <ColorEditor
                    label="Background"
                    spec={selected.bg}
                    onChange={(patch) => updateElement(selected.id, { bg: { ...selected.bg, ...patch } })}
                  />
                </div>

                <div>
                  <Label className="text-xs">Styles</Label>
                  <div className="flex flex-wrap gap-1 pt-1">
                    {SGR_STYLE_DEFS.map((s) => (
                      <Button
                        key={s.id}
                        variant={selected.styles.includes(s.id) ? "default" : "outline"}
                        size="sm"
                        className="h-7 text-[11px]"
                        onClick={() => toggleStyle(s.id)}
                      >{s.label}</Button>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardContent className="p-4 space-y-2">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <Eye className="h-4 w-4" /> Live preview
              </h3>
              <div className="rounded-lg bg-black p-4 overflow-x-auto">
                <pre
                  className="font-mono text-sm text-white whitespace-pre-wrap"
                  style={{ minHeight: "1.5em" }}
                >
                  {preview.segments.map((seg, i) => (
                    <span
                      key={i}
                      style={{
                        color: seg.fg ? rgbToHex(seg.fg) : undefined,
                        backgroundColor: seg.bg ? rgbToHex(seg.bg) : undefined,
                        fontWeight: seg.bold ? "bold" : undefined,
                        fontStyle: seg.italic ? "italic" : undefined,
                        textDecoration: [
                          seg.underline ? "underline" : "",
                          seg.strikethrough ? "line-through" : "",
                        ].filter(Boolean).join(" ") || undefined,
                        opacity: seg.faint ? 0.5 : (seg.hidden ? 0 : 1),
                      }}
                    >{seg.text}</span>
                  ))}
                  <span className="inline-block w-2 h-4 align-middle bg-white animate-pulse" />
                </pre>
              </div>
              <div className="text-[11px] text-muted-foreground">
                Mock data — user: <code>{mock.user}</code>, host: <code>{mock.host}</code>,
                cwd: <code>{mock.cwd}</code>, git: <code>{mock.gitBranch}</code>,
                exit: <code>{mock.exitCode}</code>
              </div>
              <details className="text-xs">
                <summary className="cursor-pointer text-muted-foreground">Edit mock data</summary>
                <div className="grid grid-cols-2 gap-2 pt-2">
                  <Input value={mock.user} onChange={(e) => setMock({ ...mock, user: e.target.value })} placeholder="user" />
                  <Input value={mock.host} onChange={(e) => setMock({ ...mock, host: e.target.value })} placeholder="host" />
                  <Input value={mock.cwd} onChange={(e) => setMock({ ...mock, cwd: e.target.value })} placeholder="cwd" />
                  <Input value={mock.gitBranch} onChange={(e) => setMock({ ...mock, gitBranch: e.target.value })} placeholder="branch" />
                  <Input
                    type="number"
                    value={mock.exitCode}
                    onChange={(e) => setMock({ ...mock, exitCode: parseInt(e.target.value, 10) || 0 })}
                    placeholder="exit"
                  />
                </div>
              </details>
            </CardContent>
          </Card>

          {issues.length > 0 && (
            <Card>
              <CardContent className="p-3 space-y-1">
                {issues.map((iss, i) => (
                  <div
                    key={i}
                    className={`flex items-start gap-2 text-xs ${
                      iss.level === "warning" ? "text-amber-600 dark:text-amber-400" : "text-muted-foreground"
                    }`}
                  >
                    {iss.level === "warning"
                      ? <AlertTriangle className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
                      : <CheckCircle2 className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />}
                    <span>{iss.message}</span>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          <Card>
            <CardContent className="p-4 space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                  <Code2 className="h-4 w-4" /> {options.shell === "bash" ? "PS1" : "PROMPT"} string
                </h3>
                <Badge variant="secondary" className="text-[10px]">{ps1.length} chars</Badge>
              </div>
              <pre className="rounded border bg-muted/30 p-3 text-xs font-mono whitespace-pre-wrap break-all">
                {ps1}
              </pre>
              <div className="flex flex-wrap gap-2">
                <CopyButton
                  getText={() => { handleSaveHistory(); return ps1; }}
                  label={`Copy ${options.shell === "bash" ? "PS1" : "PROMPT"}`}
                />
                <CopyButton
                  getText={() => snippet}
                  label={`Copy .${options.shell === "bash" ? "bashrc" : "zshrc"} snippet`}
                />
                <DownloadButton
                  getText={() => snippet}
                  filename={options.shell === "bash" ? "bashrc-snippet.sh" : "zshrc-snippet.sh"}
                  mime="text/x-shellscript"
                  label="Download snippet"
                />
                <ShareButton
                  getUrl={() => { handleSaveHistory(); return buildShareUrl(elements, options); }}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 space-y-2">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <Code2 className="h-4 w-4" /> .{options.shell === "bash" ? "bashrc" : "zshrc"} snippet
              </h3>
              <pre className="rounded border bg-muted/30 p-3 text-xs font-mono whitespace-pre-wrap break-all max-h-[300px] overflow-auto">
                {snippet}
              </pre>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 space-y-2">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <GitBranch className="h-4 w-4" /> Secondary prompts (PS2 / PS3 / PS4)
              </h3>
              <div className="space-y-1 text-xs font-mono">
                <div className="flex gap-2"><span className="text-muted-foreground w-12">PS2</span><code className="flex-1 break-all">{ps2}</code></div>
                <div className="flex gap-2"><span className="text-muted-foreground w-12">PS3</span><code className="flex-1 break-all">{ps3}</code></div>
                <div className="flex gap-2"><span className="text-muted-foreground w-12">PS4</span><code className="flex-1 break-all">{ps4}</code></div>
              </div>
            </CardContent>
          </Card>
        </>
      ) : (
        <EmptyState
          title="Add elements to build your prompt"
          hint="Click an element type above (username, hostname, cwd, git branch, …) to add it to your prompt. Or load a preset to start."
          icon={<Terminal className="h-8 w-8" />}
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
                  <Badge variant="outline" className="mr-2 text-[10px]">{h.shell}</Badge>
                  <Badge variant="outline" className="mr-2 text-[10px]">{h.elementCount} el</Badge>
                  <span className="font-mono text-muted-foreground">{h.preview || "(empty)"}</span>
                  <span className="text-muted-foreground ml-2">· {new Date(h.ts).toLocaleString()}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-3">
          <p className="text-xs text-muted-foreground">
            <strong className="text-foreground">Privacy:</strong> All prompt generation runs locally. History is stored in localStorage on this device only.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function ColorEditor({
  label,
  spec,
  onChange,
}: {
  label: string;
  spec: PromptElement["fg"];
  onChange: (patch: Partial<PromptElement["fg"]>) => void;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      <select
        value={spec.mode}
        onChange={(e) => onChange({ mode: e.target.value as ColorMode })}
        className="h-7 text-xs rounded border bg-background px-2 w-full"
      >
        {(Object.keys(COLOR_MODE_LABELS) as ColorMode[]).map((m) => (
          <option key={m} value={m}>{COLOR_MODE_LABELS[m]}</option>
        ))}
      </select>
      {spec.mode === "standard16" || spec.mode === "bright16" ? (
        <div className="flex flex-wrap gap-1">
          {STANDARD_16_COLORS
            .filter((c) => c.bright === (spec.mode === "bright16"))
            .map((c) => (
              <button
                key={c.fg}
                className="h-5 w-5 rounded border"
                style={{ backgroundColor: c.hex }}
                title={c.name}
                onClick={() => onChange({ index: STANDARD_16_COLORS.indexOf(c) })}
              />
            ))}
        </div>
      ) : null}
      {spec.mode === "x256" && (
        <Input
          type="number"
          min={0}
          max={255}
          value={spec.index}
          onChange={(e) => onChange({ index: parseInt(e.target.value, 10) || 0 })}
          className="text-xs"
        />
      )}
      {spec.mode === "truecolor" && (
        <Input
          type="color"
          value={rgbToHex(spec.rgb)}
          onChange={(e) => {
            const hex = e.target.value;
            const r = parseInt(hex.slice(1, 3), 16);
            const g = parseInt(hex.slice(3, 5), 16);
            const b = parseInt(hex.slice(5, 7), 16);
            onChange({ rgb: { r, g, b } });
          }}
          className="h-8 p-1"
        />
      )}
    </div>
  );
}

function colorSpecToCss(spec: PromptElement["fg"]): string {
  if (spec.mode === "none") return "transparent";
  if (spec.mode === "truecolor") return rgbToHex(spec.rgb);
  if (spec.mode === "x256") {
    // approximate
    const idx = Math.max(0, Math.min(15, spec.index));
    return STANDARD_16_COLORS[idx].hex;
  }
  const idx = Math.max(0, Math.min(15, spec.index));
  return STANDARD_16_COLORS[idx].hex;
}
