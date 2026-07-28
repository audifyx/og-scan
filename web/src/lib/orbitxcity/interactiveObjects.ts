/** 
 * Interactive objects system - doors, chests, buttons, terminals, and physics objects.
 * Includes state management and interaction callbacks.
 */

export type InteractiveObjectType =
  | 'door'
  | 'chest'
  | 'button'
  | 'switch'
  | 'terminal'
  | 'chair'
  | 'bench'
  | 'locker'
  | 'vending-machine'
  | 'neon-sign'
  | 'collectible';

export type InteractionType = 'use' | 'take' | 'examine' | 'unlock' | 'hack';

export interface InteractiveObject {
  id: string;
  type: InteractiveObjectType;
  name: string;
  description: string;

  // Physics
  position: { x: number; y: number; z: number };
  rotation: { x: number; y: number; z: number };
  size: { width: number; height: number; depth: number };
  physics: {
    isStatic: boolean;
    isTrigger: boolean;
    mass: number;
  };

  // State
  state: 'inactive' | 'active' | 'locked' | 'broken';
  interactionRequired: InteractionType;
  interactionRange: number;

  // Interactions
  actions: Array<{
    type: InteractionType;
    label: string;
    requiresItem?: string;
    callback?: (player: any) => void;
  }>;

  // Inventory (for chest/locker)
  inventory?: Array<{
    itemId: string;
    quantity: number;
  }>;

  // Animation state
  isAnimating: boolean;
  animationState?: string; // 'open', 'closed', 'activated', etc.
}

/**
 * Door - opens/closes, can be locked.
 */
export class DoorObject implements InteractiveObject {
  id: string;
  type: 'door' = 'door';
  name: string;
  description: string;
  position: { x: number; y: number; z: number };
  rotation: { x: number; y: number; z: number };
  size: { width: number; height: number; depth: number };
  physics = { isStatic: false, isTrigger: false, mass: 50 };
  state: 'inactive' | 'active' | 'locked' | 'broken' = 'inactive';
  interactionRequired: InteractionType = 'use';
  interactionRange: number = 3;
  isAnimating: boolean = false;
  animationState: 'open' | 'closed' = 'closed';
  isLocked: boolean = false;

  actions = [
    {
      type: 'use' as const,
      label: 'Open Door',
    },
  ];

  constructor(id: string, position: { x: number; y: number; z: number }) {
    this.id = id;
    this.name = 'Door';
    this.description = 'A sliding door';
    this.position = position;
    this.rotation = { x: 0, y: 0, z: 0 };
    this.size = { width: 1, height: 2.5, depth: 0.3 };
  }

  interact(type: InteractionType): boolean {
    if (type !== 'use') return false;
    if (this.isLocked) {
      console.log('[v0] Door is locked');
      return false;
    }

    this.toggleDoor();
    return true;
  }

  private toggleDoor() {
    this.isAnimating = true;
    this.animationState = this.animationState === 'open' ? 'closed' : 'open';

    // Animation would play here
    setTimeout(() => {
      this.isAnimating = false;
    }, 500);
  }

  unlock() {
    this.isLocked = false;
    this.state = 'active';
  }

  lock() {
    this.isLocked = true;
    this.state = 'locked';
  }
}

/**
 * Chest/Container - holds items, can be opened/closed.
 */
export class ChestObject implements InteractiveObject {
  id: string;
  type: 'chest' = 'chest';
  name: string;
  description: string;
  position: { x: number; y: number; z: number };
  rotation: { x: number; y: number; z: number };
  size = { width: 1, height: 1, depth: 0.8 };
  physics = { isStatic: true, isTrigger: false, mass: 0 };
  state: 'inactive' | 'active' | 'locked' | 'broken' = 'inactive';
  interactionRequired: InteractionType = 'use';
  interactionRange: number = 2;
  isAnimating: boolean = false;
  animationState: 'open' | 'closed' = 'closed';
  inventory: Array<{ itemId: string; quantity: number }> = [];
  isLocked: boolean = false;

  actions = [
    {
      type: 'use' as const,
      label: 'Open Chest',
    },
  ];

  constructor(
    id: string,
    position: { x: number; y: number; z: number },
    items: Array<{ itemId: string; quantity: number }> = []
  ) {
    this.id = id;
    this.name = 'Chest';
    this.description = 'A treasure chest';
    this.position = position;
    this.rotation = { x: 0, y: 0, z: 0 };
    this.inventory = items;
  }

  interact(type: InteractionType): boolean {
    if (type !== 'use') return false;
    if (this.isLocked) return false;

    this.toggleOpen();
    return true;
  }

  private toggleOpen() {
    this.animationState = this.animationState === 'open' ? 'closed' : 'open';
    this.state = 'active';
  }

  addItem(itemId: string, quantity: number = 1) {
    const existing = this.inventory.find((i) => i.itemId === itemId);
    if (existing) {
      existing.quantity += quantity;
    } else {
      this.inventory.push({ itemId, quantity });
    }
  }

  removeItem(itemId: string, quantity: number = 1): boolean {
    const item = this.inventory.find((i) => i.itemId === itemId);
    if (!item) return false;

    item.quantity -= quantity;
    if (item.quantity <= 0) {
      this.inventory = this.inventory.filter((i) => i.itemId !== itemId);
    }
    return true;
  }
}

/**
 * Terminal - interactive computer/console for hacking or data access.
 */
export class TerminalObject implements InteractiveObject {
  id: string;
  type: 'terminal' = 'terminal';
  name: string;
  description: string;
  position: { x: number; y: number; z: number };
  rotation: { x: number; y: number; z: number };
  size = { width: 1.5, height: 2, depth: 0.5 };
  physics = { isStatic: true, isTrigger: false, mass: 0 };
  state: 'inactive' | 'active' | 'locked' | 'broken' = 'inactive';
  interactionRequired: InteractionType = 'hack';
  interactionRange: number = 2;
  isAnimating: boolean = false;
  isHacked: boolean = false;
  data: Map<string, any> = new Map();

  actions = [
    {
      type: 'hack' as const,
      label: 'Hack Terminal',
    },
    {
      type: 'examine' as const,
      label: 'Examine',
    },
  ];

  constructor(id: string, position: { x: number; y: number; z: number }) {
    this.id = id;
    this.name = 'Terminal';
    this.description = 'A glowing terminal screen';
    this.position = position;
    this.rotation = { x: 0, y: 0, z: 0 };
  }

  interact(type: InteractionType): boolean {
    switch (type) {
      case 'hack':
        return this.hack();
      case 'examine':
        this.examine();
        return true;
      default:
        return false;
    }
  }

  private hack(): boolean {
    if (this.isHacked) {
      console.log('[v0] Terminal already hacked');
      return false;
    }

    // Simulate hack success/failure
    const success = Math.random() > 0.3;
    if (success) {
      this.isHacked = true;
      this.state = 'active';
      console.log('[v0] Terminal hacked successfully');
    } else {
      this.state = 'broken';
      console.log('[v0] Hack failed - terminal locked out');
    }
    return success;
  }

  private examine() {
    console.log(`[v0] Terminal: ${this.description}`);
    if (this.isHacked) {
      console.log('[v0] Data available: ', Array.from(this.data.keys()));
    }
  }

  setData(key: string, value: any) {
    this.data.set(key, value);
  }

  getData(key: string): any {
    if (!this.isHacked) return null;
    return this.data.get(key);
  }
}

/**
 * Collectible - items on ground to pick up.
 */
export class CollectibleObject implements InteractiveObject {
  id: string;
  type: 'collectible' = 'collectible';
  name: string;
  description: string;
  position: { x: number; y: number; z: number };
  rotation: { x: number; y: number; z: number };
  size = { width: 0.3, height: 0.3, depth: 0.3 };
  physics = { isStatic: false, isTrigger: true, mass: 0.1 };
  state: 'inactive' | 'active' | 'locked' | 'broken' = 'active';
  interactionRequired: InteractionType = 'take';
  interactionRange: number = 1.5;
  isAnimating: boolean = false;
  itemId: string;
  quantity: number = 1;
  rarity: 'common' | 'rare' | 'epic' | 'legendary' = 'common';

  actions = [
    {
      type: 'take' as const,
      label: 'Pick up',
    },
  ];

  constructor(
    id: string,
    itemId: string,
    position: { x: number; y: number; z: number },
    quantity: number = 1
  ) {
    this.id = id;
    this.itemId = itemId;
    this.quantity = quantity;
    this.position = position;
    this.rotation = { x: 0, y: 0, z: 0 };
    this.name = `Item: ${itemId}`;
    this.description = `A collectible item (${quantity}x)`;
  }

  interact(type: InteractionType): boolean {
    if (type !== 'take') return false;

    console.log(`[v0] Collected: ${this.name} (${this.quantity}x)`);
    return true;
  }
}

/**
 * Interactive Objects Manager.
 */
export class InteractiveObjectManager {
  private objects: Map<string, InteractiveObject> = new Map();

  addObject(obj: InteractiveObject) {
    this.objects.set(obj.id, obj);
  }

  getObject(id: string): InteractiveObject | undefined {
    return this.objects.get(id);
  }

  getNearby(pos: { x: number; y: number; z: number }, range: number): InteractiveObject[] {
    return Array.from(this.objects.values()).filter((obj) => {
      const dist = Math.hypot(obj.position.x - pos.x, obj.position.z - pos.z);
      return dist < range;
    });
  }

  interact(id: string, type: InteractionType): boolean {
    const obj = this.objects.get(id);
    if (!obj) return false;

    return obj.interact(type);
  }

  dispose() {
    this.objects.clear();
  }
}
