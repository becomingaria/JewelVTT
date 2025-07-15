import React from 'react';
import type { Point, HumbugType, ContextMenuOption } from '../types/humbug.types';
import './ContextMenu.css';

interface ContextMenuProps {
  position: Point;
  isOpen: boolean;
  onClose: () => void;
  onCreateHumbug: (type: HumbugType, position: Point) => void;
  snapToGrid: boolean;
  onToggleSnapToGrid: () => void;
}

const CONTEXT_MENU_OPTIONS: ContextMenuOption[] = [
  { label: 'Text Box', type: 'text', icon: '📝' },
  { label: 'Image', type: 'image', icon: '🖼️' },
  { label: 'Map Pin', type: 'map-pin', icon: '📍' },
  { label: 'Solid Color', type: 'solid-color', icon: '🟦' },
];

export const ContextMenu: React.FC<ContextMenuProps> = ({
  position,
  isOpen,
  onClose,
  onCreateHumbug,
  snapToGrid,
  onToggleSnapToGrid,
}) => {
  if (!isOpen) return null;

  const handleOptionClick = (type: HumbugType) => {
    onCreateHumbug(type, position);
    onClose();
  };

  return (
    <>
      {/* Backdrop to close menu */}
      <div className="context-menu-backdrop" onClick={onClose} />
      
      {/* Context Menu */}
      <div 
        className="context-menu"
        style={{
          left: position.x,
          top: position.y,
        }}
      >
        <div className="context-menu-header">
          <span>Add Humbug</span>
        </div>
        <div className="context-menu-options">
          {CONTEXT_MENU_OPTIONS.map((option) => (
            <button
              key={option.type}
              className="context-menu-option"
              onClick={() => handleOptionClick(option.type)}
            >
              <span className="option-icon">{option.icon}</span>
              <span className="option-label">{option.label}</span>
            </button>
          ))}
        </div>
        
        <div className="context-menu-separator" />
        
        <div className="context-menu-options">
          <button
            className="context-menu-option toggle-option"
            onClick={(e) => {
              e.stopPropagation();
              onToggleSnapToGrid();
            }}
          >
            <span className="option-icon">{snapToGrid ? '🔳' : '⬜'}</span>
            <span className="option-label">Snap to Grid</span>
            <span className="toggle-indicator">{snapToGrid ? 'ON' : 'OFF'}</span>
          </button>
        </div>
      </div>
    </>
  );
};
