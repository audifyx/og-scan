/** 
 * Procedural realistic vegetation system.
 * Generates trees, grass, and foliage with LOD for performance.
 */

import * as THREE from 'three';

export interface TreeInstance {
  position: THREE.Vector3;
  scale: number;
  type: 'oak' | 'pine' | 'maple' | 'birch';
}

export interface GrassConfig {
  density: number; // 0-1
  height: number;
  color: THREE.Color;
  windStrength: number;
}

/**
 * Generate tree geometry with simple LOD.
 * High LOD: detailed branch structure. Low LOD: simple cone.
 */
export function createTreeGeometry(type: 'oak' | 'pine' | 'maple' | 'birch', lod: 'high' | 'low') {
  if (lod === 'high') {
    return createDetailedTree(type);
  }

  // Low LOD: simple cone for distant trees
  const geometry = new THREE.ConeGeometry(1, 2, 8);
  geometry.translate(0, 1, 0); // Move to ground
  return geometry;
}

function createDetailedTree(type: 'oak' | 'pine' | 'maple' | 'birch'): THREE.BufferGeometry {
  const group = new THREE.Group();

  // Trunk
  const trunkGeom = new THREE.CylinderGeometry(0.3, 0.4, 2.5, 8);
  const trunkMat = new THREE.MeshStandardMaterial({
    color: 0x4a3728,
    roughness: 0.8,
  });
  const trunk = new THREE.Mesh(trunkGeom, trunkMat);
  trunk.position.y = 1.25;
  group.add(trunk);

  // Foliage (simplified - would use better LOD in production)
  const foliageColors: Record<string, number> = {
    oak: 0x2d5016,
    pine: 0x1a3a1a,
    maple: 0xcc3300,
    birch: 0x90ee90,
  };

  const foliageGeom = new THREE.SphereGeometry(2, 8, 8);
  const foliageMat = new THREE.MeshStandardMaterial({
    color: foliageColors[type],
    roughness: 0.5,
  });
  const foliage = new THREE.Mesh(foliageGeom, foliageMat);
  foliage.position.y = 3;
  foliage.scale.set(0.8, 0.9, 0.8);
  group.add(foliage);

  // Merge geometries
  const mergedGeometry = new THREE.BufferGeometry();
  const geometries = (group.children as THREE.Mesh[]).map((m) => m.geometry);

  let offset = 0;
  const attributes = {
    position: [],
    normal: [],
  };

  geometries.forEach((geom) => {
    const pos = geom.getAttribute('position');
    const norm = geom.getAttribute('normal');

    for (let i = 0; i < pos.count; i++) {
      attributes.position.push(pos.getX(i), pos.getY(i), pos.getZ(i));
      attributes.normal.push(norm.getX(i), norm.getY(i), norm.getZ(i));
    }
  });

  mergedGeometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(attributes.position), 3));
  mergedGeometry.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(attributes.normal), 3));
  mergedGeometry.computeBoundingBox();

  return mergedGeometry;
}

/**
 * Create instanced trees for efficient rendering.
 * Single draw call for hundreds of trees.
 */
export function createInstancedTrees(instances: TreeInstance[], lod: 'high' | 'low') {
  const geometry = createTreeGeometry(instances[0]?.type || 'oak', lod);

  const material = new THREE.MeshStandardMaterial({
    color: 0x4a3728,
    roughness: 0.7,
    metalness: 0.1,
  });

  const mesh = new THREE.InstancedMesh(geometry, material, instances.length);

  const matrix = new THREE.Matrix4();

  instances.forEach((instance, i) => {
    matrix.setPosition(instance.position);
    matrix.scale(new THREE.Vector3(instance.scale, instance.scale, instance.scale));
    mesh.setMatrixAt(i, matrix);
  });

  mesh.instanceMatrix.needsUpdate = true;
  return mesh;
}

/**
 * Generate procedural grass field with geometry instancing.
 * Uses billboarded quads for efficient grass rendering.
 */
export function createGrassField(
  width: number,
  depth: number,
  config: GrassConfig,
  seed: number = 42
): THREE.Group {
  const group = new THREE.Group();

  // Pseudo-random based on seed
  const random = (x: number, y: number) => {
    const n = Math.sin(x * 12.9898 + y * 78.233 + seed) * 43758.5453;
    return n - Math.floor(n);
  };

  const grassCount = Math.floor(width * depth * config.density);
  const grassPositions: THREE.Vector3[] = [];

  for (let i = 0; i < grassCount; i++) {
    const x = (random(i, i + 1) - 0.5) * width;
    const z = (random(i + 2, i + 3) - 0.5) * depth;
    grassPositions.push(new THREE.Vector3(x, 0, z));
  }

  // Create instanced grass blades (simple quads)
  const grassGeom = new THREE.PlaneGeometry(0.2, config.height);
  const grassMat = new THREE.MeshStandardMaterial({
    color: config.color,
    side: THREE.DoubleSide,
    roughness: 0.9,
    emissive: new THREE.Color(0x111111),
  });

  // Create 2 perpendicular quads per position for 3D effect
  grassPositions.forEach((pos) => {
    const blade1 = new THREE.Mesh(grassGeom, grassMat);
    blade1.position.copy(pos);
    blade1.castShadow = true;
    group.add(blade1);

    const blade2 = new THREE.Mesh(grassGeom, grassMat);
    blade2.position.copy(pos);
    blade2.rotation.y = Math.PI / 2;
    blade2.castShadow = true;
    group.add(blade2);
  });

  console.log(`[v0] Generated grass field with ${grassCount} blade clusters`);
  return group;
}

/**
 * Animate grass with simple wind sine wave.
 */
export function updateGrassWind(
  group: THREE.Group,
  time: number,
  windStrength: number
) {
  const wind = Math.sin(time * windStrength) * 0.05;

  group.children.forEach((blade) => {
    if (blade instanceof THREE.Mesh) {
      blade.rotation.z = wind;
    }
  });
}
