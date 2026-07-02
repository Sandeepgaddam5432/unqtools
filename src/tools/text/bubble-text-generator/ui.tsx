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
import { toBubble, getStyleA11y, STYLE_OPTIONS, type BubbleStyle } from "./logic";

export default function BubbleTextGenerator() {
  const [input, setInput] = useState("");
  const [style, setStyle] = useState<BubbleStyle>("circled");
  const output = useMemo(() => toBubble(input, style), [input, style]);
  const a11y = getStyleA11y(style);

  return (
    <div class="space-y-4">
      <ToastContainer />
      <Textarea
        id="btg-input"
        label="Input text"
        placeholder="Type text to bubble…"
        value={input}
        onInput={(e) => setInput((e.currentTarget as HTMLTextAreaElement).value)}
        hint={`${input.length} characters`}
        class="min-h-[100px] resize-y"
      />
      <Card class="!p-4">
        <p class="text-unq-text mb-2 text-sm font-medium">Style</p>
        <Segmented
          options={STYLE_OPTIONS.map((s) => ({ value: s.value, label: s.label }))}
          value={style}
          onChange={(v) => setStyle(v as BubbleStyle)}
        />
        <p class="text-unq-text-3 mt-3 text-xs">
          <strong class="text-unq-text-2">Accessibility:</strong> {a11y}
        </p>
      </Card>
      <Button
        variant="ghost"
        onClick={() => {
          setInput("Bubble Text");
          toast("Sample loaded", "info");
        }}
      >
        Load sample
      </Button>
      {output && (
        <Card class="!p-4">
          <div class="mb-3 flex items-center justify-between">
            <p class="text-unq-text text-sm font-medium">Preview</p>
            <CopyButton getText={() => output} />
          </div>
          <div
            class="unq-scroll-x border-unq-border-subtle rounded-lg border p-4"
            style="font-size: 1.5rem; line-height: 1.4; word-break: break-word; overflow-wrap: break-word;"
          >
            {output}
          </div>
        </Card>
      )}
      <Textarea
        id="btg-output"
        label="Output"
        value={output}
        readonly
        class="min-h-[100px] resize-y text-lg"
      />
    </div>
  );
}
