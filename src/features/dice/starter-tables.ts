import { parseEntries, type RandomTable } from "./tables-core.ts"

/* Starter tables shipped with Jewel VTT. Original content. */

const part = (dice: string, text: string, label?: string) => ({
    dice,
    entries: parseEntries(text).entries,
    ...(label ? { label } : {}),
})

export const STARTER_TABLES: RandomTable[] = [
    {
        id: "starter:reaction",
        name: "Reaction roll",
        join: " ",
        updatedAt: 0,
        parts: [
            part(
                "2d6",
                `2: Hostile. They attack, or drive you off at once.
3-5: Unfriendly. Wary and bristling; they may threaten or demand a toll.
6-8: Unsure. They watch and wait. Your next move decides it.
9-11: Indifferent. Willing to talk, trade, or let you pass.
12: Friendly. Curious and helpful; they may offer aid or news.`
            ),
        ],
    },
    {
        id: "starter:dressing",
        name: "Dungeon dressing",
        join: " ",
        updatedAt: 0,
        parts: [
            part(
                "1d12",
                `1: Puddles of black water that ripple with no wind.
2: A cold draught that smells of wet ashes.
3: Tally marks scratched along one wall, 3d20 of them.
4: A collapsed shelf of clay jars, 1d4 still sealed.
5: Faded chalk arrows pointing back the way you came.
6: Rusted chains hanging from the ceiling, gently swaying.
7: A toppled statue whose face has been chiselled away.
8: Pale fungus glowing faintly in the cracks of the floor.
9: The ashes of a small campfire, still slightly warm.
10: A door painted shut, with its keyhole on the wrong side.
11: Dozens of tiny bones laid out in a neat spiral.
12: Distant dripping that stops whenever anyone listens.`
            ),
        ],
    },
    {
        id: "starter:trinkets",
        name: "Simple trinkets",
        join: " ",
        updatedAt: 0,
        parts: [
            part(
                "1d20",
                `1: A brass key too small for any lock you have seen.
2: A wooden whistle carved like a sleeping owl.
3: A glass marble with a curl of smoke trapped inside.
4: A letter sealed with green wax, addressed to no one.
5: A thimble carved from bone.
6: A deck of cards with every queen missing.
7: A tin soldier with a painted moustache.
8: A pressed flower that still smells of rain.
9: A spoon bent into a perfect knot.
10: A tiny bell with no clapper.
11: A scrap of map showing a river bend and an X.
12: A smooth stone with a hole worn through the middle.
13: A copper coin stamped with an unknown face.
14: A lock of silver hair tied with red thread.
15: A signet ring showing a fox with three eyes.
16: A pocket sundial whose shadow always points to dusk.
17: A pouch of 2d6 buttons, no two alike.
18: A wooden die with a different tiny face carved on each side.
19: A ribbon embroidered with a half-finished name.
20: A snail shell that hums when held to the ear.`
            ),
        ],
    },
    {
        id: "starter:tavern",
        name: "Tavern names",
        join: " ",
        updatedAt: 0,
        parts: [
            part(
                "1d12",
                `1: The Gilded
2: The Crooked
3: The Drowsy
4: The Laughing
5: The Rusty
6: The Wandering
7: The Silver
8: The Muddy
9: The Patient
10: The Lucky
11: The Howling
12: The Thrice-Burnt`,
                "First word"
            ),
            part(
                "1d12",
                `1: Lantern
2: Goat
3: Kettle
4: Badger
5: Anvil
6: Boot
7: Owl
8: Barrel
9: Crown
10: Turnip
11: Wyvern
12: Ladle`,
                "Second word"
            ),
        ],
    },
    {
        id: "starter:npc-traits",
        name: "NPC traits",
        join: " ",
        updatedAt: 0,
        parts: [
            part(
                "1d20",
                `1: Hums old marching songs, always off-key.
2: Counts everything twice.
3: Speaks only in questions when nervous.
4: Collects teeth, any kind.
5: Unfailingly polite to animals, curt with people.
6: Laughs at exactly the wrong moments.
7: Always eating something.
8: Never sits with their back to a door.
9: Quotes a grandmother constantly.
10: Terrified of birds.
11: Wears far too many rings.
12: Whispers anything important.
13: Tells wildly exaggerated stories.
14: Haggles over everything, even gifts.
15: Sniffs every meal suspiciously before eating.
16: Honest to a fault, even when it hurts.
17: Fidgets with a small knife.
18: Writes everything down in a tiny notebook.
19: Keeps mistaking one of you for someone else.
20: Cheerful no matter how bad things get.`
            ),
        ],
    },
]
