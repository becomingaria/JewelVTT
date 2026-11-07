// Pixel-art faceted purple jewel: facets are polygons rasterised at pixel
// centres, then outlined. Writes public/jewelvtt.svg (logo + favicon).
// Run: node scripts/generate-jewel-logo.mjs
import fs from "node:fs"

const W = 22, H = 17
const PAL = {
    K: "#1c0a33", // outline
    a: "#f3e8ff", // table highlight
    b: "#d7b8ff", // light facet
    c: "#b07cff", // mid-light
    d: "#8e4fec", // mid
    e: "#6c2fcf", // mid-dark
    f: "#4a1696", // dark
    g: "#2f0c66", // darkest
    w: "#ffffff", // glint
    s: "#f5c542", // sparkle
}

// [colour, polygon] back-to-front; coordinates in pixel space
const g = 6.5 // girdle line
const facets = [
    ["f", [[1, g], [21, g], [11, 17]]], // pavilion base (dark)
    ["e", [[1, g], [7.5, g], [11, 17]]], // pavilion left
    ["c", [[7.5, g], [11, g], [11, 17]]], // pavilion centre-left (refraction)
    ["d", [[11, g], [14.5, g], [11, 17]]], // pavilion centre-right
    ["g", [[14.5, g], [21, g], [11, 17]]], // pavilion right
    ["c", [[1, g], [6, 1.5], [7.5, g]]], // crown left
    ["b", [[6, 1.5], [16, 1.5], [14.5, g], [7.5, g]]], // table
    ["d", [[16, 1.5], [21, g], [14.5, g]]], // crown right
    ["e", [[1, g], [21, g], [21, g + 1], [1, g + 1]]], // girdle band
]

const inside = (pt, poly) => {
    let c = false
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
        const [xi, yi] = poly[i], [xj, yj] = poly[j]
        if ((yi > pt[1]) !== (yj > pt[1]) && pt[0] < ((xj - xi) * (pt[1] - yi)) / (yj - yi) + xi) c = !c
    }
    return c
}

const px = Array.from({ length: H }, () => Array(W).fill("."))
for (const [col, poly] of facets)
    for (let y = 0; y < H; y++)
        for (let x = 0; x < W; x++)
            if (inside([x + 0.5, y + 0.5], poly)) px[y][x] = col

// Highlights and glints
const put = (x, y, c) => { if (px[y]?.[x] && px[y][x] !== ".") px[y][x] = c }
put(7, 2, "a"); put(8, 2, "a"); put(9, 2, "a"); put(7, 3, "a"); put(8, 3, "w")
put(12, 3, "a"); put(3, 6, "b"); put(9, 9, "b"); put(9, 10, "a"); put(10, 12, "b")
// Outline
const out = px.map((r) => r.slice())
for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++)
        if (px[y][x] === "." && [[1,0],[-1,0],[0,1],[0,-1]].some(([dx,dy]) => px[y+dy]?.[x+dx] && px[y+dy][x+dx] !== ".")) out[y][x] = "K"
// Sparkle above the upper-right crown
for (const [x, y] of [[19, 0], [18, 1], [20, 1], [19, 2], [19, 1]]) if (out[y][x] === ".") out[y][x] = "s"
out[1][19] = "w"

const art = out.map((r) => r.join(""))
let rects = ""
art.forEach((row, y) => {
    let x = 0
    while (x < row.length) {
        const ch = row[x]; let n = 1
        while (row[x + n] === ch) n++
        if (ch !== ".") rects += `<rect x="${x}" y="${y}" width="${n}" height="1" fill="${PAL[ch]}"/>`
        x += n
    }
})
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W * 2}" height="${H * 2}" viewBox="0 0 ${W} ${H}" shape-rendering="crispEdges">${rects}</svg>\n`
fs.writeFileSync(new URL("../public/jewelvtt.svg", import.meta.url), svg)
console.log(art.join("\n"))
