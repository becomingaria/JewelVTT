/*
 * Camera projection for the 2D / 2.5D views.
 *
 * Screen = centre + zoom * M * (world + viewportOffset)
 *
 * M is a linear map: in 2D it's the identity; in 2.5D (isometric) the
 * board is rotated 45° and squashed to half height, like a classic
 * isometric RPG. `tilt` blends between the two (0 = 2D, 1 = iso) so the
 * switch can animate as the board "pitches" down. Because M is affine,
 * every screen point maps back to exactly one board point, which keeps
 * clicking, dragging, painting and drawing exact in both views.
 */

export type ViewMode = "2d" | "iso"

export interface Projection {
    /** Row-major 2x2: [m11 m12; m21 m22] */
    m11: number
    m12: number
    m21: number
    m22: number
}

export const IDENTITY: Projection = { m11: 1, m12: 0, m21: 0, m22: 1 }

/** Isometric target: 45° turn, vertical squash to 50% */
const ISO_ANGLE = Math.PI / 4
const ISO_SQUASH = 0.5

export function projectionForTilt(tilt: number): Projection {
    if (tilt <= 0) return IDENTITY
    const a = ISO_ANGLE * tilt
    const k = 1 - (1 - ISO_SQUASH) * tilt
    const cos = Math.cos(a)
    const sin = Math.sin(a)
    return { m11: cos, m12: -sin, m21: k * sin, m22: k * cos }
}

export function apply(p: Projection, x: number, y: number) {
    return { x: p.m11 * x + p.m12 * y, y: p.m21 * x + p.m22 * y }
}

export function invert(p: Projection, x: number, y: number) {
    const det = p.m11 * p.m22 - p.m12 * p.m21
    return {
        x: (p.m22 * x - p.m12 * y) / det,
        y: (-p.m21 * x + p.m11 * y) / det,
    }
}

/** CSS / SVG matrix() for the linear part only */
export const cssMatrix = (p: Projection) =>
    `matrix(${p.m11}, ${p.m21}, ${p.m12}, ${p.m22}, 0, 0)`

export const isIdentity = (p: Projection) =>
    p.m11 === 1 && p.m12 === 0 && p.m21 === 0 && p.m22 === 1
