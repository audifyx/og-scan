/** 
 * World Events system - dynamic events, emergent gameplay, and world state changes.
 * Handles time-based events, location-based events, and player-triggered events.
 */

export type EventType =
  | 'weather'
  | 'npc-spawned'
  | 'npc-died'
  | 'npc-quest'
  | 'item-spawned'
  | 'location-changed'
  | 'time-changed'
  | 'danger-alert'
  | 'treasure-found'
  | 'combat-started'
  | 'custom';

export type EventSeverity = 'info' | 'warning' | 'danger' | 'critical';

export interface WorldEvent {
  id: string;
  type: EventType;
  severity: EventSeverity;
  title: string;
  description: string;
  timestamp: number;
  location?: { x: number; y: number; z: number };
  data?: Record<string, any>;
  resolved: boolean;
  duration?: number; // milliseconds, undefined = infinite until resolved
}

export interface EventTrigger {
  id: string;
  type: EventType;
  condition: (state: WorldState) => boolean;
  action: (state: WorldState) => WorldEvent;
  cooldown?: number; // milliseconds before can trigger again
  lastTriggered?: number;
  enabled: boolean;
}

/**
 * World state that events react to.
 */
export interface WorldState {
  currentTime: number; // Hours (0-24)
  dayCount: number;
  weather: 'clear' | 'cloudy' | 'rainy' | 'stormy';
  playerPosition: { x: number; y: number; z: number };
  npcCount: number;
  dangerLevel: number; // 0-100
  eventHistory: WorldEvent[];
}

/**
 * Event Manager - triggers and tracks world events.
 */
export class EventManager {
  private events: Map<string, WorldEvent> = new Map();
  private triggers: Map<string, EventTrigger> = new Map();
  private listeners: Map<EventType, Array<(event: WorldEvent) => void>> = new Map();
  private worldState: WorldState;
  private eventIdCounter: number = 0;

  constructor(initialState: WorldState) {
    this.worldState = initialState;
  }

  /**
   * Register an event trigger.
   */
  registerTrigger(trigger: EventTrigger) {
    this.triggers.set(trigger.id, trigger);
  }

  /**
   * Subscribe to event type.
   */
  subscribe(eventType: EventType, callback: (event: WorldEvent) => void) {
    if (!this.listeners.has(eventType)) {
      this.listeners.set(eventType, []);
    }
    this.listeners.get(eventType)!.push(callback);
  }

  /**
   * Dispatch an event.
   */
  dispatchEvent(event: Omit<WorldEvent, 'id' | 'timestamp' | 'resolved'>): WorldEvent {
    const fullEvent: WorldEvent = {
      id: `event-${this.eventIdCounter++}`,
      timestamp: Date.now(),
      resolved: false,
      ...event,
    };

    this.events.set(fullEvent.id, fullEvent);
    this.worldState.eventHistory.push(fullEvent);

    // Notify listeners
    const callbacks = this.listeners.get(event.type) || [];
    callbacks.forEach((cb) => cb(fullEvent));

    // Log event
    console.log(`[v0] Event: ${fullEvent.title} (${fullEvent.severity})`);

    return fullEvent;
  }

  /**
   * Update world state and check triggers.
   */
  update(deltaTime: number, newState: Partial<WorldState>) {
    // Update world state
    this.worldState = { ...this.worldState, ...newState };

    // Check all triggers
    this.triggers.forEach((trigger) => {
      if (!trigger.enabled) return;

      // Check cooldown
      if (trigger.lastTriggered) {
        const timeSinceLastTrigger = Date.now() - trigger.lastTriggered;
        if (timeSinceLastTrigger < (trigger.cooldown || 0)) {
          return;
        }
      }

      // Check condition
      if (trigger.condition(this.worldState)) {
        const event = trigger.action(this.worldState);
        this.dispatchEvent(event);
        trigger.lastTriggered = Date.now();
      }
    });

    // Update event durations
    this.events.forEach((event) => {
      if (event.duration && !event.resolved) {
        event.duration -= deltaTime;
        if (event.duration <= 0) {
          this.resolveEvent(event.id);
        }
      }
    });
  }

  /**
   * Mark event as resolved.
   */
  resolveEvent(eventId: string) {
    const event = this.events.get(eventId);
    if (event) {
      event.resolved = true;
      console.log(`[v0] Event resolved: ${event.title}`);
    }
  }

  /**
   * Get active events.
   */
  getActiveEvents(): WorldEvent[] {
    return Array.from(this.events.values()).filter((e) => !e.resolved);
  }

  /**
   * Get events by severity.
   */
  getEventsBySeverity(severity: EventSeverity): WorldEvent[] {
    return this.getActiveEvents().filter((e) => e.severity === severity);
  }

  /**
   * Get recent events.
   */
  getRecentEvents(count: number = 10): WorldEvent[] {
    return this.worldState.eventHistory.slice(-count);
  }

  getWorldState(): WorldState {
    return this.worldState;
  }

  dispose() {
    this.events.clear();
    this.triggers.clear();
    this.listeners.clear();
  }
}

/**
 * Predefined event triggers.
 */
export const DEFAULT_TRIGGERS: EventTrigger[] = [
  {
    id: 'midnight-strikes',
    type: 'time-changed',
    condition: (state) => Math.floor(state.currentTime) === 0,
    action: (state) => ({
      type: 'time-changed' as const,
      severity: 'info' as const,
      title: 'Midnight',
      description: 'The clock strikes midnight. A new day begins.',
      location: state.playerPosition,
    }),
    cooldown: 3600000, // Once per hour
    enabled: true,
  },

  {
    id: 'rainy-weather',
    type: 'weather',
    condition: (state) => state.weather === 'rainy',
    action: (state) => ({
      type: 'weather' as const,
      severity: 'info' as const,
      title: 'Rainy Weather',
      description: 'Rain falls on the city. Visibility reduced.',
      location: state.playerPosition,
      data: { weatherEffect: 'reduced-visibility' },
    }),
    cooldown: 300000, // Cooldown before re-triggering
    enabled: true,
  },

  {
    id: 'danger-zone',
    type: 'danger-alert',
    condition: (state) => state.dangerLevel > 70,
    action: (state) => ({
      type: 'danger-alert' as const,
      severity: 'critical' as const,
      title: 'Danger Zone Detected',
      description: `Danger level is critically high (${state.dangerLevel}/100)`,
      location: state.playerPosition,
      duration: 5000,
    }),
    cooldown: 10000,
    enabled: true,
  },

  {
    id: 'treasure-spawn',
    type: 'treasure-found',
    condition: (state) => Math.random() < 0.001 && state.eventHistory.length % 100 === 0,
    action: (state) => ({
      type: 'treasure-found' as const,
      severity: 'warning' as const,
      title: 'Treasure Nearby!',
      description: 'A glimmer of gold catches your eye nearby.',
      location: {
        x: state.playerPosition.x + (Math.random() - 0.5) * 50,
        y: state.playerPosition.y,
        z: state.playerPosition.z + (Math.random() - 0.5) * 50,
      },
      duration: 30000,
    }),
    cooldown: 60000,
    enabled: true,
  },

  {
    id: 'npc-spawned',
    type: 'npc-spawned',
    condition: (state) => state.npcCount < 20 && Math.random() < 0.0005,
    action: (state) => ({
      type: 'npc-spawned' as const,
      severity: 'info' as const,
      title: 'NPC Appeared',
      description: 'A new figure emerges from the crowd.',
      location: state.playerPosition,
    }),
    cooldown: 30000,
    enabled: true,
  },

  {
    id: 'combat-warning',
    type: 'combat-started',
    condition: (state) => state.dangerLevel > 50 && Math.random() < 0.0003,
    action: (state) => ({
      type: 'combat-started' as const,
      severity: 'danger' as const,
      title: 'Combat Engaged!',
      description: 'You are under attack!',
      location: state.playerPosition,
    }),
    cooldown: 30000,
    enabled: true,
  },
];

/**
 * Event display formatter for UI.
 */
export function formatEventForDisplay(event: WorldEvent): {
  title: string;
  message: string;
  color: string;
  icon: string;
} {
  const severityStyles = {
    info: { color: '#00d9ff', icon: 'info' },
    warning: { color: '#ffaa00', icon: 'alert' },
    danger: { color: '#ff0055', icon: 'danger' },
    critical: { color: '#ff0000', icon: 'critical' },
  };

  const style = severityStyles[event.severity];

  return {
    title: event.title,
    message: event.description,
    ...style,
  };
}
