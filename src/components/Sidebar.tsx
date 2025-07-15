import React from 'react';
import './Sidebar.css';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ isOpen, onClose }) => {
  const handleImportBoard = () => {
    console.log('Import Board clicked');
    // TODO: Implement import functionality
  };

  const handleExportBoard = () => {
    console.log('Export Board clicked');
    // TODO: Implement export functionality
  };

  return (
    <>
      {/* Overlay */}
      {isOpen && (
        <div 
          className="sidebar-overlay" 
          onClick={onClose}
        />
      )}
      
      {/* Sidebar */}
      <div className={`sidebar ${isOpen ? 'sidebar-open' : ''}`}>
        <div className="sidebar-header">
          <h3>Menu</h3>
          <button 
            className="close-button"
            onClick={onClose}
            aria-label="Close menu"
          >
            ×
          </button>
        </div>
        
        <div className="sidebar-content">
          <button 
            className="sidebar-button"
            onClick={handleImportBoard}
          >
            📁 Import Board
          </button>
          
          <button 
            className="sidebar-button"
            onClick={handleExportBoard}
          >
            💾 Export Board
          </button>
        </div>
      </div>
    </>
  );
};
