import { Quaternion, TransformNode, Vector3 } from '@babylonjs/core';
import type { Skeleton } from '@babylonjs/core';
import { type HumanoidJoint, type HumanoidPose } from './humanoid-locomotion';
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
export declare function buildHumanoidBoneRig(visual: TransformNode, skeletons: Skeleton[], transformNodes: TransformNode[]): HumanoidBoneRig | null;
/** Writes a pose onto the skeleton as pure bone rotations (never translations). */
export declare function applyHumanoidPose(rig: HumanoidBoneRig, pose: HumanoidPose): void;
export {};
//# sourceMappingURL=humanoid-rig.d.ts.map