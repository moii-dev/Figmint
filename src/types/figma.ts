export type ShapeType =
  | 'frame'
  | 'rectangle'
  | 'ellipse'
  | 'triangle'
  | 'star'
  | 'text'
  | 'line';

export type ToolType =
  | 'select'
  | 'hand'
  | 'frame'
  | 'rectangle'
  | 'ellipse'
  | 'triangle'
  | 'star'
  | 'text'
  | 'line';

export type TransformHandle =
  | 'tl'
  | 't'
  | 'tr'
  | 'r'
  | 'br'
  | 'b'
  | 'bl'
  | 'l'
  | 'rotate'
  | 'radius';

export interface ShadowEffect {
  x: number;
  y: number;
  blur: number;
  spread: number;
  color: string;
  opacity: number;
}

export interface CanvasElement {
  id: string;
  name: string;
  type: ShapeType;
  x: number; // In local frame coordinates if parentId is set; in world coordinates if parentId is null
  y: number; // In local frame coordinates if parentId is set; in world coordinates if parentId is null
  width: number;
  height: number;
  rotation: number; // degrees
  fill: string;
  fillOpacity: number;
  stroke: string;
  strokeWidth: number;
  strokeOpacity: number;
  strokeStyle: 'solid' | 'dashed' | 'dotted';
  strokeAlign: 'inside' | 'center' | 'outside';
  cornerRadius: number;
  individualCorners?: boolean;
  cornerRadii?: [number, number, number, number]; // [tl, tr, br, bl]
  opacity: number;
  shadow?: ShadowEffect;
  visible: boolean;
  locked: boolean;
  parentId?: string | null; // Id of parent frame (null or undefined = root canvas)
  clipContent?: boolean; // For frames: clips children if true
  presetName?: string; // e.g., "iPhone 16 Pro"
  // Text specific
  textContent?: string;
  fontSize?: number;
  fontWeight?: string | number;
  fontFamily?: string;
  textAlign?: 'left' | 'center' | 'right';
  letterSpacing?: number;
  lineHeight?: number;
}

export interface FigmaProject {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  elements: CanvasElement[];
  zoom: number;
  pan: { x: number; y: number };
  thumbnailSvg?: string;
}

export interface DevicePreset {
  id: string;
  name: string;
  width: number;
  height: number;
  category: 'mobile' | 'desktop' | 'social';
  os?: 'ios' | 'android' | 'macos' | 'windows' | 'generic';
  icon?: string;
  aspect?: string;
}

export interface Point {
  x: number;
  y: number;
}

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface SnapGuide {
  type: 'x' | 'y';
  position: number;
  start: number;
  end: number;
}
