import React, { useEffect, useState } from "react"
import "./Toast.css"

import { TOAST_EVENT, type ToastItem } from "../utils/toast"

/** Renders toasts from showToast() (src/utils/toast.ts), bottom-centre */
export const ToastHost: React.FC = () => {
    const [toasts, setToasts] = useState<ToastItem[]>([])

    useEffect(() => {
        const handle = (event: Event) => {
            const toast = (event as CustomEvent<ToastItem>).detail
            setToasts((prev) => [...prev.slice(-2), toast])
            window.setTimeout(
                () => setToasts((prev) => prev.filter((t) => t.id !== toast.id)),
                toast.kind === "error" ? 6000 : 3000
            )
        }
        window.addEventListener(TOAST_EVENT, handle)
        return () => window.removeEventListener(TOAST_EVENT, handle)
    }, [])

    return (
        <div className='toast-host' role='status' aria-live='polite'>
            {toasts.map((t) => (
                <div key={t.id} className={`toast toast-${t.kind}`}>
                    {t.message}
                </div>
            ))}
        </div>
    )
}
