import type { BoardCamera } from "../board-bridge"
import { bayerThreshold, lightLevel, packRGBA, pickTexel, quantizeLight } from "./dither"
import { cameraAffine, drawRegion, padBox, regionFor, visibleBox, type Region, type RGBA } from "./world-texture"

/*
 * Darkness texture: dark everywhere except around light sources. Light is
 * quantised to three levels (lit, half lit, dark) with an ordered dither on
 * the falloff edges, so it reads as chunky pixel rings.
 */

export interface LitSource {
    /** World centre */
    x: number
    y: number
    /** Bright radius and outer (bright + dim) radius, world units */
    bright: number
    outer: number
    tint: RGBA | null
}

export interface DarkLook {
    /** 0..1 opacity of unlit areas */
    alpha: number
    colour: RGBA
}

/** Strength of a light's colour tint where fully lit */
const TINT = 0.16

export class LightRenderer {
    private tex: HTMLCanvasElement | null = null
    private texCtx: CanvasRenderingContext2D | null = null
    private img: ImageData | null = null

    draw(
        ctx: CanvasRenderingContext2D,
        cam: BoardCamera,
        sources: LitSource[],
        look: DarkLook,
        w: number,
        h: number,
        dpr: number
    ) {
        const vis = padBox(visibleBox(cam, w, h), 0.02)
        const t = pickTexel(cam.scale, vis.maxX - vis.minX, vis.maxY - vis.minY)
        const r = regionFor(vis, t)
        this.allocate(r)
        const n = r.cols * r.rows
        const level = new Float32Array(n)
        const owner = new Int16Array(n).fill(-1)

        sources.forEach((s, si) => {
            const band = Math.min(16, Math.max(t * 2, (s.outer || s.bright) * 0.4))
            const reach = s.outer + band / 2
            const i0 = Math.max(0, Math.floor((s.x - reach - r.x0) / t))
            const i1 = Math.min(r.cols, Math.ceil((s.x + reach - r.x0) / t))
            const j0 = Math.max(0, Math.floor((s.y - reach - r.y0) / t))
            const j1 = Math.min(r.rows, Math.ceil((s.y + reach - r.y0) / t))
            for (let j = j0; j < j1; j++) {
                const dy = r.y0 + (j + 0.5) * t - s.y
                for (let i = i0; i < i1; i++) {
                    const dx = r.x0 + (i + 0.5) * t - s.x
                    const L = lightLevel(Math.hypot(dx, dy), s.bright, s.outer, band)
                    const k = j * r.cols + i
                    if (L > level[k]) {
                        level[k] = L
                        owner[k] = si
                    }
                }
            }
        })

        const [dr, dg, db] = look.colour
        const darkPx = packRGBA(dr, dg, db, Math.round(255 * look.alpha))
        const buf = new Uint32Array(this.img!.data.buffer)
        const gi0 = Math.round(r.x0 / t)
        const gj0 = Math.round(r.y0 / t)
        for (let j = 0; j < r.rows; j++) {
            for (let i = 0; i < r.cols; i++) {
                const k = j * r.cols + i
                const L = level[k]
                if (L <= 0) {
                    buf[k] = darkPx
                    continue
                }
                const q = quantizeLight(L, bayerThreshold(gi0 + i, gj0 + j))
                const da = look.alpha * (1 - q)
                const tint = sources[owner[k]].tint
                const ta = tint ? TINT * q : 0
                const a = da + ta * (1 - da)
                if (a <= 0.004) {
                    buf[k] = 0
                    continue
                }
                const mix = (dc: number, tc: number) => Math.round((dc * da + tc * ta * (1 - da)) / a)
                buf[k] = tint
                    ? packRGBA(mix(dr, tint[0]), mix(dg, tint[1]), mix(db, tint[2]), Math.round(a * 255))
                    : packRGBA(dr, dg, db, Math.round(a * 255))
            }
        }
        this.texCtx!.putImageData(this.img!, 0, 0)
        drawRegion(ctx, this.tex!, r, cameraAffine(cam), dpr)
    }

    private allocate(r: Region) {
        if (!this.tex) {
            this.tex = document.createElement("canvas")
            this.texCtx = this.tex.getContext("2d")
        }
        if (this.tex.width !== r.cols || this.tex.height !== r.rows) {
            this.tex.width = r.cols
            this.tex.height = r.rows
        }
        if (!this.img || this.img.width !== r.cols || this.img.height !== r.rows) {
            this.img = new ImageData(r.cols, r.rows)
        }
    }
}
