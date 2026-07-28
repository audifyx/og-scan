/** 
 * Advanced character customization and avatar creation system.
 * Includes body types, facial features, clothing, cosmetics, and home design.
 */

export interface CharacterAppearance {
  id: string;
  name: string;
  
  // Body
  bodyType: 'slim' | 'athletic' | 'muscular' | 'curvy';
  height: number; // 0.8 - 1.2 (scale factor)
  skinTone: string; // Color hex
  
  // Face
  faceShape: 'oval' | 'square' | 'round' | 'heart' | 'diamond';
  eyes: {
    shape: 'almond' | 'round' | 'hooded' | 'downturned';
    color: string;
  };
  nose: {
    shape: 'button' | 'aquiline' | 'bulbous' | 'snub';
    size: number; // 0-1
  };
  mouth: {
    shape: 'thin' | 'full' | 'heart';
    color: string;
  };
  
  // Hair
  hair: {
    style: string; // 'short', 'medium', 'long', 'curly', 'braids', 'undercut', etc.
    color: string;
    highlights?: string;
  };
  
  // Clothing
  outfit: {
    top: string;
    bottom: string;
    feet: string;
    accent?: string;
  };
  
  // Accessories
  accessories: {
    glasses?: string;
    hat?: string;
    jewelry: string[];
  };
  
  // Cosmetics
  cosmetics: {
    makeup: boolean;
    lipstick?: string;
    eyeshadow?: string;
    tattoos: Array<{ location: string; design: string }>;
    scars: Array<{ location: string; type: string }>;
  };
  
  // Metadata
  createdAt: number;
  totalPlayTime: number;
}

/**
 * Home/apartment customization.
 */
export interface HomeDesign {
  id: string;
  ownerId: string;
  
  // Layout
  roomCount: number; // 1-6
  layout: 'studio' | 'apartment' | 'penthouse' | 'mansion';
  
  // Theme
  style: 'minimalist' | 'luxury' | 'cyberpunk' | 'retro' | 'nature' | 'industrial';
  colorScheme: string[]; // Primary, secondary, accent colors
  
  // Furniture
  furniture: Array<{
    id: string;
    type: 'sofa' | 'bed' | 'desk' | 'table' | 'chair' | 'shelf' | 'plant' | 'art';
    model: string;
    position: { x: number; y: number; z: number };
    rotation: number;
    customization?: {
      color?: string;
      material?: string;
    };
  }>;
  
  // Wall/Floor
  walls: {
    type: 'paint' | 'wallpaper' | 'panel';
    color?: string;
    texture?: string;
  };
  floor: {
    type: 'wood' | 'tile' | 'carpet' | 'concrete' | 'marble';
    color?: string;
    texture?: string;
  };
  
  // Lighting
  lighting: {
    ambientBrightness: number; // 0-1
    lamps: Array<{
      position: { x: number; y: number; z: number };
      color: string;
      intensity: number;
    }>;
  };
  
  // Decor
  decor: {
    posters: Array<{ position: { x: number; y: number }; image: string }>;
    plants: Array<{ position: { x: number; y: number; z: number }; type: string }>;
    collectibles: Array<{ id: string; display: boolean }>;
  };
  
  // Upgrades
  upgrades: {
    balcony: boolean;
    gym: boolean;
    studio: boolean;
    garden: boolean;
    pool: boolean;
  };
  
  updatedAt: number;
}

/**
 * Predefined character presets.
 */
export const CHARACTER_PRESETS = {
  cyberPunk: {
    bodyType: 'athletic' as const,
    skinTone: '#a0a0a0', // Silver-ish
    faceShape: 'square' as const,
    eyes: { shape: 'hooded' as const, color: '#00ff00' },
    hair: {
      style: 'undercut',
      color: '#ff00ff',
      highlights: '#00ffff',
    },
    outfit: {
      top: 'tech-jacket',
      bottom: 'cargo-pants',
      feet: 'hover-boots',
    },
  },

  retro: {
    bodyType: 'slim' as const,
    skinTone: '#ffd9b0',
    faceShape: 'round' as const,
    eyes: { shape: 'round' as const, color: '#4169e1' },
    hair: {
      style: 'short',
      color: '#ff6b9d',
    },
    outfit: {
      top: 'vintage-tee',
      bottom: 'bell-bottoms',
      feet: 'platform-shoes',
    },
  },

  minimal: {
    bodyType: 'athletic' as const,
    skinTone: '#e8b699',
    faceShape: 'oval' as const,
    eyes: { shape: 'almond' as const, color: '#8b7355' },
    hair: {
      style: 'long',
      color: '#3d2817',
    },
    outfit: {
      top: 'white-shirt',
      bottom: 'black-pants',
      feet: 'leather-shoes',
    },
  },

  luxe: {
    bodyType: 'curvy' as const,
    skinTone: '#f5c89a',
    faceShape: 'heart' as const,
    eyes: { shape: 'almond' as const, color: '#d4af37' },
    hair: {
      style: 'long',
      color: '#c5a26f',
      highlights: '#d4af37',
    },
    outfit: {
      top: 'silk-dress',
      bottom: 'designer-pants',
      feet: 'heels',
      accent: 'fur-stole',
    },
    accessories: {
      jewelry: ['diamond-necklace', 'gold-earrings'],
    },
  },
};

/**
 * Home design presets.
 */
export const HOME_PRESETS = {
  minimalist: {
    roomCount: 2,
    layout: 'apartment' as const,
    style: 'minimalist' as const,
    colorScheme: ['#ffffff', '#000000', '#cccccc'],
    walls: { type: 'paint' as const, color: '#f5f5f5' },
    floor: { type: 'concrete' as const, color: '#e0e0e0' },
  },

  luxury: {
    roomCount: 4,
    layout: 'penthouse' as const,
    style: 'luxury' as const,
    colorScheme: ['#d4af37', '#1a1a1a', '#ffffff'],
    walls: { type: 'panel' as const, texture: 'marble' },
    floor: { type: 'marble' as const, color: '#f0f0f0' },
  },

  cyberpunk: {
    roomCount: 2,
    layout: 'apartment' as const,
    style: 'cyberpunk' as const,
    colorScheme: ['#00ff00', '#ff00ff', '#000000'],
    walls: { type: 'panel' as const, texture: 'metal' },
    floor: { type: 'tile' as const, color: '#1a1a1a' },
  },

  nature: {
    roomCount: 3,
    layout: 'apartment' as const,
    style: 'nature' as const,
    colorScheme: ['#2d5016', '#8b7355', '#ffffff'],
    walls: { type: 'wallpaper' as const, texture: 'wood' },
    floor: { type: 'wood' as const, color: '#8b6914' },
  },
};

/**
 * Cosmetics store inventory.
 */
export const COSMETICS_SHOP = {
  hairstyles: [
    { id: 'short', name: 'Short Cut', price: 100 },
    { id: 'long', name: 'Long Waves', price: 150 },
    { id: 'curly', name: 'Curls', price: 120 },
    { id: 'braids', name: 'Braids', price: 180 },
    { id: 'undercut', name: 'Undercut', price: 200 },
    { id: 'mohawk', name: 'Mohawk', price: 250 },
  ],

  hairColors: [
    { id: 'black', name: 'Jet Black', price: 50 },
    { id: 'brown', name: 'Chestnut Brown', price: 50 },
    { id: 'blonde', name: 'Golden Blonde', price: 75 },
    { id: 'red', name: 'Crimson Red', price: 100 },
    { id: 'purple', name: 'Neon Purple', price: 150 },
    { id: 'cyan', name: 'Holographic Cyan', price: 200 },
  ],

  outfits: [
    { id: 'casual', name: 'Casual Wear', price: 300 },
    { id: 'formal', name: 'Formal Wear', price: 500 },
    { id: 'tech', name: 'Tech Jacket Suit', price: 750 },
    { id: 'streetwear', name: 'Streetwear', price: 400 },
    { id: 'vintage', name: 'Vintage Fashion', price: 350 },
  ],

  accessories: [
    { id: 'sunglasses', name: 'Sunglasses', price: 200 },
    { id: 'neural-crown', name: 'Neural Crown', price: 1000 },
    { id: 'holo-watch', name: 'Holographic Watch', price: 800 },
    { id: 'neon-chain', name: 'Neon Chain', price: 600 },
  ],

  tattoos: [
    { id: 'circuit', name: 'Circuit Board', price: 500, location: 'arm' },
    { id: 'dragon', name: 'Dragon', price: 700, location: 'back' },
    { id: 'galaxy', name: 'Galaxy', price: 600, location: 'chest' },
    { id: 'neon-lines', name: 'Neon Lines', price: 800, location: 'face' },
  ],
};

/**
 * Home upgrade costs.
 */
export const HOME_UPGRADES = {
  balcony: { price: 5000, description: 'Add outdoor balcony with city view' },
  gym: { price: 8000, description: 'Fitness equipment and training space' },
  studio: { price: 10000, description: 'Creative workspace for artists/musicians' },
  garden: { price: 6000, description: 'Indoor/outdoor garden with plants' },
  pool: { price: 15000, description: 'Luxury swimming pool' },
};
