import React, { useEffect, useMemo, useRef, useState } from "react"
import { createPortal } from "react-dom"
import type {
    TokenLibraryFolder,
    TokenLibraryToken,
} from "../types/token-library.types"
import "./TokenLibraryDrawer.css"

interface TokenLibraryDrawerProps {
    isOpen: boolean
    onClose: () => void
    onSelect: (imageUrl: string, name: string) => void
}

interface SearchResult extends TokenLibraryToken {
    folderLabel: string
}

const MANIFEST_URL = `${import.meta.env.BASE_URL}token-library.json`
const MAX_SEARCH_RESULTS = 150

const resolveUrl = (url: string) => `${import.meta.env.BASE_URL}${url}`

// Cached across drawer openings so the library is only fetched once per session
let manifestPromise: Promise<TokenLibraryFolder> | null = null

const loadManifest = () => {
    if (!manifestPromise) {
        manifestPromise = fetch(MANIFEST_URL)
            .then((res) => {
                if (!res.ok) throw new Error(`HTTP ${res.status}`)
                return res.json() as Promise<TokenLibraryFolder>
            })
            .catch((error) => {
                manifestPromise = null // allow retry
                throw error
            })
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
}) => {
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
        loadManifest()
            .then((manifest) => {
                if (!cancelled) setLibrary(manifest)
            })
            .catch((err: Error) => {
                if (!cancelled) setError(err.message)
            })
        return () => {
            cancelled = true
        }
    }, [isOpen, library, reloadKey])

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
                        src={resolveUrl(token.url)}
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
                    <code>public/Token_Library</code> to see them here.
                </div>
            )
        }

        if (searchResults) {
            if (searchResults.length === 0) {
                return (
                    <div className='token-library-message'>
                        No tokens match “{search.trim()}”.
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
                className='token-library-drawer'
                role='dialog'
                aria-label='Token library'
            >
                <div className='token-library-header'>
                    <h3>Token Library</h3>
                    <button
                        type='button'
                        className='token-library-close'
                        onClick={onClose}
                        aria-label='Close token library'
                    >
                        ×
                    </button>
                </div>

                <div className='token-library-toolbar'>
                    <input
                        ref={searchInputRef}
                        type='search'
                        className='token-library-search'
                        placeholder={
                            library
                                ? `Search ${library.totalTokens} tokens…`
                                : "Search tokens…"
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
