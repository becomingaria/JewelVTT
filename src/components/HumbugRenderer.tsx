import React, { useState, useRef } from 'react';
import type { Humbug, Point } from '../types/humbug.types';
import './HumbugRenderer.css';

interface HumbugRendererProps {
  humbug: Humbug;
  isSelected: boolean;
  onSelect: (id: string) => void;
  onMove: (id: string, newPosition: Point) => void;
  onRotate: (id: string, rotation: number) => void;
  onResize: (id: string, newSize: { width: number; height: number }) => void;
  onDelete: (id: string) => void;
  onEdit: (id: string) => void;
  onStartDrag: (id: string, offset: Point) => void;
  onContextMenu: (e: React.MouseEvent, humbugId: string) => void;
  scale: number;
  worldToScreen: (worldX: number, worldY: number) => Point;
}

export const HumbugRenderer: React.FC<HumbugRendererProps> = ({
  humbug,
  isSelected,
  onSelect,
  onRotate,
  onResize,
  onDelete,
  onEdit,
  onStartDrag,
  onContextMenu,
  scale,
  worldToScreen,
}) => {
  const [interactionMode, setInteractionMode] = useState<'none' | 'dragging' | 'rotating' | 'resizing'>('none');
  const [activeResizeHandle, setActiveResizeHandle] = useState<string | null>(null);
  const elementRef = useRef<HTMLDivElement>(null);
  const initialRotation = useRef<number>(0);
  const initialSize = useRef<{ width: number; height: number }>({ width: 0, height: 0 });
  const rotationCenter = useRef<Point>({ x: 0, y: 0 });

  const handleMouseDown = (e: React.MouseEvent) => {
    if (humbug.locked) return;
    
    // If shift key is held, allow event to bubble up for panning
    if (e.shiftKey) {
      return;
    }
    
    e.stopPropagation();
    onSelect(humbug.id);
    
    // Calculate offset from click position to humbug origin
    const rect = elementRef.current?.getBoundingClientRect();
    if (!rect) return;
    
    // Get the humbug's screen position
    const humbugScreenPos = worldToScreen(humbug.position.x, humbug.position.y);
    
    // Calculate offset from click position to humbug's top-left corner
    const offset = {
      x: e.clientX - humbugScreenPos.x,
      y: e.clientY - humbugScreenPos.y
    };
    
    // Start dragging
    setInteractionMode('dragging');
    onStartDrag(humbug.id, offset);
  };

  const handleRotateMouseDown = (e: React.MouseEvent) => {
    // If shift key is held, allow event to bubble up for panning
    if (e.shiftKey) {
      return;
    }
    
    e.stopPropagation();
    e.preventDefault();
    
    if (humbug.locked) return;
    
    setInteractionMode('rotating');
    initialRotation.current = humbug.rotation;
    
    const rect = elementRef.current?.getBoundingClientRect();
    if (rect) {
      rotationCenter.current = {
        x: rect.left + rect.width / 2,
        y: rect.top + rect.height / 2,
      };
    }

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const dx = moveEvent.clientX - rotationCenter.current.x;
      const dy = moveEvent.clientY - rotationCenter.current.y;
      const angle = Math.atan2(dy, dx) * (180 / Math.PI);
      onRotate(humbug.id, angle);
    };

    const handleMouseUp = () => {
      setInteractionMode('none');
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  const handleResizeMouseDown = (e: React.MouseEvent, handle: string) => {
    // If shift key is held, allow event to bubble up for panning
    if (e.shiftKey) {
      return;
    }
    
    e.stopPropagation();
    e.preventDefault();
    
    if (humbug.locked) return;
    
    setInteractionMode('resizing');
    setActiveResizeHandle(handle);
    initialSize.current = humbug.type === 'map-pin' 
      ? { width: 32, height: 40 } 
      : ('size' in humbug ? humbug.size : { width: 100, height: 100 });
    
    const startX = e.clientX;
    const startY = e.clientY;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const deltaX = moveEvent.clientX - startX;
      const deltaY = moveEvent.clientY - startY;
      
      let newWidth = initialSize.current.width;
      let newHeight = initialSize.current.height;

      switch (handle) {
        case 'e':
          newWidth = Math.max(20, initialSize.current.width + deltaX / scale);
          break;
        case 'w':
          newWidth = Math.max(20, initialSize.current.width - deltaX / scale);
          break;
        case 's':
          newHeight = Math.max(20, initialSize.current.height + deltaY / scale);
          break;
        case 'n':
          newHeight = Math.max(20, initialSize.current.height - deltaY / scale);
          break;
        case 'se':
          newWidth = Math.max(20, initialSize.current.width + deltaX / scale);
          newHeight = Math.max(20, initialSize.current.height + deltaY / scale);
          break;
        case 'sw':
          newWidth = Math.max(20, initialSize.current.width - deltaX / scale);
          newHeight = Math.max(20, initialSize.current.height + deltaY / scale);
          break;
        case 'ne':
          newWidth = Math.max(20, initialSize.current.width + deltaX / scale);
          newHeight = Math.max(20, initialSize.current.height - deltaY / scale);
          break;
        case 'nw':
          newWidth = Math.max(20, initialSize.current.width - deltaX / scale);
          newHeight = Math.max(20, initialSize.current.height - deltaY / scale);
          break;
      }

      onResize(humbug.id, { width: newWidth, height: newHeight });
    };

    const handleMouseUp = () => {
      setInteractionMode('none');
      setActiveResizeHandle(null);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
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
            draggable={false}
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

  const getCursor = () => {
    if (humbug.locked) return 'default';
    
    switch (interactionMode) {
      case 'dragging':
        return 'grabbing';
      case 'rotating':
        return 'grabbing';
      case 'resizing':
        return activeResizeHandle?.includes('n') || activeResizeHandle?.includes('s') 
          ? 'ns-resize' 
          : activeResizeHandle?.includes('e') || activeResizeHandle?.includes('w')
          ? 'ew-resize'
          : 'nwse-resize';
      default:
        return 'grab';
    }
  };

  return (
    <div
      ref={elementRef}
      className={`humbug-renderer humbug-element ${isSelected ? 'selected' : ''} ${humbug.locked ? 'locked' : ''}`}
      style={{
        position: 'absolute',
        left: worldToScreen(humbug.position.x, humbug.position.y).x,
        top: worldToScreen(humbug.position.x, humbug.position.y).y,
        transform: `rotate(${humbug.rotation}deg)`,
        zIndex: humbug.zIndex,
        opacity: humbug.opacity,
        cursor: getCursor(),
      }}
      onMouseDown={handleMouseDown}
      onDoubleClick={handleDoubleClick}
      onContextMenu={(e) => onContextMenu(e, humbug.id)}
    >
      {renderHumbugContent()}
      
      {/* Selection handles */}
      {isSelected && !humbug.locked && (
        <div className="humbug-handles">
          <div className="selection-outline" />
          
          {/* Resize handles - only for resizable humbugs */}
          {humbug.type !== 'map-pin' && (
            <>
              {/* Corner handles */}
              <div 
                className="resize-handle corner-handle nw-handle"
                onMouseDown={(e) => handleResizeMouseDown(e, 'nw')}
                title="Resize"
              />
              <div 
                className="resize-handle corner-handle ne-handle"
                onMouseDown={(e) => handleResizeMouseDown(e, 'ne')}
                title="Resize"
              />
              <div 
                className="resize-handle corner-handle sw-handle"
                onMouseDown={(e) => handleResizeMouseDown(e, 'sw')}
                title="Resize"
              />
              <div 
                className="resize-handle corner-handle se-handle"
                onMouseDown={(e) => handleResizeMouseDown(e, 'se')}
                title="Resize"
              />
              
              {/* Edge handles */}
              <div 
                className="resize-handle edge-handle n-handle"
                onMouseDown={(e) => handleResizeMouseDown(e, 'n')}
                title="Resize"
              />
              <div 
                className="resize-handle edge-handle s-handle"
                onMouseDown={(e) => handleResizeMouseDown(e, 's')}
                title="Resize"
              />
              <div 
                className="resize-handle edge-handle e-handle"
                onMouseDown={(e) => handleResizeMouseDown(e, 'e')}
                title="Resize"
              />
              <div 
                className="resize-handle edge-handle w-handle"
                onMouseDown={(e) => handleResizeMouseDown(e, 'w')}
                title="Resize"
              />
            </>
          )}
          
          <button 
            className="rotate-handle"
            onMouseDown={handleRotateMouseDown}
            title="Drag to rotate"
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
