import type { MapKind } from "../map-kind"

export const FEATURE_ID = "fog-light"
export const FOG_TOOL_ID = "fog-light:brush"
export const DARK_TOOL_ID = "fog-light:darkness"

/** Fog makes sense on maps, not on slide decks */
export const FOG_KINDS: MapKind[] = ["freeform", "dungeon", "hexcrawl"]
/** Light radii are in feet: square-grid maps only */
export const LIGHT_KINDS: MapKind[] = ["freeform", "dungeon"]
