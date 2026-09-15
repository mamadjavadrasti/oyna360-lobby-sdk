import type { HumanoidJoint } from './humanoid-locomotion';
/**
 * Skeleton name → humanoid joint resolution (pure, no Babylon import).
 *
 * Rig naming is wildly inconsistent (Mixamo `LeftUpLeg`, Meshy `LeftLeg` for the
 * shin, Tripo `L_Thigh`, Blender `thigh.L`), and spine chains are sometimes
 * numbered downwards (`Hips → Spine02 → Spine01 → Spine`). So roles come from
 * name patterns while ordering comes from the real hierarchy depth.
 */
export type BoneRole = 'hips' | 'spineish' | 'neck' | 'head' | 'shoulder' | 'upperArm' | 'foreArm' | 'hand' | 'thigh' | 'shin' | 'foot';
export type BoneSide = 'L' | 'R';
export interface BoneRef {
    name: string;
    /** Distance from the hierarchy root; used to order chains and skip helpers. */
    depth: number;
}
export declare function normalizeBoneName(name: string): string;
export declare function detectBoneSide(raw: string): BoneSide | null;
/** Strips side markers without eating letters ("LeftLeg" → "leg", "L_Thigh" → "thigh"). */
export declare function boneCoreName(raw: string): string;
export declare function detectBoneRole(core: string): BoneRole | null;
export interface ClassifiedBone<T extends BoneRef> {
    ref: T;
    role: BoneRole;
    side: BoneSide | null;
}
export declare function classifyBone<T extends BoneRef>(ref: T): ClassifiedBone<T> | null;
/** Joints without which no believable walk cycle is possible. */
export declare const REQUIRED_JOINTS: HumanoidJoint[];
export declare function resolveHumanoidJoints<T extends BoneRef>(refs: readonly T[]): {
    joints: Partial<Record<"hips" | "spine" | "chest" | "neck" | "head" | "shoulderL" | "shoulderR" | "upperArmL" | "upperArmR" | "foreArmL" | "foreArmR" | "handL" | "handR" | "thighL" | "thighR" | "shinL" | "shinR" | "footL" | "footR", T>>;
    missing: ("hips" | "spine" | "chest" | "neck" | "head" | "shoulderL" | "shoulderR" | "upperArmL" | "upperArmR" | "foreArmL" | "foreArmR" | "handL" | "handR" | "thighL" | "thighR" | "shinL" | "shinR" | "footL" | "footR")[];
    classified: ClassifiedBone<T>[];
};
//# sourceMappingURL=humanoid-bone-names.d.ts.map