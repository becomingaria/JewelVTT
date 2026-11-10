import React, { useSyncExternalStore } from "react"
import { FEATURES, formatHotkeySpec } from "../registry"
import { useMapKind } from "../map-kind"
import { PLAYER_ALLOWED, tableModeStore, toggleActiveTool, useActiveTool, useNetRole } from "../view-state"
import { usePrefs } from "../prefs"
import { createStore, useStore, type Store } from "../store"
import type { ToolDef, ToolGroup } from "../types"
import { FeatureIcon } from "./FeatureIcon"
import "./ToolDock.css"

const GROUPS: { id: ToolGroup; label: string }[] = [
    { id: "build", label: "Build" },
    { id: "play", label: "Play" },
    { id: "view", label: "View" },
]

const NEVER = createStore(false)
const usePressed = (s: Store<boolean> | undefined) =>
    useSyncExternalStore((s ?? NEVER).subscribe, (s ?? NEVER).get)
const NO_LABEL = createStore("")
const useLiveLabel = (s: Store<string> | undefined) =>
    useSyncExternalStore((s ?? NO_LABEL).subscribe, (s ?? NO_LABEL).get)

const DockButton: React.FC<{ tool: ToolDef; active: boolean; hints: boolean }> = ({
    tool,
    active,
    hints,
}) => {
    const pressed = usePressed(tool.pressed)
    const label = useLiveLabel(tool.labelStore) || tool.label
    const on = tool.kind === "mode" ? active : pressed
    const key = tool.hotkey ? formatHotkeySpec(tool.hotkey) : null
    const tip = `${label}${key && hints ? ` (${key})` : ""}${tool.hint ? ` — ${tool.hint}` : ""}`
    return (
        <button
            type='button'
            className={`tool-dock-btn ${on ? "on" : ""}`}
            aria-pressed={tool.kind === "mode" || tool.pressed ? on : undefined}
            aria-label={label}
            aria-keyshortcuts={key ?? undefined}
            title={tip}
            onClick={() => (tool.kind === "mode" ? toggleActiveTool(tool.id) : tool.onTrigger?.())}
        >
            <FeatureIcon icon={tool.icon} size={22} className={on ? "jicon-play" : ""} />
            {hints && key && <span className='tool-dock-key' aria-hidden='true'>{key}</span>}
        </button>
    )
}

/** Vertical dock on the left edge: every feature's tools for this map kind */
export const ToolDock: React.FC = () => {
    const kind = useMapKind()
    const active = useActiveTool()
    const tableMode = useStore(tableModeStore)
    const player = useNetRole() === "player"
    const { hints } = usePrefs()

    const tools = FEATURES.flatMap((f) => f.tools ?? []).filter(
        (t) => (!t.mapKinds || t.mapKinds.includes(kind)) && (!player || PLAYER_ALLOWED.tools.has(t.id))
    )
    if (!tools.length) return null

    return (
        <nav
            className={`tool-dock ${tableMode ? "tool-dock--table" : ""}`}
            aria-label='Board tools'
        >
            {GROUPS.map((g) => {
                const group = tools.filter((t) => t.group === g.id)
                if (!group.length) return null
                return (
                    <div key={g.id} className='tool-dock-group' role='group' aria-label={g.label}>
                        {group.map((t) => (
                            <DockButton key={t.id} tool={t} active={active === t.id} hints={hints} />
                        ))}
                    </div>
                )
            })}
        </nav>
    )
}
