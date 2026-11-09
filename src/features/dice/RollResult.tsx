import React from "react"
import { PixelDie } from "./PixelDie"
import { CritIcon, FumbleIcon } from "./icons"
import type { RollRecord } from "./state"

const MAX_FACES = 24

/** Critical / fumble flag: icon + text, never colour alone */
export const RollFlag: React.FC<{ rec: RollRecord }> = ({ rec }) =>
    rec.crit ? (
        <span className='jv-flag jv-flag--crit'>
            <span className='jv-flag-icon'>
                <CritIcon />
            </span>
            Critical!
        </span>
    ) : rec.fumble ? (
        <span className='jv-flag jv-flag--fumble'>
            <span className='jv-flag-icon'>
                <FumbleIcon />
            </span>
            Fumble!
        </span>
    ) : null

/** Pixel dice faces for a roll (dropped dice struck through) */
export const DiceFaces: React.FC<{ rec: RollRecord; size?: number }> = ({ rec, size = 36 }) => {
    if (!rec.dice.length) return null
    const shown = rec.dice.slice(0, MAX_FACES)
    const d20 = rec.dice.filter((d) => d.sides === 20 && !d.dropped)
    return (
        <div className='jv-faces' aria-hidden='true'>
            {shown.map((d, i) => (
                <PixelDie
                    key={i}
                    sides={d.sides}
                    value={d.value}
                    size={size}
                    dropped={d.dropped}
                    mark={
                        d20.length === 1 && d === d20[0]
                            ? rec.crit
                                ? "crit"
                                : rec.fumble
                                  ? "fumble"
                                  : undefined
                            : undefined
                    }
                />
            ))}
            {rec.dice.length > MAX_FACES && <span className='jv-faces-more'>+{rec.dice.length - MAX_FACES} more</span>}
        </div>
    )
}

/** The full result: label, total (or table text), flags, faces, breakdown */
export const RollResult: React.FC<{ rec: RollRecord }> = ({ rec }) => {
    if (rec.error) {
        return (
            <div className='jv-result jv-result--error'>
                <p className='jv-result-label'>
                    <strong>Couldn't roll</strong> “{rec.expression}”
                </p>
                <p className='jv-result-error'>{rec.error}</p>
            </div>
        )
    }
    if (rec.table) {
        return (
            <div className='jv-result jv-result--table'>
                <p className='jv-result-label'>{rec.table.name}</p>
                <p className='jv-result-text'>{rec.table.text}</p>
                <DiceFaces rec={rec} size={28} />
                <p className='jv-result-breakdown'>{rec.breakdown}</p>
            </div>
        )
    }
    return (
        <div className={`jv-result ${rec.crit ? "jv-result--crit" : ""} ${rec.fumble ? "jv-result--fumble" : ""}`}>
            <p className='jv-result-label'>
                {rec.label ? <span>{rec.label}: </span> : null}
                <span className='jv-mono'>{rec.expression}</span>
            </p>
            <p className='jv-result-total'>
                <span className='jv-sr'>Total </span>
                {rec.total}
                <RollFlag rec={rec} />
            </p>
            <DiceFaces rec={rec} />
            <p className='jv-result-breakdown'>{rec.breakdown}</p>
        </div>
    )
}
