import React, { useEffect, useMemo, useState } from "react"
import { usePrefs } from "../prefs"
import { useNetRole } from "../view-state"
import { showToast } from "../../utils/toast"
import { MOD } from "../../utils/hotkeys"
import { DockPanel } from "./DockPanel"
import { AuditIcon } from "./icons-audit"
import { auditCsv, clearAudit, facesText, rollerStats, useAudit, type AuditEntry } from "./audit"
import { dateStamp, downloadText } from "./download"

/*
 * Roll audit panel: every roll, newest first, with who rolled it, every
 * die and the total. Filter by roller, search, or show only criticals and
 * fumbles; per-roller d20 numbers; CSV export. Only the GM can clear it.
 */

const PAGE = 200

const when = (at: number) =>
    new Date(at).toLocaleString(undefined, {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
    })

const Row: React.FC<{ e: AuditEntry }> = ({ e }) => (
    <li className={`jv-audit-row ${e.secret ? "is-secret" : ""}`}>
        <div className='jv-audit-top'>
            <time dateTime={new Date(e.at).toISOString()}>{when(e.at)}</time>
            <strong className='jv-audit-who'>{e.by}</strong>
            <span className='jv-audit-total' aria-label={`Total ${e.total}`}>
                {e.total}
            </span>
        </div>
        <div className='jv-audit-what'>
            {e.label && <span>{e.label}: </span>}
            {e.table ?? <code>{e.expression}</code>}
        </div>
        {e.dice.length > 0 && (
            <div className='jv-audit-dice'>
                Dice: <span>{facesText(e.dice)}</span>
            </div>
        )}
        {(e.crit || e.fumble || e.secret) && (
            <div className='jv-audit-flags'>
                {e.crit && <span className='jv-audit-flag'>★ Critical</span>}
                {e.fumble && <span className='jv-audit-flag'>✕ Fumble</span>}
                {e.secret && <span className='jv-audit-flag'>🔒 Secret (GM only)</span>}
            </div>
        )}
    </li>
)

export const AuditPanel: React.FC = () => {
    const audit = useAudit()
    const role = useNetRole()
    const { confirmDestructive } = usePrefs()
    const [who, setWho] = useState("")
    const [query, setQuery] = useState("")
    const [onlyFlags, setOnlyFlags] = useState(false)
    const [limit, setLimit] = useState(PAGE)
    const [showStats, setShowStats] = useState(false)
    const [confirming, setConfirming] = useState(false)
    const isGm = role !== "player"

    const rollers = useMemo(() => [...new Set(audit.map((e) => e.by))].sort(), [audit])
    const filtered = useMemo(() => {
        const q = query.trim().toLowerCase()
        return audit
            .filter(
                (e) =>
                    (!who || e.by === who) &&
                    (!onlyFlags || e.crit || e.fumble) &&
                    (!q ||
                        [e.by, e.label, e.expression, e.table, e.breakdown, String(e.total)]
                            .join(" ")
                            .toLowerCase()
                            .includes(q))
            )
            .reverse()
    }, [audit, who, query, onlyFlags])
    const stats = useMemo(() => rollerStats(filtered), [filtered])

    useEffect(() => setLimit(PAGE), [who, query, onlyFlags])
    useEffect(() => {
        if (!audit.length) setConfirming(false)
    }, [audit.length])

    const clear = () => {
        setConfirming(false)
        clearAudit()
        showToast(`Roll audit cleared. Undo with ${MOD}Z.`)
    }

    const oldest = audit[0]?.at
    return (
        <DockPanel id='audit' title='Roll audit' icon={<AuditIcon />}>
            <p className='jv-hint' role='status' aria-live='polite'>
                {audit.length
                    ? `${audit.length} roll${audit.length === 1 ? "" : "s"} since ${new Date(oldest!).toLocaleDateString()}${
                          filtered.length !== audit.length ? ` · showing ${filtered.length}` : ""
                      }`
                    : "No rolls yet. Every roll at this table is recorded here."}
            </p>

            <div className='jv-row jv-row--wrap jv-audit-filters'>
                <label className='jv-audit-field'>
                    <span>Who</span>
                    <select className='jv-input' value={who} onChange={(e) => setWho(e.target.value)}>
                        <option value=''>Everyone</option>
                        {rollers.map((r) => (
                            <option key={r} value={r}>
                                {r}
                            </option>
                        ))}
                    </select>
                </label>
                <label className='jv-audit-field jv-grow'>
                    <span>Search</span>
                    <input
                        className='jv-input'
                        type='search'
                        value={query}
                        placeholder='d20, Stealth, 17…'
                        onChange={(e) => setQuery(e.target.value)}
                    />
                </label>
            </div>
            <div className='jv-row jv-row--wrap' role='group' aria-label='Show'>
                <button type='button' className='jv-chip' aria-pressed={onlyFlags} onClick={() => setOnlyFlags((v) => !v)}>
                    Crits &amp; fumbles only
                </button>
                <button type='button' className='jv-chip' aria-pressed={showStats} onClick={() => setShowStats((v) => !v)}>
                    Numbers per person
                </button>
            </div>

            {showStats && stats.length > 0 && (
                <table className='jv-audit-stats'>
                    <caption className='jv-sr'>Rolls per person</caption>
                    <thead>
                        <tr>
                            <th scope='col'>Who</th>
                            <th scope='col'>Rolls</th>
                            <th scope='col'>d20s</th>
                            <th scope='col'>d20 avg</th>
                            <th scope='col'>20s</th>
                            <th scope='col'>1s</th>
                        </tr>
                    </thead>
                    <tbody>
                        {stats.map((s) => (
                            <tr key={s.by}>
                                <th scope='row'>{s.by}</th>
                                <td>{s.rolls}</td>
                                <td>{s.d20s}</td>
                                <td>{s.d20s ? s.d20Average.toFixed(1) : "–"}</td>
                                <td>{s.nat20}</td>
                                <td>{s.nat1}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            )}

            <ol className='jv-audit-list' tabIndex={0} aria-label='Rolls, newest first'>
                {filtered.slice(0, limit).map((e) => (
                    <Row key={e.id} e={e} />
                ))}
            </ol>
            {filtered.length > limit && (
                <button type='button' className='jv-btn' onClick={() => setLimit((n) => n + PAGE)}>
                    Show older rolls ({filtered.length - limit} more)
                </button>
            )}

            {confirming ? (
                <div
                    className='jv-confirm'
                    role='group'
                    aria-label='Confirm clearing the roll audit'
                    onKeyDown={(e) => {
                        if (e.key === "Escape") {
                            e.preventDefault()
                            e.stopPropagation()
                            setConfirming(false)
                        }
                    }}
                >
                    <p>
                        Clear all {audit.length} rolls from the audit, for everyone at the table? You can undo with{" "}
                        {MOD}Z.
                    </p>
                    <div className='jv-row'>
                        <button type='button' className='jv-btn jv-btn--danger' autoFocus onClick={clear}>
                            Clear audit
                        </button>
                        <button type='button' className='jv-btn' onClick={() => setConfirming(false)}>
                            Keep it
                        </button>
                    </div>
                </div>
            ) : (
                <div className='jv-row jv-row--wrap'>
                    <button
                        type='button'
                        className='jv-btn'
                        disabled={!audit.length}
                        onClick={() => downloadText(`roll-audit-${dateStamp()}.csv`, auditCsv(audit), "text/csv")}
                        title='Download every roll as a spreadsheet'
                    >
                        Export CSV
                    </button>
                    <span className='jv-grow' />
                    {isGm && (
                        <button
                            type='button'
                            className='jv-btn'
                            disabled={!audit.length}
                            onClick={() => (confirmDestructive ? setConfirming(true) : clear())}
                        >
                            Clear audit
                        </button>
                    )}
                </div>
            )}
        </DockPanel>
    )
}
