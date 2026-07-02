/**
 * Hash Generator — Preact island UI.
 */
import { useEffect, useRef, useState } from "preact/hooks";
import {
  Textarea,
  Button,
  Select,
  CopyButton,
  Card,
  ToastContainer,
  toast,
} from "../../../components/ui";
import { hashString, hashFile, ALGORITHMS, formatBytes, type HashAlgorithm } from "./logic";

export default function HashGenerator() {
  const [input, setInput] = useState<string>("");
  const [algorithm, setAlgorithm] = useState<HashAlgorithm>("SHA-256");
  const [result, setResult] = useState<{ hex: string; base64: string } | null>(null);
  const [busy, setBusy] = useState<boolean>(false);
  const [fileInfo, setFileInfo] = useState<{ name: string; size: number } | null>(null);
  const [outputFormat, setOutputFormat] = useState<"hex" | "base64">("hex");
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Auto-hash on input/algorithm change (text mode only)
  useEffect(() => {
    if (fileInfo) return; // Don't auto-hash when in file mode
    if (!input) {
      setResult(null);
      return;
    }
    let cancelled = false;
    setBusy(true);
    hashString(input, algorithm)
      .then((r) => {
        if (!cancelled) setResult(r);
      })
      .catch((e) => {
        if (!cancelled) toast((e as Error).message, "error");
      })
      .finally(() => {
        if (!cancelled) setBusy(false);
      });
    return () => {
      cancelled = true;
    };
  }, [input, algorithm, fileInfo]);

  async function onFileChange(e: Event) {
    const file = (e.currentTarget as HTMLInputElement).files?.[0];
    if (!file) return;
    setFileInfo({ name: file.name, size: file.size });
    setInput(""); // Clear text input
    setBusy(true);
    try {
      const r = await hashFile(file, algorithm);
      setResult(r);
    } catch (err) {
      toast((err as Error).message, "error");
      setResult(null);
    } finally {
      setBusy(false);
    }
  }

  function loadSample() {
    setFileInfo(null);
    setInput("The quick brown fox jumps over the lazy dog");
    toast("Sample loaded", "info");
  }

  function clearAll() {
    setInput("");
    setResult(null);
    setFileInfo(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  const displayValue = result ? (outputFormat === "hex" ? result.hex : result.base64) : "";

  return (
    <div class="space-y-4">
      <ToastContainer />

      <Card class="!p-4">
        <div class="flex flex-wrap items-end gap-4">
          <Select
            id="hash-algo"
            label="Algorithm"
            value={algorithm}
            onChange={(e) =>
              setAlgorithm((e.currentTarget as HTMLSelectElement).value as HashAlgorithm)
            }
            options={ALGORITHMS.map((a) => ({ value: a, label: a }))}
          />
          <Select
            id="hash-format"
            label="Output format"
            value={outputFormat}
            onChange={(e) =>
              setOutputFormat((e.currentTarget as HTMLSelectElement).value as "hex" | "base64")
            }
            options={[
              { value: "hex", label: "Hex (lowercase)" },
              { value: "base64", label: "Base64" },
            ]}
          />
          <div class="ml-auto flex gap-2">
            <Button variant="ghost" onClick={loadSample}>
              Sample
            </Button>
            <Button variant="ghost" onClick={clearAll} disabled={!input && !result && !fileInfo}>
              Clear
            </Button>
          </div>
        </div>
      </Card>

      <Card class="!p-4">
        <p class="mb-2 text-sm font-semibold">Hash text</p>
        <Textarea
          id="hash-input"
          placeholder="Type text to hash…"
          value={input}
          onInput={(e) => {
            setInput((e.currentTarget as HTMLTextAreaElement).value);
            setFileInfo(null);
          }}
          hint={busy ? "Hashing…" : input ? `${new Blob([input]).size.toLocaleString()} bytes` : ""}
          class="min-h-[160px] font-mono text-sm"
        />
      </Card>

      <Card class="!p-4">
        <p class="mb-2 text-sm font-semibold">Or hash a file</p>
        <input
          ref={fileInputRef}
          type="file"
          class="block w-full text-sm"
          onChange={onFileChange}
        />
        {fileInfo && (
          <p class="text-unq-muted mt-2 text-xs">
            {fileInfo.name} — {formatBytes(fileInfo.size)}
          </p>
        )}
      </Card>

      {result && (
        <Card class="!p-4">
          <div class="mb-2 flex items-center justify-between">
            <p class="text-sm font-semibold">
              {algorithm} {outputFormat === "hex" ? "(hex)" : "(Base64)"}
            </p>
            <CopyButton getText={() => displayValue} />
          </div>
          <pre
            aria-live="polite"
            class="unq-input min-h-[80px] overflow-auto whitespace-pre-wrap break-all py-2 font-mono text-xs"
          >
            {displayValue}
          </pre>
        </Card>
      )}

      <Card class="text-unq-muted !p-4 text-xs">
        <p>
          <strong>Privacy:</strong> all hashing happens locally via the browser's Web Crypto API.
          Your input and files never leave your device. SHA-1 is included for legacy compatibility
          only — use SHA-256 or SHA-512 for security-sensitive purposes.
        </p>
      </Card>
    </div>
  );
}
