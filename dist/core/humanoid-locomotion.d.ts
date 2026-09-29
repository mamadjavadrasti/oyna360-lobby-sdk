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
export declare const HUMANOID_JOINT_INDEX: {
    readonly hips: 0;
    readonly spine: 1;
    readonly chest: 2;
    readonly neck: 3;
    readonly head: 4;
    readonly shoulderL: 5;
    readonly shoulderR: 6;
    readonly upperArmL: 7;
    readonly upperArmR: 8;
    readonly foreArmL: 9;
    readonly foreArmR: 10;
    readonly handL: 11;
    readonly handR: 12;
    readonly thighL: 13;
    readonly thighR: 14;
    readonly shinL: 15;
    readonly shinR: 16;
    readonly footL: 17;
    readonly footR: 18;
};
export type HumanoidJoint = keyof typeof HUMANOID_JOINT_INDEX;
export declare const HUMANOID_JOINTS: HumanoidJoint[];
export declare const HUMANOID_JOINT_COUNT: number;
/** Additive pose buffer — zero allocation per frame. */
export declare class HumanoidPose {
    /** [pitch, yaw, roll] per joint, radians. */
    readonly angles: Float32Array<ArrayBuffer>;
    /** Vertical body bob in metres (applied to the avatar root, never to bones). */
    bob: number;
    reset(): void;
    add(joint: HumanoidJoint, pitch: number, yaw: number, roll: number, weight?: number): void;
    pitch(joint: HumanoidJoint): number;
    yaw(joint: HumanoidJoint): number;
    roll(joint: HumanoidJoint): number;
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
export declare const WALK_GAIT: GaitParams;
export declare const RUN_GAIT: GaitParams;
/** Cross-fade walk → run in place (same phase, so the blend never snaps). */
export declare function lerpGait(out: GaitParams, a: GaitParams, b: GaitParams, t: number): GaitParams;
export declare function cloneGait(source: GaitParams): GaitParams;
/**
 * Full walk/run cycle at normalized `phase` (0..1, wraps seamlessly).
 * Left leg leads at phase 0.25, right leg at 0.75.
 */
export declare function writeGaitPose(pose: HumanoidPose, phase: number, g: GaitParams, weight: number): void;
/** Calm standing pose: planted feet, slow breathing, a touch of sway. */
export declare function writeIdlePose(pose: HumanoidPose, time: number, weight: number): void;
export declare function writeAirPose(pose: HumanoidPose, rising: boolean, weight: number): void;
export declare function writeSlidePose(pose: HumanoidPose, weight: number): void;
/** Exponential smoothing that is stable for any dt. */
export declare function approach(current: number, target: number, tau: number, dt: number): number;
/**
 * Cadence locked to real speed so the feet never scrub the floor:
 * frequency scales linearly with velocity, clamped to a believable range.
 */
export declare function gaitFrequency(speed: number, referenceSpeed: number, gait: GaitParams): number;
/** How many foot contacts happen when the cycle advances by `advance` from `prevPhase`. */
export declare function footContacts(prevPhase: number, advance: number): number;
//# sourceMappingURL=humanoid-locomotion.d.ts.map