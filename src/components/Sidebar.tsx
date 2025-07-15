import React from 'react';
import './Sidebar.css';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ isOpen, onClose }) => {
  const handleImportBoard = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (event) => {
          const jsonData = event.target?.result as string;
          const importFn = (window as unknown as { importHumbugs?: (data: string) => void }).importHumbugs;
          if (importFn) {
            importFn(jsonData);
          } else {
            console.log('Import Board clicked - Function not available yet');
          }
        };
        reader.readAsText(file);
      }
    };
    input.click();
  };

  const handleExportBoard = () => {
    const exportFn = (window as unknown as { exportHumbugs?: () => void }).exportHumbugs;
    if (exportFn) {
      exportFn();
    } else {
      console.log('Export Board clicked - Function not available yet');
    }
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
