import React from "react"
import type { BoardOverlayProps } from "../types"
import { LightOverlay } from "./LightOverlay"
import { FogOverlay } from "./FogOverlay"
import { WallsOverlay } from "./WallsOverlay"

/** Darkness first, fog on top (fog hides lit areas too), then the GM's sight walls */
export const FogLightOverlays: React.FC<BoardOverlayProps> = ({ camera }) => (
    <>
        <LightOverlay camera={camera} />
        <FogOverlay camera={camera} />
        <WallsOverlay camera={camera} />
    </>
)
