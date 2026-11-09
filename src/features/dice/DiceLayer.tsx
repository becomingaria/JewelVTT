import React, { useEffect } from "react"
import { logStore, useLog, type LogEntry } from "../services"
import { useBoardSlice } from "../../utils/board-store"
import { DiceTray } from "./DiceTray"
import { TablesPanel } from "./TablesPanel"
import { LogPanel } from "./LogPanel"
import { Announcer, QuickBubble } from "./QuickBubble"
import { loadTables } from "./tables-store"
import { KIND_LABEL } from "./journal"

function sanitizeLog(v: unknown): LogEntry[] {
    if (!Array.isArray(v)) return []
    return v
        .filter(
            (e): e is LogEntry =>
                !!e &&
                typeof e === "object" &&
                typeof e.id === "string" &&
                typeof e.at === "number" &&
                typeof e.text === "string" &&
                e.kind in KIND_LABEL
        )
        .slice(-2000)
}

/** Mounted once at the app root: panels, bubble, and saving the log with the board */
export const DiceLayer: React.FC = () => {
    const log = useLog()
    useBoardSlice<LogEntry[]>("dice:log", log, (v) => logStore.set(sanitizeLog(v)))
    useEffect(() => loadTables(), [])
    return (
        <>
            <DiceTray />
            <TablesPanel />
            <LogPanel />
            <QuickBubble />
            <Announcer />
        </>
    )
}
