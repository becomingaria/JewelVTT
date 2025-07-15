import React, { useState, useCallback, useRef, useEffect } from 'react';
import type { HumbugType, Point, HumbugState, Humbug } from '../types/humbug.types';
import type { Action } from '../types/action.types';
import { ContextMenu } from './ContextMenu';
import { HumbugRenderer } from './HumbugRenderer';
import { HumbugModal } from './HumbugModal';
import { HumbugContextMenu } from './HumbugContextMenu';
import { DragTailRenderer } from './DragTailRenderer';
import { snapToGrid, generateId } from '../utils/humbug.utils';
import { UndoRedoManager } from '../utils/undo-redo.utils';
import { ClipboardManager } from '../utils/clipboard.utils';

interface HumbugManagerProps {
  scale: number;
  containerRef: React.RefObject<HTMLDivElement | null>;
  screenToWorld: (screenX: number, screenY: number) => Point;
  worldToScreen: (worldX: number, worldY: number) => Point;
  contextMenuEvent?: React.MouseEvent | null;
  showDragTails?: boolean;
  onExportRequest?: (humbugs: Humbug[], viewport: { x: number; y: number; zoom: number }) => void;
  onImportRequest?: (humbugs: Humbug[]) => void;
}

export const HumbugManager: React.FC<HumbugManagerProps> = ({
  scale,
  containerRef,
  screenToWorld,
  worldToScreen,
  contextMenuEvent,
  showDragTails = true,
  onExportRequest,
  onImportRequest,
}) => {
  const [state, setState] = useState<HumbugState>({
    humbugs: [],
    selectedHumbugId: null,
    dragTail: null,
    contextMenu: {
      isOpen: false,
      position: { x: 0, y: 0 },
    },
    humbugContextMenu: {
      isOpen: false,
      position: { x: 0, y: 0 },
      humbugId: null,
    },
  });

  const [isDragging, setIsDragging] = useState(false);
  const draggedHumbugRef = useRef<string | null>(null);
  const [dragOffset, setDragOffset] = useState<Point>({ x: 0, y: 0 });

  // Settings state
  const [snapToGridEnabled, setSnapToGridEnabled] = useState(true);

  // Modal state
  const [modalState, setModalState] = useState<{
    isOpen: boolean;
    type: HumbugType | null;
    position: Point;
  }>({
    isOpen: false,
    type: null,
    position: { x: 0, y: 0 },
  });

  // Track which humbug is being edited (null means creating new)
  const [editingHumbugId, setEditingHumbugId] = useState<string | null>(null);

  // Undo/Redo and Clipboard managers
  const undoRedoManager = useRef(new UndoRedoManager()).current;
  const clipboardManager = useRef(new ClipboardManager()).current;

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

  // Handle context menu from external event
  useEffect(() => {
    if (contextMenuEvent) {
      handleContextMenu(contextMenuEvent);
    }
  }, [contextMenuEvent, handleContextMenu]);

  // Show modal for humbug creation
  const showHumbugModal = useCallback((type: HumbugType, screenPosition: Point) => {
    const worldPosition = screenToWorld(screenPosition.x, screenPosition.y);
    const finalPosition = snapToGridEnabled ? snapToGrid(worldPosition, 32) : worldPosition;
    
    setModalState({
      isOpen: true,
      type,
      position: finalPosition,
    });

    // Reset editing state for new humbug creation
    setEditingHumbugId(null);

    // Close context menu
    setState(prev => ({
      ...prev,
      contextMenu: { isOpen: false, position: { x: 0, y: 0 } },
    }));
  }, [screenToWorld, snapToGridEnabled]);

  // Create new Humbug from modal data or update existing one
  const createHumbugFromModal = useCallback((humbugData: Record<string, unknown>) => {
    setState(prev => {
      if (editingHumbugId) {
        // Update existing humbug
        return {
          ...prev,
          humbugs: prev.humbugs.map(humbug => 
            humbug.id === editingHumbugId 
              ? { ...humbug, ...humbugData, updatedAt: Date.now() } as Humbug
              : humbug
          ),
        };
      } else {
        // Create new humbug
        const maxZ = prev.humbugs.length > 0 ? Math.max(...prev.humbugs.map(h => h.zIndex)) : 99;
        
        const baseHumbug = {
          id: generateId(),
          position: modalState.position,
          rotation: 0,
          locked: false,
          zIndex: maxZ + 1,
          opacity: humbugData.opacity || 1.0,
          createdAt: Date.now(),
          updatedAt: Date.now(),
          type: modalState.type!,
          ...humbugData,
        };
        
        return {
          ...prev,
          humbugs: [...prev.humbugs, baseHumbug as Humbug],
          selectedHumbugId: baseHumbug.id,
        };
      }
    });

    // Close modal and reset editing state
    setModalState({
      isOpen: false,
      type: null,
      position: { x: 0, y: 0 },
    });
    setEditingHumbugId(null);
  }, [modalState.position, modalState.type, editingHumbugId]);

  // Toggle snap to grid
  const toggleSnapToGrid = useCallback(() => {
    setSnapToGridEnabled(prev => !prev);
  }, []);

  // Close modal
  const closeModal = useCallback(() => {
    setModalState({
      isOpen: false,
      type: null,
      position: { x: 0, y: 0 },
    });
    setEditingHumbugId(null);
  }, []);

  // Start dragging a humbug
  const startDragging = useCallback((id: string, offset: Point) => {
    setIsDragging(true);
    draggedHumbugRef.current = id;
    setDragOffset(offset);
    
    // Create drag tail if enabled
    if (showDragTails) {
      const humbug = state.humbugs.find(h => h.id === id);
      if (humbug) {
        const centerPoint = {
          x: humbug.position.x + (humbug.type === 'map-pin' ? 16 : ('size' in humbug ? humbug.size.width / 2 : 0)),
          y: humbug.position.y + (humbug.type === 'map-pin' ? 20 : ('size' in humbug ? humbug.size.height / 2 : 0))
        };
        
        setState(prev => ({
          ...prev,
          dragTail: {
            humbugId: id,
            startPoint: centerPoint,
            currentPoint: centerPoint,
            markers: [],
            distance: 0,
          },
        }));
      }
    }
  }, [showDragTails, state.humbugs]);

  // Select Humbug
  const selectHumbug = useCallback((id: string) => {
    setState(prev => ({
      ...prev,
      selectedHumbugId: id,
    }));
  }, []);

  // Move Humbug
  const moveHumbug = useCallback((id: string, newPosition: Point) => {
    const finalPosition = snapToGridEnabled ? snapToGrid(newPosition, 32) : newPosition;
    
    setState(prev => {
      const updatedHumbugs = prev.humbugs.map(humbug =>
        humbug.id === id
          ? { ...humbug, position: finalPosition, updatedAt: Date.now() }
          : humbug
      );

      // Update drag tail if dragging and enabled
      let updatedDragTail = prev.dragTail;
      if (prev.dragTail && prev.dragTail.humbugId === id && showDragTails) {
        const updatedHumbug = updatedHumbugs.find(h => h.id === id);
        if (updatedHumbug) {
          const centerPoint = {
            x: updatedHumbug.position.x + (updatedHumbug.type === 'map-pin' ? 16 : ('size' in updatedHumbug ? updatedHumbug.size.width / 2 : 0)),
            y: updatedHumbug.position.y + (updatedHumbug.type === 'map-pin' ? 20 : ('size' in updatedHumbug ? updatedHumbug.size.height / 2 : 0))
          };

          const distance = Math.sqrt(
            Math.pow(centerPoint.x - prev.dragTail.startPoint.x, 2) + 
            Math.pow(centerPoint.y - prev.dragTail.startPoint.y, 2)
          ) / 32; // Convert to grid units

          // Generate markers every grid unit along the path
          const markers: Point[] = [];
          const totalDistance = Math.sqrt(
            Math.pow(centerPoint.x - prev.dragTail.startPoint.x, 2) + 
            Math.pow(centerPoint.y - prev.dragTail.startPoint.y, 2)
          );
          
          if (totalDistance > 32) { // Only show markers if distance > 1 grid unit
            const stepCount = Math.floor(totalDistance / 32);
            for (let i = 1; i <= stepCount; i++) {
              const ratio = (i * 32) / totalDistance;
              markers.push({
                x: prev.dragTail.startPoint.x + (centerPoint.x - prev.dragTail.startPoint.x) * ratio,
                y: prev.dragTail.startPoint.y + (centerPoint.y - prev.dragTail.startPoint.y) * ratio,
              });
            }
          }

          updatedDragTail = {
            ...prev.dragTail,
            currentPoint: centerPoint,
            markers,
            distance,
          };
        }
      }

      return {
        ...prev,
        humbugs: updatedHumbugs,
        dragTail: updatedDragTail,
      };
    });
  }, [snapToGridEnabled, showDragTails]);

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

  // Resize Humbug
  const resizeHumbug = useCallback((id: string, newSize: { width: number; height: number }) => {
    setState(prev => ({
      ...prev,
      humbugs: prev.humbugs.map(humbug => {
        if (humbug.id !== id) return humbug;
        
        // Only resize humbugs that have a size property (not map-pin)
        if (humbug.type === 'map-pin') return humbug;
        
        return { ...humbug, size: newSize, updatedAt: Date.now() } as Humbug;
      }),
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

  // Edit Humbug - open modal with existing data
  const editHumbug = useCallback((id: string) => {
    const humbug = state.humbugs.find(h => h.id === id);
    if (!humbug) return;

    setModalState({
      isOpen: true,
      type: humbug.type,
      position: humbug.position,
    });

    // Store the ID of the humbug being edited
    setEditingHumbugId(id);
  }, [state.humbugs]);

  // Z-index management functions
  const bringToFront = useCallback((id: string) => {
    setState(prev => {
      const maxZ = Math.max(...prev.humbugs.map(h => h.zIndex));
      return {
        ...prev,
        humbugs: prev.humbugs.map(humbug =>
          humbug.id === id
            ? { ...humbug, zIndex: maxZ + 1, updatedAt: Date.now() }
            : humbug
        ),
      };
    });
  }, []);

  const sendToBack = useCallback((id: string) => {
    setState(prev => {
      const minZ = Math.min(...prev.humbugs.map(h => h.zIndex));
      return {
        ...prev,
        humbugs: prev.humbugs.map(humbug =>
          humbug.id === id
            ? { ...humbug, zIndex: minZ - 1, updatedAt: Date.now() }
            : humbug
        ),
      };
    });
  }, []);

  const bringForward = useCallback((id: string) => {
    setState(prev => {
      const currentHumbug = prev.humbugs.find(h => h.id === id);
      if (!currentHumbug) return prev;
      
      const higherZ = prev.humbugs
        .filter(h => h.zIndex > currentHumbug.zIndex)
        .sort((a, b) => a.zIndex - b.zIndex)[0];
      
      if (!higherZ) return prev;
      
      return {
        ...prev,
        humbugs: prev.humbugs.map(humbug => {
          if (humbug.id === id) {
            return { ...humbug, zIndex: higherZ.zIndex + 1, updatedAt: Date.now() };
          }
          return humbug;
        }),
      };
    });
  }, []);

  const sendBackward = useCallback((id: string) => {
    setState(prev => {
      const currentHumbug = prev.humbugs.find(h => h.id === id);
      if (!currentHumbug) return prev;
      
      const lowerZ = prev.humbugs
        .filter(h => h.zIndex < currentHumbug.zIndex)
        .sort((a, b) => b.zIndex - a.zIndex)[0];
      
      if (!lowerZ) return prev;
      
      return {
        ...prev,
        humbugs: prev.humbugs.map(humbug => {
          if (humbug.id === id) {
            return { ...humbug, zIndex: lowerZ.zIndex - 1, updatedAt: Date.now() };
          }
          return humbug;
        }),
      };
    });
  }, []);

  // Toggle lock state
  const toggleLock = useCallback((id: string) => {
    setState(prev => ({
      ...prev,
      humbugs: prev.humbugs.map(humbug =>
        humbug.id === id
          ? { ...humbug, locked: !humbug.locked, updatedAt: Date.now() }
          : humbug
      ),
    }));
  }, []);

  // Show humbug context menu
  const showHumbugContextMenu = useCallback((e: React.MouseEvent, humbugId: string) => {
    e.preventDefault();
    e.stopPropagation();
    
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;

    setState(prev => ({
      ...prev,
      humbugContextMenu: {
        isOpen: true,
        position: {
          x: e.clientX - rect.left,
          y: e.clientY - rect.top,
        },
        humbugId,
      },
      // Close regular context menu if open
      contextMenu: { isOpen: false, position: { x: 0, y: 0 } },
    }));
  }, [containerRef]);

  // Close humbug context menu
  const closeHumbugContextMenu = useCallback(() => {
    setState(prev => ({
      ...prev,
      humbugContextMenu: {
        isOpen: false,
        position: { x: 0, y: 0 },
        humbugId: null,
      },
    }));
  }, []);

  // Handle humbug context menu actions
  const handleHumbugContextAction = useCallback((action: string, humbugId: string) => {
    switch (action) {
      case 'edit':
        editHumbug(humbugId);
        break;
      case 'lock':
      case 'unlock':
        toggleLock(humbugId);
        break;
      case 'bringToFront':
        bringToFront(humbugId);
        break;
      case 'sendToBack':
        sendToBack(humbugId);
        break;
      case 'bringForward':
        bringForward(humbugId);
        break;
      case 'sendBackward':
        sendBackward(humbugId);
        break;
      case 'delete':
        deleteHumbug(humbugId);
        break;
    }
  }, [editHumbug, toggleLock, bringToFront, sendToBack, bringForward, sendBackward, deleteHumbug]);

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

      // Calculate the world position where the humbug should be placed
      // by subtracting the drag offset from the current mouse position
      const targetScreenX = e.clientX - dragOffset.x;
      const targetScreenY = e.clientY - dragOffset.y;
      const worldPos = screenToWorld(targetScreenX, targetScreenY);
      
      moveHumbug(draggedHumbugRef.current, worldPos);
    };

    const handleMouseUp = () => {
      if (isDragging) {
        setIsDragging(false);
        draggedHumbugRef.current = null;
        setDragOffset({ x: 0, y: 0 });
        
        // Clear drag tail
        setState(prev => ({
          ...prev,
          dragTail: null,
        }));
      }
    };

    // Add global event listeners for more reliable drag handling
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    
    // Also listen for mouse leave events to cancel dragging
    const handleMouseLeave = () => {
      if (isDragging) {
        setIsDragging(false);
        draggedHumbugRef.current = null;
        setDragOffset({ x: 0, y: 0 });
        
        // Clear drag tail
        setState(prev => ({
          ...prev,
          dragTail: null,
        }));
      }
    };
    
    document.addEventListener('mouseleave', handleMouseLeave);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.removeEventListener('mouseleave', handleMouseLeave);
    };
  }, [isDragging, containerRef, screenToWorld, moveHumbug, dragOffset]);

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

  // Export for PNG functionality
  const exportHumbugData = useCallback(() => {
    if (onExportRequest) {
      onExportRequest(state.humbugs, { x: 0, y: 0, zoom: 1 }); // viewport will be provided by InfiniteWhiteboard
    }
  }, [state.humbugs, onExportRequest]);

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

  // Import for PNG functionality
  const importHumbugData = useCallback((humbugs: Humbug[]) => {
    setState(prev => ({
      ...prev,
      humbugs,
      selectedHumbugId: null,
    }));
    if (onImportRequest) {
      onImportRequest(humbugs);
    }
  }, [onImportRequest]);

  // Expose export/import functions globally for the sidebar buttons and PNG export
  useEffect(() => {
    const windowGlobal = window as unknown as { 
      exportHumbugs?: () => void; 
      importHumbugs?: (data: string) => void;
      exportHumbugData?: () => void;
      importHumbugData?: (humbugs: Humbug[]) => void;
    };
    
    windowGlobal.exportHumbugs = exportHumbugs;
    windowGlobal.importHumbugs = importHumbugs;
    windowGlobal.exportHumbugData = exportHumbugData;
    windowGlobal.importHumbugData = importHumbugData;
    
    return () => {
      delete windowGlobal.exportHumbugs;
      delete windowGlobal.importHumbugs;
      delete windowGlobal.exportHumbugData;
      delete windowGlobal.importHumbugData;
    };
  }, [exportHumbugs, importHumbugs, exportHumbugData, importHumbugData]);

  // Undo/Redo functions
  const performUndo = useCallback(() => {
    const action = undoRedoManager.getUndoAction();
    if (!action) return;

    switch (action.type) {
      case 'CREATE_HUMBUG':
        setState(prev => ({
          ...prev,
          humbugs: prev.humbugs.filter(h => h.id !== action.humbug.id)
        }));
        break;
      
      case 'DELETE_HUMBUG':
        setState(prev => ({
          ...prev,
          humbugs: [...prev.humbugs, action.humbug]
        }));
        break;
        
      case 'MOVE_HUMBUG':
        setState(prev => ({
          ...prev,
          humbugs: prev.humbugs.map(h => 
            h.id === action.humbugId 
              ? { ...h, position: action.oldPosition }
              : h
          )
        }));
        break;
        
      case 'RESIZE_HUMBUG':
        setState(prev => ({
          ...prev,
          humbugs: prev.humbugs.map(h => 
            h.id === action.humbugId 
              ? { ...h, size: action.oldSize }
              : h
          )
        }));
        break;
        
      case 'ROTATE_HUMBUG':
        setState(prev => ({
          ...prev,
          humbugs: prev.humbugs.map(h => 
            h.id === action.humbugId 
              ? { ...h, rotation: action.oldRotation }
              : h
          )
        }));
        break;
        
      case 'EDIT_HUMBUG':
        setState(prev => ({
          ...prev,
          humbugs: prev.humbugs.map(h => 
            h.id === action.humbugId 
              ? action.oldHumbug
              : h
          )
        }));
        break;
    }
  }, [undoRedoManager]);

  const performRedo = useCallback(() => {
    const action = undoRedoManager.getRedoAction();
    if (!action) return;

    switch (action.type) {
      case 'CREATE_HUMBUG':
        setState(prev => ({
          ...prev,
          humbugs: [...prev.humbugs, action.humbug]
        }));
        break;
      
      case 'DELETE_HUMBUG':
        setState(prev => ({
          ...prev,
          humbugs: prev.humbugs.filter(h => h.id !== action.humbug.id)
        }));
        break;
        
      case 'MOVE_HUMBUG':
        setState(prev => ({
          ...prev,
          humbugs: prev.humbugs.map(h => 
            h.id === action.humbugId 
              ? { ...h, position: action.newPosition }
              : h
          )
        }));
        break;
        
      case 'RESIZE_HUMBUG':
        setState(prev => ({
          ...prev,
          humbugs: prev.humbugs.map(h => 
            h.id === action.humbugId 
              ? { ...h, size: action.newSize }
              : h
          )
        }));
        break;
        
      case 'ROTATE_HUMBUG':
        setState(prev => ({
          ...prev,
          humbugs: prev.humbugs.map(h => 
            h.id === action.humbugId 
              ? { ...h, rotation: action.newRotation }
              : h
          )
        }));
        break;
        
      case 'EDIT_HUMBUG':
        setState(prev => ({
          ...prev,
          humbugs: prev.humbugs.map(h => 
            h.id === action.humbugId 
              ? action.newHumbug
              : h
          )
        }));
        break;
    }
  }, [undoRedoManager]);

  // Copy/Cut/Paste functions
  const copySelectedHumbugs = useCallback(() => {
    const selectedHumbugs = state.selectedHumbugId 
      ? state.humbugs.filter(h => h.id === state.selectedHumbugId)
      : [];
    
    if (selectedHumbugs.length > 0) {
      clipboardManager.copy(selectedHumbugs);
    }
  }, [state.selectedHumbugId, state.humbugs, clipboardManager]);

  const cutSelectedHumbugs = useCallback(() => {
    const selectedHumbugs = state.selectedHumbugId 
      ? state.humbugs.filter(h => h.id === state.selectedHumbugId)
      : [];
    
    if (selectedHumbugs.length > 0) {
      clipboardManager.cut(selectedHumbugs);
      
      // Record deletion action for undo
      selectedHumbugs.forEach(humbug => {
        undoRedoManager.addAction({
          type: 'DELETE_HUMBUG',
          timestamp: Date.now(),
          humbug
        });
      });
      
      // Remove selected humbugs
      setState(prev => ({
        ...prev,
        humbugs: prev.humbugs.filter(h => h.id !== state.selectedHumbugId),
        selectedHumbugId: null
      }));
    }
  }, [state.selectedHumbugId, state.humbugs, clipboardManager, undoRedoManager]);

  const pasteHumbugs = useCallback(() => {
    const pastedHumbugs = clipboardManager.paste();
    
    if (pastedHumbugs.length > 0) {
      // Record creation actions for undo
      pastedHumbugs.forEach(humbug => {
        undoRedoManager.addAction({
          type: 'CREATE_HUMBUG',
          timestamp: Date.now(),
          humbug
        });
      });
      
      setState(prev => ({
        ...prev,
        humbugs: [...prev.humbugs, ...pastedHumbugs],
        selectedHumbugId: pastedHumbugs[0]?.id || null
      }));
    }
  }, [clipboardManager, undoRedoManager]);

  // Keyboard event handler
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Check if we're in an input field
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.contentEditable === 'true') {
        return;
      }

      const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
      const cmdKey = isMac ? e.metaKey : e.ctrlKey;

      if (cmdKey && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        performUndo();
      } else if (cmdKey && e.key === 'z' && e.shiftKey) {
        e.preventDefault();
        performRedo();
      } else if (cmdKey && e.key === 'c') {
        e.preventDefault();
        copySelectedHumbugs();
      } else if (cmdKey && e.key === 'x') {
        e.preventDefault();
        cutSelectedHumbugs();
      } else if (cmdKey && e.key === 'v') {
        e.preventDefault();
        pasteHumbugs();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [performUndo, performRedo, copySelectedHumbugs, cutSelectedHumbugs, pasteHumbugs]);

  return (
    <div
      style={{ 
        position: 'absolute', 
        top: 0,
        left: 0,
        width: '100%', 
        height: '100%',
        pointerEvents: state.contextMenu.isOpen ? 'auto' : 'none' // Enable pointer events when context menu is open
      }}
      onClick={(e) => {
        // Close context menu when clicking outside of it
        if (state.contextMenu.isOpen && e.target === e.currentTarget) {
          closeContextMenu();
        }
      }}
    >
      {/* Render all humbugs */}
      {state.humbugs.map((humbug) => (
        <HumbugRenderer
          key={humbug.id}
          humbug={humbug}
          isSelected={state.selectedHumbugId === humbug.id}
          onSelect={selectHumbug}
          onMove={moveHumbug}
          onRotate={rotateHumbug}
          onResize={resizeHumbug}
          onDelete={deleteHumbug}
          onEdit={editHumbug}
          onStartDrag={startDragging}
          scale={scale}
          worldToScreen={worldToScreen}
          onContextMenu={showHumbugContextMenu} // Add context menu handler
        />
      ))}

      {/* Render drag tail if active */}
      {state.dragTail && showDragTails && (
        <DragTailRenderer
          dragTail={state.dragTail}
          worldToScreen={worldToScreen}
        />
      )}

      {/* Context Menu - highest z-index for interaction */}
      {state.contextMenu.isOpen && (
        <ContextMenu
          position={state.contextMenu.position}
          isOpen={state.contextMenu.isOpen}
          onClose={closeContextMenu}
          onCreateHumbug={showHumbugModal}
          snapToGrid={snapToGridEnabled}
          onToggleSnapToGrid={toggleSnapToGrid}
        />
      )}

      {/* Humbug Modal */}
      {modalState.isOpen && modalState.type && (
        <HumbugModal
          isOpen={modalState.isOpen}
          type={modalState.type}
          position={modalState.position}
          existingHumbug={editingHumbugId ? state.humbugs.find(h => h.id === editingHumbugId) || null : null}
          onClose={closeModal}
          onCreate={createHumbugFromModal}
        />
      )}

      {/* Humbug Context Menu */}
      {state.humbugContextMenu.isOpen && state.humbugContextMenu.humbugId && (
        <HumbugContextMenu
          position={state.humbugContextMenu.position}
          isOpen={state.humbugContextMenu.isOpen}
          humbug={state.humbugs.find(h => h.id === state.humbugContextMenu.humbugId) || null}
          onClose={closeHumbugContextMenu}
          onAction={handleHumbugContextAction}
        />
      )}
    </div>
  );
};
