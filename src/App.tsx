import { useState } from 'react';
import { InfiniteWhiteboard } from "./components/InfiniteWhiteboard"
import { TopBar } from "./components/TopBar"
import { Sidebar } from "./components/Sidebar"
import "./App.css"

function App() {
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const [showGridLines, setShowGridLines] = useState(true);
    const [showDragTails, setShowDragTails] = useState(true);

    const handleSidebarToggle = (isOpen: boolean) => {
        setIsSidebarOpen(isOpen);
    };

    const handleSidebarClose = () => {
        setIsSidebarOpen(false);
    };

    const handleToggleGridLines = () => {
        setShowGridLines(prev => !prev);
    };

    const handleToggleDragTails = () => {
        setShowDragTails(prev => !prev);
    };

    const handleExportBoard = () => {
        // Export functionality will be implemented in InfiniteWhiteboard
        const exportEvent = new CustomEvent('exportBoard');
        window.dispatchEvent(exportEvent);
    };

    const handleImportBoard = (file: File) => {
        // Import functionality will be implemented in InfiniteWhiteboard
        const importEvent = new CustomEvent('importBoard', { detail: file });
        window.dispatchEvent(importEvent);
    };

    return (
        <div className='app'>
            <TopBar 
                onSidebarToggle={handleSidebarToggle} 
            />
            <Sidebar 
                isOpen={isSidebarOpen} 
                onClose={handleSidebarClose}
                onToggleGridLines={handleToggleGridLines}
                onToggleDragTails={handleToggleDragTails}
                onExportBoard={handleExportBoard}
                onImportBoard={handleImportBoard}
                showGridLines={showGridLines}
                showDragTails={showDragTails}
            />
            <div className="main-content">
                <InfiniteWhiteboard 
                    showGridLines={showGridLines}
                    showDragTails={showDragTails}
                />
            </div>
        </div>
    )
}

export default App
