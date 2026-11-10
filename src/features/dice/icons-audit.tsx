import React from "react"
import { IconFrame } from "../host/FeatureIcon"

/** A die under a magnifying glass */
export const AuditIcon: React.FC = () => (
    <IconFrame>
        <rect x='3' y='3' width='10' height='10' rx='1.5' />
        <circle cx='6' cy='6' r='0.9' fill='currentColor' stroke='none' />
        <circle cx='10' cy='10' r='0.9' fill='currentColor' stroke='none' />
        <circle cx='15' cy='15' r='4.2' />
        <path d='M18.2 18.2l3 3' />
    </IconFrame>
)
