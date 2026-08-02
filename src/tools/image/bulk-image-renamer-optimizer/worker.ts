/**
 * ===========================================================================
 * CODE-3-WORKER.ts — the Web Worker for Bulk Image Renamer + Optimizer.
 * ===========================================================================
 *
 * This is a SEPARATE FILE from the engine. It is not concatenated with the
 * CODE-1-ENGINE-PART-*.ts files; it sits next to the assembled `logic.ts` and
 * imports from it.
 *
 * Assembly:
 *   src/tools/image/bulk-image-renamer-optimizer/worker.ts   <- this file
 *   src/tools/image/bulk-image-renamer-optimizer/logic.ts    <- ENGINE PARTs 1-5
 *
 * ---------------------------------------------------------------------------
 * WHAT WAS WRONG WITH THE ORIGINAL WORKER
 * ---------------------------------------------------------------------------
 *
 * The original worker.ts was 130 lines and contained SIX distinct defects. The
 * most important one is that it never worked at all:
 *
 *   (defect 1) `postMessage(response, [result.blob])`
 *
 *       A Blob is structured-CLONEABLE but it is not TRANSFERABLE. Putting one
 *       in the transfer list throws `DataCloneError` before the message is
 *       ever sent. That line is on the SUCCESS path, so every image that
 *       processed correctly threw on the way home. The worker could only ever
 *       deliver failures.
 *
 *       This is worth dwelling on, because it explains the shape of this file.
 *       The tool had a worker, a worker fallback, and a `useWorker` toggle in
 *       the settings — an entire second code path that could not return a
 *       single successful result. It shipped because the fallback silently
 *       caught the error and re-did the work on the main thread, so the tool
 *       still produced correct output, just with none of the promised
 *       parallelism. A feature can be completely dead and still look fine.
 *
 *       The fix: read the encoded blob into an ArrayBuffer, which IS
 *       transferable, and hand ownership to the main thread with zero copies.
 *       The caller rebuilds the Blob from the buffer and the mime type.
 *
 *   (defect 3) HEIC could not be decoded here. The main thread called
 *       `heic2any` first; the worker called `createImageBitmap(file)` on raw
 *       HEIC bytes, which no browser can do. HEIC support therefore existed
 *       only on the slow path. Fixed structurally in ENGINE PART 3: decoding
 *       now always happens on the main thread via `decodeToBitmap`, and the
 *       worker receives an already-decoded ImageBitmap. This worker never
 *       touches a File.
 *
 *   (defect 4) `targetBytes` was ignored here. The user set "get every photo
 *       under 200 KB", and whether that was honoured depended on which code
 *       path their browser happened to take. Fixed by calling the one shared
 *       `processBitmapCore`.
 *
 *   (defect 8) EXIF orientation was never applied, so portrait phone photos
 *       came out sideways. Fixed in `processBitmapCore`; this worker forwards
 *       the orientation the main thread read.
 *
 *   (defect 9) The hash was computed from the RESIZED canvas here and from the
 *       ORIGINAL bitmap on the main thread. The same photo produced two
 *       different fingerprints depending on the code path, and changing the
 *       resize setting silently changed which files were reported as
 *       duplicates. Fixed: the hash is ALWAYS taken from the source bitmap,
 *       before any resizing, on both paths. A fingerprint that moves when you
 *       change an unrelated setting is not a fingerprint.
 *
 *   (defect 17) There was no way to cancel. See `cancel` below.
 *
 * ---------------------------------------------------------------------------
 * WHY THERE IS ALMOST NO IMAGE CODE IN THIS FILE
 * ---------------------------------------------------------------------------
 *
 * The original worker re-implemented resizing, white-matting, watermarking and
 * hashing in its own 70 lines, parallel to the main thread's versions. That
 * duplication IS defects 3, 4, 8 and 9 — four bugs that are all the same bug.
 *
 * So this file deliberately contains no pixel logic whatsoever. It is a
 * message-protocol adapter around `processBitmapCore`. If the pipeline needs
 * to change, there is exactly one place to change it, and the two paths cannot
 * drift apart again without a compile error.
 */

import {
  processBitmapCore,
  applyMetadataPolicy,
  computeImageHashes,
  type OptimizeOptions,
  type OutputFormat,
  type ExifData,
  type ImageHashes,
} from "./logic";

// ---------------------------------------------------------------------------
// Protocol
// ---------------------------------------------------------------------------

/**
 * A unit of work.
 *
 * `id`, `bitmap` and `options` are the original three fields and keep their
 * original meaning (D2). Everything added is optional, so an old-style message
 * still satisfies this type — it simply loses the features that need the extra
 * context.
 */
export interface WorkerRequest {
  id: number;
  bitmap: ImageBitmap;
  options: OptimizeOptions;

  /** Discriminator. Absent on legacy messages, which are treated as "process". */
  type?: "process";
  /** EXIF orientation 1-8 read on the main thread (defect 8). */
  exifOrientation?: number;
  /** Parsed EXIF, needed to write metadata back after re-encoding. */
  exif?: ExifData | null;
  /** Source byte length, for the never-grow guard. A COUNT, not the bytes. */
  originalBytes?: number;
  /** Source bytes, needed only when we may hand them back verbatim. */
  originalBlob?: Blob;
  /** The source's own format, required to make never-grow safe. */
  originalFormat?: OutputFormat | null;
  /** Compute perceptual hashes from the source bitmap. Default true. */
  wantHashes?: boolean;
}

/** Out-of-band control messages. */
export interface WorkerControlMessage {
  type: "cancel" | "cancel-all" | "ping";
  /** Required for "cancel". */
  id?: number;
}

export type WorkerInbound = WorkerRequest | WorkerControlMessage;

/**
 * Why a job failed, as a stable machine-readable code.
 *
 * The original returned only `(err as Error).message`, so the UI could not
 * tell "this one photo is corrupt, skip it and carry on" apart from "the
 * browser is out of memory, stop the whole batch now". With 400 files queued
 * that distinction is the difference between a useful warning and 400
 * identical red rows.
 */
export type WorkerErrorCode =
  | "decode"
  | "encode"
  | "memory"
  | "cancelled"
  | "unsupported"
  | "internal";

export interface WorkerResponse {
  ok: boolean;
  id: number;

  /**
   * ORIGINAL FIELD, KEPT FOR D2 — but never populated by this worker.
   *
   * Returning a Blob here is exactly what could not be transferred. Results
   * now travel as `bytes` + `mime`; use `workerResponseToBlob()` to rebuild
   * one. The field stays declared so that any code still reading it type-
   * checks and simply finds `undefined` rather than silently reading a
   * property that no longer exists.
   */
  blob?: Blob;

  /** The encoded image, transferred rather than copied. */
  bytes?: ArrayBuffer;
  /** Mime type to rebuild the Blob with. */
  mime?: string;

  width?: number;
  height?: number;
  /** Original field: the average hash (D2). Now taken from the SOURCE bitmap. */
  hash?: string;
  error?: string;

  type?: "result" | "pong" | "cancelled";
  code?: WorkerErrorCode;
  /** Quality actually used for the final encode. */
  quality?: number;
  /** Format actually emitted — may differ from options.format under smartFormat. */
  format?: OutputFormat;
  /** Plain-sentence notes for the user (D8). */
  warnings?: string[];
  /** True when the source bytes were kept instead of a re-encode (D18). */
  keptOriginal?: boolean;
  /** Both hashes plus the flat-image flag. */
  hashes?: ImageHashes;
  /** Milliseconds spent on this job — a real measurement (D20). */
  elapsedMs?: number;
}

/**
 * Rebuild a Blob from a worker result.
 *
 * Safe to call on the main thread; it is a pure function and pulls no worker
 * code into the page bundle beyond this one helper.
 */
export function workerResponseToBlob(res: WorkerResponse): Blob | null {
  if (res.blob) return res.blob;
  if (!res.bytes) return null;
  return new Blob([res.bytes], { type: res.mime || "application/octet-stream" });
}

// ---------------------------------------------------------------------------
// Cancellation (defect 17)
// ---------------------------------------------------------------------------

/**
 * Ids the main thread has asked us to abandon.
 *
 * A worker cannot be preempted mid-encode: `convertToBlob` is one opaque call
 * and there is no way to interrupt it. So cancellation is checked BETWEEN the
 * stages of a job, not inside them. In practice the longest uninterruptible
 * step is a single encode, so pressing Cancel stops the batch within roughly
 * one image rather than instantly.
 *
 * Claiming instant cancellation and then blocking for six seconds would be
 * worse than being honest about the granularity, which is why the UI says
 * "finishing the current image" instead of "cancelled".
 */
const cancelledIds = new Set<number>();
let cancelAllAfter = -1;

/** Thrown to unwind a job that the user abandoned. */
class CancelledError extends Error {
  constructor() {
    super("Cancelled");
    this.name = "CancelledError";
  }
}

function isCancelled(id: number): boolean {
  return cancelledIds.has(id) || (cancelAllAfter >= 0 && id > cancelAllAfter);
}

function throwIfCancelled(id: number): void {
  if (isCancelled(id)) throw new CancelledError();
}

// ---------------------------------------------------------------------------
// Error classification
// ---------------------------------------------------------------------------

/**
 * Map a thrown value onto a stable code.
 *
 * Matching on message text is unpleasant, but browsers do not give us typed
 * errors for "canvas allocation failed" and the distinction genuinely matters:
 * an out-of-memory error means the whole batch should stop and the user should
 * be told to use smaller chunks, whereas a decode error means skip this one
 * file. Guessing wrong costs a slightly mislabelled warning; not guessing at
 * all costs the user 400 useless error rows.
 */
function classifyError(err: unknown): { code: WorkerErrorCode; message: string } {
  if (err instanceof CancelledError) {
    return { code: "cancelled", message: "Cancelled before this image finished." };
  }

  const raw = err instanceof Error ? err.message : String(err);
  const lower = raw.toLowerCase();

  if (
    lower.includes("out of memory") ||
    lower.includes("allocation") ||
    lower.includes("insufficient resources") ||
    (err instanceof Error && err.name === "QuotaExceededError")
  ) {
    return {
      code: "memory",
      message:
        "The browser ran out of memory while processing this image. Try a smaller batch, or reduce the output size.",
    };
  }

  if (lower.includes("2d drawing context") || lower.includes("canvas")) {
    return {
      code: "memory",
      message:
        "The browser refused to create a drawing surface for this image, which usually means too many images are open at once. Try a smaller batch.",
    };
  }

  if (lower.includes("could not encode") || lower.includes("convert")) {
    return {
      code: "encode",
      message: `This image could not be saved in the chosen format. ${raw}`,
    };
  }

  if (lower.includes("decode") || lower.includes("bitmap") || lower.includes("detached")) {
    return {
      code: "decode",
      message: `This image could not be read. ${raw}`,
    };
  }

  return { code: "internal", message: raw || "This image failed for an unknown reason." };
}

// ---------------------------------------------------------------------------
// The job
// ---------------------------------------------------------------------------

async function runJob(req: WorkerRequest): Promise<WorkerResponse> {
  const startedAt = Date.now();
  const { id, bitmap, options } = req;

  try {
    throwIfCancelled(id);

    // 1. Fingerprint the SOURCE, before anything is resized (defect 9).
    //
    //    Order matters. The original hashed the finished canvas, which meant
    //    the fingerprint described the OUTPUT, not the photo — so two exports
    //    of one image at different sizes looked like different pictures, and
    //    turning the resize slider changed the duplicate report. Hashing the
    //    input makes the answer to "are these the same photo" independent of
    //    every setting on the page, which is the only way it can be useful.
    let hashes: ImageHashes | undefined;
    if (req.wantHashes !== false) {
      try {
        hashes = await computeImageHashes(bitmap);
      } catch {
        // A failed hash must be ABSENT, never a zero hash (D20). A zero hash
        // is a real value that means "blank image", and faking it here is how
        // the original reported unrelated failures as duplicates of each other.
        hashes = undefined;
      }
    }

    throwIfCancelled(id);

    // 2. The one shared pipeline. Note the 4th argument is a byte COUNT.
    const core = await processBitmapCore(
      bitmap,
      options,
      req.exifOrientation,
      req.originalBytes ?? 0,
      req.originalBlob,
      req.originalFormat,
    );

    throwIfCancelled(id);

    // 3. Metadata policy. PART-4 exists precisely so this runs identically on
    //    both paths; `processBitmapCore` deliberately does not do it, because
    //    `processImage` is the original public API and has to keep its
    //    original behaviour (D2).
    const meta = await applyMetadataPolicy(
      core.blob,
      options,
      req.exif ?? null,
      core.keptOriginal,
    );

    throwIfCancelled(id);

    // 4. Hand the bytes back by transfer, not by copy (defect 1).
    const buffer = await meta.blob.arrayBuffer();

    return {
      ok: true,
      id,
      type: "result",
      bytes: buffer,
      mime: meta.blob.type || core.format,
      width: core.width,
      height: core.height,
      hash: hashes?.aHash,
      hashes,
      quality: core.quality,
      format: core.format,
      keptOriginal: core.keptOriginal,
      warnings: [...core.warnings, ...meta.warnings],
      elapsedMs: Date.now() - startedAt,
    };
  } catch (err) {
    const { code, message } = classifyError(err);
    return {
      ok: false,
      id,
      type: code === "cancelled" ? "cancelled" : "result",
      code,
      error: message,
      elapsedMs: Date.now() - startedAt,
    };
  } finally {
    // The bitmap was transferred to us, so we own it and nobody else can free
    // it. Every ImageBitmap holds decoded pixels — roughly width x height x 4
    // bytes, which is 48 MB for a single 12-megapixel photo. Leaking these is
    // how a batch of 300 phone photos takes the tab down.
    cancelledIds.delete(id);
    try {
      bitmap.close();
    } catch {
      // Already closed or detached; nothing to do.
    }
  }
}

// ---------------------------------------------------------------------------
// Message pump
// ---------------------------------------------------------------------------

const scope = self as unknown as Worker;

function isControl(msg: WorkerInbound): msg is WorkerControlMessage {
  const t = (msg as WorkerControlMessage).type;
  return t === "cancel" || t === "cancel-all" || t === "ping";
}

self.onmessage = async (event: MessageEvent<WorkerInbound>) => {
  const msg = event.data;

  if (isControl(msg)) {
    switch (msg.type) {
      case "cancel":
        if (typeof msg.id === "number") cancelledIds.add(msg.id);
        break;
      case "cancel-all":
        // Ids are handed out in increasing order by the pool, so "everything
        // from here on" is expressible as a single watermark instead of an
        // unbounded set that would grow for the life of the worker.
        cancelAllAfter = typeof msg.id === "number" ? msg.id : -1;
        break;
      case "ping":
        // Capability probe: proves the worker booted AND that OffscreenCanvas
        // is really available, rather than assuming it from a UA string.
        scope.postMessage({
          ok: typeof OffscreenCanvas !== "undefined",
          id: -1,
          type: "pong",
        } as WorkerResponse);
        break;
    }
    return;
  }

  const response = await runJob(msg);

  // Only an ArrayBuffer goes in the transfer list. This is the line the
  // original got wrong; keeping the list explicit and narrow is the point.
  if (response.bytes) {
    scope.postMessage(response, [response.bytes]);
  } else {
    scope.postMessage(response);
  }
};

/**
 * Report a boot failure rather than dying silently.
 *
 * If the import of `./logic` throws — a missing dynamic dependency, an
 * unsupported syntax feature in an older browser — the worker is dead but the
 * main thread only sees jobs that never come back. Surfacing it lets the UI
 * fall back to main-thread processing immediately instead of hanging.
 */
self.onerror = (message) => {
  scope.postMessage({
    ok: false,
    id: -1,
    type: "result",
    code: "internal",
    error: `The image worker failed to start: ${String(message)}`,
  } as WorkerResponse);
};

