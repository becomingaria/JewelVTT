import React from "react"
import { IconFrame } from "../host/FeatureIcon"

/* Original icons for the tracker, on the shared 24×24 grid. */

/** Initiative: an ordered list with a "next" arrow */
export const InitiativeIcon: React.FC = () => (
    <IconFrame>
        <path d='M4 5h9M4 10h7M4 15h5M4 20h3' />
        <path d='M18 4v15M15 16l3 3 3-3' />
    </IconFrame>
)

export const AddInitiativeIcon: React.FC = () => (
    <IconFrame>
        <path d='M4 6h9M4 11h7M4 16h5' />
        <path d='M18 13v8M14 17h8' />
    </IconFrame>
)

/** Hit points: a chunky heart */
export const HeartIcon: React.FC = () => (
    <IconFrame>
        <path d='M12 20 4.5 12.5a4.2 4.2 0 0 1 6-6L12 8l1.5-1.5a4.2 4.2 0 0 1 6 6Z' />
    </IconFrame>
)

/** Conditions: a swirl */
export const SwirlIcon: React.FC = () => (
    <IconFrame>
        <path d='M12 12a1.5 1.5 0 1 1 1.5-1.5' />
        <path d='M13.5 10.5A4 4 0 1 1 9 7' />
        <path d='M9 7a7 7 0 1 1-4.6 9' />
    </IconFrame>
)

/** Dungeon turns: an hourglass */
export const HourglassIcon: React.FC = () => (
    <IconFrame>
        <path d='M6 3h12M6 21h12' />
        <path d='M7.5 3c0 5 9 6 9 9s-9 4-9 9M16.5 3c0 5-9 6-9 9s9 4 9 9' />
    </IconFrame>
)

/** New character: a figure and a plus */
export const NewCharacterIcon: React.FC = () => (
    <IconFrame>
        <circle cx='9.5' cy='8' r='3.5' />
        <path d='M3 20c0-3.8 2.9-6 6.5-6s6.5 2.2 6.5 6' />
        <path d='M19 6v6M16 9h6' />
    </IconFrame>
)

export const FlyToIcon: React.FC = () => (
    <IconFrame>
        <circle cx='12' cy='12' r='6' />
        <circle cx='12' cy='12' r='1.5' />
        <path d='M12 2v4M12 18v4M2 12h4M18 12h4' />
    </IconFrame>
)

export const NextIcon: React.FC = () => (
    <IconFrame>
        <path d='M6 5l8 7-8 7z' />
        <path d='M18 5v14' />
    </IconFrame>
)

export const DiceIcon: React.FC = () => (
    <IconFrame>
        <rect x='4' y='4' width='16' height='16' rx='2' />
        <circle cx='9' cy='9' r='.8' fill='currentColor' />
        <circle cx='15' cy='15' r='.8' fill='currentColor' />
        <circle cx='15' cy='9' r='.8' fill='currentColor' />
        <circle cx='9' cy='15' r='.8' fill='currentColor' />
    </IconFrame>
)

/** Party: a shield */
export const ShieldIcon: React.FC = () => (
    <IconFrame>
        <path d='M12 3 5 6v5c0 4.5 3 8 7 10 4-2 7-5.5 7-10V6Z' />
    </IconFrame>
)

/** Foe: fangs */
export const FangIcon: React.FC = () => (
    <IconFrame>
        <path d='M4 6h16' />
        <path d='M6 6l2.5 9L11 6M13 6l2.5 9L18 6' />
    </IconFrame>
)

// ---------------------------------------------------------- pixel glyphs
/*
 * Condition pips: 8×8 pixel glyphs, each a different shape so they can be
 * told apart without colour. '#' = lit pixel.
 */
const GLYPHS: Record<string, { color: string; rows: string[] }> = {
    poisoned: {
        color: "#7bd34f",
        rows: ["...##...", "...##...", "..####..", ".######.", ".##.###.", ".######.", "..####..", "........"],
    },
    asleep: {
        color: "#8fb8ff",
        rows: [".######.", ".######.", ".....##.", "....##..", "...##...", "..##....", ".######.", ".######."],
    },
    paralysed: {
        color: "#ffd84a",
        rows: ["....###.", "...###..", "..###...", ".######.", "...###..", "..###...", ".###....", ".##....."],
    },
    charmed: {
        color: "#ff8fc8",
        rows: ["........", ".##..##.", "########", "########", ".######.", "..####..", "...##...", "........"],
    },
    frightened: {
        color: "#ffa64d",
        rows: ["..####..", "..####..", "..####..", "...##...", "...##...", "........", "..####..", "..####.."],
    },
    prone: {
        color: "#d8b48a",
        rows: ["........", "........", "##......", "##......", "..######", "..######", "..#....#", "........"],
    },
    blinded: {
        color: "#d0d0dc",
        rows: ["#.......", ".#####..", "#.#..##.", "#..##..#", ".#..#.#.", "..####..", "......#.", ".......#"],
    },
    invisible: {
        color: "#a8f0ff",
        rows: ["##.##.##", "#......#", "........", "#......#", "#......#", "........", "#......#", "##.##.##"],
    },
    cursed: {
        color: "#c58cff",
        rows: ["########", "#......#", "#.####.#", "#.#..#.#", "#.#.##.#", "#.#....#", "#.######", "........"],
    },
    dead: {
        color: "#f4f4f4",
        rows: [".######.", "########", "#..##..#", "#..##..#", "########", ".##..##.", ".#.##.#.", "........"],
    },
}

const FALLBACK = { color: "#f4f4f4", rows: ["........", "..####..", ".#....#.", ".#....#.", ".#....#.", ".#....#.", "..####..", "........"] }

/** One condition glyph on a dark tile (high contrast whatever the board) */
export const ConditionGlyph: React.FC<{ id: string; size?: number }> = ({ id, size = 14 }) => {
    const g = GLYPHS[id] ?? FALLBACK
    return (
        <svg
            width={size}
            height={size}
            viewBox='-1 -1 10 10'
            shapeRendering='crispEdges'
            aria-hidden='true'
            focusable='false'
            className='tracker-glyph'
        >
            <rect x='-1' y='-1' width='10' height='10' fill='#14141c' />
            {g.rows.flatMap((row, y) =>
                [...row].map((ch, x) =>
                    ch === "#" ? <rect key={`${x},${y}`} x={x} y={y} width='1' height='1' fill={g.color} /> : null
                )
            )}
        </svg>
    )
}
