"use client"

/**
 * Merge PDF — interface half of the 100x rebuild.
 *
 * Copy to: src/tools/pdf/pdf-merge/ui.tsx
 * Pair with: CODE-1-ENGINE.ts -> src/tools/pdf/pdf-merge/logic.ts
 *
 * Imports only react, lucide-react and ./logic. No project imports, no
 * @/components/ui, nothing from _shared. Zero new dependencies.
 *
 * Replaces a text area that echoed your typing back at you. This is a real file
 * queue with ordering, page selection and a genuine PDF download.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
	AlertTriangle, ArrowDown, ArrowDownUp, ArrowUp, Check, ChevronRight, Copy, Download,
	Eraser, FileUp, Info, Keyboard, Lightbulb, Pin, RotateCcw, ShieldCheck, SquareStack, Trash2, X,
} from "lucide-react"
import {
	ASSUMPTIONS, DEFAULT_MERGE_OPTIONS, EMPTY_OUTCOME, FAQ, HOW_TO, MAX_FILES, MAX_FILE_BYTES,
	MAX_TOTAL_BYTES, PRESETS, RELATED, RENDER_LIMIT, SHORTCUTS, SORT_KEYS, STATUS_LABEL,
	buildJsonSummary, buildPlan, buildReceipt, byteStats, clearAllStorage, describePages, downloadFile,
	formatBytes, formatDuration, inspectFile, mergePdfs, moveEntry, randomId, resolvePages, safeFileName,
	sortEntries, stamp, useHistory, usePersisted,
	type FileEntry, type MergeOptions, type MergeOutcome, type PageFilter, type Rotation,
	type SizeSource, type SortKey,
} from "./logic"

const FOCUS = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
const BOX = "rounded-lg border bg-card p-4"
const CHIP = `inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs transition-colors hover:bg-accent ${FOCUS}`
const INPUT = `w-full rounded-md border bg-background px-3 py-2 text-sm ${FOCUS}`

function Button({ children, onClick, variant = "ghost", disabled, title, type = "button", full }: { children: React.ReactNode; onClick?: () => void; variant?: "primary" | "ghost" | "danger"; disabled?: boolean; title?: string; type?: "button" | "submit"; full?: boolean }) {
	const tone = variant === "primary" ? "bg-primary text-primary-foreground hover:opacity-90" : variant === "danger" ? "border border-destructive/40 text-destructive hover:bg-destructive/10" : "border hover:bg-accent"
	return <button type={type} onClick={onClick} disabled={disabled} title={title} className={`inline-flex items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${tone} ${full ? "w-full" : ""} ${FOCUS}`}>{children}</button>
}

function IconButton({ children, onClick, label, disabled }: { children: React.ReactNode; onClick: () => void; label: string; disabled?: boolean }) {
	return <button type="button" onClick={onClick} disabled={disabled} aria-label={label} title={label} className={`inline-flex h-7 w-7 items-center justify-center rounded-md border transition-colors hover:bg-accent disabled:cursor-not-allowed disabled:opacity-40 ${FOCUS}`}>{children}</button>
}

function Toggle({ id, checked, onChange, label, hint }: { id: string; checked: boolean; onChange: (v: boolean) => void; label: string; hint?: string }) {
	return (
		<div className="flex items-start gap-2">
			<input id={id} type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className={`mt-0.5 h-4 w-4 rounded border ${FOCUS}`} aria-describedby={hint ? `${id}-hint` : undefined} />
			<div className="min-w-0">
				<label htmlFor={id} className="block text-sm">{label}</label>
				{hint ? <p id={`${id}-hint`} className="text-xs text-muted-foreground">{hint}</p> : null}
			</div>
		</div>
	)
}

function Field({ id, label, value, onChange, placeholder, hint, invalid }: { id: string; label: string; value: string; onChange: (v: string) => void; placeholder?: string; hint?: string; invalid?: string }) {
	return (
		<div className="space-y-1">
			<label htmlFor={id} className="block text-xs font-medium">{label}</label>
			<input id={id} type="text" value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} className={INPUT} aria-invalid={invalid ? true : undefined} aria-describedby={invalid ? `${id}-err` : hint ? `${id}-hint` : undefined} />
			{invalid ? <p id={`${id}-err`} className="text-xs text-destructive">{invalid}</p> : hint ? <p id={`${id}-hint`} className="text-xs text-muted-foreground">{hint}</p> : null}
		</div>
	)
}

function Select<T extends string>({ id, label, value, onChange, options }: { id: string; label: string; value: T; onChange: (v: T) => void; options: ReadonlyArray<{ v: T; label: string }> }) {
	return (
		<div className="space-y-1">
			<label htmlFor={id} className="block text-xs font-medium">{label}</label>
			<select id={id} value={value} onChange={(e) => onChange(e.target.value as T)} className={INPUT}>
				{options.map((o) => <option key={o.v} value={o.v}>{o.label}</option>)}
			</select>
		</div>
	)
}

function Dialog({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: React.ReactNode }) {
	const ref = useRef<HTMLDivElement>(null)
	const opener = useRef<Element | null>(null)
	useEffect(() => {
		if (!open) return
		opener.current = document.activeElement
		const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") { e.stopPropagation(); onClose() } }
		document.addEventListener("keydown", onKey)
		ref.current?.focus()
		return () => {
			document.removeEventListener("keydown", onKey)
			if (opener.current instanceof HTMLElement) opener.current.focus()
		}
	}, [open, onClose])
	if (!open) return null
	return (
		<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose} role="presentation">
			<div ref={ref} tabIndex={-1} role="dialog" aria-modal="true" aria-label={title} onClick={(e) => e.stopPropagation()} className={`max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-lg border bg-card p-4 ${FOCUS}`}>
				<div className="mb-3 flex items-center justify-between gap-2">
					<h2 className="text-sm font-semibold">{title}</h2>
					<IconButton onClick={onClose} label="Close"><X className="h-4 w-4" /></IconButton>
				</div>
				{children}
			</div>
		</div>
	)
}

function Bar({ value, max, label }: { value: number; max: number; label: string }) {
	const pct = max > 0 ? Math.round((value / max) * 100) : 0
	return (
		<div className="space-y-1">
			<div className="h-2 w-full overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuenow={value} aria-valuemin={0} aria-valuemax={max} aria-label={label}>
				<div className="h-full bg-primary transition-all" style={{ width: `${pct}%` }} />
			</div>
			<p className="text-xs text-muted-foreground">{label}</p>
		</div>
	)
}

const STATUS_TONE: Record<string, string> = {
	ready: "text-emerald-600", pending: "text-muted-foreground", notPdf: "text-destructive",
	encrypted: "text-amber-600", corrupt: "text-destructive", tooLarge: "text-destructive",
}

export default function MergePDF() {
	const [entries, setEntries] = useState<FileEntry[]>([])
	const [options, setOptions] = usePersisted<MergeOptions>("options", DEFAULT_MERGE_OPTIONS)
	const [outcome, setOutcome] = useState<MergeOutcome>(EMPTY_OUTCOME)
	const [running, setRunning] = useState(false)
	const [progress, setProgress] = useState({ done: 0, total: 0, name: "" })
	const [reading, setReading] = useState(false)
	const [live, setLive] = useState("")
	const [sortKey, setSortKey] = useState<SortKey>("added")
	const [sortDesc, setSortDesc] = useState(false)
	const [dragOver, setDragOver] = useState(false)
	const [dragId, setDragId] = useState<string | null>(null)
	const [expanded, setExpanded] = useState<string | null>(null)
	const [showShortcuts, setShowShortcuts] = useState(false)
	const [showHistory, setShowHistory] = useState(false)
	const [presetName, setPresetName] = useState("")
	const [savedPresets, setSavedPresets] = usePersisted<Array<{ id: string; label: string; values: MergeOptions }>>("presets", [])
	const cancelRef = useRef(false)
	const urlRef = useRef<string | null>(null)
	const pickerRef = useRef<HTMLInputElement>(null)
	const history = useHistory()

	const set = useCallback(<K extends keyof MergeOptions>(k: K, v: MergeOptions[K]) => { setOptions({ ...options, [k]: v }) }, [options, setOptions])
	const patch = useCallback((id: string, changes: Partial<FileEntry>) => { setEntries((prev) => prev.map((e) => (e.id === id ? { ...e, ...changes } : e))) }, [])

	/* Revoke the object URL from the previous result. The old tool leaked one per download. */
	useEffect(() => () => { if (urlRef.current) URL.revokeObjectURL(urlRef.current) }, [])

	const addFiles = useCallback(async (list: FileList | File[]) => {
		const incoming = Array.from(list).filter((f) => f.size > 0)
		if (incoming.length === 0) return
		setReading(true)
		setLive(`Reading ${incoming.length} file${incoming.length === 1 ? "" : "s"}…`)
		const room = MAX_FILES - entries.length
		const taken = incoming.slice(0, Math.max(0, room))
		const rejected = incoming.length - taken.length
		const inspected: FileEntry[] = []
		for (const file of taken) inspected.push(await inspectFile(file, randomId(10)))
		setEntries((prev) => [...prev, ...inspected])
		setReading(false)
		const ok = inspected.filter((e) => e.status === "ready").length
		setLive(`Added ${ok} PDF${ok === 1 ? "" : "s"}${inspected.length - ok > 0 ? `, ${inspected.length - ok} could not be used` : ""}${rejected > 0 ? `, ${rejected} left out because the limit is ${MAX_FILES} files` : ""}.`)
	}, [entries.length])

	const plan = useMemo(() => buildPlan(entries, options), [entries, options])
	const totalBytes = useMemo(() => entries.reduce((n, e) => n + (e.status === "ready" && !e.skip ? e.size : 0), 0), [entries])
	const sizes = useMemo(() => byteStats(totalBytes, outcome.bytes), [totalBytes, outcome.bytes])

	const runMerge = useCallback(async () => {
		if (running) return
		cancelRef.current = false
		setRunning(true)
		setOutcome(EMPTY_OUTCOME)
		if (urlRef.current) { URL.revokeObjectURL(urlRef.current); urlRef.current = null }
		setProgress({ done: 0, total: plan.ready.length, name: "" })
		setLive("Merging…")
		const result = await mergePdfs(entries, options, (done, total, name) => setProgress({ done, total, name }), () => cancelRef.current)
		setOutcome(result)
		setRunning(false)
		if (result.cancelled) setLive("Merge stopped. Nothing was written.")
		else if (result.error) setLive(`Merge failed. ${result.error}`)
		else {
			setLive(`Merged ${result.plan.length} file${result.plan.length === 1 ? "" : "s"} into ${result.pageCount} pages, ${formatBytes(result.bytes)}, in ${formatDuration(result.elapsedMs)}.`)
			history.add(options, `${result.plan.length} files → ${result.pageCount} pages`)
		}
	}, [running, entries, options, plan.ready.length, history])

	const stop = useCallback(() => { cancelRef.current = true; setLive("Stopping…") }, [])

	const outName = safeFileName(options.outputName, `merged-${stamp()}`)

	const saveResult = useCallback(() => {
		if (!outcome.blob) return
		downloadFile(outcome.blob, `${outName}.pdf`, "application/pdf")
	}, [outcome.blob, outName])

	const openResult = useCallback(() => {
		if (!outcome.blob) return
		if (urlRef.current) URL.revokeObjectURL(urlRef.current)
		urlRef.current = URL.createObjectURL(outcome.blob)
		window.open(urlRef.current, "_blank", "noopener")
	}, [outcome.blob])

	const clearQueue = useCallback(() => {
		setEntries([])
		setOutcome(EMPTY_OUTCOME)
		if (urlRef.current) { URL.revokeObjectURL(urlRef.current); urlRef.current = null }
		setLive("Queue cleared. Nothing is kept in memory.")
	}, [])

	useEffect(() => {
		const onKey = (e: KeyboardEvent) => {
			const mod = e.metaKey || e.ctrlKey
			if (mod && e.key === "Enter") { e.preventDefault(); void runMerge(); return }
			if (mod && e.key.toLowerCase() === "o") { e.preventDefault(); pickerRef.current?.click(); return }
			if (mod && e.shiftKey && e.key.toLowerCase() === "r") { e.preventDefault(); setEntries((p) => [...p].reverse()); setLive("Order reversed."); return }
			if (mod && e.key === "Backspace") { e.preventDefault(); clearQueue(); return }
			if (e.key === "Escape" && running) { e.preventDefault(); stop(); return }
			if (e.key === "?" && !(e.target instanceof HTMLInputElement) && !(e.target instanceof HTMLTextAreaElement)) { e.preventDefault(); setShowShortcuts(true) }
		}
		window.addEventListener("keydown", onKey)
		return () => window.removeEventListener("keydown", onKey)
	}, [runMerge, clearQueue, running, stop])

	const rowKeys = (id: string) => (e: React.KeyboardEvent) => {
		if (!e.altKey) return
		if (e.key === "ArrowUp") { e.preventDefault(); setEntries((p) => moveEntry(p, id, "up")); setLive("Moved up.") }
		if (e.key === "ArrowDown") { e.preventDefault(); setEntries((p) => moveEntry(p, id, "down")); setLive("Moved down.") }
	}

	const jsonLd = useMemo(() => JSON.stringify({
		"@context": "https://schema.org",
		"@graph": [
			{ "@type": "FAQPage", mainEntity: FAQ.map((f) => ({ "@type": "Question", name: f.question, acceptedAnswer: { "@type": "Answer", text: f.answer } })) },
			{ "@type": "HowTo", name: "How to merge PDF files", step: HOW_TO.map((s) => ({ "@type": "HowToStep", name: s.name, text: s.text })) },
		],
	}), [])

	const shown = entries.slice(0, RENDER_LIMIT)

	return (
		<div className="space-y-4">
			<a href="#merge-result" className={`sr-only focus:not-sr-only focus:absolute focus:z-50 focus:rounded-md focus:border focus:bg-card focus:px-3 focus:py-2 focus:text-sm ${FOCUS}`}>Skip to the result</a>
			<p aria-live="polite" aria-atomic className="sr-only">{live}</p>

			{/* Drop zone */}
			<div className={`${BOX} ${dragOver ? "border-primary bg-accent/40" : ""}`}
				onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
				onDragLeave={() => setDragOver(false)}
				onDrop={(e) => { e.preventDefault(); setDragOver(false); void addFiles(e.dataTransfer.files) }}>
				<div className="flex flex-wrap items-center justify-between gap-3">
					<div className="min-w-0">
						<h2 className="text-sm font-semibold">Your PDFs</h2>
						<p className="text-xs text-muted-foreground">Drop them here, or choose them. Up to {MAX_FILES} files, {formatBytes(MAX_FILE_BYTES)} each, {formatBytes(MAX_TOTAL_BYTES)} in total.</p>
					</div>
					<div className="flex flex-wrap gap-2">
						<Button variant="primary" onClick={() => pickerRef.current?.click()}><FileUp className="h-4 w-4" />Choose PDFs</Button>
						<Button onClick={clearQueue} disabled={entries.length === 0}><Eraser className="h-4 w-4" />Clear</Button>
					</div>
				</div>
				<label htmlFor="merge-picker" className="sr-only">Choose PDF files to merge</label>
				<input ref={pickerRef} id="merge-picker" type="file" accept="application/pdf,.pdf" multiple className="sr-only" onChange={(e) => { if (e.target.files) void addFiles(e.target.files); e.target.value = "" }} />
				{reading ? <p className="mt-3 text-xs text-muted-foreground">Reading and checking your files…</p> : null}
			</div>

			{/* Order controls */}
			{entries.length > 1 ? (
				<div className={`${BOX} flex flex-wrap items-end gap-3`}>
					<div className="w-56"><Select id="merge-sort" label="Put them in order by" value={sortKey} onChange={(v) => { setSortKey(v); setEntries((p) => sortEntries(p, v, sortDesc)); setLive("Order changed.") }} options={SORT_KEYS} /></div>
					<Button onClick={() => { const d = !sortDesc; setSortDesc(d); setEntries((p) => sortEntries(p, sortKey, d)) }}><ArrowDownUp className="h-4 w-4" />{sortDesc ? "Descending" : "Ascending"}</Button>
					<Button onClick={() => { setEntries((p) => [...p].reverse()); setLive("Order reversed.") }}><RotateCcw className="h-4 w-4" />Reverse</Button>
					<p className="text-xs text-muted-foreground">Alt + Up and Alt + Down move the focused file, so you never need to drag.</p>
				</div>
			) : null}

			{/* File list */}
			{shown.length > 0 ? (
				<ol className="space-y-2">
					{shown.map((e, i) => {
						const resolved = e.status === "ready" ? resolvePages(e) : { pages: [], errors: [] }
						const open = expanded === e.id
						return (
							<li key={e.id} draggable onDragStart={() => setDragId(e.id)} onDragEnd={() => setDragId(null)}
								onDragOver={(ev) => ev.preventDefault()}
								onDrop={(ev) => { ev.preventDefault(); if (dragId && dragId !== e.id) { setEntries((prev) => { const from = prev.findIndex((x) => x.id === dragId); const to = prev.findIndex((x) => x.id === e.id); if (from < 0 || to < 0) return prev; const out = [...prev]; const item = out.splice(from, 1)[0]; if (!item) return prev; out.splice(to, 0, item); return out }); setLive("Order changed.") } }}
								onKeyDown={rowKeys(e.id)} tabIndex={0}
								className={`rounded-lg border bg-card p-3 ${e.skip ? "opacity-60" : ""} ${dragId === e.id ? "ring-2 ring-primary" : ""} ${FOCUS}`}>
								<div className="flex flex-wrap items-center gap-2">
									<span className="w-6 shrink-0 text-center text-xs text-muted-foreground">{i + 1}</span>
									<div className="min-w-0 flex-1">
										<p className="truncate text-sm font-medium" title={e.name}>{e.name}</p>
										<p className="text-xs text-muted-foreground">
											<span className={STATUS_TONE[e.status] ?? ""}>{STATUS_LABEL[e.status]}</span>
											{e.status === "ready" ? <> · {e.pageCount} page{e.pageCount === 1 ? "" : "s"} · {formatBytes(e.size)}{plan.starts[e.id] !== undefined && !e.skip ? <> · starts at page {plan.starts[e.id]} of the result</> : null}</> : e.statusDetail ? <> · {e.statusDetail}</> : null}
										</p>
									</div>
									<div className="flex shrink-0 items-center gap-1">
										<IconButton onClick={() => setEntries((p) => moveEntry(p, e.id, "up"))} label={`Move ${e.name} up`} disabled={i === 0}><ArrowUp className="h-3.5 w-3.5" /></IconButton>
										<IconButton onClick={() => setEntries((p) => moveEntry(p, e.id, "down"))} label={`Move ${e.name} down`} disabled={i === shown.length - 1}><ArrowDown className="h-3.5 w-3.5" /></IconButton>
										<IconButton onClick={() => setExpanded(open ? null : e.id)} label={`${open ? "Hide" : "Show"} page options for ${e.name}`}><ChevronRight className={`h-3.5 w-3.5 transition-transform ${open ? "rotate-90" : ""}`} /></IconButton>
										<IconButton onClick={() => setEntries((p) => p.filter((x) => x.id !== e.id))} label={`Remove ${e.name}`}><Trash2 className="h-3.5 w-3.5" /></IconButton>
									</div>
								</div>

								{open && e.status === "ready" ? (
									<div className="mt-3 grid gap-3 border-t pt-3 sm:grid-cols-2">
										<Field id={`range-${e.id}`} label="Pages to take" value={e.pageRange} onChange={(v) => patch(e.id, { pageRange: v })} placeholder="all pages" hint="Such as 1-3, 7, 10-. Use −1 for the last page." invalid={resolved.errors[0]} />
										<Field id={`exclude-${e.id}`} label="Pages to leave out" value={e.excludeRange} onChange={(v) => patch(e.id, { excludeRange: v })} placeholder="none" hint="Removed from the pages above." />
										<Select id={`filter-${e.id}`} label="Odd or even" value={e.pageFilter} onChange={(v: PageFilter) => patch(e.id, { pageFilter: v })} options={[{ v: "all", label: "All the pages selected" }, { v: "odd", label: "Odd pages only" }, { v: "even", label: "Even pages only" }]} />
										<Select id={`rotate-${e.id}`} label="Rotate" value={String(e.rotate) as "0" | "90" | "180" | "270"} onChange={(v) => patch(e.id, { rotate: Number(v) as Rotation })} options={[{ v: "0", label: "Leave as it is" }, { v: "90", label: "90° clockwise" }, { v: "180", label: "180°" }, { v: "270", label: "270° clockwise" }]} />
										<Field id={`bm-${e.id}`} label="Bookmark name" value={e.bookmarkName} onChange={(v) => patch(e.id, { bookmarkName: v })} hint={e.docTitle ? `This PDF calls itself “${e.docTitle}”.` : "Shown in the receipt and the outline."} />
										<div className="space-y-2">
											<Toggle id={`rev-${e.id}`} checked={e.reversePages} onChange={(v) => patch(e.id, { reversePages: v })} label="Reverse the pages from this file" />
											<Toggle id={`skip-${e.id}`} checked={e.skip} onChange={(v) => patch(e.id, { skip: v })} label="Leave this file out for now" hint="It stays in the list." />
										</div>
										<p className="text-xs text-muted-foreground sm:col-span-2">Taking {resolved.pages.length} page{resolved.pages.length === 1 ? "" : "s"}: {describePages(resolved.pages)}.</p>
									</div>
								) : null}
							</li>
						)
					})}
				</ol>
			) : null}
			{entries.length > RENDER_LIMIT ? <p className="text-xs text-muted-foreground">Showing the first {RENDER_LIMIT} of {entries.length} files. All of them are still merged.</p> : null}

			{/* Problems and notes */}
			{plan.errors.length > 0 ? (
				<div className="rounded-lg border border-destructive/40 bg-destructive/10 p-3">
					<p className="flex items-center gap-1.5 text-sm font-medium text-destructive"><AlertTriangle className="h-4 w-4" />This merge cannot run yet</p>
					<ul className="mt-1 list-disc space-y-0.5 pl-5 text-xs text-destructive">{plan.errors.map((m) => <li key={m}>{m}</li>)}</ul>
				</div>
			) : null}
			{plan.warnings.length > 0 ? (
				<div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3">
					<p className="flex items-center gap-1.5 text-sm font-medium"><Info className="h-4 w-4" />Worth knowing</p>
					<ul className="mt-1 list-disc space-y-0.5 pl-5 text-xs">{plan.warnings.map((m) => <li key={m}>{m}</li>)}</ul>
				</div>
			) : null}

			{/* Options */}
			<div className={`${BOX} space-y-4`}>
				<h2 className="text-sm font-semibold">How to merge them</h2>
				<div className="flex flex-wrap gap-2">
					{PRESETS.map((p) => <button key={p.id} type="button" className={CHIP} title={p.description} onClick={() => { setOptions({ ...DEFAULT_MERGE_OPTIONS, ...p.values }); setLive(`Preset applied: ${p.label}.`) }}><Lightbulb className="h-3 w-3" />{p.label}</button>)}
					{savedPresets.map((p) => <button key={p.id} type="button" className={CHIP} onClick={() => setOptions(p.values)}><Pin className="h-3 w-3" />{p.label}</button>)}
					<button type="button" className={CHIP} onClick={() => setOptions(DEFAULT_MERGE_OPTIONS)}><RotateCcw className="h-3 w-3" />Defaults</button>
				</div>
				<div className="grid gap-3 sm:grid-cols-2">
					<div className="space-y-2">
						<Toggle id="o-bm" checked={options.addBookmarks} onChange={(v) => set("addBookmarks", v)} label="A bookmark for each file" hint="Named in the receipt so you can check it." />
						<Toggle id="o-titles" checked={options.useDocTitles} onChange={(v) => set("useDocTitles", v)} label="Use each PDF's own title for its bookmark" />
						<Toggle id="o-blank" checked={options.blankBetween} onChange={(v) => set("blankBetween", v)} label="A blank page between files" />
						<Toggle id="o-even" checked={options.padToEven} onChange={(v) => set("padToEven", v)} label="Pad each file to an even page count" hint="For double-sided printing, so no section starts on the back of another." />
					</div>
					<div className="space-y-2">
						<Toggle id="o-norm" checked={options.normaliseSize} onChange={(v) => set("normaliseSize", v)} label="Make every page the same size" />
						<Select id="o-size" label="Which size" value={options.sizeSource} onChange={(v: SizeSource) => set("sizeSource", v)} options={[{ v: "first", label: "Same as the first file" }, { v: "largest", label: "The largest page found" }, { v: "a4", label: "A4" }, { v: "letter", label: "US Letter" }]} />
						<Toggle id="o-compress" checked={options.compress} onChange={(v) => set("compress", v)} label="Keep the file small" hint="Uses object streams. Turn off only if a reader complains." />
						<Toggle id="o-strip" checked={options.stripMetadata} onChange={(v) => set("stripMetadata", v)} label="Remove all metadata from the result" />
					</div>
				</div>
				<div className="grid gap-3 sm:grid-cols-2">
					<Field id="o-title" label="Title" value={options.title} onChange={(v) => set("title", v)} placeholder="Leave empty to set none" />
					<Field id="o-author" label="Author" value={options.author} onChange={(v) => set("author", v)} />
					<Field id="o-subject" label="Subject" value={options.subject} onChange={(v) => set("subject", v)} />
					<Field id="o-kw" label="Keywords" value={options.keywords} onChange={(v) => set("keywords", v)} hint="Separated by commas." />
					<Field id="o-name" label="File name" value={options.outputName} onChange={(v) => set("outputName", v)} placeholder={`merged-${stamp()}`} hint={`Saved as ${outName}.pdf`} />
					<div className="flex items-end gap-2">
						<div className="flex-1"><Field id="o-preset" label="Save these settings as" value={presetName} onChange={setPresetName} placeholder="My usual merge" /></div>
						<Button onClick={() => { const label = presetName.trim(); if (!label) return; setSavedPresets([{ id: randomId(8), label, values: options }, ...savedPresets].slice(0, 12)); setPresetName(""); setLive(`Preset “${label}” saved.`) }} disabled={presetName.trim().length === 0}><Check className="h-4 w-4" />Save</Button>
					</div>
				</div>
				<Toggle id="o-dates" checked={options.setDates} onChange={(v) => set("setDates", v)} label="Write today's date into the file" hint="Turn this off if you would rather not record when it was made." />
			</div>

			{/* Run */}
			<div className={`${BOX} space-y-3`}>
				<div className="flex flex-wrap items-center gap-2">
					<Button variant="primary" onClick={() => void runMerge()} disabled={running || plan.errors.length > 0}><SquareStack className="h-4 w-4" />{running ? "Merging…" : `Merge ${plan.ready.length} file${plan.ready.length === 1 ? "" : "s"}`}</Button>
					{running ? <Button variant="danger" onClick={stop}><X className="h-4 w-4" />Stop</Button> : null}
					<Button onClick={() => setShowShortcuts(true)}><Keyboard className="h-4 w-4" />Shortcuts</Button>
					<Button onClick={() => setShowHistory(true)} disabled={history.entries.length === 0}>Recent settings</Button>
					{plan.errors.length === 0 ? <span className="text-xs text-muted-foreground">{plan.totalPages} page{plan.totalPages === 1 ? "" : "s"} from {formatBytes(totalBytes)}</span> : null}
				</div>
				{running ? <Bar value={progress.done} max={Math.max(1, progress.total)} label={`${progress.done} of ${progress.total} files… ${progress.name}`} /> : null}
			</div>

			{/* Result */}
			<div id="merge-result" className="space-y-3">
				{outcome.cancelled ? <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm">You stopped the merge, so no file was written. Nothing was changed.</div> : null}
				{outcome.error ? <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">{outcome.error}</div> : null}
				{outcome.blob ? (
					<div className={`${BOX} space-y-3`}>
						<div className="flex flex-wrap items-center justify-between gap-2">
							<h2 className="text-sm font-semibold">Your merged PDF</h2>
							<span className="text-xs text-muted-foreground">Built in {formatDuration(outcome.elapsedMs)}</span>
						</div>
						<dl className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
							<div><dt className="text-xs text-muted-foreground">Pages</dt><dd className="font-medium">{outcome.pageCount}</dd></div>
							<div><dt className="text-xs text-muted-foreground">Result size</dt><dd className="font-medium">{formatBytes(outcome.bytes)}</dd></div>
							<div><dt className="text-xs text-muted-foreground">Files in</dt><dd className="font-medium">{formatBytes(sizes.inputSize)}</dd></div>
							<div><dt className="text-xs text-muted-foreground">Difference</dt><dd className="font-medium">{sizes.savings >= 0 ? "−" : "+"}{formatBytes(Math.abs(sizes.savings))}</dd></div>
						</dl>
						<table className="w-full text-left text-xs">
							<caption className="pb-2 text-left text-xs text-muted-foreground">Exactly what went in, in order</caption>
							<thead><tr className="border-b"><th scope="col" className="py-1 pr-2">#</th><th scope="col" className="py-1 pr-2">File</th><th scope="col" className="py-1 pr-2">Pages taken</th><th scope="col" className="py-1 pr-2">Count</th><th scope="col" className="py-1">Starts at</th></tr></thead>
							<tbody>{outcome.plan.map((p, i) => <tr key={`${p.name}-${i}`} className="border-b last:border-0"><th scope="row" className="py-1 pr-2 font-normal">{i + 1}</th><td className="py-1 pr-2 break-words">{p.name}</td><td className="py-1 pr-2">{p.pages}</td><td className="py-1 pr-2">{p.count}</td><td className="py-1">{p.startsAt}</td></tr>)}</tbody>
						</table>
						{outcome.skipped.length > 0 ? <ul className="list-disc space-y-0.5 pl-5 text-xs text-amber-700">{outcome.skipped.map((m) => <li key={m}>{m}</li>)}</ul> : null}
						<div className="flex flex-wrap gap-2">
							<Button variant="primary" onClick={saveResult}><Download className="h-4 w-4" />Download {outName}.pdf</Button>
							<Button onClick={openResult}>Open in a new tab</Button>
							<Button onClick={() => downloadFile(buildReceipt(entries, options, outcome), `${outName}-receipt.txt`, "text/plain")}><Download className="h-4 w-4" />Receipt</Button>
							<Button onClick={() => downloadFile(buildJsonSummary(entries, options, outcome), `${outName}-summary.json`, "application/json")}><Download className="h-4 w-4" />JSON summary</Button>
							<Button onClick={() => { void navigator.clipboard?.writeText(buildReceipt(entries, options, outcome)).then(() => setLive("Receipt copied.")) }}><Copy className="h-4 w-4" />Copy receipt</Button>
						</div>
					</div>
				) : null}
			</div>

			{/* Help */}
			<div className={`${BOX} space-y-3`}>
				<h2 className="text-sm font-semibold">How to use this</h2>
				<ol className="list-decimal space-y-1 pl-5 text-sm">{HOW_TO.map((s) => <li key={s.name}><span className="font-medium">{s.name}.</span> {s.text}</li>)}</ol>
				<h3 className="pt-2 text-sm font-semibold">Questions</h3>
				<dl className="space-y-2">{FAQ.map((f) => <div key={f.question}><dt className="text-sm font-medium">{f.question}</dt><dd className="text-xs text-muted-foreground">{f.answer}</dd></div>)}</dl>
				<h3 className="pt-2 text-sm font-semibold">What this tool assumes</h3>
				<ul className="list-disc space-y-0.5 pl-5 text-xs text-muted-foreground">{ASSUMPTIONS.map((a) => <li key={a}>{a}</li>)}</ul>
				<h3 className="pt-2 text-sm font-semibold">Related tools</h3>
				<ul className="space-y-0.5 text-xs">{RELATED.map((r) => <li key={r.id}><span className="font-medium">{r.label}</span> <span className="text-muted-foreground">— {r.why}</span></li>)}</ul>
			</div>

			{/* Privacy */}
			<div className={`${BOX} space-y-2`}>
				<p className="flex items-center gap-1.5 text-sm font-medium"><ShieldCheck className="h-4 w-4" />Your documents stay here</p>
				<p className="text-xs text-muted-foreground">The merge runs in this tab using your own browser. There is no network request in this tool, it works offline, and your files are held in memory only for as long as the merge takes. Only your settings are remembered, in this browser.</p>
				<Button variant="danger" onClick={() => { clearAllStorage(); setOptions(DEFAULT_MERGE_OPTIONS); setSavedPresets([]); history.clearAll(); setLive("Everything this tool had stored has been deleted.") }}><Trash2 className="h-4 w-4" />Delete everything this tool stored</Button>
			</div>

			<Dialog open={showShortcuts} onClose={() => setShowShortcuts(false)} title="Keyboard shortcuts">
				<table className="w-full text-left text-sm">
					<thead><tr className="border-b"><th scope="col" className="py-1 pr-4">Keys</th><th scope="col" className="py-1">Action</th></tr></thead>
					<tbody>{SHORTCUTS.map((s) => <tr key={s.keys} className="border-b last:border-0"><th scope="row" className="py-1 pr-4 font-mono text-xs font-normal">{s.keys}</th><td className="py-1">{s.label}</td></tr>)}</tbody>
				</table>
			</Dialog>

			<Dialog open={showHistory} onClose={() => setShowHistory(false)} title="Recent settings">
				<p className="mb-2 text-xs text-muted-foreground">Settings only. Your documents are never stored, and nothing here is applied until you choose it.</p>
				<ul className="space-y-2">
					{history.entries.map((h) => (
						<li key={h.id} className="flex items-center gap-2 rounded-md border p-2">
							<div className="min-w-0 flex-1">
								<p className="truncate text-sm">{h.summary}</p>
								<p className="text-xs text-muted-foreground">{new Date(h.at).toLocaleString()}</p>
							</div>
							<Button onClick={() => { setOptions(h.options); setShowHistory(false); setLive("Settings restored.") }}>Use</Button>
							<IconButton onClick={() => history.togglePin(h.id)} label={h.pinned ? "Unpin" : "Pin"}><Pin className={`h-3.5 w-3.5 ${h.pinned ? "text-primary" : ""}`} /></IconButton>
							<IconButton onClick={() => history.remove(h.id)} label="Remove"><Trash2 className="h-3.5 w-3.5" /></IconButton>
						</li>
					))}
				</ul>
			</Dialog>

			<script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd }} />
		</div>
	)
}
