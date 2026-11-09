import { DEFAULT_SETTINGS, type GenSettings } from "./generator"

/* Starter dungeons: named generator settings with fixed seeds */

export interface StarterDungeon {
    id: string
    name: string
    description: string
    settings: GenSettings
}

const s = (over: Partial<GenSettings>): GenSettings => ({ ...DEFAULT_SETTINGS, ...over })

export const STARTERS: StarterDungeon[] = [
    {
        id: "sunken-crypt",
        name: "Sunken Crypt",
        description: "Burial halls linked by winding passages, with a locked tomb and a secret door.",
        settings: s({ seed: "sunken-crypt", size: "medium", rooms: 9, corridors: "winding" }),
    },
    {
        id: "bandit-caves",
        name: "Bandit Caves",
        description: "Rough chambers and crooked tunnels with no doors to hide behind, secret bolt-holes and trapped approaches.",
        settings: s({ seed: "bandit-caves", size: "medium", rooms: 8, corridors: "winding", doors: false }),
    },
    {
        id: "wizards-tower",
        name: "Wizard's Tower Floor",
        description: "One compact floor of a tower: tidy chambers, sturdy doors, and stairs up and down.",
        settings: s({ seed: "wizards-tower", size: "small", rooms: 6, corridors: "straight" }),
    },
    {
        id: "goblin-warren",
        name: "Goblin Warren",
        description: "A sprawling warren of dens joined by twisting tunnels, full of junk and nasty traps.",
        settings: s({ seed: "goblin-warren", size: "large", rooms: 20, corridors: "winding", secretDoors: false }),
    },
    {
        id: "forgotten-shrine",
        name: "Forgotten Shrine",
        description: "A short delve for one evening: four quiet chambers, a hidden door and a trap.",
        settings: s({ seed: "forgotten-shrine", size: "small", rooms: 4, corridors: "straight" }),
    },
]
