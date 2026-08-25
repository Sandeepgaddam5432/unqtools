"use client"

/**
 * Split PDF — interface half of the 100x rebuild.
 *
 * Copy to: src/tools/pdf/pdf-split/ui.tsx
 * Pair with: CODE-1-ENGINE.ts -> src/tools/pdf/pdf-split/logic.ts
 *
 * Imports react, lucide-react and ./logic only. No project imports, so it cannot
 * drift from _shared. Default export keeps the old name SplitPDF.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
	AlertTriangle, Check, ChevronRight, Copy, Download, Eraser, FileUp, Info,
	Keyboard, Lightbulb, Link2, Pin, RotateCcw, ShieldCheck, SquareStack, Trash2, X,
} from "lucide-react"
import {
	ALIASES, ASSUMPTIONS, DEFAULT_SPLIT_OPTIONS, EMPTY_OUTCOME, EMPTY_SOURCE, FAQ, HOW_TO,
	MAX_FILE_BYTES, MAX_PRESETS, MODES, PRESETS, RELATED, RENDER_LIMIT, SHORTCUTS, STATUS_LABEL,
	buildJsonSummary, buildPlan, buildReceipt, clearAllStorage, copyToClipboard, describePages,
	downloadFile, formatBytes, formatDuration, inspectPdf, pieceName, piecesToCsv, safeFileName,
	splitPdf, stamp, useHistory, usePersisted, zipPieces,
	type MetadataMode, type Preset, type Rotation, type SizeSource, type SourceDoc,
	type SplitMode, type SplitOptions, type SplitOutcome,
} from "./logic"

const FOCUS = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
const BOX = "rounded-lg border bg-card p-4"
const CHIP = "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs"
const INPUT = `w-full rounded-md border bg-background px-3 py-2 text-sm ${FOCUS}`

/* ===== atoms ===== */

function Button({ children, onClick, variant = "primary", disabled, title, type = "button" }: { children: React.ReactNode; onClick?: () => void; variant?: "primary" | "ghost" | "danger"; disabled?: boolean; title?: string; type?: "button" | "submit" }) {
	const styles = variant === "primary" ? "bg-primary text-primary-foreground hover:opacity-90" : variant === "danger" ? "border border-destructive text-destructive hover:bg-destructive/10" : "border hover:bg-muted/50"
	return <button type={type} onClick={onClick} disabled={disabled} title={title} className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-50 ${styles} ${FOCUS}`}>{children}</button>
}

function IconButton({ label, onClick, children, disabled }: { label: string; onClick: () => void; children: React.ReactNode; disabled?: boolean }) {
	return <button type="button" aria-label={label} title={label} onClick={onClick} disabled={disabled} className={`rounded-md border p-1.5 text-muted-foreground transition hover:bg-muted/50 hover:text-foreground disabled:opacity-40 ${FOCUS}`}>{children}</button>
}

function Toggle({ id, label, hint, checked, onChange }: { id: string; label: string; hint?: string; checked: boolean; onChange: (v: boolean) => void }) {
	return (
		<div className="flex items-start gap-2">
			<input id={id} type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className={`mt-1 h-4 w-4 rounded border ${FOCUS}`} aria-describedby={hint ? `${id}-hint` : undefined} />
			<div className="min-w-0">
				<label htmlFor={id} className="cursor-pointer text-sm">{label}</label>
				{hint && <p id={`${id}-hint`} className="text-xs text-muted-foreground">{hint}</p>}
			</div>
		</div>
	)
}

function Field({ id, label, hint, error, children }: { id: string; label: string; hint?: string; error?: string; children: React.ReactNode }) {
	return (
		<div className="space-y-1">
			<label htmlFor={id} className="block text-sm font-medium">{label}</label>
			{children}
			{hint && !error && <p id={`${id}-hint`} className="text-xs text-muted-foreground">{hint}</p>}
			{error && <p id={`${id}-error`} className="text-xs text-destructive">{error}</p>}
		</div>
	)
}

function Select<T extends string>({ id, label, hint, value, options, onChange }: { id: string; label: string; hint?: string; value: T; options: ReadonlyArray<{ v: T; label: string }>; onChange: (v: T) => void }) {
	return (
		<Field id={id} label={label} hint={hint}>
			<select id={id} value={value} onChange={(e) => onChange(e.target.value as T)} aria-describedby={hint ? `${id}-hint` : undefined} className={INPUT}>
				{options.map((o) => <option key={o.v} value={o.v}>{o.label}</option>)}
			</select>
		</Field>
	)
}

function Num({ id, label, hint, value, min, max, step, onChange }: { id: string; label: string; hint?: string; value: number; min?: number; max?: number; step?: number; onChange: (v: number) => void }) {
	return (
		<Field id={id} label={label} hint={hint}>
			<input id={id} type="number" value={value} min={min} max={max} step={step} onChange={(e) => onChange(Number(e.target.value))} aria-describedby={hint ? `${id}-hint` : undefined} className={INPUT} />
		</Field>
	)
}

function Bar({ value, max, label }: { value: number; max: number; label: string }) {
	const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0
	return (
		<div role="progressbar" aria-valuenow={value} aria-valuemin={0} aria-valuemax={max} aria-label={label} className="h-2 w-full overflow-hidden rounded-full bg-muted">
			<div className="h-full bg-primary transition-all" style={{ width: `${pct}%` }} />
		</div>
	)
}

function Dialog({ open, title, onClose, children }: { open: boolean; title: string; onClose: () => void; children: React.ReactNode }) {
	const opener = useRef<Element | null>(null)
	useEffect(() => {
		if (open) { opener.current = document.activeElement; return }
		const el = opener.current
		if (el instanceof HTMLElement) el.focus()
	}, [open])
	useEffect(() => {
		if (!open) return
		const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose() }
		window.addEventListener("keydown", onKey)
		return () => window.removeEventListener("keydown", onKey)
	}, [open, onClose])
	if (!open) return null
	return (
		<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true" aria-label={title}>
			<div className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-lg border bg-card p-4 shadow-lg">
				<div className="mb-3 flex items-center justify-between gap-2">
					<h2 className="text-sm font-semibold">{title}</h2>
					<IconButton label="Close" onClick={onClose}><X className="h-4 w-4" /></IconButton>
				</div>
				{children}
			</div>
		</div>
	)
}

/* ===== main ===== */

export default function SplitPDF() {
	const [opts, setOpts] = usePersisted<SplitOptions>("options", DEFAULT_SPLIT_OPTIONS)
	const [saved, setSaved] = usePersisted<Preset[]>("presets", [])
	const history = useHistory()

	const [src, setSrc] = useState<SourceDoc>(EMPTY_SOURCE)
	const bytesRef = useRef<Uint8Array | null>(null)
	const [reading, setReading] = useState(false)
	const [dragging, setDragging] = useState(false)

	const [running, setRunning] = useState(false)
	const [progress, setProgress] = useState({ done: 0, total: 0, name: "" })
	const cancelRef = useRef(false)
	const [result, setResult] = useState<SplitOutcome>(EMPTY_OUTCOME)
	const [zipping, setZipping] = useState(false)
	const [live, setLive] = useState("")
	const urlsRef = useRef<string[]>([])

	const [showOptions, setShowOptions] = useState(true)
	const [showKeys, setShowKeys] = useState(false)
	const [showHistory, setShowHistory] = useState(false)
	const [presetName, setPresetName] = useState("")

	const set = useCallback(<K extends keyof SplitOptions>(key: K, value: SplitOptions[K]) => { setOpts({ ...opts, [key]: value }) }, [opts, setOpts])

	const plan = useMemo(() => buildPlan(src, opts), [src, opts])
	const ready = src.status === "ready" && plan.errors.length === 0 && plan.pieces.length > 0

	const releaseUrls = useCallback(() => {
		for (const u of urlsRef.current) URL.revokeObjectURL(u)
		urlsRef.current = []
	}, [])
	useEffect(() => releaseUrls, [releaseUrls])

	/* --- taking the file --- */

	const accept = useCallback(async (file: File | undefined) => {
		if (!file) return
		setReading(true)
		setResult(EMPTY_OUTCOME)
		releaseUrls()
		const { doc, bytes } = await inspectPdf(file)
		bytesRef.current = bytes
		setSrc(doc)
		setReading(false)
		setLive(doc.status === "ready" ? `${doc.name} added. ${doc.pageCount} pages, ${formatBytes(doc.size)}.` : `${doc.name} was not accepted. ${doc.statusDetail}`)
	}, [releaseUrls])

	const onDrop = useCallback((e: React.DragEvent) => {
		e.preventDefault()
		setDragging(false)
		void accept(e.dataTransfer.files[0])
	}, [accept])

	const openPicker = useCallback(() => { document.getElementById("split-picker")?.click() }, [])

	const clearAll = useCallback(() => {
		releaseUrls()
		bytesRef.current = null
		setSrc(EMPTY_SOURCE)
		setResult(EMPTY_OUTCOME)
		setProgress({ done: 0, total: 0, name: "" })
		setLive("Cleared. No document is held any more.")
	}, [releaseUrls])

	/* --- running --- */

	const run = useCallback(async () => {
		const bytes = bytesRef.current
		if (!bytes || !ready || running) return
		setRunning(true)
		cancelRef.current = false
		releaseUrls()
		setResult(EMPTY_OUTCOME)
		setProgress({ done: 0, total: plan.pieces.length, name: "" })
		setLive(`Splitting into ${plan.pieces.length} files.`)
		const outcome = await splitPdf(bytes, src, opts, plan,
			(done, total, name) => setProgress({ done, total, name }),
			() => cancelRef.current)
		setResult(outcome)
		setRunning(false)
		if (outcome.cancelled) setLive("Stopped. No files were written.")
		else if (outcome.error) setLive(`Could not split. ${outcome.error}`)
		else {
			setLive(`Done. ${outcome.pieces.length} files, ${formatBytes(outcome.totalBytes)} in total, in ${formatDuration(outcome.elapsedMs)}.`)
			history.add(opts, `${src.name} → ${outcome.pieces.length} files (${opts.mode})`)
		}
	}, [ready, running, plan, src, opts, history, releaseUrls])

	const stop = useCallback(() => { cancelRef.current = true }, [])

	const zipName = useMemo(() => `${safeFileName(src.name.replace(/\.pdf$/iu, ""), "split")}-split-${stamp()}.zip`, [src.name])

	const downloadZip = useCallback(async () => {
		if (result.pieces.length === 0 || zipping) return
		setZipping(true)
		setLive("Building the zip.")
		try {
			const blob = await zipPieces(result.pieces)
			downloadFile(blob, zipName, "application/zip")
			setLive(`Zip downloaded: ${zipName}, ${formatBytes(blob.size)}.`)
		} catch (e) {
			setLive(`The zip could not be built. ${e instanceof Error ? e.message : String(e)} You can still download each file on its own.`)
		}
		setZipping(false)
	}, [result.pieces, zipping, zipName])

	const openPiece = useCallback((i: number) => {
		const piece = result.pieces[i]
		if (!piece) return
		const url = URL.createObjectURL(piece.blob)
		urlsRef.current.push(url)
		window.open(url, "_blank", "noopener")
	}, [result.pieces])

	/* --- shortcuts --- */

	useEffect(() => {
		const onKey = (e: KeyboardEvent) => {
			const mod = e.metaKey || e.ctrlKey
			const typing = e.target instanceof HTMLElement && /input|textarea|select/i.test(e.target.tagName)
			if (mod && e.key === "Enter") { e.preventDefault(); void run() }
			else if (mod && e.key.toLowerCase() === "o") { e.preventDefault(); openPicker() }
			else if (mod && e.key.toLowerCase() === "s") { e.preventDefault(); void downloadZip() }
			else if (mod && e.key === "Backspace") { e.preventDefault(); clearAll() }
			else if (e.key === "Escape" && running) { e.preventDefault(); stop() }
			else if (e.key === "?" && !typing) { e.preventDefault(); setShowKeys(true) }
		}
		window.addEventListener("keydown", onKey)
		return () => window.removeEventListener("keydown", onKey)
	}, [run, openPicker, downloadZip, clearAll, running, stop])

	/* --- presets --- */

	const applyPreset = useCallback((p: Preset) => {
		setOpts({ ...opts, ...p.values })
		setLive(`Preset applied: ${p.label}.`)
	}, [opts, setOpts])

	const savePreset = useCallback(() => {
		const label = presetName.trim()
		if (label.length === 0) return
		setSaved([{ id: `own-${Date.now()}`, label, description: "Your saved settings.", values: opts }, ...saved].slice(0, MAX_PRESETS))
		setPresetName("")
		setLive(`Preset saved as ${label}.`)
	}, [presetName, opts, saved, setSaved])

	const namePreview = useMemo(() => plan.pieces.slice(0, 4).map((p) => pieceName(opts.namePattern, src.name || "document.pdf", p, plan.pieces.length, opts.padIndex)), [plan.pieces, opts.namePattern, opts.padIndex, src.name])

	const modeHint = MODES.find((m) => m.v === opts.mode)?.hint ?? ""
	const shown = result.pieces.slice(0, RENDER_LIMIT)

	return (
		<div className="space-y-4">
			<a href="#split-result" className={`sr-only focus:not-sr-only focus:absolute focus:z-50 focus:rounded focus:bg-card focus:px-3 focus:py-1.5 focus:text-sm ${FOCUS}`}>Skip to results</a>
			<p aria-live="polite" aria-atomic="true" className="sr-only">{live}</p>

			{/* file */}
			<section className={BOX} aria-labelledby="split-file-h">
				<div className="mb-3 flex flex-wrap items-center justify-between gap-2">
					<h2 id="split-file-h" className="text-sm font-semibold">The document</h2>
					<div className="flex gap-2">
						<Button variant="ghost" onClick={() => setShowKeys(true)}><Keyboard className="h-4 w-4" />Shortcuts</Button>
						<Button variant="ghost" onClick={() => setShowHistory(true)}><RotateCcw className="h-4 w-4" />Recent settings</Button>
					</div>
				</div>
				<div onDragOver={(e) => { e.preventDefault(); setDragging(true) }} onDragLeave={() => setDragging(false)} onDrop={onDrop} className={`rounded-lg border-2 border-dashed p-6 text-center transition ${dragging ? "border-primary bg-primary/5" : "border-muted"}`}>
					<FileUp className="mx-auto mb-2 h-6 w-6 text-muted-foreground" aria-hidden="true" />
					<p className="text-sm">Drop a PDF here, or</p>
					<div className="mt-2 flex flex-wrap justify-center gap-2">
						<Button onClick={openPicker}>Choose a PDF</Button>
						{src.status !== "none" && <Button variant="ghost" onClick={clearAll}><Eraser className="h-4 w-4" />Clear</Button>}
					</div>
					<input id="split-picker" type="file" accept="application/pdf,.pdf" className="sr-only" onChange={(e) => { void accept(e.target.files?.[0]); e.currentTarget.value = "" }} />
					<p className="mt-2 text-xs text-muted-foreground">One PDF, up to {formatBytes(MAX_FILE_BYTES)}. It stays in this tab.</p>
				</div>

				{reading && <p className="mt-3 text-sm text-muted-foreground">Reading the document…</p>}

				{src.status !== "none" && !reading && (
					<div className="mt-3 rounded-md border p-3">
						<div className="flex flex-wrap items-center gap-2">
							<span className="truncate text-sm font-medium">{src.name}</span>
							<span className={`${CHIP} ${src.status === "ready" ? "text-muted-foreground" : "border-destructive text-destructive"}`}>{STATUS_LABEL[src.status]}</span>
							<span className="text-xs text-muted-foreground">{formatBytes(src.size)}</span>
							{src.status === "ready" && <span className="text-xs text-muted-foreground">{src.pageCount} page{src.pageCount === 1 ? "" : "s"}</span>}
						</div>
						{src.statusDetail && <p className="mt-1 text-xs text-destructive">{src.statusDetail}</p>}
						{src.status === "ready" && (
							<p className="mt-1 text-xs text-muted-foreground">
								{src.title ? `Title: ${src.title}. ` : ""}{src.author ? `Author: ${src.author}. ` : ""}
								First page {src.pageSizes[0]?.width ?? 0} × {src.pageSizes[0]?.height ?? 0} points.
							</p>
						)}
					</div>
				)}
			</section>

			{/* how to split */}
			<section className={BOX} aria-labelledby="split-mode-h">
				<h2 id="split-mode-h" className="mb-3 text-sm font-semibold">How to split it</h2>
				<div className="grid gap-3 sm:grid-cols-2">
					<Select id="split-mode" label="Split" hint={modeHint} value={opts.mode} onChange={(v: SplitMode) => set("mode", v)} options={MODES.map((m) => ({ v: m.v, label: m.label }))} />
					{opts.mode === "ranges" && (
						<Field id="split-ranges" label="Ranges, one file each" hint="Such as 1-3, 4-8, 9- . Use -1 for the last page.">
							<input id="split-ranges" value={opts.ranges} onChange={(e) => set("ranges", e.target.value)} placeholder="1-3, 4-8, 9-" className={INPUT} aria-describedby="split-ranges-hint" aria-invalid={plan.errors.length > 0} />
						</Field>
					)}
					{opts.mode === "everyN" && <Num id="split-everyn" label="Pages per file" hint="The last file takes the remainder." value={opts.everyN} min={1} onChange={(v) => set("everyN", v)} />}
					{opts.mode === "parts" && <Num id="split-parts" label="How many files" hint="Divided as evenly as the page count allows." value={opts.parts} min={1} onChange={(v) => set("parts", v)} />}
					{opts.mode === "cutPoints" && (
						<Field id="split-cuts" label="Cut after these pages" hint="Such as 4, 9, 15. Each cut starts a new file.">
							<input id="split-cuts" value={opts.cutPoints} onChange={(e) => set("cutPoints", e.target.value)} placeholder="4, 9, 15" className={INPUT} aria-describedby="split-cuts-hint" />
						</Field>
					)}
					{opts.mode === "bySize" && <Num id="split-size" label="Size limit per file, in MB" hint="Estimated from the original; the real sizes are shown after the split." value={Math.round(opts.targetBytes / (1024 * 1024))} min={1} onChange={(v) => set("targetBytes", Math.max(1, v) * 1024 * 1024)} />}
					{(opts.mode === "extract" || opts.mode === "remove") && (
						<Field id="split-pages" label={opts.mode === "extract" ? "Pages to keep" : "Pages to remove"} hint="Such as 1-3, 7, 10- . Use -1 for the last page.">
							<input id="split-pages" value={opts.pages} onChange={(e) => set("pages", e.target.value)} placeholder="1-3, 7" className={INPUT} aria-describedby="split-pages-hint" />
						</Field>
					)}
				</div>

				<div className="mt-3 flex flex-wrap gap-2">
					{PRESETS.map((p) => <button key={p.id} type="button" onClick={() => applyPreset(p)} title={p.description} className={`${CHIP} hover:bg-muted/50 ${FOCUS}`}><Lightbulb className="h-3 w-3" />{p.label}</button>)}
					{saved.map((p) => (
						<span key={p.id} className={CHIP}>
							<button type="button" onClick={() => applyPreset(p)} className={`${FOCUS} rounded`}>{p.label}</button>
							<button type="button" aria-label={`Delete the preset ${p.label}`} onClick={() => setSaved(saved.filter((s) => s.id !== p.id))} className={`${FOCUS} rounded text-muted-foreground hover:text-destructive`}><X className="h-3 w-3" /></button>
						</span>
					))}
				</div>
			</section>

			{/* errors and warnings */}
			{plan.errors.length > 0 && src.status !== "none" && (
				<div className="rounded-lg border border-destructive bg-destructive/5 p-4" role="alert">
					<p className="mb-1 flex items-center gap-1.5 text-sm font-medium text-destructive"><AlertTriangle className="h-4 w-4" />This cannot run yet</p>
					<ul className="list-inside list-disc space-y-1 text-xs text-destructive">{plan.errors.map((m, i) => <li key={i}>{m}</li>)}</ul>
				</div>
			)}
			{(plan.warnings.length > 0 || plan.notes.length > 0) && (
				<div className="rounded-lg border bg-muted/30 p-4">
					<p className="mb-1 flex items-center gap-1.5 text-sm font-medium"><Info className="h-4 w-4" />Worth knowing</p>
					<ul className="list-inside list-disc space-y-1 text-xs text-muted-foreground">
						{plan.warnings.map((m, i) => <li key={`w${i}`}>{m}</li>)}
						{plan.notes.map((m, i) => <li key={`n${i}`}>{m}</li>)}
					</ul>
				</div>
			)}

			{/* preview */}
			{plan.pieces.length > 0 && (
				<section className={BOX} aria-labelledby="split-preview-h">
					<h2 id="split-preview-h" className="mb-2 text-sm font-semibold">What you will get: {plan.pieces.length} file{plan.pieces.length === 1 ? "" : "s"}</h2>
					<div className="overflow-x-auto">
						<table className="w-full text-left text-xs">
							<caption className="sr-only">Every file this split will produce, with its pages</caption>
							<thead className="text-muted-foreground"><tr><th scope="col" className="py-1 pr-3">#</th><th scope="col" className="py-1 pr-3">Name</th><th scope="col" className="py-1 pr-3">Pages</th><th scope="col" className="py-1">Count</th></tr></thead>
							<tbody>
								{plan.pieces.slice(0, RENDER_LIMIT).map((p) => (
									<tr key={p.index} className="border-t">
										<th scope="row" className="py-1 pr-3 font-normal">{p.index}</th>
										<td className="py-1 pr-3 font-mono">{pieceName(opts.namePattern, src.name || "document.pdf", p, plan.pieces.length, opts.padIndex)}</td>
										<td className="py-1 pr-3">{describePages(p.pages)}</td>
										<td className="py-1">{p.pages.length}</td>
									</tr>
								))}
							</tbody>
						</table>
					</div>
					{plan.pieces.length > RENDER_LIMIT && <p className="mt-2 text-xs text-muted-foreground">Showing the first {RENDER_LIMIT} of {plan.pieces.length}. All of them will be produced.</p>}
					<p className="mt-2 text-xs text-muted-foreground">Page accounting {plan.reconciles ? "adds up against the original." : "does not add up — check the ranges above."}</p>
				</section>
			)}

			{/* options */}
			<section className={BOX} aria-labelledby="split-opts-h">
				<button type="button" onClick={() => setShowOptions(!showOptions)} aria-expanded={showOptions} className={`flex w-full items-center justify-between gap-2 text-left ${FOCUS} rounded`}>
					<h2 id="split-opts-h" className="text-sm font-semibold">Everything else</h2>
					<ChevronRight className={`h-4 w-4 transition ${showOptions ? "rotate-90" : ""}`} aria-hidden="true" />
				</button>
				{showOptions && (
					<div className="mt-3 grid gap-4 sm:grid-cols-2">
						<Select id="split-rotate" label="Rotate every page" hint="Added to any rotation the page already had." value={String(opts.rotate) as "0" | "90" | "180" | "270"} onChange={(v) => set("rotate", Number(v) as Rotation)} options={[{ v: "0", label: "Not at all" }, { v: "90", label: "90° clockwise" }, { v: "180", label: "180°" }, { v: "270", label: "270°" }]} />
						<Select id="split-metadata" label="Document details" hint="What goes into each file's properties." value={opts.metadataMode} onChange={(v: MetadataMode) => set("metadataMode", v)} options={[{ v: "copy", label: "Copy from the original" }, { v: "custom", label: "Set my own" }, { v: "strip", label: "Remove all of it" }]} />
						{opts.metadataMode === "custom" && (
							<>
								<Field id="split-title" label="Title"><input id="split-title" value={opts.title} onChange={(e) => set("title", e.target.value)} className={INPUT} /></Field>
								<Field id="split-author" label="Author"><input id="split-author" value={opts.author} onChange={(e) => set("author", e.target.value)} className={INPUT} /></Field>
								<Field id="split-subject" label="Subject"><input id="split-subject" value={opts.subject} onChange={(e) => set("subject", e.target.value)} className={INPUT} /></Field>
								<Field id="split-keywords" label="Keywords" hint="Separated by commas."><input id="split-keywords" value={opts.keywords} onChange={(e) => set("keywords", e.target.value)} className={INPUT} aria-describedby="split-keywords-hint" /></Field>
							</>
						)}
						<Field id="split-pattern" label="Name the files" hint="Use {name}, {index}, {start}, {end}, {pages}, {total}, {date}.">
							<input id="split-pattern" value={opts.namePattern} onChange={(e) => set("namePattern", e.target.value)} className={`${INPUT} font-mono`} aria-describedby="split-pattern-hint" />
						</Field>
						{opts.normaliseSize && <Select id="split-sizesrc" label="Make every page" value={opts.sizeSource} onChange={(v: SizeSource) => set("sizeSource", v)} options={[{ v: "first", label: "the size of the first page" }, { v: "largest", label: "the size of the largest page" }, { v: "a4", label: "A4" }, { v: "letter", label: "Letter" }]} />}
						<div className="space-y-2 sm:col-span-2">
							<Toggle id="split-reverse" label="Reverse the pages inside each file" checked={opts.reverseInPiece} onChange={(v) => set("reverseInPiece", v)} />
							<Toggle id="split-normalise" label="Force every page to one size" hint="Off by default, so mixed page sizes are kept exactly." checked={opts.normaliseSize} onChange={(v) => set("normaliseSize", v)} />
							<Toggle id="split-bookmark" label="Add a bookmark naming the page range" checked={opts.addBookmark} onChange={(v) => set("addBookmark", v)} />
							<Toggle id="split-compress" label="Compress the output" hint="Object streams, which keeps the files smaller." checked={opts.compress} onChange={(v) => set("compress", v)} />
							<Toggle id="split-pad" label="Pad the number so files sort correctly" checked={opts.padIndex} onChange={(v) => set("padIndex", v)} />
							<Toggle id="split-zip" label="Give me one zip rather than many downloads" checked={opts.zipOutput} onChange={(v) => set("zipOutput", v)} />
						</div>
						{namePreview.length > 0 && (
							<div className="sm:col-span-2 rounded-md border bg-muted/30 p-3">
								<p className="mb-1 text-xs font-medium">Names will look like</p>
								<ul className="space-y-0.5 font-mono text-xs text-muted-foreground">{namePreview.map((n, i) => <li key={i}>{n}</li>)}</ul>
							</div>
						)}
						<div className="sm:col-span-2 flex flex-wrap items-end gap-2">
							<Field id="split-presetname" label="Save these settings as"><input id="split-presetname" value={presetName} onChange={(e) => setPresetName(e.target.value)} placeholder="My split" className={INPUT} /></Field>
							<Button variant="ghost" onClick={savePreset} disabled={presetName.trim().length === 0}><Pin className="h-4 w-4" />Save</Button>
							<Button variant="ghost" onClick={() => { setOpts(DEFAULT_SPLIT_OPTIONS); setLive("Settings reset.") }}><RotateCcw className="h-4 w-4" />Reset</Button>
						</div>
					</div>
				)}
			</section>

			{/* run */}
			<section className={BOX} aria-labelledby="split-run-h">
				<h2 id="split-run-h" className="sr-only">Run the split</h2>
				<div className="flex flex-wrap items-center gap-2">
					<Button onClick={() => void run()} disabled={!ready || running}><SquareStack className="h-4 w-4" />{running ? "Splitting…" : `Split into ${plan.pieces.length || 0} file${plan.pieces.length === 1 ? "" : "s"}`}</Button>
					{running && <Button variant="danger" onClick={stop}><X className="h-4 w-4" />Stop</Button>}
					<span className="text-xs text-muted-foreground">Ctrl or Cmd + Enter</span>
				</div>
				{running && (
					<div className="mt-3 space-y-1">
						<Bar value={progress.done} max={progress.total} label="Split progress" />
						<p className="text-xs text-muted-foreground">{progress.done} of {progress.total} written{progress.name ? ` — ${progress.name}` : ""}</p>
					</div>
				)}
			</section>

			{/* result */}
			<section id="split-result" className={BOX} aria-labelledby="split-result-h">
				<h2 id="split-result-h" className="mb-2 text-sm font-semibold">Result</h2>
				{result.cancelled && <p className="text-sm text-muted-foreground">Stopped before finishing. Nothing was written.</p>}
				{result.error && <p className="text-sm text-destructive">{result.error}</p>}
				{result.pieces.length === 0 && !result.error && !result.cancelled && <p className="text-sm text-muted-foreground">Nothing yet. Add a PDF, choose how to split it, and run.</p>}

				{result.pieces.length > 0 && (
					<>
						<dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
							<div><dt className="text-xs text-muted-foreground">Files</dt><dd className="text-sm font-medium">{result.pieces.length}</dd></div>
							<div><dt className="text-xs text-muted-foreground">Pages written</dt><dd className="text-sm font-medium">{result.pieces.reduce((n, p) => n + p.pageCount, 0)} of {src.pageCount}</dd></div>
							<div><dt className="text-xs text-muted-foreground">Total size</dt><dd className="text-sm font-medium">{formatBytes(result.totalBytes)}</dd></div>
							<div><dt className="text-xs text-muted-foreground">Took</dt><dd className="text-sm font-medium">{formatDuration(result.elapsedMs)}</dd></div>
						</dl>

						<div className="mt-3 overflow-x-auto">
							<table className="w-full text-left text-xs">
								<caption className="sr-only">Files produced, in order</caption>
								<thead className="text-muted-foreground"><tr><th scope="col" className="py-1 pr-3">Name</th><th scope="col" className="py-1 pr-3">Pages</th><th scope="col" className="py-1 pr-3">Size</th><th scope="col" className="py-1">Take it</th></tr></thead>
								<tbody>
									{shown.map((p, i) => (
										<tr key={p.name} className="border-t">
											<th scope="row" className="py-1 pr-3 font-mono font-normal">{p.name}</th>
											<td className="py-1 pr-3">{p.pages} ({p.pageCount})</td>
											<td className="py-1 pr-3">{formatBytes(p.bytes)}</td>
											<td className="py-1">
												<span className="flex gap-1">
													<IconButton label={`Download ${p.name}`} onClick={() => downloadFile(p.blob, p.name, "application/pdf")}><Download className="h-3.5 w-3.5" /></IconButton>
													<IconButton label={`Open ${p.name} in a new tab`} onClick={() => openPiece(i)}><Link2 className="h-3.5 w-3.5" /></IconButton>
												</span>
											</td>
										</tr>
									))}
								</tbody>
							</table>
						</div>
						{result.pieces.length > RENDER_LIMIT && <p className="mt-2 text-xs text-muted-foreground">Showing {RENDER_LIMIT} of {result.pieces.length}. The zip contains all of them.</p>}

						{result.skipped.length > 0 && (
							<div className="mt-3 rounded-md border border-destructive bg-destructive/5 p-3">
								<p className="mb-1 text-xs font-medium text-destructive">Skipped</p>
								<ul className="list-inside list-disc space-y-0.5 text-xs text-destructive">{result.skipped.map((m, i) => <li key={i}>{m}</li>)}</ul>
							</div>
						)}

						<div className="mt-3 flex flex-wrap gap-2">
							<Button onClick={() => void downloadZip()} disabled={zipping}><Download className="h-4 w-4" />{zipping ? "Building the zip…" : `Download all as ${zipName}`}</Button>
							<Button variant="ghost" onClick={() => downloadFile(buildReceipt(src, opts, plan, result), `split-receipt-${stamp()}.txt`, "text/plain")}><Download className="h-4 w-4" />Receipt</Button>
							<Button variant="ghost" onClick={() => downloadFile(piecesToCsv(result), `split-files-${stamp()}.csv`, "text/csv")}><Download className="h-4 w-4" />CSV</Button>
							<Button variant="ghost" onClick={() => downloadFile(buildJsonSummary(src, opts, plan, result), `split-summary-${stamp()}.json`, "application/json")}><Download className="h-4 w-4" />JSON</Button>
							<Button variant="ghost" onClick={() => { void copyToClipboard(buildReceipt(src, opts, plan, result)); setLive("Receipt copied.") }}><Copy className="h-4 w-4" />Copy receipt</Button>
						</div>
						<p className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground"><Check className="h-3.5 w-3.5" />Page accounting {plan.reconciles ? "reconciles with the original document." : "does not reconcile — see the notes above."}</p>
					</>
				)}
			</section>

			{/* help */}
			<section className={BOX} aria-labelledby="split-help-h">
				<h2 id="split-help-h" className="mb-2 text-sm font-semibold">How to use this</h2>
				<ol className="list-inside list-decimal space-y-1 text-sm text-muted-foreground">{HOW_TO.map((s) => <li key={s.name}><span className="text-foreground">{s.name}.</span> {s.text}</li>)}</ol>
				<h3 className="mt-4 mb-2 text-sm font-semibold">Questions</h3>
				<dl className="space-y-2">{FAQ.map((f) => <div key={f.question}><dt className="text-sm font-medium">{f.question}</dt><dd className="text-sm text-muted-foreground">{f.answer}</dd></div>)}</dl>
				<h3 className="mt-4 mb-2 text-sm font-semibold">What this tool assumes</h3>
				<ul className="list-inside list-disc space-y-1 text-sm text-muted-foreground">{ASSUMPTIONS.map((a) => <li key={a}>{a}</li>)}</ul>
				<h3 className="mt-4 mb-2 text-sm font-semibold">Related tools</h3>
				<ul className="space-y-1 text-sm">{RELATED.map((r) => <li key={r.id}><a href={`/tools/${r.id}`} className={`underline ${FOCUS} rounded`}>{r.label}</a> <span className="text-muted-foreground">— {r.why}</span></li>)}</ul>
				<p className="mt-3 text-xs text-muted-foreground">Also known as: {ALIASES.join(", ")}.</p>
			</section>

			{/* privacy */}
			<section className={BOX} aria-labelledby="split-privacy-h">
				<h2 id="split-privacy-h" className="mb-1 flex items-center gap-1.5 text-sm font-semibold"><ShieldCheck className="h-4 w-4" />Your document stays here</h2>
				<p className="text-xs text-muted-foreground">The split runs entirely in this tab. There is no upload, no tracking and no network request in this tool, and it works offline. Your document is held in memory only while the split runs and is never stored. Only your settings are remembered in this browser.</p>
				<div className="mt-2"><Button variant="danger" onClick={() => { clearAllStorage(); history.clearAll(); setSaved([]); setOpts(DEFAULT_SPLIT_OPTIONS); setLive("Everything this tool had stored has been deleted.") }}><Trash2 className="h-4 w-4" />Delete everything this tool stored</Button></div>
			</section>

			<Dialog open={showKeys} title="Keyboard shortcuts" onClose={() => setShowKeys(false)}>
				<dl className="space-y-1 text-sm">{SHORTCUTS.map((s) => <div key={s.keys} className="flex justify-between gap-4"><dt className="font-mono text-xs">{s.keys}</dt><dd className="text-muted-foreground">{s.label}</dd></div>)}</dl>
			</Dialog>

			<Dialog open={showHistory} title="Recent settings" onClose={() => setShowHistory(false)}>
				<p className="mb-2 text-xs text-muted-foreground">Settings only. Your documents are never stored, and nothing is applied until you choose it.</p>
				{history.entries.length === 0 ? <p className="text-sm text-muted-foreground">Nothing here yet.</p> : (
					<ul className="space-y-1">
						{history.entries.map((h) => (
							<li key={h.id} className="flex items-center gap-2 rounded-md border p-2">
								<button type="button" onClick={() => { setOpts(h.options); setShowHistory(false); setLive("Settings restored.") }} className={`min-w-0 flex-1 text-left text-xs ${FOCUS} rounded`}>
									<span className="block truncate">{h.summary}</span>
									<span className="text-muted-foreground">{new Date(h.at).toLocaleString()}</span>
								</button>
								<IconButton label={h.pinned ? "Unpin" : "Pin"} onClick={() => history.togglePin(h.id)}><Pin className={`h-3.5 w-3.5 ${h.pinned ? "text-primary" : ""}`} /></IconButton>
								<IconButton label="Remove" onClick={() => history.remove(h.id)}><X className="h-3.5 w-3.5" /></IconButton>
							</li>
						))}
					</ul>
				)}
			</Dialog>

			<script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({
				"@context": "https://schema.org",
				"@graph": [
					{ "@type": "FAQPage", mainEntity: FAQ.map((f) => ({ "@type": "Question", name: f.question, acceptedAnswer: { "@type": "Answer", text: f.answer } })) },
					{ "@type": "HowTo", name: "How to split a PDF in your browser", step: HOW_TO.map((s) => ({ "@type": "HowToStep", name: s.name, text: s.text })) },
				],
			}) }} />
		</div>
	)
}
