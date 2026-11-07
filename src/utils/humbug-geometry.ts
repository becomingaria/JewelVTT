import type { Humbug, Point } from "../types/humbug.types"
import { humbugFootprint } from "./humbug.utils"
import { cssMatrix, isIdentity, type Projection } from "./projection"

/*
 * Where a humbug appears on screen.
 *
 * HumbugRenderer places each humbug with CSS; anything that needs to point
 * at a humbug as drawn (connector anchors, hover, drop highlights) uses the
 * same maths from here, so they always agree, whether the humbug lies flat
 * (2D or a tilted floor) or stands up as a 2.5D standee.
 */

const STANDEE_PERSPECTIVE = 900 // px
const STANDEE_LEAN = 14 // degrees leaning back once fully standing
const STANDEE_MAX_YAW = 14 // degrees turned toward the camera at the edges

export interface GeometryContext {
    /** Board zoom */
    scale: number
    /** 0 = flat 2D, 1 = fully standing (2.5D) */
    standUp: number
    projection: Projection
    worldToScreen: (x: number, y: number) => Point
    /** Board container width (standees turn toward its centre) */
    containerWidth: number
}

/** Maps (the terrain) always lie flat; everything else stands in 2.5D */
export const isStandee = (h: Humbug, standUp: number) => standUp > 0 && h.type !== "map"

export interface HumbugPlacement {
    left: number
    top: number
    /** On-screen size before transforms (world size × zoom) */
    width: number
    height: number
    transform: string
    transformOrigin?: string
    zIndex: number
    /** Element px -> container px, including perspective */
    matrix: DOMMatrix
}

export function placeHumbug(h: Humbug, ctx: GeometryContext): HumbugPlacement {
    const size = humbugFootprint(h)
    const w = size.width * ctx.scale
    const hgt = size.height * ctx.scale
    const r = h.rotation

    if (isStandee(h, ctx.standUp)) {
        // Stand on the centre of the footprint, rising from flat as standUp
        // goes 0 -> 1, leaning back a little and turning toward the camera
        const base = ctx.worldToScreen(h.position.x + size.width / 2, h.position.y + size.height / 2)
        const half = Math.max(1, ctx.containerWidth / 2)
        const yaw =
            Math.max(-STANDEE_MAX_YAW, Math.min(STANDEE_MAX_YAW, ((half - base.x) / half) * STANDEE_MAX_YAW)) *
            ctx.standUp
        const pitch = 90 * (1 - ctx.standUp) + STANDEE_LEAN * ctx.standUp
        const left = base.x - w / 2
        const top = base.y - hgt

        const perspective = new DOMMatrix()
        perspective.m34 = -1 / STANDEE_PERSPECTIVE
        const matrix = new DOMMatrix()
            .translate(left + w / 2, top + hgt)
            .multiply(perspective)
            .rotateAxisAngle(1, 0, 0, pitch)
            .rotateAxisAngle(0, 1, 0, yaw)
            .rotateAxisAngle(0, 0, 1, r)
            .translate(-w / 2, -hgt)

        return {
            left,
            top,
            width: w,
            height: hgt,
            transformOrigin: "50% 100%",
            transform: `perspective(${STANDEE_PERSPECTIVE}px) rotateX(${pitch}deg) rotateY(${yaw}deg) rotate(${r}deg)`,
            // Depth sort: nearer the bottom of the screen draws in front; on the
            // same row the usual stacking order breaks the tie. Always above
            // flat humbugs (maps), even far off-screen.
            zIndex: 1_000_000 + Math.max(0, Math.round(base.y + 5000)) * 1000 + (h.zIndex % 1000),
            matrix,
        }
    }

    // Flat: lie on the (possibly tilted) board, rotated about the centre
    const corner = ctx.worldToScreen(h.position.x, h.position.y)
    const p = ctx.projection
    const tilted = !isIdentity(p)
    const matrix = new DOMMatrix()
        .translate(corner.x, corner.y)
        .multiply(new DOMMatrix([p.m11, p.m21, p.m12, p.m22, 0, 0]))
        .translate(w / 2, hgt / 2)
        .rotate(r)
        .translate(-w / 2, -hgt / 2)
    return {
        left: corner.x,
        top: corner.y,
        width: w,
        height: hgt,
        transformOrigin: tilted ? "0 0" : undefined,
        transform: tilted
            ? `${cssMatrix(p)} translate(${w / 2}px, ${hgt / 2}px) rotate(${r}deg) translate(${-w / 2}px, ${-hgt / 2}px)`
            : `rotate(${r}deg)`,
        zIndex: h.zIndex,
        matrix,
    }
}

/** A point on the humbug (element pixels) -> container pixels */
export function projectOnHumbug(pl: HumbugPlacement, x: number, y: number): Point {
    const q = pl.matrix.transformPoint(new DOMPoint(x, y, 0, 1))
    return { x: q.x / q.w, y: q.y / q.w }
}

/** The humbug's four corners on screen (top-left, top-right, bottom-right, bottom-left) */
export function screenQuad(pl: HumbugPlacement): Point[] {
    return [
        projectOnHumbug(pl, 0, 0),
        projectOnHumbug(pl, pl.width, 0),
        projectOnHumbug(pl, pl.width, pl.height),
        projectOnHumbug(pl, 0, pl.height),
    ]
}
