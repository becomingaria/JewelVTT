// Core types for the Humbug system

export interface Point {
  x: number;
  y: number;
}

export interface Size {
  width: number;
  height: number;
}

export interface HumbugBase {
  id: string;
  type: HumbugType;
  position: Point;
  rotation: number; // in degrees
  locked: boolean;
  zIndex: number;
  createdAt: number;
  updatedAt: number;
}

export type HumbugType = 'text' | 'image' | 'map-pin' | 'solid-color';

export interface TextHumbug extends HumbugBase {
  type: 'text';
  content: string;
  fontSize: number;
  fontFamily: string;
  color: string;
  backgroundColor?: string;
  size: Size;
}

export interface ImageHumbug extends HumbugBase {
  type: 'image';
  imageUrl: string;
  size: Size;
  originalSize: Size;
}

export interface MapPinHumbug extends HumbugBase {
  type: 'map-pin';
  color: string;
  size: number;
  label?: string;
}

export interface SolidColorHumbug extends HumbugBase {
  type: 'solid-color';
  color: string;
  size: Size;
}

export type Humbug = TextHumbug | ImageHumbug | MapPinHumbug | SolidColorHumbug;

export interface ContextMenuOption {
  label: string;
  type: HumbugType;
  icon: string;
}

export interface DragTail {
  startPoint: Point;
  endPoint: Point;
  markers: Point[];
}

export interface HumbugState {
  humbugs: Humbug[];
  selectedHumbugId: string | null;
  dragTail: DragTail | null;
  contextMenu: {
    isOpen: boolean;
    position: Point;
  };
}
