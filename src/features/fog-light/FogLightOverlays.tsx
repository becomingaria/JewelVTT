import React from "react"
import type { BoardOverlayProps } from "../types"
import { LightOverlay } from "./LightOverlay"
import { FogOverlay } from "./FogOverlay"

/** Darkness first, fog on top (fog hides lit areas too) */
export const FogLightOverlays: React.FC<BoardOverlayProps> = ({ camera }) => (
    <>
        <LightOverlay camera={camera} />
        <FogOverlay camera={camera} />
    </>
)
