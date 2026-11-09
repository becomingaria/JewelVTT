import React from "react"
import { useStore } from "../store"
import { settingsOpenStore } from "./theme-store"
import { SettingsDialog } from "./SettingsDialog"
import { TitleCard } from "./TitleCard"

/** The theme feature's app layer: the Settings dialog and scene title cards */
export const ThemeLayer: React.FC = () => {
    const open = useStore(settingsOpenStore)
    return (
        <>
            {open && <SettingsDialog />}
            <TitleCard />
        </>
    )
}
