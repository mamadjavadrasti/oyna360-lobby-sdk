import type { HumanoidJoint } from './humanoid-locomotion';

/**
 * Skeleton name → humanoid joint resolution (pure, no Babylon import).
 *
 * Rig naming is wildly inconsistent (Mixamo `LeftUpLeg`, Meshy `LeftLeg` for the
 * shin, Tripo `L_Thigh`, Blender `thigh.L`), and spine chains are sometimes
 * numbered downwards (`Hips → Spine02 → Spine01 → Spine`). So roles come from
 * name patterns while ordering comes from the real hierarchy depth.
 */

export type BoneRole =
  | 'hips'
  | 'spineish'
  | 'neck'
  | 'head'
  | 'shoulder'
  | 'upperArm'
  | 'foreArm'
  | 'hand'
  | 'thigh'
  | 'shin'
  | 'foot';

export type BoneSide = 'L' | 'R';

export interface BoneRef {
  name: string;
  /** Distance from the hierarchy root; used to order chains and skip helpers. */
  depth: number;
}

/** Nodes that are containers or leaf markers, never animated joints. */
const IGNORED = /^(__root__|root|armature|scene|world|skeleton|humanoidrootnode|mesh_?\d*)(__a\d+)?$/;
const TIP = /(end|tip|nub|front|top)$/;

const ROLE_PATTERNS: [RegExp, BoneRole][] = [
  [/^hips?\d*$|pelvis/, 'hips'],
  [/spine|chest|torso|waist|abdomen|upperbody|ribcage/, 'spineish'],
  [/neck/, 'neck'],
  [/^head\d*$/, 'head'],
  [/shoulder|clavicle|collar/, 'shoulder'],
  [/forearm|lowerarm|elbow/, 'foreArm'],
  [/upperarm|^arm\d*$|humerus/, 'upperArm'],
  [/^hand\d*$|wrist/, 'hand'],
  [/upleg|thigh|upperleg|femur/, 'thigh'],
  [/lowerleg|^leg\d*$|calf|shin|knee|tibia/, 'shin'],
  [/^foot\d*$|ankle/, 'foot'],
];

export function normalizeBoneName(name: string) {
  return name.toLowerCase().replace(/^mixamorig[:_]?/, '');
}

export function detectBoneSide(raw: string): BoneSide | null {
  if (raw.includes('left')) return 'L';
  if (raw.includes('right')) return 'R';
  if (/(^|[_.\- ])l([_.\- ]|\d|$)/.test(raw)) return 'L';
  if (/(^|[_.\- ])r([_.\- ]|\d|$)/.test(raw)) return 'R';
  return null;
}

/** Strips side markers without eating letters ("LeftLeg" → "leg", "L_Thigh" → "thigh"). */
export function boneCoreName(raw: string) {
  return raw
    .replace(/left|right/g, '')
    .replace(/(^|[_.\- ])[lr]([_.\- ])/g, '$1')
    .replace(/(^|[_.\- ])[lr]$/, '')
    .replace(/[^a-z0-9]/g, '');
}

export function detectBoneRole(core: string): BoneRole | null {
  for (const [pattern, role] of ROLE_PATTERNS) {
    if (pattern.test(core)) return role;
  }
  return null;
}

export interface ClassifiedBone<T extends BoneRef> {
  ref: T;
  role: BoneRole;
  side: BoneSide | null;
}

export function classifyBone<T extends BoneRef>(ref: T): ClassifiedBone<T> | null {
  const raw = normalizeBoneName(ref.name);
  if (IGNORED.test(raw)) return null;
  const core = boneCoreName(raw);
  if (!core || TIP.test(core) || core.startsWith('toe')) return null;
  const role = detectBoneRole(core);
  if (!role) return null;
  return { ref, role, side: detectBoneSide(raw) };
}

/** Shallowest wins: primary bones sit above twist/helper bones in the hierarchy. */
function pickPrimary<T extends BoneRef>(
  bones: ClassifiedBone<T>[],
  role: BoneRole,
  side: BoneSide | null,
) {
  let best: ClassifiedBone<T> | null = null;
  for (const bone of bones) {
    if (bone.role !== role || bone.side !== side) continue;
    if (
      !best ||
      bone.ref.depth < best.ref.depth ||
      (bone.ref.depth === best.ref.depth && bone.ref.name.length < best.ref.name.length)
    ) {
      best = bone;
    }
  }
  return best?.ref ?? null;
}

const SIDED: [HumanoidJoint, BoneRole, BoneSide][] = [
  ['shoulderL', 'shoulder', 'L'],
  ['shoulderR', 'shoulder', 'R'],
  ['upperArmL', 'upperArm', 'L'],
  ['upperArmR', 'upperArm', 'R'],
  ['foreArmL', 'foreArm', 'L'],
  ['foreArmR', 'foreArm', 'R'],
  ['handL', 'hand', 'L'],
  ['handR', 'hand', 'R'],
  ['thighL', 'thigh', 'L'],
  ['thighR', 'thigh', 'R'],
  ['shinL', 'shin', 'L'],
  ['shinR', 'shin', 'R'],
  ['footL', 'foot', 'L'],
  ['footR', 'foot', 'R'],
];

/** Joints without which no believable walk cycle is possible. */
export const REQUIRED_JOINTS: HumanoidJoint[] = [
  'thighL',
  'thighR',
  'upperArmL',
  'upperArmR',
];

export function resolveHumanoidJoints<T extends BoneRef>(refs: readonly T[]) {
  const bones: ClassifiedBone<T>[] = [];
  for (const ref of refs) {
    const classified = classifyBone(ref);
    if (classified) bones.push(classified);
  }

  const joints: Partial<Record<HumanoidJoint, T>> = {};
  const assign = (joint: HumanoidJoint, role: BoneRole, side: BoneSide | null) => {
    const found = pickPrimary(bones, role, side);
    if (found) joints[joint] = found;
  };

  assign('hips', 'hips', null);
  assign('neck', 'neck', null);
  assign('head', 'head', null);
  for (const [joint, role, side] of SIDED) assign(joint, role, side);

  // Depth, not the number in the name, decides which vertebra is the chest:
  // Meshy exports `Hips → Spine02 → Spine01 → Spine`, Mixamo does the reverse.
  const spineChain = bones
    .filter((b) => b.role === 'spineish')
    .sort((a, b) => a.ref.depth - b.ref.depth || a.ref.name.length - b.ref.name.length);
  if (spineChain.length) {
    joints.spine = spineChain[0].ref;
    if (spineChain.length > 1) joints.chest = spineChain[spineChain.length - 1].ref;
  }

  const missing = REQUIRED_JOINTS.filter((joint) => !joints[joint]);
  return { joints, missing, classified: bones };
}
