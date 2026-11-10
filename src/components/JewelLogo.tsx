import React, { useRef, useState } from "react"
import { playSfx } from "../features/sound"
import { prefersReducedMotion } from "../features/prefs"
import "./JewelLogo.css"

/*
 * The jewel in the top bar. Purely for fun: clicking it bursts a few pixel
 * shards in the gem's colours and plays a soft chime (when sound is on in
 * Settings). Under reduced motion it just glints.
 */

const SHARD_COLOURS = ["#d8b8ff", "#b07cff", "#8e4fe6", "#6a2fcf", "#f5c542", "#ffffff"]

interface Shard {
    id: number
    dx: number
    dy: number
    rot: number
    size: number
    colour: string
    delay: number
}

let nextBurst = 0

export const JewelLogo: React.FC = () => {
    const [bursts, setBursts] = useState<{ id: number; shards: Shard[] }[]>([])
    const [glint, setGlint] = useState(0)
    const timers = useRef<number[]>([])

    const sparkle = () => {
        playSfx("chime")
        setGlint((g) => g + 1)
        if (prefersReducedMotion()) return
        const id = ++nextBurst
        const count = 12
        const shards: Shard[] = Array.from({ length: count }, (_, i) => {
            const angle = (i / count) * Math.PI * 2 + (Math.random() - 0.5) * 0.5
            const dist = 26 + Math.random() * 26
            return {
                id: i,
                dx: Math.cos(angle) * dist,
                // A little upward bias so it feels like a pop
                dy: Math.sin(angle) * dist * 0.8 - 6,
                rot: (Math.random() - 0.5) * 540,
                size: Math.random() < 0.3 ? 5 : 3,
                colour: SHARD_COLOURS[Math.floor(Math.random() * SHARD_COLOURS.length)],
                delay: Math.random() * 40,
            }
        })
        setBursts((b) => [...b.slice(-3), { id, shards }])
        timers.current.push(window.setTimeout(() => setBursts((b) => b.filter((x) => x.id !== id)), 800))
    }

    return (
        <button type='button' className='jewel-logo' onClick={sparkle} aria-label='Jewel VTT' title='Jewel VTT'>
            <img
                key={glint}
                src='/jewelvtt.svg'
                alt=''
                className={`logo ${glint ? "jewel-logo-pop" : ""}`}
                width={44}
                height={34}
            />
            <span className='jewel-shards' aria-hidden='true'>
                {bursts.map((b) =>
                    b.shards.map((s) => (
                        <i
                            key={`${b.id}-${s.id}`}
                            style={
                                {
                                    "--dx": `${s.dx}px`,
                                    "--dy": `${s.dy}px`,
                                    "--rot": `${s.rot}deg`,
                                    width: s.size,
                                    height: s.size,
                                    background: s.colour,
                                    animationDelay: `${s.delay}ms`,
                                } as React.CSSProperties
                            }
                        />
                    ))
                )}
            </span>
        </button>
    )
}
