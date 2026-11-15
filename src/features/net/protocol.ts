import type { LightSource, Point } from "../../types/humbug.types"

/*
 * Messages between the GM's app (host) and players' apps.
 * The GM is the only source of truth; players send requests.
 */

/** The GM's table rules, as they apply to one player */
export interface PlayerRules {
    /** Tokens this player may have on the table */
    maxTokens: number
    /** The GM has frozen this player's tokens (no moving or placing) */
    frozen: boolean
    /** Tokens may only move where the party can see (or the GM revealed) */
    fenced: boolean
    /** New tokens wait for the GM's OK */
    approve: boolean
}

/** Host -> player: changed parts of the shared board (filtered for players) */
export interface StateMsg {
    rev: number
    /** The receiving player's device id (their own tokens are editable) */
    you: string
    slices: Record<string, unknown>
    /** Sent when they change */
    rules?: PlayerRules
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
    /** A change to this token was refused: show it where the GM has it */
    revert?: string
}

/** Player -> host */
export type PlayerRequest =
    /** Handshake done and listening: send me the whole board */
    | { t: "ready" }
    /** Put a character on the table at `at` (top-left, world units) */
    | {
          t: "add-token"
          name: string
          image: string
          at?: Point
          /** The player's character id (so the app knows it's on the table) */
          char?: string
          light?: LightSource | null
          vision?: number
      }
    | { t: "patch"; id: string; position?: Point; light?: LightSource | null; vision?: number; name?: string }
    /** Take one of my tokens off the table */
    | { t: "remove"; id: string }
    /** A roll made on the player's computer, for the log and the GM's audit */
    | { t: "roll"; text: string; roll?: unknown }

/** Assets (images) travel separately and only once, by id */
export const ASSET_PREFIX = "jewel-asset:"

/** Extension data on humbugs */
export interface NetExt {
    /** Device id of the player who controls this token */
    owner?: string
    /** The player's own character id it was placed from */
    char?: string
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
    // The GM's sight walls (players get the fog with sight already worked out)
    "fog-light:walls",
])

/** Board parts a player keeps for themselves (not overwritten by the GM) */
export const PLAYER_LOCAL_SLICES = new Set(["viewport", "viewMode"])

/** Tokens per player unless the GM changes it */
export const DEFAULT_MAX_TOKENS = 4
/** The most the GM can allow */
export const MAX_TOKENS_LIMIT = 12
