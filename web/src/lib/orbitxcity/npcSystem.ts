/** 
 * NPC (Non-Player Character) system with dialogue, quests, and AI behaviors.
 * Includes state machines, dialogue trees, and scheduling.
 */

export type NPCRole = 'merchant' | 'quest-giver' | 'companion' | 'vendor' | 'trainer' | 'guard';
export type NPCBehavior = 'patrol' | 'idle' | 'interact' | 'combat' | 'flee';
export type DialogueType = 'greeting' | 'quest' | 'trade' | 'casual' | 'gossip';

export interface NPCAppearance {
  model: string; // 3D model ID
  outfit: string;
  accessories: string[];
  name: string;
  title: string; // e.g., "Merchant", "Quest Master"
  nameTag: boolean;
}

export interface DialogueOption {
  id: string;
  text: string;
  nextId?: string; // Next dialogue node ID
  action?: 'quest' | 'trade' | 'fight' | 'follow';
  requiresQuest?: string;
}

export interface DialogueNode {
  id: string;
  type: DialogueType;
  speaker: string; // NPC name or "PLAYER"
  text: string;
  options: DialogueOption[];
  audioKey?: string; // For voice lines
}

export interface NPCQuest {
  id: string;
  title: string;
  description: string;
  objectives: Array<{
    id: string;
    description: string;
    type: 'kill' | 'collect' | 'deliver' | 'escort' | 'talk';
    target?: string;
    count?: number;
    progress: number;
  }>;
  rewards: {
    xp: number;
    currency: number;
    items?: string[];
  };
  completed: boolean;
}

export interface NPCState {
  id: string;
  appearance: NPCAppearance;
  role: NPCRole;
  position: { x: number; y: number; z: number };
  rotation: number;
  
  // Behavior
  currentBehavior: NPCBehavior;
  patrolPath?: Array<{ x: number; y: number; z: number }>;
  patrolIndex: number;
  
  // Dialogue
  currentDialogue?: DialogueNode;
  knownPlayer: boolean;
  relationship: number; // -100 to 100 (hostile to friendly)
  
  // Quests
  quests: NPCQuest[];
  availableQuests: string[]; // Quest IDs available
  
  // Schedule
  schedule: Array<{
    time: number; // Hour (0-24)
    action: 'work' | 'rest' | 'socialize' | 'patrol';
    location?: { x: number; y: number; z: number };
  }>;
  currentTime: number;
  
  // AI state
  alert: boolean;
  targetPlayer: boolean;
  health: number;
  maxHealth: number;
}

/**
 * NPC class with behavior AI and dialogue system.
 */
export class NPC {
  state: NPCState;
  private dialogueTree: Map<string, DialogueNode> = new Map();
  private behaviourTimer: number = 0;
  private dialogueState: { currentNodeId?: string; response?: string } = {};

  constructor(state: NPCState, dialogueNodes: DialogueNode[] = []) {
    this.state = state;

    // Build dialogue tree
    dialogueNodes.forEach((node) => {
      this.dialogueTree.set(node.id, node);
    });
  }

  /**
   * Update NPC each frame.
   */
  update(deltaTime: number, playerPos: { x: number; y: number; z: number }, time: number) {
    this.state.currentTime = time % 24; // Simulate 24h cycle

    // Update behavior based on schedule
    this.updateSchedule();

    // Behavior logic
    this.updateBehavior(deltaTime, playerPos);

    // Detection - notice player within range
    this.detectPlayer(playerPos);
  }

  private updateSchedule() {
    const hour = this.state.currentTime;
    const scheduleItem = this.state.schedule.find((s) => s.time === Math.floor(hour));

    if (scheduleItem) {
      switch (scheduleItem.action) {
        case 'work':
          this.state.currentBehavior = 'idle';
          break;
        case 'rest':
          this.state.currentBehavior = 'idle';
          break;
        case 'socialize':
          this.state.currentBehavior = 'idle';
          break;
        case 'patrol':
          this.state.currentBehavior = 'patrol';
          break;
      }
    }
  }

  private updateBehavior(deltaTime: number, playerPos: { x: number; y: number; z: number }) {
    this.behaviourTimer += deltaTime;

    switch (this.state.currentBehavior) {
      case 'patrol':
        this.updatePatrol();
        break;

      case 'idle':
        // Occasional look around animation
        if (this.behaviourTimer > 3) {
          this.state.rotation += (Math.random() - 0.5) * 0.5;
          this.behaviourTimer = 0;
        }
        break;

      case 'interact':
        // Look at player
        const dx = playerPos.x - this.state.position.x;
        const dz = playerPos.z - this.state.position.z;
        this.state.rotation = Math.atan2(dx, dz);
        break;

      case 'combat':
        // Move toward player
        const distance = Math.hypot(
          playerPos.x - this.state.position.x,
          playerPos.z - this.state.position.z
        );
        if (distance > 2) {
          const speed = 0.05;
          this.state.position.x += ((dx / distance) * speed);
          this.state.position.z += (((playerPos.z - this.state.position.z) / distance) * speed);
        }
        break;
    }
  }

  private updatePatrol() {
    if (!this.state.patrolPath || this.state.patrolPath.length === 0) return;

    const currentWaypoint = this.state.patrolPath[this.state.patrolIndex];
    const dx = currentWaypoint.x - this.state.position.x;
    const dz = currentWaypoint.z - this.state.position.z;
    const distance = Math.hypot(dx, dz);

    // Move toward waypoint
    if (distance > 0.5) {
      const speed = 0.03;
      this.state.position.x += (dx / distance) * speed;
      this.state.position.z += (dz / distance) * speed;
      this.state.rotation = Math.atan2(dx, dz);
    } else {
      // Reached waypoint, move to next
      this.state.patrolIndex = (this.state.patrolIndex + 1) % this.state.patrolPath.length;
    }
  }

  private detectPlayer(playerPos: { x: number; y: number; z: number }) {
    const distance = Math.hypot(
      playerPos.x - this.state.position.x,
      playerPos.z - this.state.position.z
    );

    const detectionRange = this.state.alert ? 50 : 30;

    if (distance < detectionRange) {
      this.state.currentBehavior = 'interact';
      this.state.knownPlayer = true;
    } else {
      if (this.state.knownPlayer && distance > detectionRange + 20) {
        this.state.knownPlayer = false;
        this.state.currentBehavior = 'patrol';
      }
    }
  }

  /**
   * Start dialogue with player.
   */
  startDialogue(firstNodeId: string): DialogueNode | null {
    const node = this.dialogueTree.get(firstNodeId);
    if (node) {
      this.dialogueState.currentNodeId = firstNodeId;
      return node;
    }
    return null;
  }

  /**
   * Get current dialogue node.
   */
  getCurrentDialogue(): DialogueNode | null {
    if (!this.dialogueState.currentNodeId) return null;
    return this.dialogueTree.get(this.dialogueState.currentNodeId) || null;
  }

  /**
   * Select dialogue option.
   */
  selectOption(optionId: string): DialogueNode | null {
    const current = this.getCurrentDialogue();
    if (!current) return null;

    const option = current.options.find((o) => o.id === optionId);
    if (!option) return null;

    // Handle action
    if (option.action) {
      this.handleDialogueAction(option.action);
    }

    // Move to next node
    if (option.nextId) {
      return this.startDialogue(option.nextId);
    }

    return null;
  }

  private handleDialogueAction(action: string) {
    switch (action) {
      case 'quest':
        // Trigger quest acceptance
        break;
      case 'trade':
        // Open trade UI
        break;
      case 'fight':
        this.state.currentBehavior = 'combat';
        this.state.alert = true;
        break;
      case 'follow':
        this.state.currentBehavior = 'interact';
        break;
    }
  }

  /**
   * Update NPC health and handle death.
   */
  takeDamage(amount: number): boolean {
    this.state.health -= amount;
    this.state.alert = true;
    this.state.currentBehavior = 'combat';

    return this.state.health <= 0;
  }

  /**
   * Get NPC status string for debugging.
   */
  getStatus(): string {
    return `${this.state.appearance.name} - ${this.state.currentBehavior} - Health: ${this.state.health}/${this.state.maxHealth}`;
  }
}

/**
 * NPC Manager - spawns and updates all NPCs.
 */
export class NPCManager {
  private npcs: Map<string, NPC> = new Map();

  addNPC(npc: NPC) {
    this.npcs.set(npc.state.id, npc);
  }

  getNPC(id: string): NPC | undefined {
    return this.npcs.get(id);
  }

  getNearby(pos: { x: number; y: number; z: number }, range: number): NPC[] {
    return Array.from(this.npcs.values()).filter((npc) => {
      const dist = Math.hypot(
        npc.state.position.x - pos.x,
        npc.state.position.z - pos.z
      );
      return dist < range;
    });
  }

  updateAll(deltaTime: number, playerPos: { x: number; y: number; z: number }, time: number) {
    this.npcs.forEach((npc) => {
      npc.update(deltaTime, playerPos, time);
    });
  }

  dispose() {
    this.npcs.clear();
  }
}

/**
 * Sample NPC templates.
 */
export const NPC_TEMPLATES = {
  merchant: {
    appearance: {
      model: 'character_merchant_01',
      outfit: 'merchant_vest',
      name: 'Zed',
      title: 'Merchant',
      nameTag: true,
    },
    role: 'merchant' as const,
    maxHealth: 100,
  },

  questGiver: {
    appearance: {
      model: 'character_elder_01',
      outfit: 'noble_robes',
      name: 'Cipher',
      title: 'Quest Master',
      nameTag: true,
    },
    role: 'quest-giver' as const,
    maxHealth: 150,
  },

  guard: {
    appearance: {
      model: 'character_soldier_01',
      outfit: 'armor',
      accessories: ['rifle'],
      name: 'Nexus',
      title: 'Guard',
      nameTag: true,
    },
    role: 'guard' as const,
    maxHealth: 200,
  },
};
