/**
 * Compress PDF to Target Size — real engine.
 *
 * A focused wrapper around the compress-pdf engine: keeps lowering image
 * quality/downscale in steps until the output fits under the requested
 * size (KB or MB). Reports the achieved size, the quality used and whether
 * the target was reached. 100% browser-side image re-encoding.
 */
import type { ToolResult } from "../../../lib/tool";
import { compressPdf, planTargetCompression, TARGET_LADDER } from "../compress-pdf/logic";

export interface TargetSizeOptions {
  /** Target size in KB (e.g. 200 = 200 KB). Min 20. */
  targetKB: number;
  /** Convert images to grayscale for better compression. */
  grayscale?: boolean;
  /** Strip metadata. */
  stripMetadata?: boolean;
}

export interface TargetSizeResult {
  bytes: Uint8Array;
  originalSize: number;
  compressedSize: number;
  targetKB: number;
  targetReached: boolean;
  /** Percentage reduction. */
  reductionPercent: number;
  /** Quality level used on the final attempt. */
  qualityUsed: number | null;
}

export async function compressToTargetSize(
  bytes: Uint8Array,
  options: TargetSizeOptions
): Promise<ToolResult<TargetSizeResult>> {
  const targetKB = Math.max(20, Math.floor(options.targetKB || 200));
  const res = await compressPdf(bytes, {
    targetSizeKB: targetKB,
    grayscale: options.grayscale,
    stripMetadata: options.stripMetadata,
  });
  if (!res.ok) return res;
  const o = res.output;
  return {
    ok: true,
    output: {
      bytes: o.bytes,
      originalSize: o.originalSize,
      compressedSize: o.compressedSize,
      targetKB,
      targetReached: o.targetReached,
      reductionPercent: o.reductionPercent,
      qualityUsed: o.qualityUsed,
    },
  };
}

export { planTargetCompression, TARGET_LADDER };
