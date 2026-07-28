/** 
 * AAA-quality HUD (Heads-Up Display) component definitions and utilities.
 * Includes health bars, minimap, compass, objective markers, and status indicators.
 */

export interface HUDElement {
  id: string;
  type: 'bar' | 'compass' | 'minimap' | 'marker' | 'status' | 'objective';
  position: 'top-left' | 'top-center' | 'top-right' | 'bottom-left' | 'bottom-center' | 'bottom-right';
  visible: boolean;
  priority: number; // Higher = render on top
}

export interface HealthBar extends HUDElement {
  type: 'bar';
  current: number;
  max: number;
  label?: string;
  color?: string;
}

export interface Compass extends HUDElement {
  type: 'compass';
  rotation: number; // Degrees
  heading: string; // N, NE, E, etc.
  landmarks?: Array<{ angle: number; label: string }>;
}

export interface Minimap extends HUDElement {
  type: 'minimap';
  scale: number;
  playerX: number;
  playerY: number;
  rotation: number;
  markers?: Array<{ x: number; y: number; type: 'quest' | 'npc' | 'item' | 'portal' }>;
}

export interface ObjectiveMarker extends HUDElement {
  type: 'marker';
  text: string;
  worldPosition: { x: number; y: number; z: number };
  distance: number;
  icon?: string;
  color?: string;
}

export interface StatusIndicator extends HUDElement {
  type: 'status';
  label: string;
  value: string | number;
  icon?: string;
  alert?: boolean;
}

export interface ObjectiveTracker extends HUDElement {
  type: 'objective';
  objectives: Array<{
    id: string;
    title: string;
    description: string;
    progress: number; // 0-1
    completed: boolean;
  }>;
}

/**
 * HUD Manager - coordinates all HUD elements.
 */
export class HUDManager {
  private elements: Map<string, HUDElement> = new Map();
  private updateCallbacks: Map<string, (element: HUDElement) => void> = new Map();

  registerElement(element: HUDElement) {
    this.elements.set(element.id, element);
  }

  updateElement(id: string, updates: Partial<HUDElement>) {
    const element = this.elements.get(id);
    if (element) {
      const updated = { ...element, ...updates };
      this.elements.set(id, updated);

      // Trigger callback
      const callback = this.updateCallbacks.get(id);
      if (callback) {
        callback(updated);
      }
    }
  }

  subscribe(id: string, callback: (element: HUDElement) => void) {
    this.updateCallbacks.set(id, callback);
  }

  getElement<T extends HUDElement>(id: string): T | undefined {
    return this.elements.get(id) as T | undefined;
  }

  getElementsByPosition(position: string): HUDElement[] {
    return Array.from(this.elements.values())
      .filter((e) => e.position === position)
      .sort((a, b) => b.priority - a.priority);
  }

  getAllVisible(): HUDElement[] {
    return Array.from(this.elements.values()).filter((e) => e.visible);
  }

  dispose() {
    this.elements.clear();
    this.updateCallbacks.clear();
  }
}

/**
 * Predefined HUD layouts for different game modes.
 */
export const HUD_LAYOUTS = {
  exploration: [
    {
      id: 'health-bar',
      type: 'bar' as const,
      position: 'top-left' as const,
      visible: true,
      priority: 10,
    },
    {
      id: 'compass',
      type: 'compass' as const,
      position: 'top-center' as const,
      visible: true,
      priority: 8,
    },
    {
      id: 'minimap',
      type: 'minimap' as const,
      position: 'top-right' as const,
      visible: true,
      priority: 9,
    },
    {
      id: 'objective-tracker',
      type: 'objective' as const,
      position: 'left' as any,
      visible: true,
      priority: 7,
    },
  ],

  combat: [
    {
      id: 'health-bar',
      type: 'bar' as const,
      position: 'top-left' as const,
      visible: true,
      priority: 10,
    },
    {
      id: 'target-health',
      type: 'bar' as const,
      position: 'top-right' as const,
      visible: true,
      priority: 10,
    },
    {
      id: 'minimap',
      type: 'minimap' as const,
      position: 'bottom-right' as const,
      visible: true,
      priority: 8,
    },
  ],

  social: [
    {
      id: 'health-bar',
      type: 'bar' as const,
      position: 'top-left' as const,
      visible: true,
      priority: 5,
    },
    {
      id: 'nearby-players',
      type: 'status' as const,
      position: 'bottom-left' as const,
      visible: true,
      priority: 6,
    },
  ],
};

/**
 * HUD color scheme presets.
 */
export const HUD_COLOR_SCHEMES = {
  cyberpunk: {
    primary: '#00ff00',
    secondary: '#ffaa00',
    alert: '#ff0055',
    neutral: '#00d9ff',
  },
  scifi: {
    primary: '#0099ff',
    secondary: '#00ffff',
    alert: '#ff3333',
    neutral: '#aaaaaa',
  },
  retro: {
    primary: '#ffff00',
    secondary: '#ff8800',
    alert: '#ff0000',
    neutral: '#cccccc',
  },
};

/**
 * Convert world 3D position to screen 2D position for objective markers.
 */
export function worldToScreenPosition(
  worldPos: { x: number; y: number; z: number },
  cameraPos: { x: number; y: number; z: number },
  cameraRotation: { x: number; y: number; z: number },
  fov: number,
  screenWidth: number,
  screenHeight: number
): { x: number; y: number; onScreen: boolean } {
  // Simplified perspective projection
  const dx = worldPos.x - cameraPos.x;
  const dy = worldPos.y - cameraPos.y;
  const dz = worldPos.z - cameraPos.z;

  // Distance from camera
  const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);

  // Simple orthographic projection (would use proper camera matrix in production)
  const scale = fov / distance;
  const x = screenWidth / 2 + dx * scale;
  const y = screenHeight / 2 - dy * scale;

  // Check if on screen
  const onScreen = x > 0 && x < screenWidth && y > 0 && y < screenHeight && distance > 0.1;

  return { x, y, onScreen };
}

/**
 * Calculate cardinal direction from angle.
 */
export function getCardinalDirection(angle: number): string {
  const directions = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  const index = Math.round((angle % 360) / 45) % 8;
  return directions[index];
}

/**
 * Format distance for display.
 */
export function formatDistance(meters: number): string {
  if (meters < 1000) {
    return `${Math.round(meters)}m`;
  }
  return `${(meters / 1000).toFixed(1)}km`;
}

/**
 * Create health bar value for display (with color coding).
 */
export function getHealthBarColor(current: number, max: number): string {
  const percentage = current / max;

  if (percentage > 0.75) return '#00ff00'; // Green
  if (percentage > 0.5) return '#ffff00'; // Yellow
  if (percentage > 0.25) return '#ff8800'; // Orange
  return '#ff0000'; // Red
}
