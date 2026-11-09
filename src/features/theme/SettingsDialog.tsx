import React, { useEffect, useId, useRef, useState } from "react"
import { Icon } from "../../components/Icon"
import { setPref, usePrefs, type Prefs } from "../prefs"
import { playSfx } from "../sound"
import { useStore } from "../store"
import { THEMES } from "./themes"
import {
    settingsOpenStore,
    showTitleCard,
    themeViewerStore,
    type SettingsTab,
} from "./theme-store"
import "./settings.css"

const TABS: { id: SettingsTab; label: string }[] = [
    { id: "look", label: "Look" },
    { id: "motion", label: "Motion & sound" },
    { id: "behaviour", label: "Help & safety" },
]

const FOCUSABLE =
    'button:not([disabled]), input:not([disabled]), select:not([disabled]), [href], [tabindex]:not([tabindex="-1"])'

const pct = (n: number) => `${Math.round(n * 100)}%`

// ------------------------------------------------------------- controls
const Switch: React.FC<{
    label: string
    description: string
    checked: boolean
    disabled?: boolean
    onChange: (on: boolean) => void
}> = ({ label, description, checked, disabled, onChange }) => {
    const id = useId()
    return (
        <div className={`jv-set-row ${disabled ? "is-disabled" : ""}`}>
            <label className='jv-set-text' htmlFor={id}>
                <strong>{label}</strong>
                <small id={`${id}-d`}>{description}</small>
            </label>
            <input
                id={id}
                type='checkbox'
                role='switch'
                className='jv-switch'
                checked={checked}
                disabled={disabled}
                aria-describedby={`${id}-d`}
                onChange={(e) => onChange(e.target.checked)}
            />
        </div>
    )
}

/** A slider that applies on release (so the panel doesn't jump under the pointer) */
const Slider: React.FC<{
    label: string
    description: string
    min: number
    max: number
    step: number
    value: number
    disabled?: boolean
    format: (n: number) => string
    live?: boolean
    onCommit: (n: number) => void
}> = ({ label, description, min, max, step, value, disabled, format, live, onCommit }) => {
    const id = useId()
    const [draft, setDraft] = useState<number | null>(null)
    const shown = draft ?? value
    const commit = () => {
        if (draft !== null && draft !== value) onCommit(draft)
        setDraft(null)
    }
    return (
        <div className={`jv-set-row jv-set-row--slider ${disabled ? "is-disabled" : ""}`}>
            <label className='jv-set-text' htmlFor={id}>
                <strong>{label}</strong>
                <small id={`${id}-d`}>{description}</small>
            </label>
            <div className='jv-slider'>
                <input
                    id={id}
                    type='range'
                    min={min}
                    max={max}
                    step={step}
                    value={shown}
                    disabled={disabled}
                    aria-describedby={`${id}-d`}
                    aria-valuetext={format(shown)}
                    onChange={(e) => {
                        const n = Number(e.target.value)
                        if (live) onCommit(n)
                        else setDraft(n)
                    }}
                    onPointerUp={commit}
                    onKeyUp={commit}
                    onBlur={commit}
                />
                <output htmlFor={id} className='jv-slider-value'>
                    {format(shown)}
                </output>
            </div>
        </div>
    )
}

const ThemePicker: React.FC<{ value: string }> = ({ value }) => (
    <fieldset className='jv-set-group'>
        <legend className='jv-set-legend'>Theme</legend>
        <div className='jv-theme-grid'>
            {THEMES.map((t) => (
                <label key={t.id} className={`jv-theme-card ${value === t.id ? "selected" : ""}`}>
                    <input
                        type='radio'
                        name='jv-theme'
                        value={t.id}
                        checked={value === t.id}
                        onChange={() => setPref("theme", t.id)}
                        aria-describedby={`jv-theme-${t.id}-d`}
                    />
                    <span
                        className='jv-theme-preview'
                        aria-hidden='true'
                        style={{ background: t.preview.panel, borderColor: t.preview.border }}
                    >
                        <span
                            className='jv-theme-preview-title'
                            style={{ background: t.preview.title, color: t.preview.titleFg }}
                        >
                            Aa
                        </span>
                        <span className='jv-theme-preview-body'>
                            <span style={{ background: t.preview.fg }} />
                            <span style={{ background: t.preview.fg, width: "60%" }} />
                            <span className='btn' style={{ background: t.preview.accent }} />
                        </span>
                    </span>
                    <span className='jv-theme-name'>{t.label}</span>
                    <span className='jv-sr-only' id={`jv-theme-${t.id}-d`}>
                        {t.description}
                    </span>
                </label>
            ))}
        </div>
    </fieldset>
)

const MOTION: { id: Prefs["reducedMotion"]; label: string; hint: string }[] = [
    { id: "system", label: "Follow my device", hint: "Uses your operating system's setting." },
    { id: "on", label: "Reduce motion", hint: "No fades, slides or shimmer. Changes happen instantly." },
    { id: "off", label: "Allow motion", hint: "Gentle animations, even if your device asks for less." },
]

// --------------------------------------------------------------- panels
const LookPanel: React.FC<{ prefs: Prefs }> = ({ prefs }) => {
    const { titleCards } = useStore(themeViewerStore)
    return (
        <>
            <ThemePicker value={prefs.theme} />
            <Slider
                label='Interface size'
                description='Makes panels, menus and buttons bigger for a screen across the table. Applies when you let go.'
                min={0.85}
                max={1.6}
                step={0.05}
                value={prefs.uiScale}
                format={pct}
                onCommit={(n) => setPref("uiScale", Math.round(n * 100) / 100)}
            />
            <Switch
                label='High contrast'
                description='Solid backgrounds, thicker borders and a bolder focus ring.'
                checked={prefs.highContrast}
                onChange={(on) => setPref("highContrast", on)}
            />
            <Switch
                label='Readable font'
                description='Replaces the pixel fonts everywhere with a plain, easy-to-read typeface.'
                checked={prefs.readableFont}
                onChange={(on) => setPref("readableFont", on)}
            />
            <Switch
                label='Colour-blind safe'
                description='Adds patterns, shapes and labels wherever colour carries meaning.'
                checked={prefs.colourblindSafe}
                onChange={(on) => setPref("colourblindSafe", on)}
            />
            <Switch
                label='CRT effect'
                description='Faint scanlines and darker corners, like an old monitor. Purely cosmetic and never flickers.'
                checked={prefs.crt}
                onChange={(on) => setPref("crt", on)}
            />
            <div className='jv-set-row-wrap'>
                <Switch
                    label='Title cards'
                    description='Shows the board or scene name for a moment when it opens. Click it or press Esc to skip.'
                    checked={titleCards}
                    onChange={(on) => themeViewerStore.set((s) => ({ ...s, titleCards: on }))}
                />
                <button
                    type='button'
                    className='jv-button jv-set-inline-button'
                    onClick={() => showTitleCard("The Sunken Vault", "Preview")}
                >
                    Preview
                </button>
            </div>
        </>
    )
}

const MotionPanel: React.FC<{ prefs: Prefs }> = ({ prefs }) => (
    <>
        <fieldset className='jv-set-group'>
            <legend className='jv-set-legend'>Motion</legend>
            <div className='jv-choice-list'>
                {MOTION.map((m) => (
                    <label key={m.id} className={`jv-choice ${prefs.reducedMotion === m.id ? "selected" : ""}`}>
                        <input
                            type='radio'
                            name='jv-motion'
                            value={m.id}
                            checked={prefs.reducedMotion === m.id}
                            onChange={() => setPref("reducedMotion", m.id)}
                        />
                        <span>
                            <strong>{m.label}</strong>
                            <small>{m.hint}</small>
                        </span>
                    </label>
                ))}
            </div>
        </fieldset>
        <Switch
            label='Sound effects'
            description='Short chiptune blips for dice, doors and turns. Off until you turn it on; nothing plays by itself.'
            checked={prefs.sound}
            onChange={(on) => {
                setPref("sound", on)
                if (on) playSfx("ui")
            }}
        />
        <Slider
            label='Volume'
            description='How loud sound effects and ambience play.'
            min={0}
            max={1}
            step={0.05}
            value={prefs.volume}
            disabled={!prefs.sound}
            format={pct}
            live
            onCommit={(n) => setPref("volume", n)}
        />
        <Switch
            label='Ambient sound'
            description='A quiet background loop for scenes that have one (only while sound effects are on).'
            checked={prefs.ambient}
            disabled={!prefs.sound}
            onChange={(on) => setPref("ambient", on)}
        />
    </>
)

const BehaviourPanel: React.FC<{ prefs: Prefs }> = ({ prefs }) => (
    <>
        <Switch
            label='Hints and hotkey labels'
            description='Shows tips on hover and the keyboard shortcut on each tool button.'
            checked={prefs.hints}
            onChange={(on) => setPref("hints", on)}
        />
        <Switch
            label='Confirm before permanent actions'
            description="Asks first before something that undo can't bring back. Everything else can be undone."
            checked={prefs.confirmDestructive}
            onChange={(on) => setPref("confirmDestructive", on)}
        />
        <p className='jv-set-note'>
            These settings are saved in this browser only, for whoever is using this screen. They never
            change the board.
        </p>
    </>
)

// --------------------------------------------------------------- dialog
export const SettingsDialog: React.FC = () => {
    const prefs = usePrefs()
    const { settingsTab } = useStore(themeViewerStore)
    const dialogRef = useRef<HTMLDivElement>(null)
    const tabRefs = useRef<Record<string, HTMLButtonElement | null>>({})
    const close = () => settingsOpenStore.set(false)

    // Move focus in on open and give it back on close
    useEffect(() => {
        const previous = document.activeElement as HTMLElement | null
        tabRefs.current[themeViewerStore.get().settingsTab]?.focus()
        return () => {
            if (previous && document.contains(previous)) previous.focus()
        }
    }, [])

    const setTab = (id: SettingsTab, focus = false) => {
        themeViewerStore.set((s) => ({ ...s, settingsTab: id }))
        if (focus) tabRefs.current[id]?.focus()
    }

    const onTabKey = (e: React.KeyboardEvent, index: number) => {
        const last = TABS.length - 1
        const to =
            e.key === "ArrowRight" ? (index === last ? 0 : index + 1)
            : e.key === "ArrowLeft" ? (index === 0 ? last : index - 1)
            : e.key === "Home" ? 0
            : e.key === "End" ? last
            : null
        if (to === null) return
        e.preventDefault()
        setTab(TABS[to].id, true)
    }

    // Keys stay inside the dialog: Esc and ⌘, close, Tab wraps around,
    // and nothing reaches the board's hotkeys underneath.
    const onKeyDown = (e: React.KeyboardEvent) => {
        e.stopPropagation()
        const mod = e.metaKey || e.ctrlKey
        if (e.key === "Escape" || (mod && e.key === ",")) {
            e.preventDefault()
            close()
            return
        }
        if (e.key !== "Tab" || !dialogRef.current) return
        const items = Array.from(dialogRef.current.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
            (el) => el.offsetParent !== null || el === document.activeElement
        )
        if (!items.length) return
        const first = items[0]
        const last = items[items.length - 1]
        if (e.shiftKey && document.activeElement === first) {
            e.preventDefault()
            last.focus()
        } else if (!e.shiftKey && document.activeElement === last) {
            e.preventDefault()
            first.focus()
        }
    }

    const tab = TABS.some((t) => t.id === settingsTab) ? settingsTab : "look"

    return (
        <div className='jv-settings-backdrop' onMouseDown={(e) => e.target === e.currentTarget && close()}>
            <div
                ref={dialogRef}
                className='jv-settings jv-window'
                role='dialog'
                aria-modal='true'
                aria-labelledby='jv-settings-title'
                onKeyDown={onKeyDown}
            >
                <header className='jv-titlebar jv-settings-titlebar'>
                    <Icon name='gear' size={22} />
                    <h2 id='jv-settings-title' className='jv-display'>
                        Settings
                    </h2>
                    <button type='button' className='jv-close' aria-label='Close settings' onClick={close}>
                        <Icon name='close' size={18} />
                    </button>
                </header>
                <div className='jv-tabs' role='tablist' aria-label='Settings sections'>
                    {TABS.map((t, i) => (
                        <button
                            key={t.id}
                            ref={(el) => {
                                tabRefs.current[t.id] = el
                            }}
                            type='button'
                            role='tab'
                            id={`jv-tab-${t.id}`}
                            aria-selected={tab === t.id}
                            aria-controls={`jv-panel-${t.id}`}
                            tabIndex={tab === t.id ? 0 : -1}
                            className={`jv-tab ${tab === t.id ? "active" : ""}`}
                            onClick={() => setTab(t.id)}
                            onKeyDown={(e) => onTabKey(e, i)}
                        >
                            {t.label}
                        </button>
                    ))}
                </div>
                <div
                    className='jv-settings-body'
                    role='tabpanel'
                    id={`jv-panel-${tab}`}
                    aria-labelledby={`jv-tab-${tab}`}
                >
                    {tab === "look" && <LookPanel prefs={prefs} />}
                    {tab === "motion" && <MotionPanel prefs={prefs} />}
                    {tab === "behaviour" && <BehaviourPanel prefs={prefs} />}
                </div>
            </div>
        </div>
    )
}
