/** 
 * Inverse Kinematics (IK) solver for realistic character animations.
 * Handles limb positioning for walking, reaching, and posing.
 */

import * as THREE from 'three';

export interface Bone {
  id: string;
  position: THREE.Vector3;
  length: number; // Distance to next bone
  rotation: THREE.Quaternion;
  parent: Bone | null;
  children: Bone[];
}

export interface IKTarget {
  position: THREE.Vector3;
  weight: number; // 0-1, how much to prioritize this target
}

/**
 * Simplified FABRIK (Forward And Backward Reaching IK) solver.
 * Solves chains of bones to reach target position.
 */
export class FabrikSolver {
  private rootBone: Bone;
  private endEffector: Bone;
  private chain: Bone[] = [];
  private tolerance: number = 0.01;
  private maxIterations: number = 10;

  constructor(rootBone: Bone) {
    this.rootBone = rootBone;
    this.endEffector = this.findEndEffector(rootBone);
    this.buildChain(rootBone);
  }

  private findEndEffector(bone: Bone): Bone {
    if (bone.children.length === 0) {
      return bone;
    }
    return this.findEndEffector(bone.children[0]);
  }

  private buildChain(bone: Bone) {
    this.chain = [];
    let current: Bone | null = this.endEffector;

    while (current !== null) {
      this.chain.unshift(current);
      current = current.parent;
    }
  }

  /**
   * Solve for reaching target position.
   */
  solve(targetPosition: THREE.Vector3): boolean {
    let distance = this.chain[0].position.distanceTo(targetPosition);

    for (let iteration = 0; iteration < this.maxIterations; iteration++) {
      if (distance < this.tolerance) {
        return true; // Solution found
      }

      // Backward pass - move end effector towards target
      this.chain[this.chain.length - 1].position.copy(targetPosition);

      for (let i = this.chain.length - 2; i >= 0; i--) {
        const bone = this.chain[i];
        const child = this.chain[i + 1];
        const direction = new THREE.Vector3().subVectors(bone.position, child.position).normalize();
        child.position.copy(bone.position).addScaledVector(direction, bone.length);
      }

      // Forward pass - keep root fixed
      this.chain[0].position.copy(this.rootBone.position);

      for (let i = 1; i < this.chain.length; i++) {
        const bone = this.chain[i];
        const parent = this.chain[i - 1];
        const direction = new THREE.Vector3().subVectors(bone.position, parent.position).normalize();
        bone.position.copy(parent.position).addScaledVector(direction, parent.length);
      }

      distance = this.chain[this.chain.length - 1].position.distanceTo(targetPosition);
    }

    return distance < this.tolerance;
  }

  /**
   * Get bone positions for mesh deformation.
   */
  getBoneMatrices(): THREE.Matrix4[] {
    return this.chain.map((bone) => {
      const matrix = new THREE.Matrix4();
      matrix.setPosition(bone.position);
      return matrix;
    });
  }
}

/**
 * Character skeleton definition for humanoid rigging.
 */
export interface HumanoidSkeleton {
  root: Bone; // Pelvis/root
  spine: Bone[];
  head: Bone;
  leftArm: Bone[];
  rightArm: Bone[];
  leftLeg: Bone[];
  rightLeg: Bone[];
}

/**
 * Create a standard humanoid skeleton.
 */
export function createHumanoidSkeleton(
  position: THREE.Vector3,
  height: number = 1.8
): HumanoidSkeleton {
  const scale = height / 1.8; // Normalize to 1.8m reference

  // Root (pelvis)
  const root: Bone = {
    id: 'pelvis',
    position: position.clone(),
    length: 0,
    rotation: new THREE.Quaternion(),
    parent: null,
    children: [],
  };

  // Spine chain
  const spine: Bone[] = [];
  let parent = root;

  ['lower_spine', 'upper_spine', 'chest'].forEach((id, i) => {
    const bone: Bone = {
      id,
      position: parent.position.clone().addScaledVector(new THREE.Vector3(0, 1, 0), 0.3 * scale),
      length: 0.3 * scale,
      rotation: new THREE.Quaternion(),
      parent,
      children: [],
    };
    parent.children.push(bone);
    spine.push(bone);
    parent = bone;
  });

  // Head
  const head: Bone = {
    id: 'head',
    position: parent.position.clone().addScaledVector(new THREE.Vector3(0, 1, 0), 0.3 * scale),
    length: 0.2 * scale,
    rotation: new THREE.Quaternion(),
    parent,
    children: [],
  };
  parent.children.push(head);

  // Arms
  const leftArm = createLimbChain(parent, 'left_arm', [-0.2 * scale, 0.15 * scale, 0], 0.7 * scale);
  const rightArm = createLimbChain(parent, 'right_arm', [0.2 * scale, 0.15 * scale, 0], 0.7 * scale);

  // Legs
  const leftLeg = createLimbChain(root, 'left_leg', [-0.1 * scale, -0.5 * scale, 0], 0.9 * scale);
  const rightLeg = createLimbChain(root, 'right_leg', [0.1 * scale, -0.5 * scale, 0], 0.9 * scale);

  return { root, spine, head, leftArm, rightArm, leftLeg, rightLeg };
}

function createLimbChain(
  parent: Bone,
  limbId: string,
  offset: [number, number, number],
  length: number
): Bone[] {
  const chain: Bone[] = [];
  let current = parent;

  const segments = limbId.includes('arm') ? 2 : 2; // Upper and lower segments

  for (let i = 0; i < segments; i++) {
    const bone: Bone = {
      id: `${limbId}_${i}`,
      position: current.position
        .clone()
        .add(new THREE.Vector3(...offset).multiplyScalar(i === 0 ? 1 : 0.5)),
      length: length / segments,
      rotation: new THREE.Quaternion(),
      parent: current,
      children: [],
    };
    current.children.push(bone);
    chain.push(bone);
    current = bone;
  }

  return chain;
}

/**
 * Multi-chain IK solver for full body.
 */
export class FullBodyIKSolver {
  skeleton: HumanoidSkeleton;
  leftFootSolver: FabrikSolver;
  rightFootSolver: FabrikSolver;
  leftHandSolver: FabrikSolver;
  rightHandSolver: FabrikSolver;

  constructor(skeleton: HumanoidSkeleton) {
    this.skeleton = skeleton;
    this.leftFootSolver = new FabrikSolver(skeleton.root);
    this.rightFootSolver = new FabrikSolver(skeleton.root);
    this.leftHandSolver = new FabrikSolver(skeleton.spine[skeleton.spine.length - 1]);
    this.rightHandSolver = new FabrikSolver(skeleton.spine[skeleton.spine.length - 1]);
  }

  /**
   * Solve full body IK for feet on ground and hands positioned.
   */
  solveFullBody(
    leftFootTarget: THREE.Vector3,
    rightFootTarget: THREE.Vector3,
    leftHandTarget?: THREE.Vector3,
    rightHandTarget?: THREE.Vector3
  ) {
    // Solve legs first (high priority - feet on ground)
    this.leftFootSolver.solve(leftFootTarget);
    this.rightFootSolver.solve(rightFootTarget);

    // Solve arms (lower priority)
    if (leftHandTarget) {
      this.leftHandSolver.solve(leftHandTarget);
    }
    if (rightHandTarget) {
      this.rightHandSolver.solve(rightHandTarget);
    }
  }

  /**
   * Get current bone positions for rendering/deformation.
   */
  getAllBonePositions(): Map<string, THREE.Vector3> {
    const positions = new Map<string, THREE.Vector3>();

    const traverse = (bone: Bone) => {
      positions.set(bone.id, bone.position.clone());
      bone.children.forEach(traverse);
    };

    traverse(this.skeleton.root);
    return positions;
  }
}
