import React, { useState } from "react"
import "./TopBar.css"

interface TopBarProps {
    onSidebarToggle: (isOpen: boolean) => void
}

export const TopBar: React.FC<TopBarProps> = ({ onSidebarToggle }) => {
    const [isSidebarOpen, setIsSidebarOpen] = useState(false)

    const toggleSidebar = () => {
        const newState = !isSidebarOpen
        setIsSidebarOpen(newState)
        onSidebarToggle(newState)
    }

    return (
        <div className='top-bar'>
            <div className='top-bar-left'>
                <div className='menu-container'>
                    <button
                        className='hamburger-menu'
                        onClick={toggleSidebar}
                        aria-label='Menu'
                    >
                        <div className='hamburger-line'></div>
                        <div className='hamburger-line'></div>
                        <div className='hamburger-line'></div>
                    </button>
                </div>
                <div className='logo-container'>
                    <img
                        src='/jewelvtt.png'
                        alt='Jewel VTT Logo'
                        className='logo'
                    />
                </div>
            </div>
        </div>
    )
}
