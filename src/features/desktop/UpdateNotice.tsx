import React, { useEffect, useState } from "react"
import { desktop, type UpdateStatus } from "../../desktop"
import "./desktop.css"

/*
 * Update notice. Nothing appears while checking or downloading. Once an
 * update is ready it offers "Restart now" or "Later" (it also installs by
 * itself next time the app closes). Mac builds are unsigned freeware, so
 * they can't self-install: the notice links to the download instead.
 */
export const UpdateNotice: React.FC = () => {
    const [status, setStatus] = useState<UpdateStatus | null>(null)
    const [dismissed, setDismissed] = useState<string | null>(null)

    useEffect(() => desktop?.onUpdateStatus(setStatus), [])

    if (!status || (status.state !== "ready" && status.state !== "manual")) return null
    if (dismissed === status.version) return null

    const ready = status.state === "ready"
    return (
        <div className='desktop-update jv-window' role='status' aria-live='polite'>
            <p>
                <strong>Jewel VTT {status.version}</strong>{" "}
                {ready ? "is ready to install." : "is available."}
            </p>
            <div className='desktop-update-actions'>
                {ready ? (
                    <button type='button' className='jv-button jv-button-primary' onClick={() => void desktop?.installUpdate()}>
                        Restart now
                    </button>
                ) : (
                    <button type='button' className='jv-button jv-button-primary' onClick={() => void desktop?.openReleasePage()}>
                        Download
                    </button>
                )}
                <button type='button' className='jv-button' onClick={() => setDismissed(status.version)}>
                    Later
                </button>
            </div>
            {ready && <p className='desktop-update-note'>Otherwise it installs next time you close the app.</p>}
        </div>
    )
}
