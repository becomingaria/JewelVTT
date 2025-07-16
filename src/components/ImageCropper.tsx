import React, { useRef, useEffect, useState, useCallback } from "react"
import { createPortal } from "react-dom"
import "./ImageCropper.css"

interface CropArea {
    x: number
    y: number
    width: number
    height: number
}

interface ImageCropperProps {
    imageUrl: string
    onCrop: (croppedImageDataUrl: string) => void
    onCancel: () => void
    aspectRatio?: number | null // null for free aspect ratio
}

export const ImageCropper: React.FC<ImageCropperProps> = ({
    imageUrl,
    onCrop,
    onCancel,
}) => {
    const canvasRef = useRef<HTMLCanvasElement>(null)
    const imageRef = useRef<HTMLImageElement>(null)
    const [isDragging, setIsDragging] = useState(false)
    const [isResizing, setIsResizing] = useState(false)
    const [resizeCorner, setResizeCorner] = useState<string | null>(null)
    const [dragStart, setDragStart] = useState({ x: 0, y: 0 })
    const [cropArea, setCropArea] = useState<CropArea>({
        x: 50,
        y: 50,
        width: 200,
        height: 150,
    })
    const [imageLoaded, setImageLoaded] = useState(false)
    const [imageNaturalSize, setImageNaturalSize] = useState({
        width: 0,
        height: 0,
    })
    const [displaySize, setDisplaySize] = useState({ width: 0, height: 0 })

    const drawCanvas = useCallback(() => {
        const canvas = canvasRef.current
        const image = imageRef.current
        if (!canvas || !image || !imageLoaded) return

        const ctx = canvas.getContext("2d")
        if (!ctx) return

        // Clear canvas
        ctx.clearRect(0, 0, canvas.width, canvas.height)

        // Draw the image
        ctx.drawImage(image, 0, 0, displaySize.width, displaySize.height)

        // Draw crop overlay (darken everything except crop area)
        ctx.fillStyle = "rgba(0, 0, 0, 0.4)"
        ctx.fillRect(0, 0, canvas.width, canvas.height)

        // Clear the crop area (make it visible)
        ctx.clearRect(cropArea.x, cropArea.y, cropArea.width, cropArea.height)
        ctx.drawImage(
            image,
            (cropArea.x / displaySize.width) * imageNaturalSize.width,
            (cropArea.y / displaySize.height) * imageNaturalSize.height,
            (cropArea.width / displaySize.width) * imageNaturalSize.width,
            (cropArea.height / displaySize.height) * imageNaturalSize.height,
            cropArea.x,
            cropArea.y,
            cropArea.width,
            cropArea.height
        )

        // Draw crop area border with black outline for visibility
        // First draw black outline (thicker)
        ctx.strokeStyle = "#000"
        ctx.lineWidth = 3
        ctx.strokeRect(cropArea.x, cropArea.y, cropArea.width, cropArea.height)

        // Then draw white inner border (thinner)
        ctx.strokeStyle = "#fff"
        ctx.lineWidth = 1
        ctx.strokeRect(cropArea.x, cropArea.y, cropArea.width, cropArea.height)

        // Draw corner handles with black outline
        const handleSize = 8

        // Black outline for handles
        ctx.fillStyle = "#000"
        const outlineSize = handleSize + 2
        ctx.fillRect(
            cropArea.x - outlineSize / 2,
            cropArea.y - outlineSize / 2,
            outlineSize,
            outlineSize
        )
        ctx.fillRect(
            cropArea.x + cropArea.width - outlineSize / 2,
            cropArea.y - outlineSize / 2,
            outlineSize,
            outlineSize
        )
        ctx.fillRect(
            cropArea.x - outlineSize / 2,
            cropArea.y + cropArea.height - outlineSize / 2,
            outlineSize,
            outlineSize
        )
        ctx.fillRect(
            cropArea.x + cropArea.width - outlineSize / 2,
            cropArea.y + cropArea.height - outlineSize / 2,
            outlineSize,
            outlineSize
        )

        // White inner handles
        ctx.fillStyle = "#fff"
        ctx.fillRect(
            cropArea.x - handleSize / 2,
            cropArea.y - handleSize / 2,
            handleSize,
            handleSize
        )
        ctx.fillRect(
            cropArea.x + cropArea.width - handleSize / 2,
            cropArea.y - handleSize / 2,
            handleSize,
            handleSize
        )
        ctx.fillRect(
            cropArea.x - handleSize / 2,
            cropArea.y + cropArea.height - handleSize / 2,
            handleSize,
            handleSize
        )
        ctx.fillRect(
            cropArea.x + cropArea.width - handleSize / 2,
            cropArea.y + cropArea.height - handleSize / 2,
            handleSize,
            handleSize
        )
    }, [cropArea, imageLoaded, displaySize, imageNaturalSize])

    useEffect(() => {
        drawCanvas()
    }, [drawCanvas])

    const handleImageLoad = () => {
        const image = imageRef.current
        const canvas = canvasRef.current
        if (!image || !canvas) return

        setImageNaturalSize({
            width: image.naturalWidth,
            height: image.naturalHeight,
        })

        // Calculate display size to fit in container while maintaining aspect ratio
        const maxWidth = 600
        const maxHeight = 400
        const imageAspect = image.naturalWidth / image.naturalHeight

        let displayWidth = maxWidth
        let displayHeight = maxWidth / imageAspect

        if (displayHeight > maxHeight) {
            displayHeight = maxHeight
            displayWidth = maxHeight * imageAspect
        }

        setDisplaySize({ width: displayWidth, height: displayHeight })
        canvas.width = displayWidth
        canvas.height = displayHeight

        // Set initial crop area to entire image
        setCropArea({
            x: 0,
            y: 0,
            width: displayWidth,
            height: displayHeight,
        })

        setImageLoaded(true)
    }

    const handleMouseDown = (e: React.MouseEvent) => {
        e.preventDefault()
        e.stopPropagation()

        const canvas = canvasRef.current
        if (!canvas) return

        const rect = canvas.getBoundingClientRect()
        const x = e.clientX - rect.left
        const y = e.clientY - rect.top

        // Check if clicking on a corner handle
        const corner = getCornerAtPosition(x, y)
        if (corner) {
            setIsResizing(true)
            setResizeCorner(corner)
        } else {
            setIsDragging(true)
        }

        setDragStart({ x, y })
    }

    const handleMouseMove = (e: React.MouseEvent) => {
        const canvas = canvasRef.current
        if (!canvas) return

        const rect = canvas.getBoundingClientRect()
        const x = e.clientX - rect.left
        const y = e.clientY - rect.top

        // Update cursor based on position
        const cursor = getCursorForPosition(x, y)
        canvas.style.cursor = cursor

        if (!isDragging && !isResizing) return

        e.preventDefault()
        e.stopPropagation()

        const deltaX = x - dragStart.x
        const deltaY = y - dragStart.y

        if (isResizing && resizeCorner) {
            setCropArea((prev) => {
                const newArea = { ...prev }

                switch (resizeCorner) {
                    case "top-left":
                        newArea.x = Math.max(0, prev.x + deltaX)
                        newArea.y = Math.max(0, prev.y + deltaY)
                        newArea.width = Math.max(20, prev.width - deltaX)
                        newArea.height = Math.max(20, prev.height - deltaY)
                        break
                    case "top-right":
                        newArea.y = Math.max(0, prev.y + deltaY)
                        newArea.width = Math.max(
                            20,
                            Math.min(
                                displaySize.width - prev.x,
                                prev.width + deltaX
                            )
                        )
                        newArea.height = Math.max(20, prev.height - deltaY)
                        break
                    case "bottom-left":
                        newArea.x = Math.max(0, prev.x + deltaX)
                        newArea.width = Math.max(20, prev.width - deltaX)
                        newArea.height = Math.max(
                            20,
                            Math.min(
                                displaySize.height - prev.y,
                                prev.height + deltaY
                            )
                        )
                        break
                    case "bottom-right":
                        newArea.width = Math.max(
                            20,
                            Math.min(
                                displaySize.width - prev.x,
                                prev.width + deltaX
                            )
                        )
                        newArea.height = Math.max(
                            20,
                            Math.min(
                                displaySize.height - prev.y,
                                prev.height + deltaY
                            )
                        )
                        break
                }

                // Ensure the crop area stays within bounds
                if (newArea.x + newArea.width > displaySize.width) {
                    newArea.width = displaySize.width - newArea.x
                }
                if (newArea.y + newArea.height > displaySize.height) {
                    newArea.height = displaySize.height - newArea.y
                }

                return newArea
            })
        } else if (isDragging) {
            setCropArea((prev) => {
                const newX = Math.max(
                    0,
                    Math.min(prev.x + deltaX, displaySize.width - prev.width)
                )
                const newY = Math.max(
                    0,
                    Math.min(prev.y + deltaY, displaySize.height - prev.height)
                )

                return {
                    ...prev,
                    x: newX,
                    y: newY,
                }
            })
        }

        setDragStart({ x, y })
    }

    const handleMouseUp = (e: React.MouseEvent) => {
        e.preventDefault()
        e.stopPropagation()
        setIsDragging(false)
        setIsResizing(false)
        setResizeCorner(null)
    }

    const handleCrop = () => {
        const image = imageRef.current
        if (!image || !imageLoaded) return

        // Create a new canvas for the cropped image
        const cropCanvas = document.createElement("canvas")
        const cropCtx = cropCanvas.getContext("2d")
        if (!cropCtx) return

        // Calculate the crop area in terms of the original image
        const scaleX = imageNaturalSize.width / displaySize.width
        const scaleY = imageNaturalSize.height / displaySize.height

        const sourceX = cropArea.x * scaleX
        const sourceY = cropArea.y * scaleY
        const sourceWidth = cropArea.width * scaleX
        const sourceHeight = cropArea.height * scaleY

        cropCanvas.width = sourceWidth
        cropCanvas.height = sourceHeight

        // Draw the cropped portion
        cropCtx.drawImage(
            image,
            sourceX,
            sourceY,
            sourceWidth,
            sourceHeight,
            0,
            0,
            sourceWidth,
            sourceHeight
        )

        // Convert to data URL and call onCrop
        const croppedImageDataUrl = cropCanvas.toDataURL("image/png")
        onCrop(croppedImageDataUrl)
    }

    const handleOverlayClick = (e: React.MouseEvent) => {
        // Only close if clicking the overlay itself, not the modal content
        if (e.target === e.currentTarget) {
            onCancel()
        }
    }

    const getCornerAtPosition = (x: number, y: number): string | null => {
        const handleSize = 8
        const tolerance = handleSize / 2

        // Check each corner
        const corners = [
            { name: "top-left", x: cropArea.x, y: cropArea.y },
            {
                name: "top-right",
                x: cropArea.x + cropArea.width,
                y: cropArea.y,
            },
            {
                name: "bottom-left",
                x: cropArea.x,
                y: cropArea.y + cropArea.height,
            },
            {
                name: "bottom-right",
                x: cropArea.x + cropArea.width,
                y: cropArea.y + cropArea.height,
            },
        ]

        for (const corner of corners) {
            if (
                Math.abs(x - corner.x) <= tolerance &&
                Math.abs(y - corner.y) <= tolerance
            ) {
                return corner.name
            }
        }

        return null
    }

    const getCursorForPosition = (x: number, y: number): string => {
        const corner = getCornerAtPosition(x, y)
        if (corner) {
            switch (corner) {
                case "top-left":
                case "bottom-right":
                    return "nw-resize"
                case "top-right":
                case "bottom-left":
                    return "ne-resize"
                default:
                    return "pointer"
            }
        }

        // Check if inside crop area for moving
        if (
            x >= cropArea.x &&
            x <= cropArea.x + cropArea.width &&
            y >= cropArea.y &&
            y <= cropArea.y + cropArea.height
        ) {
            return "move"
        }

        return "default"
    }

    const modalContent = (
        <div className='image-cropper-overlay' onClick={handleOverlayClick}>
            <div
                className='image-cropper-modal'
                onClick={(e) => e.stopPropagation()}
            >
                <div className='image-cropper-header'>
                    <h3>Crop Image</h3>
                    <button onClick={onCancel} className='close-button'>
                        ×
                    </button>
                </div>

                <div className='image-cropper-content'>
                    <div className='canvas-container'>
                        <img
                            ref={imageRef}
                            src={imageUrl}
                            onLoad={handleImageLoad}
                            style={{ display: "none" }}
                            alt='Source'
                        />
                        <canvas
                            ref={canvasRef}
                            onMouseDown={handleMouseDown}
                            onMouseMove={handleMouseMove}
                            onMouseUp={handleMouseUp}
                            onMouseLeave={handleMouseUp}
                        />
                    </div>

                    <div className='crop-info'>
                        <p>Click and drag the crop area to reposition it</p>
                        <p>
                            Crop selection: {Math.round(cropArea.width)} ×{" "}
                            {Math.round(cropArea.height)} pixels
                        </p>
                    </div>
                </div>

                <div className='image-cropper-actions'>
                    <button onClick={onCancel} className='cancel-button'>
                        Cancel
                    </button>
                    <button onClick={handleCrop} className='crop-button'>
                        Crop Image
                    </button>
                </div>
            </div>
        </div>
    )

    // Render the modal in a portal to escape the current DOM hierarchy
    return createPortal(modalContent, document.body)
}
