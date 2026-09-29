/**
 * Procedural humanoid locomotion (pure math, no Babylon import).
 *
 * Angle convention — every value below is expressed in *character space*, so it
 * stays correct no matter how the GLB skeleton is oriented:
 *   pitch > 0 → distal end of the bone swings forward (character +Z)
 *   yaw   > 0 → distal end swings toward the character's left
 *   roll  > 0 → distal end tilts toward the character's right
 *
 * `humanoid-rig.ts` converts these into per-bone parent-space rotations.
 */

export const HUMANOID_JOINT_INDEX = {
  hips: 0,
  spine: 1,
  chest: 2,
  neck: 3,
  head: 4,
  shoulderL: 5,
  shoulderR: 6,
  upperArmL: 7,
  upperArmR: 8,
  foreArmL: 9,
  foreArmR: 10,
  handL: 11,
  handR: 12,
  thighL: 13,
  thighR: 14,
  shinL: 15,
  shinR: 16,
  footL: 17,
  footR: 18,
} as const;

export type HumanoidJoint = keyof typeof HUMANOID_JOINT_INDEX;

export const HUMANOID_JOINTS = Object.keys(HUMANOID_JOINT_INDEX) as HumanoidJoint[];
export const HUMANOID_JOINT_COUNT = HUMANOID_JOINTS.length;

const TAU = Math.PI * 2;

/** Additive pose buffer — zero allocation per frame. */
export class HumanoidPose {
  /** [pitch, yaw, roll] per joint, radians. */
  readonly angles = new Float32Array(HUMANOID_JOINT_COUNT * 3);
  /** Vertical body bob in metres (applied to the avatar root, never to bones). */
  bob = 0;

  reset() {
    this.angles.fill(0);
    this.bob = 0;
  }

  add(joint: HumanoidJoint, pitch: number, yaw: number, roll: number, weight = 1) {
    if (weight === 0) return;
    const i = HUMANOID_JOINT_INDEX[joint] * 3;
    this.angles[i] += pitch * weight;
    this.angles[i + 1] += yaw * weight;
    this.angles[i + 2] += roll * weight;
  }

  pitch(joint: HumanoidJoint) {
    return this.angles[HUMANOID_JOINT_INDEX[joint] * 3];
  }

  yaw(joint: HumanoidJoint) {
    return this.angles[HUMANOID_JOINT_INDEX[joint] * 3 + 1];
  }

  roll(joint: HumanoidJoint) {
    return this.angles[HUMANOID_JOINT_INDEX[joint] * 3 + 2];
  }
}

export interface GaitParams {
  /** Cycles per second at the reference speed (one cycle = two steps). */
  frequency: number;
  /** Thigh forward/back amplitude. */
  thighSwing: number;
  /** Peak knee flexion at mid-swing. */
  kneeSwing: number;
  /** Small knee flexion while the foot carries the body. */
  kneeStance: number;
  /** How much the ankle counter-rotates to keep the sole level (0..1). */
  footLevel: number;
  /** Extra plantar flexion (toes down) at toe-off. */
  toeOff: number;
  armSwing: number;
  elbowBase: number;
  elbowSwing: number;
  /** Constant inward roll so arms stay close to the body. */
  armTuck: number;
  shoulderFollow: number;
  hipsPitch: number;
  hipsYaw: number;
  hipsRoll: number;
  /** Torso counter-rotation against the pelvis. */
  chestYaw: number;
  chestRoll: number;
  /** Forward lean, split between spine and chest. */
  lean: number;
  headYaw: number;
  bob: number;
}

export const WALK_GAIT: GaitParams = {
  frequency: 1.45,
  // Thigh drives the step; knee does the recovery — not a stiff whole-leg pendulum.
  thighSwing: 0.34,
  kneeSwing: 0.78,
  kneeStance: 0.12,
  footLevel: 0.7,
  toeOff: 0.12,
  // Modest arms, opposite the legs; kept in front of the torso envelope.
  armSwing: 0.22,
  elbowBase: 0.2,
  elbowSwing: 0.12,
  armTuck: 0.06,
  shoulderFollow: 0.06,
  // Almost no hip sway — Roblox-style walk is upright and tidy.
  hipsPitch: 0.008,
  hipsYaw: 0.018,
  hipsRoll: 0.012,
  chestYaw: 0.028,
  chestRoll: 0.01,
  lean: 0.02,
  headYaw: 0.012,
  bob: 0.018,
};

export const RUN_GAIT: GaitParams = {
  // Roblox-style high-knee run: thigh lifts, knee folds hard so the foot clears.
  frequency: 2.4,
  thighSwing: 0.52,
  kneeSwing: 1.32,
  kneeStance: 0.2,
  footLevel: 0.55,
  toeOff: 0.18,
  // Opposite arms match the bigger stride, still close to the body.
  armSwing: 0.4,
  elbowBase: 0.52,
  elbowSwing: 0.22,
  armTuck: 0.05,
  shoulderFollow: 0.1,
  // Stable upright torso — almost no hip/chest rock while running.
  hipsPitch: 0.006,
  hipsYaw: 0.012,
  hipsRoll: 0.008,
  chestYaw: 0.02,
  chestRoll: 0.008,
  lean: 0.04,
  headYaw: 0.01,
  bob: 0.032,
};

const GAIT_KEYS = Object.keys(WALK_GAIT) as (keyof GaitParams)[];

/** Cross-fade walk → run in place (same phase, so the blend never snaps). */
export function lerpGait(out: GaitParams, a: GaitParams, b: GaitParams, t: number) {
  const k = t < 0 ? 0 : t > 1 ? 1 : t;
  for (const key of GAIT_KEYS) {
    out[key] = a[key] + (b[key] - a[key]) * k;
  }
  return out;
}

export function cloneGait(source: GaitParams): GaitParams {
  return { ...source };
}

/**
 * One leg of the cycle. `theta` walks 0 → 2π across a full stride:
 *   π/2  contact (thigh forward, knee nearly straight)
 *   π    mid-stance / passing (body rides over the planted foot)
 *   3π/2 toe-off (thigh back)
 *   0/2π mid-swing (leg passes under the hips with the knee bent)
 *
 * Thigh pitch is softened at toe-off so the limb doesn't look kicked from the hip.
 */
function writeLeg(
  pose: HumanoidPose,
  thigh: HumanoidJoint,
  shin: HumanoidJoint,
  foot: HumanoidJoint,
  theta: number,
  g: GaitParams,
  weight: number,
) {
  const s = Math.sin(theta);
  const c = Math.cos(theta);
  const swingPhase = c > 0 ? c : 0;
  const stancePhase = c < 0 ? -c : 0;

  // Thigh drives stride; knee carries recovery so it never looks like a stiff stick from the hip.
  const thighPitch = g.thighSwing * s;
  // Knee does the recovery lift; stance stays softly bent, never locked.
  const kneeFlex =
    g.kneeSwing * Math.pow(swingPhase, 1.35) + g.kneeStance * (0.55 + 0.45 * stancePhase);
  const shinPitch = -kneeFlex;
  const footPitch = -(thighPitch + shinPitch) * g.footLevel - g.toeOff * (s < 0 ? -s : 0);

  pose.add(thigh, thighPitch, 0, 0, weight);
  pose.add(shin, shinPitch, 0, 0, weight);
  pose.add(foot, footPitch, 0, 0, weight);
}

/**
 * Arms counter the opposite leg. Forward swing is stronger than rearward so
 * hands never look yanked behind the torso (common Roblox-style feel).
 */
function writeArm(
  pose: HumanoidPose,
  shoulder: HumanoidJoint,
  upperArm: HumanoidJoint,
  foreArm: HumanoidJoint,
  hand: HumanoidJoint,
  theta: number,
  inward: number,
  g: GaitParams,
  weight: number,
) {
  const s = Math.sin(theta);
  const armPitch = g.armSwing * (s > 0 ? s : s * 0.45);
  const elbow = g.elbowBase + g.elbowSwing * (s > 0 ? s : 0);

  pose.add(shoulder, armPitch * g.shoulderFollow, 0, 0, weight);
  pose.add(upperArm, armPitch, 0, g.armTuck * inward, weight);
  pose.add(foreArm, elbow, 0, 0, weight);
  pose.add(hand, elbow * 0.1, 0, 0, weight);
}

/**
 * Full walk/run cycle at normalized `phase` (0..1, wraps seamlessly).
 * Left leg leads at phase 0.25, right leg at 0.75.
 */
export function writeGaitPose(
  pose: HumanoidPose,
  phase: number,
  g: GaitParams,
  weight: number,
) {
  if (weight <= 0) return;
  const thetaL = phase * TAU;
  const thetaR = thetaL + Math.PI;

  writeLeg(pose, 'thighL', 'shinL', 'footL', thetaL, g, weight);
  writeLeg(pose, 'thighR', 'shinR', 'footR', thetaR, g, weight);
  writeArm(pose, 'shoulderL', 'upperArmL', 'foreArmL', 'handL', thetaR, 1, g, weight);
  writeArm(pose, 'shoulderR', 'upperArmR', 'foreArmR', 'handR', thetaL, -1, g, weight);

  const s = Math.sin(thetaL);
  // Pelvis leads, ribcage counters it — that opposition is what reads as "alive".
  pose.add('hips', g.hipsPitch, g.hipsYaw * s, g.hipsRoll * s, weight);
  pose.add('spine', g.lean * 0.45, -g.chestYaw * 0.4 * s, -g.chestRoll * 0.45 * s, weight);
  pose.add('chest', g.lean * 0.55, -g.chestYaw * 0.6 * s, -g.chestRoll * 0.55 * s, weight);
  pose.add('neck', -g.lean * 0.5, g.headYaw * 0.4 * s, 0, weight);
  pose.add('head', -g.lean * 0.35, g.headYaw * s, 0, weight);

  // Two rises per cycle: lowest at each contact, highest at mid-stance.
  pose.bob += g.bob * Math.cos(2 * thetaL) * weight;
}

/** Calm standing pose: planted feet, slow breathing, a touch of sway. */
export function writeIdlePose(pose: HumanoidPose, time: number, weight: number) {
  if (weight <= 0) return;
  const breath = Math.sin(time * 1.7);
  const sway = Math.sin(time * 0.63);
  const shift = Math.sin(time * 0.41);

  pose.add('hips', 0.004 * breath, 0.008 * sway, 0.01 * shift, weight);
  pose.add('spine', 0.009 * breath, -0.006 * sway, -0.006 * shift, weight);
  pose.add('chest', 0.014 * breath, -0.005 * sway, -0.005 * shift, weight);
  pose.add('neck', -0.008 * breath, 0.009 * sway, 0, weight);
  pose.add('head', -0.006 * breath, 0.013 * sway, 0.005 * shift, weight);

  pose.add('shoulderL', 0.01 * breath, 0, 0, weight);
  pose.add('shoulderR', 0.01 * breath, 0, 0, weight);
  pose.add('upperArmL', 0.03 + 0.014 * breath, 0, 0.08, weight);
  pose.add('upperArmR', 0.03 + 0.014 * breath, 0, -0.08, weight);
  pose.add('foreArmL', 0.13 + 0.018 * breath, 0, 0, weight);
  pose.add('foreArmR', 0.13 + 0.018 * breath, 0, 0, weight);
  pose.add('handL', 0.02, 0, 0.03, weight);
  pose.add('handR', 0.02, 0, -0.03, weight);

  // Feet stay planted — only a hint of knee softness so the legs aren't stiff.
  pose.add('shinL', -0.028, 0, 0, weight);
  pose.add('shinR', -0.028, 0, 0, weight);
  pose.add('footL', 0.016, 0, 0, weight);
  pose.add('footR', 0.016, 0, 0, weight);

  pose.bob += 0.005 * breath * weight;
}

export function writeAirPose(pose: HumanoidPose, rising: boolean, weight: number) {
  if (weight <= 0) return;
  if (rising) {
    // Compact takeoff: legs tuck a little; arms float slightly forward + out (not pinned).
    pose.add('hips', -0.02, 0, 0, weight);
    pose.add('spine', -0.03, 0, 0, weight);
    pose.add('chest', -0.025, 0, 0, weight);
    pose.add('thighL', 0.28, 0, 0, weight);
    pose.add('shinL', -0.52, 0, 0, weight);
    pose.add('footL', 0.12, 0, 0, weight);
    pose.add('thighR', 0.14, 0, 0, weight);
    pose.add('shinR', -0.28, 0, 0, weight);
    pose.add('footR', 0.08, 0, 0, weight);
    // pitch > 0 = forward; roll opposite of idle tuck = mild outward.
    pose.add('upperArmL', 0.22, 0, -0.22, weight);
    pose.add('upperArmR', 0.22, 0, 0.22, weight);
    pose.add('foreArmL', 0.32, 0, 0, weight);
    pose.add('foreArmR', 0.32, 0, 0, weight);
    pose.add('handL', 0.04, 0, 0, weight);
    pose.add('handR', 0.04, 0, 0, weight);
    return;
  }
  // Landing prep: knees soften; arms stay slightly forward/out for balance.
  pose.add('spine', 0.04, 0, 0, weight);
  pose.add('chest', 0.03, 0, 0, weight);
  pose.add('hips', 0.02, 0, 0, weight);
  pose.add('thighL', 0.22, 0, 0, weight);
  pose.add('shinL', -0.48, 0, 0, weight);
  pose.add('footL', 0.14, 0, 0, weight);
  pose.add('thighR', 0.16, 0, 0, weight);
  pose.add('shinR', -0.42, 0, 0, weight);
  pose.add('footR', 0.12, 0, 0, weight);
  pose.add('upperArmL', 0.16, 0, -0.2, weight);
  pose.add('upperArmR', 0.16, 0, 0.2, weight);
  pose.add('foreArmL', 0.28, 0, 0, weight);
  pose.add('foreArmR', 0.28, 0, 0, weight);
}

export function writeSlidePose(pose: HumanoidPose, weight: number) {
  if (weight <= 0) return;
  pose.add('hips', 0.34, 0, 0, weight);
  pose.add('spine', 0.16, 0, 0.04, weight);
  pose.add('chest', 0.12, 0, 0.03, weight);
  pose.add('head', -0.22, 0, 0, weight);
  pose.add('thighL', 0.7, 0, 0.06, weight);
  pose.add('thighR', 0.82, 0, -0.04, weight);
  pose.add('shinL', -0.35, 0, 0, weight);
  pose.add('shinR', -0.22, 0, 0, weight);
  pose.add('upperArmL', 0.55, 0, 0.3, weight);
  pose.add('upperArmR', 0.62, 0, -0.3, weight);
  pose.add('foreArmL', 0.4, 0, 0, weight);
  pose.add('foreArmR', 0.4, 0, 0, weight);
  pose.bob -= 0.04 * weight;
}

/** Exponential smoothing that is stable for any dt. */
export function approach(current: number, target: number, tau: number, dt: number) {
  if (tau <= 0) return target;
  return current + (target - current) * (1 - Math.exp(-dt / tau));
}

/**
 * Cadence locked to real speed so the feet never scrub the floor:
 * frequency scales linearly with velocity, clamped to a believable range.
 */
export function gaitFrequency(speed: number, referenceSpeed: number, gait: GaitParams) {
  const ref = referenceSpeed > 0.01 ? referenceSpeed : 1;
  const ratio = speed / ref;
  const clamped = ratio < 0.4 ? 0.4 : ratio > 1.35 ? 1.35 : ratio;
  return gait.frequency * clamped;
}

const CONTACT_PHASES = [0.25, 0.75];

/** How many foot contacts happen when the cycle advances by `advance` from `prevPhase`. */
export function footContacts(prevPhase: number, advance: number) {
  if (advance <= 0) return 0;
  const prev = prevPhase - Math.floor(prevPhase);
  let hits = 0;
  for (const contact of CONTACT_PHASES) {
    let delta = contact - prev;
    if (delta <= 0) delta += 1;
    while (delta <= advance) {
      hits++;
      delta += 1;
    }
  }
  return hits;
}
