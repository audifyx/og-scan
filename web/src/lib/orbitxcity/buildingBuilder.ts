/** 
 * Building mesh generation with detailed facades, windows, doors, and entryways.
 * Creates photorealistic buildings with proper LOD.
 */

import * as THREE from 'three';
import { createPBRMaterial, createGlassMaterial, createRoofMaterial, BUILDING_MATERIALS, createVariedBuildingMaterial } from './materials';

export interface DetailedBuildingConfig {
  width: number;
  height: number;
  depth: number;
  color: string;
  windowsPerFloor: number;
  doorsOnGround: number;
  hasRoof: boolean;
  roofType: 'flat' | 'pitched' | 'dome';
  lod: 'high' | 'medium' | 'low';
  footprint?: Array<{ x: number; z: number }>;
}

/**
 * Generate a detailed building with windows, doors, and architectural details.
 */
export function buildDetailedBuilding(config: DetailedBuildingConfig): THREE.Group {
  const group = new THREE.Group();

  if (config.lod === 'low') {
    // Simple box for distant LOD
    const geom = new THREE.BoxGeometry(config.width, config.height, config.depth);
    const mat = createVariedBuildingMaterial(config.color);
    group.add(new THREE.Mesh(geom, mat));
    return group;
  }

  // Main facade
  const facadeGroup = buildFacade(config);
  group.add(facadeGroup);

  // Windows
  const windowGroup = buildWindows(config);
  group.add(windowGroup);

  // Ground floor doors
  const doorGroup = buildDoors(config);
  group.add(doorGroup);

  // Roof
  if (config.hasRoof) {
    const roof = buildRoof(config);
    group.add(roof);
  }

  // Details (ledges, trim, etc.)
  if (config.lod === 'high') {
    const details = buildArchitecturalDetails(config);
    group.add(details);
  }

  return group;
}

function buildFacade(config: DetailedBuildingConfig): THREE.Mesh {
  // Use footprint if available (OSM data), otherwise simple box
  let geometry: THREE.BufferGeometry;

  if (config.footprint && config.footprint.length >= 3) {
    // Extrude footprint shape
    geometry = extrudeBuildingFootprint(config.footprint, config.height);
  } else {
    // Simple box
    geometry = new THREE.BoxGeometry(config.width, config.height, config.depth);
  }

  const material = createVariedBuildingMaterial(config.color, 0.05);
  const mesh = new THREE.Mesh(geometry, material);
  mesh.castShadow = true;
  mesh.receiveShadow = true;

  return mesh;
}

function extrudeBuildingFootprint(
  footprint: Array<{ x: number; z: number }>,
  height: number
): THREE.BufferGeometry {
  const shape = new THREE.Shape();
  
  // Create 2D shape from footprint points
  footprint.forEach((point, i) => {
    if (i === 0) {
      shape.moveTo(point.x, point.z);
    } else {
      shape.lineTo(point.x, point.z);
    }
  });
  shape.closePath();

  // Extrude to 3D
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: height,
    bevelEnabled: false,
  });

  return geometry;
}

function buildWindows(config: DetailedBuildingConfig): THREE.Group {
  const group = new THREE.Group();
  const windowMaterial = createGlassMaterial();

  const floorCount = Math.max(2, Math.floor(config.height / 4));
  const windowWidth = 1.2;
  const windowHeight = 1.5;
  const spacingX = (config.width - 2) / (config.windowsPerFloor + 1);

  // Front facade windows
  for (let floor = 1; floor < floorCount; floor++) {
    const y = floor * (config.height / floorCount) - config.height / 2 + windowHeight / 2;

    for (let i = 1; i <= config.windowsPerFloor; i++) {
      const x = -config.width / 2 + spacingX * i;
      const z = config.depth / 2 + 0.1; // Slight offset from facade

      const windowGeom = new THREE.PlaneGeometry(windowWidth, windowHeight);
      const window = new THREE.Mesh(windowGeom, windowMaterial);
      window.position.set(x, y, z);

      // Add window frame (dark outline)
      const frameGeom = new THREE.EdgesGeometry(windowGeom);
      const frameMat = new THREE.LineBasicMaterial({ color: 0x000000, linewidth: 2 });
      const frame = new THREE.LineSegments(frameGeom, frameMat);
      frame.position.copy(window.position);
      frame.position.z += 0.02;

      group.add(window);
      group.add(frame);
    }
  }

  // Back facade windows (mirror)
  for (let floor = 1; floor < floorCount; floor++) {
    const y = floor * (config.height / floorCount) - config.height / 2 + windowHeight / 2;

    for (let i = 1; i <= config.windowsPerFloor; i++) {
      const x = -config.width / 2 + spacingX * i;
      const z = -config.depth / 2 - 0.1;

      const windowGeom = new THREE.PlaneGeometry(windowWidth, windowHeight);
      const window = new THREE.Mesh(windowGeom, windowMaterial);
      window.position.set(x, y, z);
      group.add(window);
    }
  }

  return group;
}

function buildDoors(config: DetailedBuildingConfig): THREE.Group {
  const group = new THREE.Group();

  const doorWidth = 1.0;
  const doorHeight = 2.5;
  const doorMaterial = createPBRMaterial({
    albedo: '#1a1a1a',
    roughness: 0.3,
    metalness: 0.5,
  });

  const spacingX = config.width / (config.doorsOnGround + 1);

  for (let i = 1; i <= config.doorsOnGround; i++) {
    const x = -config.width / 2 + spacingX * i;
    const y = doorHeight / 2 - config.height / 2;
    const z = config.depth / 2;

    const doorGeom = new THREE.PlaneGeometry(doorWidth, doorHeight);
    const door = new THREE.Mesh(doorGeom, doorMaterial);
    door.position.set(x, y, z);
    group.add(door);

    // Door handle (small cylinder)
    const handleGeom = new THREE.CylinderGeometry(0.08, 0.08, 0.02, 16);
    const handleMat = new THREE.MeshStandardMaterial({ metalness: 1.0, roughness: 0.2, color: 0xffd700 });
    const handle = new THREE.Mesh(handleGeom, handleMat);
    handle.rotation.z = Math.PI / 2;
    handle.position.set(x + doorWidth / 2 - 0.15, y, z + 0.05);
    group.add(handle);
  }

  return group;
}

function buildRoof(config: DetailedBuildingConfig): THREE.Mesh {
  let roofGeom: THREE.BufferGeometry;
  const roofMat = createRoofMaterial('tile');

  const roofY = config.height / 2;

  switch (config.roofType) {
    case 'pitched': {
      // Triangular roof
      const roofShape = new THREE.Shape();
      roofShape.moveTo(-config.width / 2, 0);
      roofShape.lineTo(config.width / 2, 0);
      roofShape.lineTo(0, config.height * 0.2);
      roofShape.closePath();

      roofGeom = new THREE.ExtrudeGeometry(roofShape, {
        depth: config.depth,
        bevelEnabled: false,
      });
      break;
    }

    case 'dome': {
      // Rounded top
      roofGeom = new THREE.SphereGeometry(config.width / 2, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2);
      break;
    }

    default: {
      // Flat roof - simple box top
      roofGeom = new THREE.BoxGeometry(config.width, 0.5, config.depth);
    }
  }

  const roof = new THREE.Mesh(roofGeom, roofMat);
  roof.position.y = roofY;
  roof.castShadow = true;
  roof.receiveShadow = true;

  return roof;
}

function buildArchitecturalDetails(config: DetailedBuildingConfig): THREE.Group {
  const group = new THREE.Group();

  // Cornice (decorative molding at top)
  const corniceGeom = new THREE.BoxGeometry(config.width + 0.4, 0.3, config.depth + 0.4);
  const corniceMat = createPBRMaterial({
    albedo: '#8b7355',
    roughness: 0.5,
    metalness: 0.3,
  });
  const cornice = new THREE.Mesh(corniceGeom, corniceMat);
  cornice.position.y = config.height / 2;
  group.add(cornice);

  // Base trim
  const baseGeom = new THREE.BoxGeometry(config.width + 0.2, 0.4, config.depth + 0.2);
  const baseMat = createPBRMaterial({
    albedo: '#5a5a5a',
    roughness: 0.6,
    metalness: 0.1,
  });
  const base = new THREE.Mesh(baseGeom, baseMat);
  base.position.y = -config.height / 2 + 0.2;
  group.add(base);

  return group;
}
