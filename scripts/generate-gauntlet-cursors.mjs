// Generates 2.5D pixel-art gauntlet cursor sprites as ASCII art.
// Run: node scripts/generate-gauntlet-cursors.mjs, then paste the printed
// sprites into src/cursors/pixel-cursors.ts.
// Parts are drawn back-to-front; each is shaded as if lit from the upper
// left, then outlines are added around the silhouette and wherever a part
// sits behind another.

const SHADES = ["1", "2", "3", "4", "5"] // dark -> light steel

// `map` (optional) takes an output pixel and returns the source pixel it
// shows, which is how sprites are rotated without jaggy pixel resampling.
function makeCanvas(w, h, map = null) {
    const px = Array.from({ length: h }, () => Array(w).fill("."))
    const part = Array.from({ length: h }, () => Array(w).fill(-1))
    let z = 0
    const set = (x, y, c, id) => {
        if (x < 0 || y < 0 || x >= w || y >= h) return
        px[y][x] = c
        part[y][x] = id
    }
    return {
        w, h, px, part,
        // Shape: function(x,y)->bool; shade: function(x,y,bounds)->char
        shape(test, shade, bbox) {
            const id = z++
            if (map) {
                for (let y = 0; y < h; y++)
                    for (let x = 0; x < w; x++) {
                        const [u, v] = map(x, y)
                        if (u < bbox[0] || u > bbox[2] || v < bbox[1] || v > bbox[3]) continue
                        if (test(u, v)) set(x, y, shade(u, v), id)
                    }
                return id
            }
            for (let y = bbox[1]; y <= bbox[3]; y++)
                for (let x = bbox[0]; x <= bbox[2]; x++)
                    if (test(x, y)) set(x, y, shade(x, y), id)
            return id
        },
        dot(x, y, c) {
            if (map) {
                for (let oy = 0; oy < h; oy++)
                    for (let ox = 0; ox < w; ox++) {
                        const [u, v] = map(ox, oy)
                        if (u === x && v === y && px[oy][ox] !== ".") px[oy][ox] = c
                    }
                return
            }
            if (px[y] && px[y][x] !== ".") px[y][x] = c
        },
        outline() {
            const K = "K"
            const out = px.map((r) => r.slice())
            for (let y = 0; y < h; y++)
                for (let x = 0; x < w; x++) {
                    const n = [[1,0],[-1,0],[0,1],[0,-1]].map(([dx,dy]) => [x+dx, y+dy])
                    if (px[y][x] === ".") {
                        if (n.some(([a,b]) => px[b]?.[a] && px[b][a] !== ".")) out[y][x] = K
                    } else {
                        // back part pixel touching a front part -> seam
                        const me = part[y][x]
                        if (n.some(([a,b]) => part[b]?.[a] > me)) out[y][x] = K
                    }
                }
            for (let y = 0; y < h; y++) px[y] = out[y]
        },
        toArt() { return px.map((r) => r.join("")) },
    }
}

// Cylinder shading across x (vertical fingers): left highlight -> right dark
const cylX = (x0, x1, bias = 0) => (x) => {
    const t = (x - x0) / Math.max(1, x1 - x0)
    const i = Math.round((1 - t) * 3.2 + 0.6 + bias)
    return SHADES[Math.max(0, Math.min(4, i))]
}
// Diagonal plate shading
const diag = (x0, y0, x1, y1, bias = 0) => (x, y) => {
    const t = 0.65 * (x - x0) / Math.max(1, x1 - x0) + 0.35 * (y - y0) / Math.max(1, y1 - y0)
    const i = Math.round((1 - t) * 3.4 + 0.5 + bias)
    return SHADES[Math.max(0, Math.min(4, i))]
}
const roundRect = (x0, y0, x1, y1, r = 1) => (x, y) => {
    if (x < x0 || x > x1 || y < y0 || y > y1) return false
    const cx = x < x0 + r ? x0 + r : x > x1 - r ? x1 - r : x
    const cy = y < y0 + r ? y0 + r : y > y1 - r ? y1 - r : y
    return (x - cx) ** 2 + (y - cy) ** 2 <= r * r + 0.5
}

// Finger pointing up with plate seams
function finger(c, x0, x1, y0, y1, seams = []) {
    const shade = cylX(x0, x1)
    c.shape(roundRect(x0, y0, x1, y1, 1.5), (x, y) => {
        if (seams.includes(y)) return "1"
        if (seams.includes(y - 1) && x <= x0 + 1) return "5" // bevel under seam
        if (y === y0 + 1 && x === x0 + 1) return "6" // tip glint
        return shade(x)
    }, [x0, y0, x1, y1])
}

// Curled knuckle seen from above/behind
function knuckle(c, x0, x1, y0, y1) {
    const shade = cylX(x0, x1, 0.4)
    c.shape(roundRect(x0, y0, x1, y1, 1.5), (x, y) => {
        if (y === y0 + 1 && x === x0 + 1) return "6"
        if (y === y0 + 2) return x <= x0 + 1 ? "4" : "1" // knuckle seam
        if (y >= y1 - 1) return "2"
        return shade(x)
    }, [x0, y0, x1, y1])
}

function backPlate(c, x0, y0, x1, y1, rivet) {
    const shade = diag(x0, y0, x1, y1)
    c.shape(roundRect(x0, y0, x1, y1, 2), (x, y) => {
        if (y === y0 + 1 && x > x0 + 1 && x < x1 - 2) return "5" // top bevel
        if (x === x0 + 2 && y === y0 + 2) return "6"
        if (y === y1 - 1 && x > x0 + 1) return "1" // lower plate seam
        return shade(x, y)
    }, [x0, y0, x1, y1])
    if (rivet) { c.dot(rivet[0], rivet[1], "y"); c.dot(rivet[0] + 1, rivet[1], "O"); c.dot(rivet[0], rivet[1] + 1, "O") }
}

function thumb(c, pts) {
    // pts: list of [x0,x1,y] rows
    const xs = pts.flatMap(([a, b]) => [a, b])
    const x0 = Math.min(...xs), x1 = Math.max(...xs)
    const shade = cylX(x0, x1)
    const rows = new Map(pts.map(([a, b, y]) => [y, [a, b]]))
    const ys = pts.map((p) => p[2])
    c.shape((x, y) => { const r = rows.get(y); return !!r && x >= r[0] && x <= r[1] },
        (x, y) => (y === ys[0] + 1 && x === rows.get(y)[0] + 1 ? "6" : shade(x)),
        [x0, Math.min(...ys), x1, Math.max(...ys)])
}

function cuff(c, x0, y0, x1, y1) {
    const shade = cylX(x0, x1, 0.2)
    const flare = (x, y) => {
        const f = Math.floor((y - y0) / 2)
        return x >= x0 - f && x <= x1 + f && y >= y0 && y <= y1
    }
    c.shape(flare, (x, y) => {
        if (y === y0) return x < x0 + 3 ? "y" : x > x1 - 3 ? "O" : "Y"
        if (y === y1) return x > x1 - 4 ? "O" : "Y"
        return shade(x)
    }, [x0 - 3, y0, x1 + 3, y1])
}

// Gold four-point glint
function glint(c, x, y) {
    for (const [dx, dy, ch] of [[0,0,"y"],[1,0,"Y"],[-1,0,"Y"],[0,1,"Y"],[0,-1,"Y"]]) {
        const yy = y + dy, xx = x + dx
        if (c.px[yy] && c.px[yy][xx] === ".") { c.px[yy][xx] = ch }
    }
}

// ------------------------------------------------------------- sprites
/** Rotation map: output pixel -> nearest source pixel (degrees, + = clockwise) */
function rotation(deg, srcW, srcH, outSize) {
    const a = (deg * Math.PI) / 180
    const cos = Math.cos(a), sin = Math.sin(a)
    const scx = srcW / 2, scy = srcH / 2, oc = outSize / 2
    return (x, y) => {
        const dx = x + 0.5 - oc, dy = y + 0.5 - oc
        // inverse rotation
        const u = cos * dx + sin * dy + scx - 0.5
        const v = -sin * dx + cos * dy + scy - 0.5
        return [Math.round(u), Math.round(v)]
    }
}

/** Remove empty rows/columns around the art */
function trim(art) {
    const rows = art.map((r) => r.split(""))
    const used = (r) => r.some((c) => c !== ".")
    while (rows.length && !used(rows[0])) rows.shift()
    while (rows.length && !used(rows[rows.length - 1])) rows.pop()
    let left = Infinity, right = 0
    for (const r of rows) r.forEach((c, i) => { if (c !== ".") { left = Math.min(left, i); right = Math.max(right, i) } })
    return rows.map((r) => r.slice(left, right + 1).join(""))
}

function pointing(deg = 0) {
    const c = deg ? makeCanvas(34, 34, rotation(deg, 21, 26, 34)) : makeCanvas(21, 26)
    knuckle(c, 15, 18, 11, 15)  // pinky
    knuckle(c, 12, 15, 10, 15)  // ring
    knuckle(c, 9, 12, 9, 15)    // middle
    finger(c, 5, 9, 1, 15, [5, 10]) // index
    backPlate(c, 3, 13, 18, 21, [11, 16])
    thumb(c, [[2, 4, 12], [1, 5, 13], [1, 6, 14], [2, 7, 15], [3, 7, 16], [4, 7, 17]])
    cuff(c, 4, 20, 17, 24)
    c.outline()
    return deg ? trim(c.toArt()) : c.toArt()
}

function open() {
    const c = makeCanvas(23, 26)
    finger(c, 16, 19, 4, 14, [8])     // pinky
    finger(c, 13, 16, 1, 14, [6])     // ring
    finger(c, 9, 13, 0, 14, [5, 10])  // middle
    finger(c, 5, 9, 2, 14, [6, 10])   // index
    backPlate(c, 4, 12, 19, 20, [11, 15])
    thumb(c, [[0, 2, 9], [0, 3, 10], [0, 4, 11], [1, 5, 12], [2, 6, 13], [3, 6, 14], [4, 6, 15]])
    cuff(c, 5, 19, 18, 23)
    c.outline()
    return c.toArt()
}

function fist() {
    const c = makeCanvas(21, 22)
    knuckle(c, 14, 17, 6, 11)
    knuckle(c, 11, 14, 5, 11)
    knuckle(c, 8, 11, 5, 11)
    knuckle(c, 5, 8, 6, 11)
    backPlate(c, 3, 9, 18, 17, [11, 12])
    thumb(c, [[1, 4, 9], [1, 6, 10], [2, 8, 11], [3, 8, 12]])
    cuff(c, 4, 16, 17, 20)
    c.outline()
    return c.toArt()
}

/** Fingertip = the outermost pixel in the pointing direction */
function tipOf(art, deg) {
    const a = (deg * Math.PI) / 180
    const dir = { x: Math.sin(a), y: -Math.cos(a) } // "up", rotated
    let best = null, bestD = -Infinity
    art.forEach((row, y) => [...row].forEach((ch, x) => {
        if (ch === ".") return
        const d = x * dir.x + y * dir.y
        if (d > bestD) { bestD = d; best = [x, y] }
    }))
    return best
}

const TILT = -45 // rotate left 45 degrees
function pointingGlint() {
    // pad one column/row so the glint has room above-right of the tip
    const base = pointing(TILT).map((r) => "...." + r)
    const art = [".....".padEnd(base[0].length, "."), ...base].map((r) => r.split(""))
    const [tx, ty] = tipOf(art.map((r) => r.join("")), TILT)
    glint({ px: art }, tx + 4, ty)
    return trim(art.map((r) => r.join("")))
}

const tilted = pointing(TILT)
const sprites = { pointing: tilted, glint: pointingGlint(), open: open(), fist: fist() }
console.log("tip (pointing):", JSON.stringify(tipOf(tilted, TILT)))
for (const [k, v] of Object.entries(sprites)) console.log(k + "\n" + v.join("\n") + "\n")
