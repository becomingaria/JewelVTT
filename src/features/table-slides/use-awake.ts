import { useEffect, useState } from "react"

/**
 * True for `ms` after the last pointer movement or key press (or after
 * `poke` changes) while `active`. Drives the fade-in / fade-out HUDs.
 */
export function useAwake(active: boolean, ms: number, poke?: unknown): boolean {
    const [awake, setAwake] = useState(true)
    useEffect(() => {
        if (!active) return
        let timer = 0
        const wake = () => {
            setAwake(true)
            window.clearTimeout(timer)
            timer = window.setTimeout(() => setAwake(false), ms)
        }
        wake()
        window.addEventListener("mousemove", wake)
        window.addEventListener("mousedown", wake)
        window.addEventListener("keydown", wake)
        return () => {
            window.clearTimeout(timer)
            window.removeEventListener("mousemove", wake)
            window.removeEventListener("mousedown", wake)
            window.removeEventListener("keydown", wake)
        }
    }, [active, ms, poke])
    return active && awake
}

/**
 * While `active`, hide the pointer over the board after `ms` without
 * movement (html[data-ts-idle]); any movement brings it back.
 */
export function usePointerAutoHide(active: boolean, ms = 3000) {
    useEffect(() => {
        const el = document.documentElement
        if (!active) {
            el.removeAttribute("data-ts-idle")
            return
        }
        let timer = 0
        const arm = () => {
            el.removeAttribute("data-ts-idle")
            window.clearTimeout(timer)
            timer = window.setTimeout(() => el.setAttribute("data-ts-idle", ""), ms)
        }
        arm()
        window.addEventListener("mousemove", arm)
        window.addEventListener("mousedown", arm)
        return () => {
            window.clearTimeout(timer)
            window.removeEventListener("mousemove", arm)
            window.removeEventListener("mousedown", arm)
            el.removeAttribute("data-ts-idle")
        }
    }, [active, ms])
}
