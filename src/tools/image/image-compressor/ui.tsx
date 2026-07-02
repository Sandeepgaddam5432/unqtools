/**
 * Image Compressor — Preact island UI.
 *
 * Layout:
 *  - Global preset bar: format, quality slider, max-dimension, EXIF toggle
 *  - Drag-drop zone (single or bulk)
 *  - File list with thumbnail, original size, compressed size, savings,
 *    per-file override (quality + format)
 *  - "Download all as ZIP" + individual download buttons
 *  - Total savings summary
 *
 * Behavior:
 *  - Files processed sequentially in a Web Worker (OffscreenCanvas) to keep
 *    UI smooth and avoid memory spikes. Falls back to main thread if
 *    OffscreenCanvas is unavailable.
 *  - Per-file overrides take precedence over the global preset.
 *  - Target-size mode: binary-search quality to fit under a byte budget.
 */
import { useEffect, useRef, useState } from "preact/hooks";
import {
  Button,
  Input,
  Select,
  Toggle,
  Slider,
  Card,
  DownloadButton,
  ToastContainer,
  toast,
} from "../../../components/ui";
import {
  formatBytes,
  buildOutputFilename,
  buildStoredZip,
  tuneForTargetSize,
  type OutputFormat,
  type CompressOptions,
} from "./logic";

interface FileEntry {
  id: string;
  file: File;
  previewUrl: string;
  originalSize: number;
  status: "pending" | "processing" | "done" | "error";
  result?: { blob: Blob; width: number; height: number; quality: number };
  error?: string;
  // Per-file overrides
  overrideQuality?: number;
  overrideFormat?: OutputFormat;
  overrideMaxDim?: number;
}

export default function ImageCompressor() {
  const [format, setFormat] = useState<OutputFormat>("image/webp");
  const [quality, setQuality] = useState<number>(0.8);
  const [maxDimension, setMaxDimension] = useState<number>(0); // 0 = no resize
  const [stripExif, setStripExif] = useState<boolean>(true);
  const [targetSizeKb, setTargetSizeKb] = useState<number>(0); // 0 = disabled
  const [entries, setEntries] = useState<FileEntry[]>([]);
  const [workerSupported] = useState<boolean>(
    typeof Worker !== "undefined" && typeof OffscreenCanvas !== "undefined",
  );
  const workerRef = useRef<Worker | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [dragActive, setDragActive] = useState<boolean>(false);

  useEffect(() => {
    if (workerSupported) {
      const workerUrl = new URL("./worker.ts", import.meta.url);
      workerRef.current = new Worker(workerUrl, { type: "module" });
    }
    return () => {
      workerRef.current?.terminate();
    };
  }, [workerSupported]);

  function getOptionsForEntry(entry: FileEntry): CompressOptions {
    return {
      format: entry.overrideFormat ?? format,
      quality: entry.overrideQuality ?? quality,
      maxDimension: entry.overrideMaxDim ?? (maxDimension > 0 ? maxDimension : undefined),
      stripExif,
    };
  }

  async function compressOnMainThread(
    file: File,
    options: CompressOptions,
  ): Promise<{ blob: Blob; width: number; height: number; quality: number }> {
    const bitmap = await createImageBitmap(file);
    const canvas = document.createElement("canvas");
    const ratio =
      options.maxDimension && Math.max(bitmap.width, bitmap.height) > options.maxDimension
        ? options.maxDimension / Math.max(bitmap.width, bitmap.height)
        : 1;
    canvas.width = Math.round(bitmap.width * ratio);
    canvas.height = Math.round(bitmap.height * ratio);
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Could not get canvas context");
    if (options.format === "image/jpeg") {
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (b) => (b ? resolve(b) : reject(new Error("Canvas toBlob failed"))),
        options.format,
        options.format === "image/png" ? undefined : options.quality,
      );
    });
    return { blob, width: canvas.width, height: canvas.height, quality: options.quality };
  }

  async function compressEntry(entry: FileEntry): Promise<void> {
    const options = getOptionsForEntry(entry);
    setEntries((prev) => prev.map((e) => (e.id === entry.id ? { ...e, status: "processing" } : e)));

    try {
      let result: { blob: Blob; width: number; height: number; quality: number };

      // Target-size mode: binary search
      if (targetSizeKb > 0) {
        const targetBytes = targetSizeKb * 1024;
        const isWorker = !!workerRef.current;
        const compressAtQ = async (q: number) => {
          const opts = { ...options, quality: q };
          if (isWorker) {
            return await compressInWorker(entry.file, opts);
          }
          return await compressOnMainThread(entry.file, opts);
        };
        result = await tuneForTargetSize(targetBytes, compressAtQ, {
          maxIterations: 8,
          minQuality: 0.1,
        });
      } else {
        if (workerRef.current) {
          result = await compressInWorker(entry.file, options);
        } else {
          result = await compressOnMainThread(entry.file, options);
        }
      }

      setEntries((prev) =>
        prev.map((e) =>
          e.id === entry.id ? { ...e, status: "done", result, error: undefined } : e,
        ),
      );
    } catch (err) {
      setEntries((prev) =>
        prev.map((e) =>
          e.id === entry.id ? { ...e, status: "error", error: (err as Error).message } : e,
        ),
      );
    }
  }

  function compressInWorker(
    file: File,
    options: CompressOptions,
  ): Promise<{ blob: Blob; width: number; height: number; quality: number }> {
    return new Promise(async (resolve, reject) => {
      const worker = workerRef.current!;
      const bitmap = await createImageBitmap(file);
      const id = Date.now() + Math.random();
      const timer = setTimeout(() => {
        worker.removeEventListener("message", handler);
        reject(new Error("Worker timeout"));
      }, 60_000);
      function handler(e: MessageEvent) {
        const data = e.data;
        if (data.ok && data.blob) {
          clearTimeout(timer);
          worker.removeEventListener("message", handler);
          resolve({
            blob: data.blob,
            width: data.width,
            height: data.height,
            quality: data.quality,
          });
        } else if (!data.ok) {
          clearTimeout(timer);
          worker.removeEventListener("message", handler);
          reject(new Error(data.error ?? "Worker error"));
        }
      }
      worker.addEventListener("message", handler);
      worker.postMessage({ id, bitmap, options, filename: file.name }, [bitmap]);
    });
  }

  async function processAll() {
    for (const entry of entries) {
      if (entry.status === "pending") {
        await compressEntry(entry);
      }
    }
    toast("All files processed", "success");
  }

  async function reprocessAll() {
    // Reset all to pending and re-compress
    setEntries((prev) => prev.map((e) => ({ ...e, status: "pending" as const })));
    // Wait for state update then process
    setTimeout(async () => {
      for (let i = 0; i < entries.length; i++) {
        const entry = entries[i]!;
        await compressEntry({ ...entry, status: "pending" });
      }
      toast("All files reprocessed", "success");
    }, 50);
  }

  function handleFiles(files: FileList | File[]) {
    const arr = Array.from(files).filter((f) => f.type.startsWith("image/"));
    if (arr.length === 0) {
      toast("No image files detected", "error");
      return;
    }
    const newEntries: FileEntry[] = arr.map((file) => ({
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      file,
      previewUrl: URL.createObjectURL(file),
      originalSize: file.size,
      status: "pending",
    }));
    setEntries((prev) => [...prev, ...newEntries]);
    toast(`${arr.length} file${arr.length === 1 ? "" : "s"} added`, "info");
  }

  function onDrop(e: DragEvent) {
    e.preventDefault();
    setDragActive(false);
    if (e.dataTransfer?.files) {
      handleFiles(e.dataTransfer.files);
    }
  }

  function removeEntry(id: string) {
    setEntries((prev) => {
      const entry = prev.find((e) => e.id === id);
      if (entry) URL.revokeObjectURL(entry.previewUrl);
      return prev.filter((e) => e.id !== id);
    });
  }

  function clearAll() {
    entries.forEach((e) => URL.revokeObjectURL(e.previewUrl));
    setEntries([]);
  }

  async function downloadAllZip() {
    const done = entries.filter((e) => e.status === "done" && e.result);
    if (done.length === 0) {
      toast("No completed files to download", "error");
      return;
    }
    const zipEntries = done.map((e) => ({
      name: buildOutputFilename(e.file.name, getOptionsForEntry(e).format),
      blob: e.result!.blob,
    }));
    toast("Building ZIP…", "info");
    const zip = await buildStoredZip(zipEntries);
    const url = URL.createObjectURL(zip);
    const a = document.createElement("a");
    a.href = url;
    a.download = `unqtools-images-${Date.now()}.zip`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    toast(`Downloaded ${done.length} files as ZIP`, "success");
  }

  const totalOriginal = entries.reduce((s, e) => s + e.originalSize, 0);
  const totalCompressed = entries
    .filter((e) => e.status === "done" && e.result)
    .reduce((s, e) => s + (e.result?.blob.size ?? 0), 0);
  const totalSaved = totalOriginal > 0 ? totalOriginal - totalCompressed : 0;
  const savedPct =
    totalOriginal > 0 && totalCompressed > 0 ? Math.round((totalSaved / totalOriginal) * 100) : 0;

  return (
    <div class="space-y-4">
      <ToastContainer />

      <Card class="!p-4">
        <p class="mb-3 text-sm font-semibold">Global preset</p>
        <div class="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Select
            id="ic-format"
            label="Output format"
            value={format}
            onChange={(e) =>
              setFormat((e.currentTarget as HTMLSelectElement).value as OutputFormat)
            }
            options={[
              { value: "image/webp", label: "WebP (best size/quality)" },
              { value: "image/jpeg", label: "JPEG (best compatibility)" },
              { value: "image/png", label: "PNG (lossless)" },
            ]}
          />
          <div>
            <Slider
              id="ic-quality"
              label={`Quality: ${Math.round(quality * 100)}%`}
              min={10}
              max={100}
              step={5}
              value={Math.round(quality * 100)}
              onChange={(v) => setQuality(v / 100)}
            />
          </div>
          <Input
            id="ic-maxdim"
            label="Max dimension (px)"
            type="number"
            min={0}
            step={100}
            value={maxDimension}
            onInput={(e) => setMaxDimension(Number((e.currentTarget as HTMLInputElement).value))}
            hint="0 = no resize"
          />
          <Input
            id="ic-target"
            label="Target size (KB)"
            type="number"
            min={0}
            step={10}
            value={targetSizeKb}
            onInput={(e) => setTargetSizeKb(Number((e.currentTarget as HTMLInputElement).value))}
            hint="0 = disabled (binary-search quality)"
          />
        </div>
        <div class="mt-3 flex items-center justify-between">
          <Toggle
            id="ic-exif"
            label="Strip EXIF metadata (privacy)"
            checked={stripExif}
            onChange={setStripExif}
          />
          <span class="text-unq-muted text-xs">
            {workerSupported
              ? "✓ Worker + OffscreenCanvas ready"
              : "⚠ Worker unavailable — using main thread"}
          </span>
        </div>
      </Card>

      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragActive(true);
        }}
        onDragLeave={() => setDragActive(false)}
        onDrop={onDrop}
        class={`unq-card cursor-pointer border-2 border-dashed p-8 text-center transition-colors ${
          dragActive ? "bg-unq-accent/5 border-unq-accent" : "border-unq-border"
        }`}
        onClick={() => fileInputRef.current?.click()}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          class="hidden"
          onChange={(e) => e.currentTarget.files && handleFiles(e.currentTarget.files)}
        />
        <p class="text-lg font-semibold">Drop images here, or click to select</p>
        <p class="text-unq-muted mt-1 text-sm">JPG, PNG, WebP, GIF, BMP — single or bulk</p>
      </div>

      {entries.length > 0 && (
        <>
          <div class="flex flex-wrap items-center justify-between gap-2">
            <div class="flex gap-2">
              <Button onClick={processAll} disabled={!entries.some((e) => e.status === "pending")}>
                Process pending
              </Button>
              <Button variant="outline" onClick={reprocessAll} disabled={entries.length === 0}>
                Reprocess all
              </Button>
              <Button variant="ghost" onClick={clearAll}>
                Clear all
              </Button>
            </div>
            <div class="flex gap-2">
              <Button
                variant="outline"
                onClick={downloadAllZip}
                disabled={!entries.some((e) => e.status === "done")}
              >
                Download all as ZIP
              </Button>
            </div>
          </div>

          {totalCompressed > 0 && (
            <Card class="border-unq-success/40 bg-unq-success/5 !p-4">
              <p class="text-sm">
                <strong>Total savings:</strong>{" "}
                <span class="font-mono text-unq-success">
                  {formatBytes(totalSaved)} ({savedPct}%)
                </span>{" "}
                across {entries.filter((e) => e.status === "done").length} files
              </p>
            </Card>
          )}

          <div class="space-y-2">
            {entries.map((entry) => {
              const opts = getOptionsForEntry(entry);
              const compressedSize = entry.result?.blob.size ?? 0;
              const saved = entry.originalSize - compressedSize;
              const savedPct =
                entry.originalSize > 0 ? Math.round((saved / entry.originalSize) * 100) : 0;
              const outName = buildOutputFilename(entry.file.name, opts.format);
              return (
                <Card key={entry.id} class="!p-3">
                  <div class="flex flex-wrap items-center gap-3">
                    <img
                      src={entry.previewUrl}
                      alt={entry.file.name}
                      class="rounded-unq h-16 w-16 border border-unq-border object-cover"
                    />
                    <div class="min-w-0 flex-1">
                      <p class="truncate text-sm font-medium">{entry.file.name}</p>
                      <p class="text-unq-muted text-xs">
                        Original: {formatBytes(entry.originalSize)}
                        {entry.status === "done" && entry.result && (
                          <>
                            {" → "}
                            <span class="font-mono text-unq-success">
                              {formatBytes(compressedSize)}
                            </span>{" "}
                            <span class="text-unq-success">({savedPct}% saved)</span>
                            {" · "}
                            {entry.result.width}×{entry.result.height}
                            {" · "}Q{Math.round(entry.result.quality * 100)}
                          </>
                        )}
                        {entry.status === "processing" && " · processing…"}
                        {entry.status === "pending" && " · pending"}
                        {entry.status === "error" && (
                          <span class="text-unq-danger"> · {entry.error}</span>
                        )}
                      </p>
                    </div>
                    <div class="flex items-center gap-1">
                      <select
                        class="unq-input !min-h-[36px] !px-2 text-xs"
                        value={entry.overrideFormat ?? format}
                        onChange={(e) =>
                          setEntries((prev) =>
                            prev.map((en) =>
                              en.id === entry.id
                                ? {
                                    ...en,
                                    overrideFormat: (e.currentTarget as HTMLSelectElement)
                                      .value as OutputFormat,
                                  }
                                : en,
                            ),
                          )
                        }
                        aria-label={`Output format for ${entry.file.name}`}
                      >
                        <option value="image/webp">WebP</option>
                        <option value="image/jpeg">JPG</option>
                        <option value="image/png">PNG</option>
                      </select>
                      <input
                        type="number"
                        min={10}
                        max={100}
                        class="unq-input !min-h-[36px] !w-16 text-xs"
                        placeholder="Q%"
                        value={
                          entry.overrideQuality !== undefined
                            ? Math.round(entry.overrideQuality * 100)
                            : ""
                        }
                        onInput={(e) =>
                          setEntries((prev) =>
                            prev.map((en) =>
                              en.id === entry.id
                                ? {
                                    ...en,
                                    overrideQuality: (e.currentTarget as HTMLInputElement).value
                                      ? Number((e.currentTarget as HTMLInputElement).value) / 100
                                      : undefined,
                                  }
                                : en,
                            ),
                          )
                        }
                        aria-label={`Quality override for ${entry.file.name}`}
                      />
                      {entry.status === "done" && entry.result && (
                        <DownloadButton
                          filename={outName}
                          getText={() => ""}
                          mime={opts.format}
                          label=""
                        />
                      )}
                      <button
                        type="button"
                        class="unq-btn !min-h-[36px] border border-unq-border !px-2 text-xs"
                        aria-label={`Remove ${entry.file.name}`}
                        onClick={() => removeEntry(entry.id)}
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        </>
      )}

      <Card class="text-unq-muted !p-4 text-xs">
        <p>
          <strong>Privacy:</strong> images never leave your browser. All compression happens locally
          via the Canvas API (in a Web Worker when OffscreenCanvas is available). EXIF metadata is
          stripped by default. The ZIP download is also built locally — no server roundtrip.
        </p>
      </Card>
    </div>
  );
}
