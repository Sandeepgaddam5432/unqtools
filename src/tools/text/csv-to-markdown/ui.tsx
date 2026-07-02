import { useMemo, useState } from "preact/hooks";
import {
  Textarea,
  Button,
  Card,
  CopyButton,
  ToastContainer,
  toast,
  Select,
  Switch,
} from "../../../components/ui";
import { toMarkdown, DEFAULT_OPTIONS, type CsvToMarkdownOptions } from "./logic";

const OUTPUT_OPTIONS = [
  { value: "gfm", label: "GitHub Markdown" },
  { value: "html", label: "HTML table" },
  { value: "jira", label: "Jira table" },
];

export default function CsvToMarkdown() {
  const [input, setInput] = useState("");
  const [opts, setOpts] = useState<CsvToMarkdownOptions>(DEFAULT_OPTIONS);
  const output = useMemo(() => toMarkdown(input, opts), [input, opts]);
  const update = (p: Partial<CsvToMarkdownOptions>) => setOpts((o) => ({ ...o, ...p }));

  return (
    <div class="space-y-4">
      <ToastContainer />
      <Textarea
        id="ctm-input"
        label="CSV input"
        placeholder="a,b,c\n1,2,3"
        value={input}
        onInput={(e) => setInput((e.currentTarget as HTMLTextAreaElement).value)}
        hint={`${input.length} chars`}
        class="min-h-[120px] resize-y font-mono text-sm"
      />
      <Card class="flex flex-wrap gap-4 !p-4">
        <Switch
          checked={opts.hasHeader}
          onChange={(v) => update({ hasHeader: v })}
          label="First row is header"
        />
        <div class="flex flex-col gap-1.5">
          <label for="ctm-out" class="text-sm font-medium text-unq-text">
            Output format
          </label>
          <Select
            id="ctm-out"
            value={opts.output}
            onChange={(v) => update({ output: v as CsvToMarkdownOptions["output"] })}
            options={OUTPUT_OPTIONS}
            class="w-44"
          />
        </div>
      </Card>
      <Button
        variant="ghost"
        onClick={() => {
          setInput("Name,Age,City\nAlice,30,NYC\nBob,25,LA");
          toast("Sample loaded", "info");
        }}
      >
        Load sample
      </Button>
      <Textarea
        id="ctm-output"
        label="Output"
        value={output}
        readonly
        class="min-h-[120px] resize-y font-mono text-sm"
      />
      {output && <CopyButton getText={() => output} />}
    </div>
  );
}
