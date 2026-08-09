/**
 * PDF Permissions Editor — real engine.
 *
 * Sets a PDF's permissions (printing, copying, modifying, form filling,
 * annotations, accessibility) and locks them with a password. Also inspects
 * the current encryption/permission state. Uses pdf-lib's built-in
 * standard security handler.
 */
import { PDFDocument, PDFName, PDFDict, PDFRef } from "pdf-lib";
import type { ToolResult } from "../../../lib/tool";

export interface PermissionFlags {
  printing?: "none" | "low" | "high";
  copying?: boolean;
  modifying?: boolean;
  fillingForms?: boolean;
  annotations?: boolean;
  accessibility?: boolean;
}

export interface PermissionsOptions {
  /** Owner password (required to lock). */
  ownerPassword: string;
  /** Optional user password (empty = no password needed to open). */
  userPassword?: string;
  flags?: PermissionFlags;
}

export interface PermissionsResult {
  bytes: Uint8Array;
  encrypted: boolean;
}

/** Map our flags to pdf-lib's EncryptionPermissions values. */
export function toEncryptionPermissions(
  flags: PermissionFlags = {}
): Record<string, boolean | "low" | "high"> {
  const printing = flags.printing ?? "high";
  return {
    printing: printing === "none" ? false : printing === "low" ? "low" : true,
    modifying: flags.modifying ?? true,
    copying: flags.copying ?? true,
    annotating: flags.annotations ?? true,
    fillingForms: flags.fillingForms ?? true,
    contentAccessibility: flags.accessibility ?? true,
    documentAssembly: false,
  };
}

/** Inspect the current /Encrypt dictionary state. */
export function inspectPermissions(doc: PDFDocument): {
  encrypted: boolean;
  encryptDict: boolean;
} {
  const trailer = doc.context.trailerInfo as Record<string, unknown>;
  const enc = trailer["Encrypt"];
  let encryptDict = false;
  if (enc instanceof PDFRef || enc instanceof PDFDict) {
    encryptDict = true;
  }
  return { encrypted: Boolean(enc), encryptDict };
}

export async function setPermissions(
  bytes: Uint8Array,
  options: PermissionsOptions
): Promise<ToolResult<PermissionsResult>> {
  if (!options.ownerPassword) {
    return { ok: false, error: "Enter an owner password to lock permissions." };
  }
  let doc: PDFDocument;
  try {
    doc = await PDFDocument.load(bytes);
  } catch {
    return { ok: false, error: "Could not read the PDF — it may be corrupted or password-protected." };
  }
  const encryptFn = (doc as unknown as { encrypt?: unknown }).encrypt;
  if (typeof encryptFn !== "function") {
    return {
      ok: false,
      error:
        "Encryption is not available in this pdf-lib build. Use the Unlock tool to remove an existing password; permission-locking needs a build with encryption support.",
    };
  }
  try {
    const perms = toEncryptionPermissions(options.flags);
    await (encryptFn as (opts: {
      userPassword?: string;
      ownerPassword?: string;
      permissions: Record<string, boolean | "low" | "high">;
    }) => Promise<void>).call(doc, {
      userPassword: options.userPassword || "",
      ownerPassword: options.ownerPassword,
      permissions: perms,
    });
    const out = await doc.save();
    return { ok: true, output: { bytes: out, encrypted: true } };
  } catch {
    return { ok: false, error: "Something went wrong while locking permissions." };
  }
}

void PDFName;
