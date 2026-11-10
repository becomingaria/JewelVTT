import React from "react"
import { IconFrame } from "../host/FeatureIcon"

/** Two pixel figures linked by a dotted line */
export const NetIcon: React.FC = () => (
    <IconFrame>
        <circle cx='6' cy='7' r='2.4' />
        <path d='M2.5 15.5c0-2.2 1.6-3.8 3.5-3.8s3.5 1.6 3.5 3.8' />
        <circle cx='18' cy='7' r='2.4' />
        <path d='M14.5 15.5c0-2.2 1.6-3.8 3.5-3.8s3.5 1.6 3.5 3.8' />
        <path d='M7 19.5h10' strokeDasharray='1.5 2.2' />
    </IconFrame>
)
