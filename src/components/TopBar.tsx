import React from "react"
import "./TopBar.css"

interface TopBarProps {
    onSidebarToggle: () => void
}

export const TopBar: React.FC<TopBarProps> = ({ onSidebarToggle }) => {
    return (
        <div className='top-bar'>
            <div className='top-bar-left'>
                <div className='menu-container'>
                    <button
                        className='hamburger-menu'
                        onClick={onSidebarToggle}
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
