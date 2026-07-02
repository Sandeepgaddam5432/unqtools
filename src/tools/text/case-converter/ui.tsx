/**
 * Text Case Converter — Preact island UI.
 */
import { useMemo, useState } from "preact/hooks";
import {
  Textarea,
  Button,
  Card,
  CopyButton,
  DownloadButton,
  ToastContainer,
  toast,
} from "../../../components/ui";
import { convertCase, CASE_OPTIONS, type CaseType } from "./logic";

export default function CaseConverter() {
  const [input, setInput] = useState<string>("");
  const [results, setResults] = useState<Record<CaseType, string>>({} as Record<CaseType, string>);

  useMemo(() => {
    const r = {} as Record<CaseType, string>;
    for (const opt of CASE_OPTIONS) {
      r[opt.value] = convertCase(input, opt.value);
    }
    setResults(r);
  }, [input]);

  function loadSample() {
    setInput("The quick brown fox jumps over the lazy dog");
    toast("Sample loaded", "info");
  }

  return (
    <div class="space-y-4">
      <ToastContainer />

      <Textarea
        id="cc-input"
        label="Input text"
        placeholder="Type or paste text here…"
        value={input}
        onInput={(e) => setInput((e.currentTarget as HTMLTextAreaElement).value)}
        class="min-h-[140px]"
      />

      <div class="flex gap-2">
        <Button variant="ghost" onClick={loadSample}>
          Load sample
        </Button>
        <Button variant="ghost" onClick={() => setInput("")} disabled={!input}>
          Clear
        </Button>
      </div>

      <div class="grid grid-cols-1 gap-3 md:grid-cols-2">
        {CASE_OPTIONS.map((opt) => (
          <Card key={opt.value} class="!p-3">
            <div class="mb-2 flex items-center justify-between gap-2">
              <div>
                <p class="text-unq-muted text-xs font-semibold uppercase tracking-wide">
                  {opt.label}
                </p>
                <p class="text-unq-muted text-[10px]">e.g. {opt.example}</p>
              </div>
              <div class="flex gap-1">
                <CopyButton getText={() => results[opt.value] ?? ""} />
                <DownloadButton
                  filename={`${opt.value}.txt`}
                  getText={() => results[opt.value] ?? ""}
                />
              </div>
            </div>
            <pre
              class="unq-input min-h-[56px] overflow-auto whitespace-pre-wrap break-words py-2 font-mono text-sm"
              aria-live="polite"
            >
              {results[opt.value] || ""}
            </pre>
          </Card>
        ))}
      </div>

      <Card class="text-unq-muted !p-4 text-xs">
        <p>
          <strong>Privacy:</strong> all conversions happen locally in your browser. No text is
          uploaded.
        </p>
      </Card>
    </div>
  );
}
