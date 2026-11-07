/** A named place on the board the user can jump back to from the top bar */
export interface Spot {
    id: string
    name: string
    /** World coordinates */
    x: number
    y: number
}
