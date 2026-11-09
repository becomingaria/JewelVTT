import React, { useSyncExternalStore } from "react"
import { FEATURES, formatHotkeySpec } from "../registry"
import { useMapKind } from "../map-kind"
import { toggleActiveTool, useActiveTool, useTableMode } from "../view-state"
import { usePrefs } from "../prefs"
import { createStore, type Store } from "../store"
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

const DockButton: React.FC<{ tool: ToolDef; active: boolean; hints: boolean }> = ({
    tool,
    active,
    hints,
}) => {
    const pressed = usePressed(tool.pressed)
    const on = tool.kind === "mode" ? active : pressed
    const key = tool.hotkey ? formatHotkeySpec(tool.hotkey) : null
    const tip = `${tool.label}${key && hints ? ` (${key})` : ""}${tool.hint ? ` — ${tool.hint}` : ""}`
    return (
        <button
            type='button'
            className={`tool-dock-btn ${on ? "on" : ""}`}
            aria-pressed={tool.kind === "mode" || tool.pressed ? on : undefined}
            aria-label={tool.label}
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
    const tableMode = useTableMode()
    const { hints } = usePrefs()

    const tools = FEATURES.flatMap((f) => f.tools ?? []).filter(
        (t) => !t.mapKinds || t.mapKinds.includes(kind)
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
