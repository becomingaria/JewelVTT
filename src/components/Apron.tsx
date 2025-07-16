import React from 'react'
import './Apron.css'

interface ApronProps {
    isVisible: boolean
}

export const Apron: React.FC<ApronProps> = ({ isVisible }) => {
    if (!isVisible) return null

    return (
        <div className="apron">
            <div className="apron-content">
                {/* Buttons will be added here later */}
                <div className="apron-placeholder">
                    Tool buttons will go here
                </div>
            </div>
        </div>
    )
}
