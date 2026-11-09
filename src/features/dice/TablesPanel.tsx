import React, { useEffect, useMemo, useRef, useState } from "react"
import { createStore, useStore } from "../store"
import { useTableMode } from "../view-state"
import { showToast } from "../../utils/toast"
import { MOD } from "../../utils/hotkeys"
import { DockPanel } from "./DockPanel"
import { TablesIcon } from "./icons"
import { rollTableAndShow } from "./roller"
import {
    checkPart,
    formatEntries,
    newTableId,
    parseEntries,
    rollTable,
    type RandomTable,
} from "./tables-core"
import { deleteTable, exportLibrary, importFile, restoreStarters, saveTable, tablesStore } from "./tables-store"
import { STARTER_TABLES } from "./starter-tables"
import { dateStamp } from "./download"

interface DraftPart {
    label: string
    dice: string
    text: string
}

interface Draft {
    id: string
    isNew: boolean
    name: string
    join: string
    parts: DraftPart[]
}

/** The table being edited survives closing the panel */
const draftStore = createStore<Draft | null>(null)

function toDraft(t: RandomTable | null): Draft {
    if (!t) return { id: newTableId(), isNew: true, name: "", join: " ", parts: [{ label: "", dice: "1d6", text: "" }] }
    return {
        id: t.id,
        isNew: false,
        name: t.name,
        join: t.join,
        parts: t.parts.map((p) => ({ label: p.label ?? "", dice: p.dice, text: formatEntries(p.entries) })),
    }
}

function fromDraft(d: Draft): RandomTable {
    return {
        id: d.id,
        name: d.name.trim(),
        join: d.join,
        updatedAt: Date.now(),
        parts: d.parts.map((p) => ({
            ...(p.label.trim() ? { label: p.label.trim() } : {}),
            dice: p.dice.trim(),
            entries: parseEntries(p.text).entries,
        })),
    }
}

function summary(t: RandomTable): string {
    return t.parts.map((p) => `${p.dice} · ${p.entries.length} entries`).join(" + ")
}

// ------------------------------------------------------------- editor
const TableEditor: React.FC<{ draft: Draft }> = ({ draft }) => {
    const [preview, setPreview] = useState<string | null>(null)
    const set = (patch: Partial<Draft>) => draftStore.set((d) => (d ? { ...d, ...patch } : d))
    const setPart = (i: number, patch: Partial<DraftPart>) =>
        set({ parts: draft.parts.map((p, j) => (j === i ? { ...p, ...patch } : p)) })

    const checks = useMemo(
        () =>
            draft.parts.map((p) => {
                const parsed = parseEntries(p.text)
                const c = checkPart({ dice: p.dice, entries: parsed.entries })
                return { errors: [...parsed.errors, ...c.errors], warnings: c.warnings }
            }),
        [draft.parts]
    )
    const nameMissing = !draft.name.trim()
    const blocked = nameMissing || checks.some((c) => c.errors.length)

    const save = (e: React.FormEvent) => {
        e.preventDefault()
        if (blocked) return
        saveTable(fromDraft(draft))
        draftStore.set(null)
        showToast(`Saved “${draft.name.trim()}”.`)
    }

    return (
        <form className='jv-editor' onSubmit={save} aria-label={draft.isNew ? "New table" : `Edit ${draft.name}`}>
            <label className='jv-field'>
                <span>Name</span>
                <input
                    data-autofocus
                    className='jv-input'
                    value={draft.name}
                    onChange={(e) => set({ name: e.target.value })}
                    placeholder='e.g. Forest encounters'
                    maxLength={80}
                    aria-invalid={nameMissing}
                />
            </label>
            {draft.parts.map((p, i) => {
                const c = checks[i]
                const msgId = `jv-part-msg-${i}`
                return (
                    <fieldset key={i} className='jv-part'>
                        <legend>{draft.parts.length > 1 ? `Part ${i + 1}` : "Entries"}</legend>
                        <div className='jv-row'>
                            <label className='jv-field jv-field--dice'>
                                <span>Dice</span>
                                <input
                                    className='jv-input jv-mono'
                                    value={p.dice}
                                    onChange={(e) => setPart(i, { dice: e.target.value })}
                                    placeholder='1d6'
                                    spellCheck={false}
                                />
                            </label>
                            {draft.parts.length > 1 && (
                                <label className='jv-field'>
                                    <span>Caption (optional)</span>
                                    <input
                                        className='jv-input'
                                        value={p.label}
                                        onChange={(e) => setPart(i, { label: e.target.value })}
                                        maxLength={40}
                                    />
                                </label>
                            )}
                        </div>
                        <label className='jv-field'>
                            <span>One entry per line, like “1-2: Goblins (2d4)”</span>
                            <textarea
                                className='jv-input jv-textarea'
                                rows={8}
                                value={p.text}
                                onChange={(e) => setPart(i, { text: e.target.value })}
                                spellCheck
                                aria-describedby={msgId}
                                aria-invalid={c.errors.length > 0}
                            />
                        </label>
                        <div id={msgId} className='jv-checks'>
                            {c.errors.map((m) => (
                                <p key={m} className='jv-check-msg jv-check-msg--error'>
                                    <strong>Fix:</strong> {m}
                                </p>
                            ))}
                            {c.warnings.map((m) => (
                                <p key={m} className='jv-check-msg'>
                                    <strong>Note:</strong> {m}
                                </p>
                            ))}
                        </div>
                        {draft.parts.length > 1 && (
                            <button
                                type='button'
                                className='jv-btn'
                                onClick={() => set({ parts: draft.parts.filter((_, j) => j !== i) })}
                            >
                                Remove part {i + 1}
                            </button>
                        )}
                    </fieldset>
                )
            })}
            <div className='jv-row jv-row--wrap'>
                {draft.parts.length < 4 && (
                    <button
                        type='button'
                        className='jv-btn'
                        onClick={() => set({ parts: [...draft.parts, { label: "", dice: "1d6", text: "" }] })}
                        title='Roll several columns and join them, like “adjective + noun” names'
                    >
                        Add a part
                    </button>
                )}
                {draft.parts.length > 1 && (
                    <label className='jv-field jv-field--inline'>
                        <span>Join parts with</span>
                        <input
                            className='jv-input jv-input--short'
                            value={draft.join}
                            onChange={(e) => set({ join: e.target.value })}
                            maxLength={10}
                        />
                    </label>
                )}
            </div>
            <div className='jv-row jv-row--wrap'>
                <button
                    type='button'
                    className='jv-btn'
                    disabled={checks.some((x) => x.errors.length)}
                    onClick={() => setPreview(rollTable(fromDraft(draft)).text)}
                >
                    Test roll
                </button>
                <span className='jv-grow' />
                <button type='button' className='jv-btn' onClick={() => draftStore.set(null)}>
                    Cancel
                </button>
                <button type='submit' className='jv-btn jv-btn--primary' disabled={blocked}>
                    Save table
                </button>
            </div>
            {preview !== null && (
                <p className='jv-preview' aria-live='polite'>
                    <strong>Test:</strong> {preview}
                </p>
            )}
        </form>
    )
}

// --------------------------------------------------------------- list
const TableList: React.FC<{ tables: RandomTable[] }> = ({ tables }) => {
    const tableMode = useTableMode()
    const [filter, setFilter] = useState("")
    const [last, setLast] = useState<{ id: string; text: string } | null>(null)
    const fileRef = useRef<HTMLInputElement>(null)

    const shown = filter.trim()
        ? tables.filter((t) => t.name.toLowerCase().includes(filter.trim().toLowerCase()))
        : tables
    const missingStarters = STARTER_TABLES.some((s) => !tables.some((t) => t.id === s.id))

    const onImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        e.target.value = ""
        if (!file) return
        try {
            const n = await importFile(file)
            showToast(`Imported ${n} table${n === 1 ? "" : "s"}.`)
        } catch (err) {
            showToast(err instanceof Error ? err.message : "Couldn't import that file.", "error")
        }
    }

    return (
        <>
            {!tableMode && (
                <div className='jv-row jv-row--wrap'>
                    <button type='button' className='jv-btn jv-btn--primary' onClick={() => draftStore.set(toDraft(null))}>
                        New table
                    </button>
                    <button type='button' className='jv-btn' onClick={() => fileRef.current?.click()}>
                        Import…
                    </button>
                    <button
                        type='button'
                        className='jv-btn'
                        disabled={!tables.length}
                        onClick={() => exportLibrary(tables, `jewel-tables-${dateStamp()}.json`)}
                    >
                        Export all
                    </button>
                    <input
                        ref={fileRef}
                        type='file'
                        accept='application/json,.json'
                        hidden
                        onChange={onImport}
                    />
                </div>
            )}
            {tables.length > 6 && (
                <label className='jv-field'>
                    <span className='jv-sr'>Find a table</span>
                    <input
                        className='jv-input'
                        type='search'
                        value={filter}
                        onChange={(e) => setFilter(e.target.value)}
                        placeholder='Find a table…'
                    />
                </label>
            )}
            {shown.length ? (
                <ul className='jv-table-list'>
                    {shown.map((t) => (
                        <li key={t.id} className='jv-table-item'>
                            <div className='jv-table-head'>
                                <div className='jv-table-name'>
                                    <strong>{t.name}</strong>
                                    <span className='jv-hint'>{summary(t)}</span>
                                </div>
                                <button
                                    type='button'
                                    className='jv-btn jv-btn--primary'
                                    aria-label={`Roll ${t.name}`}
                                    onClick={() => setLast({ id: t.id, text: rollTableAndShow(t).roll.text })}
                                >
                                    Roll
                                </button>
                            </div>
                            {last?.id === t.id && <p className='jv-table-last'>{last.text}</p>}
                            {!tableMode && (
                                <div className='jv-row jv-table-actions'>
                                    <button
                                        type='button'
                                        className='jv-btn jv-btn--small'
                                        aria-label={`Edit ${t.name}`}
                                        onClick={() => draftStore.set(toDraft(t))}
                                    >
                                        Edit
                                    </button>
                                    <button
                                        type='button'
                                        className='jv-btn jv-btn--small'
                                        aria-label={`Export ${t.name}`}
                                        onClick={() => exportLibrary([t], `${t.name.replace(/[^\w-]+/g, "-").toLowerCase()}.json`)}
                                    >
                                        Export
                                    </button>
                                    <button
                                        type='button'
                                        className='jv-btn jv-btn--small'
                                        aria-label={`Delete ${t.name}`}
                                        onClick={() => {
                                            deleteTable(t.id)
                                            showToast(`Deleted “${t.name}”. Undo with ${MOD}Z.`)
                                        }}
                                    >
                                        Delete
                                    </button>
                                </div>
                            )}
                        </li>
                    ))}
                </ul>
            ) : (
                <p className='jv-hint'>{tables.length ? "No table matches that name." : "No tables yet."}</p>
            )}
            {!tableMode && missingStarters && (
                <button
                    type='button'
                    className='jv-btn jv-btn--link'
                    onClick={() => {
                        const n = restoreStarters()
                        showToast(`Restored ${n} starter table${n === 1 ? "" : "s"}.`)
                    }}
                >
                    Restore starter tables
                </button>
            )}
        </>
    )
}

export const TablesPanel: React.FC = () => {
    const tables = useStore(tablesStore)
    const draft = useStore(draftStore)
    const tableMode = useTableMode()
    const editing = !!draft && !tableMode

    // Switching between list and editor removes the focused button: move focus into the new view
    const firstRender = useRef(true)
    useEffect(() => {
        if (firstRender.current) {
            firstRender.current = false
            return
        }
        const active = document.activeElement
        if (active && active !== document.body) return
        const body = document.querySelector(".jv-dpanel--tables .jv-dpanel-body")
        body?.querySelector<HTMLElement>("[data-autofocus], button, input")?.focus()
    }, [editing])

    return (
        <DockPanel id='tables' title='Random tables' icon={<TablesIcon />}>
            {tables === null ? (
                <p className='jv-hint'>Loading tables…</p>
            ) : draft && editing ? (
                <TableEditor draft={draft} />
            ) : (
                <TableList tables={tables} />
            )}
        </DockPanel>
    )
}
