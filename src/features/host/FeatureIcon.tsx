import React from "react"
import { Icon, type IconName } from "../../components/Icon"

/** Render a ToolDef/menu icon: a built-in name or a feature's own SVG */
export const FeatureIcon: React.FC<{
    icon: IconName | React.ReactElement
    size?: number
    className?: string
}> = ({ icon, size = 22, className }) =>
    typeof icon === "string" ? (
        <Icon name={icon} size={size} className={className} />
    ) : (
        <span
            className={`feature-icon ${className ?? ""}`}
            style={{ width: size, height: size, display: "inline-flex" }}
            aria-hidden='true'
        >
            {icon}
        </span>
    )

/**
 * Frame for a feature's own icon, matching the built-in set: 24×24 grid,
 * currentColor strokes, 1.8 stroke width, round caps.
 */
export const IconFrame: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <svg
        width='100%'
        height='100%'
        viewBox='0 0 24 24'
        fill='none'
        stroke='currentColor'
        strokeWidth='1.8'
        strokeLinecap='round'
        strokeLinejoin='round'
        aria-hidden='true'
    >
        {children}
    </svg>
)
