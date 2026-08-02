"use client"

/**
 * Compress PDF — interface half of the 100x rebuild.
 *
 * Copy to: src/tools/pdf/pdf-compress/ui.tsx
 * Requires: CODE-1-ENGINE.ts -> src/tools/pdf/pdf-compress/logic.ts
 *
 * Imports only react, lucide-react and ./logic. No project imports, so this drops
 * in without touching anything in _shared or components/ui.
 *
 * The two things this interface is built around: you can see what is inside your
 * document before you run, and you are told the truth about the result afterwards
 * — including when the answer is "this did not get smaller, here is your original
 * back".
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { AlertTriangle, Check, Copy, Download, FileUp, Info, Keyboard, Lightbulb, RotateCcw, ShieldCheck, Trash2, X } from "lucide-react"
import {
	ALIASES, ASSUMPTIONS, DEFAULT_COMPRESS_OPTIONS, EMPTY_BATCH, FAQ, HOW_TO, MAX_FILES, MAX_PRESETS, PRESETS, RELATED, RENDER_LIMIT, SHORTCUTS, STATUS_LABEL,
	buildJsonSummary, buildReceipt, clearAllStorage, compressPdfs, copyToClipboard, describePages, downloadFile, forecast, formatBytes, formatDuration,
	inspectFile, parsePageRange, planWarnings, resultsToCsv, stamp, useHistory, usePersisted, zipResults,
	type BatchResult, type CompressOptions, type FileEntry, type OneResult,
} from "./logic"

const FOCUS = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
const BOX = "rounded-lg border bg-card p-4"
const CHIP = `inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs transition-colors hover:bg-muted ${FOCUS}`
const INPUT = `w-full rounded-md border bg-background px-3 py-2 text-sm ${FOCUS}`

function Button({ children, onClick, variant = "primary", disabled, type = "button", title, id }: { children: React.ReactNode; onClick?: () => void; variant?: "primary" | "ghost" | "danger"; disabled?: boolean; type?: "button" | "submit"; title?: string; id?: string }) {
	const styles = variant === "primary" ? "bg-primary text-primary-foreground hover:opacity-90" : variant === "danger" ? "border border-destructive/40 text-destructive hover:bg-destructive/10" : "border hover:bg-muted"
	return <button id={id} type={type} onClick={onClick} disabled={disabled} title={title} className={`inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${styles} ${FOCUS}`}>{children}</button>
}

function IconButton({ label, onClick, children, disabled }: { label: string; onClick: () => void; children: React.ReactNode; disabled?: boolean }) {
	return <button type="button" aria-label={label} title={label} onClick={onClick} disabled={disabled} className={`inline-flex h-8 w-8 items-center justify-center rounded-md border transition-colors hover:bg-muted disabled:opacity-40 ${FOCUS}`}>{children}</button>
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

export default function CompressPDF() {
	const [entries, setEntries] = useState<FileEntry[]>([])
	const [opts, setOpts] = usePersisted<CompressOptions>("options", DEFAULT_COMPRESS_OPTIONS)
	const [presets, setPresets] = usePersisted<Array<{ id: string; label: string; values: CompressOptions }>>("presets", [])
	const [result, setResult] = useState<BatchResult>(EMPTY_BATCH)
	const [running, setRunning] = useState(false)
	const [progress, setProgress] = useState({ done: 0, total: 0, name: "" })
	const [announce, setAnnounce] = useState("")
	const [showKeys, setShowKeys] = useState(false)
	const [showHistory, setShowHistory] = useState(false)
	const [expanded, setExpanded] = useState<string | null>(null)
	const [targetMb, setTargetMb] = useState(0)
	const cancelled = useRef(false)
	const pickerRef = useRef<HTMLInputElement>(null)
	const urlsRef = useRef<string[]>([])
	const history = useHistory()

	const set = useCallback(<K extends keyof CompressOptions>(key: K, value: CompressOptions[K]) => { setOpts({ ...opts, [key]: value }) }, [opts, setOpts])

	/** The options actually used for a run, including the target typed in megabytes. */
	const effectiveOptions = useMemo<CompressOptions>(() => ({ ...opts, targetBytes: Math.round(targetMb * 1024 * 1024) }), [opts, targetMb])

	const revokeAll = useCallback(() => {
		for (const url of urlsRef.current) URL.revokeObjectURL(url)
		urlsRef.current = []
	}, [])
	useEffect(() => revokeAll, [revokeAll])

	const ready = useMemo(() => entries.filter((e) => e.status === "ready"), [entries])
	const plan = useMemo(() => planWarnings(entries, opts), [entries, opts])
	const forecasts = useMemo(() => ready.slice(0, RENDER_LIMIT).map((e) => ({ name: e.name, notes: forecast(e, opts) })), [ready, opts])
	const removeError = useMemo(() => {
		if (opts.removePages.trim().length === 0) return ""
		const first = ready[0]
		if (!first) return ""
		return parsePageRange(opts.removePages, first.info.pageCount).errors[0] ?? ""
	}, [opts.removePages, ready])

	const addFiles = useCallback(async (list: FileList | File[]) => {
		const incoming = Array.from(list).slice(0, MAX_FILES)
		if (incoming.length === 0) return
		setAnnounce(`Reading ${incoming.length} file${incoming.length === 1 ? "" : "s"}.`)
		const inspected = await Promise.all(incoming.map((f) => inspectFile(f)))
		setEntries((prev) => [...prev, ...inspected])
		const good = inspected.filter((e) => e.status === "ready").length
		setAnnounce(`Added ${good} of ${inspected.length} file${inspected.length === 1 ? "" : "s"}. ${inspected.length - good} could not be used.`)
	}, [])

	const clearAll = useCallback(() => {
		revokeAll()
		setEntries([])
		setResult(EMPTY_BATCH)
		setProgress({ done: 0, total: 0, name: "" })
		setAnnounce("Queue and results cleared.")
	}, [revokeAll])

	const run = useCallback(async () => {
		if (plan.errors.length > 0 || ready.length === 0 || running) return
		revokeAll()
		cancelled.current = false
		setRunning(true)
		setResult(EMPTY_BATCH)
		setProgress({ done: 0, total: ready.length, name: "" })
		setAnnounce(`Compressing ${ready.length} file${ready.length === 1 ? "" : "s"}.`)
		const out = await compressPdfs(entries, effectiveOptions, (done, total, name) => setProgress({ done, total, name }), () => cancelled.current)
		setResult(out)
		setRunning(false)
		if (out.error) setAnnounce(out.error)
		else {
			const pct = out.totalBefore > 0 ? ((out.totalBefore - out.totalAfter) / out.totalBefore) * 100 : 0
			const kept = out.files.filter((f) => f.usedOriginal).length
			setAnnounce(`${out.files.length} file${out.files.length === 1 ? "" : "s"} done in ${formatDuration(out.elapsedMs)}. Saved ${formatBytes(out.totalBefore - out.totalAfter)}, ${pct.toFixed(1)} percent.${kept > 0 ? ` ${kept} did not get smaller, so the original was kept.` : ""}`)
			history.add(effectiveOptions, `${out.files.length} file${out.files.length === 1 ? "" : "s"}, saved ${formatBytes(out.totalBefore - out.totalAfter)}`)
		}
	}, [entries, effectiveOptions, plan.errors.length, ready.length, running, revokeAll, history])

	const downloadOne = useCallback((f: OneResult) => { downloadFile(f.blob, f.outName, "application/pdf") }, [])

	const openOne = useCallback((f: OneResult) => {
		const url = URL.createObjectURL(f.blob)
		urlsRef.current.push(url)
		window.open(url, "_blank", "noopener")
	}, [])

	const downloadZip = useCallback(async () => {
		if (result.files.length === 0) return
		setAnnounce("Building the zip.")
		const blob = await zipResults(result.files)
		downloadFile(blob, `compressed-${stamp()}.zip`, "application/zip")
		setAnnounce(`Zip ready, ${formatBytes(blob.size)}.`)
	}, [result.files])

	const downloadEach = useCallback(() => { for (const f of result.files) downloadOne(f) }, [result.files, downloadOne])

	const downloadAll = useCallback(() => {
		if (result.files.length === 0) return
		if (opts.zipOutput && result.files.length > 1) { void downloadZip(); return }
		downloadEach()
	}, [result.files.length, opts.zipOutput, downloadZip, downloadEach])

	const receipt = useCallback(() => buildReceipt(effectiveOptions, result), [effectiveOptions, result])

	useEffect(() => {
		const onKey = (e: KeyboardEvent) => {
			const mod = e.metaKey || e.ctrlKey
			if (mod && e.key === "Enter") { e.preventDefault(); void run() }
			else if (mod && e.key.toLowerCase() === "o") { e.preventDefault(); pickerRef.current?.click() }
			else if (mod && e.key.toLowerCase() === "s") { e.preventDefault(); downloadAll() }
			else if (mod && e.key === "Backspace") { e.preventDefault(); clearAll() }
			else if (e.key === "?" && !mod) { const t = e.target as HTMLElement; if (t.tagName !== "INPUT" && t.tagName !== "TEXTAREA") { e.preventDefault(); setShowKeys(true) } }
			else if (e.key === "Escape" && running) { cancelled.current = true; setAnnounce("Stopping.") }
		}
		window.addEventListener("keydown", onKey)
		return () => window.removeEventListener("keydown", onKey)
	}, [run, downloadAll, clearAll, running])

	const savedPct = result.totalBefore > 0 ? ((result.totalBefore - result.totalAfter) / result.totalBefore) * 100 : 0
	const jsonLd = useMemo(() => JSON.stringify({
		"@context": "https://schema.org",
		"@graph": [
			{ "@type": "FAQPage", mainEntity: FAQ.map((f) => ({ "@type": "Question", name: f.question, acceptedAnswer: { "@type": "Answer", text: f.answer } })) },
			{ "@type": "HowTo", name: "How to compress a PDF in your browser", step: HOW_TO.map((s) => ({ "@type": "HowToStep", name: s.name, text: s.text })) },
		],
	}), [])

	return (
		<div className="space-y-4">
			<a href="#compress-result" className={`sr-only focus:not-sr-only focus:absolute focus:rounded-md focus:border focus:bg-card focus:px-3 focus:py-2 focus:text-sm ${FOCUS}`}>Skip to results</a>
			<div aria-live="polite" aria-atomic="true" className="sr-only">{announce}</div>

			<div className={`${BOX} border-amber-500/40 bg-amber-500/5`}>
				<div className="flex items-start gap-2">
					<Info className="mt-0.5 h-4 w-4 flex-shrink-0 text-amber-600 dark:text-amber-500" />
					<p className="text-xs text-muted-foreground"><strong className="text-foreground">What this tool can and cannot do.</strong> It shrinks a PDF by rebuilding its structure and removing what you do not need — metadata, annotations, forms, JavaScript, attachments and pages. It does <strong className="text-foreground">not recompress or downsample images</strong>, which is not possible with the library available here. On a scanned document expect a small saving; removing pages will save far more. If a file does not get smaller, you will be told and given your original back.</p>
				</div>
			</div>

			<div className={BOX}
				onDragOver={(e) => { e.preventDefault() }}
				onDrop={(e) => { e.preventDefault(); void addFiles(e.dataTransfer.files) }}>
				<div className="flex flex-wrap items-center justify-between gap-2">
					<h2 className="text-sm font-semibold">Your PDFs {entries.length > 0 && <span className="font-normal text-muted-foreground">— {ready.length} ready of {entries.length}</span>}</h2>
					<div className="flex flex-wrap gap-2">
						<Button variant="ghost" onClick={() => pickerRef.current?.click()}><FileUp className="h-4 w-4" />Add PDFs</Button>
						<Button variant="ghost" onClick={clearAll} disabled={entries.length === 0}><Trash2 className="h-4 w-4" />Clear</Button>
					</div>
				</div>
				<input ref={pickerRef} id="compress-picker" type="file" accept="application/pdf,.pdf" multiple className="sr-only"
					onChange={(e) => { if (e.target.files) void addFiles(e.target.files); e.target.value = "" }} />
				{entries.length === 0 ? (
					<button type="button" onClick={() => pickerRef.current?.click()} className={`mt-3 flex w-full flex-col items-center gap-2 rounded-lg border-2 border-dashed p-8 text-center transition-colors hover:bg-muted/40 ${FOCUS}`}>
						<FileUp className="h-6 w-6 text-muted-foreground" />
						<span className="text-sm font-medium">Drop PDFs here, or click to choose</span>
						<span className="text-xs text-muted-foreground">Up to {MAX_FILES} files. Nothing is uploaded — it all happens in this tab.</span>
					</button>
				) : (
					<ul className="mt-3 space-y-2">
						{entries.slice(0, RENDER_LIMIT).map((e) => (
							<li key={e.id} className="rounded-md border p-2">
								<div className="flex flex-wrap items-center gap-2">
									<span className="min-w-0 flex-1 truncate text-sm" title={e.name}>{e.name}</span>
									<span className={`rounded-full px-2 py-0.5 text-xs ${e.status === "ready" ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400" : "bg-destructive/10 text-destructive"}`}>{STATUS_LABEL[e.status]}</span>
									<span className="text-xs text-muted-foreground">{formatBytes(e.size)}</span>
									{e.status === "ready" && <span className="text-xs text-muted-foreground">{e.info.pageCount} page{e.info.pageCount === 1 ? "" : "s"}</span>}
									{e.status === "ready" && <Button variant="ghost" onClick={() => setExpanded(expanded === e.id ? null : e.id)}>{expanded === e.id ? "Hide details" : "Details"}</Button>}
									<IconButton label={`Remove ${e.name}`} onClick={() => setEntries(entries.filter((x) => x.id !== e.id))}><X className="h-4 w-4" /></IconButton>
								</div>
								{e.statusDetail && <p className="mt-1 text-xs text-destructive">{e.statusDetail}</p>}
								{expanded === e.id && e.status === "ready" && (
									<dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 border-t pt-2 text-xs sm:grid-cols-3">
										<div><dt className="text-muted-foreground">Per page</dt><dd>{formatBytes(Math.round(e.size / Math.max(1, e.info.pageCount)))}</dd></div>
										<div><dt className="text-muted-foreground">Annotations</dt><dd>{e.info.annotations} ({e.info.links} link{e.info.links === 1 ? "" : "s"})</dd></div>
										<div><dt className="text-muted-foreground">Form fields</dt><dd>{e.info.formFields}</dd></div>
										<div><dt className="text-muted-foreground">Attachments</dt><dd>{e.info.attachments > 0 ? "yes" : "none found"}</dd></div>
										<div><dt className="text-muted-foreground">JavaScript</dt><dd>{e.info.hasJavaScript ? "yes" : "none found"}</dd></div>
										<div><dt className="text-muted-foreground">XMP metadata</dt><dd>{e.info.hasXmp ? "yes" : "none found"}</dd></div>
										<div><dt className="text-muted-foreground">Bookmarks</dt><dd>{e.info.hasOutline ? "yes" : "none found"}</dd></div>
										<div><dt className="text-muted-foreground">Blank pages</dt><dd>{e.info.blankPages.length > 0 ? describePages(e.info.blankPages) : "none found"}</dd></div>
										<div><dt className="text-muted-foreground">Page size</dt><dd>{e.info.mixedSizes ? "mixed" : `${e.info.pageSizes[0]?.width ?? 0}×${e.info.pageSizes[0]?.height ?? 0}`}</dd></div>
										{e.info.title && <div className="col-span-2"><dt className="text-muted-foreground">Title</dt><dd className="truncate">{e.info.title}</dd></div>}
										{e.info.producer && <div className="col-span-2"><dt className="text-muted-foreground">Producer</dt><dd className="truncate">{e.info.producer}</dd></div>}
									</dl>
								)}
							</li>
						))}
						{entries.length > RENDER_LIMIT && <li className="text-xs text-muted-foreground">Showing the first {RENDER_LIMIT} of {entries.length} files. All of them will be processed.</li>}
					</ul>
				)}
			</div>

			{ready.length > 0 && (
				<div className={BOX}>
					<h2 className="mb-2 text-sm font-semibold">How hard to compress</h2>
					<div className="flex flex-wrap gap-2">
						{PRESETS.map((p) => (
							<button key={p.id} type="button" title={p.description} onClick={() => setOpts({ ...opts, ...p.values })} className={CHIP}>{p.label}</button>
						))}
						{presets.map((p) => (
							<span key={p.id} className="inline-flex items-center gap-1">
								<button type="button" onClick={() => setOpts(p.values)} className={CHIP}>{p.label}</button>
								<IconButton label={`Delete preset ${p.label}`} onClick={() => setPresets(presets.filter((x) => x.id !== p.id))}><X className="h-3 w-3" /></IconButton>
							</span>
						))}
					</div>
					<p className="mt-2 text-xs text-muted-foreground">{PRESETS.map((p) => `${p.label}: ${p.description}`).join(" — ")}</p>

					<div className="mt-4 grid gap-4 border-t pt-4 sm:grid-cols-2">
						<div>
							<h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Structure</h3>
							<Toggle id="c-rebuild" label="Rebuild the document" hint="Copies the pages into a fresh file, dropping orphaned objects and old saved revisions." checked={opts.rebuild} onChange={(v) => set("rebuild", v)} cost={opts.rebuild && ready.some((e) => e.info.hasOutline) ? "A rebuild cannot carry bookmarks across." : undefined} />
							<Toggle id="c-objstream" label="Object-stream compression" hint="Lossless. Almost always worth leaving on." checked={opts.objectStreams} onChange={(v) => set("objectStreams", v)} />
							<Toggle id="c-meta" label="Remove document details" hint="Title, author, subject, keywords, producer, creator." checked={opts.stripMetadata} onChange={(v) => set("stripMetadata", v)} cost="You lose the document properties." />
							<Toggle id="c-xmp" label="Remove the XMP metadata stream" hint="Often larger than you would expect." checked={opts.stripXmp} onChange={(v) => set("stripXmp", v)} />
							<Toggle id="c-bookmarks" label="Keep bookmarks where possible" checked={opts.keepBookmarks} onChange={(v) => set("keepBookmarks", v)} />
						</div>
						<div>
							<h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">What to drop</h3>
							<Toggle id="c-annots" label="Drop annotations" hint="Comments, highlights, stamps." checked={opts.dropAnnotations} onChange={(v) => set("dropAnnotations", v)} cost="Links are annotations too, so they go as well." />
							<Toggle id="c-links" label="Drop links only" checked={opts.dropLinks} onChange={(v) => set("dropLinks", v)} cost="Clickable links stop working." />
							<Toggle id="c-flatten" label="Flatten form fields" hint="Fields still look right." checked={opts.flattenForms} onChange={(v) => set("flattenForms", v)} cost="They can no longer be filled in." />
							<Toggle id="c-forms" label="Remove form fields entirely" checked={opts.dropForms} onChange={(v) => set("dropForms", v)} cost="The fields disappear from the page." />
							<Toggle id="c-js" label="Remove embedded JavaScript" hint="Almost always safe, and sometimes a real saving." checked={opts.dropJavaScript} onChange={(v) => set("dropJavaScript", v)} />
							<Toggle id="c-attach" label="Remove attachments" hint="Files embedded inside the PDF." checked={opts.dropAttachments} onChange={(v) => set("dropAttachments", v)} cost="Those files are gone from the copy." />
						</div>
					</div>

					<div className="mt-4 grid gap-4 border-t pt-4 sm:grid-cols-2">
						<Field id="c-removepages" label="Pages to remove" hint="The biggest saving available. For example 1, 5-8. Use -1 for the last page." error={removeError}>
							<input id="c-removepages" type="text" value={opts.removePages} onChange={(e) => set("removePages", e.target.value)} placeholder="leave empty to keep every page" className={INPUT} aria-invalid={removeError.length > 0} aria-describedby={removeError ? "c-removepages-error" : "c-removepages-hint"} />
						</Field>
						<Num id="c-target" label="Target size, if you have one" hint="0 means no target. You will be told honestly whether it was reached." value={targetMb} onChange={setTargetMb} min={0} step={0.5} suffix="MB" />
						<Field id="c-pattern" label="Name the results" hint="{name}, {date}, {saved}, {percent}">
							<input id="c-pattern" type="text" value={opts.namePattern} onChange={(e) => set("namePattern", e.target.value)} className={INPUT} aria-describedby="c-pattern-hint" />
						</Field>
						<div>
							<Toggle id="c-blank" label="Remove blank pages that were found" checked={opts.removeBlankPages} onChange={(v) => set("removeBlankPages", v)} />
							<Toggle id="c-zip" label="Give me one zip when there is more than one file" checked={opts.zipOutput} onChange={(v) => set("zipOutput", v)} />
							<Toggle id="c-keepbigger" label="Keep the result even if it is bigger" hint="Off by default: if compressing makes a file larger, your original is kept instead." checked={opts.keepIfBigger} onChange={(v) => set("keepIfBigger", v)} />
						</div>
					</div>

					<div className="mt-3 flex flex-wrap gap-2 border-t pt-3">
						<Button variant="ghost" onClick={() => { const label = `Preset ${presets.length + 1}`; setPresets([...presets, { id: `${Date.now()}`, label, values: opts }].slice(0, MAX_PRESETS)); setAnnounce(`Saved these settings as ${label}.`) }}><Check className="h-4 w-4" />Save these settings</Button>
						<Button variant="ghost" onClick={() => { setOpts(DEFAULT_COMPRESS_OPTIONS); setTargetMb(0); setAnnounce("Settings reset.") }}><RotateCcw className="h-4 w-4" />Reset</Button>
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

			{(plan.warnings.length > 0 || forecasts.some((f) => f.notes.length > 0)) && (
				<div className={BOX}>
					<div className="flex items-start gap-2">
						<Lightbulb className="mt-0.5 h-4 w-4 flex-shrink-0 text-muted-foreground" />
						<div className="min-w-0">
							<h2 className="text-sm font-semibold">Before you run</h2>
							{plan.warnings.length > 0 && <ul className="mt-1 space-y-1 text-sm text-muted-foreground">{plan.warnings.map((m, i) => <li key={i}>{m}</li>)}</ul>}
							{forecasts.filter((f) => f.notes.length > 0).map((f) => (
								<div key={f.name} className="mt-2">
									<p className="truncate text-xs font-medium">{f.name}</p>
									<ul className="space-y-1 text-sm text-muted-foreground">{f.notes.map((m, i) => <li key={i}>{m}</li>)}</ul>
								</div>
							))}
						</div>
					</div>
				</div>
			)}

			{ready.length > 0 && (
				<div className={`${BOX} flex flex-wrap items-center gap-3`}>
					<Button onClick={() => void run()} disabled={running || plan.errors.length > 0}>{running ? "Compressing…" : `Compress ${ready.length} file${ready.length === 1 ? "" : "s"}`}</Button>
					{running && <Button variant="danger" onClick={() => { cancelled.current = true; setAnnounce("Stopping.") }}>Stop</Button>}
					{running && progress.total > 0 && <div className="min-w-[200px] flex-1"><Bar value={(progress.done / progress.total) * 100} label={`${progress.done} of ${progress.total} done${progress.name ? ` — ${progress.name}` : ""}`} /></div>}
					{!running && <span className="text-xs text-muted-foreground">Total in: {formatBytes(ready.reduce((n, e) => n + e.size, 0))}</span>}
				</div>
			)}

			<div id="compress-result">
				{result.cancelled && <div className={BOX}><p className="text-sm">Stopped. {result.files.length} file{result.files.length === 1 ? "" : "s"} finished before you stopped, and they are below.</p></div>}
				{result.error && <div className={`${BOX} border-destructive/40 bg-destructive/5`} role="alert"><p className="text-sm text-destructive">{result.error}</p></div>}
				{result.files.length > 0 && (
					<div className={`${BOX} space-y-4`}>
						<dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
							<div><dt className="text-xs text-muted-foreground">Files</dt><dd className="text-lg font-semibold">{result.files.length}</dd></div>
							<div><dt className="text-xs text-muted-foreground">Before</dt><dd className="text-lg font-semibold">{formatBytes(result.totalBefore)}</dd></div>
							<div><dt className="text-xs text-muted-foreground">After</dt><dd className="text-lg font-semibold">{formatBytes(result.totalAfter)}</dd></div>
							<div><dt className="text-xs text-muted-foreground">Saved</dt><dd className={`text-lg font-semibold ${savedPct > 0 ? "text-emerald-600 dark:text-emerald-400" : ""}`}>{formatBytes(result.totalBefore - result.totalAfter)} ({savedPct.toFixed(1)}%)</dd></div>
						</dl>
						<p className="text-xs text-muted-foreground">Took {formatDuration(result.elapsedMs)}. These are real file sizes in bytes, before and after.</p>

						<div className="overflow-x-auto">
							<table className="w-full text-sm">
								<caption className="pb-2 text-left text-xs text-muted-foreground">Every file, with what it actually saved</caption>
								<thead><tr className="border-b text-left text-xs text-muted-foreground"><th scope="col" className="py-1 pr-2">File</th><th scope="col" className="py-1 pr-2">Before</th><th scope="col" className="py-1 pr-2">After</th><th scope="col" className="py-1 pr-2">Saved</th><th scope="col" className="py-1 pr-2">Pages</th><th scope="col" className="py-1 pr-2">Get it</th></tr></thead>
								<tbody>
									{result.files.map((f) => (
										<tr key={f.id} className="border-b align-top last:border-0">
											<th scope="row" className="max-w-[220px] py-2 pr-2 text-left font-normal">
												<span className="block truncate" title={f.outName}>{f.outName}</span>
												<span className="block text-xs text-muted-foreground">{f.note}</span>
												{f.removed.length > 0 && <span className="block text-xs text-muted-foreground">Removed: {f.removed.join("; ")}</span>}
												{f.usedOriginal && <span className="mt-1 inline-block rounded-full bg-amber-500/10 px-2 py-0.5 text-xs text-amber-700 dark:text-amber-400">Your original was kept</span>}
												{f.hitTarget === true && <span className="mt-1 ml-1 inline-block rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs text-emerald-700 dark:text-emerald-400">Target reached</span>}
											</th>
											<td className="py-2 pr-2 text-xs">{formatBytes(f.before)}</td>
											<td className="py-2 pr-2 text-xs">{formatBytes(f.after)}</td>
											<td className={`py-2 pr-2 text-xs ${f.saved > 0 ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground"}`}>{f.saved > 0 ? `${formatBytes(f.saved)} (${f.percent.toFixed(1)}%)` : "nothing"}</td>
											<td className="py-2 pr-2 text-xs">{f.pagesBefore === f.pagesAfter ? f.pagesAfter : `${f.pagesBefore} → ${f.pagesAfter}`}</td>
											<td className="py-2 pr-2">
												<div className="flex gap-1">
													<IconButton label={`Download ${f.outName}`} onClick={() => downloadOne(f)}><Download className="h-4 w-4" /></IconButton>
													<IconButton label={`Open ${f.outName} in a new tab`} onClick={() => openOne(f)}><FileUp className="h-4 w-4" /></IconButton>
												</div>
											</td>
										</tr>
									))}
								</tbody>
							</table>
						</div>

						{result.skipped.length > 0 && (
							<div className="rounded-md border border-destructive/40 bg-destructive/5 p-3">
								<h3 className="text-sm font-semibold text-destructive">Skipped</h3>
								<ul className="mt-1 space-y-1 text-sm">{result.skipped.map((m, i) => <li key={i}>{m}</li>)}</ul>
							</div>
						)}

						<div className="flex flex-wrap gap-2 border-t pt-3">
							{result.files.length > 1 && <Button onClick={() => void downloadZip()}><Download className="h-4 w-4" />Download all as a zip</Button>}
							{result.files.length > 1 && <Button variant="ghost" onClick={downloadEach}>Download each separately</Button>}
							{result.files.length === 1 && <Button onClick={downloadEach}><Download className="h-4 w-4" />Download the PDF</Button>}
							<Button variant="ghost" onClick={() => downloadFile(receipt(), `compress-receipt-${stamp()}.txt`, "text/plain")}>Receipt</Button>
							<Button variant="ghost" onClick={() => downloadFile(resultsToCsv(result), `compress-results-${stamp()}.csv`, "text/csv")}>CSV</Button>
							<Button variant="ghost" onClick={() => downloadFile(buildJsonSummary(effectiveOptions, result), `compress-summary-${stamp()}.json`, "application/json")}>JSON</Button>
							<Button variant="ghost" onClick={() => { void copyToClipboard(receipt()).then(() => setAnnounce("Receipt copied.")) }}><Copy className="h-4 w-4" />Copy receipt</Button>
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
						<p className="text-xs text-muted-foreground"><strong className="text-foreground">Your documents stay with you.</strong> Every step runs in this tab. There is no upload, no network request and no tracking, and it works offline. Your PDF is held in memory only while it is being worked on and is never stored. Only your settings are remembered in this browser, never your files. Your original is only ever read, never changed.</p>
					</div>
					<Button variant="ghost" onClick={() => { clearAllStorage(); setOpts(DEFAULT_COMPRESS_OPTIONS); history.clearAll(); setPresets([]); setAnnounce("Everything this tool had stored has been deleted.") }}><Trash2 className="h-4 w-4" />Delete stored settings</Button>
				</div>
			</div>

			<Dialog open={showKeys} onClose={() => setShowKeys(false)} title="Keyboard shortcuts">
				<ul className="space-y-1 text-sm">{SHORTCUTS.map((s) => <li key={s.keys} className="flex justify-between gap-4"><span className="text-muted-foreground">{s.label}</span><kbd className="rounded border px-1.5 py-0.5 text-xs">{s.keys}</kbd></li>)}</ul>
			</Dialog>

			<Dialog open={showHistory} onClose={() => setShowHistory(false)} title="Recent settings">
				<p className="mb-2 text-xs text-muted-foreground">Settings only. Your documents are never stored, and nothing here is applied until you choose it.</p>
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
