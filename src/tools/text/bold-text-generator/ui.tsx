/**
 * Bold Text Generator — Preact island UI.
 */
import { useMemo, useState } from "preact/hooks";
import {
  Textarea,
  Button,
  Card,
  CopyButton,
  ToastContainer,
  toast,
  Segmented,
} from "../../../components/ui";
import { toBold, getStyleA11y, STYLE_OPTIONS, type BoldStyle } from "./logic";

export default function BoldTextGenerator() {
  const [input, setInput] = useState("");
  const [style, setStyle] = useState<BoldStyle>("serif-bold");

  const output = useMemo(() => toBold(input, style), [input, style]);
  const a11y = getStyleA11y(style);

  function loadSample() {
    setInput("Bold Text Generator");
    toast("Sample loaded", "info");
  }

  return (
    <div class="space-y-4">
      <ToastContainer />

      <Textarea
        id="btg-input"
        label="Input text"
        placeholder="Type text to bold…"
        value={input}
        onInput={(e) => setInput((e.currentTarget as HTMLTextAreaElement).value)}
        hint={`${input.length} characters`}
        class="min-h-[100px] resize-y"
      />

      <Card class="!p-4">
        <p class="mb-2 text-sm font-medium text-fg">Bold style</p>
        <Segmented
          options={STYLE_OPTIONS.map((s) => ({ value: s.value, label: s.label }))}
          value={style}
          onChange={(v) => setStyle(v as BoldStyle)}
        />
        <p class="mt-3 text-xs text-fg-subtle">
          <strong class="text-fg-muted">Accessibility:</strong> {a11y}
        </p>
      </Card>

      <div class="flex gap-2">
        <Button variant="ghost" onClick={loadSample}>
          Load sample
        </Button>
      </div>

      {output && (
        <Card class="!p-4">
          <div class="mb-3 flex items-center justify-between">
            <p class="text-sm font-medium text-fg">Preview</p>
            <CopyButton getText={() => output} />
          </div>
          <div
            class="unq-scroll-x rounded-lg border border-border p-4"
            style="font-size: 1.5rem; line-height: 1.4; word-break: break-word; overflow-wrap: break-word;"
          >
            {output}
          </div>
        </Card>
      )}

      <Textarea
        id="btg-output"
        label="Output (copy-paste)"
        value={output}
        readonly
        class="min-h-[100px] resize-y text-lg"
      />
    </div>
  );
}
