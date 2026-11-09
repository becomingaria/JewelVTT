import React from "react"
import { IconFrame } from "../host/FeatureIcon"
import type { LogEntry } from "../services"

/* Original 24×24 icons for the dice feature */

/** A twenty-sider seen face-on */
export const DiceTrayIcon: React.FC = () => (
    <IconFrame>
        <path d='M12 2.5 20.5 7.3v9.4L12 21.5l-8.5-4.8V7.3z' />
        <path d='M12 6.5 16.8 15H7.2z' />
        <path d='M12 2.5v4M3.5 7.3l3.7 7.7M20.5 7.3l-3.7 7.7M7.2 15 12 21.5 16.8 15' />
    </IconFrame>
)

/** A scroll with a list on it */
export const TablesIcon: React.FC = () => (
    <IconFrame>
        <path d='M6 4h11a2 2 0 0 1 2 2v12a2 2 0 0 0 2 2H8a2 2 0 0 1-2-2z' />
        <path d='M6 4a2 2 0 0 0-2 2v2h2' />
        <path d='M9.5 9h6M9.5 12.5h6M9.5 16h4' />
    </IconFrame>
)

/** An open journal with a bookmark */
export const LogIcon: React.FC = () => (
    <IconFrame>
        <path d='M3 5.5c3-1.3 6-1.3 9 .8 3-2.1 6-2.1 9-.8v13c-3-1.3-6-1.3-9 .8-3-2.1-6-2.1-9-.8z' />
        <path d='M12 6.3v13' />
        <path d='M16 5v5l1.5-1.2L19 10V5' />
    </IconFrame>
)

/** Star burst: critical success */
export const CritIcon: React.FC = () => (
    <IconFrame>
        <path d='M12 3l2.4 5.6 6.1.5-4.6 4 1.4 6-5.3-3.2-5.3 3.2 1.4-6-4.6-4 6.1-.5z' />
    </IconFrame>
)

/** Cracked skull: fumble */
export const FumbleIcon: React.FC = () => (
    <IconFrame>
        <path d='M5 11a7 7 0 1 1 14 0v3l-2 1v4H7v-4l-2-1z' />
        <circle cx='9.3' cy='11.5' r='1.6' />
        <circle cx='14.7' cy='11.5' r='1.6' />
        <path d='M12 4l-1 3 2 2-1 2' />
    </IconFrame>
)

const KIND_PATHS: Record<LogEntry["kind"], React.ReactNode> = {
    roll: <path d='M5 5h14v14H5zM9 9h.01M15 15h.01M12 12h.01' />,
    table: <path d='M5 4h14v16H5zM8.5 9h7M8.5 12.5h7M8.5 16h4' />,
    turn: <path d='M7 3h10M7 21h10M8 3c0 5 8 5 8 9s-8 4-8 9M16 3c0 5-8 5-8 9s8 4 8 9' />,
    travel: <path d='M4 20l5-16 3 9 2-4 6 11zM9 4l3 9' />,
    weather: <path d='M7 17a4 4 0 0 1 .5-8 5 5 0 0 1 9.5 1.5A3.3 3.3 0 0 1 17 17zM9 20l1-2M13 20l1-2' />,
    encounter: <path d='M5 19 15 9M15 9l2-5 3 3-5 2M19 19 9 9M9 9 7 4 4 7l5 2' />,
    note: <path d='M5 19l1-4 10-10 3 3-10 10zM14 7l3 3' />,
    scene: <path d='M3 6h18v12H3zM3 10h18M8 6v4M14 6v4' />,
    system: <path d='M12 8v5M12 16h.01M12 3l9 16H3z' />,
}

/** Small icon per log entry kind (always shown alongside its text label) */
export const LogKindIcon: React.FC<{ kind: LogEntry["kind"] }> = ({ kind }) => (
    <IconFrame>{KIND_PATHS[kind] ?? KIND_PATHS.system}</IconFrame>
)
