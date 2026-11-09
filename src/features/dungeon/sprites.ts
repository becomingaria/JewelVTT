import type { StampId, StampState } from "./model"

/*
 * Original 16×16 pixel sprites for dungeon stamps, drawn in code and turned
 * into tiny SVGs (one <path> per colour, crisp edges). One sprite covers
 * one grid square. Door-like sprites are drawn for a north-south passage;
 * the humbug is rotated 90° for east-west ones.
 *
 * Every state has its own silhouette (not only its own colour): a padlock
 * sticks out of a locked door, iron straps out of a barred one, hidden
 * things get a dotted frame.
 */

const N = 16

const PALETTE = {
    k: "#1b1b24", // ink
    w: "#fbf8ee", // paper
    l: "#cfcbc0", // light stone
    s: "#a9a397", // stone
    g: "#7a766e", // grey
    d: "#4a4844", // iron
    b: "#a0662f", // wood
    n: "#5e3a1c", // dark wood
    y: "#e2b43c", // gold
    r: "#b3302a", // red
    u: "#3c78c4", // water
    c: "#a6d0f0", // light water
    p: "#efe6cc", // bone
} as const

type Colour = keyof typeof PALETTE
type Px = Colour | null

class Sprite {
    px: Px[] = new Array(N * N).fill(null)

    get(x: number, y: number): Px {
        return x < 0 || y < 0 || x >= N || y >= N ? null : this.px[y * N + x]
    }
    set(x: number, y: number, c: Px) {
        if (x >= 0 && y >= 0 && x < N && y < N) this.px[y * N + x] = c
        return this
    }
    rect(x: number, y: number, w: number, h: number, c: Px) {
        for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) this.set(i, j, c)
        return this
    }
    /** Filled disc; centre in pixel units (8,8 = middle of the sprite) */
    disc(cx: number, cy: number, r: number, c: Px) {
        for (let y = 0; y < N; y++)
            for (let x = 0; x < N; x++) if (Math.hypot(x + 0.5 - cx, y + 0.5 - cy) <= r) this.set(x, y, c)
        return this
    }
    /** One-pixel ring */
    ring(cx: number, cy: number, r: number, c: Px) {
        for (let y = 0; y < N; y++)
            for (let x = 0; x < N; x++) {
                const d = Math.hypot(x + 0.5 - cx, y + 0.5 - cy)
                if (d <= r && d > r - 1) this.set(x, y, c)
            }
        return this
    }
    line(x0: number, y0: number, x1: number, y1: number, c: Px) {
        const steps = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0))
        for (let i = 0; i <= steps; i++) {
            const t = steps ? i / steps : 0
            this.set(Math.round(x0 + (x1 - x0) * t), Math.round(y0 + (y1 - y0) * t), c)
        }
        return this
    }
    /** Dotted 1px frame (hidden things) */
    dotted(x: number, y: number, w: number, h: number, c: Px) {
        for (let i = 0; i < w; i++) {
            if (i % 2 === 0) this.set(x + i, y, c).set(x + i, y + h - 1, c)
        }
        for (let j = 0; j < h; j++) {
            if (j % 2 === 0) this.set(x, y + j, c).set(x + w - 1, y + j, c)
        }
        return this
    }
    /** Stamp a glyph written as rows of "#"/"." */
    glyph(x: number, y: number, rows: string[], c: Px) {
        rows.forEach((row, j) => [...row].forEach((ch, i) => ch === "#" && this.set(x + i, y + j, c)))
        return this
    }
    /** Ink outline: every empty pixel touching a filled one becomes ink */
    outline(c: Px = "k") {
        const add: number[] = []
        for (let y = 0; y < N; y++)
            for (let x = 0; x < N; x++) {
                if (this.get(x, y)) continue
                if (this.get(x + 1, y) || this.get(x - 1, y) || this.get(x, y + 1) || this.get(x, y - 1)) add.push(y * N + x)
            }
        for (const i of add) this.px[i] = c
        return this
    }

    toSvg(): string {
        const paths = new Map<Colour, string>()
        for (let y = 0; y < N; y++) {
            let x = 0
            while (x < N) {
                const c = this.px[y * N + x]
                let end = x + 1
                while (end < N && this.px[y * N + end] === c) end++
                if (c) paths.set(c, (paths.get(c) ?? "") + `M${x} ${y}h${end - x}v1h-${end - x}z`)
                x = end
            }
        }
        const body = [...paths].map(([c, d]) => `<path fill='${PALETTE[c]}' d='${d}'/>`).join("")
        return `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 ${N} ${N}' shape-rendering='crispEdges'>${body}</svg>`
    }
}

const S_GLYPH = [".####.", "##..##", "##....", ".####.", "....##", "##..##", ".####."]
const T_GLYPH = ["######", "######", "..##..", "..##..", "..##..", "..##..", "..##.."]

// ---------------------------------------------------------------- doors
const doorLeaf = (sp: Sprite) => sp.rect(1, 6, 14, 4, "b").rect(5, 6, 1, 4, "n").rect(10, 6, 1, 4, "n")

const DRAW: Record<string, () => Sprite> = {
    "door:closed": () => doorLeaf(new Sprite()).outline(),
    "door:open": () => {
        const sp = new Sprite()
        // Jambs in the wall line, leaf swung back against the wall
        sp.rect(1, 6, 3, 9, "b").rect(2, 7, 1, 7, "n").outline()
        sp.rect(14, 6, 2, 4, "k")
        for (const [x, y] of [[13, 11], [12, 13], [10, 14], [7, 15]]) sp.set(x, y, "g")
        return sp
    },
    "door:locked": () => {
        const sp = doorLeaf(new Sprite())
        // Padlock hanging off the middle, shackle above the door
        sp.rect(6, 2, 4, 1, "d").rect(6, 3, 1, 3, "d").rect(9, 3, 1, 3, "d")
        sp.rect(5, 6, 6, 6, "y").rect(7, 8, 2, 2, "k")
        return sp.outline()
    },
    "door:barred": () => {
        const sp = doorLeaf(new Sprite())
        // Iron straps reaching past the door, a bar across it
        sp.rect(3, 3, 2, 10, "d").rect(11, 3, 2, 10, "d").rect(1, 7, 14, 2, "d")
        return sp.outline()
    },
    "door:portcullis": () => {
        const sp = new Sprite()
        // A row of iron bars with gaps you can see the floor through
        for (let x = 1; x < 16; x += 2) sp.rect(x, 4, 1, 8, "k").set(x, 12, "d")
        sp.rect(0, 6, 16, 1, "k").rect(0, 9, 16, 1, "k")
        return sp
    },
    "secret:hidden": () => {
        const sp = new Sprite()
        sp.rect(0, 7, 16, 2, "k")
        sp.rect(4, 3, 8, 10, "w").dotted(3, 2, 10, 12, "r")
        return sp.glyph(5, 4, S_GLYPH, "r")
    },
    "secret:found": () => {
        const sp = new Sprite()
        sp.rect(0, 7, 16, 2, "k")
        sp.rect(4, 3, 8, 10, "w").rect(3, 2, 10, 1, "k").rect(3, 13, 10, 1, "k").rect(3, 2, 1, 12, "k").rect(12, 2, 1, 12, "k")
        return sp.glyph(5, 4, S_GLYPH, "k")
    },
    "trap:hidden": () => new Sprite().dotted(2, 2, 12, 12, "r").glyph(5, 5, T_GLYPH, "r"),
    "trap:armed": () => {
        const sp = new Sprite().rect(3, 3, 10, 10, "s").rect(3, 3, 10, 1, "l").rect(3, 3, 1, 10, "l")
        sp.rect(4, 12, 9, 1, "g").rect(12, 4, 1, 9, "g")
        return sp.outline().glyph(5, 5, T_GLYPH, "r")
    },
    "trap:sprung": () => {
        const sp = new Sprite().rect(2, 2, 12, 12, "k")
        // Spikes in the open pit
        for (const [x, y] of [[4, 5], [8, 4], [11, 6], [5, 9], [9, 9], [6, 12], [11, 11]]) sp.set(x, y, "l").set(x, y - 1, "s")
        // Broken lid edges
        sp.rect(1, 1, 3, 1, "s").rect(1, 1, 1, 3, "s").rect(12, 14, 3, 1, "s").rect(14, 12, 1, 3, "s")
        return sp
    },

    // ------------------------------------------------------------ static
    "stairs-up": () => {
        const sp = new Sprite().rect(2, 1, 12, 14, "w")
        for (let y = 3; y < 15; y += 2) sp.rect(2, y, 12, 1, "g")
        sp.outline()
        // Arrow pointing up the stairs
        sp.rect(7, 5, 2, 8, "r").rect(6, 5, 4, 1, "r").rect(5, 6, 6, 1, "r").rect(7, 4, 2, 1, "r")
        return sp
    },
    "stairs-down": () => {
        const sp = new Sprite().rect(2, 1, 12, 14, "w")
        // Steps narrowing away, like they go down out of sight
        for (let i = 0; i < 6; i++) sp.rect(2 + i, 3 + i * 2, 12 - 2 * i, 1, "g")
        sp.outline()
        sp.rect(7, 3, 2, 8, "r").rect(6, 10, 4, 1, "r").rect(5, 9, 6, 1, "r").rect(7, 11, 2, 1, "r")
        return sp
    },
    pillar: () => {
        const sp = new Sprite().disc(8, 8, 6, "s").disc(7, 7, 3.2, "l").set(5, 5, "w").set(6, 5, "w").set(5, 6, "w")
        return sp.ring(8, 8, 6, "g").outline()
    },
    statue: () => {
        // A figure on a plinth; the outline pass separates head, arms and base
        const sp = new Sprite().rect(2, 12, 12, 3, "g").rect(3, 12, 10, 1, "s")
        sp.disc(8, 3, 2.2, "l").rect(6, 6, 4, 5, "l").rect(4, 6, 1, 4, "l").rect(11, 6, 1, 4, "l")
        return sp.outline()
    },
    chest: () => {
        const sp = new Sprite().rect(2, 5, 12, 8, "b").rect(2, 8, 12, 1, "n")
        sp.rect(4, 5, 1, 8, "d").rect(11, 5, 1, 8, "d").rect(7, 8, 2, 2, "y")
        return sp.outline()
    },
    altar: () => {
        const sp = new Sprite().rect(2, 5, 12, 8, "s").rect(3, 6, 10, 6, "l").rect(7, 5, 2, 8, "r")
        // Two candles
        sp.rect(4, 3, 1, 2, "w").set(4, 2, "y").rect(11, 3, 1, 2, "w").set(11, 2, "y")
        return sp.outline()
    },
    well: () => {
        const sp = new Sprite().disc(8, 8, 6.5, "s").ring(8, 8, 6.5, "g").disc(8, 8, 3.6, "k").disc(8, 8, 2.7, "u")
        sp.set(7, 7, "c").set(8, 7, "c")
        return sp.outline()
    },
    rubble: () => {
        const sp = new Sprite()
        sp.rect(2, 3, 4, 3, "s").rect(9, 2, 3, 3, "g").rect(5, 8, 5, 4, "s").rect(11, 9, 3, 3, "g").rect(2, 12, 3, 2, "g")
        sp.set(3, 3, "l").set(6, 8, "l").set(9, 9, "g")
        return sp.outline().set(13, 5, "d").set(7, 14, "d").set(1, 9, "d")
    },
    web: () => {
        const sp = new Sprite()
        // Spokes from the top-left corner, threads across them
        for (const r of [5, 9.5, 14]) sp.ring(0, 0, r, "g")
        for (const [x, y] of [[15, 0], [15, 6], [12, 12], [6, 15], [0, 15]]) sp.line(0, 0, x, y, "d")
        return sp.set(0, 0, "k").set(1, 1, "k")
    },
    bones: () => {
        const sp = new Sprite()
        sp.disc(5.5, 5.5, 3.3, "p").set(4, 5, "k").set(6, 5, "k").rect(4, 8, 3, 1, "p")
        sp.line(9, 9, 14, 14, "p").line(10, 9, 14, 13, "p").set(9, 8, "p").set(14, 15, "p")
        sp.line(3, 13, 9, 11, "p").set(2, 12, "p").set(10, 12, "p")
        return sp.outline()
    },
    table: () => {
        // Table top with four stools around it
        const sp = new Sprite().rect(2, 5, 12, 6, "b").rect(2, 8, 12, 1, "n")
        sp.rect(3, 1, 3, 2, "n").rect(10, 1, 3, 2, "n").rect(3, 13, 3, 2, "n").rect(10, 13, 3, 2, "n")
        return sp.outline().set(6, 6, "y")
    },
    bed: () => {
        const sp = new Sprite().rect(3, 1, 10, 14, "n").rect(4, 2, 8, 12, "w").rect(5, 3, 6, 2, "l").rect(4, 7, 8, 7, "r")
        sp.rect(4, 8, 8, 1, "w")
        return sp.outline()
    },
    barrel: () => {
        const sp = new Sprite().disc(8, 8, 6.5, "b").ring(8, 8, 6.5, "n").ring(8, 8, 4.5, "n").disc(8, 8, 1.5, "n")
        return sp.outline()
    },
    crate: () => {
        const sp = new Sprite().rect(2, 2, 12, 12, "b").rect(2, 2, 12, 1, "n").rect(2, 13, 12, 1, "n")
        sp.rect(2, 2, 1, 12, "n").rect(13, 2, 1, 12, "n").line(3, 3, 12, 12, "n").line(12, 3, 3, 12, "n")
        return sp.outline()
    },
    fountain: () => {
        const sp = new Sprite().disc(8, 8, 7.4, "s").ring(8, 8, 7.4, "g").disc(8, 8, 5.4, "u").disc(8, 8, 1.8, "l")
        for (const [x, y] of [[5, 5], [10, 5], [5, 10], [10, 11], [8, 4]]) sp.set(x, y, "c")
        return sp.outline()
    },
    trapdoor: () => {
        const sp = new Sprite().rect(2, 2, 12, 12, "n")
        for (let y = 4; y < 14; y += 3) sp.rect(2, y, 12, 1, "b")
        sp.rect(3, 3, 2, 2, "d").rect(11, 3, 2, 2, "d").ring(8, 10.5, 2.2, "y")
        return sp.outline()
    },
}

const cache = new Map<string, string>()

/** Data URL of a stamp's sprite (cached) */
export function spriteUrl(stamp: StampId, state?: StampState): string {
    const id = state ? `${stamp}:${state}` : stamp
    let url = cache.get(id)
    if (!url) {
        const draw = DRAW[id] ?? DRAW[stamp] ?? DRAW["door:closed"]
        url = "data:image/svg+xml," + encodeURIComponent(draw().toSvg()).replace(/%20/g, " ").replace(/%3D/g, "=").replace(/%3A/g, ":").replace(/%2F/g, "/").replace(/%27/g, "'")
        cache.set(id, url)
    }
    return url
}
