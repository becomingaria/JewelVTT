import React from "react"
import type { DocumentHumbug } from "../types/humbug.types"
import { Icon } from "./Icon"
import { describeDocument, openDocument } from "../utils/documents"
import "./DocumentCard.css"

interface DocumentCardProps {
    humbug: DocumentHumbug
    scale: number
}

/**
 * Card for a linked page or attached file. Laid out at its natural size and
 * scaled with the board zoom so the text stays proportional.
 */
export const DocumentCard: React.FC<DocumentCardProps> = ({ humbug, scale }) => {
    const { width, height } = humbug.size
    const info = describeDocument(humbug)

    return (
        <div
            className='humbug-document-content'
            style={{ width: width * scale, height: height * scale }}
        >
            <div
                className={`document-card document-card-${info.kind}`}
                style={{
                    width,
                    height,
                    transform: `scale(${scale})`,
                }}
            >
                <div className='document-card-icon'>
                    <Icon name={info.kind === "link" ? "link" : "document"} size={26} />
                    {info.badge && (
                        <span className='document-card-badge'>{info.badge}</span>
                    )}
                </div>
                <div className='document-card-text'>
                    <div className='document-card-title' title={humbug.title}>
                        {humbug.title || "Untitled"}
                    </div>
                    <div className='document-card-subtitle'>{info.subtitle}</div>
                    {humbug.note && (
                        <div className='document-card-note'>{humbug.note}</div>
                    )}
                </div>
                {info.canOpen && (
                    <button
                        type='button'
                        className='document-card-open'
                        title={info.kind === "link" ? "Open link in a new tab" : "Open file"}
                        // Don't start a drag from the button
                        onMouseDown={(e) => e.stopPropagation()}
                        onDoubleClick={(e) => e.stopPropagation()}
                        onClick={(e) => {
                            e.stopPropagation()
                            openDocument(humbug)
                        }}
                    >
                        Open ↗
                    </button>
                )}
            </div>
        </div>
    )
}
