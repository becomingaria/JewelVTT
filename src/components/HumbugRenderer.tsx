import React, { useState, useRef } from 'react';
import type { Humbug, Point } from '../types/humbug.types';
import './HumbugRenderer.css';

interface HumbugRendererProps {
  humbug: Humbug;
  isSelected: boolean;
  onSelect: (id: string) => void;
  onMove: (id: string, newPosition: Point) => void;
  onRotate: (id: string, rotation: number) => void;
  onDelete: (id: string) => void;
  onEdit: (id: string) => void;
  scale: number; // zoom level for proper sizing
}

export const HumbugRenderer: React.FC<HumbugRendererProps> = ({
  humbug,
  isSelected,
  onSelect,
  onDelete,
  onEdit,
  scale,
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const elementRef = useRef<HTMLDivElement>(null);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (humbug.locked) return;
    
    e.stopPropagation();
    onSelect(humbug.id);
    
    if (e.shiftKey) {
      // TODO: Implement rotation mode
      console.log('Rotation mode - TODO');
    } else {
      // Drag mode
      setIsDragging(true);
    }
  };

  const handleDoubleClick = () => {
    onEdit(humbug.id);
  };

  const renderHumbugContent = () => {
    switch (humbug.type) {
      case 'text':
        return (
          <div 
            className="humbug-text-content"
            style={{
              fontSize: humbug.fontSize * scale,
              fontFamily: humbug.fontFamily,
              color: humbug.color,
              backgroundColor: humbug.backgroundColor,
              width: humbug.size.width * scale,
              height: humbug.size.height * scale,
            }}
          >
            {humbug.content || 'Double-click to edit'}
          </div>
        );
      
      case 'image':
        return (
          <img
            src={humbug.imageUrl}
            alt="Humbug"
            className="humbug-image-content"
            style={{
              width: humbug.size.width * scale,
              height: humbug.size.height * scale,
            }}
          />
        );
      
      case 'map-pin':
        return (
          <div 
            className="humbug-map-pin-content"
            style={{
              fontSize: humbug.size * scale,
              color: humbug.color,
            }}
          >
            📍
            {humbug.label && (
              <span className="map-pin-label" style={{ fontSize: (humbug.size * 0.6) * scale }}>
                {humbug.label}
              </span>
            )}
          </div>
        );
      
      case 'solid-color':
        return (
          <div 
            className="humbug-solid-color-content"
            style={{
              backgroundColor: humbug.color,
              width: humbug.size.width * scale,
              height: humbug.size.height * scale,
            }}
          />
        );
      
      default:
        return null;
    }
  };

  return (
    <div
      ref={elementRef}
      className={`humbug-renderer humbug-element ${isSelected ? 'selected' : ''} ${humbug.locked ? 'locked' : ''}`}
      style={{
        position: 'absolute',
        left: humbug.position.x * scale,
        top: humbug.position.y * scale,
        transform: `rotate(${humbug.rotation}deg)`,
        zIndex: humbug.zIndex,
        cursor: humbug.locked ? 'default' : (isDragging ? 'grabbing' : 'grab'),
      }}
      onMouseDown={handleMouseDown}
      onDoubleClick={handleDoubleClick}
    >
      {renderHumbugContent()}
      
      {/* Selection handles */}
      {isSelected && !humbug.locked && (
        <div className="humbug-handles">
          <div className="selection-outline" />
          <button 
            className="rotate-handle"
            title="Shift+drag to rotate"
          >
            🔄
          </button>
          <button 
            className="delete-handle"
            onClick={(e) => {
              e.stopPropagation();
              onDelete(humbug.id);
            }}
            title="Delete"
          >
            ✕
          </button>
        </div>
      )}
      
      {/* Lock indicator */}
      {humbug.locked && (
        <div className="lock-indicator">🔒</div>
      )}
    </div>
  );
};
