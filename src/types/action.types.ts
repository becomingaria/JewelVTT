import type { Humbug } from "./humbug.types"

export type ActionType =
    | "CREATE_HUMBUG"
    | "DELETE_HUMBUG"
    | "MOVE_HUMBUG"
    | "RESIZE_HUMBUG"
    | "ROTATE_HUMBUG"
    | "EDIT_HUMBUG"
    | "BATCH_ACTION"

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

export type Action =
    | CreateHumbugAction
    | DeleteHumbugAction
    | MoveHumbugAction
    | ResizeHumbugAction
    | RotateHumbugAction
    | EditHumbugAction
    | BatchAction
