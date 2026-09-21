import { Matrix, Quaternion, TransformNode, Vector3 } from '@babylonjs/core';
import type { Node, Skeleton } from '@babylonjs/core';
import { resolveHumanoidJoints } from './humanoid-bone-names';
import {
  HUMANOID_JOINT_COUNT,
  HUMANOID_JOINT_INDEX,
  type HumanoidJoint,
  type HumanoidPose,
} from './humanoid-locomotion';

/**
 * Maps an arbitrary GLB skeleton onto the humanoid joints we animate.
 *
 * Nothing here assumes bone names or bone orientations: names are matched by
 * role patterns against the *actual* hierarchy, and every joint stores the
 * character-space rotation axes expressed in its own parent space, so the same
 * pose data drives Mixamo, Meshy, Tripo or hand-made rigs identically.
 */

export interface HumanoidJointControl {
  node: TransformNode;
  /** Local bind rotation straight from the GLB. */
  rest: Quaternion;
  /** `rest` plus the bind-pose normalisation — the zero point for every pose. */
  base: Quaternion;
  /** Character right / up / forward, expressed in this bone's parent space. */
  axisPitch: Vector3;
  axisYaw: Vector3;
  axisRoll: Vector3;
}

interface HumanoidJointEntry {
  control: HumanoidJointControl;
  offset: number;
}

export interface HumanoidBoneRig {
  joints: Partial<Record<HumanoidJoint, HumanoidJointControl>>;
  /**
   * Per-axis ±1 so pose angles keep their meaning on this rig. The glTF import
   * mirrors the model, and a mirror only reverses rotations around the axes it
   * does not lie on — so pitch, yaw and roll each need their own measurement.
   */
  signPitch: number;
  signYaw: number;
  signRoll: number;
  names: Partial<Record<HumanoidJoint, string>>;
  /** Flat list for allocation-free per-frame updates. */
  entries: HumanoidJointEntry[];
  /**
   * Bind-pose normalisation baked into every joint's `base`: whatever the artist
   * exported (T-pose, A-pose…) becomes the relaxed neutral poses are authored
   * against. Kept for diagnostics.
   */
  neutral: Partial<Record<HumanoidJoint, number>>;
}

interface BoneCandidate {
  name: string;
  depth: number;
  node: TransformNode;
}

function nodeDepth(node: TransformNode) {
  let depth = 0;
  let parent: Node | null = node.parent;
  while (parent) {
    depth++;
    parent = parent.parent;
  }
  return depth;
}

function collectCandidates(skeletons: Skeleton[], transformNodes: TransformNode[]) {
  const seen = new Set<TransformNode>();
  const out: BoneCandidate[] = [];

  const consider = (name: string, node: TransformNode) => {
    if (seen.has(node)) return;
    seen.add(node);
    out.push({ name: name.replace(/__a\d+$/, ''), depth: nodeDepth(node), node });
  };

  // Clone hierarchy first — never bind the humanoid rig to the disabled template.
  for (const node of transformNodes) consider(node.name, node);

  const allowed = new Set<number>();
  for (const tn of transformNodes) {
    let p: Node | null = tn;
    while (p) {
      allowed.add(p.uniqueId);
      p = p.parent;
    }
    const stack: Node[] = [tn];
    while (stack.length) {
      const n = stack.pop()!;
      allowed.add(n.uniqueId);
      for (const child of n.getChildren()) stack.push(child);
    }
  }

  for (const skeleton of skeletons) {
    for (const bone of skeleton.bones) {
      const linked = bone.getTransformNode?.() ?? null;
      if (linked && allowed.has(linked.uniqueId)) consider(bone.name, linked);
    }
  }

  return out;
}

function forceWorldMatrices(leaf: TransformNode) {
  const chain: TransformNode[] = [];
  let current: Node | null = leaf;
  while (current) {
    if (current instanceof TransformNode) chain.push(current);
    current = current.parent;
  }
  for (let i = chain.length - 1; i >= 0; i--) {
    chain[i].computeWorldMatrix(true);
  }
}

const scratchMatrix = new Matrix();
const scratchInverse = new Matrix();
const scratchProbe = new Quaternion();
const scratchLocal = new Vector3();
const scratchLocalB = new Vector3();

function buildControl(node: TransformNode, visual: TransformNode): HumanoidJointControl {
  const rest =
    node.rotationQuaternion?.clone() ??
    Quaternion.RotationYawPitchRoll(node.rotation.y, node.rotation.x, node.rotation.z);
  node.rotationQuaternion = rest.clone();

  const control: HumanoidJointControl = {
    node,
    rest,
    base: rest.clone(),
    axisPitch: Vector3.Right(),
    axisYaw: Vector3.Up(),
    axisRoll: Vector3.Forward(),
  };
  refreshControlAxes(control, visual);
  return control;
}

/**
 * Re-samples the character axes inside the bone's own local frame.
 *
 * `base.multiply(delta)` applies `delta` *before* the bone's own rotation
 * (Babylon composes right-to-left), so the axes must live in the space the local
 * matrix maps from — the bone's frame, not its parent's. Re-run this whenever
 * anything upstream moves, or a child would rotate around a stale axis.
 */
function refreshControlAxes(control: HumanoidJointControl, visual: TransformNode) {
  control.node.getWorldMatrix().invertToRef(scratchInverse);
  visual.getWorldMatrix().multiplyToRef(scratchInverse, scratchMatrix);
  Vector3.TransformNormalToRef(Vector3.Right(), scratchMatrix, control.axisPitch);
  Vector3.TransformNormalToRef(Vector3.Up(), scratchMatrix, control.axisYaw);
  Vector3.TransformNormalToRef(Vector3.Forward(), scratchMatrix, control.axisRoll);
  control.axisPitch.normalize();
  control.axisYaw.normalize();
  control.axisRoll.normalize();
}

/** Position of a node in character space (returns the shared scratch vector). */
function charPosition(node: TransformNode, visual: TransformNode) {
  forceWorldMatrices(node);
  visual.getWorldMatrix().invertToRef(scratchInverse);
  Vector3.TransformCoordinatesToRef(node.absolutePosition, scratchInverse, scratchLocal);
  return scratchLocal;
}

/**
 * Rigs disagree on bone orientation and the glTF import mirrors the model, so we
 * measure instead of guessing: nudge one joint and see which way its child
 * actually travelled in character space.
 */
function probeAxisSign(
  control: HumanoidJointControl,
  axis: Vector3,
  sample: () => number,
): number {
  const target = control.node.rotationQuaternion;
  if (!target) return 0;
  const before = sample();
  Quaternion.RotationAxisToRef(axis, 0.4, scratchProbe);
  control.base.multiplyToRef(scratchProbe, target);
  const after = sample();
  target.copyFrom(control.base);
  const delta = after - before;
  if (delta > 1e-4) return 1;
  if (delta < -1e-4) return -1;
  return 0;
}

/** How far the arms should sit from vertical once the bind pose is normalised. */
const NEUTRAL_ARM_SPREAD = 0.13;

/**
 * Angle of a bone chain away from straight-down, in the character's XY plane —
 * measured in the same convention as pose `roll`, so the difference from the
 * wanted neutral *is* the correction to apply.
 */
function measureSpread(from: TransformNode, to: TransformNode, visual: TransformNode) {
  forceWorldMatrices(to);
  visual.getWorldMatrix().invertToRef(scratchInverse);
  Vector3.TransformCoordinatesToRef(from.absolutePosition, scratchInverse, scratchLocal);
  Vector3.TransformCoordinatesToRef(to.absolutePosition, scratchInverse, scratchLocalB);
  const dx = scratchLocalB.x - scratchLocal.x;
  const dy = scratchLocalB.y - scratchLocal.y;
  if (Math.hypot(dx, dy) < 1e-4) return null;
  return Math.atan2(dx, -dy);
}

export function buildHumanoidBoneRig(
  visual: TransformNode,
  skeletons: Skeleton[],
  transformNodes: TransformNode[],
): HumanoidBoneRig | null {
  if (!skeletons.length) return null;
  const candidates = collectCandidates(skeletons, transformNodes);
  if (!candidates.length) return null;

  const resolved = resolveHumanoidJoints(candidates);
  if (resolved.missing.length) {
    console.warn('[lobby-sdk] humanoid rig incomplete, falling back to simple pivots', {
      missing: resolved.missing,
      found: Object.entries(resolved.joints).map(([joint, ref]) => `${joint}=${ref?.name}`),
      bones: [...new Set(candidates.map((c) => c.name))],
    });
    return null;
  }

  const nodes: Partial<Record<HumanoidJoint, TransformNode>> = {};
  for (const joint of Object.keys(resolved.joints) as HumanoidJoint[]) {
    const ref = resolved.joints[joint];
    if (ref) nodes[joint] = ref.node;
  }

  visual.computeWorldMatrix(true);
  const joints: Partial<Record<HumanoidJoint, HumanoidJointControl>> = {};
  const names: Partial<Record<HumanoidJoint, string>> = {};
  const entries: HumanoidJointEntry[] = [];
  for (const joint of Object.keys(nodes) as HumanoidJoint[]) {
    const node = nodes[joint];
    if (!node) continue;
    forceWorldMatrices(node);
    const control = buildControl(node, visual);
    joints[joint] = control;
    names[joint] = node.name;
    entries.push({ control, offset: HUMANOID_JOINT_INDEX[joint] * 3 });
  }

  /** Limb chains, most reliable first: a long chain gives the clearest signal. */
  const limbProbes: [HumanoidJoint, HumanoidJoint, number][] = [
    ['thighL', 'footL', 1],
    ['thighL', 'shinL', 1],
    ['upperArmL', 'handL', 1],
    ['upperArmL', 'foreArmL', 1],
    ['thighR', 'footR', -1],
    ['upperArmR', 'handR', -1],
  ];
  /** Torso twist reads off the shoulders: turning left brings the right arm forward. */
  const twistProbes: [HumanoidJoint, HumanoidJoint, HumanoidJoint][] = [
    ['chest', 'handR', 'handL'],
    ['chest', 'foreArmR', 'foreArmL'],
    ['spine', 'handR', 'handL'],
    ['hips', 'footR', 'footL'],
  ];

  const measureSigns = () => {
    let pitch = 0;
    let roll = 0;
    let yaw = 0;
    for (const [jointKey, probeKey, mirror] of limbProbes) {
      const control = joints[jointKey];
      const probe = nodes[probeKey];
      if (!control || !probe) continue;
      // Swinging a limb by +pitch must carry it forward (+Z)…
      if (pitch === 0) {
        pitch = probeAxisSign(control, control.axisPitch, () => charPosition(probe, visual).z);
      }
      // …and +roll must tilt it toward the character's right (+X).
      if (roll === 0) {
        roll = probeAxisSign(control, control.axisRoll, () => charPosition(probe, visual).x) * mirror;
      }
      if (pitch !== 0 && roll !== 0) break;
    }
    for (const [jointKey, rightKey, leftKey] of twistProbes) {
      if (yaw !== 0) break;
      const control = joints[jointKey];
      const right = nodes[rightKey];
      const left = nodes[leftKey];
      if (!control || !right || !left) continue;
      yaw = probeAxisSign(control, control.axisYaw, () => {
        const rz = charPosition(right, visual).z;
        return rz - charPosition(left, visual).z;
      });
    }
    return {
      signPitch: pitch || 1,
      signYaw: yaw || 1,
      signRoll: roll || 1,
    };
  };

  let signs = measureSigns();

  // A T-posed upload would otherwise stand with its arms straight out, so fold
  // whatever bind pose the artist exported into a relaxed neutral…
  const neutral: Partial<Record<HumanoidJoint, number>> = {};
  for (const side of ['L', 'R'] as const) {
    const joint = `upperArm${side}` as HumanoidJoint;
    const control = joints[joint];
    const distal =
      nodes[`hand${side}` as HumanoidJoint] ?? nodes[`foreArm${side}` as HumanoidJoint];
    if (!control || !distal) continue;
    const spread = measureSpread(control.node, distal, visual);
    if (spread === null) continue;
    const target = side === 'L' ? -NEUTRAL_ARM_SPREAD : NEUTRAL_ARM_SPREAD;
    const correction = Math.max(-1.6, Math.min(1.6, target - spread));
    if (Math.abs(correction) < 1e-3) continue;
    neutral[joint] = correction;
    Quaternion.RotationAxisToRef(control.axisRoll, correction * signs.signRoll, scratchProbe);
    control.rest.multiplyToRef(scratchProbe, control.base);
  }

  // …then re-sample every axis in that neutral, so elbows and hands rotate
  // around the character's axes and not around the bind pose's.
  for (const entry of entries) {
    entry.control.node.rotationQuaternion?.copyFrom(entry.control.base);
  }
  for (const entry of entries) forceWorldMatrices(entry.control.node);
  for (const entry of entries) refreshControlAxes(entry.control, visual);
  signs = measureSigns();
  for (const entry of entries) {
    entry.control.node.rotationQuaternion?.copyFrom(entry.control.base);
  }

  console.info('[lobby-sdk] humanoid rig bound', { ...signs, neutral, joints: names });
  return { joints, ...signs, names, entries, neutral };
}

const poseDelta = new Quaternion();
const poseStep = new Quaternion();

/** Writes a pose onto the skeleton as pure bone rotations (never translations). */
export function applyHumanoidPose(rig: HumanoidBoneRig, pose: HumanoidPose) {
  const { signPitch, signYaw, signRoll } = rig;
  const angles = pose.angles;
  for (const entry of rig.entries) {
    const control = entry.control;
    let target = control.node.rotationQuaternion;
    if (!target) {
      target = control.base.clone();
      control.node.rotationQuaternion = target;
    }

    const pitch = angles[entry.offset] * signPitch;
    const yaw = angles[entry.offset + 1] * signYaw;
    const roll = angles[entry.offset + 2] * signRoll;

    if (pitch === 0 && yaw === 0 && roll === 0) {
      target.copyFrom(control.base);
      continue;
    }

    Quaternion.RotationAxisToRef(control.axisPitch, pitch, poseDelta);
    if (yaw !== 0) {
      Quaternion.RotationAxisToRef(control.axisYaw, yaw, poseStep);
      poseDelta.multiplyToRef(poseStep, poseDelta);
    }
    if (roll !== 0) {
      Quaternion.RotationAxisToRef(control.axisRoll, roll, poseStep);
      poseDelta.multiplyToRef(poseStep, poseDelta);
    }
    control.base.multiplyToRef(poseDelta, target);
  }
}
