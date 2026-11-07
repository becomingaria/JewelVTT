import React, { useEffect, useMemo, useRef, useState } from "react"
import { createPortal } from "react-dom"
import type {
    TokenLibraryFolder,
    TokenLibraryToken,
} from "../types/token-library.types"
import { Icon } from "./Icon"
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

const resolveUrl = (url: string) => `${import.meta.env.BASE_URL}${url}`

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

    const allTokens = useMemo(
        () => (library ? flattenTokens(library) : []),
        [library]
    )

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

    const currentFolder = library ? findFolder(library, currentPath) : null

    const renderTokenGrid = (tokens: (TokenLibraryToken | SearchResult)[]) => (
        <div className='token-library-grid'>
            {tokens.map((token) => (
                <button
                    key={token.url}
                    type='button'
                    className='token-library-token'
                    onClick={() => onSelect(resolveUrl(token.url), token.name)}
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

    const renderBody = () => {
        if (error) {
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

        if (!library || !currentFolder) {
            return (
                <div className='token-library-message'>Loading library…</div>
            )
        }

        if (library.totalTokens === 0) {
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
                    <input
                        ref={searchInputRef}
                        type='search'
                        className='token-library-search'
                        placeholder={
                            library
                                ? `Search ${library.totalTokens} ${info.noun}…`
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
                                Library
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
