import React from "react"

export const NetHelp: React.FC = () => (
    <>
        <p>
            Play with friends on their own computers. Open <strong>Multiplayer</strong> (two figures, in the dock).
        </p>
        <p>
            <strong>GM:</strong> press <em>Host this board</em> and send players the room link. With{" "}
            <em>Knock to join</em> on, each new player waits until you let them in. In the player list you can give
            anyone a private label, see their device and IP address, kick them, or ban them (by device and IP). A{" "}
            <em>New room code</em> makes the old link stop working; you can keep the players who are connected or
            drop everyone. <em>Share my view</em> gives players a “Now sharing” button that jumps to what you're
            looking at. It never lifts the fog.
        </p>
        <p>
            <strong>Players' tokens (GM):</strong> each player's tokens are listed under their name, with{" "}
            <em>Go to</em> and <em>Take back</em>. Right-click any token and choose <em>Give to</em> a player to hand
            it over. <em>Pause</em> stops one player moving or placing tokens (<em>Pause everyone</em> for all).
            Under <em>Players' tokens</em> you set how many tokens each player may have, whether they may move only
            where the party can see (on by default), and whether new tokens wait for your OK.
        </p>
        <p>
            <strong>Players:</strong> paste the room link and press <em>Join</em> (in the desktop app, clicking the
            link works too). Under <em>My characters</em>, save your characters in your app once (a name and a
            picture, with the light and vision they start with). Press <em>Place on map</em>, then click a spot the
            party can see. Drag your token to move it, and use <em>Undo my last move</em> if you slip. On the table
            you can rename a token, change its light and vision, or take it off. The person button next to home (or{" "}
            <kbd className='how-to-kbd'>J</kbd>) jumps to your token; press again for the next one. You see what any
            player's token can see, plus anything the GM reveals; walls block sight. Dice you roll show up in
            everyone's log. Your own saved board comes back when you leave.
        </p>
        <p className='how-to-note'>
            Connections go straight between computers; free public relays only help them find each other. Each side
            can see the other's IP address. Some strict networks (offices, schools, mobile hotspots) block direct
            connections.
        </p>
    </>
)
