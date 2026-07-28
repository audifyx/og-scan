/** 
 * Asset streaming and LOD (Level of Detail) system for AAA photorealistic world.
 * Manages loading/unloading of high-res textures, models, and terrain based on camera distance.
 */

import * as THREE from 'three';

export interface StreamingAsset {
  id: string;
  url: string;
  priority: number;
  distance: number;
  loaded: boolean;
  texture?: THREE.Texture;
}

export class AssetStreamer {
  private queue: StreamingAsset[] = [];
  private loading = new Set<string>();
  private maxConcurrent = 4;
  private textureCache = new Map<string, THREE.Texture>();
  private modelCache = new Map<string, THREE.BufferGeometry>();

  /**
   * Queue asset for streaming based on camera distance.
   * Closer assets get higher priority for faster loading.
   */
  queueAsset(asset: StreamingAsset) {
    // Remove if already queued
    this.queue = this.queue.filter((a) => a.id !== asset.id);

    // Insert by priority (lower priority = load sooner)
    const insertIndex = this.queue.findIndex((a) => a.priority > asset.priority);
    if (insertIndex >= 0) {
      this.queue.splice(insertIndex, 0, asset);
    } else {
      this.queue.push(asset);
    }

    this.processQueue();
  }

  /**
   * Calculate priority based on distance from camera.
   * Closer = higher priority (lower number).
   */
  static calculatePriority(distance: number): number {
    if (distance < 10) return 0; // Immediate vicinity
    if (distance < 50) return 1; // Close view
    if (distance < 150) return 2; // Medium view
    if (distance < 500) return 3; // Far view
    return 999; // Ignore beyond horizon
  }

  /**
   * Load texture with automatic downscaling for mobile/low-bandwidth.
   */
  async loadTexture(url: string, maxSize: 'high' | 'medium' | 'low' = 'high'): Promise<THREE.Texture> {
    // Check cache first
    const cacheKey = `${url}:${maxSize}`;
    if (this.textureCache.has(cacheKey)) {
      return this.textureCache.get(cacheKey)!;
    }

    return new Promise((resolve, reject) => {
      const loader = new THREE.TextureLoader();

      // Add resolution variant based on quality setting
      const qualityUrl = this.getQualityVariant(url, maxSize);

      loader.load(
        qualityUrl,
        (texture) => {
          // Configure texture for photorealism
          texture.encoding = THREE.sRGBColorSpace;
          texture.magFilter = THREE.LinearFilter;
          texture.minFilter = THREE.LinearMipmapLinearFilter;
          texture.anisotropy = 16; // High aniso for oblique angles

          this.textureCache.set(cacheKey, texture);
          resolve(texture);
        },
        undefined,
        reject
      );
    });
  }

  /**
   * Return appropriate quality variant of asset URL.
   * e.g., /models/building.glb -> /models/building_medium.glb
   */
  private getQualityVariant(url: string, quality: 'high' | 'medium' | 'low'): string {
    const [base, ext] = url.split('.');
    const suffix = quality === 'high' ? '' : quality === 'medium' ? '_med' : '_low';
    return `${base}${suffix}.${ext}`;
  }

  /**
   * Process queued assets, respecting concurrent load limit.
   */
  private async processQueue() {
    while (this.queue.length > 0 && this.loading.size < this.maxConcurrent) {
      const asset = this.queue.shift()!;

      if (this.loading.has(asset.id)) continue;
      this.loading.add(asset.id);

      try {
        // Determine asset type and load accordingly
        if (asset.url.endsWith('.glb') || asset.url.endsWith('.gltf')) {
          // Model loading handled by caller (useGLTF hook in React Three Fiber)
        } else if (asset.url.match(/\.(png|jpg|webp)$/i)) {
          await this.loadTexture(asset.url);
        }

        console.log(`[v0] Streamed asset: ${asset.id}`);
      } catch (error) {
        console.error(`[v0] Failed to stream asset ${asset.id}:`, error);
      } finally {
        this.loading.delete(asset.id);
        asset.loaded = true;
      }
    }
  }

  /**
   * Clear cache and free memory for distant assets.
   */
  unloadDistantAssets(maxDistance: number) {
    const textureKeysToDelete: string[] = [];

    this.textureCache.forEach((texture, key) => {
      // Dispose of textures beyond max distance
      const distance = parseInt(key.split(':')[1] || '0');
      if (distance > maxDistance) {
        texture.dispose();
        textureKeysToDelete.push(key);
      }
    });

    textureKeysToDelete.forEach((key) => this.textureCache.delete(key));
  }

  /**
   * Dispose all cached resources.
   */
  dispose() {
    this.textureCache.forEach((texture) => texture.dispose());
    this.modelCache.forEach((geom) => geom.dispose());
    this.textureCache.clear();
    this.modelCache.clear();
    this.queue = [];
    this.loading.clear();
  }
}

// Singleton instance
export const assetStreamer = new AssetStreamer();
