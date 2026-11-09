import React, { useEffect, useMemo, useRef, useState } from "react"
import { createPortal } from "react-dom"
import type {
    TokenLibraryFolder,
    TokenLibraryToken,
} from "../types/token-library.types"
import { Icon } from "./Icon"
import {
    ASSET_SUBFOLDERS,
    isLocalFolderSupported,
    openAssetFolder,
    scanImages,
    type FolderImageTree,
} from "../utils/local-folder"
import "./TokenLibraryDrawer.css"

export type LibraryKind = "tokens" | "maps"

interface LibraryInfo {
    title: string
    manifest: string
    folder: string
    noun: string
}

const LIBRARY_INFO: Record<LibraryKind, LibraryInfo> = {
    tokens: {
        title: "Token Library",
        manifest: "token-library.json",
        folder: "public/Token_Library",
        noun: "tokens",
    },
    maps: {
        title: "Maps Library",
        manifest: "maps-library.json",
        folder: "public/Maps_Library",
        noun: "maps",
    },
}

interface TokenLibraryDrawerProps {
    isOpen: boolean
    onClose: () => void
    onSelect: (imageUrl: string, name: string) => void
    /** Which library to browse (default: tokens) */
    kind?: LibraryKind
}

interface SearchResult extends TokenLibraryToken {
    folderLabel: string
}

const MAX_SEARCH_RESULTS = 150

const resolveUrl = (url: string) =>
    /^(blob|data):/.test(url) ? url : `${import.meta.env.BASE_URL}${url}`

/** Turn a scanned local folder into the drawer's folder-tree shape */
function folderToLibrary(
    tree: FolderImageTree,
    files: Map<string, File>
): TokenLibraryFolder {
    const tokens = tree.images.map((img) => {
        const url = URL.createObjectURL(img.file)
        files.set(url, img.file)
        return { name: img.name, url }
    })
    const folders = tree.folders.map((f) => folderToLibrary(f, files))
    return {
        name: tree.name,
        path: tree.path,
        folders,
        tokens,
        totalTokens: tokens.length + folders.reduce((n, f) => n + f.totalTokens, 0),
    }
}

const readAsDataUrl = (file: File) =>
    new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve(reader.result as string)
        reader.onerror = () => reject(reader.error)
        reader.readAsDataURL(file)
    })

type FolderState =
    | { status: "idle" | "loading" }
    | { status: "ready"; rootName: string }
    | { status: "unsupported" | "no-folder" | "denied" | "error"; message?: string }

// Cached across drawer openings so the library is only fetched once per session
const manifestPromises = new Map<string, Promise<TokenLibraryFolder>>()

const loadManifest = (manifest: string) => {
    let manifestPromise = manifestPromises.get(manifest)
    if (!manifestPromise) {
        manifestPromise = fetch(`${import.meta.env.BASE_URL}${manifest}`)
            .then((res) => {
                if (!res.ok) throw new Error(`HTTP ${res.status}`)
                return res.json() as Promise<TokenLibraryFolder>
            })
            .catch((error) => {
                manifestPromises.delete(manifest) // allow retry
                throw error
            })
        manifestPromises.set(manifest, manifestPromise)
    }
    return manifestPromise
}

const findFolder = (
    root: TokenLibraryFolder,
    path: string[]
): TokenLibraryFolder => {
    let folder = root
    for (const segment of path) {
        const next = folder.folders.find((f) => f.name === segment)
        if (!next) break
        folder = next
    }
    return folder
}

const firstToken = (
    folder: TokenLibraryFolder
): TokenLibraryToken | undefined => {
    if (folder.tokens.length > 0) return folder.tokens[0]
    for (const sub of folder.folders) {
        const token = firstToken(sub)
        if (token) return token
    }
    return undefined
}

const flattenTokens = (folder: TokenLibraryFolder): SearchResult[] => {
    const label = folder.path.join(" / ")
    return [
        ...folder.tokens.map((token) => ({ ...token, folderLabel: label })),
        ...folder.folders.flatMap(flattenTokens),
    ]
}

export const TokenLibraryDrawer: React.FC<TokenLibraryDrawerProps> = ({
    isOpen,
    onClose,
    onSelect,
    kind = "tokens",
}) => {
    const info = LIBRARY_INFO[kind]
    const [library, setLibrary] = useState<TokenLibraryFolder | null>(null)
    const [error, setError] = useState<string | null>(null)
    const [reloadKey, setReloadKey] = useState(0)
    const [currentPath, setCurrentPath] = useState<string[]>([])
    const [search, setSearch] = useState("")
    const searchInputRef = useRef<HTMLInputElement>(null)
    const contentRef = useRef<HTMLDivElement>(null)

    // "My Folder": images the user dropped into <local folder>/Tokens or /Maps
    const [source, setSource] = useState<"library" | "folder">("library")
    const [folderLib, setFolderLib] = useState<TokenLibraryFolder | null>(null)
    const [folderState, setFolderState] = useState<FolderState>({ status: "idle" })
    const folderFiles = useRef(new Map<string, File>())
    const subfolder = ASSET_SUBFOLDERS[kind]

    const releaseFolderUrls = () => {
        folderFiles.current.forEach((_, url) => URL.revokeObjectURL(url))
        folderFiles.current = new Map()
    }
    useEffect(() => releaseFolderUrls, [])

    /** Scan the subfolder (asks for permission if needed, so call on a click) */
    const loadFolder = async () => {
        setFolderState({ status: "loading" })
        try {
            const res = await openAssetFolder(kind)
            if (!res.ok) {
                setFolderState({ status: res.reason })
                return
            }
            releaseFolderUrls()
            const files = new Map<string, File>()
            const lib = folderToLibrary(await scanImages(res.dir, []), files)
            folderFiles.current = files
            setFolderLib(lib)
            setFolderState({ status: "ready", rootName: res.root.name })
        } catch (e) {
            setFolderState({ status: "error", message: (e as Error).message })
        }
    }

    const switchSource = (next: "library" | "folder") => {
        setSource(next)
        setCurrentPath([])
        setSearch("")
        if (next === "folder") void loadFolder()
    }

    /** Library items are links; folder images are embedded in the board */
    const pick = async (token: TokenLibraryToken) => {
        const file = folderFiles.current.get(token.url)
        if (file) onSelect(await readAsDataUrl(file), token.name)
        else onSelect(resolveUrl(token.url), token.name)
    }

    const lib = source === "folder" ? folderLib : library

    // Load the library the first time the drawer opens
    useEffect(() => {
        if (!isOpen || library) return
        let cancelled = false
        setError(null)
        loadManifest(info.manifest)
            .then((manifest) => {
                if (!cancelled) setLibrary(manifest)
            })
            .catch((err: Error) => {
                if (!cancelled) setError(err.message)
            })
        return () => {
            cancelled = true
        }
    }, [isOpen, library, reloadKey, info.manifest])

    // Focus search and close on Escape while open
    useEffect(() => {
        if (!isOpen) return
        searchInputRef.current?.focus()
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === "Escape") {
                e.stopPropagation()
                onClose()
            }
        }
        window.addEventListener("keydown", handleKeyDown)
        return () => window.removeEventListener("keydown", handleKeyDown)
    }, [isOpen, onClose])

    // Scroll back to the top whenever the view changes
    useEffect(() => {
        contentRef.current?.scrollTo({ top: 0 })
    }, [currentPath, search])

    const allTokens = useMemo(() => (lib ? flattenTokens(lib) : []), [lib])

    const searchResults = useMemo(() => {
        const query = search.trim().toLowerCase()
        if (!query) return null
        return allTokens.filter(
            (token) =>
                token.name.toLowerCase().includes(query) ||
                token.folderLabel.toLowerCase().includes(query)
        )
    }, [allTokens, search])

    if (!isOpen) return null

    const currentFolder = lib ? findFolder(lib, currentPath) : null

    const renderTokenGrid = (tokens: (TokenLibraryToken | SearchResult)[]) => (
        <div className='token-library-grid'>
            {tokens.map((token) => (
                <button
                    key={token.url}
                    type='button'
                    className='token-library-token'
                    onClick={() => void pick(token)}
                    title={
                        "folderLabel" in token
                            ? `${token.name}\n${token.folderLabel}`
                            : token.name
                    }
                >
                    <img
                        src={resolveUrl(token.thumb ?? token.url)}
                        alt={token.name}
                        loading='lazy'
                        decoding='async'
                        draggable={false}
                    />
                    <span className='token-library-token-name'>
                        {token.name}
                    </span>
                </button>
            ))}
        </div>
    )

    const renderFolderMessage = () => {
        const where = (
            <code>
                {folderState.status === "ready" ? folderState.rootName : "your local folder"}/{subfolder}
            </code>
        )
        switch (folderState.status) {
            case "loading":
            case "idle":
                return <div className='token-library-message'>Reading your folder…</div>
            case "unsupported":
                return (
                    <div className='token-library-message'>
                        Your own folder needs Chrome, Edge, Brave or Opera.
                    </div>
                )
            case "no-folder":
                return (
                    <div className='token-library-message'>
                        Choose a <strong>Local Folder</strong> in the menu first. Jewel VTT
                        makes a <code>{subfolder}</code> folder inside it for your images.
                    </div>
                )
            case "denied":
                return (
                    <div className='token-library-message'>
                        Jewel VTT needs permission to read your folder.
                        <button type='button' className='token-library-retry' onClick={() => void loadFolder()}>
                            Try again
                        </button>
                    </div>
                )
            case "error":
                return (
                    <div className='token-library-message'>
                        Couldn't read your folder ({folderState.message}).
                        <button type='button' className='token-library-retry' onClick={() => void loadFolder()}>
                            Try again
                        </button>
                    </div>
                )
            case "ready":
                return (
                    <div className='token-library-message'>
                        Drop images into {where} and press Refresh to see them here.
                    </div>
                )
        }
    }

    const renderBody = () => {
        if (source === "folder" && (folderState.status !== "ready" || !folderLib?.totalTokens)) {
            return renderFolderMessage()
        }
        if (source === "library" && error) {
            return (
                <div className='token-library-message'>
                    Couldn't load the token library ({error}).
                    <button
                        type='button'
                        className='token-library-retry'
                        onClick={() => setReloadKey((key) => key + 1)}
                    >
                        Retry
                    </button>
                </div>
            )
        }

        if (!lib || !currentFolder) {
            return (
                <div className='token-library-message'>Loading library…</div>
            )
        }

        if (lib.totalTokens === 0) {
            return (
                <div className='token-library-message'>
                    The library is empty. Add images to{" "}
                    <code>{info.folder}</code> to see them here.
                </div>
            )
        }

        if (searchResults) {
            if (searchResults.length === 0) {
                return (
                    <div className='token-library-message'>
                        No {info.noun} match “{search.trim()}”.
                    </div>
                )
            }
            return (
                <>
                    <div className='token-library-result-count'>
                        {searchResults.length > MAX_SEARCH_RESULTS
                            ? `Showing ${MAX_SEARCH_RESULTS} of ${searchResults.length} matches — refine your search`
                            : `${searchResults.length} match${searchResults.length === 1 ? "" : "es"}`}
                    </div>
                    {renderTokenGrid(
                        searchResults.slice(0, MAX_SEARCH_RESULTS)
                    )}
                </>
            )
        }

        return (
            <>
                {currentFolder.folders.length > 0 && (
                    <ul className='token-library-folders'>
                        {currentFolder.folders.map((folder) => {
                            const preview = firstToken(folder)
                            return (
                                <li key={folder.name}>
                                    <button
                                        type='button'
                                        className='token-library-folder'
                                        onClick={() =>
                                            setCurrentPath(folder.path)
                                        }
                                    >
                                        <span className='token-library-folder-preview'>
                                            {preview && (
                                                <img
                                                    src={resolveUrl(
                                                        preview.thumb ??
                                                            preview.url
                                                    )}
                                                    alt=''
                                                    loading='lazy'
                                                    decoding='async'
                                                    draggable={false}
                                                />
                                            )}
                                        </span>
                                        <span className='token-library-folder-name'>
                                            {folder.name}
                                        </span>
                                        <span className='token-library-folder-count'>
                                            {folder.totalTokens}
                                        </span>
                                        <span
                                            className='token-library-chevron'
                                            aria-hidden='true'
                                        >
                                            ›
                                        </span>
                                    </button>
                                </li>
                            )
                        })}
                    </ul>
                )}
                {currentFolder.tokens.length > 0 &&
                    renderTokenGrid(currentFolder.tokens)}
            </>
        )
    }

    // Portal to <body>: the humbug layer that hosts the modal sets
    // pointer-events: none, which would otherwise let clicks fall through
    // the drawer onto the modal backdrop (closing the modal).
    return createPortal(
        <>
            <div className='token-library-overlay' onClick={onClose} />
            <aside
                className={`token-library-drawer token-library-${kind}`}
                role='dialog'
                aria-label={info.title}
            >
                <div className='token-library-header'>
                    <h3>{info.title}</h3>
                    <button
                        type='button'
                        className='token-library-close'
                        onClick={onClose}
                        aria-label={`Close ${info.title}`}
                    >
                        <Icon name='close' size={20} />
                    </button>
                </div>

                <div className='token-library-toolbar'>
                    {isLocalFolderSupported() && (
                        <div className='token-library-source' role='tablist' aria-label='Image source'>
                            <button
                                type='button'
                                role='tab'
                                aria-selected={source === "library"}
                                className={source === "library" ? "active" : ""}
                                onClick={() => switchSource("library")}
                            >
                                Library
                            </button>
                            <button
                                type='button'
                                role='tab'
                                aria-selected={source === "folder"}
                                className={source === "folder" ? "active" : ""}
                                onClick={() => switchSource("folder")}
                            >
                                <Icon name='open' size={16} /> My Folder
                            </button>
                            {source === "folder" && folderState.status === "ready" && (
                                <button
                                    type='button'
                                    className='token-library-refresh'
                                    onClick={() => void loadFolder()}
                                    title={`Look for new images in ${subfolder}`}
                                >
                                    Refresh
                                </button>
                            )}
                        </div>
                    )}
                    <input
                        ref={searchInputRef}
                        type='search'
                        className='token-library-search'
                        placeholder={
                            lib
                                ? `Search ${lib.totalTokens} ${info.noun}…`
                                : `Search ${info.noun}…`
                        }
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />
                    {!searchResults && (
                        <nav
                            className='token-library-breadcrumbs'
                            aria-label='Folder path'
                        >
                            <button
                                type='button'
                                className='token-library-crumb'
                                onClick={() => setCurrentPath([])}
                                disabled={currentPath.length === 0}
                            >
                                {source === "folder" ? subfolder : "Library"}
                            </button>
                            {currentPath.map((segment, index) => (
                                <React.Fragment key={index}>
                                    <span className='token-library-crumb-sep'>
                                        /
                                    </span>
                                    <button
                                        type='button'
                                        className='token-library-crumb'
                                        onClick={() =>
                                            setCurrentPath(
                                                currentPath.slice(0, index + 1)
                                            )
                                        }
                                        disabled={
                                            index === currentPath.length - 1
                                        }
                                    >
                                        {segment}
                                    </button>
                                </React.Fragment>
                            ))}
                        </nav>
                    )}
                </div>

                <div className='token-library-content' ref={contentRef}>
                    {renderBody()}
                </div>
            </aside>
        </>,
        document.body
    )
}
