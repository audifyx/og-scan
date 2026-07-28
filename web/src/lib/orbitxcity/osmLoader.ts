/** OpenStreetMap real city data loader for AAA world generation. */

import type { BuildingDefinition, Vec3 } from './types';

interface OSMNode {
  id: number;
  lat: number;
  lon: number;
}

interface OSMWay {
  id: number;
  nodes: number[];
  tags: Record<string, string>;
}

interface OSMData {
  nodes: Map<number, OSMNode>;
  ways: OSMWay[];
}

// Real city coordinates (center points for district focus)
const CITY_COORDS = {
  nyc: { lat: 40.7128, lon: -74.006, zoom: 15, name: 'New York City' },
  miami: { lat: 25.7617, lon: -80.1918, zoom: 15, name: 'Miami' },
  la: { lat: 34.0522, lon: -118.2437, zoom: 15, name: 'Los Angeles' },
  boston: { lat: 42.3601, lon: -71.0589, zoom: 15, name: 'Boston' },
};

/**
 * Fetch real building data from OpenStreetMap using Overpass API.
 * Returns building polygons with footprints for realistic city generation.
 */
export async function fetchOSMBuildings(
  cityId: keyof typeof CITY_COORDS,
  radiusKm: number = 1.5
): Promise<BuildingDefinition[]> {
  const city = CITY_COORDS[cityId];
  const radiusDeg = radiusKm / 111; // rough conversion km to degrees

  const minLat = city.lat - radiusDeg;
  const maxLat = city.lat + radiusDeg;
  const minLon = city.lon - radiusDeg;
  const maxLon = city.lon + radiusDeg;

  try {
    // Query Overpass API for buildings in the city bbox
    const overpassUrl =
      'https://overpass-api.de/api/interpreter?' +
      new URLSearchParams({
        data: `[bbox:${minLat},${minLon},${maxLat},${maxLon}];(way["building"];relation["building"];);out geom;`,
      }).toString();

    const response = await fetch(overpassUrl, {
      headers: { 'Accept-Encoding': 'gzip' },
    });

    if (!response.ok) throw new Error(`OSM API error: ${response.status}`);

    const text = await response.text();
    const buildings = parseOSMBuildings(text, city.lat, city.lon);
    return buildings;
  } catch (error) {
    console.error(`[v0] Failed to fetch OSM data for ${cityId}:`, error);
    return [];
  }
}

/**
 * Parse Overpass API response and convert to BuildingDefinitions.
 * Converts lat/lon to local XZ coordinates for Three.js world space.
 */
function parseOSMBuildings(
  osmXml: string,
  centerLat: number,
  centerLon: number
): BuildingDefinition[] {
  const parser = new DOMParser();
  const doc = parser.parseFromString(osmXml, 'text/xml');
  
  if (doc.getElementsByTagName('parsererror').length > 0) {
    console.error('[v0] OSM XML parse error');
    return [];
  }

  const buildings: BuildingDefinition[] = [];
  const ways = doc.getElementsByTagName('way');
  
  let buildingIndex = 0;

  for (let i = 0; i < ways.length; i++) {
    const way = ways[i];
    const nodes = way.getElementsByTagName('nd');
    const tags = way.getElementsByTagName('tag');

    // Extract building name
    let name = 'Building';
    let buildingType = 'generic';

    for (let j = 0; j < tags.length; j++) {
      const tag = tags[j];
      const key = tag.getAttribute('k');
      const value = tag.getAttribute('v');

      if (key === 'name') name = value || name;
      if (key === 'building') buildingType = value || buildingType;
    }

    // Convert node coordinates to footprint polygon
    const footprint: Array<{ x: number; z: number }> = [];
    const nodeCoords = way.getElementsByTagName('nd');

    for (let j = 0; j < nodeCoords.length; j++) {
      const nd = nodeCoords[j];
      const lat = parseFloat(nd.getAttribute('lat') || '0');
      const lon = parseFloat(nd.getAttribute('lon') || '0');

      // Convert lat/lon to local XZ (simplified mercator)
      const x = (lon - centerLon) * 111320 * Math.cos((centerLat * Math.PI) / 180);
      const z = (lat - centerLat) * 110540;

      footprint.push({ x, z });
    }

    if (footprint.length >= 3) {
      // Calculate center and bounds for building mesh
      const centerX = footprint.reduce((sum, p) => sum + p.x, 0) / footprint.length;
      const centerZ = footprint.reduce((sum, p) => sum + p.z, 0) / footprint.length;

      const minX = Math.min(...footprint.map((p) => p.x));
      const maxX = Math.max(...footprint.map((p) => p.x));
      const minZ = Math.min(...footprint.map((p) => p.z));
      const maxZ = Math.max(...footprint.map((p) => p.z));

      const width = maxX - minX;
      const depth = maxZ - minZ;

      // Randomize building height based on type
      const heightMap: Record<string, [number, number]> = {
        residential: [20, 50],
        commercial: [40, 100],
        retail: [15, 40],
        office: [50, 150],
        generic: [20, 60],
      };

      const [minH, maxH] = heightMap[buildingType] || [20, 60];
      const height = minH + Math.random() * (maxH - minH);

      // Color by type
      const colorMap: Record<string, string> = {
        residential: '#D4A5A5',
        commercial: '#A5B8D4',
        retail: '#D4D4A5',
        office: '#8FA5D4',
        generic: '#B8B8B8',
      };

      buildings.push({
        id: `osm-building-${buildingIndex++}`,
        districtId: 'downtown',
        kind: 'generic',
        name,
        position: { x: centerX, y: height / 2, z: centerZ },
        size: { width: Math.abs(width) || 10, height, depth: Math.abs(depth) || 10 },
        color: colorMap[buildingType] || '#B8B8B8',
        accent: '#FFD700',
        footprint: footprint.map((p) => ({ x: p.x - centerX, z: p.z - centerZ })),
      });
    }
  }

  console.log(`[v0] Parsed ${buildings.length} buildings from OSM data`);
  return buildings;
}

/**
 * Fetch real street/terrain data from OSM and cache it.
 * Returns GeoJSON for street rendering and terrain heightmaps.
 */
export async function fetchOSMStreets(
  cityId: keyof typeof CITY_COORDS
): Promise<{ streets: any[]; terrain: any }> {
  const city = CITY_COORDS[cityId];

  try {
    // Query for roads/streets
    const radiusDeg = 1.5 / 111;
    const minLat = city.lat - radiusDeg;
    const maxLat = city.lat + radiusDeg;
    const minLon = city.lon - radiusDeg;
    const maxLon = city.lon + radiusDeg;

    const overpassUrl =
      'https://overpass-api.de/api/interpreter?' +
      new URLSearchParams({
        data: `[bbox:${minLat},${minLon},${maxLat},${maxLon}];(way["highway"];);out geom;`,
      }).toString();

    const response = await fetch(overpassUrl);
    if (!response.ok) throw new Error(`Streets API error: ${response.status}`);

    const text = await response.text();
    const streets = parseOSMStreets(text);

    return { streets, terrain: {} };
  } catch (error) {
    console.error(`[v0] Failed to fetch OSM streets for ${cityId}:`, error);
    return { streets: [], terrain: {} };
  }
}

function parseOSMStreets(osmXml: string): any[] {
  // TODO: Parse street ways into polylines with width metadata
  return [];
}

// Cache fetched city data to avoid repeated API calls
const cityDataCache = new Map<string, BuildingDefinition[]>();

export async function getCityBuildingsWithCache(
  cityId: keyof typeof CITY_COORDS
): Promise<BuildingDefinition[]> {
  if (cityDataCache.has(cityId)) {
    return cityDataCache.get(cityId)!;
  }

  const buildings = await fetchOSMBuildings(cityId);
  cityDataCache.set(cityId, buildings);
  return buildings;
}
