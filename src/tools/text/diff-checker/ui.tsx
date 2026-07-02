import { useMemo, useState } from "preact/hooks";
import {
  Textarea,
  Card,
  CopyButton,
  ToastContainer,
  // toast removed — unused
  Segmented,
} from "../../../components/ui";
import { diff, diffStats, diffPercentage, type DiffMode } from "./logic";

const MODE_OPTIONS = [
  { value: "line", label: "Line" },
  { value: "word", label: "Word" },
  { value: "char", label: "Char" },
];

export default function DiffChecker() {
  const [oldText, setOldText] = useState("");
  const [newText, setNewText] = useState("");
  const [mode, setMode] = useState<DiffMode>("line");

  const parts = useMemo(() => diff(oldText, newText, mode), [oldText, newText, mode]);
  const stats = useMemo(() => diffStats(parts), [parts]);
  const pct = useMemo(() => diffPercentage(parts), [parts]);

  return (
    <div class="space-y-4">
      <ToastContainer />
      <div class="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Textarea
          id="dc-old"
          label="Original text"
          placeholder="Paste original…"
          value={oldText}
          onInput={(e) => setOldText((e.currentTarget as HTMLTextAreaElement).value)}
          hint={`${oldText.length} chars`}
          class="min-h-[180px] resize-y font-mono text-sm"
        />
        <Textarea
          id="dc-new"
          label="Modified text"
          placeholder="Paste modified…"
          value={newText}
          onInput={(e) => setNewText((e.currentTarget as HTMLTextAreaElement).value)}
          hint={`${newText.length} chars`}
          class="min-h-[180px] resize-y font-mono text-sm"
        />
      </div>
      <Card class="!p-4">
        <p class="mb-2 text-sm font-medium text-unq-text">Diff mode</p>
        <Segmented items={MODE_OPTIONS} value={mode} onChange={(v) => setMode(v as DiffMode)} />
        {(oldText || newText) && (
          <div class="mt-4 flex flex-wrap gap-4 text-sm">
            <span class="text-unq-success-strong">+{stats.additions} additions</span>
            <span class="text-unq-danger-strong">−{stats.deletions} deletions</span>
            <span class="text-unq-text-3">{pct.toFixed(1)}% changed</span>
          </div>
        )}
      </Card>
      {(oldText || newText) && (
        <Card class="!p-4">
          <div class="mb-3 flex items-center justify-between">
            <p class="text-sm font-medium text-unq-text">Diff result</p>
            <CopyButton getText={() => parts.map((p) => p.text).join("")} />
          </div>
          <div
            class="unq-scroll-x border-unq-border-subtle rounded-lg border p-4 font-mono text-sm"
            style="line-height: 1.6;"
          >
            {parts.map((p, i) => (
              <span
                key={i}
                style={{
                  background:
                    p.type === "add"
                      ? "rgba(48, 209, 88, 0.15)"
                      : p.type === "del"
                        ? "rgba(255, 59, 48, 0.15)"
                        : "transparent",
                  textDecoration: p.type === "del" ? "line-through" : "none",
                  color:
                    p.type === "add"
                      ? "var(--unq-success-strong)"
                      : p.type === "del"
                        ? "var(--unq-danger-strong)"
                        : "inherit",
                  whiteSpace: "pre-wrap",
                  wordBreak: "break-word",
                }}
              >
                {p.text}
              </span>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
