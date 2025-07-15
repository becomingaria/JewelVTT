import React, { useState, useCallback, useRef, useEffect } from 'react';
import type { HumbugType, Point, HumbugState } from '../types/humbug.types';
import { ContextMenu } from './ContextMenu';
import { HumbugRenderer } from './HumbugRenderer';
import { snapToGrid, createDefaultHumbug } from '../utils/humbug.utils';

interface HumbugManagerProps {
  scale: number;
  containerRef: React.RefObject<HTMLDivElement | null>;
  screenToWorld: (screenX: number, screenY: number) => Point;
  worldToScreen: (worldX: number, worldY: number) => Point;
}

export const HumbugManager: React.FC<HumbugManagerProps> = ({
  scale,
  containerRef,
  screenToWorld,
}) => {
  const [state, setState] = useState<HumbugState>({
    humbugs: [],
    selectedHumbugId: null,
    dragTail: null,
    contextMenu: {
      isOpen: false,
      position: { x: 0, y: 0 },
    },
  });

  const [isDragging, setIsDragging] = useState(false);
  const draggedHumbugRef = useRef<string | null>(null);

  // Handle right-click context menu
  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;

    setState(prev => ({
      ...prev,
      contextMenu: {
        isOpen: true,
        position: {
          x: e.clientX - rect.left,
          y: e.clientY - rect.top,
        },
      },
    }));
  }, [containerRef]);

  // Create new Humbug
  const createHumbug = useCallback((type: HumbugType, screenPosition: Point) => {
    const worldPosition = screenToWorld(screenPosition.x, screenPosition.y);
    const snappedPosition = snapToGrid(worldPosition, 32);
    
    const newHumbug = createDefaultHumbug(type, snappedPosition);
    
    setState(prev => ({
      ...prev,
      humbugs: [...prev.humbugs, newHumbug],
      selectedHumbugId: newHumbug.id,
      contextMenu: { isOpen: false, position: { x: 0, y: 0 } },
    }));
  }, [screenToWorld]);

  // Select Humbug
  const selectHumbug = useCallback((id: string) => {
    setState(prev => ({
      ...prev,
      selectedHumbugId: id,
    }));
  }, []);

  // Move Humbug
  const moveHumbug = useCallback((id: string, newPosition: Point) => {
    const snappedPosition = snapToGrid(newPosition, 32);
    
    setState(prev => ({
      ...prev,
      humbugs: prev.humbugs.map(humbug =>
        humbug.id === id
          ? { ...humbug, position: snappedPosition, updatedAt: Date.now() }
          : humbug
      ),
    }));
  }, []);

  // Rotate Humbug
  const rotateHumbug = useCallback((id: string, rotation: number) => {
    setState(prev => ({
      ...prev,
      humbugs: prev.humbugs.map(humbug =>
        humbug.id === id
          ? { ...humbug, rotation, updatedAt: Date.now() }
          : humbug
      ),
    }));
  }, []);

  // Delete Humbug
  const deleteHumbug = useCallback((id: string) => {
    setState(prev => ({
      ...prev,
      humbugs: prev.humbugs.filter(humbug => humbug.id !== id),
      selectedHumbugId: prev.selectedHumbugId === id ? null : prev.selectedHumbugId,
    }));
  }, []);

  // Edit Humbug (placeholder for modal)
  const editHumbug = useCallback((id: string) => {
    console.log('Edit Humbug:', id);
    // TODO: Open humbug modal
  }, []);

  // Close context menu
  const closeContextMenu = useCallback(() => {
    setState(prev => ({
      ...prev,
      contextMenu: { isOpen: false, position: { x: 0, y: 0 } },
    }));
  }, []);

  // Mouse move handler for dragging
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging || !draggedHumbugRef.current) return;

      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return;

      const screenX = e.clientX - rect.left;
      const screenY = e.clientY - rect.top;
      const worldPos = screenToWorld(screenX, screenY);
      
      moveHumbug(draggedHumbugRef.current, worldPos);
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      draggedHumbugRef.current = null;
    };

    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, containerRef, screenToWorld, moveHumbug]);

  // Export humbugs as JSON
  const exportHumbugs = useCallback(() => {
    const data = {
      version: '1.0',
      humbugs: state.humbugs,
      exportedAt: new Date().toISOString(),
    };
    
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `pixel-vtt-board-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [state.humbugs]);

  // Import humbugs from JSON
  const importHumbugs = useCallback((jsonData: string) => {
    try {
      const data = JSON.parse(jsonData);
      if (data.humbugs && Array.isArray(data.humbugs)) {
        setState(prev => ({
          ...prev,
          humbugs: data.humbugs,
          selectedHumbugId: null,
        }));
        console.log('Imported', data.humbugs.length, 'humbugs');
      }
    } catch (error) {
      console.error('Failed to import humbugs:', error);
    }
  }, []);

  // Expose export/import functions globally for the sidebar buttons
  useEffect(() => {
    (window as unknown as { exportHumbugs?: () => void; importHumbugs?: (data: string) => void }).exportHumbugs = exportHumbugs;
    (window as unknown as { exportHumbugs?: () => void; importHumbugs?: (data: string) => void }).importHumbugs = importHumbugs;
    
    return () => {
      delete (window as unknown as { exportHumbugs?: () => void; importHumbugs?: (data: string) => void }).exportHumbugs;
      delete (window as unknown as { exportHumbugs?: () => void; importHumbugs?: (data: string) => void }).importHumbugs;
    };
  }, [exportHumbugs, importHumbugs]);

  return (
    <div
      style={{ 
        position: 'absolute', 
        top: 0,
        left: 0,
        width: '100%', 
        height: '100%',
        pointerEvents: 'none' // Allow canvas events to pass through
      }}
    >
      {/* Invisible layer that only captures right-click for context menu */}
      <div
        style={{ 
          position: 'absolute', 
          width: '100%', 
          height: '100%',
          pointerEvents: 'auto', // Enable to capture right-clicks
          zIndex: 1
        }}
        onContextMenu={(e) => {
          e.preventDefault();
          handleContextMenu(e);
        }}
        onMouseDown={(e) => {
          // Only handle right-clicks, let left-clicks pass through for canvas panning
          if (e.button === 2) { // Right click
            e.stopPropagation();
          }
        }}
      />
      
      {/* Render all humbugs */}
      {state.humbugs.map((humbug) => (
        <HumbugRenderer
          key={humbug.id}
          humbug={humbug}
          isSelected={state.selectedHumbugId === humbug.id}
          onSelect={selectHumbug}
          onMove={moveHumbug}
          onRotate={rotateHumbug}
          onDelete={deleteHumbug}
          onEdit={editHumbug}
          scale={scale}
        />
      ))}

      {/* Context Menu - highest z-index for interaction */}
      {state.contextMenu.isOpen && (
        <ContextMenu
          position={state.contextMenu.position}
          isOpen={state.contextMenu.isOpen}
          onClose={closeContextMenu}
          onCreateHumbug={createHumbug}
        />
      )}
    </div>
  );
};
