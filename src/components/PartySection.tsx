import React, { useEffect, useRef, useState } from "react"
import { Icon } from "./Icon"
import { TokenLibraryDrawer } from "./TokenLibraryDrawer"
import { MAX_PARTY, loadParty, saveParty, type PartyMember } from "../utils/party"
import { ADD_PARTY_EVENT } from "../utils/view-events"
import { showToast } from "../utils/toast"
import "./PartySection.css"

const newId = () => `pc_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`

/** "My Party" in the menu: up to 8 preset tokens dropped onto the board at once */
export const PartySection: React.FC<{ onAdded: () => void }> = ({ onAdded }) => {
    const [party, setParty] = useState<PartyMember[]>([])
    const [loaded, setLoaded] = useState(false)
    const [picking, setPicking] = useState(false)
    const fileRef = useRef<HTMLInputElement>(null)

    useEffect(() => {
        loadParty().then((p) => {
            setParty(p)
            setLoaded(true)
        })
    }, [])

    const update = (next: PartyMember[]) => {
        setParty(next)
        if (loaded) void saveParty(next)
    }

    const addMember = (imageUrl: string, name: string) => {
        if (party.length >= MAX_PARTY) return
        update([...party, { id: newId(), imageUrl, name }])
    }

    const addParty = () => {
        window.dispatchEvent(new CustomEvent(ADD_PARTY_EVENT, { detail: party }))
        showToast(`Your party of ${party.length} has arrived. Move them together with the arrow keys.`)
        onAdded()
    }

    return (
        <div className='sidebar-section'>
            <h4>My Party</h4>
            <div className='party-slots' role='list'>
                {Array.from({ length: MAX_PARTY }, (_, i) => {
                    const m = party[i]
                    if (m) {
                        return (
                            <div key={m.id} className='party-slot filled' role='listitem' title={m.name}>
                                <img src={m.imageUrl} alt={m.name} draggable={false} />
                                <button
                                    type='button'
                                    className='party-remove'
                                    aria-label={`Remove ${m.name} from the party`}
                                    onClick={() => update(party.filter((p) => p.id !== m.id))}
                                >
                                    <Icon name='close' size={10} />
                                </button>
                            </div>
                        )
                    }
                    const isNext = i === party.length
                    return (
                        <button
                            key={`empty-${i}`}
                            type='button'
                            className={`party-slot empty ${isNext ? "next" : ""}`}
                            disabled={!isNext}
                            onClick={() => setPicking(true)}
                            aria-label='Add a party member from the token library'
                            title={isNext ? "Add a party member" : undefined}
                        >
                            {isNext ? "+" : ""}
                        </button>
                    )
                })}
            </div>
            <div className='party-actions'>
                <button
                    type='button'
                    className='party-upload'
                    disabled={party.length >= MAX_PARTY}
                    onClick={() => fileRef.current?.click()}
                >
                    Upload a token…
                </button>
                <input
                    ref={fileRef}
                    type='file'
                    accept='image/*'
                    hidden
                    onChange={(e) => {
                        const file = e.target.files?.[0]
                        e.target.value = ""
                        if (!file) return
                        const reader = new FileReader()
                        reader.onload = () => addMember(reader.result as string, file.name.replace(/\.[^.]+$/, ""))
                        reader.readAsDataURL(file)
                    }}
                />
            </div>
            <button className='sidebar-button party-add' disabled={party.length === 0} onClick={addParty}>
                <span className='button-icon'>
                    <Icon name='token' />
                </span>
                <span>Add My Party</span>
                {party.length > 0 && <span className='party-count'>{party.length}</span>}
            </button>

            <TokenLibraryDrawer
                isOpen={picking}
                onClose={() => setPicking(false)}
                onSelect={(url, name) => {
                    addMember(decodeURI(url), name)
                    setPicking(false)
                }}
            />
        </div>
    )
}
