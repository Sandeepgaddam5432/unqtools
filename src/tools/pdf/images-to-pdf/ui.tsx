"use client"

/**
 * Images to PDF — interface half of the 100x rebuild.
 *
 * Copy to: src/tools/pdf/images-to-pdf/ui.tsx
 * Requires: CODE-1-ENGINE.ts -> src/tools/pdf/images-to-pdf/logic.ts
 *
 * Imports only react, lucide-react and ./logic. The default export keeps the live
 * component name, ImagesToPdf.
 *
 * The three things this interface is built around:
 *   - you can see the finished page size and the effective DPI of every image
 *     BEFORE you convert, because that is the setting the old tool got wrong
 *   - the option groups are real fieldsets with aria-pressed, so selection is not
 *     conveyed by button colour alone
 *   - changing any setting throws the old result away, so the Download button can
 *     never hand you a PDF that does not match what is on screen
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { AlertTriangle, ArrowDown, ArrowDownUp, ArrowUp, Check, Copy, Download, FileUp, Info, Keyboard, Lightbulb, RotateCcw, ShieldCheck, Trash2, X } from "lucide-react"
import {
	ALIASES, ASSUMPTIONS, DEFAULT_OPTIONS, EMPTY_BUILD, FAQ, HOW_TO, KIND_LABEL, LOW_DPI, MAX_FILES, MAX_PRESETS, PAGE_SIZE_LABEL, PRESETS, RELATED, RENDER_LIMIT, SHORTCUTS, STATUS_LABEL,
	buildJsonSummary, buildReceipt, buildPdfs, clearAllStorage, copyToClipboard, describePageSize, downloadFile, formatBytes, formatDuration, layoutOne, outputName,
	pageCountFor, perPageCount, planWarnings, readImage, resultsToCsv, stamp, useHistory, usePersisted, zipDocs,
	type Anchor, type BuildResult, type FitMode, type ImageItem, type ImagesToPdfOptions, type MarginSize, type Orientation, type PageSize, type Rotation,
} from "./logic"

const FOCUS = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
const BOX = "rounded-lg border bg-card p-4"
const INPUT = `w-full rounded-md border bg-background px-3 py-2 text-sm ${FOCUS}`

function Button({ children, onClick, variant = "primary", disabled, title }: { children: React.ReactNode; onClick?: () => void; variant?: "primary" | "ghost" | "danger"; disabled?: boolean; title?: string }) {
	const styles = variant === "primary" ? "bg-primary text-primary-foreground hover:opacity-90" : variant === "danger" ? "border border-destructive/40 text-destructive hover:bg-destructive/10" : "border hover:bg-muted"
	return <button type="button" onClick={onClick} disabled={disabled} title={title} className={`inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${styles} ${FOCUS}`}>{children}</button>
}

function IconButton({ label, onClick, children, disabled }: { label: string; onClick: () => void; children: React.ReactNode; disabled?: boolean }) {
	return <button type="button" aria-label={label} title={label} onClick={onClick} disabled={disabled} className={`inline-flex h-8 w-8 items-center justify-center rounded-md border transition-colors hover:bg-muted disabled:opacity-40 ${FOCUS}`}>{children}</button>
}

/**
 * A real fieldset with a legend, and aria-pressed on each choice.
 *
 * This replaces three <Label> elements that had no htmlFor and nothing to point
 * at, in groups where the selected option was shown only by button colour.
 */
function Choice<T extends string>({ legend, hint, value, options, onChange }: { legend: string; hint?: string; value: T; options: Array<{ value: T; label: string; title?: string }>; onChange: (v: T) => void }) {
	return (
		<fieldset className="min-w-0">
			<legend className="mb-1 text-sm font-medium">{legend}</legend>
			<div className="flex flex-wrap gap-2">
				{options.map((o) => (
					<button key={o.value} type="button" aria-pressed={value === o.value} title={o.title} onClick={() => onChange(o.value)}
						className={`rounded-full border px-3 py-1 text-xs transition-colors ${value === o.value ? "bg-primary text-primary-foreground" : "hover:bg-muted"} ${FOCUS}`}>{o.label}</button>
				))}
			</div>
			{hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
		</fieldset>
	)
}

function Toggle({ id, label, hint, checked, onChange, cost }: { id: string; label: string; hint?: string; checked: boolean; onChange: (v: boolean) => void; cost?: string }) {
	return (
		<div className="flex items-start gap-2 py-1">
			<input id={id} type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className={`mt-1 h-4 w-4 rounded border ${FOCUS}`} aria-describedby={hint || cost ? `${id}-hint` : undefined} />
			<div className="min-w-0">
				<label htmlFor={id} className="cursor-pointer text-sm">{label}</label>
				{(hint || cost) && <p id={`${id}-hint`} className="text-xs text-muted-foreground">{hint}{hint && cost ? " " : ""}{cost && <span className="text-amber-600 dark:text-amber-500">{cost}</span>}</p>}
			</div>
		</div>
	)
}

function Field({ id, label, hint, children }: { id: string; label: string; hint?: string; children: React.ReactNode }) {
	return (
		<div className="space-y-1">
			<label htmlFor={id} className="block text-sm font-medium">{label}</label>
			{children}
			{hint && <p id={`${id}-hint`} className="text-xs text-muted-foreground">{hint}</p>}
		</div>
	)
}

function Num({ id, label, hint, value, onChange, min = 0, step = 1, suffix }: { id: string; label: string; hint?: string; value: number; onChange: (v: number) => void; min?: number; step?: number; suffix?: string }) {
	return (
		<Field id={id} label={label} hint={hint}>
			<div className="flex items-center gap-2">
				<input id={id} type="number" min={min} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} className={INPUT} aria-describedby={hint ? `${id}-hint` : undefined} />
				{suffix && <span className="text-xs text-muted-foreground">{suffix}</span>}
			</div>
		</Field>
	)
}

function Bar({ value, label }: { value: number; label: string }) {
	return (
		<div className="space-y-1">
			<div role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(value)} aria-label={label} className="h-2 w-full overflow-hidden rounded-full bg-muted">
				<div className="h-full bg-primary transition-all" style={{ width: `${Math.min(100, Math.max(0, value))}%` }} />
			</div>
			<p className="text-xs text-muted-foreground">{label}</p>
		</div>
	)
}

function Dialog({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: React.ReactNode }) {
	const ref = useRef<HTMLDivElement>(null)
	const opener = useRef<Element | null>(null)
	useEffect(() => {
		if (!open) return
		opener.current = document.activeElement
		ref.current?.focus()
		const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose() }
		window.addEventListener("keydown", onKey)
		return () => {
			window.removeEventListener("keydown", onKey)
			if (opener.current instanceof HTMLElement) opener.current.focus()
		}
	}, [open, onClose])
	if (!open) return null
	return (
		<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
			<div ref={ref} tabIndex={-1} role="dialog" aria-modal="true" aria-label={title} onClick={(e) => e.stopPropagation()} className={`max-h-[80vh] w-full max-w-lg overflow-y-auto rounded-lg border bg-card p-4 ${FOCUS}`}>
				<div className="mb-3 flex items-center justify-between">
					<h2 className="text-sm font-semibold">{title}</h2>
					<IconButton label="Close" onClick={onClose}><X className="h-4 w-4" /></IconButton>
				</div>
				{children}
			</div>
		</div>
	)
}

const PAGE_OPTIONS: Array<{ value: PageSize; label: string; title?: string }> = [
	{ value: "a4", label: "A4" }, { value: "letter", label: "Letter" }, { value: "a3", label: "A3" }, { value: "a5", label: "A5" },
	{ value: "legal", label: "Legal" }, { value: "tabloid", label: "Tabloid" }, { value: "executive", label: "Executive" },
	{ value: "fit", label: "Fit to image", title: "Each page exactly as large as its image, at the resolution you chose" },
	{ value: "custom", label: "Custom" },
]
const ORIENTATION_OPTIONS: Array<{ value: Orientation; label: string; title?: string }> = [
	{ value: "portrait", label: "Portrait" }, { value: "landscape", label: "Landscape" },
	{ value: "auto", label: "Follow each image", title: "Wide photos get wide pages, tall photos get tall pages" },
]
const MARGIN_OPTIONS: Array<{ value: MarginSize; label: string }> = [
	{ value: "none", label: "None" }, { value: "small", label: "Small" }, { value: "medium", label: "Medium" }, { value: "large", label: "Large" }, { value: "custom", label: "Custom" },
]
const FIT_OPTIONS: Array<{ value: FitMode; label: string; title?: string }> = [
	{ value: "contain", label: "Fit inside", title: "Scale down to fit and centre — the original behaviour" },
	{ value: "cover", label: "Fill the page", title: "Fill the page and crop the overhang" },
	{ value: "stretch", label: "Stretch", title: "Fill the page by distorting the image" },
	{ value: "actual", label: "Actual size", title: "Exactly the size the resolution says, even if it overflows" },
]
const ANCHOR_OPTIONS: Array<{ value: Anchor; label: string }> = [
	{ value: "top-left", label: "Top left" }, { value: "top", label: "Top" }, { value: "top-right", label: "Top right" },
	{ value: "left", label: "Left" }, { value: "center", label: "Centre" }, { value: "right", label: "Right" },
	{ value: "bottom-left", label: "Bottom left" }, { value: "bottom", label: "Bottom" }, { value: "bottom-right", label: "Bottom right" },
]
const DPI_OPTIONS = [72, 96, 150, 300, 600]
const PER_PAGE_OPTIONS = [1, 2, 4, 6, 9]

type SortKey = "name" | "date" | "size" | "pixels"

function naturalCompare(a: string, b: string): number {
	return a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" })
}

export default function ImagesToPdf() {
	const [items, setItems] = useState<ImageItem[]>([])
	const [previews, setPreviews] = useState<Record<string, string>>({})
	const [opts, setOpts] = usePersisted<ImagesToPdfOptions>("options", DEFAULT_OPTIONS)
	const [presets, setPresets] = usePersisted<Array<{ id: string; label: string; values: ImagesToPdfOptions }>>("presets", [])
	const [result, setResult] = useState<BuildResult>(EMPTY_BUILD)
	const [running, setRunning] = useState(false)
	const [progress, setProgress] = useState({ done: 0, total: 0, name: "" })
	const [announce, setAnnounce] = useState("")
	const [selected, setSelected] = useState(0)
	const [showKeys, setShowKeys] = useState(false)
	const [showHistory, setShowHistory] = useState(false)
	const [showAdvanced, setShowAdvanced] = useState(false)
	const cancelled = useRef(false)
	const pickerRef = useRef<HTMLInputElement>(null)
	const previewsRef = useRef<Record<string, string>>({})
	const outUrlsRef = useRef<string[]>([])
	const history = useHistory()

	previewsRef.current = previews

	const set = useCallback(<K extends keyof ImagesToPdfOptions>(key: K, value: ImagesToPdfOptions[K]) => { setOpts({ ...opts, [key]: value }) }, [opts, setOpts])

	/**
	 * Fixes the stale-result bug: the old tool cleared the result when images
	 * changed but not when a setting changed, so the Download button kept offering
	 * a PDF built with the previous settings.
	 */
	useEffect(() => { setResult(EMPTY_BUILD) }, [opts])

	/** Fixes the leak: the old tool revoked on remove and reset, but never on unmount. */
	useEffect(() => () => {
		for (const url of Object.values(previewsRef.current)) URL.revokeObjectURL(url)
		for (const url of outUrlsRef.current) URL.revokeObjectURL(url)
	}, [])

	const ready = useMemo(() => items.filter((i) => i.status === "ready"), [items])
	const plan = useMemo(() => planWarnings(items, opts), [items, opts])
	const pages = useMemo(() => pageCountFor(items, opts), [items, opts])
	const per = perPageCount(opts)
	const firstGeo = useMemo(() => (ready[0] ? layoutOne(ready[0], opts) : null), [ready, opts])

	const addFiles = useCallback(async (list: FileList | File[]) => {
		const incoming = Array.from(list).slice(0, MAX_FILES)
		if (incoming.length === 0) return
		setAnnounce(`Reading ${incoming.length} file${incoming.length === 1 ? "" : "s"}.`)
		// Bytes are read fully before anything enters state, so no image can end up
		// stuck at zero bytes the way it could before.
		const read = await Promise.all(incoming.map((f, n) => readImage(f, n)))
		const urls: Record<string, string> = {}
		for (const item of read) {
			if (item.bytes.length === 0) continue
			try { urls[item.id] = URL.createObjectURL(new Blob([item.bytes.slice().buffer as ArrayBuffer], { type: item.kind === "unknown" ? "application/octet-stream" : `image/${item.kind}` })) } catch { /* preview is optional */ }
		}
		setPreviews((prev) => ({ ...prev, ...urls }))
		setItems((prev) => [...prev, ...read])
		setResult(EMPTY_BUILD)
		const good = read.filter((i) => i.status === "ready").length
		setAnnounce(`Added ${good} of ${read.length}. ${read.length - good} could not be used, and each one says why.`)
	}, [])

	const removeItem = useCallback((id: string) => {
		const url = previews[id]
		if (url) URL.revokeObjectURL(url)
		setPreviews((prev) => { const next = { ...prev }; delete next[id]; return next })
		setItems((prev) => prev.filter((i) => i.id !== id))
		setResult(EMPTY_BUILD)
	}, [previews])

	const clearAll = useCallback(() => {
		for (const url of Object.values(previews)) URL.revokeObjectURL(url)
		for (const url of outUrlsRef.current) URL.revokeObjectURL(url)
		outUrlsRef.current = []
		setPreviews({})
		setItems([])
		setResult(EMPTY_BUILD)
		setProgress({ done: 0, total: 0, name: "" })
		setAnnounce("Everything cleared.")
	}, [previews])

	const move = useCallback((index: number, delta: number) => {
		setItems((prev) => {
			const target = index + delta
			if (target < 0 || target >= prev.length) return prev
			const next = [...prev]
			const a = next[index]
			const b = next[target]
			if (!a || !b) return prev
			next[index] = b
			next[target] = a
			return next
		})
		setSelected(Math.max(0, Math.min(items.length - 1, index + delta)))
		setResult(EMPTY_BUILD)
	}, [items.length])

	const sortBy = useCallback((key: SortKey) => {
		setItems((prev) => [...prev].sort((a, b) => {
			if (key === "name") return naturalCompare(a.name, b.name)
			if (key === "date") return a.lastModified - b.lastModified
			if (key === "size") return a.size - b.size
			return a.pixelWidth * a.pixelHeight - b.pixelWidth * b.pixelHeight
		}))
		setResult(EMPTY_BUILD)
		setAnnounce(`Sorted by ${key}.`)
	}, [])

	const rotateItem = useCallback((id: string) => {
		setItems((prev) => prev.map((i) => (i.id === id ? { ...i, rotate: (((i.rotate + 90) % 360) as Rotation) } : i)))
		setResult(EMPTY_BUILD)
	}, [])

	const run = useCallback(async () => {
		if (plan.errors.length > 0 || ready.length === 0 || running) return
		for (const url of outUrlsRef.current) URL.revokeObjectURL(url)
		outUrlsRef.current = []
		cancelled.current = false
		setRunning(true)
		setResult(EMPTY_BUILD)
		setProgress({ done: 0, total: ready.length, name: "" })
		setAnnounce(`Converting ${ready.length} image${ready.length === 1 ? "" : "s"}.`)
		const out = await buildPdfs(items, opts, (done, total, name) => setProgress({ done, total, name }), () => cancelled.current)
		setResult(out)
		setRunning(false)
		if (out.error) setAnnounce(out.error)
		else {
			const low = out.items.filter((i) => i.effectiveDpi > 0 && i.effectiveDpi < LOW_DPI).length
			setAnnounce(`Done in ${formatDuration(out.elapsedMs)}. ${out.pageCount} page${out.pageCount === 1 ? "" : "s"}, ${formatBytes(out.totalPdfBytes)}.${out.skipped.length > 0 ? ` ${out.skipped.length} image${out.skipped.length === 1 ? "" : "s"} skipped.` : ""}${low > 0 ? ` ${low} will print below ${LOW_DPI} DPI.` : ""}`)
			history.add(opts, `${out.pageCount} page${out.pageCount === 1 ? "" : "s"}, ${formatBytes(out.totalPdfBytes)}`)
		}
	}, [items, opts, plan.errors.length, ready.length, running, history])

	const downloadAll = useCallback(() => {
		if (result.docs.length === 0) return
		if (result.docs.length === 1) {
			const only = result.docs[0]
			if (only) downloadFile(only.bytes, only.name, "application/pdf")
			return
		}
		void zipDocs(result.docs).then((blob) => {
			const url = URL.createObjectURL(blob)
			outUrlsRef.current.push(url)
			const a = document.createElement("a")
			a.href = url
			a.download = `${outputName(opts, result.items.length).replace(/\.pdf$/u, "")}.zip`
			document.body.appendChild(a)
			a.click()
			a.remove()
			setAnnounce(`Zip ready, ${formatBytes(blob.size)}.`)
		})
	}, [result.docs, result.items.length, opts])

	const openFirst = useCallback(() => {
		const first = result.docs[0]
		if (!first) return
		const url = URL.createObjectURL(new Blob([first.bytes.slice().buffer as ArrayBuffer], { type: "application/pdf" }))
		outUrlsRef.current.push(url)
		window.open(url, "_blank", "noopener")
	}, [result.docs])

	useEffect(() => {
		const onKey = (e: KeyboardEvent) => {
			const mod = e.metaKey || e.ctrlKey
			const inField = (e.target as HTMLElement | null)?.tagName === "INPUT"
			if (mod && e.key === "Enter") { e.preventDefault(); void run() }
			else if (mod && e.key.toLowerCase() === "o") { e.preventDefault(); pickerRef.current?.click() }
			else if (mod && e.key.toLowerCase() === "s") { e.preventDefault(); downloadAll() }
			else if (mod && e.key === "Backspace") { e.preventDefault(); clearAll() }
			else if (e.altKey && e.key === "ArrowUp") { e.preventDefault(); move(selected, -1) }
			else if (e.altKey && e.key === "ArrowDown") { e.preventDefault(); move(selected, 1) }
			else if (e.key === "?" && !mod && !inField) { e.preventDefault(); setShowKeys(true) }
			else if (e.key === "Escape" && running) { cancelled.current = true; setAnnounce("Stopping.") }
		}
		const onPaste = (e: ClipboardEvent) => {
			const files = Array.from(e.clipboardData?.files ?? [])
			if (files.length > 0) { e.preventDefault(); void addFiles(files) }
		}
		window.addEventListener("keydown", onKey)
		window.addEventListener("paste", onPaste)
		return () => { window.removeEventListener("keydown", onKey); window.removeEventListener("paste", onPaste) }
	}, [run, downloadAll, clearAll, move, selected, running, addFiles])

	const jsonLd = useMemo(() => JSON.stringify({
		"@context": "https://schema.org",
		"@graph": [
			{ "@type": "FAQPage", mainEntity: FAQ.map((f) => ({ "@type": "Question", name: f.question, acceptedAnswer: { "@type": "Answer", text: f.answer } })) },
			{ "@type": "HowTo", name: "How to turn images into a PDF in your browser", step: HOW_TO.map((s) => ({ "@type": "HowToStep", name: s.name, text: s.text })) },
		],
	}), [])

	return (
		<div className="space-y-4">
			<a href="#itp-result" className={`sr-only focus:not-sr-only focus:absolute focus:rounded-md focus:border focus:bg-card focus:px-3 focus:py-2 focus:text-sm ${FOCUS}`}>Skip to results</a>
			<div aria-live="polite" aria-atomic="true" className="sr-only">{announce}</div>

			<div className={BOX}
				onDragOver={(e) => { e.preventDefault() }}
				onDrop={(e) => { e.preventDefault(); void addFiles(e.dataTransfer.files) }}>
				<div className="flex flex-wrap items-center justify-between gap-2">
					<h2 className="text-sm font-semibold">Your images {items.length > 0 && <span className="font-normal text-muted-foreground">— {ready.length} usable of {items.length}</span>}</h2>
					<div className="flex flex-wrap gap-2">
						<Button variant="ghost" onClick={() => pickerRef.current?.click()}><FileUp className="h-4 w-4" />Add images</Button>
						<Button variant="ghost" onClick={clearAll} disabled={items.length === 0}><Trash2 className="h-4 w-4" />Clear</Button>
					</div>
				</div>
				<input ref={pickerRef} id="itp-picker" type="file" accept="image/*" multiple className="sr-only"
					onChange={(e) => { if (e.target.files) void addFiles(e.target.files); e.target.value = "" }} />

				{items.length === 0 ? (
					<button type="button" onClick={() => pickerRef.current?.click()} className={`mt-3 flex w-full flex-col items-center gap-2 rounded-lg border-2 border-dashed p-8 text-center transition-colors hover:bg-muted/40 ${FOCUS}`}>
						<FileUp className="h-6 w-6 text-muted-foreground" />
						<span className="text-sm font-medium">Drop images here, click to choose, or just paste one</span>
						<span className="text-xs text-muted-foreground">JPEG, PNG, WebP, GIF, BMP, AVIF and HEIC. Up to {MAX_FILES}. Nothing is uploaded.</span>
					</button>
				) : (
					<>
						<div className="mt-3 flex flex-wrap items-center gap-2 border-b pb-3">
							<span className="text-xs text-muted-foreground">Sort by</span>
							<Button variant="ghost" onClick={() => sortBy("name")}><ArrowDownUp className="h-4 w-4" />Name</Button>
							<Button variant="ghost" onClick={() => sortBy("date")}>Date</Button>
							<Button variant="ghost" onClick={() => sortBy("size")}>Size</Button>
							<Button variant="ghost" onClick={() => sortBy("pixels")}>Dimensions</Button>
							<Button variant="ghost" onClick={() => { setItems((prev) => [...prev].reverse()); setResult(EMPTY_BUILD); setAnnounce("Order reversed.") }}>Reverse</Button>
						</div>
						<ul className="mt-3 space-y-2">
							{items.slice(0, RENDER_LIMIT).map((item, i) => {
								const geo = item.status === "ready" ? layoutOne(item, opts) : null
								const lowDpi = geo !== null && geo.effectiveDpi > 0 && geo.effectiveDpi < LOW_DPI
								return (
									<li key={item.id} className={`rounded-md border p-2 ${selected === i ? "ring-1 ring-primary" : ""}`} onClick={() => setSelected(i)}>
										<div className="flex flex-wrap items-center gap-3">
											{previews[item.id] ? (
												<img src={previews[item.id]} alt="" className="h-12 w-12 flex-shrink-0 rounded border object-cover" />
											) : <span className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded border text-xs text-muted-foreground">{KIND_LABEL[item.kind].slice(0, 4)}</span>}
											<div className="min-w-0 flex-1">
												<p className="truncate text-sm font-medium" title={item.name}>{per <= 1 ? `Page ${i + 1} — ` : ""}{item.name}</p>
												<p className="text-xs text-muted-foreground">
													{KIND_LABEL[item.kind]} · {formatBytes(item.size)}
													{item.pixelWidth > 0 && ` · ${item.pixelWidth} × ${item.pixelHeight} px`}
													{item.rotate !== 0 && ` · rotated ${item.rotate}°`}
													{geo && geo.effectiveDpi > 0 && <span className={lowDpi ? "text-amber-600 dark:text-amber-500" : ""}> · will print at {geo.effectiveDpi} DPI{lowDpi ? " (may look soft)" : ""}</span>}
												</p>
												{item.statusDetail && <p className={`text-xs ${item.status === "ready" ? "text-muted-foreground" : "text-destructive"}`}>{item.statusDetail}</p>}
											</div>
											{item.status !== "ready" && <span className="rounded-full bg-destructive/10 px-2 py-0.5 text-xs text-destructive">{STATUS_LABEL[item.status]}</span>}
											<div className="flex gap-1">
												<IconButton label={`Move ${item.name} up`} onClick={() => move(i, -1)} disabled={i === 0}><ArrowUp className="h-4 w-4" /></IconButton>
												<IconButton label={`Move ${item.name} down`} onClick={() => move(i, 1)} disabled={i === items.length - 1}><ArrowDown className="h-4 w-4" /></IconButton>
												<IconButton label={`Rotate ${item.name}`} onClick={() => rotateItem(item.id)}><RotateCcw className="h-4 w-4" /></IconButton>
												<IconButton label={`Remove ${item.name}`} onClick={() => removeItem(item.id)}><X className="h-4 w-4" /></IconButton>
											</div>
										</div>
									</li>
								)
							})}
							{items.length > RENDER_LIMIT && <li className="text-xs text-muted-foreground">Showing the first {RENDER_LIMIT} of {items.length}. All of them will be used.</li>}
						</ul>
					</>
				)}
			</div>

			{ready.length > 0 && (
				<div className={`${BOX} space-y-4`}>
					<div className="flex flex-wrap gap-2">
						{PRESETS.map((p) => <button key={p.id} type="button" title={p.description} onClick={() => setOpts({ ...opts, ...p.values })} className={`rounded-full border px-3 py-1 text-xs transition-colors hover:bg-muted ${FOCUS}`}>{p.label}</button>)}
						{presets.map((p) => (
							<span key={p.id} className="inline-flex items-center gap-1">
								<button type="button" onClick={() => setOpts(p.values)} className={`rounded-full border px-3 py-1 text-xs hover:bg-muted ${FOCUS}`}>{p.label}</button>
								<IconButton label={`Delete preset ${p.label}`} onClick={() => setPresets(presets.filter((x) => x.id !== p.id))}><X className="h-3 w-3" /></IconButton>
							</span>
						))}
					</div>

					<div className="grid gap-4 border-t pt-4 sm:grid-cols-2">
						<Choice legend="Page size" value={opts.pageSize} options={PAGE_OPTIONS} onChange={(v) => set("pageSize", v)} />
						{opts.pageSize !== "fit" && opts.pageSize !== "custom" && <Choice legend="Orientation" value={opts.orientation} options={ORIENTATION_OPTIONS} onChange={(v) => set("orientation", v)} />}
						<Choice legend="Margin" value={opts.margin} options={MARGIN_OPTIONS} onChange={(v) => set("margin", v)} />
						<Choice legend="How the image sits on the page" hint="“Fit inside” is the classic behaviour: scaled down to fit, and centred." value={opts.fitMode ?? "contain"} options={FIT_OPTIONS} onChange={(v) => set("fitMode", v)} />
					</div>

					<div className="grid gap-4 border-t pt-4 sm:grid-cols-2">
						<fieldset>
							<legend className="mb-1 text-sm font-medium">Resolution</legend>
							<div className="flex flex-wrap gap-2">
								{DPI_OPTIONS.map((d) => <button key={d} type="button" aria-pressed={(opts.dpi ?? 96) === d} onClick={() => set("dpi", d)} className={`rounded-full border px-3 py-1 text-xs transition-colors ${(opts.dpi ?? 96) === d ? "bg-primary text-primary-foreground" : "hover:bg-muted"} ${FOCUS}`}>{d} DPI</button>)}
							</div>
							<p className="mt-1 text-xs text-muted-foreground">This is what decides how large your image comes out on paper. 300 is normal for a photo or a scan. The old version had no resolution setting at all, which is why pages came out enormous.</p>
						</fieldset>
						<fieldset>
							<legend className="mb-1 text-sm font-medium">Images per page</legend>
							<div className="flex flex-wrap gap-2">
								{PER_PAGE_OPTIONS.map((n) => <button key={n} type="button" aria-pressed={per === n} onClick={() => set("perPage", n)} className={`rounded-full border px-3 py-1 text-xs transition-colors ${per === n ? "bg-primary text-primary-foreground" : "hover:bg-muted"} ${FOCUS}`}>{n === 1 ? "One" : n}</button>)}
							</div>
							{per > 1 && <Toggle id="itp-captions" label="Print the filename under each image" checked={opts.captionFilenames ?? false} onChange={(v) => set("captionFilenames", v)} />}
						</fieldset>
					</div>

					{firstGeo && (
						<div className="rounded-md border bg-muted/40 p-3">
							<div className="flex items-start gap-2">
								<Info className="mt-0.5 h-4 w-4 flex-shrink-0 text-muted-foreground" />
								<p className="text-xs text-muted-foreground">
									<strong className="text-foreground">Before you convert:</strong> {pages} page{pages === 1 ? "" : "s"} from {ready.length} image{ready.length === 1 ? "" : "s"}.
									{opts.pageSize === "fit" ? " Each page will be sized to its own image — the first would be " : " Page size "}
									<strong className="text-foreground">{describePageSize(firstGeo.widthPt, firstGeo.heightPt)}</strong>.
									{firstGeo.effectiveDpi > 0 && ` The first image will print at about ${firstGeo.effectiveDpi} DPI.`}
								</p>
							</div>
						</div>
					)}

					<div className="border-t pt-3">
						<Button variant="ghost" onClick={() => setShowAdvanced(!showAdvanced)}>{showAdvanced ? "Hide the rest of the settings" : "More settings"}</Button>
					</div>

					{showAdvanced && (
						<div className="grid gap-4 border-t pt-4 sm:grid-cols-2">
							<Choice legend="Where on the page" value={opts.anchor ?? "center"} options={ANCHOR_OPTIONS} onChange={(v) => set("anchor", v)} />
							<div>
								<Toggle id="itp-upscale" label="Enlarge images that are smaller than the page" hint="Off by default." checked={opts.allowUpscale ?? false} onChange={(v) => set("allowUpscale", v)} cost="Enlarging cannot add detail, so expect softness." />
								<Toggle id="itp-autorot" label="Rotate each image to match its page" checked={opts.autoRotate ?? false} onChange={(v) => set("autoRotate", v)} />
								<Toggle id="itp-trans" label="Keep transparency" hint="Turn off to put a solid colour behind transparent PNGs." checked={opts.keepTransparency ?? true} onChange={(v) => set("keepTransparency", v)} />
								<Toggle id="itp-nometa" label="Leave the document details empty" hint="No producer, no creator, no author." checked={opts.stripMetadata ?? true} onChange={(v) => set("stripMetadata", v)} />
								<Toggle id="itp-pagenums" label="Add page numbers" checked={opts.pageNumbers ?? false} onChange={(v) => set("pageNumbers", v)} />
								<Toggle id="itp-stampname" label="Print the filename on each page" hint="Useful for scans." checked={opts.stampFilename ?? false} onChange={(v) => set("stampFilename", v)} />
								<Toggle id="itp-stampdate" label="Print today's date on each page" checked={opts.stampDate ?? false} onChange={(v) => set("stampDate", v)} />
							</div>
							{opts.pageSize === "custom" && <Num id="itp-cw" label="Page width" value={opts.customWidth ?? 210} onChange={(v) => set("customWidth", v)} min={1} suffix={opts.customUnit ?? "mm"} />}
							{opts.pageSize === "custom" && <Num id="itp-ch" label="Page height" value={opts.customHeight ?? 297} onChange={(v) => set("customHeight", v)} min={1} suffix={opts.customUnit ?? "mm"} />}
							{opts.margin === "custom" && <Num id="itp-cm" label="Margin" value={opts.customMargin ?? 10} onChange={(v) => set("customMargin", v)} min={0} suffix={opts.marginUnit ?? "mm"} />}
							<Num id="itp-quality" label="Re-encode as JPEG at quality" hint="0 means never re-encode, and nothing is lost. Above 0, images are re-compressed to keep the PDF small." value={Math.round((opts.reencodeQuality ?? 0) * 100)} onChange={(v) => set("reencodeQuality", Math.min(100, Math.max(0, v)) / 100)} min={0} step={5} suffix="%" />
							<Num id="itp-split" label="Split into separate PDFs every" hint="0 means one PDF. Above 0, you get several in a zip." value={opts.splitEvery ?? 0} onChange={(v) => set("splitEvery", v)} min={0} suffix="pages" />
							<Field id="itp-pattern" label="Name the result" hint="{date} and {count} are replaced.">
								<input id="itp-pattern" type="text" value={opts.namePattern ?? ""} onChange={(e) => set("namePattern", e.target.value)} className={INPUT} aria-describedby="itp-pattern-hint" />
							</Field>
							<Field id="itp-title" label="Document title" hint="Optional.">
								<input id="itp-title" type="text" value={opts.title ?? ""} onChange={(e) => set("title", e.target.value)} className={INPUT} aria-describedby="itp-title-hint" />
							</Field>
							<Field id="itp-wm" label="Watermark text" hint="Left empty, no watermark is drawn.">
								<input id="itp-wm" type="text" value={opts.watermarkText ?? ""} onChange={(e) => set("watermarkText", e.target.value)} className={INPUT} aria-describedby="itp-wm-hint" />
							</Field>
						</div>
					)}

					<div className="flex flex-wrap gap-2 border-t pt-3">
						<Button variant="ghost" onClick={() => { const label = `Preset ${presets.length + 1}`; setPresets([...presets, { id: `${Date.now()}`, label, values: opts }].slice(0, MAX_PRESETS)); setAnnounce(`Saved as ${label}.`) }}><Check className="h-4 w-4" />Save these settings</Button>
						<Button variant="ghost" onClick={() => { setOpts(DEFAULT_OPTIONS); setAnnounce("Settings reset.") }}><RotateCcw className="h-4 w-4" />Reset</Button>
						<Button variant="ghost" onClick={() => setShowHistory(true)}>Recent settings</Button>
						<Button variant="ghost" onClick={() => setShowKeys(true)}><Keyboard className="h-4 w-4" />Shortcuts</Button>
					</div>
				</div>
			)}

			{plan.errors.length > 0 && (
				<div className={`${BOX} border-destructive/40 bg-destructive/5`} role="alert">
					<div className="flex items-start gap-2">
						<AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0 text-destructive" />
						<div>
							<h2 className="text-sm font-semibold text-destructive">This cannot run yet</h2>
							<ul className="mt-1 space-y-1 text-sm">{plan.errors.map((m, i) => <li key={i}>{m}</li>)}</ul>
						</div>
					</div>
				</div>
			)}

			{plan.warnings.length > 0 && (
				<div className={BOX}>
					<div className="flex items-start gap-2">
						<Lightbulb className="mt-0.5 h-4 w-4 flex-shrink-0 text-muted-foreground" />
						<div className="min-w-0">
							<h2 className="text-sm font-semibold">Worth knowing</h2>
							<ul className="mt-1 space-y-1 text-sm text-muted-foreground">{plan.warnings.map((m, i) => <li key={i}>{m}</li>)}</ul>
						</div>
					</div>
				</div>
			)}

			{ready.length > 0 && (
				<div className={`${BOX} flex flex-wrap items-center gap-3`}>
					<Button onClick={() => void run()} disabled={running || plan.errors.length > 0}>{running ? "Converting…" : `Convert ${ready.length} image${ready.length === 1 ? "" : "s"} to PDF`}</Button>
					{running && <Button variant="danger" onClick={() => { cancelled.current = true; setAnnounce("Stopping.") }}>Stop</Button>}
					{running && progress.total > 0 && <div className="min-w-[200px] flex-1"><Bar value={(progress.done / progress.total) * 100} label={`${progress.done} of ${progress.total} done${progress.name ? ` — ${progress.name}` : ""}`} /></div>}
					{!running && <span className="text-xs text-muted-foreground">{pages} page{pages === 1 ? "" : "s"} · {formatBytes(ready.reduce((n, i) => n + i.size, 0))} of images</span>}
				</div>
			)}

			<div id="itp-result">
				{result.cancelled && <div className={BOX}><p className="text-sm">Stopped. Whatever finished before you stopped is below.</p></div>}
				{result.error && <div className={`${BOX} border-destructive/40 bg-destructive/5`} role="alert"><p className="text-sm text-destructive">{result.error}</p></div>}
				{result.docs.length > 0 && (
					<div className={`${BOX} space-y-4`}>
						<dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
							<div><dt className="text-xs text-muted-foreground">Pages</dt><dd className="text-lg font-semibold">{result.pageCount}</dd></div>
							<div><dt className="text-xs text-muted-foreground">PDFs</dt><dd className="text-lg font-semibold">{result.docs.length}</dd></div>
							<div><dt className="text-xs text-muted-foreground">Images in</dt><dd className="text-lg font-semibold">{formatBytes(result.totalImageBytes)}</dd></div>
							<div><dt className="text-xs text-muted-foreground">PDF out</dt><dd className="text-lg font-semibold">{formatBytes(result.totalPdfBytes)}</dd></div>
						</dl>
						<p className="text-xs text-muted-foreground">Took {formatDuration(result.elapsedMs)}. These are real byte counts, not estimates.</p>

						<div className="overflow-x-auto">
							<table className="w-full text-sm">
								<caption className="pb-2 text-left text-xs text-muted-foreground">Every image, and how it will actually print</caption>
								<thead><tr className="border-b text-left text-xs text-muted-foreground"><th scope="col" className="py-1 pr-2">Page</th><th scope="col" className="py-1 pr-2">Image</th><th scope="col" className="py-1 pr-2">Effective DPI</th><th scope="col" className="py-1 pr-2">Note</th></tr></thead>
								<tbody>
									{result.items.map((i) => (
										<tr key={`${i.id}-${i.page}`} className="border-b align-top last:border-0">
											<td className="py-2 pr-2 text-xs">{i.page}</td>
											<th scope="row" className="max-w-[240px] py-2 pr-2 text-left font-normal"><span className="block truncate" title={i.name}>{i.name}</span></th>
											<td className={`py-2 pr-2 text-xs ${i.effectiveDpi > 0 && i.effectiveDpi < LOW_DPI ? "text-amber-600 dark:text-amber-500" : ""}`}>{i.effectiveDpi > 0 ? i.effectiveDpi : "—"}</td>
											<td className="py-2 pr-2 text-xs text-muted-foreground">{i.note}</td>
										</tr>
									))}
								</tbody>
							</table>
						</div>

						{result.skipped.length > 0 && (
							<div className="rounded-md border border-destructive/40 bg-destructive/5 p-3">
								<h3 className="text-sm font-semibold text-destructive">Skipped, and the rest still worked</h3>
								<ul className="mt-1 space-y-1 text-sm">{result.skipped.map((m, i) => <li key={i}>{m}</li>)}</ul>
							</div>
						)}

						<div className="flex flex-wrap gap-2 border-t pt-3">
							<Button onClick={downloadAll}><Download className="h-4 w-4" />{result.docs.length > 1 ? `Download all ${result.docs.length} as a zip` : "Download the PDF"}</Button>
							<Button variant="ghost" onClick={openFirst}>Open in a new tab</Button>
							<Button variant="ghost" onClick={() => downloadFile(buildReceipt(opts, result), `images-to-pdf-receipt-${stamp()}.txt`, "text/plain")}>Receipt</Button>
							<Button variant="ghost" onClick={() => downloadFile(resultsToCsv(result), `images-to-pdf-${stamp()}.csv`, "text/csv")}>CSV</Button>
							<Button variant="ghost" onClick={() => downloadFile(buildJsonSummary(opts, result), `images-to-pdf-${stamp()}.json`, "application/json")}>JSON</Button>
							<Button variant="ghost" onClick={() => { void copyToClipboard(buildReceipt(opts, result)).then(() => setAnnounce("Receipt copied.")) }}><Copy className="h-4 w-4" />Copy receipt</Button>
						</div>
					</div>
				)}
			</div>

			<div className={`${BOX} space-y-3`}>
				<h2 className="text-sm font-semibold">How to use this</h2>
				<ol className="list-decimal space-y-1 pl-5 text-sm text-muted-foreground">{HOW_TO.map((s) => <li key={s.name}><strong className="text-foreground">{s.name}.</strong> {s.text}</li>)}</ol>
				<h3 className="pt-2 text-sm font-semibold">Questions</h3>
				<div className="space-y-2">
					{FAQ.map((f) => (
						<details key={f.question} className="rounded-md border p-2">
							<summary className={`cursor-pointer text-sm font-medium ${FOCUS}`}>{f.question}</summary>
							<p className="mt-1 text-sm text-muted-foreground">{f.answer}</p>
						</details>
					))}
				</div>
				<h3 className="pt-2 text-sm font-semibold">What this tool assumes</h3>
				<ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">{ASSUMPTIONS.map((a) => <li key={a}>{a}</li>)}</ul>
				<h3 className="pt-2 text-sm font-semibold">Related tools</h3>
				<ul className="space-y-1 text-sm text-muted-foreground">{RELATED.map((r) => <li key={r.id}><strong className="text-foreground">{r.label}</strong> — {r.why}</li>)}</ul>
				<p className="pt-2 text-xs text-muted-foreground">Also known as: {ALIASES.join(", ")}.</p>
			</div>

			<div className={BOX}>
				<div className="flex flex-wrap items-start justify-between gap-3">
					<div className="flex items-start gap-2">
						<ShieldCheck className="mt-0.5 h-4 w-4 flex-shrink-0 text-emerald-600 dark:text-emerald-400" />
						<p className="text-xs text-muted-foreground"><strong className="text-foreground">Your images stay with you.</strong> Every step runs in this tab. There is no upload, no network request and no tracking, and it works offline. Your images are held in memory only while the PDF is being built and are never stored. Only your settings are remembered in this browser. Your original files are only ever read, never changed.</p>
					</div>
					<Button variant="ghost" onClick={() => { clearAllStorage(); setOpts(DEFAULT_OPTIONS); history.clearAll(); setPresets([]); setAnnounce("Everything this tool had stored has been deleted.") }}><Trash2 className="h-4 w-4" />Delete stored settings</Button>
				</div>
			</div>

			<Dialog open={showKeys} onClose={() => setShowKeys(false)} title="Keyboard shortcuts">
				<ul className="space-y-1 text-sm">{SHORTCUTS.map((s) => <li key={s.keys} className="flex justify-between gap-4"><span className="text-muted-foreground">{s.label}</span><kbd className="rounded border px-1.5 py-0.5 text-xs">{s.keys}</kbd></li>)}</ul>
			</Dialog>

			<Dialog open={showHistory} onClose={() => setShowHistory(false)} title="Recent settings">
				<p className="mb-2 text-xs text-muted-foreground">Settings only. Your images are never stored, and nothing here is applied until you choose it.</p>
				{history.entries.length === 0 ? <p className="text-sm text-muted-foreground">Nothing yet.</p> : (
					<ul className="space-y-2">
						{history.entries.map((h) => (
							<li key={h.id} className="flex items-center gap-2 rounded-md border p-2">
								<div className="min-w-0 flex-1">
									<p className="truncate text-sm">{h.summary}</p>
									<p className="text-xs text-muted-foreground">{new Date(h.at).toLocaleString()}</p>
								</div>
								<Button variant="ghost" onClick={() => { setOpts(h.options); setShowHistory(false); setAnnounce("Settings restored.") }}>Use these</Button>
								<IconButton label="Pin" onClick={() => history.togglePin(h.id)}><Check className={`h-4 w-4 ${h.pinned ? "text-primary" : "text-muted-foreground"}`} /></IconButton>
								<IconButton label="Delete" onClick={() => history.remove(h.id)}><X className="h-4 w-4" /></IconButton>
							</li>
						))}
					</ul>
				)}
			</Dialog>

			<script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd }} />
		</div>
	)
}
