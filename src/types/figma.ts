export type ShapeType =
  | 'frame'
  | 'rectangle'
  | 'ellipse'
  | 'triangle'
  | 'polygon'
  | 'diamond'
  | 'star'
  | 'text'
  | 'line'
  | 'arrow'
  | 'image'
  | 'video'
  | 'vector'
  | 'boolean'
  | 'component'
  | 'instance';

export type ToolType =
  | 'select'
  | 'hand'
  | 'frame'
  | 'rectangle'
  | 'ellipse'
  | 'triangle'
  | 'polygon'
  | 'diamond'
  | 'star'
  | 'text'
  | 'line'
  | 'arrow'
  | 'pen'
  | 'node';

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

export interface GradientStop {
  color: string;
  position: number;
  opacity: number;
  visible?: boolean;
}

export interface LinearGradientFill {
  id: string;
  type: 'linear';
  angle: number;
  opacity: number;
  visible: boolean;
  stops: GradientStop[];
}

export type PrototypeAction = 'navigate-to' | 'back' | 'open-overlay' | 'close-overlay';
export type PrototypeTransition = 'instant' | 'dissolve' | 'move' | 'push' | 'smart-animate';
export type PrototypeDirection = 'left' | 'right' | 'up' | 'down';
export type PrototypeEasing = 'linear' | 'ease-in' | 'ease-out' | 'ease-in-out';
export type PrototypeConnectionSide = 'top' | 'right' | 'bottom' | 'left';

export interface PrototypeInteraction {
  id: string;
  trigger: 'click';
  action: PrototypeAction;
  destinationFrameId?: string;
  destinationElementId?: string;
  sourceAnchor?: PrototypeConnectionSide;
  destinationAnchor?: PrototypeConnectionSide;
  transition: PrototypeTransition;
  direction: PrototypeDirection;
  easing: PrototypeEasing;
  durationMs: number;
}

export interface ImageFill {
  assetId: string;
  src: string;
  mimeType?: string;
  name?: string;
  mode: 'fill' | 'fit' | 'crop' | 'tile';
  offsetX: number;
  offsetY: number;
  scale: number;
  rotation: number;
  tileScale: number;
}

export interface VectorPoint {
  x: number;
  y: number;
  handleIn?: Point;
  handleOut?: Point;
}

export type LayoutMode = 'none' | 'horizontal' | 'vertical';
export type LayoutSizing = 'fixed' | 'hug' | 'fill';
export type LayoutAlign = 'start' | 'center' | 'end' | 'space-between';
export type LayoutCounterAlign = 'start' | 'center' | 'end' | 'stretch';

export interface LayoutPadding {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export interface InstanceOverride {
  textContent?: string;
  fill?: string;
  fillOpacity?: number;
  visible?: boolean;
}

export type DesignTokenCategory = 'color' | 'spacing' | 'radius';

export interface DesignToken {
  id: string;
  name: string;
  category: DesignTokenCategory;
  value: string | number;
}

export type TokenBindableProperty = 'fill' | 'stroke' | 'cornerRadius' | 'layoutGap';
export type ElementTokenBindings = Partial<Record<TokenBindableProperty, string>>;

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
  gradients?: LinearGradientFill[];
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
  // Media specific
  mediaSrc?: string;
  mediaMimeType?: string;
  mediaName?: string;
  objectFit?: 'cover' | 'contain' | 'fill';
  imageFill?: ImageFill;
  // Prototype specific
  interactions?: PrototypeInteraction[];
  prototypeFlowStart?: boolean;
  // Vector, mask, and non-destructive boolean metadata
  vectorPath?: VectorPoint[];
  vectorClosed?: boolean;
  maskId?: string;
  booleanOperation?: 'union' | 'subtract' | 'intersect' | 'exclude';
  booleanSourceIds?: string[];
  // Component and instance metadata
  mainComponentId?: string;
  sourceElementId?: string;
  instanceOverrides?: Record<string, InstanceOverride>;
  // Auto Layout container properties
  layoutMode?: LayoutMode;
  layoutGap?: number;
  layoutPadding?: LayoutPadding;
  layoutPrimaryAlign?: LayoutAlign;
  layoutCounterAlign?: LayoutCounterAlign;
  layoutSizingHorizontal?: LayoutSizing;
  layoutSizingVertical?: LayoutSizing;
  // Auto Layout child properties
  layoutPositioning?: 'auto' | 'absolute';
  layoutGrow?: 0 | 1;
  // Design token bindings
  tokenBindings?: ElementTokenBindings;
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
  tokens?: DesignToken[];
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
