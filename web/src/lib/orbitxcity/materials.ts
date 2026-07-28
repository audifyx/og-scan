/** 
 * PBR (Physically Based Rendering) material library for photorealistic buildings.
 * Uses metallic/roughness workflow with proper texture maps.
 */

import * as THREE from 'three';

export interface PBRTextureSet {
  albedo: string; // Color map
  normal: string; // Normal map for surface detail
  roughness: string; // Roughness map (grayscale)
  metallic: string; // Metallic map (grayscale)
  ao: string; // Ambient occlusion map
}

export interface MaterialConfig {
  albedo: THREE.Color | string;
  roughness: number; // 0-1
  metalness: number; // 0-1
  normalScale?: number;
  aoIntensity?: number;
  envMapIntensity?: number;
}

/**
 * Material presets for different building facades.
 * Each includes PBR parameters for photorealistic rendering.
 */
export const BUILDING_MATERIALS: Record<string, MaterialConfig> = {
  // Concrete/Modern
  concrete: {
    albedo: '#b8b8b8',
    roughness: 0.8,
    metalness: 0.0,
    normalScale: 0.5,
  },
  
  // Glass/Modern office
  glass_blue: {
    albedo: '#4a7ba7',
    roughness: 0.1,
    metalness: 0.3,
    normalScale: 0.2,
    envMapIntensity: 1.5,
  },

  // Red brick
  brick_red: {
    albedo: '#c23b22',
    roughness: 0.7,
    metalness: 0.0,
    normalScale: 0.8,
    aoIntensity: 0.8,
  },

  // Stone/Classic
  stone_beige: {
    albedo: '#d4c5b9',
    roughness: 0.6,
    metalness: 0.0,
    normalScale: 0.7,
    aoIntensity: 0.6,
  },

  // Metal/Industrial
  metal_steel: {
    albedo: '#8b8b8b',
    roughness: 0.4,
    metalness: 0.9,
    normalScale: 0.3,
    envMapIntensity: 2.0,
  },

  // Copper/Aged
  copper_aged: {
    albedo: '#6b4423',
    roughness: 0.5,
    metalness: 0.8,
    normalScale: 0.4,
    envMapIntensity: 1.8,
  },

  // Wood/Historic
  wood_dark: {
    albedo: '#3d2817',
    roughness: 0.8,
    metalness: 0.0,
    normalScale: 0.6,
    aoIntensity: 0.7,
  },
};

/**
 * Create a photorealistic PBR material.
 * Falls back to solid color if texture maps aren't available.
 */
export function createPBRMaterial(config: MaterialConfig): THREE.MeshStandardMaterial {
  const material = new THREE.MeshStandardMaterial({
    color: typeof config.albedo === 'string' ? new THREE.Color(config.albedo) : config.albedo,
    roughness: config.roughness,
    metalness: config.metalness,
    side: THREE.FrontSide,
    flatShading: false, // Smooth shading for photorealism
  });

  // Optional: Load texture maps when available
  if (config.normalScale !== undefined) {
    material.normalScale.set(config.normalScale, config.normalScale);
  }

  return material;
}

/**
 * Create material with advanced features like parallax and detail maps.
 */
export function createAdvancedPBRMaterial(
  config: MaterialConfig,
  textures?: PBRTextureSet
): THREE.MeshStandardMaterial {
  const base = createPBRMaterial(config);

  if (textures) {
    // Load and apply texture maps
    const textureLoader = new THREE.TextureLoader();

    // Load normal map
    textureLoader.load(textures.normal, (texture) => {
      base.normalMap = texture;
      base.normalScale.set(config.normalScale || 1, config.normalScale || 1);
    });

    // Load roughness map (stored in channel)
    textureLoader.load(textures.roughness, (texture) => {
      base.roughnessMap = texture;
    });

    // Load metallic map
    textureLoader.load(textures.metallic, (texture) => {
      base.metalnessMap = texture;
    });

    // Load AO map
    textureLoader.load(textures.ao, (texture) => {
      base.aoMap = texture;
      base.aoMapIntensity = config.aoIntensity || 1.0;
    });
  }

  return base;
}

/**
 * Create building facade material with procedural variation.
 * Adds slight color/roughness variation to prevent repetitive look.
 */
export function createVariedBuildingMaterial(
  baseMaterial: string,
  variation: number = 0.1
): THREE.MeshStandardMaterial {
  const config = BUILDING_MATERIALS[baseMaterial] || BUILDING_MATERIALS.concrete;
  
  // Add slight randomness to color
  const baseColor = new THREE.Color(config.albedo as string);
  const hsl = { h: 0, s: 0, l: 0 };
  baseColor.getHSL(hsl);
  
  hsl.l += (Math.random() - 0.5) * variation * 0.2;
  hsl.s *= 1 - variation * 0.1;
  
  const variedColor = new THREE.Color().setHSL(hsl.h, hsl.s, hsl.l);

  return createPBRMaterial({
    ...config,
    albedo: variedColor,
    roughness: config.roughness + (Math.random() - 0.5) * variation * 0.1,
  });
}

/**
 * Create street/pavement materials.
 */
export const STREET_MATERIALS = {
  asphalt: {
    albedo: '#2a2a2a',
    roughness: 0.9,
    metalness: 0.0,
  },
  concrete_sidewalk: {
    albedo: '#a0a0a0',
    roughness: 0.8,
    metalness: 0.0,
  },
  cobblestone: {
    albedo: '#7a7a7a',
    roughness: 0.85,
    metalness: 0.0,
    normalScale: 0.6,
  },
};

/**
 * Create window glass material with proper reflections.
 */
export function createGlassMaterial(
  tint: THREE.Color = new THREE.Color(0x4a7ba7),
  reflectivity: number = 0.7
): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    color: tint,
    metalness: reflectivity,
    roughness: 0.05,
    transparent: true,
    opacity: 0.7,
    envMapIntensity: 1.5,
    side: THREE.FrontSide,
  });
}

/**
 * Create roof material (shingles, tiles, metal).
 */
export function createRoofMaterial(
  type: 'shingle' | 'tile' | 'metal' = 'shingle'
): THREE.MeshStandardMaterial {
  const roofConfigs = {
    shingle: {
      albedo: '#3a3a3a',
      roughness: 0.8,
      metalness: 0.0,
    },
    tile: {
      albedo: '#c23b22',
      roughness: 0.6,
      metalness: 0.0,
    },
    metal: {
      albedo: '#8b7355',
      roughness: 0.4,
      metalness: 0.8,
    },
  };

  return createPBRMaterial(roofConfigs[type]);
}
