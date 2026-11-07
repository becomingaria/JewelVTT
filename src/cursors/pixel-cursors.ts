/*
 * Retro pixel-art cursors.
 *
 * Each sprite is ASCII pixel art: one character per pixel, "." is
 * transparent and every other character maps to a colour in PALETTE.
 * Sprites are rendered to crisp SVG data URIs at PIXEL_SCALE and exposed
 * to CSS as custom properties on :root, e.g.
 *
 *     cursor: var(--cursor-pointer, pointer);
 *
 * Tweak the art below and the whole app picks it up on reload.
 */

const PIXEL_SCALE = 1

const PALETTE: Record<string, string> = {
    K: "#1b1420", // outline
    W: "#fffaf0", // white
    // Gauntlet steel, dark to light
    "1": "#353d47",
    "2": "#5a6571",
    "3": "#8794a1",
    "4": "#b4bfca",
    "5": "#dde4ea",
    "6": "#ffffff",
    y: "#ffe08a", // gold highlight
    Y: "#f7c531", // gold
    O: "#c77d12", // gold shade
    B: "#8a5a2b", // wood
    b: "#5e3a17", // wood shade
    S: "#b8c4cc", // metal
    P: "#f39ac0", // eraser pink
    p: "#c76b93", // eraser shade
    w: "#f1cf96", // bare wood
    g: "#3a3a40", // graphite
    V: "#8e44ad", // paint
    v: "#5e2a75", // paint shade
}

interface Sprite {
    art: string[]
    /** Hotspot in sprite pixels */
    hotspot: [number, number]
    /** Screen pixels per art pixel (default PIXEL_SCALE) */
    scale?: number
    fallback: string
}

const SPRITES: Record<string, Sprite> = {
    // 2.5D steel gauntlet pointing the way, tilted 45° left like a classic
    // arrow cursor: the everyday cursor.
    // Drawn at 1x for fine detail (lit from the upper left; 1-6 = steel
    // tones dark to light, Y/y/O = gold trim). Generated with a small
    // part-based sprite tool, then committed as plain pixel art.
    default: {
        hotspot: [2, 0],
        scale: 1,
        fallback: "default",
        art: [
            "..KKK............K..........",
            ".K222K.........KK2K.........",
            "K43222K.....KKK4K11K........",
            "K643211K..KK332K3KK2K.......",
            "K5441122KK32K3K333322K......",
            ".K5113222K331K33533222K.....",
            "..K1543221K1K4353332222K....",
            "...K5443112K445333322KK.K...",
            "....K54112K445333332KOOK2KK.",
            ".....K115K44543y333KOO2222OK",
            "......KKK4KK443OO3KYY2222OK.",
            "......K33K22K4333KYY3322OK..",
            ".....K4333222K33KYY3333OK...",
            "....K464333222KKYY3333OK....",
            "....K56443332KKYY4433YK.....",
            ".....K544433KKyY4444YK......",
            "......KKKKKKKyy5444YK.......",
            "..........KKyy5554YK........",
            "...........KK5555YK.........",
            "............K555YK..........",
            ".............K5YK...........",
            ".............KYK............",
            "..............K.............",
        ],
    },

    // Same gauntlet with a gold glint over clickable things
    pointer: {
        hotspot: [2, 1],
        scale: 1,
        fallback: "pointer",
        art: [
            "......Y.....................",
            "..KKKYyY.........K..........",
            ".K222KY........KK2K.........",
            "K43222K.....KKK4K11K........",
            "K643211K..KK332K3KK2K.......",
            "K5441122KK32K3K333322K......",
            ".K5113222K331K33533222K.....",
            "..K1543221K1K4353332222K....",
            "...K5443112K445333322KK.K...",
            "....K54112K445333332KOOK2KK.",
            ".....K115K44543y333KOO2222OK",
            "......KKK4KK443OO3KYY2222OK.",
            "......K33K22K4333KYY3322OK..",
            ".....K4333222K33KYY3333OK...",
            "....K464333222KKYY3333OK....",
            "....K56443332KKYY4433YK.....",
            ".....K544433KKyY4444YK......",
            "......KKKKKKKyy5444YK.......",
            "..........KKyy5554YK........",
            "...........KK5555YK.........",
            "............K555YK..........",
            ".............K5YK...........",
            ".............KYK............",
            "..............K.............",
        ],
    },

    // Open gauntlet: something can be grabbed / the board can be panned
    grab: {
        hotspot: [11, 13],
        scale: 1,
        fallback: "grab",
        art: [
            ".........K432KKK.......",
            "......KKK56322K3K......",
            ".....K432K4322K32K.....",
            "....K56322K322K32KK....",
            "....K54322K322K32K3K...",
            "....K54322K111K32K32K..",
            "....K11111K322K11K32K..",
            "....K55322K322K32K32K..",
            "KKK.K54322K322K32K11K..",
            "544KK54322K322K32K32K..",
            "5643K11111K111K32K32K..",
            "54433KKKKKKKKKKKKK32K..",
            "K44332K44444443333K2K..",
            ".K43322K55555555533KK..",
            "..K3322K444433333332K..",
            "...K322K444yO3333322K..",
            "...KKKK4443O33333222K..",
            "...K4444433333332222K..",
            "...K4KKKKKKKKKKKKKK2K..",
            "....KyyyYYYYYYYYOOOK...",
            "....K55544443333222K...",
            "...K5555444433332222K..",
            "...K5555444433332222K..",
            "..KYYYYYYYYYYYYOOOOOOK.",
            "...KKKKKKKKKKKKKKKKKK..",
            ".......................",
        ],
    },

    // Closed gauntlet while dragging
    grabbing: {
        hotspot: [10, 12],
        scale: 1,
        fallback: "grabbing",
        art: [
            ".....................",
            ".....................",
            ".....................",
            ".....................",
            ".........KK.KK.......",
            "......KKK43K43KKK....",
            ".....K43K632K32K3K...",
            "....K5632K11K11K32K..",
            ".KKKKKKKKKKKKKKKK1K..",
            "K5443KK4444443333KK..",
            "K564333KK555555533K..",
            ".K4433322K433333332K.",
            "..K433322K3yO333322K.",
            "..KKKKKKK33O3333222K.",
            "..K4444433333332222K.",
            "..K4KKKKKKKKKKKKKK2K.",
            "...KyyyYYYYYYYYOOOK..",
            "...K55544443333222K..",
            "..K5555444433332222K.",
            "..K5555444433332222K.",
            ".KYYYYYYYYYYYYOOOOOOK",
            "..KKKKKKKKKKKKKKKKKK.",
        ],
    },

    // Pencil for scribble layers: graphite tip is the hotspot
    pencil: {
        hotspot: [0, 15],
        scale: 1,
        fallback: "crosshair",
        art: [
            "............KK..",
            "...........KPPK.",
            "..........KPPpK.",
            ".........KSSpK..",
            "........KYSSK...",
            ".......KYYOK....",
            "......KYYOK.....",
            ".....KYYOK......",
            "....KYYOK.......",
            "...KYYOK........",
            "..KwwOK.........",
            "..KwwK..........",
            ".KwgK...........",
            ".KgK............",
            "KgK.............",
            "KK..............",
        ],
    },

    // Paintbrush: tip is the hotspot
    paint: {
        hotspot: [0, 15],
        scale: 1,
        fallback: "crosshair",
        art: [
            "............KK..",
            "...........KBBK.",
            "..........KBBbK.",
            ".........KBBbK..",
            "........KBBbK...",
            ".......KBBbK....",
            "......KSSbK.....",
            ".....KSSSK......",
            "....KVSSK.......",
            "...KVVVK........",
            "..KVVVvK........",
            "..KVVvK.........",
            ".KVVvK..........",
            ".KVvK...........",
            "KvKK............",
            "KK..............",
        ],
    },

    // Eraser block: leading corner is the hotspot
    erase: {
        hotspot: [2, 13],
        scale: 1,
        fallback: "crosshair",
        art: [
            ".........KKK....",
            "........KPPPK...",
            ".......KPPPPPK..",
            "......KPPPPPPPK.",
            ".....KPPPPPPPpK.",
            "....KSSPPPPPpK..",
            "...KSSSSPPPpK...",
            "..KWSSSSSPpK....",
            ".KWWWSSSSpK.....",
            "KWWWWWSSpK......",
            "KWWWWWWSK.......",
            ".KWWWWWK........",
            "..KWWWK.........",
            "...KKK..........",
        ],
    },
}

function spriteToSvg({ art, scale = PIXEL_SCALE }: Sprite): string {
    const height = art.length
    const width = Math.max(...art.map((row) => row.length))
    const rects: string[] = []

    art.forEach((row, y) => {
        // Merge horizontal runs of the same colour into one rect
        let x = 0
        while (x < row.length) {
            const ch = row[x]
            let run = 1
            while (row[x + run] === ch) run++
            const fill = PALETTE[ch]
            if (ch !== "." && fill) {
                rects.push(
                    `<rect x="${x}" y="${y}" width="${run}" height="1" fill="${fill}"/>`
                )
            }
            x += run
        }
    })

    return (
        `<svg xmlns="http://www.w3.org/2000/svg" width="${width * scale}" ` +
        `height="${height * scale}" viewBox="0 0 ${width} ${height}" ` +
        `shape-rendering="crispEdges">${rects.join("")}</svg>`
    )
}

function cursorValue(sprite: Sprite): string {
    const uri = `data:image/svg+xml,${encodeURIComponent(spriteToSvg(sprite))}`
    const [hx, hy] = sprite.hotspot
    const scale = sprite.scale ?? PIXEL_SCALE
    return `url("${uri}") ${hx * scale} ${hy * scale}, ${sprite.fallback}`
}

/** Publish the cursors as CSS custom properties (--cursor-<name>) */
export function installPixelCursors(root: HTMLElement = document.documentElement) {
    for (const [name, sprite] of Object.entries(SPRITES)) {
        root.style.setProperty(`--cursor-${name}`, cursorValue(sprite))
    }
}

/** Exposed for the cursor preview / tests */
export const PIXEL_CURSOR_NAMES = Object.keys(SPRITES)
