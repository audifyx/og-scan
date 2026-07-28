/** 
 * Character animation system with procedural walking cycles, idle poses, and transitions.
 * Uses procedural generation for smooth, realistic movement.
 */

import * as THREE from 'three';
import { HumanoidSkeleton } from './ikSolver';

export type AnimationState = 'idle' | 'walking' | 'running' | 'jumping' | 'emote';

export interface AnimationConfig {
  state: AnimationState;
  speed: number; // Walk speed in units/sec
  direction: THREE.Vector3; // Direction vector
  time: number; // Current animation time
}

/**
 * Procedural animation system - generates realistic movement on the fly.
 */
export class CharacterAnimator {
  skeleton: HumanoidSkeleton;
  config: AnimationConfig;
  private cycleTime: number = 0;
  private bodyOffset: THREE.Vector3 = new THREE.Vector3();

  constructor(skeleton: HumanoidSkeleton) {
    this.skeleton = skeleton;
    this.config = {
      state: 'idle',
      speed: 0,
      direction: new THREE.Vector3(0, 0, 1),
      time: 0,
    };
  }

  /**
   * Update animation frame.
   */
  update(deltaTime: number, config: Partial<AnimationConfig>) {
    this.config = { ...this.config, ...config };
    this.config.time += deltaTime;

    switch (this.config.state) {
      case 'idle':
        this.updateIdlePose();
        break;
      case 'walking':
        this.updateWalkingCycle(deltaTime);
        break;
      case 'running':
        this.updateRunningCycle(deltaTime);
        break;
      case 'jumping':
        this.updateJumpingPose();
        break;
    }

    // Apply body position offset from walking cycle
    this.skeleton.root.position.add(this.bodyOffset);
  }

  private updateIdlePose() {
    // Slight sway side to side
    const sway = Math.sin(this.config.time * 0.5) * 0.05;
    this.skeleton.root.position.x += sway * 0.01;

    // Gentle head tilt
    const headTilt = Math.sin(this.config.time * 0.3) * 0.1;
    this.skeleton.head.rotation.z = headTilt;

    // Arm positioning (relaxed at sides)
    this.positionArmsIdle();
  }

  private updateWalkingCycle(deltaTime: number) {
    this.cycleTime += this.config.speed * deltaTime;
    const cycleProgress = (this.cycleTime % 1.0); // Normalize to 0-1
    const walkCycle = Math.sin(cycleProgress * Math.PI * 2); // -1 to 1

    // Vertical bob (smooth up/down motion)
    const verticalBob = Math.abs(Math.sin(cycleProgress * Math.PI)) * 0.1;
    this.bodyOffset.y = verticalBob;

    // Head follows body motion with slight delay
    this.skeleton.head.rotation.x = Math.sin(cycleProgress * Math.PI * 2 - 0.3) * 0.1;

    // Leg animation (opposite phases)
    const legPhase1 = cycleProgress * 2 * Math.PI;
    const legPhase2 = legPhase1 + Math.PI;

    this.animateLeg(this.skeleton.leftLeg, legPhase1);
    this.animateLeg(this.skeleton.rightLeg, legPhase2);

    // Arm swinging (opposite to legs)
    this.animateArm(this.skeleton.leftArm, legPhase2, 'left');
    this.animateArm(this.skeleton.rightArm, legPhase1, 'right');

    // Hip rotation (subtle)
    this.skeleton.root.rotation.z = Math.sin(cycleProgress * Math.PI * 2) * 0.05;

    // Spine twist
    if (this.skeleton.spine.length > 0) {
      this.skeleton.spine[0].rotation.z = Math.sin(cycleProgress * Math.PI * 2) * 0.08;
    }
  }

  private updateRunningCycle(deltaTime: number) {
    // Running is faster walking with more exaggerated movement
    this.cycleTime += this.config.speed * deltaTime * 1.5;
    const cycleProgress = (this.cycleTime % 1.0);

    // More pronounced vertical bob
    const verticalBob = Math.abs(Math.sin(cycleProgress * Math.PI)) * 0.2;
    this.bodyOffset.y = verticalBob;

    // Faster leg cycle
    const legPhase1 = cycleProgress * 2 * Math.PI * 1.5;
    const legPhase2 = legPhase1 + Math.PI;

    this.animateLeg(this.skeleton.leftLeg, legPhase1, 1.5);
    this.animateLeg(this.skeleton.rightLeg, legPhase2, 1.5);

    // Exaggerated arm swinging
    this.animateArm(this.skeleton.leftArm, legPhase2, 'left', 1.3);
    this.animateArm(this.skeleton.rightArm, legPhase1, 'right', 1.3);

    // More torso twist while running
    this.skeleton.root.rotation.z = Math.sin(cycleProgress * Math.PI * 2) * 0.15;
  }

  private updateJumpingPose() {
    const jumpCycle = Math.sin(this.config.time * 3) * 0.5 + 0.5; // 0-1

    // Jump height
    this.bodyOffset.y = jumpCycle * 1.0;

    // Legs tucked during jump
    this.skeleton.leftLeg.forEach((bone) => (bone.rotation.x = jumpCycle * 0.5));
    this.skeleton.rightLeg.forEach((bone) => (bone.rotation.x = jumpCycle * 0.5));

    // Arms up during jump
    this.skeleton.leftArm.forEach((bone) => (bone.rotation.x = -jumpCycle * 0.8));
    this.skeleton.rightArm.forEach((bone) => (bone.rotation.x = -jumpCycle * 0.8));
  }

  private animateLeg(leg: any[], phase: number, intensity: number = 1.0) {
    if (!leg || leg.length === 0) return;

    // Upper leg (thigh) - forward/back swing
    const thighRotation = Math.sin(phase) * 0.5 * intensity;
    leg[0].rotation.x = thighRotation;

    // Lower leg (calf) - extends during forward swing
    const calfRotation = Math.max(0, -Math.sin(phase) * 0.8 * intensity);
    if (leg[1]) {
      leg[1].rotation.x = calfRotation;
    }
  }

  private animateArm(arm: any[], phase: number, side: 'left' | 'right', intensity: number = 1.0) {
    if (!arm || arm.length === 0) return;

    const direction = side === 'left' ? -1 : 1;

    // Upper arm swing
    const shoulderRotation = Math.sin(phase) * 0.6 * intensity * direction;
    arm[0].rotation.z = shoulderRotation;

    // Slight elbow bend
    if (arm[1]) {
      arm[1].rotation.z = Math.sin(phase) * 0.2 * intensity * direction;
    }
  }

  private positionArmsIdle() {
    // Left arm
    if (this.skeleton.leftArm[0]) {
      this.skeleton.leftArm[0].rotation.x = -0.2;
      this.skeleton.leftArm[0].rotation.z = 0.1;
    }

    // Right arm
    if (this.skeleton.rightArm[0]) {
      this.skeleton.rightArm[0].rotation.x = -0.2;
      this.skeleton.rightArm[0].rotation.z = -0.1;
    }
  }

  /**
   * Transition smoothly between animation states.
   */
  transitionTo(newState: AnimationState, duration: number = 0.3) {
    // Ease out of current state
    this.config.state = newState;
    this.cycleTime = 0;
  }
}

/**
 * Procedural emote animations.
 */
export const EMOTES = {
  wave: (animator: CharacterAnimator, time: number) => {
    const wave = Math.sin(time * 8) * 0.5 + 0.5;
    if (animator.skeleton.rightArm[0]) {
      animator.skeleton.rightArm[0].rotation.z = -Math.PI / 2 + wave * 0.5;
    }
  },

  jump: (animator: CharacterAnimator, time: number) => {
    if (animator.config.state !== 'jumping') {
      animator.transitionTo('jumping');
    }
  },

  dance: (animator: CharacterAnimator, time: number) => {
    const dancePhase = time * 2;
    animator.skeleton.root.rotation.z = Math.sin(dancePhase) * 0.3;
    
    if (animator.skeleton.spine.length > 0) {
      animator.skeleton.spine[0].rotation.z = Math.sin(dancePhase + Math.PI / 2) * 0.2;
    }
  },
};
