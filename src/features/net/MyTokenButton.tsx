import React from "react"
import { useStore } from "../store"
import { useNetRole } from "../view-state"
import { clientStore } from "./client"
import { goToMyToken } from "./my-token"

/** A person icon in the pixel style of the other top-bar icons */
const PersonIcon: React.FC = () => (
    <svg width='24' height='24' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='1.8' aria-hidden='true'>
        <rect x='9' y='3' width='6' height='6' />
        <path d='M5 21v-5l3-4h8l3 4v5' />
        <path d='M12 15v3' />
    </svg>
)

/** Top bar, right of the home button, for players */
export const MyTokenButton: React.FC = () => {
    const role = useNetRole()
    const client = useStore(clientStore)
    if (role !== "player" || client?.status !== "connected") return null
    return (
        <button
            type='button'
            className='top-bar-icon-button'
            onClick={goToMyToken}
            aria-label='Go to my token'
            title='Go to my token (J). Press again for the next one.'
        >
            <PersonIcon />
        </button>
    )
}
