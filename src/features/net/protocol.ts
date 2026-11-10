import type { LightSource, Point } from "../../types/humbug.types"

/*
 * Messages between the GM's app (host) and players' apps.
 * The GM is the only source of truth; players send requests.
 */

/** Host -> player: changed parts of the shared board (filtered for players) */
export interface StateMsg {
    rev: number
    /** The receiving player's device id (their own tokens are editable) */
    you: string
    slices: Record<string, unknown>
}

/** Host -> players: the GM's view, while the GM shares it */
export interface ShareMsg {
    sharing: boolean
    /** World-space centre and size of the GM's view */
    view?: { x: number; y: number; width: number; height: number }
}

/** Host -> player */
export interface NoticeMsg {
    kind: "kicked" | "banned" | "migrate" | "ended" | "toast"
    /** New room link (migrate) */
    code?: string
    text?: string
}

/** Player -> host */
export type PlayerRequest =
    /** Handshake done and listening: send me the whole board */
    | { t: "ready" }
    | { t: "add-token"; name: string; image: string }
    | { t: "patch"; id: string; position?: Point; light?: LightSource | null; vision?: number }
    /** A roll made on the player's computer, for the log and the GM's audit */
    | { t: "roll"; text: string; roll?: unknown }

/** Assets (images) travel separately and only once, by id */
export const ASSET_PREFIX = "jewel-asset:"

/** Extension data on humbugs */
export interface NetExt {
    /** Device id of the player who controls this token */
    owner?: string
}

export const NET_EXT = "net"

/** Board parts never sent to players: the GM's private tools and notes */
export const PRIVATE_SLICES = new Set([
    "viewport",
    "viewMode",
    "spots",
    "table-slides:frames",
    "tracker:dungeon",
    "workflow:layers",
])

/** Board parts a player keeps for themselves (not overwritten by the GM) */
export const PLAYER_LOCAL_SLICES = new Set(["viewport", "viewMode"])

/** At most this many tokens per player */
export const MAX_TOKENS_PER_PLAYER = 4
