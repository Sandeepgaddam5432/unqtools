import { useMemo, useState } from "preact/hooks";
import {
  Textarea,
  Button,
  Card,
  CopyButton,
  ToastContainer,
  toast,
  Input,
  Segmented,
} from "../../../components/ui";
import { encrypt, decrypt, rot13, bruteForce } from "./logic";

type Mode = "encrypt" | "decrypt" | "rot13" | "brute";

const MODE_OPTIONS = [
  { value: "encrypt", label: "Encrypt" },
  { value: "decrypt", label: "Decrypt" },
  { value: "rot13", label: "ROT13" },
  { value: "brute", label: "Brute-force" },
];

export default function CaesarCipher() {
  const [input, setInput] = useState("");
  const [mode, setMode] = useState<Mode>("encrypt");
  const [shift, setShift] = useState(3);

  const result = useMemo(() => {
    if (!input) return "";
    if (mode === "encrypt") return encrypt(input, shift);
    if (mode === "decrypt") return decrypt(input, shift);
    if (mode === "rot13") return rot13(input);
    return ""; // brute handled separately
  }, [input, mode, shift]);

  const bruteResults = useMemo(
    () => (mode === "brute" && input ? bruteForce(input) : []),
    [input, mode],
  );

  return (
    <div class="space-y-4">
      <ToastContainer />
      <Textarea
        id="cc-input"
        label="Input text"
        placeholder="Type text to encrypt/decrypt…"
        value={input}
        onInput={(e) => setInput((e.currentTarget as HTMLTextAreaElement).value)}
        hint={`${input.length} characters`}
        class="min-h-[120px] resize-y"
      />
      <Card class="!p-4">
        <p class="mb-2 text-sm font-medium text-unq-text">Mode</p>
        <Segmented items={MODE_OPTIONS} value={mode} onChange={(v) => setMode(v as Mode)} />
        {(mode === "encrypt" || mode === "decrypt") && (
          <div class="mt-4 flex items-center gap-3">
            <label for="cc-shift" class="text-sm font-medium text-unq-text">
              Shift (1–25):
            </label>
            <Input
              id="cc-shift"
              type="number"
              min={1}
              max={25}
              value={shift}
              onInput={(e) => setShift(Number((e.currentTarget as HTMLInputElement).value) || 1)}
              class="w-20"
            />
          </div>
        )}
      </Card>
      <Button
        variant="ghost"
        onClick={() => {
          setInput("The quick brown fox jumps over the lazy dog");
          toast("Sample loaded", "info");
        }}
      >
        Load sample
      </Button>
      {mode !== "brute" && (
        <>
          <Textarea
            id="cc-output"
            label="Output"
            value={result}
            readonly
            class="min-h-[120px] resize-y font-mono text-sm"
          />
          {result && <CopyButton getText={() => result} />}
        </>
      )}
      {mode === "brute" && bruteResults.length > 0 && (
        <Card class="!p-4">
          <p class="mb-3 text-sm font-medium text-unq-text">
            All 25 candidates (ranked by frequency analysis)
          </p>
          <div class="unq-scroll-x max-h-[400px] overflow-y-auto">
            <table class="w-full text-sm">
              <thead class="sticky top-0 bg-unq-surface">
                <tr class="text-unq-text-2 border-b border-unq-border text-left">
                  <th class="px-3 py-2">Rank</th>
                  <th class="px-3 py-2">Shift</th>
                  <th class="px-3 py-2">Plaintext</th>
                  <th class="px-3 py-2 text-right">Chi²</th>
                </tr>
              </thead>
              <tbody>
                {bruteResults.map((r, i) => (
                  <tr
                    key={r.shift}
                    class={`border-unq-border/40 border-b ${i === 0 ? "bg-unq-accent-subtle font-medium" : ""}`}
                  >
                    <td class="text-unq-text-3 px-3 py-2">{i === 0 ? "★" : i + 1}</td>
                    <td class="px-3 py-2 font-mono">{r.shift}</td>
                    <td class="break-all px-3 py-2 font-mono">
                      {r.plaintext.slice(0, 80)}
                      {r.plaintext.length > 80 ? "…" : ""}
                    </td>
                    <td class="text-unq-text-3 px-3 py-2 text-right font-mono">
                      {r.chiSquared.toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p class="text-unq-text-3 mt-2 text-xs">
            ★ = best guess (lowest chi-squared = closest to English letter frequencies)
          </p>
        </Card>
      )}
    </div>
  );
}
