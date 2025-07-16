import type { Humbug } from "./humbug.types"

export type ActionType =
    | "CREATE_HUMBUG"
    | "DELETE_HUMBUG"
    | "MOVE_HUMBUG"
    | "RESIZE_HUMBUG"
    | "ROTATE_HUMBUG"
    | "EDIT_HUMBUG"
    | "BATCH_ACTION"
    | "PAINT_SQUARE"
    | "ERASE_SQUARE"
    | "DUMP_FILL"
    | "CLEAR_BOARD"
    | "PAINT_STROKE"

export interface BaseAction {
    type: ActionType
    timestamp: number
}

export interface CreateHumbugAction extends BaseAction {
    type: "CREATE_HUMBUG"
    humbug: Humbug
}

export interface DeleteHumbugAction extends BaseAction {
    type: "DELETE_HUMBUG"
    humbug: Humbug
}

export interface MoveHumbugAction extends BaseAction {
    type: "MOVE_HUMBUG"
    humbugId: string
    oldPosition: { x: number; y: number }
    newPosition: { x: number; y: number }
}

export interface ResizeHumbugAction extends BaseAction {
    type: "RESIZE_HUMBUG"
    humbugId: string
    oldSize: { width: number; height: number } | number
    newSize: { width: number; height: number } | number
}

export interface RotateHumbugAction extends BaseAction {
    type: "ROTATE_HUMBUG"
    humbugId: string
    oldRotation: number
    newRotation: number
}

export interface EditHumbugAction extends BaseAction {
    type: "EDIT_HUMBUG"
    humbugId: string
    oldHumbug: Humbug
    newHumbug: Humbug
}

export interface BatchAction extends BaseAction {
    type: "BATCH_ACTION"
    actions: Action[]
}

export interface PaintSquareAction extends BaseAction {
    type: "PAINT_SQUARE"
    gridKey: string
    color: string
    previousColor?: string
}

export interface EraseSquareAction extends BaseAction {
    type: "ERASE_SQUARE"
    gridKey: string
    previousColor: string
}

export interface DumpFillAction extends BaseAction {
    type: "DUMP_FILL"
    color: string
    previousGrid: Map<string, string>
}

export interface ClearBoardAction extends BaseAction {
    type: "CLEAR_BOARD"
    previousGrid: Map<string, string>
    previousHumbugs?: Humbug[]
}

export interface PaintStrokeAction extends BaseAction {
    type: "PAINT_STROKE"
    changes: Map<string, { oldColor?: string; newColor?: string }>
}

export type Action =
    | CreateHumbugAction
    | DeleteHumbugAction
    | MoveHumbugAction
    | ResizeHumbugAction
    | RotateHumbugAction
    | EditHumbugAction
    | BatchAction
    | PaintSquareAction
    | EraseSquareAction
    | DumpFillAction
    | ClearBoardAction
    | PaintStrokeAction
