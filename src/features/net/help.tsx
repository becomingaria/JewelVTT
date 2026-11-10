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
            <strong>Players:</strong> paste the room link and press <em>Join</em> (in the desktop app, clicking the
            link works too). Add your token, drag it to move, and use <em>Undo my last move</em> or{" "}
            {"⌘/Ctrl+Z"} if you slip. Pick your light and vision in the panel or by right-clicking your token. You see
            what any player's token can see, plus anything the GM reveals. Dice you roll show up in everyone's log.
            Your own saved board comes back when you leave.
        </p>
        <p className='how-to-note'>
            Connections go straight between computers; free public relays only help them find each other. Each side
            can see the other's IP address. Some strict networks (offices, schools, mobile hotspots) block direct
            connections.
        </p>
    </>
)
