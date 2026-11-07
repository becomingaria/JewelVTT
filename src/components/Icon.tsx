import React from "react"
import "./Icon.css"

/*
 * Animated inline-SVG icon set.
 *
 * Every icon is drawn on a 24×24 grid with `currentColor` strokes plus an
 * accent colour. Animations live in Icon.css and play while the closest
 * button (or any `.jicon-host`) is hovered or focused, so each icon acts
 * out what its control does.
 */

export type IconName =
    | "text"
    | "image"
    | "map"
    | "token"
    | "pin"
    | "swatch"
    | "grid"
    | "home"
    | "flag"
    | "edit"
    | "lock"
    | "unlock"
    | "to-front"
    | "forward"
    | "backward"
    | "to-back"
    | "trash"
    | "new-board"
    | "export"
    | "import"
    | "brush"
    | "eraser"
    | "bucket"
    | "hand"
    | "rotate"
    | "close"
    | "library"
    | "trail"
    | "save"
    | "open"
    | "document"
    | "link"
    | "help"
    | "scribble"
    | "layers"
    | "select"
    | "connector"
    | "eye"
    | "eye-off"
    | "gear"
    | "hex"

interface IconProps {
    name: IconName
    size?: number
    className?: string
    title?: string
    /** e.g. { "--ji-accent": "#e74c3c" } to recolour the accent */
    style?: React.CSSProperties
}

const ICONS: Record<IconName, React.ReactNode> = {
    text: (
        <>
            <path className='ji-line ji-l1' d='M4 6h16' />
            <path className='ji-line ji-l2' d='M4 11h16' />
            <path className='ji-line ji-l3' d='M4 16h9' />
            <path className='ji-caret ji-accent-stroke' d='M16.5 13.5v6' />
        </>
    ),
    image: (
        <>
            <rect x='3' y='4' width='18' height='16' rx='2.5' />
            <circle
                className='ji-sun'
                cx='16'
                cy='9'
                r='2'
                fill='#f5b041'
                stroke='none'
            />
            <path
                className='ji-accent-fill'
                d='M3.5 17.5 8.5 12l4 4 3-2.5 5 4.5V18a2 2 0 0 1-2 2H5.5a2 2 0 0 1-2-2z'
                stroke='none'
            />
            <path d='M3.5 17.5 8.5 12l4 4 3-2.5 5 4.5' />
        </>
    ),
    map: (
        <>
            <path
                className='ji-soft-fill'
                d='M3 6.5 8.5 4l7 2.5L21 4v13.5L15.5 20l-7-2.5L3 20z'
            />
            <path d='M8.5 4v13.5M15.5 6.5V20' opacity='0.45' />
            <path
                className='ji-route ji-accent-stroke'
                d='M5.5 16c2-1 2.5-4.5 5-5s3.5 2 6-3'
            />
            <path className='ji-x' d='M16 6.2l2 2m0-2-2 2' stroke='#e74c3c' />
        </>
    ),
    token: (
        <g className='ji-coin'>
            <circle cx='12' cy='12' r='8.5' fill='#f9e08b' />
            <circle cx='12' cy='12' r='5.5' strokeDasharray='2 1.6' />
            <path
                d='m12 8.6 1 2.1 2.3.3-1.7 1.6.4 2.3-2-1.1-2 1.1.4-2.3-1.7-1.6 2.3-.3z'
                fill='#d68910'
                stroke='none'
            />
        </g>
    ),
    pin: (
        <>
            <ellipse
                className='ji-pin-shadow'
                cx='12'
                cy='21.5'
                rx='3.5'
                ry='1'
                fill='currentColor'
                stroke='none'
                opacity='0.25'
            />
            <g className='ji-pin'>
                <path
                    className='ji-accent-fill-solid'
                    d='M12 20s-6.5-6-6.5-10.8a6.5 6.5 0 0 1 13 0C18.5 14 12 20 12 20z'
                />
                <circle cx='12' cy='9.3' r='2.3' fill='white' />
            </g>
        </>
    ),
    swatch: (
        <>
            <rect
                className='ji-swatch'
                x='4'
                y='4'
                width='16'
                height='16'
                rx='3.5'
            />
            <path
                d='M7.5 8.5a1.5 1.5 0 0 1 1.5-1.5h2'
                stroke='white'
                opacity='0.8'
            />
        </>
    ),
    grid: (
        <>
            <path
                d='M4 4h16v16H4zM9.33 4v16M14.67 4v16M4 9.33h16M4 14.67h16'
                opacity='0.4'
            />
            <rect
                className='ji-snap-block ji-accent-fill-solid'
                x='9.33'
                y='9.33'
                width='5.33'
                height='5.33'
                rx='0.8'
            />
        </>
    ),
    home: (
        <>
            <circle
                className='ji-smoke ji-smoke-1'
                cx='17'
                cy='3'
                r='1.1'
                fill='currentColor'
                stroke='none'
            />
            <circle
                className='ji-smoke ji-smoke-2'
                cx='17'
                cy='3'
                r='0.8'
                fill='currentColor'
                stroke='none'
            />
            <path d='M15.5 7.5V4.5h2.5V9.6' />
            <path className='ji-soft-fill' d='M5 10v10h14V10' />
            <path
                d='M2.5 11.5 12 3.5l9.5 8'
                className='ji-roof'
                stroke='#e74c3c'
            />
            <path
                className='ji-door ji-accent-fill-solid'
                d='M10 20v-5.5h4V20'
            />
        </>
    ),
    flag: (
        <>
            <path d='M5.5 21.5V3' />
            <path
                className='ji-cloth ji-accent-fill-solid'
                d='M5.5 4h12l-3 3.75L17.5 11.5h-12'
            />
            <path d='M3 21.5h5' />
        </>
    ),
    edit: (
        <>
            <path
                className='ji-scribble ji-accent-stroke'
                d='M3.5 21c1.5-1 3-1 4.5 0s3 1 4.5 0'
            />
            <g className='ji-pencil'>
                <path
                    d='M15.5 3.5l5 5L9.5 19.5 3.8 20.2l.7-5.7z'
                    fill='#f9e08b'
                />
                <path d='M13.5 5.5l5 5' />
                <path d='M4.5 14.5l5 5' opacity='0.5' />
            </g>
        </>
    ),
    lock: (
        <>
            <path className='ji-shackle' d='M8 10.5V8a4 4 0 0 1 8 0v2.5' />
            <rect
                x='5'
                y='10.5'
                width='14'
                height='10'
                rx='2.2'
                fill='#f9e08b'
            />
            <path d='M12 14.5v2.5' strokeWidth='2.2' />
        </>
    ),
    unlock: (
        <>
            <path
                className='ji-shackle-open'
                d='M8 10.5V8a4 4 0 0 1 7.7-1.5'
            />
            <rect
                x='5'
                y='10.5'
                width='14'
                height='10'
                rx='2.2'
                fill='#d5f5e3'
            />
            <path d='M12 14.5v2.5' strokeWidth='2.2' />
        </>
    ),
    "to-front": (
        <>
            <path d='M5 3.5h14' className='ji-accent-stroke' strokeWidth='2.4' />
            <path className='ji-chev ji-chev-up ji-c1' d='M7 13l5-5 5 5' />
            <path className='ji-chev ji-chev-up ji-c2' d='M7 19l5-5 5 5' />
        </>
    ),
    forward: (
        <>
            <path className='ji-chev ji-chev-up ji-c1' d='M7 13.5l5-5 5 5' />
            <path d='M5 19h14' opacity='0.4' />
        </>
    ),
    backward: (
        <>
            <path d='M5 5h14' opacity='0.4' />
            <path className='ji-chev ji-chev-down ji-c1' d='M7 10.5l5 5 5-5' />
        </>
    ),
    "to-back": (
        <>
            <path className='ji-chev ji-chev-down ji-c1' d='M7 5l5 5 5-5' />
            <path className='ji-chev ji-chev-down ji-c2' d='M7 11l5 5 5-5' />
            <path
                d='M5 20.5h14'
                className='ji-accent-stroke'
                strokeWidth='2.4'
            />
        </>
    ),
    trash: (
        <>
            <g className='ji-lid'>
                <path d='M3.5 6.5h17' />
                <path d='M9.5 6.5V4h5v2.5' />
            </g>
            <path d='M5.8 6.5l1 13.5h10.4l1-13.5' fill='#fadbd8' />
            <path d='M10 10.5v6M14 10.5v6' />
        </>
    ),
    "new-board": (
        <>
            <path d='M5.5 3h8.5l4.5 4.5V21h-13z' className='ji-soft-fill' />
            <path d='M14 3v4.5h4.5' />
            <path
                className='ji-sparkle ji-accent-stroke'
                d='M12 10.5v7M8.5 14h7'
                strokeWidth='2.2'
            />
        </>
    ),
    export: (
        <>
            <path d='M4 14.5V19a1.5 1.5 0 0 0 1.5 1.5h13A1.5 1.5 0 0 0 20 19v-4.5' />
            <g className='ji-arrow-up'>
                <path className='ji-accent-stroke' d='M12 15.5V4' />
                <path className='ji-accent-stroke' d='M7.5 8.5 12 4l4.5 4.5' />
            </g>
        </>
    ),
    import: (
        <>
            <path d='M4 14.5V19a1.5 1.5 0 0 0 1.5 1.5h13A1.5 1.5 0 0 0 20 19v-4.5' />
            <g className='ji-arrow-down'>
                <path className='ji-accent-stroke' d='M12 3.5V15' />
                <path className='ji-accent-stroke' d='M7.5 10.5 12 15l4.5-4.5' />
            </g>
        </>
    ),
    brush: (
        <>
            <path
                className='ji-stroke-trail ji-accent-stroke'
                d='M3 21.5c3 0 5-1 6.5-2.5'
                strokeWidth='2.4'
            />
            <g className='ji-brush'>
                <path d='M20.5 3.5 12 12' strokeWidth='2.6' />
                <path
                    className='ji-accent-fill-solid'
                    d='M11.5 12.5c-3 0-4.5 1.6-4.5 4 0 1.4-.8 2.4-2.2 3 3.2 1 7.3-.2 8.2-3.6z'
                />
            </g>
        </>
    ),
    eraser: (
        <>
            <path className='ji-crumbs' d='M14 21h.01M17 21h.01M20 21h.01' strokeWidth='2.4' />
            <g className='ji-eraser'>
                <path d='M14.5 3.5l6 6-9.5 9.5H6.5L3 15.5z' fill='#f5b7b1' />
                <path d='M9 9l6 6' />
                <path d='M3 15.5 6.5 19H11' fill='#fdedec' />
            </g>
        </>
    ),
    bucket: (
        <>
            <g className='ji-bucket'>
                <path d='M4 10.5 11 4l8 8-7 6.5z' fill='#fdebd0' />
                <path d='M4 10.5c3.5 1.2 9.5 1.5 15 1.5' />
                <path d='M9 6 6.5 3.5' />
            </g>
            <path
                className='ji-drip ji-accent-fill-solid'
                d='M20.5 15c.9 1.4 1.5 2.4 1.5 3.2a1.5 1.5 0 0 1-3 0c0-.8.6-1.8 1.5-3.2z'
                stroke='none'
            />
        </>
    ),
    hand: (
        <g className='ji-hand'>
            <path
                d='M8 13V5.5a1.5 1.5 0 0 1 3 0V11m0-1V4a1.5 1.5 0 0 1 3 0v6m0 0V5.5a1.5 1.5 0 0 1 3 0V12m0-2.5a1.5 1.5 0 0 1 3 0V15a6.5 6.5 0 0 1-6.5 6.5H13a6 6 0 0 1-5-2.7l-3.1-4.7a1.6 1.6 0 0 1 2.6-1.9L8 13'
                fill='#fdebd0'
            />
        </g>
    ),
    rotate: (
        <g className='ji-spin'>
            <path d='M20 12a8 8 0 1 1-2.35-5.65' />
            <path d='M20 4v4.5h-4.5' />
        </g>
    ),
    close: (
        <g className='ji-close'>
            <path d='M6.5 6.5l11 11M17.5 6.5l-11 11' />
        </g>
    ),
    library: (
        <>
            <path d='M4 4h3.5v16H4zM9 4h3.5v16H9z' className='ji-soft-fill' />
            <g className='ji-book'>
                <path
                    d='M14.2 5.2l3.4-.9 3.9 14.8-3.4.9z'
                    className='ji-accent-fill-solid'
                />
            </g>
            <path d='M4 8h3.5M9 8h3.5M4 16h3.5M9 16h3.5' opacity='0.5' />
        </>
    ),
    trail: (
        <>
            <path
                className='ji-route ji-accent-stroke'
                d='M4 19c3-.5 4-3.5 6.5-5S16 13 18 9.5'
            />
            <circle
                className='ji-trail-dot ji-accent-fill-solid'
                cx='18.5'
                cy='7.5'
                r='3'
            />
            <circle cx='4' cy='19' r='1.6' fill='currentColor' stroke='none' />
        </>
    ),
    // Floppy disk: the shutter slides as if the disk is being written
    save: (
        <>
            <path
                d='M4 5.5A1.5 1.5 0 0 1 5.5 4h11L20 7.5v11a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 18.5z'
                className='ji-accent-fill-solid'
            />
            <rect x='7' y='13' width='10' height='7' rx='0.5' fill='#fdfefe' />
            <path d='M9 15.5h6M9 17.5h4' opacity='0.5' />
            <g className='ji-shutter'>
                <rect x='8' y='4' width='7' height='5' fill='#bdc3c7' />
                <rect x='12.5' y='5' width='1.6' height='3' fill='#555' stroke='none' />
            </g>
        </>
    ),
    // Folder whose front flap swings open
    open: (
        <>
            <path
                d='M3 7V5.5A1.5 1.5 0 0 1 4.5 4h4l2 2h9A1.5 1.5 0 0 1 21 7.5V18a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 18z'
                fill='#f5cba7'
            />
            <path
                className='ji-flap'
                d='M3 19.5l2.2-9A1.5 1.5 0 0 1 6.7 9.5H21.5l-2.3 9a1.5 1.5 0 0 1-1.4 1z'
                fill='#f8c471'
            />
        </>
    ),
    // Page with lines that write themselves
    document: (
        <>
            <path d='M6 3h8l4.5 4.5V20a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z' fill='#fdfefe' />
            <path d='M14 3v4.5h4.5' />
            <path className='ji-line ji-l1 ji-accent-stroke' d='M8 11h7.5' />
            <path className='ji-line ji-l2 ji-accent-stroke' d='M8 14h7.5' />
            <path className='ji-line ji-l3 ji-accent-stroke' d='M8 17h5' />
        </>
    ),
    // Chain links that pull together
    link: (
        <>
            <path className='ji-link-a' d='M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1.2 1.2' />
            <path className='ji-link-b ji-accent-stroke' d='M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1.2-1.2' />
        </>
    ),
    // Spell book with a bobbing question mark
    help: (
        <>
            <path d='M5 4.5A1.5 1.5 0 0 1 6.5 3H19v15H6.5A1.5 1.5 0 0 0 5 19.5z' className='ji-accent-fill-solid' />
            <path d='M5 19.5A1.5 1.5 0 0 0 6.5 21H19v-3' />
            <g className='ji-qmark'>
                <path d='M10 8.3a2.2 2.2 0 1 1 3.3 1.9c-.8.5-1.3.9-1.3 1.8' stroke='white' />
                <path d='M12 14.2h.01' stroke='white' strokeWidth='2.4' />
            </g>
        </>
    ),
    // Pencil scribbling a squiggle
    scribble: (
        <>
            <path
                className='ji-scribble-line ji-accent-stroke'
                d='M3 18c2-3 3.5-3 4 0s2.5 3 4 0 2.5-3 3.5-1'
                strokeWidth='2'
            />
            <g className='ji-pencil'>
                <path d='M19.5 3.5l1.5 1.5-7 7-2.2.7.7-2.2z' fill='#f9e08b' />
            </g>
        </>
    ),
    // Stack of sheets fanning out
    layers: (
        <>
            <path className='ji-layer-3' d='M12 16.5 3 12l2-1' opacity='0.5' />
            <path className='ji-layer-3' d='M19 11l2 1-9 4.5' opacity='0.5' />
            <path className='ji-layer-2' d='M12 20 3 15.5l2-1M19 14.5l2 1L12 20' opacity='0.35' />
            <path className='ji-layer-1 ji-accent-fill-solid' d='M12 4 3 8.5l9 4.5 9-4.5z' />
        </>
    ),
    // Marquee box with marching ants
    select: (
        <>
            <rect className='ji-ants' x='3.5' y='3.5' width='17' height='17' rx='1.5' strokeDasharray='3 2.4' />
            <path className='ji-select-arrow ji-accent-fill-solid' d='M11 10l7.5 3-3.2 1.1L14 17.5z' />
        </>
    ),
    // Two boxes joined by a line that draws itself
    connector: (
        <>
            <rect x='2.5' y='3.5' width='7' height='6' rx='1.5' fill='#fdfefe' />
            <rect x='14.5' y='14.5' width='7' height='6' rx='1.5' className='ji-accent-fill-solid' />
            <path className='ji-wire ji-accent-stroke' d='M9.5 6.5h3a2 2 0 0 1 2 2v6' />
            <circle cx='9.5' cy='6.5' r='1.3' fill='currentColor' stroke='none' />
        </>
    ),
    eye: (
        <>
            <path d='M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z' fill='#fdfefe' />
            <g className='ji-pupil'>
                <circle cx='12' cy='12' r='3.2' className='ji-accent-fill-solid' />
                <circle cx='13' cy='11' r='0.9' fill='white' stroke='none' />
            </g>
        </>
    ),
    gear: (
        <g className='ji-gear'>
            <path d='M12 2.8l1.6 2.1 2.6-.6.6 2.6 2.4 1.1-1 2.4 1.5 2.2-2.2 1.5.1 2.7-2.7.1-1.3 2.3-2.4-1.2-2.4 1.2-1.3-2.3-2.7-.1.1-2.7-2.2-1.5 1.5-2.2-1-2.4 2.4-1.1.6-2.6 2.6.6z' fill='#d5dbdb' />
            <circle cx='12' cy='12' r='3.2' fill='#fdfefe' />
        </g>
    ),
    hex: (
        <>
            <path className='ji-hex' d='M12 3l7.8 4.5v9L12 21l-7.8-4.5v-9z' fill='var(--ji-soft)' />
            <path d='M12 8l3.5 2v4L12 16l-3.5-2v-4z' className='ji-accent-fill-solid' opacity='0.8' />
        </>
    ),
    "eye-off": (
        <>
            <path d='M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z' opacity='0.45' />
            <path d='M4 4l16 16' />
        </>
    ),
}

export const Icon: React.FC<IconProps> = ({
    name,
    size = 22,
    className = "",
    title,
    style,
}) => (
    <svg
        className={`jicon jicon--${name} ${className}`}
        width={size}
        height={size}
        viewBox='0 0 24 24'
        fill='none'
        stroke='currentColor'
        strokeWidth='1.8'
        strokeLinecap='round'
        strokeLinejoin='round'
        aria-hidden={title ? undefined : true}
        role={title ? "img" : undefined}
        style={style}
    >
        {title && <title>{title}</title>}
        {ICONS[name]}
    </svg>
)
