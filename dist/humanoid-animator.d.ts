import type { AnimationGroup, TransformNode } from '@babylonjs/core';
import type { LobbyAnimationState } from './protocol';
export declare class HumanoidAnimator {
    private root;
    private time;
    private phase;
    private walkWeight;
    private runWeight;
    private airWeight;
    private slideWeight;
    private speed;
    private pendingContacts;
    private clipStepAcc;
    private slideMode;
    private walkSpeedRef;
    private runSpeedRef;
    private readonly pose;
    private readonly gait;
    private groups;
    private activeClip;
    constructor(root: TransformNode, animationGroups?: AnimationGroup[]);
    setSlideMode(on: boolean): void;
    /** Lets cadence be normalised against the lobby's configured move speeds. */
    setSpeedReference(walkSpeed: number, runSpeed: number): void;
    /**
     * @param speed horizontal speed in units/s; drives stride cadence so the feet
     *              cannot scrub the floor. Omit to fall back to nominal speeds.
     */
    update(dt: number, state: LobbyAnimationState, grounded: boolean, speed?: number): void;
    /** True on each visual foot plant (walk / run), for footstep audio. */
    takeFootPlant(state: LobbyAnimationState, dt?: number): boolean;
    private playClip;
}
//# sourceMappingURL=humanoid-animator.d.ts.map