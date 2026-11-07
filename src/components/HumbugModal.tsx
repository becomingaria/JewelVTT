import React, { useState, useRef, useEffect, useCallback } from "react"
import type { HumbugType, Humbug } from "../types/humbug.types"
import { ImageCropper } from "./ImageCropper"
import { TokenLibraryDrawer } from "./TokenLibraryDrawer"
import { Icon } from "./Icon"
import {
    LARGE_FILE_BYTES,
    formatBytes,
    safeHttpUrl,
} from "../utils/documents"
import "./HumbugModal.css"

interface HumbugModalProps {
    isOpen: boolean
    type: HumbugType
    position: { x: number; y: number }
    existingHumbug?: Humbug | null
    onClose: () => void
    onCreate: (humbugData: Record<string, unknown>) => void
}

export const HumbugModal: React.FC<HumbugModalProps> = ({
    isOpen,
    type,
    position,
    existingHumbug,
    onClose,
    onCreate,
}) => {
    // Common state for all humbug types
    const [opacity, setOpacity] = useState(1)
    const [size, setSize] = useState({ width: 150, height: 100 })

    // Text-specific state
    const [content, setContent] = useState("")
    const [fontSize, setFontSize] = useState(16)
    const [fontFamily, setFontFamily] = useState("Arial, sans-serif")
    const [textColor, setTextColor] = useState("#000000")
    const [backgroundColor, setBackgroundColor] = useState("#ffffff")
    const [textAlign, setTextAlign] = useState<"left" | "center" | "right">(
        "left"
    )

    // Color-specific state
    const [solidColor, setSolidColor] = useState("#3498db")

    // Image-specific state
    const [imageUrl, setImageUrl] = useState("")
    const [imageFile, setImageFile] = useState<File | null>(null)

    // Map pin-specific state
    const [pinColor, setPinColor] = useState("#e74c3c")

    // Map-specific state
    const [mapImageUrl, setMapImageUrl] = useState("")
    const [mapImageFile, setMapImageFile] = useState<File | null>(null)
    const [showGrid, setShowGrid] = useState(true)

    // Token-specific state
    const [tokenImageUrl, setTokenImageUrl] = useState("")
    const [tokenImageFile, setTokenImageFile] = useState<File | null>(null)
    const [borderColor, setBorderColor] = useState("#007acc")
    const [borderWidth, setBorderWidth] = useState(2)

    // Document-specific state
    const [docTitle, setDocTitle] = useState("")
    const [docSource, setDocSource] = useState<"link" | "file">("link")
    const [docUrl, setDocUrl] = useState("")
    const [docNote, setDocNote] = useState("")
    const [docFile, setDocFile] = useState<{
        data: string
        name: string
        mime: string
        bytes: number
    } | null>(null)
    const docFileInputRef = useRef<HTMLInputElement>(null)
    const [showTokenLibrary, setShowTokenLibrary] = useState(false)
    const [showMapLibrary, setShowMapLibrary] = useState(false)
    // Width / height of the chosen map image, so new maps keep their shape
    const [mapAspect, setMapAspect] = useState<number | null>(null)

    // Cropping state
    const [showCropper, setShowCropper] = useState(false)
    const [cropImageUrl, setCropImageUrl] = useState("")
    const [cropImageType, setCropImageType] = useState<
        "image" | "map" | "token"
    >("image")

    const fileInputRef = useRef<HTMLInputElement>(null)
    const mapFileInputRef = useRef<HTMLInputElement>(null)
    const tokenFileInputRef = useRef<HTMLInputElement>(null)

    // Populate form with existing humbug data when editing
    useEffect(() => {
        if (existingHumbug) {
            setOpacity(existingHumbug.opacity)

            if (existingHumbug.type === "text") {
                setContent(existingHumbug.content)
                setFontSize(existingHumbug.fontSize)
                setFontFamily(existingHumbug.fontFamily)
                setTextColor(existingHumbug.color)
                setBackgroundColor(existingHumbug.backgroundColor || "#ffffff")
                setTextAlign(existingHumbug.textAlign || "left")
                setSize(existingHumbug.size)
            } else if (existingHumbug.type === "solid-color") {
                setSolidColor(existingHumbug.color)
                setSize(existingHumbug.size)
            } else if (existingHumbug.type === "image") {
                setImageUrl(existingHumbug.imageUrl)
                setSize(existingHumbug.size)
            } else if (existingHumbug.type === "map-pin") {
                setPinColor(existingHumbug.color)
            } else if (existingHumbug.type === "map") {
                setMapImageUrl(existingHumbug.imageUrl)
                setSize(existingHumbug.size)
                setShowGrid(existingHumbug.showGrid)
            } else if (existingHumbug.type === "token") {
                setTokenImageUrl(existingHumbug.imageUrl)
                setSize(existingHumbug.size)
                setBorderColor(existingHumbug.borderColor)
                setBorderWidth(existingHumbug.borderWidth)
            } else if (existingHumbug.type === "document") {
                setDocTitle(existingHumbug.title)
                setDocUrl(existingHumbug.url ?? "")
                setDocNote(existingHumbug.note ?? "")
                setDocSource(existingHumbug.fileData ? "file" : "link")
                setDocFile(
                    existingHumbug.fileData
                        ? {
                              data: existingHumbug.fileData,
                              name: existingHumbug.fileName ?? "file",
                              mime: existingHumbug.mimeType ?? "",
                              bytes: 0,
                          }
                        : null
                )
                setSize(existingHumbug.size)
            }
        } else {
            // Reset to defaults for new humbug
            setOpacity(1)
            setSize({ width: 150, height: 100 })
            setContent("")
            setFontSize(16)
            setFontFamily("Arial, sans-serif")
            setTextColor("#000000")
            setBackgroundColor("#ffffff")
            setSolidColor("#3498db")
            setImageUrl("")
            setImageFile(null)
            setPinColor("#e74c3c")
            setMapImageUrl("")
            setMapImageFile(null)
            setShowGrid(true)
            setTokenImageUrl("")
            setTokenImageFile(null)
            setBorderColor("#007acc")
            setBorderWidth(2)
            setDocTitle("")
            setDocSource("link")
            setDocUrl("")
            setDocNote("")
            setDocFile(null)
        }
        setShowTokenLibrary(false)
        setShowMapLibrary(false)
    }, [existingHumbug, isOpen])

    // Measure the map image so a new map isn't squashed into a square
    useEffect(() => {
        if (!mapImageUrl) {
            setMapAspect(null)
            return
        }
        let cancelled = false
        const img = new Image()
        img.onload = () => {
            if (!cancelled && img.naturalWidth && img.naturalHeight) {
                setMapAspect(img.naturalWidth / img.naturalHeight)
            }
        }
        img.src = mapImageUrl
        return () => {
            cancelled = true
        }
    }, [mapImageUrl])

    const handleImageFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (file) {
            setImageFile(file)
            // Create a blob URL for preview and cropping
            const url = URL.createObjectURL(file)
            setCropImageUrl(url)
            setCropImageType("image")
            setShowCropper(true)
        }
    }

    const handleMapImageFileChange = (
        e: React.ChangeEvent<HTMLInputElement>
    ) => {
        const file = e.target.files?.[0]
        if (file) {
            setMapImageFile(file)
            // Create a blob URL for preview and cropping
            const url = URL.createObjectURL(file)
            setCropImageUrl(url)
            setCropImageType("map")
            setShowCropper(true)
        }
    }

    const handleTokenImageFileChange = (
        e: React.ChangeEvent<HTMLInputElement>
    ) => {
        const file = e.target.files?.[0]
        if (file) {
            setTokenImageFile(file)
            // Create a blob URL for preview and cropping
            const url = URL.createObjectURL(file)
            setCropImageUrl(url)
            setCropImageType("token")
            setShowCropper(true)
        }
    }

    const handleLibraryTokenSelect = (url: string) => {
        // Show plain spaces etc. in the URL field; the browser re-encodes
        // when loading. decodeURI leaves escaped "#"/"?" intact.
        setTokenImageUrl(decodeURI(url))
        setTokenImageFile(null)
        if (tokenFileInputRef.current) tokenFileInputRef.current.value = ""
        setShowTokenLibrary(false)
    }

    const closeTokenLibrary = useCallback(() => setShowTokenLibrary(false), [])

    const handleLibraryMapSelect = (url: string) => {
        setMapImageUrl(decodeURI(url))
        setMapImageFile(null)
        if (mapFileInputRef.current) mapFileInputRef.current.value = ""
        setShowMapLibrary(false)
    }

    const closeMapLibrary = useCallback(() => setShowMapLibrary(false), [])

    const handleImageUrlCrop = () => {
        if (imageUrl) {
            setCropImageUrl(imageUrl)
            setCropImageType("image")
            setShowCropper(true)
        }
    }

    const handleMapUrlCrop = () => {
        if (mapImageUrl) {
            setCropImageUrl(mapImageUrl)
            setCropImageType("map")
            setShowCropper(true)
        }
    }

    const handleTokenUrlCrop = () => {
        if (tokenImageUrl) {
            setCropImageUrl(tokenImageUrl)
            setCropImageType("token")
            setShowCropper(true)
        }
    }

    const handleCropComplete = (croppedImageDataUrl: string) => {
        // Apply the cropped image to the appropriate image type
        switch (cropImageType) {
            case "image":
                setImageUrl(croppedImageDataUrl)
                break
            case "map":
                setMapImageUrl(croppedImageDataUrl)
                break
            case "token":
                setTokenImageUrl(croppedImageDataUrl)
                break
        }
        setShowCropper(false)
        setCropImageUrl("")
    }

    const handleCropCancel = () => {
        setShowCropper(false)
        setCropImageUrl("")
        // Reset file inputs since user cancelled cropping
        switch (cropImageType) {
            case "image":
                setImageFile(null)
                if (fileInputRef.current) fileInputRef.current.value = ""
                break
            case "map":
                setMapImageFile(null)
                if (mapFileInputRef.current) mapFileInputRef.current.value = ""
                break
            case "token":
                setTokenImageFile(null)
                if (tokenFileInputRef.current)
                    tokenFileInputRef.current.value = ""
                break
        }
    }

    const handleCreate = () => {
        const baseData = {
            position,
            size,
            opacity,
            type,
        }

        let specificData = {}

        switch (type) {
            case "text":
                specificData = {
                    content,
                    fontSize,
                    fontFamily,
                    color: textColor,
                    backgroundColor,
                    textAlign,
                }
                break
            case "solid-color":
                specificData = {
                    color: solidColor,
                }
                break
            case "image":
                specificData = {
                    imageUrl,
                    imageFile,
                }
                break
            case "map-pin":
                specificData = {
                    color: pinColor,
                    size: { width: 32, height: 40 }, // Standard pin size
                }
                break
            case "map":
                specificData = {
                    imageUrl: mapImageUrl,
                    imageFile: mapImageFile,
                    showGrid,
                    // New maps: 1000 wide, keeping the image's proportions.
                    // Edits keep whatever size the map has been resized to.
                    size: existingHumbug
                        ? size
                        : {
                              width: 1000,
                              height: Math.round(1000 / (mapAspect ?? 1)),
                          },
                }
                break
            case "token":
                specificData = {
                    imageUrl: tokenImageUrl,
                    imageFile: tokenImageFile,
                    borderColor,
                    borderWidth,
                    // New tokens fill one grid square; edits keep their size
                    size: existingHumbug ? size : { width: 32, height: 32 },
                }
                break
            case "document": {
                const link = safeHttpUrl(docUrl)
                const useFile = docSource === "file" && docFile
                const fallbackTitle = useFile
                    ? docFile.name.replace(/\.[^.]+$/, "")
                    : link?.hostname.replace(/^www\./, "") ?? "Document"
                specificData = {
                    title: docTitle.trim() || fallbackTitle,
                    note: docNote.trim() || undefined,
                    url: useFile ? undefined : link?.href,
                    fileData: useFile ? docFile.data : undefined,
                    fileName: useFile ? docFile.name : undefined,
                    mimeType: useFile ? docFile.mime : undefined,
                    size: existingHumbug ? size : { width: 240, height: 96 },
                }
                break
            }
        }

        onCreate({ ...baseData, ...specificData })
        onClose()
    }

    const renderTypeSpecificControls = () => {
        switch (type) {
            case "text":
                return (
                    <div className='humbug-modal-section'>
                        <h4>Text Content</h4>
                        <div className='form-group'>
                            <label>Text:</label>
                            <textarea
                                value={content}
                                onChange={(e) => setContent(e.target.value)}
                                placeholder='Enter your text here...'
                                rows={4}
                                className='text-input'
                            />
                        </div>
                        <div className='form-row'>
                            <div className='form-group'>
                                <label>Font Size:</label>
                                <input
                                    type='number'
                                    value={fontSize}
                                    onChange={(e) =>
                                        setFontSize(Number(e.target.value))
                                    }
                                    min={8}
                                    max={72}
                                />
                            </div>
                            <div className='form-group'>
                                <label>Font Family:</label>
                                <select
                                    value={fontFamily}
                                    onChange={(e) =>
                                        setFontFamily(e.target.value)
                                    }
                                >
                                    <option value='Arial, sans-serif'>
                                        Arial
                                    </option>
                                    <option value='Helvetica, sans-serif'>
                                        Helvetica
                                    </option>
                                    <option value='Georgia, serif'>
                                        Georgia
                                    </option>
                                    <option value='Times New Roman, serif'>
                                        Times New Roman
                                    </option>
                                    <option value='Courier New, monospace'>
                                        Courier New
                                    </option>
                                </select>
                            </div>
                        </div>
                        <div className='form-row'>
                            <div className='form-group'>
                                <label>Text Color:</label>
                                <input
                                    type='color'
                                    value={textColor}
                                    onChange={(e) =>
                                        setTextColor(e.target.value)
                                    }
                                />
                            </div>
                            <div className='form-group'>
                                <label>Background:</label>
                                <input
                                    type='color'
                                    value={backgroundColor}
                                    onChange={(e) =>
                                        setBackgroundColor(e.target.value)
                                    }
                                />
                            </div>
                        </div>
                        <div className='form-group'>
                            <label>Text Alignment:</label>
                            <select
                                value={textAlign}
                                onChange={(e) =>
                                    setTextAlign(
                                        e.target.value as
                                            | "left"
                                            | "center"
                                            | "right"
                                    )
                                }
                            >
                                <option value='left'>Left</option>
                                <option value='center'>Center</option>
                                <option value='right'>Right</option>
                            </select>
                        </div>
                    </div>
                )

            case "solid-color":
                return (
                    <div className='humbug-modal-section'>
                        <h4>Color Settings</h4>
                        <div className='form-group'>
                            <label>Color:</label>
                            <div className='color-picker-group'>
                                <input
                                    type='color'
                                    value={solidColor}
                                    onChange={(e) =>
                                        setSolidColor(e.target.value)
                                    }
                                />
                                <span className='color-value'>
                                    {solidColor}
                                </span>
                            </div>
                        </div>
                    </div>
                )

            case "image":
                return (
                    <div className='humbug-modal-section'>
                        <h4>Image Source</h4>
                        <div className='form-group'>
                            <label>Upload File:</label>
                            <input
                                ref={fileInputRef}
                                type='file'
                                accept='image/*'
                                onChange={handleImageFileChange}
                                className='file-input'
                            />
                            <button
                                type='button'
                                onClick={() => fileInputRef.current?.click()}
                                className='file-button'
                            >
                                Choose File
                            </button>
                        </div>
                        <div className='form-separator'>OR</div>
                        <div className='form-group'>
                            <label>Image URL:</label>
                            <div className='url-input-container'>
                                <input
                                    type='url'
                                    value={imageUrl}
                                    onChange={(e) =>
                                        setImageUrl(e.target.value)
                                    }
                                    placeholder='https://example.com/image.jpg'
                                    className='url-input'
                                />
                                {imageUrl && (
                                    <button
                                        type='button'
                                        onClick={handleImageUrlCrop}
                                        className='crop-button'
                                    >
                                        Crop
                                    </button>
                                )}
                            </div>
                        </div>
                        {imageUrl && (
                            <div className='image-preview'>
                                <img src={imageUrl} alt='Preview' />
                            </div>
                        )}
                    </div>
                )

            case "map-pin":
                return (
                    <div className='humbug-modal-section'>
                        <h4>Pin Settings</h4>
                        <div className='form-group'>
                            <label>Pin Color:</label>
                            <div className='color-picker-group'>
                                <input
                                    type='color'
                                    value={pinColor}
                                    onChange={(e) =>
                                        setPinColor(e.target.value)
                                    }
                                />
                                <span className='color-value'>{pinColor}</span>
                            </div>
                        </div>
                    </div>
                )

            case "map":
                return (
                    <div className='humbug-modal-section'>
                        <h4>Map Settings</h4>
                        <div className='form-group'>
                            <label>Upload Map Image:</label>
                            <input
                                ref={mapFileInputRef}
                                type='file'
                                accept='image/*'
                                onChange={handleMapImageFileChange}
                                className='file-input'
                            />
                            <div className='file-button-row'>
                                <button
                                    type='button'
                                    onClick={() =>
                                        mapFileInputRef.current?.click()
                                    }
                                    className='file-button'
                                >
                                    Choose File
                                </button>
                                <button
                                    type='button'
                                    onClick={() => setShowMapLibrary(true)}
                                    className='file-button file-button-icon'
                                >
                                    <Icon name='map' size={18} />
                                    Select from Library
                                </button>
                            </div>
                        </div>

                        <div className='form-separator'>or</div>

                        <div className='form-group'>
                            <label>Image URL:</label>
                            <div className='url-input-container'>
                                <input
                                    type='url'
                                    value={mapImageUrl}
                                    onChange={(e) =>
                                        setMapImageUrl(e.target.value)
                                    }
                                    placeholder='https://example.com/map.jpg'
                                    className='url-input'
                                />
                                {mapImageUrl && (
                                    <button
                                        type='button'
                                        onClick={handleMapUrlCrop}
                                        className='crop-button'
                                    >
                                        Crop
                                    </button>
                                )}
                            </div>
                        </div>

                        {mapImageUrl && (
                            <div className='image-preview'>
                                <img src={mapImageUrl} alt='Map preview' />
                            </div>
                        )}

                        <div className='form-group'>
                            <label>
                                <input
                                    type='checkbox'
                                    checked={showGrid}
                                    onChange={(e) =>
                                        setShowGrid(e.target.checked)
                                    }
                                />
                                Show Grid Overlay
                            </label>
                        </div>
                    </div>
                )

            case "token":
                return (
                    <div className='humbug-modal-section'>
                        <h4>Token Settings</h4>
                        <div className='form-group'>
                            <label>Upload Token Image:</label>
                            <input
                                ref={tokenFileInputRef}
                                type='file'
                                accept='image/*'
                                onChange={handleTokenImageFileChange}
                                className='file-input'
                            />
                            <div className='file-button-row'>
                                <button
                                    type='button'
                                    onClick={() =>
                                        tokenFileInputRef.current?.click()
                                    }
                                    className='file-button'
                                >
                                    Choose File
                                </button>
                                <button
                                    type='button'
                                    onClick={() => setShowTokenLibrary(true)}
                                    className='file-button file-button-icon'
                                >
                                    <Icon name='library' size={18} />
                                    Select from Library
                                </button>
                            </div>
                        </div>

                        <div className='form-separator'>or</div>

                        <div className='form-group'>
                            <label>Image URL:</label>
                            <div className='url-input-container'>
                                <input
                                    type='url'
                                    value={tokenImageUrl}
                                    onChange={(e) =>
                                        setTokenImageUrl(e.target.value)
                                    }
                                    placeholder='https://example.com/token.jpg'
                                    className='url-input'
                                />
                                {tokenImageUrl && (
                                    <button
                                        type='button'
                                        onClick={handleTokenUrlCrop}
                                        className='crop-button'
                                    >
                                        Crop
                                    </button>
                                )}
                            </div>
                        </div>

                        {tokenImageUrl && (
                            <div className='image-preview'>
                                <img src={tokenImageUrl} alt='Token preview' />
                            </div>
                        )}

                        <div className='form-row'>
                            <div className='form-group'>
                                <label>Border Color:</label>
                                <div className='color-picker-group'>
                                    <input
                                        type='color'
                                        value={borderColor}
                                        onChange={(e) =>
                                            setBorderColor(e.target.value)
                                        }
                                    />
                                    <span className='color-value'>
                                        {borderColor}
                                    </span>
                                </div>
                            </div>
                            <div className='form-group'>
                                <label>Border Width:</label>
                                <input
                                    type='number'
                                    value={borderWidth}
                                    onChange={(e) =>
                                        setBorderWidth(Number(e.target.value))
                                    }
                                    min='1'
                                    max='20'
                                />
                            </div>
                        </div>
                    </div>
                )

            case "document": {
                const urlInvalid = docUrl.trim() !== "" && !safeHttpUrl(docUrl)
                return (
                    <div className='humbug-modal-section'>
                        <h4>Document or Link</h4>
                        <div className='form-group'>
                            <label>Title:</label>
                            <input
                                type='text'
                                className='text-input'
                                value={docTitle}
                                onChange={(e) => setDocTitle(e.target.value)}
                                placeholder='Session notes, Lore wiki, Rules PDF…'
                            />
                        </div>

                        <div className='doc-source-toggle' role='tablist'>
                            <button
                                type='button'
                                role='tab'
                                aria-selected={docSource === "link"}
                                className={docSource === "link" ? "active" : ""}
                                onClick={() => setDocSource("link")}
                            >
                                <Icon name='link' size={18} /> Link
                            </button>
                            <button
                                type='button'
                                role='tab'
                                aria-selected={docSource === "file"}
                                className={docSource === "file" ? "active" : ""}
                                onClick={() => setDocSource("file")}
                            >
                                <Icon name='document' size={18} /> File
                            </button>
                        </div>

                        {docSource === "link" ? (
                            <div className='form-group'>
                                <label>Page URL:</label>
                                <input
                                    type='url'
                                    className='url-input'
                                    value={docUrl}
                                    onChange={(e) => setDocUrl(e.target.value)}
                                    placeholder='https://www.notion.so/…'
                                />
                                {urlInvalid && (
                                    <div className='form-hint form-hint-error'>
                                        Use a full web address starting with
                                        https://
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div className='form-group'>
                                <label>File:</label>
                                <input
                                    ref={docFileInputRef}
                                    type='file'
                                    className='file-input'
                                    onChange={(e) => {
                                        const file = e.target.files?.[0]
                                        if (!file) return
                                        const reader = new FileReader()
                                        reader.onload = () =>
                                            setDocFile({
                                                data: reader.result as string,
                                                name: file.name,
                                                mime: file.type,
                                                bytes: file.size,
                                            })
                                        reader.readAsDataURL(file)
                                    }}
                                />
                                <div className='file-button-row'>
                                    <button
                                        type='button'
                                        className='file-button'
                                        onClick={() =>
                                            docFileInputRef.current?.click()
                                        }
                                    >
                                        {docFile ? "Replace File" : "Choose File"}
                                    </button>
                                    {docFile && (
                                        <span className='form-hint'>
                                            {docFile.name}
                                            {docFile.bytes > 0 &&
                                                ` · ${formatBytes(docFile.bytes)}`}
                                        </span>
                                    )}
                                </div>
                                {docFile && docFile.bytes > LARGE_FILE_BYTES && (
                                    <div className='form-hint form-hint-error'>
                                        Large file: it will be stored inside the
                                        board, making saves slower and bigger.
                                    </div>
                                )}
                            </div>
                        )}

                        <div className='form-group'>
                            <label>Note (optional):</label>
                            <textarea
                                className='text-input'
                                rows={2}
                                value={docNote}
                                onChange={(e) => setDocNote(e.target.value)}
                                placeholder='What is this for?'
                            />
                        </div>
                    </div>
                )
            }

            default:
                return null
        }
    }

    if (!isOpen) return null

    return (
        <>
            <div className='humbug-modal-backdrop' onClick={onClose}>
                <div
                    className='humbug-modal'
                    onClick={(e) => e.stopPropagation()}
                >
                    <div className='humbug-modal-header'>
                        <h3>
                            {existingHumbug ? "Edit" : "Create"}{" "}
                            {type
                                .replace("-", " ")
                                .replace(/\b\w/g, (l) => l.toUpperCase())}{" "}
                            Humbug
                        </h3>
                        <button className='close-button' onClick={onClose}>
                            <Icon name='close' size={20} />
                        </button>
                    </div>

                    <div className='humbug-modal-body'>
                        {/* Type-specific controls */}
                        {renderTypeSpecificControls()}

                        {/* Common controls */}
                        <div className='humbug-modal-section'>
                            <h4>General Settings</h4>

                            {type !== "map-pin" && (
                                <div className='form-row'>
                                    <div className='form-group'>
                                        <label>Width:</label>
                                        <input
                                            type='number'
                                            value={size.width}
                                            onChange={(e) =>
                                                setSize((prev) => ({
                                                    ...prev,
                                                    width: Number(
                                                        e.target.value
                                                    ),
                                                }))
                                            }
                                            min={10}
                                            max={500}
                                        />
                                    </div>
                                    <div className='form-group'>
                                        <label>Height:</label>
                                        <input
                                            type='number'
                                            value={size.height}
                                            onChange={(e) =>
                                                setSize((prev) => ({
                                                    ...prev,
                                                    height: Number(
                                                        e.target.value
                                                    ),
                                                }))
                                            }
                                            min={10}
                                            max={500}
                                        />
                                    </div>
                                </div>
                            )}

                            <div className='form-group'>
                                <label>
                                    Opacity: {Math.round(opacity * 100)}%
                                </label>
                                <input
                                    type='range'
                                    min='0.1'
                                    max='1'
                                    step='0.1'
                                    value={opacity}
                                    onChange={(e) =>
                                        setOpacity(Number(e.target.value))
                                    }
                                    className='opacity-slider'
                                />
                            </div>
                        </div>
                    </div>

                    <div className='humbug-modal-footer'>
                        <button className='cancel-button' onClick={onClose}>
                            Cancel
                        </button>
                        <button
                            className='create-button'
                            onClick={handleCreate}
                            disabled={
                                (type === "image" && !imageUrl && !imageFile) ||
                                (type === "document" &&
                                    (docSource === "link"
                                        ? !safeHttpUrl(docUrl)
                                        : !docFile))
                            }
                        >
                            {existingHumbug ? "Update" : "Create"} Humbug
                        </button>
                    </div>
                </div>
            </div>

            {type === "token" && (
                <TokenLibraryDrawer
                    isOpen={showTokenLibrary}
                    onClose={closeTokenLibrary}
                    onSelect={handleLibraryTokenSelect}
                />
            )}

            {type === "map" && (
                <TokenLibraryDrawer
                    kind='maps'
                    isOpen={showMapLibrary}
                    onClose={closeMapLibrary}
                    onSelect={handleLibraryMapSelect}
                />
            )}

            {showCropper && cropImageUrl && (
                <ImageCropper
                    imageUrl={cropImageUrl}
                    onCrop={handleCropComplete}
                    onCancel={handleCropCancel}
                />
            )}
        </>
    )
}
