/** 
 * AAA environment system with photorealistic lighting, weather, and day/night cycle.
 * Handles sky, sun, shadows, and atmospheric effects.
 */

import * as THREE from 'three';

export interface EnvironmentConfig {
  timeOfDay: number; // 0-24 hours
  weather: 'clear' | 'cloudy' | 'rainy';
  quality: 'high' | 'medium' | 'low';
}

export class EnvironmentSystem {
  scene: THREE.Scene;
  sun!: THREE.DirectionalLight;
  sky!: THREE.Sky;
  config: EnvironmentConfig;
  uniforms: any;

  constructor(scene: THREE.Scene, config: EnvironmentConfig) {
    this.scene = scene;
    this.config = config;
    this.setupLighting();
    this.setupSky();
  }

  private setupLighting() {
    // Main directional light (sun)
    this.sun = new THREE.DirectionalLight(0xffffff, 1.5);
    this.sun.position.set(100, 100, 50);
    this.sun.castShadow = true;

    // Shadow map configuration for photorealism
    this.sun.shadow.mapSize.width = this.config.quality === 'high' ? 4096 : 2048;
    this.sun.shadow.mapSize.height = this.config.quality === 'high' ? 4096 : 2048;
    this.sun.shadow.camera.far = 1000;
    this.sun.shadow.camera.left = -300;
    this.sun.shadow.camera.right = 300;
    this.sun.shadow.camera.top = 300;
    this.sun.shadow.camera.bottom = -300;
    this.sun.shadow.bias = -0.0001;

    this.scene.add(this.sun);

    // Ambient light for fill (prevents pure black shadows)
    const ambient = new THREE.AmbientLight(0xffffff, 0.4);
    this.scene.add(ambient);

    // Hemisphere light for realistic sky bounce
    const hemi = new THREE.HemisphereLight(0x87ceeb, 0x654321, 0.5);
    this.scene.add(hemi);
  }

  private setupSky() {
    // Simple sky dome (would use higher quality sky mesh in production)
    const skyGeom = new THREE.SphereGeometry(1000, 32, 32);
    const skyMat = new THREE.MeshBasicMaterial({
      color: 0x87ceeb,
      side: THREE.BackSide,
    });
    this.sky = new THREE.Mesh(skyGeom, skyMat);
    this.scene.add(this.sky);

    // Update sky color based on time
    this.updateSkyColor();
  }

  /**
   * Update environment based on time of day.
   * Rotates sun, changes colors, and adjusts shadows.
   */
  updateTimeOfDay(hour: number) {
    this.config.timeOfDay = hour;

    // Calculate sun angle (0 = sunrise, 6 = noon, 12 = sunset, 18 = midnight)
    const timeNorm = (hour % 24) / 24;
    const sunAngle = (timeNorm - 0.25) * Math.PI; // -90 to +90 degrees

    const radius = 400;
    this.sun.position.x = Math.cos(sunAngle) * radius;
    this.sun.position.y = Math.sin(sunAngle) * radius + 100;

    this.updateSkyColor();
    this.updateFog();
  }

  private updateSkyColor() {
    const hour = this.config.timeOfDay;

    // Sky color gradients
    let skyColor: THREE.Color;

    if (hour >= 6 && hour < 12) {
      // Morning to noon: blue sky
      const t = (hour - 6) / 6;
      skyColor = new THREE.Color().lerpColors(new THREE.Color(0xffa500), new THREE.Color(0x87ceeb), t);
    } else if (hour >= 12 && hour < 18) {
      // Noon to evening: bright to orange
      const t = (hour - 12) / 6;
      skyColor = new THREE.Color().lerpColors(new THREE.Color(0x87ceeb), new THREE.Color(0xff6b35), t);
    } else if (hour >= 18 && hour < 20) {
      // Evening twilight: deep orange to dark blue
      const t = (hour - 18) / 2;
      skyColor = new THREE.Color().lerpColors(new THREE.Color(0xff6b35), new THREE.Color(0x1a1a2e), t);
    } else {
      // Night: dark blue
      skyColor = new THREE.Color(0x0a0a1a);
    }

    (this.sky.material as THREE.MeshBasicMaterial).color = skyColor;
    this.scene.background = skyColor;

    // Adjust sun intensity by time
    if (hour >= 6 && hour < 18) {
      const sunIntensity = Math.sin(((hour - 6) / 12) * Math.PI);
      this.sun.intensity = 1.5 * Math.max(sunIntensity, 0.1);
    } else {
      this.sun.intensity = 0.2; // Moonlight
    }
  }

  private updateFog() {
    const hour = this.config.timeOfDay;

    // Reduce visibility at night
    let fogDensity = 0.001;
    if (hour < 6 || hour >= 20) {
      fogDensity = 0.003; // Increased fog at night
    }

    // Rainy weather increases fog
    if (this.config.weather === 'rainy') {
      fogDensity *= 1.5;
    }

    this.scene.fog = new THREE.Fog(this.scene.background as THREE.Color, 1 / fogDensity, 2000);
  }

  /**
   * Update weather effects.
   */
  updateWeather(weather: 'clear' | 'cloudy' | 'rainy') {
    this.config.weather = weather;

    switch (weather) {
      case 'clear':
        this.sun.intensity = Math.max(this.sun.intensity, 1.0);
        break;
      case 'cloudy':
        this.sun.intensity *= 0.6;
        break;
      case 'rainy':
        this.sun.intensity *= 0.3;
        break;
    }

    this.updateFog();
  }

  /**
   * Get environment parameters for shader uniforms.
   */
  getShaderUniforms() {
    return {
      uTimeOfDay: this.config.timeOfDay,
      uSunPosition: new THREE.Vector3(this.sun.position.x, this.sun.position.y, this.sun.position.z),
      uSunIntensity: this.sun.intensity,
      uWeather: this.config.weather === 'rainy' ? 1.0 : this.config.weather === 'cloudy' ? 0.5 : 0.0,
    };
  }

  dispose() {
    if (this.sky.geometry) this.sky.geometry.dispose();
    if ((this.sky.material as THREE.Material).dispose) (this.sky.material as THREE.Material).dispose();
    this.scene.remove(this.sky);
    this.scene.remove(this.sun);
  }
}
