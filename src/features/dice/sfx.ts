import { prefsStore } from "../prefs"
import { registerSfxEngine, type SfxName } from "../sound"

/*
 * Chiptune sound engine: square, triangle and noise voices with short
 * envelopes, plus quiet generative ambient loops. Registered with the sound
 * facade on load; the facade decides whether anything may play (prefs).
 *
 * The AudioContext is created lazily, on the first sound after the user has
 * interacted with the page (browsers block audio before that anyway).
 */

type Ctx = AudioContext

let ctx: Ctx | null = null
let noiseBuffer: AudioBuffer | null = null
let gestured = false
let pendingAmbient: { id: string; volume: number } | null = null

if (typeof window !== "undefined") {
    const events = ["pointerdown", "keydown", "touchstart"] as const
    const mark = () => {
        gestured = true
        events.forEach((t) => window.removeEventListener(t, mark, true))
        if (pendingAmbient) {
            const p = pendingAmbient
            pendingAmbient = null
            ambient(p.id, p.volume)
        }
    }
    events.forEach((t) => window.addEventListener(t, mark, { capture: true, passive: true }))
}

function audio(): Ctx | null {
    if (!gestured) return null
    if (!ctx) {
        const AC =
            window.AudioContext ??
            (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
        if (!AC) return null
        ctx = new AC()
    }
    if (ctx.state === "suspended") ctx.resume().catch(() => {})
    return ctx
}

function noise(c: Ctx): AudioBuffer {
    if (!noiseBuffer) {
        const len = c.sampleRate * 2
        noiseBuffer = c.createBuffer(1, len, c.sampleRate)
        const data = noiseBuffer.getChannelData(0)
        // 8-bit flavoured noise: sample-and-hold every few samples
        let v = 0
        for (let i = 0; i < len; i++) {
            if (i % 3 === 0) v = Math.random() * 2 - 1
            data[i] = v
        }
    }
    return noiseBuffer
}

const TINY = 0.0001

/** One oscillator note with a click-free attack and exponential decay */
function tone(
    c: Ctx,
    out: AudioNode,
    type: OscillatorType,
    f0: number,
    f1: number,
    t: number,
    dur: number,
    vol: number
) {
    const o = c.createOscillator()
    o.type = type
    o.frequency.setValueAtTime(f0, t)
    if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur)
    const g = c.createGain()
    g.gain.setValueAtTime(TINY, t)
    g.gain.exponentialRampToValueAtTime(vol, t + 0.006)
    g.gain.exponentialRampToValueAtTime(TINY, t + dur)
    o.connect(g).connect(out)
    o.start(t)
    o.stop(t + dur + 0.03)
}

/** A burst of filtered noise */
function hiss(
    c: Ctx,
    out: AudioNode,
    t: number,
    dur: number,
    vol: number,
    filter: { type: BiquadFilterType; f0: number; f1?: number; q?: number }
) {
    const src = c.createBufferSource()
    src.buffer = noise(c)
    const f = c.createBiquadFilter()
    f.type = filter.type
    f.Q.value = filter.q ?? 1
    f.frequency.setValueAtTime(filter.f0, t)
    if (filter.f1) f.frequency.exponentialRampToValueAtTime(filter.f1, t + dur)
    const g = c.createGain()
    g.gain.setValueAtTime(TINY, t)
    g.gain.exponentialRampToValueAtTime(vol, t + 0.004)
    g.gain.exponentialRampToValueAtTime(TINY, t + dur)
    src.connect(f).connect(g).connect(out)
    src.start(t, Math.random() * 1.5)
    src.stop(t + dur + 0.03)
}

/** Dice rattling on a table: a handful of clicky noise ticks */
function rattle(c: Ctx, out: AudioNode, t: number): number {
    let at = t
    const hits = 5 + Math.floor(Math.random() * 3)
    for (let i = 0; i < hits; i++) {
        hiss(c, out, at, 0.03, 0.5 - i * 0.05, { type: "bandpass", f0: 2200 + Math.random() * 1800, q: 3 })
        tone(c, out, "square", 900 + Math.random() * 500, 700, at, 0.02, 0.05)
        at += 0.045 + Math.random() * 0.05 + i * 0.008
    }
    return at
}

// Note frequencies (equal temperament, A4 = 440)
const note = (semisFromA4: number) => 440 * Math.pow(2, semisFromA4 / 12)
const C5 = note(3)
const E5 = note(7)
const G5 = note(10)
const C6 = note(15)

const SOUNDS: Record<SfxName, (c: Ctx, out: AudioNode, t: number) => void> = {
    ui: (c, out, t) => tone(c, out, "square", 1320, 1320, t, 0.035, 0.12),
    select: (c, out, t) => {
        tone(c, out, "square", 660, 660, t, 0.04, 0.1)
        tone(c, out, "square", 990, 990, t + 0.045, 0.05, 0.1)
    },
    place: (c, out, t) => {
        tone(c, out, "triangle", 240, 90, t, 0.12, 0.5)
        hiss(c, out, t, 0.05, 0.15, { type: "lowpass", f0: 900 })
    },
    dice: (c, out, t) => {
        const end = rattle(c, out, t)
        tone(c, out, "square", note(-2), note(-2), end, 0.07, 0.09)
    },
    "dice-crit": (c, out, t) => {
        const end = rattle(c, out, t)
        ;[C5, E5, G5, C6].forEach((f, i) => tone(c, out, "square", f, f, end + i * 0.07, 0.11, 0.1))
        tone(c, out, "triangle", C6 * 2, C6 * 2, end + 0.28, 0.25, 0.12)
    },
    "dice-fumble": (c, out, t) => {
        const end = rattle(c, out, t)
        tone(c, out, "triangle", 330, 220, end, 0.22, 0.4)
        tone(c, out, "triangle", 260, 120, end + 0.24, 0.42, 0.4)
    },
    door: (c, out, t) => {
        // creak: a wobbling low square, then a thump
        const o = c.createOscillator()
        o.type = "square"
        o.frequency.setValueAtTime(70, t)
        o.frequency.linearRampToValueAtTime(110, t + 0.18)
        o.frequency.linearRampToValueAtTime(80, t + 0.3)
        o.frequency.linearRampToValueAtTime(130, t + 0.42)
        const f = c.createBiquadFilter()
        f.type = "lowpass"
        f.frequency.value = 700
        const g = c.createGain()
        g.gain.setValueAtTime(TINY, t)
        g.gain.exponentialRampToValueAtTime(0.06, t + 0.03)
        g.gain.exponentialRampToValueAtTime(TINY, t + 0.45)
        o.connect(f).connect(g).connect(out)
        o.start(t)
        o.stop(t + 0.5)
        tone(c, out, "triangle", 120, 50, t + 0.46, 0.16, 0.5)
        hiss(c, out, t + 0.46, 0.1, 0.2, { type: "lowpass", f0: 500 })
    },
    turn: (c, out, t) => {
        tone(c, out, "triangle", note(3), note(3), t, 0.18, 0.35)
        tone(c, out, "triangle", note(10), note(10), t + 0.12, 0.3, 0.3)
    },
    page: (c, out, t) => {
        hiss(c, out, t, 0.09, 0.25, { type: "highpass", f0: 1800, f1: 5000 })
        hiss(c, out, t + 0.1, 0.07, 0.18, { type: "highpass", f0: 3000, f1: 1500 })
    },
    reveal: (c, out, t) => {
        ;[0, 4, 7, 12, 16].forEach((s, i) =>
            tone(c, out, "triangle", note(s), note(s), t + i * 0.05, 0.2, 0.22)
        )
        hiss(c, out, t, 0.35, 0.06, { type: "highpass", f0: 6000 })
    },
    "torch-out": (c, out, t) => {
        hiss(c, out, t, 0.5, 0.35, { type: "lowpass", f0: 3000, f1: 200 })
        tone(c, out, "triangle", 300, 60, t + 0.05, 0.4, 0.2)
    },
    alert: (c, out, t) => {
        for (let i = 0; i < 2; i++) {
            tone(c, out, "square", note(14), note(14), t + i * 0.22, 0.09, 0.09)
            tone(c, out, "square", note(9), note(9), t + i * 0.22 + 0.1, 0.09, 0.09)
        }
    },
    error: (c, out, t) => {
        tone(c, out, "square", 180, 180, t, 0.08, 0.1)
        tone(c, out, "square", 130, 120, t + 0.1, 0.16, 0.1)
    },
}

const lastPlayed = new Map<SfxName, number>()

function play(name: SfxName, volume: number) {
    const now = performance.now()
    // A burst of identical sounds (many rolls at once) plays once
    if (now - (lastPlayed.get(name) ?? -1e9) < 60) return
    lastPlayed.set(name, now)
    const c = audio()
    const make = SOUNDS[name]
    if (!c || !make || volume <= 0) return
    const out = c.createGain()
    out.gain.value = Math.min(1, Math.max(0, volume)) * 0.8
    out.connect(c.destination)
    make(c, out, c.currentTime + 0.01)
    setTimeout(() => out.disconnect(), 3000)
}

// ------------------------------------------------------------- ambient
interface AmbientLoop {
    id: string
    setVolume: (v: number) => void
    stop: () => void
}

const AMBIENT_LEVEL = 0.16

/** Normalise loop names other features might use */
function loopKind(id: string): "dungeon" | "wilderness" | "tavern" | null {
    const k = id.toLowerCase()
    if (["dungeon", "cave", "crypt", "underground", "ruin"].includes(k)) return "dungeon"
    if (["wilderness", "overland", "hexcrawl", "forest", "wind", "outdoors"].includes(k)) return "wilderness"
    if (["tavern", "inn", "town", "village", "city"].includes(k)) return "tavern"
    return null
}

function startLoop(c: Ctx, id: string, kind: "dungeon" | "wilderness" | "tavern", volume: number): AmbientLoop {
    const bus = c.createGain()
    bus.gain.setValueAtTime(TINY, c.currentTime)
    bus.gain.exponentialRampToValueAtTime(Math.max(TINY, volume * AMBIENT_LEVEL), c.currentTime + 2.5)
    bus.connect(c.destination)

    const sources: AudioScheduledSourceNode[] = []
    const timers = new Set<ReturnType<typeof setTimeout>>()
    let stopped = false

    /** Run fn at random intervals until stopped */
    const every = (minMs: number, maxMs: number, fn: () => void) => {
        const tick = () => {
            if (stopped) return
            const h = setTimeout(() => {
                timers.delete(h)
                if (stopped) return
                fn()
                tick()
            }, minMs + Math.random() * (maxMs - minMs))
            timers.add(h)
        }
        tick()
    }
    const osc = (type: OscillatorType, freq: number, out: AudioNode) => {
        const o = c.createOscillator()
        o.type = type
        o.frequency.value = freq
        o.connect(out)
        o.start()
        sources.push(o)
        return o
    }
    /** Slow sine LFO added onto a parameter */
    const lfo = (rate: number, depth: number, target: AudioParam) => {
        const g = c.createGain()
        g.gain.value = depth
        osc("sine", rate, g)
        g.connect(target)
    }
    const noiseLoop = (out: AudioNode) => {
        const src = c.createBufferSource()
        src.buffer = noise(c)
        src.loop = true
        src.connect(out)
        src.start()
        sources.push(src)
    }

    if (kind === "dungeon") {
        const lp = c.createBiquadFilter()
        lp.type = "lowpass"
        lp.frequency.value = 260
        const drone = c.createGain()
        drone.gain.value = 0.35
        lp.connect(drone).connect(bus)
        osc("triangle", 55, lp)
        osc("triangle", 82.6, lp).detune.value = -7
        osc("square", 41.2, lp)
        lfo(0.06, 0.15, drone.gain)
        // drips, with a small cave echo
        const echo = c.createDelay(1)
        echo.delayTime.value = 0.23
        const fb = c.createGain()
        fb.gain.value = 0.35
        echo.connect(fb).connect(echo)
        echo.connect(bus)
        every(2200, 7000, () => {
            const t = c.currentTime + 0.01
            const f = 1300 + Math.random() * 900
            tone(c, bus, "sine", f, f * 0.55, t, 0.12, 0.5)
            tone(c, echo, "sine", f, f * 0.55, t, 0.12, 0.25)
        })
    } else if (kind === "wilderness") {
        const bp = c.createBiquadFilter()
        bp.type = "bandpass"
        bp.Q.value = 0.8
        bp.frequency.value = 520
        lfo(0.045, 260, bp.frequency)
        const wind = c.createGain()
        wind.gain.value = 0.5
        lfo(0.09, 0.2, wind.gain)
        noiseLoop(bp)
        bp.connect(wind).connect(bus)
        // gusts
        const gust = c.createGain()
        gust.gain.value = TINY
        const hp = c.createBiquadFilter()
        hp.type = "bandpass"
        hp.frequency.value = 1400
        hp.Q.value = 1.5
        noiseLoop(hp)
        hp.connect(gust).connect(bus)
        every(4000, 10000, () => {
            const t = c.currentTime
            gust.gain.setTargetAtTime(0.25 + Math.random() * 0.2, t, 0.8)
            gust.gain.setTargetAtTime(TINY, t + 1.5 + Math.random(), 1.2)
            hp.frequency.setTargetAtTime(1000 + Math.random() * 900, t, 1)
        })
    } else {
        // tavern: low murmur that rises and falls like distant talk, plus plucks
        const lp = c.createBiquadFilter()
        lp.type = "lowpass"
        lp.frequency.value = 480
        const bp = c.createBiquadFilter()
        bp.type = "peaking"
        bp.frequency.value = 300
        bp.gain.value = 6
        const murmur = c.createGain()
        murmur.gain.value = 0.2
        noiseLoop(lp)
        lp.connect(bp).connect(murmur).connect(bus)
        every(180, 520, () => {
            murmur.gain.setTargetAtTime(0.12 + Math.random() * 0.25, c.currentTime, 0.12)
            bp.frequency.setTargetAtTime(220 + Math.random() * 220, c.currentTime, 0.2)
        })
        // a lute-ish triangle pluck, D minor pentatonic
        const scale = [-7, -4, -2, 0, 3, 5, 8, 10]
        every(1300, 3800, () => {
            const t = c.currentTime + 0.01
            const s = scale[Math.floor(Math.random() * scale.length)]
            tone(c, bus, "triangle", note(s - 12), note(s - 12), t, 0.7, 0.35)
            if (Math.random() < 0.35) {
                const s2 = scale[Math.floor(Math.random() * scale.length)]
                tone(c, bus, "triangle", note(s2 - 12), note(s2 - 12), t + 0.2, 0.6, 0.25)
            }
        })
        // the odd clink of a mug
        every(6000, 15000, () => tone(c, bus, "sine", 2600 + Math.random() * 800, 2400, c.currentTime, 0.08, 0.12))
    }

    return {
        id,
        setVolume: (v) =>
            bus.gain.setTargetAtTime(Math.max(TINY, v * AMBIENT_LEVEL), c.currentTime, 0.3),
        stop: () => {
            stopped = true
            timers.forEach(clearTimeout)
            timers.clear()
            const t = c.currentTime
            bus.gain.cancelScheduledValues(t)
            bus.gain.setValueAtTime(Math.max(TINY, bus.gain.value), t)
            bus.gain.exponentialRampToValueAtTime(TINY, t + 1.2)
            sources.forEach((s) => {
                try {
                    s.stop(t + 1.3)
                } catch {
                    /* already stopped */
                }
            })
            setTimeout(() => bus.disconnect(), 1500)
        },
    }
}

let current: AmbientLoop | null = null

function ambient(loopId: string | null, volume: number) {
    const kind = loopId ? loopKind(loopId) : null
    if (!loopId || !kind) {
        pendingAmbient = null
        current?.stop()
        current = null
        return
    }
    if (current?.id === loopId) {
        current.setVolume(volume)
        return
    }
    const c = audio()
    if (!c) {
        // No user gesture yet: start once there is one
        pendingAmbient = { id: loopId, volume }
        return
    }
    current?.stop()
    current = startLoop(c, loopId, kind, volume)
}

// Turning sound or ambience off in Settings silences a running loop at once
prefsStore.subscribe(() => {
    const p = prefsStore.get()
    if (!p.sound || !p.ambient) {
        pendingAmbient = null
        if (current) {
            current.stop()
            current = null
        }
    } else {
        current?.setVolume(p.volume)
    }
})

registerSfxEngine({ play, ambient })
