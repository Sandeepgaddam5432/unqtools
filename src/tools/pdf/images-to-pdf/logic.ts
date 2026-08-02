"use client"

/**
 * Images to PDF — engine half of the 100x rebuild.
 *
 * Copy to: src/tools/pdf/images-to-pdf/logic.ts
 *
 * This is the first tool in the pdf category that was NOT a stub. The original
 * genuinely worked, so everything it got right is kept:
 *
 *   - imagesToPdf(images, options) keeps its exact name, arguments and
 *     ToolResult<Uint8Array> return shape, so logic.test.ts keeps passing
 *   - PageSize, Orientation, MarginSize, ImageEntry and ImagesToPdfOptions keep
 *     their names; the unions are widened and the options object is only ever
 *     extended with optional fields
 *   - the scale-to-fit-and-centre geometry is still the default behaviour
 *
 * What is fixed here:
 *
 *   - image PIXELS are no longer used as PDF POINTS. There is a real dpi setting,
 *     so "fit to image" on a 3000x2000 photo no longer produces a 41-inch page.
 *   - a file's format is decided by its actual bytes, not by the browser's
 *     reported MIME type, and never guessed as JPEG
 *   - WebP, GIF, BMP, AVIF and TIFF are converted through a canvas, and HEIC
 *     through the already-installed heic2any. No new dependency.
 *   - one unsupported image no longer destroys the whole batch
 *   - the real cause of a failure is reported instead of "please try again"
 *
 * The one project import below is type-only and required by decision D2: the
 * public signature of imagesToPdf must not change.
 */

import { useCallback, useEffect, useState } from "react"
import { PDFDocument, PageSizes, degrees, rgb } from "pdf-lib"
import JSZip from "jszip"
import type { ToolResult } from "../../../lib/tool"

/* ------------------------------------------------------------------ *
 * 1. Limits and units
 * ------------------------------------------------------------------ */

export const PT_PER_INCH = 72
export const MM_PER_INCH = 25.4

export const MAX_FILE_BYTES = 100 * 1024 * 1024
export const MAX_TOTAL_BYTES = 300 * 1024 * 1024
export const MAX_FILES = 200
export const WARN_TOTAL_BYTES = 50 * 1024 * 1024
export const WARN_FILE_BYTES = 25 * 1024 * 1024
export const RENDER_LIMIT = 200
/** Below this, an image will look soft when printed. */
export const LOW_DPI = 150
/** A page larger than this in either direction is almost certainly a mistake. */
export const ABSURD_PAGE_INCHES = 60

export const MAX_HISTORY = 20
export const MAX_PRESETS = 12

/* ------------------------------------------------------------------ *
 * 2. Types — the original three unions, widened
 * ------------------------------------------------------------------ */

export type PageSize = "a4" | "letter" | "fit" | "a3" | "a5" | "legal" | "tabloid" | "executive" | "custom"
export type Orientation = "portrait" | "landscape" | "auto"
export type MarginSize = "none" | "small" | "medium" | "large" | "custom"

export type FitMode = "contain" | "cover" | "stretch" | "actual"
export type Anchor = "top-left" | "top" | "top-right" | "left" | "center" | "right" | "bottom-left" | "bottom" | "bottom-right"
export type Rotation = 0 | 90 | 180 | 270
export type FillOrder = "across" | "down"
export type Unit = "mm" | "in"

/** Unchanged from the original. */
export interface ImageEntry {
	name: string
	bytes: Uint8Array
	/** MIME type reported by the browser */
	mimeType: string
}

/** The original three fields are required exactly as before; everything else is optional. */
export interface ImagesToPdfOptions {
	pageSize: PageSize
	orientation: Orientation
	margin: MarginSize
	/** Image pixels per inch of page. The idea the original was missing entirely. */
	dpi?: number
	fitMode?: FitMode
	allowUpscale?: boolean
	anchor?: Anchor
	rotate?: Rotation
	autoRotate?: boolean
	perPage?: number
	gridRows?: number
	gridCols?: number
	gridGapPt?: number
	fillOrder?: FillOrder
	captionFilenames?: boolean
	customWidth?: number
	customHeight?: number
	customUnit?: Unit
	customMargin?: number
	marginUnit?: Unit
	marginTop?: number
	marginRight?: number
	marginBottom?: number
	marginLeft?: number
	perEdgeMargins?: boolean
	background?: string
	keepTransparency?: boolean
	reencodeQuality?: number
	pageNumbers?: boolean
	pageNumberPosition?: "bottom-center" | "bottom-right" | "top-right"
	headerText?: string
	footerText?: string
	stampFilename?: boolean
	stampDate?: boolean
	watermarkText?: string
	watermarkOpacity?: number
	title?: string
	author?: string
	subject?: string
	keywords?: string
	stripMetadata?: boolean
	namePattern?: string
	splitEvery?: number
}

export const DEFAULT_OPTIONS: Required<Pick<ImagesToPdfOptions, "pageSize" | "orientation" | "margin">> & ImagesToPdfOptions = {
	pageSize: "a4",
	orientation: "portrait",
	margin: "medium",
	dpi: 96,
	fitMode: "contain",
	allowUpscale: false,
	anchor: "center",
	rotate: 0,
	autoRotate: false,
	perPage: 1,
	gridRows: 2,
	gridCols: 2,
	gridGapPt: 8,
	fillOrder: "across",
	captionFilenames: false,
	customWidth: 210,
	customHeight: 297,
	customUnit: "mm",
	customMargin: 10,
	marginUnit: "mm",
	marginTop: 10,
	marginRight: 10,
	marginBottom: 10,
	marginLeft: 10,
	perEdgeMargins: false,
	background: "#ffffff",
	keepTransparency: true,
	reencodeQuality: 0,
	pageNumbers: false,
	pageNumberPosition: "bottom-center",
	headerText: "",
	footerText: "",
	stampFilename: false,
	stampDate: false,
	watermarkText: "",
	watermarkOpacity: 0.12,
	title: "",
	author: "",
	subject: "",
	keywords: "",
	stripMetadata: true,
	namePattern: "images-{date}",
	splitEvery: 0,
}

export type ImageKind = "png" | "jpeg" | "webp" | "gif" | "bmp" | "avif" | "heic" | "tiff" | "unknown"

export type ItemStatus = "ready" | "too-big" | "not-an-image" | "unreadable" | "empty"

export const STATUS_LABEL: Record<ItemStatus, string> = {
	ready: "Ready",
	"too-big": "Too large",
	"not-an-image": "Not an image",
	unreadable: "Could not be read",
	empty: "Empty file",
}

export interface ImageItem extends ImageEntry {
	id: string
	kind: ImageKind
	pixelWidth: number
	pixelHeight: number
	size: number
	lastModified: number
	status: ItemStatus
	statusDetail: string
	/** Set only for formats that had to be converted before pdf-lib could take them. */
	convertedFrom?: ImageKind
	rotate: Rotation
}

export interface PageGeometry {
	widthPt: number
	heightPt: number
	drawWidthPt: number
	drawHeightPt: number
	xPt: number
	yPt: number
	/** Real pixels per inch this image will print at. */
	effectiveDpi: number
	cropped: boolean
	upscaled: boolean
	distorted: boolean
}

export interface BuildOne {
	id: string
	name: string
	page: number
	effectiveDpi: number
	note: string
}

export interface BuildResult {
	docs: Array<{ name: string; bytes: Uint8Array; pages: number }>
	items: BuildOne[]
	skipped: string[]
	pageCount: number
	totalImageBytes: number
	totalPdfBytes: number
	elapsedMs: number
	cancelled: boolean
	error: string
}

export const EMPTY_BUILD: BuildResult = {
	docs: [], items: [], skipped: [], pageCount: 0, totalImageBytes: 0, totalPdfBytes: 0, elapsedMs: 0, cancelled: false, error: "",
}

/* ------------------------------------------------------------------ *
 * 3. What is this file, really?
 *
 * The original trusted file.type, and fell back to "image/jpeg" when the browser
 * reported nothing. Anything that was not a PNG went to embedJpg and threw. This
 * reads the actual bytes instead.
 * ------------------------------------------------------------------ */

function ascii(bytes: Uint8Array, at: number, length: number): string {
	let out = ""
	for (let i = at; i < at + length && i < bytes.length; i += 1) out += String.fromCharCode(bytes[i] ?? 0)
	return out
}

export function detectKind(bytes: Uint8Array): ImageKind {
	if (bytes.length < 12) return "unknown"
	const b = bytes
	if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return "png"
	if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "jpeg"
	if (ascii(b, 0, 4) === "GIF8") return "gif"
	if (b[0] === 0x42 && b[1] === 0x4d) return "bmp"
	if (ascii(b, 0, 4) === "RIFF" && ascii(b, 8, 4) === "WEBP") return "webp"
	if (ascii(b, 4, 4) === "ftyp") {
		const brand = ascii(b, 8, 4).toLowerCase()
		if (brand === "avif" || brand === "avis") return "avif"
		if (brand.startsWith("hei") || brand === "mif1" || brand === "msf1" || brand.startsWith("hev")) return "heic"
	}
	if ((b[0] === 0x49 && b[1] === 0x49 && b[2] === 0x2a) || (b[0] === 0x4d && b[1] === 0x4d && b[3] === 0x2a)) return "tiff"
	return "unknown"
}

export const KIND_LABEL: Record<ImageKind, string> = {
	png: "PNG", jpeg: "JPEG", webp: "WebP", gif: "GIF", bmp: "BMP", avif: "AVIF", heic: "HEIC", tiff: "TIFF", unknown: "not a recognised image",
}

/** pdf-lib can embed only these two. Everything else has to be converted first. */
export function isDirectlyEmbeddable(kind: ImageKind): boolean {
	return kind === "png" || kind === "jpeg"
}

/* ------------------------------------------------------------------ *
 * 4. Reading and normalising an image
 * ------------------------------------------------------------------ */

function blobOf(bytes: Uint8Array, type: string): Blob {
	return new Blob([bytes.slice().buffer as ArrayBuffer], { type })
}

async function pixelSize(bytes: Uint8Array, mime: string): Promise<{ width: number; height: number }> {
	try {
		const bitmap = await createImageBitmap(blobOf(bytes, mime))
		const out = { width: bitmap.width, height: bitmap.height }
		bitmap.close()
		return out
	} catch {
		return { width: 0, height: 0 }
	}
}

function canvasToBytes(canvas: HTMLCanvasElement, type: string, quality?: number): Promise<Uint8Array> {
	return new Promise((resolve, reject) => {
		canvas.toBlob(
			(blob) => {
				if (!blob) { reject(new Error("the browser could not produce an image from the canvas")); return }
				void blob.arrayBuffer().then((buf) => resolve(new Uint8Array(buf))).catch(reject)
			},
			type,
			quality,
		)
	})
}

/**
 * Turn any supported image into bytes pdf-lib will accept.
 *
 * PNG and JPEG are passed through untouched, so nothing is re-encoded and no
 * quality is lost — unless a re-encode quality was explicitly asked for.
 */
export async function toEmbeddable(
	bytes: Uint8Array,
	kind: ImageKind,
	opts: { keepTransparency: boolean; background: string; reencodeQuality: number },
): Promise<{ bytes: Uint8Array; kind: "png" | "jpeg" }> {
	const wantsJpeg = opts.reencodeQuality > 0
	if (isDirectlyEmbeddable(kind) && !wantsJpeg) return { bytes, kind: kind === "png" ? "png" : "jpeg" }

	let source = bytes
	let sourceMime = kind === "unknown" ? "application/octet-stream" : `image/${kind === "jpeg" ? "jpeg" : kind}`

	if (kind === "heic") {
		// heic2any is already a dependency of this project and was never used here.
		const mod = (await import("heic2any")) as { default: (args: { blob: Blob; toType?: string; quality?: number }) => Promise<Blob | Blob[]> }
		const converted = await mod.default({ blob: blobOf(bytes, "image/heic"), toType: "image/png" })
		const first = Array.isArray(converted) ? converted[0] : converted
		if (!first) throw new Error("the HEIC converter returned nothing")
		source = new Uint8Array(await first.arrayBuffer())
		sourceMime = "image/png"
		if (!wantsJpeg) return { bytes: source, kind: "png" }
	}

	const bitmap = await createImageBitmap(blobOf(source, sourceMime))
	const canvas = document.createElement("canvas")
	canvas.width = bitmap.width
	canvas.height = bitmap.height
	const ctx = canvas.getContext("2d")
	if (!ctx) { bitmap.close(); throw new Error("this browser would not give the tool a drawing surface") }
	const opaque = wantsJpeg || !opts.keepTransparency
	if (opaque) {
		ctx.fillStyle = opts.background
		ctx.fillRect(0, 0, canvas.width, canvas.height)
	}
	ctx.drawImage(bitmap, 0, 0)
	bitmap.close()
	if (wantsJpeg) {
		const q = Math.min(1, Math.max(0.05, opts.reencodeQuality))
		return { bytes: await canvasToBytes(canvas, "image/jpeg", q), kind: "jpeg" }
	}
	return { bytes: await canvasToBytes(canvas, "image/png"), kind: "png" }
}

/**
 * Read a File into a fully formed item.
 *
 * The bug this replaces: the original created the item with new Uint8Array(0) and
 * filled the bytes in later from a .then callback that was registered BEFORE the
 * item was in state. If the read resolved first, prev.map matched nothing and the
 * bytes were lost forever — the image then showed a thumbnail but could never be
 * converted. Here the bytes are read first and the item is only created once they
 * exist, so no item can ever be in a broken state.
 */
export async function readImage(file: File, index: number): Promise<ImageItem> {
	const base: Omit<ImageItem, "kind" | "pixelWidth" | "pixelHeight" | "status" | "statusDetail"> = {
		id: `img-${Date.now().toString(36)}-${index}`,
		name: file.name,
		bytes: new Uint8Array(0),
		mimeType: file.type,
		size: file.size,
		lastModified: file.lastModified,
		rotate: 0,
	}
	if (file.size === 0) return { ...base, kind: "unknown", pixelWidth: 0, pixelHeight: 0, status: "empty", statusDetail: `"${file.name}" is an empty file, so there is nothing to put on a page.` }
	if (file.size > MAX_FILE_BYTES) return { ...base, kind: "unknown", pixelWidth: 0, pixelHeight: 0, status: "too-big", statusDetail: `"${file.name}" is ${formatBytes(file.size)}. The limit for one image is ${formatBytes(MAX_FILE_BYTES)}.` }

	let bytes: Uint8Array
	try {
		bytes = new Uint8Array(await file.arrayBuffer())
	} catch {
		return { ...base, kind: "unknown", pixelWidth: 0, pixelHeight: 0, status: "unreadable", statusDetail: `"${file.name}" could not be read from disk. If it is on a removable drive or a network share, copy it locally and try again.` }
	}

	const kind = detectKind(bytes)
	if (kind === "unknown") {
		const looksLikePdf = ascii(bytes, 0, 4) === "%PDF"
		const looksLikeZip = bytes[0] === 0x50 && bytes[1] === 0x4b
		const guess = looksLikePdf ? " It looks like a PDF — you may want the Merge PDF tool instead." : looksLikeZip ? " It looks like a zip or office document, not an image." : ""
		return { ...base, bytes, kind, pixelWidth: 0, pixelHeight: 0, status: "not-an-image", statusDetail: `"${file.name}" is not an image the tool recognises, whatever its file extension says.${guess}` }
	}

	const mime = `image/${kind === "jpeg" ? "jpeg" : kind}`
	const { width, height } = await pixelSize(bytes, mime)
	if (width === 0 || height === 0) {
		// HEIC often cannot be decoded by createImageBitmap directly; it is still usable.
		if (kind === "heic" || kind === "tiff") return { ...base, bytes, kind, pixelWidth: 0, pixelHeight: 0, status: "ready", statusDetail: `This browser cannot preview ${KIND_LABEL[kind]}, so the size is only known once it is converted. It will still be added.` }
		return { ...base, bytes, kind, pixelWidth: 0, pixelHeight: 0, status: "unreadable", statusDetail: `"${file.name}" says it is a ${KIND_LABEL[kind]} but could not be decoded. It may be truncated.` }
	}
	return { ...base, bytes, kind, pixelWidth: width, pixelHeight: height, status: "ready", statusDetail: "" }
}

/* ------------------------------------------------------------------ *
 * 5. Geometry — where the original went wrong
 * ------------------------------------------------------------------ */

const MARGIN_PT: Record<Exclude<MarginSize, "custom">, number> = { none: 0, small: 20, medium: 40, large: 72 }

const BASE_SIZES: Record<Exclude<PageSize, "fit" | "custom">, [number, number]> = {
	a4: PageSizes.A4,
	letter: PageSizes.Letter,
	a3: PageSizes.A3,
	a5: PageSizes.A5,
	legal: PageSizes.Legal,
	tabloid: PageSizes.Tabloid,
	executive: PageSizes.Executive,
}

export const PAGE_SIZE_LABEL: Record<PageSize, string> = {
	a4: "A4", letter: "Letter", fit: "Fit to image", a3: "A3", a5: "A5", legal: "Legal", tabloid: "Tabloid", executive: "Executive", custom: "Custom",
}

export function toPoints(value: number, unit: Unit): number {
	return unit === "mm" ? (value / MM_PER_INCH) * PT_PER_INCH : value * PT_PER_INCH
}

export function pointsToInches(pt: number): number { return pt / PT_PER_INCH }
export function pointsToMm(pt: number): number { return (pt / PT_PER_INCH) * MM_PER_INCH }

export function describePageSize(widthPt: number, heightPt: number): string {
	return `${pointsToMm(widthPt).toFixed(0)} × ${pointsToMm(heightPt).toFixed(0)} mm (${pointsToInches(widthPt).toFixed(1)} × ${pointsToInches(heightPt).toFixed(1)} in)`
}

export function marginsOf(o: ImagesToPdfOptions): { top: number; right: number; bottom: number; left: number } {
	if (o.margin === "custom") {
		const unit = o.marginUnit ?? "mm"
		if (o.perEdgeMargins) {
			return {
				top: toPoints(o.marginTop ?? 0, unit), right: toPoints(o.marginRight ?? 0, unit),
				bottom: toPoints(o.marginBottom ?? 0, unit), left: toPoints(o.marginLeft ?? 0, unit),
			}
		}
		const all = toPoints(o.customMargin ?? 0, unit)
		return { top: all, right: all, bottom: all, left: all }
	}
	const all = MARGIN_PT[o.margin]
	return { top: all, right: all, bottom: all, left: all }
}

/** True when the image, after any rotation, is wider than it is tall. */
function isWide(item: { pixelWidth: number; pixelHeight: number; rotate: Rotation }, extra: Rotation): boolean {
	const turned = ((item.rotate + extra) % 180) !== 0
	const w = turned ? item.pixelHeight : item.pixelWidth
	const h = turned ? item.pixelWidth : item.pixelHeight
	return w > h
}

/**
 * Work out the page and the placement for one image.
 *
 * The whole point: pixels are divided by dpi and multiplied by 72 to get points.
 * The original used pixel counts as points directly, so a 3000x2000 photo in
 * "fit" mode produced a page 3000 x 2000 points, which is 41.7 by 27.8 inches.
 */
export function layoutOne(item: ImageItem, o: ImagesToPdfOptions): PageGeometry {
	const dpi = Math.max(1, o.dpi ?? 96)
	const extra = o.rotate ?? 0
	const turned = ((item.rotate + extra) % 180) !== 0
	const pxW = turned ? item.pixelHeight : item.pixelWidth
	const pxH = turned ? item.pixelWidth : item.pixelHeight
	// Natural size on paper, in points, at the chosen resolution.
	const natW = (pxW / dpi) * PT_PER_INCH
	const natH = (pxH / dpi) * PT_PER_INCH
	const m = marginsOf(o)

	let widthPt: number
	let heightPt: number
	if (o.pageSize === "fit") {
		widthPt = natW + m.left + m.right
		heightPt = natH + m.top + m.bottom
	} else if (o.pageSize === "custom") {
		const unit = o.customUnit ?? "mm"
		widthPt = toPoints(o.customWidth ?? 210, unit)
		heightPt = toPoints(o.customHeight ?? 297, unit)
	} else {
		const base = BASE_SIZES[o.pageSize]
		const short = Math.min(base[0], base[1])
		const long = Math.max(base[0], base[1])
		const landscape = o.orientation === "landscape" || (o.orientation === "auto" && isWide(item, extra))
		widthPt = landscape ? long : short
		heightPt = landscape ? short : long
	}

	const availW = Math.max(1, widthPt - m.left - m.right)
	const availH = Math.max(1, heightPt - m.top - m.bottom)
	const mode = o.fitMode ?? "contain"
	const upscale = o.allowUpscale ?? false

	let drawW: number
	let drawH: number
	let cropped = false
	let distorted = false
	if (mode === "stretch") {
		drawW = availW
		drawH = availH
		distorted = Math.abs(availW / availH - natW / Math.max(1, natH)) > 0.01
	} else if (mode === "actual") {
		drawW = natW
		drawH = natH
		cropped = natW > availW + 0.5 || natH > availH + 0.5
	} else {
		const raw = mode === "cover" ? Math.max(availW / natW, availH / natH) : Math.min(availW / natW, availH / natH)
		// The original capped the scale at 1. That is kept as the default, but it is
		// now a choice rather than a silent rule.
		const scale = upscale ? raw : Math.min(raw, 1)
		drawW = natW * scale
		drawH = natH * scale
		cropped = mode === "cover" && (drawW > availW + 0.5 || drawH > availH + 0.5)
	}

	const anchor = o.anchor ?? "center"
	const hx = anchor.includes("left") ? 0 : anchor.includes("right") ? 1 : 0.5
	const vy = anchor.startsWith("top") ? 1 : anchor.startsWith("bottom") ? 0 : 0.5
	const xPt = m.left + (availW - drawW) * hx
	const yPt = m.bottom + (availH - drawH) * vy

	const inchesWide = drawW / PT_PER_INCH
	const effectiveDpi = inchesWide > 0 ? pxW / inchesWide : 0
	return {
		widthPt, heightPt, drawWidthPt: drawW, drawHeightPt: drawH, xPt, yPt,
		effectiveDpi: Math.round(effectiveDpi), cropped, distorted,
		upscaled: drawW > natW + 0.5,
	}
}

/* ------------------------------------------------------------------ *
 * 6. Warnings and the forecast, written as sentences
 * ------------------------------------------------------------------ */

export function planWarnings(items: ImageItem[], o: ImagesToPdfOptions): { errors: string[]; warnings: string[] } {
	const errors: string[] = []
	const warnings: string[] = []
	const ready = items.filter((i) => i.status === "ready")
	if (items.length === 0) errors.push("Add at least one image.")
	else if (ready.length === 0) errors.push("None of the files added can be used. Each one has a reason next to it.")
	if (items.length > MAX_FILES) errors.push(`There are ${items.length} images here and the limit is ${MAX_FILES}. Remove some, or convert them in two batches.`)

	const total = ready.reduce((n, i) => n + i.size, 0)
	if (total > MAX_TOTAL_BYTES) errors.push(`These images come to ${formatBytes(total)} and the limit for one run is ${formatBytes(MAX_TOTAL_BYTES)}.`)
	else if (total > WARN_TOTAL_BYTES) warnings.push(`That is ${formatBytes(total)} of images. It will work, but expect it to take a little while and to use a lot of memory.`)

	if (o.pageSize === "custom") {
		const unit = o.customUnit ?? "mm"
		if ((o.customWidth ?? 0) <= 0 || (o.customHeight ?? 0) <= 0) errors.push("A custom page needs a width and a height greater than zero.")
		else {
			const w = toPoints(o.customWidth ?? 0, unit)
			const h = toPoints(o.customHeight ?? 0, unit)
			const m = marginsOf(o)
			if (m.left + m.right >= w || m.top + m.bottom >= h) errors.push("The margins are larger than the page, so there would be no room left for the image.")
		}
	}

	const skipped = items.filter((i) => i.status !== "ready")
	if (skipped.length > 0) warnings.push(`${skipped.length} file${skipped.length === 1 ? "" : "s"} will be skipped. The rest will still be converted.`)

	const converted = ready.filter((i) => !isDirectlyEmbeddable(i.kind))
	if (converted.length > 0) warnings.push(`${converted.length} image${converted.length === 1 ? "" : "s"} will be converted to PNG first, because a PDF can only hold JPEG and PNG. Nothing visible changes.`)

	if (ready.length > 0 && o.pageSize === "fit") {
		const worst = ready.reduce((acc, i) => {
			const g = layoutOne(i, o)
			return Math.max(acc, pointsToInches(Math.max(g.widthPt, g.heightPt)))
		}, 0)
		if (worst > ABSURD_PAGE_INCHES) warnings.push(`At ${o.dpi ?? 96} DPI the largest page would be about ${worst.toFixed(0)} inches across, which is almost certainly not what you want. Raise the DPI — 300 is normal for a photo.`)
	}

	const low = ready.filter((i) => { const g = layoutOne(i, o); return g.effectiveDpi > 0 && g.effectiveDpi < LOW_DPI })
	if (low.length > 0) warnings.push(`${low.length} image${low.length === 1 ? " will" : "s will"} print at under ${LOW_DPI} DPI, so ${low.length === 1 ? "it" : "they"} may look soft on paper. On screen ${low.length === 1 ? "it" : "they"} will look fine.`)

	const upscaled = ready.filter((i) => layoutOne(i, o).upscaled)
	if (upscaled.length > 0) warnings.push(`${upscaled.length} image${upscaled.length === 1 ? "" : "s"} will be enlarged to fill the page. Enlarging cannot add detail that is not there, so expect some softness.`)

	const cropped = ready.filter((i) => layoutOne(i, o).cropped)
	if (cropped.length > 0) warnings.push(`${cropped.length} image${cropped.length === 1 ? "" : "s"} will have part of the edges cut off, because you asked for the page to be filled.`)

	if ((o.fitMode ?? "contain") === "stretch") warnings.push("Stretch fills the page by distorting the image. Circles will come out as ovals.")
	if ((o.reencodeQuality ?? 0) > 0) warnings.push(`Every image will be re-encoded as JPEG at quality ${Math.round((o.reencodeQuality ?? 0) * 100)}%. That makes the PDF smaller and loses some detail permanently — your original files are untouched.`)
	if ((o.perPage ?? 1) > 1 && o.pageSize === "fit") warnings.push("\u201cFit to image\u201d cannot be combined with several images on a page, because each image would want a different page. A4 will be used instead.")

	const names = new Map<string, number>()
	for (const i of ready) names.set(i.name, (names.get(i.name) ?? 0) + 1)
	const dupes = [...names.entries()].filter(([, n]) => n > 1).map(([n]) => n)
	if (dupes.length > 0) warnings.push(`Added twice: ${dupes.slice(0, 3).join(", ")}${dupes.length > 3 ? " and others" : ""}. Each copy becomes its own page, which may be what you want.`)

	return { errors, warnings }
}

export function pageCountFor(items: ImageItem[], o: ImagesToPdfOptions): number {
	const ready = items.filter((i) => i.status === "ready").length
	const per = perPageCount(o)
	return per <= 1 ? ready : Math.ceil(ready / per)
}

export function perPageCount(o: ImagesToPdfOptions): number {
	if (o.pageSize === "fit") return 1
	const per = o.perPage ?? 1
	if (per > 1) return per
	return 1
}

/* ------------------------------------------------------------------ *
 * 7. Building the document
 * ------------------------------------------------------------------ */

function hexToRgb(hex: string): { r: number; g: number; b: number } {
	const clean = hex.replace("#", "").trim()
	const full = clean.length === 3 ? clean.split("").map((c) => c + c).join("") : clean
	const n = Number.parseInt(full.slice(0, 6), 16)
	if (Number.isNaN(n)) return { r: 1, g: 1, b: 1 }
	return { r: ((n >> 16) & 255) / 255, g: ((n >> 8) & 255) / 255, b: (n & 255) / 255 }
}

function gridCells(o: ImagesToPdfOptions, widthPt: number, heightPt: number): Array<{ x: number; y: number; w: number; h: number }> {
	const m = marginsOf(o)
	const per = perPageCount(o)
	let cols = o.gridCols ?? 2
	let rows = o.gridRows ?? 2
	if (per === 2) { cols = 1; rows = 2 }
	else if (per === 4) { cols = 2; rows = 2 }
	else if (per === 6) { cols = 2; rows = 3 }
	else if (per === 9) { cols = 3; rows = 3 }
	const gap = o.gridGapPt ?? 8
	const availW = widthPt - m.left - m.right
	const availH = heightPt - m.top - m.bottom
	const cellW = (availW - gap * (cols - 1)) / cols
	const cellH = (availH - gap * (rows - 1)) / rows
	const cells: Array<{ x: number; y: number; w: number; h: number }> = []
	const order: Array<[number, number]> = []
	if ((o.fillOrder ?? "across") === "across") {
		for (let r = 0; r < rows; r += 1) for (let c = 0; c < cols; c += 1) order.push([r, c])
	} else {
		for (let c = 0; c < cols; c += 1) for (let r = 0; r < rows; r += 1) order.push([r, c])
	}
	for (const [r, c] of order) {
		cells.push({ x: m.left + c * (cellW + gap), y: heightPt - m.top - (r + 1) * cellH - r * gap, w: cellW, h: cellH })
	}
	return cells
}

export function stamp(): string { return new Date().toISOString().slice(0, 10) }

export function safeFileName(name: string): string {
	const cleaned = name.replace(/[\\/:*?"<>|]/gu, "-").replace(/\s+/gu, " ").trim()
	return (cleaned.length === 0 ? "images" : cleaned).slice(0, 120)
}

export function outputName(o: ImagesToPdfOptions, count: number, index?: number): string {
	const pattern = (o.namePattern ?? "images-{date}").trim() || "images-{date}"
	const base = safeFileName(pattern.replace(/\{date\}/gu, stamp()).replace(/\{count\}/gu, String(count)).replace(/\{name\}/gu, "images"))
	return index === undefined ? `${base}.pdf` : `${base}-${String(index).padStart(2, "0")}.pdf`
}

async function drawFurniture(
	doc: PDFDocument,
	page: ReturnType<PDFDocument["addPage"]>,
	o: ImagesToPdfOptions,
	info: { pageNumber: number; total: number; fileName: string },
): Promise<void> {
	const { width, height } = page.getSize()
	const font = await doc.embedFont("Helvetica")
	const grey = rgb(0.4, 0.4, 0.4)
	const size = 9
	const pad = 14
	if (o.headerText && o.headerText.length > 0) page.drawText(o.headerText.slice(0, 200), { x: pad, y: height - pad - size, size, font, color: grey })
	const footerBits: string[] = []
	if (o.footerText && o.footerText.length > 0) footerBits.push(o.footerText.slice(0, 200))
	if (o.stampFilename) footerBits.push(info.fileName)
	if (o.stampDate) footerBits.push(stamp())
	if (footerBits.length > 0) page.drawText(footerBits.join("  —  ").slice(0, 240), { x: pad, y: pad, size, font, color: grey })
	if (o.pageNumbers) {
		const text = `${info.pageNumber} / ${info.total}`
		const textWidth = font.widthOfTextAtSize(text, size)
		const pos = o.pageNumberPosition ?? "bottom-center"
		const x = pos === "bottom-center" ? (width - textWidth) / 2 : width - pad - textWidth
		const y = pos === "top-right" ? height - pad - size : pad
		page.drawText(text, { x, y, size, font, color: grey })
	}
	if (o.watermarkText && o.watermarkText.length > 0) {
		const wmSize = Math.max(24, Math.min(width, height) / 8)
		const text = o.watermarkText.slice(0, 60)
		const textWidth = font.widthOfTextAtSize(text, wmSize)
		page.drawText(text, {
			x: (width - textWidth * 0.7) / 2, y: height / 2 - wmSize / 2, size: wmSize, font,
			color: rgb(0.5, 0.5, 0.5), opacity: Math.min(1, Math.max(0.02, o.watermarkOpacity ?? 0.12)), rotate: degrees(35),
		})
	}
}

async function embedInto(doc: PDFDocument, item: ImageItem, o: ImagesToPdfOptions) {
	const prepared = await toEmbeddable(item.bytes, item.kind, {
		keepTransparency: o.keepTransparency ?? true,
		background: o.background ?? "#ffffff",
		reencodeQuality: o.reencodeQuality ?? 0,
	})
	return prepared.kind === "png" ? doc.embedPng(prepared.bytes) : doc.embedJpg(prepared.bytes)
}

/**
 * The full build, with progress, cancellation and per-image isolation.
 *
 * Unlike the original, one image that cannot be embedded is named and skipped;
 * every other image still becomes a page.
 */
export async function buildPdfs(
	items: ImageItem[],
	options: ImagesToPdfOptions,
	onProgress?: (done: number, total: number, name: string) => void,
	isCancelled?: () => boolean,
): Promise<BuildResult> {
	const started = Date.now()
	const o = { ...DEFAULT_OPTIONS, ...options }
	const ready = items.filter((i) => i.status === "ready")
	const skipped = items.filter((i) => i.status !== "ready").map((i) => i.statusDetail || `"${i.name}" was skipped.`)
	if (ready.length === 0) return { ...EMPTY_BUILD, skipped, elapsedMs: Date.now() - started, error: "There are no usable images, so no PDF was made. Each file has its reason next to it." }

	const per = perPageCount(o)
	const groupSize = o.splitEvery && o.splitEvery > 0 ? o.splitEvery * per : ready.length
	const groups: ImageItem[][] = []
	for (let i = 0; i < ready.length; i += groupSize) groups.push(ready.slice(i, i + groupSize))

	const docs: BuildResult["docs"] = []
	const built: BuildOne[] = []
	let done = 0
	let cancelled = false
	let pageTotal = 0

	for (let g = 0; g < groups.length && !cancelled; g += 1) {
		const group = groups[g] ?? []
		let doc: PDFDocument
		try {
			doc = await PDFDocument.create()
		} catch {
			return { ...EMPTY_BUILD, skipped, elapsedMs: Date.now() - started, error: "A new PDF could not be created in this browser. Reload the page and try again." }
		}
		if (o.stripMetadata) {
			doc.setTitle(o.title ?? ""); doc.setAuthor(o.author ?? ""); doc.setSubject(o.subject ?? "")
			doc.setKeywords((o.keywords ?? "").split(",").map((k) => k.trim()).filter((k) => k.length > 0))
			doc.setProducer(""); doc.setCreator("")
		}
		const pagesInGroup = per <= 1 ? group.length : Math.ceil(group.length / per)

		if (per <= 1) {
			for (const item of group) {
				if (isCancelled?.()) { cancelled = true; break }
				onProgress?.(done, ready.length, item.name)
				try {
					const embedded = await embedInto(doc, item, o)
					// Sizes come from the embedded image, so HEIC and TIFF get real numbers here
					// even when the browser could not preview them earlier.
					const measured: ImageItem = item.pixelWidth > 0 ? item : { ...item, pixelWidth: embedded.width, pixelHeight: embedded.height }
					const geo = layoutOne(measured, o)
					const page = doc.addPage([geo.widthPt, geo.heightPt])
					if (!(o.keepTransparency ?? true) || (o.background ?? "#ffffff").toLowerCase() !== "#ffffff") {
						const c = hexToRgb(o.background ?? "#ffffff")
						page.drawRectangle({ x: 0, y: 0, width: geo.widthPt, height: geo.heightPt, color: rgb(c.r, c.g, c.b) })
					}
					page.drawImage(embedded, {
						x: geo.xPt, y: geo.yPt, width: geo.drawWidthPt, height: geo.drawHeightPt,
						rotate: degrees(((item.rotate + (o.rotate ?? 0)) % 360)),
					})
					pageTotal += 1
					await drawFurniture(doc, page, o, { pageNumber: pageTotal, total: 0, fileName: item.name })
					const notes: string[] = []
					if (geo.effectiveDpi > 0 && geo.effectiveDpi < LOW_DPI) notes.push(`prints at about ${geo.effectiveDpi} DPI, so it may look soft`)
					if (geo.cropped) notes.push("edges cropped to fill the page")
					if (geo.upscaled) notes.push("enlarged")
					if (geo.distorted) notes.push("stretched out of proportion")
					if (!isDirectlyEmbeddable(item.kind)) notes.push(`converted from ${KIND_LABEL[item.kind]}`)
					built.push({ id: item.id, name: item.name, page: pageTotal, effectiveDpi: geo.effectiveDpi, note: notes.join("; ") || "placed as it is" })
				} catch (err) {
					const why = err instanceof Error && err.message.length > 0 ? err.message : "the image could not be embedded"
					skipped.push(`"${item.name}" was skipped: ${why}. Every other image was still converted.`)
				}
				done += 1
				await new Promise((r) => setTimeout(r, 0))
			}
		} else {
			const probe = group[0]
			const pageOpts: ImagesToPdfOptions = { ...o, pageSize: o.pageSize === "fit" ? "a4" : o.pageSize }
			const pageGeo = probe ? layoutOne(probe, pageOpts) : { widthPt: PageSizes.A4[0], heightPt: PageSizes.A4[1] }
			const cells = gridCells(pageOpts, pageGeo.widthPt, pageGeo.heightPt)
			for (let start = 0; start < group.length && !cancelled; start += per) {
				const slice = group.slice(start, start + per)
				const page = doc.addPage([pageGeo.widthPt, pageGeo.heightPt])
				pageTotal += 1
				for (let n = 0; n < slice.length; n += 1) {
					if (isCancelled?.()) { cancelled = true; break }
					const item = slice[n]
					const cell = cells[n]
					if (!item || !cell) continue
					onProgress?.(done, ready.length, item.name)
					try {
						const embedded = await embedInto(doc, item, o)
						const captionRoom = o.captionFilenames ? 12 : 0
						const boxH = Math.max(1, cell.h - captionRoom)
						const raw = Math.min(cell.w / embedded.width, boxH / embedded.height)
						const scale = (o.allowUpscale ?? false) ? raw : Math.min(raw, 1)
						const w = embedded.width * scale
						const h = embedded.height * scale
						page.drawImage(embedded, { x: cell.x + (cell.w - w) / 2, y: cell.y + captionRoom + (boxH - h) / 2, width: w, height: h })
						if (o.captionFilenames) {
							const font = await doc.embedFont("Helvetica")
							page.drawText(item.name.slice(0, 40), { x: cell.x, y: cell.y + 2, size: 7, font, color: rgb(0.4, 0.4, 0.4) })
						}
						const inches = w / PT_PER_INCH
						built.push({ id: item.id, name: item.name, page: pageTotal, effectiveDpi: inches > 0 ? Math.round(embedded.width / inches) : 0, note: `cell ${n + 1} of ${per}` })
					} catch (err) {
						const why = err instanceof Error && err.message.length > 0 ? err.message : "the image could not be embedded"
						skipped.push(`"${item.name}" was skipped: ${why}.`)
					}
					done += 1
				}
				await drawFurniture(doc, page, o, { pageNumber: pageTotal, total: 0, fileName: "" })
				await new Promise((r) => setTimeout(r, 0))
			}
		}

		if (doc.getPageCount() === 0) continue
		try {
			const bytes = await doc.save({ useObjectStreams: true })
			docs.push({ name: groups.length > 1 ? outputName(o, ready.length, g + 1) : outputName(o, ready.length), bytes, pages: pagesInGroup })
		} catch {
			skipped.push("One of the PDFs could not be saved, most likely because the images together were too large for this tab's memory. Try fewer images, or split the run.")
		}
	}

	const totalPdfBytes = docs.reduce((n, d) => n + d.bytes.length, 0)
	return {
		docs, items: built, skipped, pageCount: pageTotal,
		totalImageBytes: ready.reduce((n, i) => n + i.size, 0),
		totalPdfBytes, elapsedMs: Date.now() - started, cancelled,
		error: docs.length === 0 ? "No pages could be produced. Every image failed, and the reasons are listed above." : "",
	}
}

/* ------------------------------------------------------------------ *
 * 8. The original entry point, preserved exactly
 *
 * Same name, same arguments, same ToolResult<Uint8Array> return, so
 * logic.test.ts keeps passing. It now benefits from the DPI-correct geometry and
 * the wider format support, and it still returns a single Uint8Array.
 * ------------------------------------------------------------------ */

export async function imagesToPdf(images: ImageEntry[], options: ImagesToPdfOptions): Promise<ToolResult<Uint8Array>> {
	if (images.length === 0) return { ok: false, error: "Add at least one image." }
	try {
		const items: ImageItem[] = []
		for (let i = 0; i < images.length; i += 1) {
			const entry = images[i]
			if (!entry) continue
			if (entry.bytes.length === 0) return { ok: false, error: `"${entry.name}" has no data. Remove it and add it again.` }
			const kind = detectKind(entry.bytes)
			if (kind === "unknown") return { ok: false, error: `Could not embed "${entry.name}" — it is not an image the tool recognises, whatever its file extension says.` }
			const mime = `image/${kind === "jpeg" ? "jpeg" : kind}`
			const { width, height } = await pixelSize(entry.bytes, mime)
			items.push({
				...entry, id: `entry-${i}`, kind, pixelWidth: width, pixelHeight: height,
				size: entry.bytes.length, lastModified: 0, status: "ready", statusDetail: "", rotate: 0,
			})
		}
		const built = await buildPdfs(items, { ...options, splitEvery: 0 })
		const first = built.docs[0]
		if (!first) return { ok: false, error: built.error || built.skipped[0] || "Something went wrong during conversion." }
		return { ok: true, output: first.bytes }
	} catch (err) {
		// The original discarded the error and said "please try again", which could
		// never work for the same input. Say what actually happened.
		const why = err instanceof Error && err.message.length > 0 ? err.message : "an unexpected problem"
		return { ok: false, error: `The conversion stopped because of ${why}.` }
	}
}

/* ------------------------------------------------------------------ *
 * 9. Getting the result out
 * ------------------------------------------------------------------ */

export function formatBytes(bytes: number): string {
	if (!Number.isFinite(bytes) || bytes < 0) return "0 B"
	if (bytes < 1024) return `${bytes} B`
	const units = ["KB", "MB", "GB"]
	let value = bytes / 1024
	let unit = 0
	while (value >= 1024 && unit < units.length - 1) { value /= 1024; unit += 1 }
	return `${value.toFixed(value < 10 ? 1 : 0)} ${units[unit]}`
}

export function formatDuration(ms: number): string {
	if (ms < 1000) return `${Math.round(ms)} ms`
	if (ms < 60000) return `${(ms / 1000).toFixed(1)} s`
	return `${Math.floor(ms / 60000)} min ${Math.round((ms % 60000) / 1000)} s`
}

export function downloadFile(data: Uint8Array | string, filename: string, mime: string): void {
	const blob = typeof data === "string" ? new Blob([data], { type: mime }) : new Blob([data.slice().buffer as ArrayBuffer], { type: mime })
	const url = URL.createObjectURL(blob)
	const a = document.createElement("a")
	a.href = url
	a.download = filename
	document.body.appendChild(a)
	a.click()
	a.remove()
	setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export async function copyToClipboard(text: string): Promise<boolean> {
	try { await navigator.clipboard.writeText(text); return true } catch { return false }
}

export async function zipDocs(docs: BuildResult["docs"]): Promise<Blob> {
	const zip = new JSZip()
	for (const d of docs) zip.file(d.name, d.bytes)
	return zip.generateAsync({ type: "blob", compression: "DEFLATE", compressionOptions: { level: 6 } })
}

function csvCell(value: string | number): string {
	const text = String(value)
	const guarded = /^[=+\-@\t\r]/u.test(text) ? `'${text}` : text
	return /[",\n\r]/u.test(guarded) ? `"${guarded.replace(/"/gu, '""')}"` : guarded
}

export function resultsToCsv(result: BuildResult): string {
	const rows = [["file", "page", "effective dpi", "note"].join(",")]
	for (const i of result.items) rows.push([csvCell(i.name), csvCell(i.page), csvCell(i.effectiveDpi), csvCell(i.note)].join(","))
	return rows.join("\r\n")
}

export function buildReceipt(o: ImagesToPdfOptions, result: BuildResult): string {
	const lines: string[] = []
	lines.push("Images to PDF — what was done")
	lines.push(`Date: ${new Date().toISOString()}`)
	lines.push("")
	lines.push(`Images used: ${result.items.length}`)
	lines.push(`Pages produced: ${result.pageCount}`)
	lines.push(`PDFs produced: ${result.docs.length}`)
	lines.push(`Images in: ${formatBytes(result.totalImageBytes)}`)
	lines.push(`PDF out: ${formatBytes(result.totalPdfBytes)}`)
	lines.push(`Took: ${formatDuration(result.elapsedMs)}`)
	lines.push("")
	lines.push("Settings")
	lines.push(`- Page: ${PAGE_SIZE_LABEL[o.pageSize]}, ${o.orientation}`)
	lines.push(`- Margin: ${o.margin}`)
	lines.push(`- Resolution: ${o.dpi ?? 96} DPI`)
	lines.push(`- Placement: ${o.fitMode ?? "contain"}, anchored ${o.anchor ?? "center"}`)
	lines.push(`- Enlarge small images: ${(o.allowUpscale ?? false) ? "yes" : "no"}`)
	lines.push(`- Images per page: ${perPageCount(o)}`)
	lines.push(`- Re-encode: ${(o.reencodeQuality ?? 0) > 0 ? `JPEG at ${Math.round((o.reencodeQuality ?? 0) * 100)}%` : "no, images passed through untouched"}`)
	lines.push("")
	lines.push("Pages")
	for (const i of result.items) lines.push(`- p${i.page}: ${i.name} — ${i.effectiveDpi} DPI — ${i.note}`)
	if (result.skipped.length > 0) {
		lines.push("")
		lines.push("Skipped")
		for (const s of result.skipped) lines.push(`- ${s}`)
	}
	lines.push("")
	lines.push("Everything above happened in your browser. No image was uploaded.")
	return lines.join("\n")
}

export function buildJsonSummary(o: ImagesToPdfOptions, result: BuildResult): string {
	return JSON.stringify({
		tool: "images-to-pdf",
		generatedAt: new Date().toISOString(),
		settings: { ...o },
		totals: {
			images: result.items.length, pages: result.pageCount, documents: result.docs.length,
			imageBytes: result.totalImageBytes, pdfBytes: result.totalPdfBytes, elapsedMs: result.elapsedMs,
		},
		pages: result.items,
		skipped: result.skipped,
		limitations: [
			"The images become pictures on a page. There is no OCR, so the text in a scan is not searchable.",
			"The finished PDF cannot be password-protected, because pdf-lib cannot write encryption.",
			"PDF/A archival conformance is not claimed, because it cannot be verified here.",
		],
	}, null, 2)
}

/* ------------------------------------------------------------------ *
 * 10. Remembering settings — never images
 * ------------------------------------------------------------------ */

const PREFIX = "unqtools:images-to-pdf"

function readJson<T>(key: string, fallback: T): T {
	try {
		const raw = window.localStorage.getItem(`${PREFIX}:${key}`)
		return raw === null ? fallback : (JSON.parse(raw) as T)
	} catch { return fallback }
}

function writeJson(key: string, value: unknown): void {
	try { window.localStorage.setItem(`${PREFIX}:${key}`, JSON.stringify(value)) } catch { /* private mode, or full */ }
}

export function clearAllStorage(): void {
	try {
		const doomed: string[] = []
		for (let i = 0; i < window.localStorage.length; i += 1) {
			const key = window.localStorage.key(i)
			if (key !== null && key.startsWith(PREFIX)) doomed.push(key)
		}
		for (const key of doomed) window.localStorage.removeItem(key)
	} catch { /* nothing we can do, and nothing was stored */ }
}

export function usePersisted<T>(key: string, initial: T): [T, (value: T) => void] {
	const [value, setValue] = useState<T>(initial)
	useEffect(() => { setValue(readJson<T>(key, initial)) }, [key]) // eslint-disable-line react-hooks/exhaustive-deps
	const update = useCallback((next: T) => { setValue(next); writeJson(key, next) }, [key])
	return [value, update]
}

export interface HistoryEntry {
	id: string
	at: number
	summary: string
	options: ImagesToPdfOptions
	pinned: boolean
}

export function useHistory(): {
	entries: HistoryEntry[]
	add: (options: ImagesToPdfOptions, summary: string) => void
	remove: (id: string) => void
	togglePin: (id: string) => void
	clearAll: () => void
} {
	const [entries, setEntries] = useState<HistoryEntry[]>([])
	useEffect(() => { setEntries(readJson<HistoryEntry[]>("history", [])) }, [])
	const save = useCallback((next: HistoryEntry[]) => { setEntries(next); writeJson("history", next) }, [])
	const add = useCallback((options: ImagesToPdfOptions, summary: string) => {
		const entry: HistoryEntry = { id: `${Date.now()}`, at: Date.now(), summary, options, pinned: false }
		save([entry, ...entries].sort((a, b) => Number(b.pinned) - Number(a.pinned)).slice(0, MAX_HISTORY))
	}, [entries, save])
	const remove = useCallback((id: string) => { save(entries.filter((e) => e.id !== id)) }, [entries, save])
	const togglePin = useCallback((id: string) => { save(entries.map((e) => (e.id === id ? { ...e, pinned: !e.pinned } : e))) }, [entries, save])
	const clearAll = useCallback(() => { save([]) }, [save])
	return { entries, add, remove, togglePin, clearAll }
}

/* ------------------------------------------------------------------ *
 * 11. Written content
 * ------------------------------------------------------------------ */

export const PRESETS: Array<{ id: string; label: string; description: string; values: Partial<ImagesToPdfOptions> }> = [
	{ id: "a4-photos", label: "A4 photo album", description: "A4 pages, sensible margins, photos at 300 DPI.", values: { pageSize: "a4", orientation: "auto", margin: "medium", dpi: 300, fitMode: "contain", perPage: 1 } },
	{ id: "scans", label: "Scanned documents", description: "A4, no margin, filling the page — the usual choice for scans.", values: { pageSize: "a4", orientation: "portrait", margin: "none", dpi: 300, fitMode: "contain", allowUpscale: true } },
	{ id: "actual", label: "True to size", description: "Each page exactly as large as the image at 300 DPI.", values: { pageSize: "fit", margin: "none", dpi: 300, fitMode: "contain" } },
	{ id: "contact", label: "Contact sheet", description: "Nine images a page with filenames underneath.", values: { pageSize: "a4", orientation: "portrait", margin: "small", perPage: 9, captionFilenames: true } },
	{ id: "small", label: "Small file", description: "Re-encoded as JPEG at 70% to keep the PDF light.", values: { pageSize: "a4", margin: "small", dpi: 150, reencodeQuality: 0.7 } },
]

export const HOW_TO: Array<{ name: string; text: string }> = [
	{ name: "Add your images", text: "Drop them in, pick them, or paste one from the clipboard. JPEG, PNG, WebP, GIF, BMP, AVIF and HEIC all work." },
	{ name: "Put them in order", text: "Drag to reorder, use the arrows, or sort by name, date or size. The page number each image will become is shown next to it." },
	{ name: "Choose the page and the resolution", text: "Pick a page size and a DPI. The DPI is what decides how large the image comes out on paper — 300 is normal for a photo or a scan." },
	{ name: "Convert and download", text: "You get the page count, the real file size and the effective DPI of every image before you save it." },
]

export const FAQ: Array<{ question: string; answer: string }> = [
	{ question: "What is DPI, and why does it matter here?", answer: "DPI is how many image pixels are packed into one inch of page. A 3000 pixel wide photo at 300 DPI is 10 inches wide; the same photo at 96 DPI is 31 inches wide. It is the single setting that decides how large your image comes out, which is why it is shown next to every image." },
	{ question: "Why did the page come out enormous before?", answer: "The earlier version used the pixel count directly as PDF points, and a point is 1/72 inch. A 3000 by 2000 photo therefore produced a page 41.7 by 27.8 inches. There was no DPI setting at all. That is fixed." },
	{ question: "Are my images re-compressed?", answer: "No, not unless you ask. JPEG and PNG files are embedded byte for byte, so nothing is lost. Only if you set a re-encode quality does the tool re-compress, and it tells you when it does." },
	{ question: "Why does a WebP or HEIC get converted?", answer: "A PDF can only hold JPEG and PNG images. Anything else has to be converted first, which this tool does through the browser itself. The picture looks the same; the file inside the PDF is a PNG." },
	{ question: "One of my images was skipped. Why did the others still work?", answer: "Because each image is handled on its own. A file that cannot be embedded is named and set aside, and every other image still becomes a page. The earlier version threw the whole batch away if a single image failed." },
	{ question: "Can I make the text in my scans searchable?", answer: "No. That needs OCR, which is a different kind of engine and is not available here. Your scans become pictures on a page, which is exactly what the tool claims and nothing more." },
	{ question: "Can I put a password on the PDF?", answer: "No. The library used here can read encrypted PDFs but cannot write encryption, so there is no way to genuinely protect the file. A switch that looked like it protected your document while leaving it open would be worse than not offering one." },
	{ question: "Why is my small screenshot tiny in the middle of the page?", answer: "By default images are never enlarged, because enlarging cannot add detail that is not in the file. Turn on \u201cenlarge small images\u201d if you would rather fill the page and accept the softness." },
	{ question: "Do my images leave my device?", answer: "No. Every step runs in this tab. There is no upload, no network request and no tracking, and it works offline. Only your settings are remembered, never your images." },
	{ question: "Is the original file changed?", answer: "Never. Your images are only read. The PDF is a new file." },
]

export const ASSUMPTIONS: string[] = [
	"Images are placed in the order shown, one page each, unless you choose a grid.",
	"JPEG and PNG are embedded untouched. Everything else is converted to PNG first by the browser, which is lossless but does change the bytes inside the PDF.",
	"DPI decides physical size. If a page comes out the wrong size, the DPI is almost always the setting to change.",
	"Images are never enlarged unless you ask, because enlarging cannot add detail.",
	"Effective DPI is calculated from the drawn width, so it is what the image will really print at, not what the file claims.",
	"The tool cannot make text searchable, cannot encrypt the result and does not claim PDF/A conformance. Each of these is explained rather than faked.",
]

export const RELATED: Array<{ id: string; label: string; why: string }> = [
	{ id: "pdf-to-images", label: "PDF to Images", why: "The other direction." },
	{ id: "pdf-merge", label: "Merge PDF", why: "Combine the PDF you just made with others." },
	{ id: "pdf-compress", label: "Compress PDF", why: "Shrink the result if the photos made it large." },
	{ id: "bulk-image-renamer-optimizer", label: "Bulk Image Renamer & Optimizer", why: "Tidy up and shrink the images before converting them." },
]

export const ALIASES: string[] = [
	"images to pdf", "jpg to pdf", "jpeg to pdf", "png to pdf", "photo to pdf",
	"picture to pdf", "convert images to pdf", "combine images into pdf", "scan to pdf", "heic to pdf",
]

export const SHORTCUTS: Array<{ keys: string; label: string }> = [
	{ keys: "Ctrl/Cmd + Enter", label: "Convert now" },
	{ keys: "Ctrl/Cmd + O", label: "Open the picker" },
	{ keys: "Ctrl/Cmd + V", label: "Paste an image" },
	{ keys: "Ctrl/Cmd + S", label: "Download the PDF" },
	{ keys: "Alt + Up / Down", label: "Move the selected image" },
	{ keys: "Ctrl/Cmd + Backspace", label: "Clear everything" },
	{ keys: "?", label: "Show shortcuts" },
	{ keys: "Esc", label: "Close a dialog, or stop" },
]
