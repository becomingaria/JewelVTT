import type React from "react"
import type { IconName } from "../components/Icon"
import type { Humbug } from "../types/humbug.types"
import type { BoardCamera } from "./board-bridge"
import type { MapKind, MapKindDefaults } from "./map-kind"
import type { Store } from "./store"

/*
 * A feature plugs into the app through one FeatureModule (its folder's
 * index.ts). The host mounts its pieces; nothing else needs editing.
 *
 * See src/features/README.md for the rules every feature follows.
 */

export interface HotkeySpec {
    /** KeyboardEvent.key, lower-case for letters ("r", "?", "Enter") */
    key: string
    /** Cmd on Mac, Ctrl elsewhere */
    mod?: boolean
    shift?: boolean
    alt?: boolean
}

export type ToolGroup = "build" | "play" | "view"

export interface ToolDef {
    id: string
    label: string
    /** Built-in icon name, or your own 24×24 SVG element */
    icon: IconName | React.ReactElement
    /** One-line hint shown in the tooltip */
    hint?: string
    hotkey?: HotkeySpec
    /** Only offered on these map kinds (undefined = every kind) */
    mapKinds?: MapKind[]
    group: ToolGroup
    /**
     * "mode": becomes the active board tool (one at a time, Esc clears;
     *         read it with useActiveTool()).
     * "action": runs onTrigger (open a panel, roll, toggle something).
     */
    kind: "mode" | "action"
    onTrigger?: () => void
    /** For "action" tools that toggle something: drives aria-pressed */
    pressed?: Store<boolean>
}

export interface CommandDef {
    id: string
    label: string
    /** Extra words the command palette matches on */
    keywords?: string
    hotkey?: HotkeySpec
    mapKinds?: MapKind[]
    run: () => void
}

/** Extra entry in the humbug right-click menu (and the radial menu) */
export interface HumbugMenuItem {
    id: string
    label: string
    icon: IconName | React.ReactElement
    /** Only shown when this returns true (default: always) */
    when?: (h: Humbug) => boolean
    run: (h: Humbug) => void
}

export interface HelpSection {
    id: string
    title: string
    icon: IconName
    body: React.ReactNode
}

export interface BoardOverlayProps {
    camera: BoardCamera
}

export interface TokenBadgeProps {
    humbug: Humbug
    /** Current zoom, for sizing */
    scale: number
}

export interface FeatureModule {
    id: string
    /** Mounted once at the app root: panels, HUD, dialogs, background logic */
    AppLayer?: React.ComponentType
    /**
     * Mounted inside the board container, above the humbugs. Absolutely
     * position yourself (inset: 0). Keep pointer-events: none unless your
     * mode tool is active.
     */
    BoardOverlay?: React.ComponentType<BoardOverlayProps>
    /** Stacking among overlays (higher = on top). Light 20, fog 30, measure 50 */
    overlayZ?: number
    /**
     * Mounted inside the board container BELOW the humbugs (floors, terrain,
     * slide frames). Draw only; put pointer handling in your BoardOverlay.
     */
    BoardUnderlay?: React.ComponentType<BoardOverlayProps>
    /** Stacking among underlays: hex terrain 10, slide frames 15, dungeon floor 20 */
    underlayZ?: number
    /** Drawn on every humbug (return null when it doesn't apply) */
    HumbugBadge?: React.ComponentType<TokenBadgeProps>
    tools?: ToolDef[]
    commands?: CommandDef[]
    humbugMenu?: HumbugMenuItem[]
    help?: HelpSection[]
    /** Refine the defaults a new board of each kind starts with */
    mapKindDefaults?: Partial<Record<MapKind, Partial<MapKindDefaults>>>
}
