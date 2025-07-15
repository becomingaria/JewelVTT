import type { Action } from '../types/action.types';

export class UndoRedoManager {
  private undoStack: Action[] = [];
  private redoStack: Action[] = [];
  private maxStackSize = 100;

  // Add an action to the undo stack
  addAction(action: Action) {
    this.undoStack.push(action);
    
    // Clear redo stack when new action is performed
    this.redoStack = [];
    
    // Limit stack size
    if (this.undoStack.length > this.maxStackSize) {
      this.undoStack.shift();
    }
  }

  // Check if undo is possible
  canUndo(): boolean {
    return this.undoStack.length > 0;
  }

  // Check if redo is possible
  canRedo(): boolean {
    return this.redoStack.length > 0;
  }

  // Get the last action for undo
  getUndoAction(): Action | null {
    if (this.undoStack.length === 0) return null;
    
    const action = this.undoStack.pop()!;
    this.redoStack.push(action);
    return action;
  }

  // Get the last action for redo
  getRedoAction(): Action | null {
    if (this.redoStack.length === 0) return null;
    
    const action = this.redoStack.pop()!;
    this.undoStack.push(action);
    return action;
  }

  // Clear all history
  clear() {
    this.undoStack = [];
    this.redoStack = [];
  }

  // Get current state info
  getState() {
    return {
      canUndo: this.canUndo(),
      canRedo: this.canRedo(),
      undoStackSize: this.undoStack.length,
      redoStackSize: this.redoStack.length
    };
  }
}
