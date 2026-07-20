"use client";

import React, { useState, useMemo, useCallback, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
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
  LANGUAGES,
  FRAMEWORKS,
  LANGUAGE_LABELS,
  FRAMEWORK_LABELS,
  FRAMEWORK_LANGUAGES,
  SAMPLE_SNIPPETS,
  DEFAULT_OPTIONS,
  detectLanguage,
  defaultFrameworkForLanguage,
  buildTestSuite,
  renderTestFile,
  computeStats,
  explainTest,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  type Language,
  type Framework,
  type GenerateOptions,
  type HistoryEntry,
} from "./logic";
import {
  FlaskConical,
  History,
  Copy,
  FileCode,
  Lightbulb,
  Eye,
  EyeOff,
  Wand2,
} from "lucide-react";

export default function AiUnitTestCaseGenerator() {
  const [code, setCode] = useState("");
  const [language, setLanguage] = useState<Language>("typescript");
  const [framework, setFramework] = useState<Framework>("vitest");
  const [opts, setOpts] = useState<GenerateOptions>(DEFAULT_OPTIONS);
  const [showExplanations, setShowExplanations] = useState(false);
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  useEffect(() => {
    setHistory(loadHistory());
    if (typeof window !== "undefined" && window.location.hash) {
      const p = parseShareUrl(window.location.hash);
      if (p.code) {
        setCode(p.code);
        if (p.language) setLanguage(p.language);
        if (p.framework) setFramework(p.framework);
        toast.info("Loaded from share link");
      }
    }
  }, []);

  const compatibleFrameworks = useMemo(
    () => FRAMEWORKS.filter((f) => FRAMEWORK_LANGUAGES[f].includes(language)),
    [language],
  );

  // Ensure framework is compatible with language
  useEffect(() => {
    if (!compatibleFrameworks.includes(framework)) {
      setFramework(defaultFrameworkForLanguage(language));
    }
  }, [language, compatibleFrameworks, framework]);

  const suite = useMemo(
    () => buildTestSuite(code, framework, language, opts),
    [code, framework, language, opts],
  );
  const rendered = useMemo(() => renderTestFile(suite), [suite]);
  const stats = useMemo(
    () => computeStats(suite.testCases, suite.functions, suite.coverageHints),
    [suite],
  );

  const handleAutoDetect = useCallback(() => {
    if (!code.trim()) {
      toast.error("Paste some code first");
      return;
    }
    const detected = detectLanguage(code);
    setLanguage(detected);
    setFramework(defaultFrameworkForLanguage(detected));
    toast.success(`Detected ${LANGUAGE_LABELS[detected]}`);
  }, [code]);

  const handleLoadSample = useCallback(() => {
    setCode(SAMPLE_SNIPPETS[language]);
    setFramework(defaultFrameworkForLanguage(language));
    toast.success(`Loaded ${LANGUAGE_LABELS[language]} sample`);
  }, [language]);

  const handleSaveHistory = useCallback(() => {
    if (suite.functions.length > 0) {
      saveHistory({
        ts: Date.now(),
        language,
        framework,
        functions: suite.functions.length,
        testCount: suite.testCases.length,
        snippet: code.slice(0, 200),
      });
      setHistory(loadHistory());
    }
  }, [suite, language, framework, code]);

  const handleClear = useCallback(() => {
    setCode("");
    setOpts(DEFAULT_OPTIONS);
    toast.info("Cleared");
  }, []);

  const handleClearHistory = useCallback(() => {
    clearHistory();
    setHistory([]);
    toast.success("History cleared");
  }, []);

  const toggleOpt = (key: keyof GenerateOptions) => {
    setOpts((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const filename = useMemo(() => {
    const ext = framework === "pytest" ? "_test.py" : framework === "junit" ? "Test.java" : ".test.ts";
    return `generated-${suite.functions[0]?.name || "suite"}${ext}`;
  }, [framework, suite]);

  return (
    <div className="space-y-4 unq-animate-fade-in-up">
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="utcg-code">Paste your code</Label>
              <div className="flex gap-1">
                <Button variant="ghost" size="sm" className="h-7 text-[11px]" onClick={handleAutoDetect}>
                  <Wand2 className="h-3 w-3 mr-1" /> Auto-detect
                </Button>
                <Button variant="ghost" size="sm" className="h-7 text-[11px]" onClick={handleLoadSample}>
                  Load sample
                </Button>
              </div>
            </div>
            <Textarea
              id="utcg-code"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder={"function add(a, b) {\n  return a + b;\n}"}
              className="min-h-[160px] resize-y font-mono text-xs"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Language</Label>
              <select
                value={language}
                onChange={(e) => setLanguage(e.target.value as Language)}
                className="w-full h-9 text-xs rounded border bg-background px-2"
              >
                {LANGUAGES.map((l) => (
                  <option key={l} value={l}>{LANGUAGE_LABELS[l]}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Framework</Label>
              <select
                value={framework}
                onChange={(e) => setFramework(e.target.value as Framework)}
                className="w-full h-9 text-xs rounded border bg-background px-2"
              >
                {compatibleFrameworks.map((f) => (
                  <option key={f} value={f}>{FRAMEWORK_LABELS[f]}</option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <Label className="text-xs">Test categories</Label>
            <div className="flex flex-wrap gap-2 pt-1">
              {([
                ["includeHappy", "Happy path"],
                ["includeEdge", "Edge cases"],
                ["includeError", "Error cases"],
                ["includeParameterized", "Parameterized"],
                ["includeSnapshot", "Snapshot (React)"],
                ["includeSetup", "Setup/teardown"],
                ["includeMocks", "Mock stubs"],
              ] as Array<[keyof GenerateOptions, string]>).map(([k, label]) => (
                <label key={k} className="flex items-center gap-1.5 text-xs cursor-pointer">
                  <input type="checkbox" checked={opts[k]} onChange={() => toggleOpt(k)} />
                  {label}
                </label>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {suite.warnings.length > 0 && (
        <ErrorBanner message={suite.warnings.join(" ")} />
      )}

      {suite.functions.length > 0 ? (
        <>
          <Card>
            <CardContent className="p-4 space-y-2">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <FlaskConical className="h-4 w-4" /> {stats.total} tests across {stats.functions} function(s)
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                <Stat label="Total tests" value={stats.total} />
                <Stat label="Happy" value={stats.happy} />
                <Stat label="Edge" value={stats.edge} />
                <Stat label="Error" value={stats.error} />
                <Stat label="Parameterized" value={stats.parameterized} />
                <Stat label="Snapshot" value={stats.snapshot} />
                <Stat label="Need mocks" value={stats.requiresMocks} highlight={stats.requiresMocks > 0 ? "bad" : undefined} />
                <Stat label="Coverage hints" value={stats.coverageHints} highlight={stats.coverageHints > 0 ? "bad" : undefined} />
              </div>
              <div className="space-y-1 pt-2">
                <div className="text-[11px] font-medium text-muted-foreground">Detected functions</div>
                {suite.functions.map((fn, i) => (
                  <div key={i} className="rounded border bg-background px-3 py-1.5 text-xs">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono font-medium text-foreground">{fn.name}</span>
                      {fn.parameters.length > 0 && (
                        <Badge variant="outline" className="text-[10px]">{fn.parameters.length} params</Badge>
                      )}
                      {fn.isAsync && <Badge variant="secondary" className="text-[10px]">async</Badge>}
                      {fn.isExported && <Badge variant="secondary" className="text-[10px]">exported</Badge>}
                      {fn.isArrow && <Badge variant="secondary" className="text-[10px]">arrow</Badge>}
                      {fn.throwsError && <Badge variant="destructive" className="text-[10px]">throws</Badge>}
                      {fn.usesFetch && <Badge variant="outline" className="text-[10px]">fetch</Badge>}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                  <FileCode className="h-4 w-4" /> Generated test file
                </h3>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-[11px]"
                  onClick={() => setShowExplanations((v) => !v)}
                >
                  {showExplanations ? <EyeOff className="h-3 w-3 mr-1" /> : <Eye className="h-3 w-3 mr-1" />}
                  {showExplanations ? "Hide explanations" : "Explain tests"}
                </Button>
              </div>
              <pre className="rounded border bg-muted/30 p-3 text-[11px] font-mono overflow-auto max-h-[480px] whitespace-pre">
                {rendered}
              </pre>
              {showExplanations && (
                <div className="space-y-1 pt-2">
                  <div className="text-[11px] font-medium text-muted-foreground flex items-center gap-1">
                    <Lightbulb className="h-3 w-3" /> Test-by-test explanations
                  </div>
                  {suite.testCases.map((tc, i) => (
                    <div key={i} className="rounded border bg-background px-3 py-2 text-[11px] space-y-1">
                      <div className="flex items-center gap-1.5">
                        <Badge variant="outline" className="text-[10px]">{tc.category}</Badge>
                        <span className="font-mono text-foreground">{tc.name}</span>
                      </div>
                      <p className="text-muted-foreground">{explainTest(tc)}</p>
                    </div>
                  ))}
                </div>
              )}
              {suite.coverageHints.length > 0 && (
                <div className="space-y-1 pt-1">
                  <div className="text-[11px] font-medium text-muted-foreground flex items-center gap-1">
                    <Lightbulb className="h-3 w-3" /> Coverage-gap hints
                  </div>
                  {suite.coverageHints.map((h, i) => (
                    <div key={i} className="rounded border bg-background px-3 py-1.5 text-[11px]">
                      <Badge variant={h.severity === "warning" ? "destructive" : "secondary"} className="text-[10px] mr-1.5">
                        {h.severity}
                      </Badge>
                      <span className="font-mono text-foreground">{h.function}</span>
                      <span className="text-muted-foreground"> — {h.hint}</span>
                    </div>
                  ))}
                </div>
              )}
              <div className="flex flex-wrap gap-2 pt-2">
                <CopyButton
                  getText={() => { handleSaveHistory(); return rendered; }}
                  label="Copy test file"
                />
                <DownloadButton
                  getText={() => { handleSaveHistory(); return rendered; }}
                  filename={filename}
                  mime="text/plain"
                  label="Download .test"
                />
                <ShareButton getUrl={() => { handleSaveHistory(); return buildShareUrl(code, framework, language); }} />
                <ClearButton onClick={handleClear} />
              </div>
            </CardContent>
          </Card>
        </>
      ) : (
        <EmptyState
          title="Paste code to generate a test suite"
          hint="Supports JavaScript, TypeScript, Python, and Java. Generates happy-path, edge, error, and parameterized tests for Jest, Vitest, PyTest, or JUnit. Click 'Load sample' to try it."
          icon={<FlaskConical className="h-8 w-8" />}
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
                  <Badge variant="outline" className="mr-2">{LANGUAGE_LABELS[h.language]}</Badge>
                  <Badge variant="outline" className="mr-2">{FRAMEWORK_LABELS[h.framework]}</Badge>
                  <Badge variant="secondary" className="mr-2">{h.functions} fns</Badge>
                  <Badge variant="secondary" className="mr-2">{h.testCount} tests</Badge>
                  <span className="text-muted-foreground font-mono">{h.snippet.slice(0, 60)}…</span>
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
            <strong className="text-foreground">Privacy:</strong> All parsing and test generation runs locally. History is stored in localStorage on this device only. The optional BYO-key LLM step (if you wire it) goes directly to your provider — never to UnQTools.
            <span className="block mt-1">
              <strong className="text-foreground">Honesty:</strong> Generated tests are starting points. Replace placeholder assertions (e.g., <code className="font-mono">toBeDefined()</code>) with real expected values, then run the suite.
            </span>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function Stat({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string | number;
  highlight?: "bad" | "good";
}) {
  const color = highlight === "bad"
    ? "text-amber-600 dark:text-amber-400"
    : highlight === "good"
      ? "text-emerald-600 dark:text-emerald-400"
      : "text-foreground";
  return (
    <div className="rounded border bg-background px-3 py-2">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className={`text-base font-semibold ${color}`}>{value}</div>
    </div>
  );
}

// Suppress unused-import lint for Copy
void Copy;
