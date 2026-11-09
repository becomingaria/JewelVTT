import React, { useEffect } from "react"
import { useStore } from "../store"
import { MAP_KINDS, mapKindStore } from "../map-kind"
import { playSfx } from "../sound"
import { snapshotBoard } from "../../utils/board-store"
import { showTitleCard, themeViewerStore, titleCardStore } from "./theme-store"
import { TITLE_CARD_MS, isEmptyBoard, splitInitial } from "./title-card-logic"
import "./title-card.css"

/** Let the loaded slices settle (and the scene tabs render) before reading */
const SETTLE_MS = 250

const kindLabel = () => MAP_KINDS.find((k) => k.id === mapKindStore.get())?.label

/** The active scene tab's name, if scenes are open */
const activeSceneName = () =>
    document.querySelector(".scene-tab.active .spot-tab-name")?.textContent?.trim() || null

/**
 * Watches for boards and scenes loading and shows a short title card.
 * Never on an empty board (so not on a fresh first start), and only when
 * the viewer has title cards turned on.
 */
function useTitleCardTrigger() {
    useEffect(() => {
        let timer: number | undefined
        const onLoaded = (e: Event) => {
            if (!themeViewerStore.get().titleCards) return
            const named = (e as CustomEvent<{ name?: string } | undefined>).detail?.name
            window.clearTimeout(timer)
            timer = window.setTimeout(() => {
                let empty = true
                try {
                    empty = isEmptyBoard(snapshotBoard().board)
                } catch {
                    /* no board state yet */
                }
                if (empty) return
                const scene = named || activeSceneName()
                const kind = kindLabel()
                if (scene) showTitleCard(scene, kind)
                else if (kind) showTitleCard(kind)
            }, SETTLE_MS)
        }
        window.addEventListener("jewel:boardLoaded", onLoaded)
        return () => {
            window.clearTimeout(timer)
            window.removeEventListener("jewel:boardLoaded", onLoaded)
        }
    }, [])
}

/** Pixel-art frame for the illuminated initial (16×16 cells) */
const InitialFrame: React.FC = () => (
    <svg className='jv-tc-initial-art' viewBox='0 0 16 16' shapeRendering='crispEdges' aria-hidden='true'>
        <rect className='tc-gold' x='0' y='0' width='16' height='16' />
        <rect className='tc-ink' x='1' y='1' width='14' height='14' />
        <rect className='tc-field' x='2' y='2' width='12' height='12' />
        {/* corner knots */}
        {[
            [2, 2],
            [12, 2],
            [2, 12],
            [12, 12],
        ].map(([x, y]) => (
            <g key={`${x}-${y}`}>
                <rect className='tc-gold' x={x} y={y} width='2' height='2' />
                <rect className='tc-ink' x={x + 0.5} y={y + 0.5} width='1' height='1' />
            </g>
        ))}
        {/* a vine of leaves down the left and along the foot */}
        {[5, 7, 9].map((y) => (
            <rect key={`l${y}`} className='tc-leaf' x='2' y={y} width='1' height='1' />
        ))}
        {[5, 7, 9].map((x) => (
            <rect key={`b${x}`} className='tc-leaf' x={x} y='13' width='1' height='1' />
        ))}
        <rect className='tc-gold' x='7' y='0' width='2' height='1' />
        <rect className='tc-gold' x='7' y='15' width='2' height='1' />
        <rect className='tc-gold' x='0' y='7' width='1' height='2' />
        <rect className='tc-gold' x='15' y='7' width='1' height='2' />
    </svg>
)

/** Pixel rule under the title: a line with a diamond and end knobs */
const Divider: React.FC = () => (
    <svg className='jv-tc-divider' viewBox='0 0 61 5' shapeRendering='crispEdges' aria-hidden='true'>
        <rect className='tc-gold' x='0' y='1' width='3' height='3' />
        <rect className='tc-ink' x='3' y='2' width='23' height='1' />
        <rect className='tc-gold' x='28' y='0' width='5' height='5' />
        <rect className='tc-field' x='29' y='1' width='3' height='3' />
        <rect className='tc-gold' x='30' y='2' width='1' height='1' />
        <rect className='tc-ink' x='35' y='2' width='23' height='1' />
        <rect className='tc-gold' x='58' y='1' width='3' height='3' />
    </svg>
)

/** The card itself, plus a polite live region announcing the scene */
export const TitleCard: React.FC = () => {
    const card = useStore(titleCardStore)
    useTitleCardTrigger()

    useEffect(() => {
        if (!card) return
        playSfx("page")
        const done = window.setTimeout(() => titleCardStore.set(null), TITLE_CARD_MS)
        // Esc skips the card first (before closing anything else)
        const onKey = (e: KeyboardEvent) => {
            if (e.key !== "Escape") return
            e.stopPropagation()
            titleCardStore.set(null)
        }
        window.addEventListener("keydown", onKey, true)
        return () => {
            window.clearTimeout(done)
            window.removeEventListener("keydown", onKey, true)
        }
    }, [card])

    const parts = card ? splitInitial(card.title) : null
    const announce = card ? (card.subtitle ? `${card.title}. ${card.subtitle}` : card.title) : ""

    return (
        <>
            <div className='jv-sr-only' role='status' aria-live='polite'>
                {announce}
            </div>
            {card && parts && (
                <div className='jv-title-card-layer'>
                    <div
                        key={card.key}
                        className='jv-title-card'
                        aria-hidden='true'
                        title='Click or press Esc to skip'
                        onClick={() => titleCardStore.set(null)}
                    >
                        <div className='jv-tc-row'>
                            {parts.initial && (
                                <span className='jv-tc-initial'>
                                    <InitialFrame />
                                    <span className='jv-tc-initial-letter'>{parts.initial}</span>
                                </span>
                            )}
                            <span className='jv-tc-title'>{parts.rest}</span>
                        </div>
                        <Divider />
                        {card.subtitle && <span className='jv-tc-sub'>{card.subtitle}</span>}
                    </div>
                </div>
            )}
        </>
    )
}
