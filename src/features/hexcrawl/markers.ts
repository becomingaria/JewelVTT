/*
 * Hex feature markers: original 16×16 pixel sprites, placed on the board
 * as image humbugs (SVG data URLs) tagged with ext.hexcrawl.
 */

import { glyphToSvg, svgDataUrl, type Glyph } from "./pixels"

export type MarkerKind =
    | "village"
    | "town"
    | "city"
    | "castle"
    | "tower"
    | "ruin"
    | "dungeon"
    | "lair"
    | "shrine"
    | "cave"
    | "landmark"

/** What a marker humbug stores in ext.hexcrawl */
export interface MarkerExt {
    marker: MarkerKind
    label?: string
    /** Hex number shown with the label, e.g. "0304" */
    number?: string
    /** Placed by the overland generator (so a regenerate can replace it) */
    generated?: boolean
}

const PALETTE: Record<string, string> = {
    k: "#2a1e14",
    w: "#ece0c4",
    g: "#b8a684",
    r: "#c0482e",
    R: "#86301e",
    b: "#3a62c0",
    y: "#e8b030",
    d: "#141010",
    s: "#a8a294",
    S: "#6a645a",
    G: "#4a8a3a",
    f: "#f08a20",
    F: "#ffd84a",
    x: "#f2ecd8",
    p: "#7a3aa8",
}

const SPRITES: Record<MarkerKind, Glyph> = {
    village: [
        "................",
        "................",
        "................",
        "...kk...........",
        "..krrk..........",
        ".krrrrk.........",
        "kRRRRRRk...kk...",
        ".kwwwgk...krrk..",
        ".kwkkgk..krrrrk.",
        ".kwkdgk.kRRRRRRk",
        ".kkkkkk..kwwwgk.",
        "..G...G..kwkkgk.",
        ".GGG.GGG.kwkdgk.",
        "..........kkkkk.",
    ],
    town: [
        "......k.........",
        ".....kyk........",
        "......k.........",
        ".....krk........",
        "....krrrk.......",
        "...kRRRRRk......",
        "...kwwkwgk..kk..",
        "...kwwkwgk.krrk.",
        "kk.kwwwwgkkrrrrk",
        "rrkkwwkkgkRRRRRR",
        "RRRkwwkdgkkwwwgk",
        "wwgkwwkdgkkwkkgk",
        "wkgkkkkkkkkwkdgk",
        "kkkk......kkkkkk",
    ],
    city: [
        "..k.........k...",
        ".kbk.......kbk..",
        "..k....k....k...",
        ".kkk..kyk..kkk..",
        "kk.kk.kkk.kk.kk.",
        "kwwgk.kwk.kwwgk.",
        "kwkgkkkwkkkwkgk.",
        "kwwgkwkkkwkwwgk.",
        "kwwgwwwwwwgwwgk.",
        "kwkgwkwwwkgwkgk.",
        "kwwgwwkddkgwwgk.",
        "kwwgwkddddkwwgk.",
        "kkkkkkddddkkkkk.",
        "................",
    ],
    castle: [
        "......kk........",
        "......kbbk......",
        "......kbbbk.....",
        "......kk........",
        "..k.k.kk.k.k....",
        "..kkkkkkkkkk....",
        "..kwwwgwwwgk....",
        "..kwkkgwkkgk....",
        "k.kwwwgwwwgk.k..",
        "kkkwwwgwwwgkkk..",
        "kwwwwkddkwwwgk..",
        "kwwwkddddkwwgk..",
        "kkkkkddddkkkkk..",
        "................",
    ],
    tower: [
        ".......k........",
        "......krk.......",
        ".....krrRk......",
        "....krrrRRk.....",
        "...kkkkkkkkk....",
        "....kwwwwgk.....",
        "....kwkkwgk.....",
        "....kwwwwgk.....",
        "....kwwwwgk.....",
        "....kwwkwgk.....",
        "....kwwwwgk.....",
        "....kwkdkgk.....",
        "...kkkdddkkk....",
        "................",
    ],
    ruin: [
        "................",
        "................",
        "..kkk...........",
        "..ksk......kk...",
        "..ksSk....kssk..",
        "..ksSk....kssk..",
        "..ksSk.....ksk..",
        "..ksSk.....ksk..",
        "..ksSk..k..ksSk.",
        "..ksSk.kskkksSk.",
        "G.ksSkkssskksSk.",
        "GGkkkkkkkkkkkkkG",
        "..G...........GG",
        "................",
    ],
    dungeon: [
        "................",
        "................",
        "....kkkkkkk.....",
        "...kssssSSSk....",
        "..ksskkkkkSSk...",
        "..kskdddddkSk...",
        ".kskddddddkSSk..",
        ".kskdkkkkdkSSk..",
        ".kskddddddkSSk..",
        ".kskdkkkkkkSSk..",
        ".kskddddddkSSk..",
        ".kskkkkkkkkSSk..",
        ".kkkkkkkkkkkkk..",
        "................",
    ],
    lair: [
        "................",
        "....kkkkkkk.....",
        "...kxxxxxxxk....",
        "..kxxxxxxxxgk...",
        "..kxkkxxkkxgk...",
        "..kxkdxxkdxgk...",
        "..kxkkxxkkxgk...",
        "..kxxxxkxxxgk...",
        "...kxxkkkxgk....",
        "....kxkxkxk.....",
        "....kxkxkxk.....",
        ".k...kkkkk...k..",
        "kxk.........kxk.",
        ".kxk.......kxk..",
    ],
    shrine: [
        ".......k........",
        "......kFk.......",
        ".....kFfFk......",
        "......kfk.......",
        ".....kkkkk......",
        "....kwwwwgk.....",
        "...kkkkkkkkk....",
        "...kwkwkwkgk....",
        "...kwkwkwkgk....",
        "...kwkwkwkgk....",
        "...kwkwkwkgk....",
        "..kkkkkkkkkkk...",
        ".kwwwwwwwwwggk..",
        ".kkkkkkkkkkkkk..",
    ],
    cave: [
        "................",
        "................",
        "......kkkk......",
        "....kkssssk.....",
        "...kssssSSSk....",
        "..ksssssSSSSk...",
        "..kssskkkSSSk...",
        ".ksssk...kSSSk..",
        ".kssk.ddd.kSSk..",
        "kssskddddd.kSSk.",
        "ksssk.dddd.kSSk.",
        "kssskdddddkSSSk.",
        "kkkkkkkkkkkkkkk.",
        "................",
    ],
    landmark: [
        "................",
        "......kkk.......",
        ".....kssSk......",
        ".....ksSSk......",
        ".....ksSSk......",
        ".....kspSk......",
        ".....ksSSk......",
        ".....kspSk......",
        ".....ksSSk......",
        "....kssSSSk.....",
        "....kssSSSk.....",
        "...kssssSSSk....",
        "..GkkkkkkkkkG...",
        ".GGG.......GGG..",
    ],
}

export interface MarkerInfo {
    kind: MarkerKind
    label: string
    /** Settlement or adventure site (generator placement) */
    group: "settlement" | "site"
}

export const MARKERS: MarkerInfo[] = [
    { kind: "village", label: "Village", group: "settlement" },
    { kind: "town", label: "Town", group: "settlement" },
    { kind: "city", label: "City", group: "settlement" },
    { kind: "castle", label: "Castle", group: "settlement" },
    { kind: "tower", label: "Tower", group: "site" },
    { kind: "ruin", label: "Ruin", group: "site" },
    { kind: "dungeon", label: "Dungeon entrance", group: "site" },
    { kind: "lair", label: "Lair", group: "site" },
    { kind: "shrine", label: "Shrine", group: "site" },
    { kind: "cave", label: "Cave", group: "site" },
    { kind: "landmark", label: "Landmark", group: "site" },
]

export const markerInfo = (k: MarkerKind) => MARKERS.find((m) => m.kind === k) ?? MARKERS[0]

export const isMarkerKind = (v: unknown): v is MarkerKind =>
    typeof v === "string" && MARKERS.some((m) => m.kind === v)

export const markerSvg = (k: MarkerKind) =>
    glyphToSvg(SPRITES[k], PALETTE, { halo: "#f7efdc", title: markerInfo(k).label })

const urlCache = new Map<MarkerKind, string>()
export function markerDataUrl(k: MarkerKind): string {
    let url = urlCache.get(k)
    if (!url) {
        url = svgDataUrl(markerSvg(k))
        urlCache.set(k, url)
    }
    return url
}

/** World size of a marker humbug (a hex is 32 wide) */
export const MARKER_SIZE = 26
