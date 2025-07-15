import { useState } from 'react';
import { InfiniteWhiteboard } from "./components/InfiniteWhiteboard"
import { TopBar } from "./components/TopBar"
import { Sidebar } from "./components/Sidebar"
import "./App.css"

function App() {
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);

    const handleSidebarToggle = (isOpen: boolean) => {
        setIsSidebarOpen(isOpen);
    };

    const handleSidebarClose = () => {
        setIsSidebarOpen(false);
    };

    return (
        <div className='app'>
            <TopBar onSidebarToggle={handleSidebarToggle} />
            <Sidebar isOpen={isSidebarOpen} onClose={handleSidebarClose} />
            <div className="main-content">
                <InfiniteWhiteboard />
            </div>
        </div>
    )
}

export default App
